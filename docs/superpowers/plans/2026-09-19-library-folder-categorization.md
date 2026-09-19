# Library Folder Categorization with Escalating Credit Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add folder categorization to the Study Library so users can organize their Reviewers (Study Sets), with up to 3 free folders and an escalating credit cost ($4^{\text{th}} = 50$, $5^{\text{th}} = 75$, $6^{\text{th}} = 100$ credits, etc.) for additional folders.

**Architecture:** A full-stack solution featuring a backend Folder repository and REST endpoints (`/api/folders`), `folder_id` association on `study_sets`, offline-first caching via `localDb`, and a smooth top folder carousel and creation modal on the mobile Reviewers tab adhering to `expo-native-ui` and `expo-data-fetching`.

**Tech Stack:** Python, FastAPI, Pydantic, pytest, React Native, Expo, TypeScript, `@hugeicons/react-native`, `AsyncStorage`, `CreditsContext`.

**Spec:** `docs/superpowers/specs/2026-09-19-library-folder-categorization-design.md`

## Global Constraints
- Grounding & persistence: Deleting a folder or detaching items will NEVER delete the study sets (AGENTS.md Rule 33).
- Offline-first resilience: `localDb` caches folders and sets so the library functions offline (AGENTS.md Rule 21).
- Escalating credit formula: $4^{\text{th}} = 50$, $5^{\text{th}} = 75$, $N^{\text{th}} = 50 + (N - 3) \times 25$ credits.
- Styling guidelines: Use `borderCurve: 'continuous'`, `boxShadow`, and Momo mascot animations (`folder_momo.png`, `no_credits_momo.png`).

---

### Task 1: Backend Schemas and Models

**Files:**
- Create: `backend/app/schemas/folder.py`
- Modify: `backend/app/schemas/study.py`
- Test: `backend/tests/test_folder_schemas.py`

**Interfaces:**
- Consumes: Pydantic `BaseModel`
- Produces: `FolderBase`, `FolderCreateRequest`, `FolderUpdateRequest`, `FolderResponse` in `app/schemas/folder.py`; updated `StudySetUpdateRequest` and `StudySetResponse` in `app/schemas/study.py`.

- [ ] **Step 1: Write the failing test for folder schemas**

```python
# backend/tests/test_folder_schemas.py
from datetime import datetime, timezone
from app.schemas.folder import FolderCreateRequest, FolderResponse, FolderUpdateRequest
from app.schemas.study import StudySetUpdateRequest, StudySetResponse

def test_folder_create_schema_valid():
    req = FolderCreateRequest(name="Biology 101", color="#4F46E5")
    assert req.name == "Biology 101"
    assert req.color == "#4F46E5"

def test_folder_response_schema():
    now = datetime.now(timezone.utc)
    res = FolderResponse(
        id="folder-1",
        user_id="user-1",
        name="Chemistry",
        color=None,
        reviewer_count=3,
        created_at=now,
        updated_at=now
    )
    assert res.id == "folder-1"
    assert res.reviewer_count == 3

def test_studyset_update_with_folder_id():
    req = StudySetUpdateRequest(title="Exam 1", folder_id="folder-1")
    assert req.folder_id == "folder-1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/.venv/bin/pytest backend/tests/test_folder_schemas.py -v`
Expected: FAIL with ModuleNotFoundError: No module named 'app.schemas.folder'

- [ ] **Step 3: Write schema implementations**

Create `backend/app/schemas/folder.py`:
```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class FolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Folder name")
    color: Optional[str] = Field(None, description="Hex color or theme tag for folder")

class FolderCreateRequest(FolderBase):
    pass

class FolderUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = None

class FolderResponse(FolderBase):
    id: str
    user_id: str
    reviewer_count: int = 0
    created_at: datetime
    updated_at: datetime
```

Update `backend/app/schemas/study.py` to add `folder_id`:
```python
class StudySetUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    folder_id: Optional[str] = None

class StudySetResponse(BaseModel):
    id: str
    user_id: str
    document_id: Optional[str] = None
    folder_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    item_count: int
    generation_config: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/.venv/bin/pytest backend/tests/test_folder_schemas.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/folder.py backend/app/schemas/study.py backend/tests/test_folder_schemas.py
git commit -m "feat(backend): add folder schemas and study set folder_id field"
```

---

### Task 2: Backend Folder Repository & Study Set Repository Updates

**Files:**
- Create: `backend/app/db/repositories/folder_repo.py`
- Modify: `backend/app/db/repositories/study_repo.py`
- Test: `backend/tests/test_folders.py`

**Interfaces:**
- Consumes: `app.db.session.supabase_session`
- Produces: `folder_repo.create_folder()`, `folder_repo.list_folders()`, `folder_repo.get_folder()`, `folder_repo.update_folder()`, `folder_repo.delete_folder()`, `calculate_folder_credit_cost()`

- [ ] **Step 1: Write failing tests for folder repository**

In `backend/tests/test_folders.py`:
```python
import pytest
from app.db.repositories.folder_repo import folder_repo, calculate_folder_credit_cost
from app.db.repositories.study_repo import study_repo

@pytest.mark.asyncio
async def test_calculate_folder_credit_cost():
    assert calculate_folder_credit_cost(0) == 0
    assert calculate_folder_credit_cost(1) == 0
    assert calculate_folder_credit_cost(2) == 0
    assert calculate_folder_credit_cost(3) == 50   # 4th folder costs 50
    assert calculate_folder_credit_cost(4) == 75   # 5th folder costs 75
    assert calculate_folder_credit_cost(5) == 100  # 6th folder costs 100

@pytest.mark.asyncio
async def test_folder_crud_and_study_set_detach():
    user_id = "test-user-folders"
    # 1. Create Folder
    f = await folder_repo.create_folder({"user_id": user_id, "name": "Physics"})
    assert f["name"] == "Physics"
    folder_id = f["id"]

    # 2. Create Study Set assigned to Folder
    s = await study_repo.create_study_set({
        "user_id": user_id,
        "title": "Quantum Mechanics",
        "folder_id": folder_id
    })
    assert s["folder_id"] == folder_id

    # 3. List folders and verify reviewer count
    folders = await folder_repo.list_folders(user_id)
    target = next((x for x in folders if x["id"] == folder_id), None)
    assert target is not None
    assert target["reviewer_count"] == 1

    # 4. Delete folder and ensure study set is NOT deleted, but unassigned
    deleted = await folder_repo.delete_folder(folder_id, user_id)
    assert deleted is True

    updated_s = await study_repo.get_study_set(s["id"], user_id)
    assert updated_s is not None
    assert updated_s.get("folder_id") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/.venv/bin/pytest backend/tests/test_folders.py -v`
Expected: FAIL with ModuleNotFoundError: No module named 'app.db.repositories.folder_repo'

- [ ] **Step 3: Implement `folder_repo.py` and update `study_repo.py`**

Create `backend/app/db/repositories/folder_repo.py`:
- Implement `calculate_folder_credit_cost(existing_count: int) -> int`.
- Implement `FolderRepository` storing `self._folders: Dict[str, Dict[str, Any]] = {}`.
- Implement `create_folder`, `list_folders` (calculates `reviewer_count` using `study_repo._study_sets`), `get_folder`, `update_folder`, `delete_folder` (unsets `folder_id` on study sets).
- Update `study_repo.py` to support `folder_id` updates in `update_study_set` and preserve `folder_id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/.venv/bin/pytest backend/tests/test_folders.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/db/repositories/folder_repo.py backend/app/db/repositories/study_repo.py backend/tests/test_folders.py
git commit -m "feat(backend): implement folder repository and study set folder association"
```

---

### Task 3: Backend API Endpoints & FastAPI Route Registration

**Files:**
- Create: `backend/app/api/routes/folders.py`
- Modify: `backend/app/api/routes/study_sets.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_folders.py`

**Interfaces:**
- Consumes: `app.dependencies.get_current_user`, `app.db.repositories.folder_repo.folder_repo`
- Produces: REST endpoints at `/api/folders`

- [ ] **Step 1: Write integration tests for `/api/folders` endpoints**

Add endpoint tests to `backend/tests/test_folders.py` testing:
- `GET /api/folders` returns 200 and list.
- `POST /api/folders` creates a folder.
- `POST /api/folders` with duplicate name returns 400.
- `PATCH /api/folders/{id}` renames folder.
- `PATCH /api/study-sets/{id}` sets `folder_id`.
- `DELETE /api/folders/{id}` deletes folder.

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/.venv/bin/pytest backend/tests/test_folders.py -k "test_api" -v`
Expected: FAIL (routes not defined)

- [ ] **Step 3: Implement API routes and register in `main.py`**

Create `backend/app/api/routes/folders.py`:
- `GET /api/folders`
- `POST /api/folders` (checks if count >= 3, sets credit cost, creates folder)
- `PATCH /api/folders/{folder_id}`
- `DELETE /api/folders/{folder_id}`

Update `backend/app/api/routes/study_sets.py`:
- In `update_study_set`, if `req.folder_id is not None`, set `updates["folder_id"] = req.folder_id if req.folder_id != "" else None`.

Update `backend/app/main.py`:
- Include `folders.router`.

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/.venv/bin/pytest backend/tests/test_folders.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/folders.py backend/app/api/routes/study_sets.py backend/app/main.py backend/tests/test_folders.py
git commit -m "feat(backend): add folder REST API endpoints and integrate with main app"
```

---

### Task 4: Mobile Types, API Client, and LocalDb Support

**Files:**
- Modify: `mobile/types/index.ts`
- Create: `mobile/lib/api/folders.ts`
- Modify: `mobile/lib/storage/localDb.ts`

**Interfaces:**
- Consumes: `mobile/lib/api/client.ts`
- Produces: `Folder` interface, `listFolders()`, `createFolder()`, `updateFolder()`, `deleteFolder()`, `setStudySetFolder()`, and `localDb.listFolders()`.

- [ ] **Step 1: Update `mobile/types/index.ts`**

Add `Folder` interface and `folder_id?: string | null` to `StudySet`.

- [ ] **Step 2: Create `mobile/lib/api/folders.ts`**

Implement:
```typescript
import { apiFetch } from './client';
import { Folder, StudySet } from '../../types';

export async function listFolders(): Promise<Folder[]> {
  return apiFetch<Folder[]>('/api/folders');
}

export async function createFolder(name: string, color?: string): Promise<Folder> {
  return apiFetch<Folder>('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  });
}

export async function updateFolder(id: string, updates: { name?: string; color?: string }): Promise<Folder> {
  return apiFetch<Folder>(`/api/folders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteFolder(id: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/folders/${id}`, { method: 'DELETE' });
}

export async function setStudySetFolder(studySetId: string, folderId: string | null): Promise<StudySet> {
  return apiFetch<StudySet>(`/api/study-sets/${studySetId}`, {
    method: 'PATCH',
    body: JSON.stringify({ folder_id: folderId ?? '' }),
  });
}
```

- [ ] **Step 3: Update `mobile/lib/storage/localDb.ts`**

Add `folders: Map<string, Folder>` and offline methods `listFolders`, `saveFolder`, `deleteFolder`, `updateFolder`, and update `updateStudySetFolder`.

- [ ] **Step 4: Typecheck mobile**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add mobile/types/index.ts mobile/lib/api/folders.ts mobile/lib/storage/localDb.ts
git commit -m "feat(mobile): add folder types, API client, and offline localDb storage"
```

---

### Task 5: Mobile Modals (Create Folder with Escalating Cost & Move to Folder)

**Files:**
- Create: `mobile/components/library/CreateFolderModal.tsx`
- Create: `mobile/components/library/MoveToFolderModal.tsx`

**Interfaces:**
- Consumes: `useCredits()`, `Folder`, `colors`, `spacing`, `typography`
- Produces: `<CreateFolderModal />`, `<MoveToFolderModal />`

- [ ] **Step 1: Implement `CreateFolderModal.tsx`**
  - Renders native modal with smooth backdrop.
  - Input field for Folder Name.
  - Shows folder quota status:
    - If `currentFolderCount < 3`: Green badge `"Free Folder ({currentFolderCount} of 3 used)"`.
    - If `currentFolderCount >= 3`:
      - Calculate escalating cost: `cost = 50 + (currentFolderCount - 3) * 25`.
      - Show `"Requires {cost} Credits"` banner with current credit balance.
      - If credits < cost: display `no_credits_momo.png` and button `"Get Credits in Shop"`.
      - If credits >= cost: button `"Create & Deduct {cost} Credits"`.
  - When confirmed, triggers `onSave(name, cost)`.

- [ ] **Step 2: Implement `MoveToFolderModal.tsx`**
  - Displays list of user folders with counts.
  - Includes a "None (Unorganized)" option to remove a reviewer from any folder.
  - Marks current assigned folder with a checkmark.
  - When selected, triggers `onSelectFolder(folderId | null)`.

- [ ] **Step 3: Typecheck mobile**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add mobile/components/library/CreateFolderModal.tsx mobile/components/library/MoveToFolderModal.tsx
git commit -m "feat(mobile): add CreateFolderModal with credit gating and MoveToFolderModal"
```

---

### Task 6: Library Screen Integration (Top Folder Carousel & Filtering)

**Files:**
- Modify: `mobile/app/(tabs)/library.tsx`

**Interfaces:**
- Consumes: `listFolders`, `createFolder`, `deleteFolder`, `updateFolder`, `setStudySetFolder`, `CreateFolderModal`, `MoveToFolderModal`, `useCredits`
- Produces: Interactive Library Screen with Top Folder Carousel and folder organization.

- [ ] **Step 1: Add folder state and data loading in `library.tsx`**
  - States: `folders: Folder[]`, `selectedFolderId: string | null` (null = All), `showCreateFolder: boolean`, `moveToFolderTarget: StudySet | null`.
  - Fetch folders alongside sets & docs in `loadData()` using fallback to `localDb`.

- [ ] **Step 2: Render Top Folder Carousel above Reviewers list**
  - Horizontal `ScrollView` with `contentContainerStyle` and `showsHorizontalScrollIndicator={false}`.
  - "All" card showing total sets count.
  - Each folder card: folder icon / Momo badge, folder name, item count, active styling.
  - Long press / options button on folder to rename or delete.
  - "+ New Folder" card triggering `showCreateFolder(true)`.

- [ ] **Step 3: Filter reviewers by active folder**
  - `filteredSets` filters by search AND `selectedFolderId` (if `selectedFolderId` is set, only shows items where `item.folder_id === selectedFolderId`).

- [ ] **Step 4: Add Folder Badge and "Move to Folder" button on reviewer cards**
  - Reviewer card displays folder tag if assigned.
  - Quick action button to trigger `MoveToFolderModal`.

- [ ] **Step 5: Connect Modals and handlers**
  - Handle folder creation with credit deduction via `deductCredits(cost)` if paid tier.
  - Handle moving reviewer to folder with `setStudySetFolder`.
  - Handle folder deletion and update local list.

- [ ] **Step 6: Run mobile lint / typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add mobile/app/\(tabs\)/library.tsx
git commit -m "feat(mobile): integrate folder carousel, filtering, and study set organization in library"
```

---

### Task 7: Full Test Suite and Verification

**Files:**
- Test: All backend tests (`backend/tests/`)
- Test: Mobile type check

- [ ] **Step 1: Run all backend tests**

Run: `backend/.venv/bin/pytest backend/tests/ -v`
Expected: 100% pass

- [ ] **Step 2: Run mobile type check**

Run: `cd mobile && npm run lint`
Expected: 0 errors

- [ ] **Step 3: Verification commit if any fixes needed**

```bash
git status
```

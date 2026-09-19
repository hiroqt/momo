# Technical Design Specification: Library Folder Categorization with Escalating Credit Quota

## 1. Overview
This specification defines the architecture, data models, API endpoints, and mobile UI flows for adding **Folder Categorization** in the Study Library. Users can organize their AI Reviewers (Study Sets) into custom folders. Every user can create up to **3 free folders**. Creating any additional folder ($4^{\text{th}}$ folder onwards) requires credits with an **escalating credit cost** ($4^{\text{th}} = 50$, $5^{\text{th}} = 75$, $6^{\text{th}} = 100$ credits, etc.).

## 2. Architectural Principles & Constraints
1. **Grounded & Persistent Study Sets (AGENTS.md Rule 33)**: Deleting a folder or detaching items will NEVER delete the underlying study sets or their generated flashcards and questions. Deleting a folder unsets `folder_id` to `null` on all contained study sets.
2. **Offline-First Resilience (AGENTS.md Rule 21)**: The mobile client uses `localDb` to cache and manage folders and folder assignments offline.
3. **Native UI Patterns (`expo-native-ui`, `expo-data-fetching`)**: 
   - Smooth horizontal folder carousel with continuous border curves (`borderCurve: 'continuous'`).
   - Clean state transitions and four-state UI handling (loading, content, empty, error).
   - Dynamic feedback and Momo mascot illustrations (`folder_momo.png`, `wealth_momo.png`, `no_credits_momo.png`).

---

## 3. Data Models & Schemas

### 3.1 Backend Schema (`backend/app/schemas/folder.py` & `backend/app/schemas/study.py`)

#### Folder Schemas
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

#### StudySet Schema Update (`backend/app/schemas/study.py`)
```python
class StudySetUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    folder_id: Optional[str] = None  # None or empty string unassigns from folder

class StudySetResponse(BaseModel):
    id: str
    user_id: str
    document_id: Optional[str] = None
    folder_id: Optional[str] = None  # Reference to assigned folder
    title: str
    description: Optional[str] = None
    item_count: int
    generation_config: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
```

### 3.2 Mobile TypeScript Types (`mobile/types/index.ts`)
```typescript
export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  reviewer_count: number;
  created_at: string;
  updated_at: string;
}

export interface StudySet {
  id: string;
  user_id: string;
  document_id?: string;
  folder_id?: string | null; // Associated folder ID
  title: string;
  description?: string;
  item_count: number;
  generation_config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

---

## 4. Business Logic: Quota & Escalating Credit Calculation

### 4.1 Cost Calculation
- Free limit: **3 folders** per user.
- For folder creation where `current_folder_count >= 3`:
  $$\text{credit\_cost}(N) = 50 + (N - 3) \times 25$$
  Where $N$ is the target folder index (e.g. 4th folder = $50 + 0 = 50$ credits; 5th folder = $50 + 25 = 75$ credits; 6th folder = $100$ credits).
- Credit deduction occurs safely client-side via `CreditsContext.deductCredits(cost)` and is validated during creation.

---

## 5. Backend Implementation

### 5.1 Repository: `backend/app/db/repositories/folder_repo.py`
Provides CRUD operations backed by in-memory dictionary storage with Supabase PostgreSQL fallback:
- `create_folder(data: Dict[str, Any]) -> Dict[str, Any]`
- `list_folders(user_id: str) -> List[Dict[str, Any]]` (calculates `reviewer_count` dynamically from `study_sets`)
- `get_folder(folder_id: str, user_id: str) -> Optional[Dict[str, Any]]`
- `update_folder(folder_id: str, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]`
- `delete_folder(folder_id: str, user_id: str) -> bool` (updates all study sets with `folder_id == folder_id` to `folder_id = None`)

### 5.2 API Routes: `backend/app/api/routes/folders.py`
- `GET /api/folders`: Returns list of folders with `reviewer_count`.
- `POST /api/folders`: Validates input, creates folder.
- `PATCH /api/folders/{id}`: Renames or updates folder color.
- `DELETE /api/folders/{id}`: Deletes folder and unassigns reviewers.
- Registered into FastAPI `app/main.py`.

---

## 6. Mobile Implementation

### 6.1 API & Offline DB Client
- `mobile/lib/api/folders.ts`:
  - `listFolders(): Promise<Folder[]>`
  - `createFolder(name: string, color?: string): Promise<Folder>`
  - `updateFolder(id: string, updates: { name?: string; color?: string }): Promise<Folder>`
  - `deleteFolder(id: string): Promise<{ deleted: boolean }>`
  - `setStudySetFolder(studySetId: string, folderId: string | null): Promise<StudySet>`
- `mobile/lib/storage/localDb.ts`:
  - Implements local folder caching and sets updates for offline usage.

### 6.2 Library Screen (`mobile/app/(tabs)/library.tsx`)
- **Top Folder Carousel**:
  - Positioned above the Reviewers list.
  - Horizontally scrollable list containing:
    - **"All" pill**: Shows total count of all reviewers; acts as reset filter.
    - **Folder Pills**: Each folder shows a folder icon / Momo badge, folder name, item count, and active selection state.
    - **"+ New Folder" button**: Prominently styled button triggering the create modal.
  - Active folder selection filters the displayed reviewers in real-time.
  - Long press on folder or options icon opens Rename / Delete action sheet.
- **Create Folder Modal (`mobile/components/library/CreateFolderModal.tsx`)**:
  - Displays folder name input with validation.
  - If `folders.length < 3`: Displays `"Free folder (X of 3 used)"` in green/primary tone.
  - If `folders.length >= 3`: Displays escalating cost banner, user's current credit balance from `useCredits()`, Momo illustration (`wealth_momo.png` or `no_credits_momo.png`), and direct CTA to Shop tab if balance is insufficient.
- **Move to Folder Modal (`mobile/components/library/MoveToFolderModal.tsx`)**:
  - Triggered from reviewer card action.
  - Lists existing folders + "None (Unorganized)" option to easily organize reviewers.

---

## 7. Verification & Testing Strategy
1. **Backend Tests (`backend/tests/test_folders.py`)**:
   - Verify folder creation up to 3 free folders.
   - Verify calculation of escalating credit costs.
   - Verify listing folders returns accurate `reviewer_count`.
   - Verify renaming and deleting folders (confirming detached study sets preserve their questions).
   - Verify assigning and unassigning study sets to folders.
2. **Mobile Code Quality & Type Check**:
   - Run `npx tsc --noEmit` to verify type safety across mobile.
   - Verify edge cases: zero folders, 3 folders, 4+ folders, low credits redirect to shop, offline mode fallback.

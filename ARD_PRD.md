# AI Study Platform --- ARD / PRD

## 1. Document Information

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Product                             AI Study Platform

  Platform                            React Native + Expo mobile
                                      application

  Backend                             Python + FastAPI

  Database                            Supabase PostgreSQL

  Authentication                      Google

  Object Storage                      AWS S3

  AI Model                            NVIDIA Nemotron Ultra

  AI Gateway                          OpenRouter

  Architecture                        RAG + grounded generation +
                                      asynchronous document processing

  Supported Files                     PDF, DOCX, TXT, PPTX

  Maximum File Size                   10--15 MB

  Maximum Pages                       50 pages

  Original File Retention             3 days

  Offline Study                       Yes

  Offline Generation                  No

  Document Generation Limit           10 documents/month/user

  Primary Product                     AI Study Platform
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 2. Product Vision

The AI Study Platform lets students and exam takers turn their existing
study materials into interactive reviewers.

A user uploads a document, describes what they want to study, and
receives a generated study set grounded only in the uploaded material.

The platform should support multiple study formats from the same source:

-   Flashcards
-   Multiple-choice questions
-   True/False
-   Identification
-   Fill-in-the-blank
-   Practice exams
-   Study summaries
-   Q&A
-   Topic explanations

The product should prioritize:

1.  Source grounding
2.  Generation quality
3.  Generation speed
4.  Simple mobile UX
5.  Offline studying
6.  Recoverable processing
7.  Clear source attribution

The product should not behave as a generic chatbot that invents
educational content. Uploaded documents are the primary knowledge
source.

------------------------------------------------------------------------

# 3. Target Users

The platform targets:

-   High school students
-   College students
-   Review-center students
-   Professional examination candidates
-   General learners

The initial product should remain broad enough to support different
subjects and exam types.

Examples:

-   Biology
-   Nursing
-   Computer Science
-   Information Technology
-   Engineering
-   Law
-   Medicine
-   Accounting
-   Mathematics
-   Networking
-   Professional certification review

------------------------------------------------------------------------

# 4. Core User Journey

``` text
Google Sign In
      ↓
Home
      ↓
Upload Study Material
      ↓
Document Processing
      ↓
Document Ready
      ↓
Create Reviewer
      ↓
Configure Requirements
      ↓
Retrieve Relevant Source Content
      ↓
Synthesize Grounded Context
      ↓
Nemotron Ultra Generation
      ↓
Validate / Deduplicate
      ↓
Save Study Set
      ↓
Study
      ↓
Offline Progress Sync
```

------------------------------------------------------------------------

# 5. Core Product Features

## 5.1 Google Authentication

Users authenticate through Google.

Requirements:

-   Google OAuth
-   Secure token handling
-   Supabase user identity
-   User-specific data isolation
-   Persistent sessions
-   Logout
-   Account deletion

The mobile client must never directly receive or expose server-side
secrets.

## 5.2 Gamified Learning (XP System)

The study experience includes a gamified reward system.
When answering questions in the Quiz Runner:
- Users earn XP for correct answers.
- The amount of XP varies by the question type (e.g., identification vs multiple choice).
- Incorrect answers yield 0 XP.

## 5.3 Momo AI Mascot

The platform uses a dedicated AI mascot ("Momo") to guide users through generation and learning states.
- Animations reflect current app states (e.g., `MomoMaker` during generation, `MomoSadFace` on failure, `MomoThinkingFace` during answer evaluation).


------------------------------------------------------------------------

# 6. Document Upload

Supported:

-   PDF
-   DOCX
-   TXT
-   PPTX

Constraints:

-   Target maximum: 10--15 MB
-   Target maximum: 50 pages
-   Reject unsupported file types
-   Reject oversized files
-   Validate MIME type and extension
-   Generate a unique object key
-   Upload directly to AWS S3 using a secure mechanism such as a
    presigned upload URL

Recommended upload flow:

``` text
Expo
  ↓
Request presigned upload URL
  ↓
FastAPI
  ↓
S3 presigned URL
  ↓
Expo uploads directly to S3
  ↓
FastAPI receives processing request
```

Do not route large document bytes through the FastAPI application server
unless necessary.

------------------------------------------------------------------------

# 7. Temporary Document Retention

Original uploaded documents remain available for exactly the configured
retention window.

Default:

**3 days**

Lifecycle:

``` text
Uploaded
   ↓
S3
   ↓
Processed
   ↓
Available for 3 days
   ↓
Automatic deletion
```

The database must not assume that the original object remains forever.

Store:

-   S3 object key
-   upload timestamp
-   expiration timestamp
-   processing status
-   file metadata
-   extraction metadata

Use an automated cleanup mechanism.

The generated study set must remain after the original file is deleted.

------------------------------------------------------------------------

# 8. Document Processing Pipeline

The document pipeline should be modular.

``` text
Document
   ↓
File Validation
   ↓
Text / Structure Extraction
   ↓
OCR if required
   ↓
Normalization
   ↓
Structure Detection
   ↓
Chunking
   ↓
Metadata Assignment
   ↓
Embedding Generation
   ↓
Vector Index
   ↓
Knowledge Source Ready
```

Each processing stage should have an explicit status.

Example:

``` text
UPLOADED
VALIDATING
EXTRACTING
OCR
NORMALIZING
CHUNKING
EMBEDDING
INDEXING
READY
FAILED
```

------------------------------------------------------------------------

# 9. OCR

OCR is required for scanned or image-based documents where normal text
extraction is insufficient.

The OCR layer should:

1.  Detect whether extracted text is usable.
2.  Run OCR when required.
3.  Preserve page numbers.
4.  Preserve document/section relationships where possible.
5.  Mark OCR-derived content.
6.  Make OCR errors visible to the downstream pipeline where
    appropriate.

OCR should be implemented behind an abstraction so the OCR provider/tool
can be replaced later.

------------------------------------------------------------------------

# 10. Document Structure

The extraction pipeline should preserve as much document structure as
practical:

-   Page number
-   Heading
-   Section
-   Paragraph
-   List
-   Table
-   Code block
-   Slide number for PPTX
-   Document title

Each chunk should carry metadata.

Example:

``` json
{
  "document_id": "doc_123",
  "chunk_id": "chunk_456",
  "content": "...",
  "page_start": 18,
  "page_end": 19,
  "section": "Cellular Respiration",
  "source_type": "pdf"
}
```

------------------------------------------------------------------------

# 11. Tables

Tables should not be flattened blindly.

The extraction layer should preserve table relationships where possible.

Example source:

``` text
Drug | Dosage | Effect
A    | 50mg   | ...
B    | 20mg   | ...
```

The resulting knowledge chunks should preserve enough structure for the
AI to understand row/column relationships.

------------------------------------------------------------------------

# 12. RAG / Grounding Architecture

The application uses retrieval-augmented generation.

The PDF/document is the primary knowledge source.

``` text
Document
   ↓
Chunks
   ↓
Embeddings
   ↓
Vector Search
   ↓
Relevant Evidence
   ↓
Context Synthesis
   ↓
Nemotron Ultra
```

The system should not pass an entire large document to the model when
retrieval can provide the relevant evidence.

------------------------------------------------------------------------

# 13. Grounded Knowledge Synthesis

Before generation, the backend should retrieve relevant chunks based on
the user's requested requirements.

Example:

User:

> Create 30 difficult flashcards about cardiovascular diseases.

Pipeline:

``` text
User Requirements
      ↓
Topic / Intent Analysis
      ↓
Retrieve Relevant Chunks
      ↓
Rank Evidence
      ↓
Synthesize Grounded Context
      ↓
Nemotron Ultra
```

The synthesis layer should:

-   Combine related sections
-   Remove irrelevant content
-   Preserve important definitions
-   Preserve relationships
-   Preserve source references
-   Avoid adding unsupported facts
-   Maintain page/section provenance

------------------------------------------------------------------------

# 14. Source-Only Policy

Default behavior:

**Use only information supported by the uploaded document.**

If the document lacks enough information, the system should not silently
supplement it with general model knowledge.

Example:

``` text
User:
Create 50 questions about quantum computing.

Document:
Contains only basic networking material.
```

Expected result:

``` text
Insufficient source coverage.

The uploaded material does not contain enough
information about quantum computing.

Try another topic or upload another document.
```

The product may later support an explicit user-controlled "supplement
with general knowledge" mode, but that is not part of the default MVP
behavior.

------------------------------------------------------------------------

# 15. User Generation Requirements

Users can configure:

-   Study topic
-   Number of questions/cards
-   Difficulty
-   Question types
-   Focus areas
-   Chapters/sections where supported
-   Custom instructions

Example:

``` text
Topic:
Cardiovascular System

Number:
50

Difficulty:
Hard

Question Types:
Multiple Choice
Identification

Instructions:
Focus on concepts likely to appear on an exam.
Prioritize mechanisms and comparisons.
```

------------------------------------------------------------------------

# 16. Custom Prompt

Users may provide natural-language requirements.

Example:

> Create 50 difficult questions from Chapters 1--5. Focus on concepts
> likely to appear on exams. Avoid trivial questions. Make the questions
> require understanding rather than memorization.

The backend should convert user requirements into a structured
generation specification before sending the request to Nemotron.

Do not rely solely on raw prompt concatenation.

------------------------------------------------------------------------

# 17. Generation Types

## Flashcards

``` json
{
  "type": "flashcard",
  "question": "...",
  "answer": "...",
  "explanation": "...",
  "difficulty": "hard",
  "source": {
    "document_id": "...",
    "page": 42,
    "section": "..."
  }
}
```

## Multiple Choice

Must include:

-   Question
-   Options
-   Correct answer
-   Explanation
-   Difficulty
-   Source

## True/False

Must include:

-   Statement
-   Correct answer
-   Explanation
-   Source

## Identification

Must include:

-   Question
-   Expected answer
-   Accepted answer variants where appropriate
-   Explanation
-   Source

## Fill-in-the-Blank

Must include:

-   Question
-   Blank
-   Expected answer
-   Explanation
-   Source

## Practice Exam

Must contain:

-   Exam metadata
-   Questions
-   Question types
-   Answer key
-   Explanations
-   Sources
-   Difficulty

## Study Summary

Must be grounded in the source document and preserve important concepts.

## Q&A

Should produce source-grounded question/answer pairs.

## Explain Topic

Should explain a selected topic using only supported information from
the source.

------------------------------------------------------------------------

# 18. Flashcard UX

Example:

``` text
Biology
Card 12 / 50

What is the primary purpose of
the Krebs cycle?

[ Show Answer ]
```

After reveal:

``` text
Answer

...

Source
Biology.pdf
Page 38
Cellular Respiration

[ I Got It ]
[ Review Again ]
```

------------------------------------------------------------------------

# 19. Quiz UX (Gamified)

The quiz runner currently supports:
- Multiple Choice
- True / False
- Typed input for Fill-in-the-blank and Identification

Example:

``` text
Question 12 / 30
Type: Multiple Choice
[XP Bar]

Which process produces ATP
during glycolysis?

A. ...
B. ...
C. ...
D. ...

[ Submit ]
```

After submission:

``` text
Correct

Explanation:
...

Source:
Biology.pdf — Page 21
```

------------------------------------------------------------------------

# 20. Practice Exam UX

Example:

``` text
Biology Practice Exam

50 Questions
60 Minutes

[ Start Exam ]
```

Features:

-   Timer
-   Question navigation
-   Mark for review
-   Submit exam
-   Score
-   Answer review
-   Explanations
-   Source references

------------------------------------------------------------------------

# 21. Offline Study

Generated study sets can be downloaded/stored locally.

Offline behavior:

``` text
Cloud Study Set
      ↓
Local Mobile Database
      ↓
Offline Study
```

Offline users can:

-   View flashcards
-   Answer quizzes
-   Take downloaded exams
-   Review explanations
-   Review source references already synchronized
-   Record progress

Offline users cannot:

-   Upload documents
-   Generate new AI material
-   Run Nemotron
-   Perform server-side RAG

------------------------------------------------------------------------

# 22. Offline Synchronization

Local study actions should be treated as events or pending mutations.

Example:

``` text
Offline:

Card 12 → Correct
Card 13 → Wrong
Card 14 → Correct

       ↓ Internet returns

Sync Queue
       ↓
FastAPI
       ↓
PostgreSQL
```

The synchronization layer must handle:

-   Retry
-   Duplicate requests
-   Idempotency
-   Conflict resolution
-   Last-known server state

------------------------------------------------------------------------

# 23. Generation UX

Generation is user-friendly and guided by the "Momo" AI Mascot using animated components (e.g. `MomoMaker`).

Detailed progress reflects human-readable states tied directly to the backend processing pipeline:

``` text
[Momo Maker Animation]

Momo is crafting your questions and flashcards...
[Progress Bar: 65%]
```

Actual backend stages shown to the user:
- Retrieving relevant study concepts...
- Extracting key study concepts from your document...
- Momo is crafting your questions and flashcards...
- Fact-checking answers and verifying questions...
- Packaging your high-yield reviewer...
- Your reviewer is cooked to perfection! Ready to lock in!

------------------------------------------------------------------------

# 24. Generation Failure

For MVP, generation failure should allow a full restart.

Example:

``` text
We couldn't finish creating your reviewer.

Your document is still available.

[ Try Again ]
```

The retry must create a clean generation attempt rather than
accidentally duplicating old partial results.

------------------------------------------------------------------------

# 25. Validation Layer

Generated content must be validated before being shown as final.

Validation should check:

-   Required fields exist
-   JSON/schema is valid
-   Question is not empty
-   Answer is not empty
-   Multiple-choice questions have valid options
-   Correct answer exists
-   Difficulty is valid
-   Source references exist
-   Question is supported by retrieved evidence
-   Duplicate/near-duplicate questions are removed
-   Malformed model output is rejected

Potential pipeline:

``` text
Nemotron
   ↓
JSON Parse
   ↓
Schema Validation
   ↓
Grounding Validation
   ↓
Duplicate Detection
   ↓
Final Study Set
```

------------------------------------------------------------------------

# 26. Grounding Validation

A generated question should have supporting evidence.

Example:

``` text
Question
   ↓
Supporting source chunks
   ↓
Grounding check
```

If evidence is insufficient:

``` text
Reject card
```

Do not present unsupported content as source-grounded.

------------------------------------------------------------------------

# 27. Duplicate Detection

The system should identify exact and semantic duplicates.

Example:

``` text
What is HTTP?

What does HTTP stand for?

What protocol is used for web communication?
```

These may overlap and should not unnecessarily occupy three cards.

------------------------------------------------------------------------

# 28. Database Model

Recommended core entities:

``` text
users
documents
document_chunks
generation_jobs
study_sets
study_items
study_sessions
study_answers
sync_events
usage_records
```

Suggested relationships:

``` text
User
 ├── Documents
 ├── Study Sets
 ├── Generation Jobs
 ├── Study Sessions
 └── Usage Records

Document
 ├── Chunks
 └── Study Sets

Study Set
 ├── Study Items
 └── Study Sessions
```

------------------------------------------------------------------------

# 29. Recommended Document Schema

``` text
documents
- id
- user_id
- original_filename
- file_type
- mime_type
- file_size
- page_count
- s3_object_key
- uploaded_at
- expires_at
- processing_status
- processing_error
- created_at
- updated_at
```

------------------------------------------------------------------------

# 30. Recommended Study Set Schema

``` text
study_sets
- id
- user_id
- document_id
- title
- description
- generation_config
- generation_status
- item_count
- created_at
- updated_at
```

------------------------------------------------------------------------

# 31. Study Item Schema

``` text
study_items
- id
- study_set_id
- type
- question
- answer
- explanation
- options
- difficulty
- source_metadata
- order_index
- created_at
```

Use JSONB for flexible type-specific structures while keeping important
searchable fields normalized where appropriate.

------------------------------------------------------------------------

# 32. API Architecture

Recommended REST API.

## Authentication

``` text
GET /api/me
```

## Documents

``` text
POST /api/documents/upload-url
POST /api/documents
GET /api/documents
GET /api/documents/{document_id}
DELETE /api/documents/{document_id}
```

## Processing

``` text
GET /api/documents/{document_id}/status
```

## Study Sets

``` text
POST /api/study-sets
GET /api/study-sets
GET /api/study-sets/{study_set_id}
DELETE /api/study-sets/{study_set_id}
```

## Generation

``` text
POST /api/generations
GET /api/generations/{generation_id}
POST /api/generations/{generation_id}/retry
```

## Study

``` text
GET /api/study-sets/{study_set_id}/items
POST /api/study-sessions
POST /api/study-sessions/{session_id}/answers
POST /api/sync
```

------------------------------------------------------------------------

# 33. API Security

Requirements:

-   Validate Supabase JWT
-   Enforce user ownership
-   Never trust `user_id` from request body
-   Validate file type
-   Validate file size
-   Validate page count
-   Protect generation endpoints
-   Rate limit expensive endpoints
-   Enforce 10-document monthly quota
-   Keep OpenRouter credentials server-side
-   Keep AWS credentials server-side
-   Use presigned S3 URLs
-   Never expose privileged Supabase keys to the client

------------------------------------------------------------------------

# 34. Usage Limits

Default:

**10 uploaded documents per user per month**

A document counts when it enters the accepted processing pipeline.

The quota system should prevent abuse before expensive AI processing
begins.

Example:

``` text
10 / 10 documents used

You've reached this month's document limit.
```

Track usage by server-side user identity.

------------------------------------------------------------------------

# 35. AI Provider Architecture

Use an AI provider abstraction.

``` text
AIService
   │
   └── OpenRouterNemotronProvider
```

Do not tightly couple business logic to OpenRouter.

This allows future providers/models:

``` text
OpenRouter
NVIDIA NIM
Direct NVIDIA endpoint
Other model provider
```

------------------------------------------------------------------------

# 36. Model Prompt Architecture

Use layered prompts:

``` text
System Instructions
       +
Generation Specification
       +
Grounded Evidence
       +
Output Schema
```

The model should be explicitly instructed to:

-   Use provided evidence
-   Avoid unsupported facts
-   Follow requested quantity
-   Follow requested difficulty
-   Follow requested question types
-   Produce structured output
-   Preserve source references
-   Avoid duplicate questions
-   Return a clear insufficiency signal when evidence is inadequate

------------------------------------------------------------------------

# 37. Generation Specification

Example:

``` json
{
  "output_type": "flashcard",
  "count": 30,
  "difficulty": "hard",
  "topic": "cardiovascular system",
  "question_types": ["flashcard"],
  "source_only": true,
  "custom_instruction": "Focus on exam-relevant concepts."
}
```

This object should be the internal contract between the product layer
and AI generation layer.

------------------------------------------------------------------------

# 38. Large-File Performance

Even though the maximum document is only approximately 15 MB / 50 pages,
processing should remain asynchronous.

Recommended architecture:

``` text
Expo
 ↓
FastAPI
 ↓
Job Queue
 ↓
Document Worker
 ↓
RAG Index
 ↓
Generation Worker
 ↓
PostgreSQL
```

The API should not hold an HTTP connection open while performing
expensive processing.

------------------------------------------------------------------------

# 39. Background Jobs

Recommended stages:

``` text
DOCUMENT_PROCESSING
       ↓
KNOWLEDGE_INDEXING
       ↓
STUDY_GENERATION
       ↓
VALIDATION
       ↓
PERSISTENCE
```

Each job should have:

-   ID
-   user ID
-   status
-   progress
-   current stage
-   error
-   created timestamp
-   updated timestamp

------------------------------------------------------------------------

# 40. Progress API

Example:

``` json
{
  "status": "generating",
  "progress": 72,
  "stage": "Generating questions",
  "message": "Creating your reviewer..."
}
```

The Expo app can poll this endpoint.

For MVP, polling is acceptable and simpler than WebSockets.

------------------------------------------------------------------------

# 41. Recommended Backend Structure

``` text
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   │
│   ├── api/
│   │   └── routes/
│   │       ├── auth.py
│   │       ├── documents.py
│   │       ├── generations.py
│   │       ├── study_sets.py
│   │       └── sync.py
│   │
│   ├── domain/
│   │   ├── documents/
│   │   ├── generation/
│   │   ├── study/
│   │   └── users/
│   │
│   ├── services/
│   │   ├── storage/
│   │   ├── extraction/
│   │   ├── ocr/
│   │   ├── embeddings/
│   │   ├── retrieval/
│   │   ├── synthesis/
│   │   ├── ai/
│   │   └── validation/
│   │
│   ├── workers/
│   │   ├── document_worker.py
│   │   └── generation_worker.py
│   │
│   ├── db/
│   │   ├── models/
│   │   ├── repositories/
│   │   └── session.py
│   │
│   └── schemas/
│
└── tests/
```

------------------------------------------------------------------------

# 42. Recommended Expo Structure

``` text
mobile/
├── app/
│   ├── (auth)/
│   ├── (tabs)/
│   │   ├── index.tsx
│   │   ├── library.tsx
│   │   └── profile.tsx
│   │
│   ├── documents/
│   ├── create/
│   ├── study/
│   └── generation/
│
├── components/
│   ├── documents/
│   ├── study/
│   ├── quiz/
│   └── generation/
│
├── lib/
│   ├── api/
│   ├── auth/
│   ├── storage/
│   ├── offline/
│   └── sync/
│
├── store/
├── hooks/
├── types/
└── utils/
```

------------------------------------------------------------------------

# 43. Local Storage

Use an on-device database for offline study.

Candidate:

**Expo SQLite**

Store:

-   Downloaded study sets
-   Study items
-   Local sessions
-   Pending sync events
-   Metadata

Secure authentication/session data separately using an appropriate
secure storage mechanism.

------------------------------------------------------------------------

# 44. Home Screen

Suggested:

``` text
Good morning

Continue studying
┌───────────────────────────┐
│ Biology Final Exam        │
│ 64% mastered              │
│ [ Continue ]              │
└───────────────────────────┘

Recent Study Sets

Biology
Data Structures
Networking

[ + Create Reviewer ]
```

------------------------------------------------------------------------

# 45. Library

``` text
My Study Sets

Search

All
Flashcards
Quiz
Exam

Biology Final
Data Structures
Networking
```

The library should focus on generated study sets rather than temporary
raw documents.

------------------------------------------------------------------------

# 46. Create Reviewer Screen

``` text
Create Reviewer

Study Material
[ Biology.pdf ]

What do you want to study?
[ Cardiovascular System ]

Number
[ 30 ]

Difficulty
[ Hard ]

Format
☑ Flashcards
☑ Multiple Choice

Additional instructions
[ Focus on exam-relevant concepts ]

[ Generate Reviewer ]
```

------------------------------------------------------------------------

# 47. Document Processing UX

Avoid technical jargon.

Instead of:

``` text
Embedding chunks...
```

display:

``` text
Understanding your study material...
```

Recommended stages:

``` text
Uploading
Reading document
Understanding content
Preparing study material
Creating reviewer
Finishing up
```

------------------------------------------------------------------------

# 48. Error Handling

User-facing errors should be understandable.

Bad:

``` text
HTTP 502
JSONDecodeError
```

Good:

``` text
We couldn't create your reviewer right now.

Please try again.
```

Log the technical error server-side.

------------------------------------------------------------------------

# 49. Observability

Backend should log:

-   Request ID
-   User ID
-   Document ID
-   Generation ID
-   Processing stage
-   Duration
-   AI provider latency
-   AI failure
-   Validation failures
-   Retry count

Do not log document contents or sensitive user data unnecessarily.

------------------------------------------------------------------------

# 50. Testing Strategy

## Unit Tests

Test:

-   File validation
-   Chunking
-   Metadata extraction
-   Generation specification
-   Prompt construction
-   JSON parsing
-   Validation
-   Duplicate detection
-   Quota calculation

## Integration Tests

Test:

``` text
Upload
 ↓
S3
 ↓
Processing
 ↓
Embedding
 ↓
Retrieval
 ↓
Generation
 ↓
Persistence
```

## Mobile Tests

Test:

-   Authentication
-   Upload
-   Generation status
-   Flashcard navigation
-   Quiz
-   Exam
-   Offline study
-   Sync
-   Error states

------------------------------------------------------------------------

# 51. Acceptance Criteria

## Upload

-   User can sign in with Google.
-   User can upload supported file types.
-   Files above the limit are rejected.
-   Unsupported files are rejected.
-   Files are uploaded securely to S3.

## Processing

-   Text is extracted.
-   OCR is used when needed.
-   Page/source metadata is preserved where possible.
-   Chunks are indexed.
-   Processing status is visible.

## Generation

-   User can specify topic.
-   User can specify quantity.
-   User can specify difficulty.
-   User can specify format.
-   User can provide custom instructions.
-   Generation uses retrieved source evidence.
-   Unsupported content is rejected or reported.
-   Generated content is validated.
-   Study set is persisted.

## Study

-   Flashcards can be studied.
-   Quizzes can be taken.
-   Exams can be taken.
-   Explanations are displayed.
-   Sources are displayed.
-   Generated sets work offline after download.

## Storage

-   Original document expires after 3 days.
-   Generated study sets remain available.
-   Expired S3 objects are deleted automatically.

## Quota

-   User can process up to 10 documents/month.
-   Server enforces the limit.

------------------------------------------------------------------------

# 52. MVP Scope

### Include

-   Google authentication
-   PDF/DOCX/TXT/PPTX upload
-   10--15 MB file limit
-   50-page target
-   OCR
-   Text extraction
-   Chunking
-   Embeddings
-   RAG
-   Grounded generation
-   Nemotron Ultra through OpenRouter
-   Flashcards
-   Multiple-choice
-   True/False
-   Identification
-   Fill-in-the-blank
-   Practice exams
-   Summaries
-   Q&A
-   Topic explanations
-   Custom generation requirements
-   Source references
-   Study set persistence
-   3-day original file retention
-   10-document monthly limit
-   Offline study
-   Progress tracking
-   Generation status
-   Retry

------------------------------------------------------------------------

# 53. Post-MVP

Potential future features:

-   Spaced repetition
-   Adaptive difficulty
-   AI tutor chat
-   General-knowledge supplementation mode
-   Advanced analytics
-   Study streaks
-   Gamification
-   Collaborative study sets
-   Shared reviewers
-   Teacher mode
-   Public reviewer marketplace
-   Additional authentication providers
-   Multiple AI providers
-   Voice-based study
-   Image-based question generation
-   Diagram understanding
-   More advanced multimodal document processing

------------------------------------------------------------------------

# 54. Recommended Implementation Order

``` text
Phase 1
Project setup
Authentication
Database
API foundation

Phase 2
S3 upload
Document metadata
File validation
3-day lifecycle

Phase 3
Document extraction
OCR
Normalization
Chunking

Phase 4
Embeddings
Vector search
Retrieval
Grounding

Phase 5
Nemotron integration
Structured generation
Prompt system

Phase 6
Validation
Deduplication
Source attribution

Phase 7
Study sets
Flashcards
Quiz
Exam
Summary
Q&A

Phase 8
Generation progress
Retries
Quota

Phase 9
Offline SQLite
Study sessions
Sync

Phase 10
Testing
Security
Performance
Deployment
```

------------------------------------------------------------------------

# 55. Definition of Done

The MVP is complete when a new user can:

``` text
1. Sign in with Google
2. Upload a supported study document
3. Wait while it is processed
4. Configure a reviewer
5. Add custom instructions
6. Generate grounded content with Nemotron
7. Open the generated study set
8. Study flashcards
9. Take quizzes/exams
10. See explanations and sources
11. Download the study set for offline use
12. Study offline
13. Reconnect and synchronize progress
14. Return later and access the study set
```

The original uploaded document should automatically expire after three
days while the generated study set remains available.

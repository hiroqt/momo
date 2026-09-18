from app.schemas.errors import APIErrorResponse, ErrorDetail
from app.schemas.documents import UploadUrlRequest, UploadUrlResponse, DocumentCreate, DocumentResponse, DocumentStatusResponse
from app.schemas.generation import GenerationCreateRequest, GenerationJobResponse, InsufficientSourceResponse
from app.schemas.study import StudySetResponse, StudyItemResponse, StudySessionCreate, StudySessionResponse, SourceMetadata
from app.schemas.sync import SyncBatchRequest, SyncBatchResponse, SyncEventItem
from app.schemas.auth import UserProfileResponse

export interface SourceMetadata {
  document_id?: string;
  document_name?: string;
  page?: number;
  section?: string;
  snippet?: string;
}

export type QuestionType =
  | 'flashcard'
  | 'multiple_choice'
  | 'true_false'
  | 'identification'
  | 'fill_in_the_blank'
  | 'summary'
  | 'qa'
  | 'topic_explanation';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface StudyItem {
  id: string;
  study_set_id: string;
  type: QuestionType;
  question: string;
  answer: string;
  explanation?: string;
  hint?: string;
  options?: string[];
  difficulty: DifficultyLevel;
  source_metadata: SourceMetadata;
  order_index: number;
  image_base64?: string;
  diagram_prompt?: string;
  created_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color?: string | null;
  reviewer_count: number;
  created_at: string;
  updated_at: string;
}

export interface StudySet {
  id: string;
  user_id: string;
  document_id?: string;
  folder_id?: string | null;
  title: string;
  description?: string;
  item_count: number;
  generation_config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DocumentItem {
  id: string;
  user_id: string;
  original_filename: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  page_count: number;
  uploaded_at: string;
  expires_at: string;
  processing_status: 'UPLOADED' | 'VALIDATING' | 'EXTRACTING' | 'OCR' | 'NORMALIZING' | 'CHUNKING' | 'EMBEDDING' | 'INDEXING' | 'READY' | 'FAILED';
  processing_error?: string;
  created_at: string;
}

export interface GenerationJob {
  generation_id: string;
  document_id: string;
  status: 'PENDING' | 'PROCESSING' | 'GENERATING' | 'VALIDATING' | 'COMPLETED' | 'FAILED';
  stage: string;
  progress: number;
  message: string;
  study_set_id?: string;
  generation_config?: Record<string, any>;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  documents_used_this_month: number;
  monthly_limit: number;
  quota_resets_at: string;
}

export interface SyncEvent {
  event_id: string;
  study_item_id?: string;
  study_session_id?: string;
  result: 'correct' | 'incorrect' | 'review_again' | 'skipped';
  user_answer?: string;
  occurred_at: string;
}

export interface CitationItem {
  document_id: string;
  document_name: string;
  page_start?: number;
  page_end?: number;
  section?: string;
  snippet: string;
}

export interface CreatedDeckMetadata {
  study_set_id: string;
  title: string;
  item_count: number;
  question_types: string[];
  status: string;
}

export interface StudyCardMetadata {
  id?: string;
  question: string;
  answer: string;
  explanation?: string;
  question_type: 'flashcard' | 'multiple_choice' | 'true_false' | 'identification';
  options?: string[];
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  imported?: boolean;
  study_set_id?: string;
  image_base64?: string;
  diagram_prompt?: string;
}

export interface ToolCallRecord {
  tool_name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  citations?: CitationItem[];
  created_deck?: CreatedDeckMetadata;
  study_card?: StudyCardMetadata;
  quick_replies?: string[];
  tool_calls?: ToolCallRecord[];
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionDetail {
  session: ChatSession;
  messages: ChatMessage[];
}

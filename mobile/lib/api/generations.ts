import { apiFetch } from './client';
import { GenerationJob } from '../../types';

export interface GenerationRequest {
  document_id: string;
  title?: string;
  topic?: string;
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  question_types?: string[];
  source_only?: boolean;
  custom_instruction?: string;
  focus_sections?: string[];
}

export async function createGeneration(req: GenerationRequest): Promise<GenerationJob> {
  return apiFetch<GenerationJob>('/api/generations', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getGenerationStatus(generationId: string): Promise<GenerationJob> {
  return apiFetch<GenerationJob>(`/api/generations/${generationId}`);
}

export async function retryGeneration(generationId: string): Promise<GenerationJob> {
  return apiFetch<GenerationJob>(`/api/generations/${generationId}/retry`, {
    method: 'POST',
  });
}

import { apiFetch } from './client';
import { ChatSession, ChatSessionDetail, ChatMessage } from '../../types';

export async function createChatSession(title?: string): Promise<ChatSession> {
  return apiFetch<ChatSession>('/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function listChatSessions(): Promise<ChatSession[]> {
  return apiFetch<ChatSession[]>('/api/chat/sessions');
}

export async function getChatSession(sessionId: string): Promise<ChatSessionDetail> {
  return apiFetch<ChatSessionDetail>(`/api/chat/sessions/${sessionId}`);
}

export async function deleteChatSession(sessionId: string): Promise<{ status: string; session_id: string }> {
  return apiFetch<{ status: string; session_id: string }>(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function sendChatMessage(
  sessionId: string,
  content: string,
  documentId?: string
): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(`/api/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, document_id: documentId }),
  });
}

export async function quickChat(
  content: string,
  documentId?: string
): Promise<ChatMessage> {
  return apiFetch<ChatMessage>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ content, document_id: documentId }),
  });
}

export async function importCardToLibrary(card: {
  topic?: string;
  question: string;
  answer: string;
  explanation?: string;
  question_type?: string;
  options?: string[];
  difficulty?: string;
  image_base64?: string;
}): Promise<{ status: string; study_set_id: string; title: string; item_count: number }> {
  return apiFetch<{ status: string; study_set_id: string; title: string; item_count: number }>(
    '/api/chat/import-card',
    {
      method: 'POST',
      body: JSON.stringify(card),
    }
  );
}

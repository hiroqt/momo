import { updateStudySet, deleteStudySet } from '../api/studySets';
import { createFolder, updateFolder, deleteFolder, setStudySetFolder } from '../api/folders';
import * as Haptics from 'expo-haptics';

export type MutationType =
  | 'RENAME_STUDY_SET'
  | 'DELETE_STUDY_SET'
  | 'MOVE_STUDY_SET'
  | 'CREATE_FOLDER'
  | 'RENAME_FOLDER'
  | 'DELETE_FOLDER';

export interface QueuedMutation {
  id: string;
  type: MutationType;
  payload: any;
  createdAt: number;
  retryCount: number;
}

export interface MutationQueueState {
  isSyncing: boolean;
  pendingCount: number;
  lastSuccessTime: number | null;
  lastError: string | null;
}

type Listener = (state: MutationQueueState) => void;
export type MutationExecutor = (mutation: QueuedMutation) => Promise<void>;

export class MutationQueue {
  private queue: QueuedMutation[] = [];
  private isProcessing = false;
  private listeners: Set<Listener> = new Set();
  private lastSuccessTime: number | null = null;
  private lastError: string | null = null;
  private executor?: MutationExecutor;

  constructor(executor?: MutationExecutor) {
    this.executor = executor;
  }

  getState(): MutationQueueState {
    return {
      isSyncing: this.isProcessing,
      pendingCount: this.queue.length,
      lastSuccessTime: this.lastSuccessTime,
      lastError: this.lastError,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  /**
   * Enqueues a mutation, immediately triggers tactile haptic feedback,
   * updates local state, and fires the background sync processor.
   */
  async enqueue(type: MutationType, payload: any): Promise<void> {
    // Immediate tactile feedback for momentum
    try {
      Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light)?.catch?.(() => {});
    } catch {}

    const mutation: QueuedMutation = {
      id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
    };

    this.queue.push(mutation);
    this.lastError = null;
    this.notify();

    // Trigger non-blocking background queue flush
    setTimeout(() => {
      this.processQueue();
    }, 50);
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    this.notify();

    while (this.queue.length > 0) {
      const current = this.queue[0];
      try {
        await this.executeMutation(current);
        // Successfully executed on backend
        this.queue.shift();
        this.lastSuccessTime = Date.now();
        this.lastError = null;
        this.notify();
      } catch (err: any) {
        current.retryCount += 1;
        this.lastError = err?.message || 'Sync failed. Will retry.';
        console.warn(`[MutationQueue] Sync attempt ${current.retryCount} failed for ${current.type}:`, err);

        // If exceeded 3 retries, discard or keep for manual retry
        if (current.retryCount >= 3) {
          this.queue.shift();
        } else {
          // Pause queue execution with exponential backoff
          await new Promise((res) => setTimeout(res, current.retryCount * 1200));
        }
        break;
      }
    }

    this.isProcessing = false;
    this.notify();
  }

  private async executeMutation(mutation: QueuedMutation): Promise<void> {
    if (this.executor) {
      await this.executor(mutation);
      return;
    }

    switch (mutation.type) {
      case 'RENAME_STUDY_SET':
        await updateStudySet(mutation.payload.id, { title: mutation.payload.title });
        break;
      case 'DELETE_STUDY_SET':
        await deleteStudySet(mutation.payload.id);
        break;
      case 'MOVE_STUDY_SET':
        await setStudySetFolder(mutation.payload.id, mutation.payload.folderId);
        break;
      case 'CREATE_FOLDER':
        await createFolder(mutation.payload.name);
        break;
      case 'RENAME_FOLDER':
        await updateFolder(mutation.payload.id, { name: mutation.payload.name });
        break;
      case 'DELETE_FOLDER':
        await deleteFolder(mutation.payload.id);
        break;
      default:
        break;
    }
  }
}

export const mutationQueue = new MutationQueue();

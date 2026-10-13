import type { GenerationJob } from '../../types';
import type { GenerationRequest } from '../api/generations';
import { localDb, type AccountBinding, type LocalDatabase } from '../storage/localDb';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = new Set(['document_id', 'document_ids', 'generation_mode', 'content_level', 'reviewer_types',
  'title', 'topic', 'count', 'difficulty', 'question_types', 'source_only', 'custom_instruction',
  'academic_level', 'learner_focus', 'focus_sections', 'time_limit_per_question']);
const QUESTION_TYPES = new Set(['flashcard', 'multiple_choice', 'true_false', 'identification', 'fill_in_the_blank', 'summary', 'qa', 'topic_explanation', 'explanation']);
const REVIEWER_TYPES = new Set(['glossary', 'concept_outline', 'cheat_sheet', 'compare_contrast', 'qa_study_sheet', 'timeline_process', 'summary', 'qa', 'topic_explanation', 'explanation']);
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function normalize(payload: GenerationRequest): { payload: GenerationRequest; fingerprint: string } {
  const copy: unknown = JSON.parse(JSON.stringify(payload));
  if (!object(copy) || typeof copy.document_id !== 'string' || !copy.document_id ||
      Object.keys(copy).some(key => !FIELDS.has(key)) || (copy.source_only !== undefined && copy.source_only !== true) ||
      !['document_id', 'title', 'topic', 'custom_instruction', 'academic_level', 'learner_focus'].every(key =>
        copy[key] === undefined || (typeof copy[key] === 'string' && copy[key].length <= ({ document_id: 128, title: 255, topic: 300, custom_instruction: 4000, academic_level: 30, learner_focus: 80 } as Record<string, number>)[key])) ||
      !['document_ids', 'reviewer_types', 'question_types', 'focus_sections'].every(key =>
        copy[key] === undefined || (Array.isArray(copy[key]) && copy[key].length <= 20 && copy[key].every(value => typeof value === 'string' && value.length <= 300))) ||
      (copy.count !== undefined && (!Number.isInteger(copy.count) || Number(copy.count) < 1 || Number(copy.count) > 50)) ||
      (copy.time_limit_per_question !== undefined && (!Number.isInteger(copy.time_limit_per_question) || Number(copy.time_limit_per_question) < 1 || Number(copy.time_limit_per_question) > 3600)) ||
      (copy.generation_mode !== undefined && !['reviewer', 'quiz', 'both'].includes(String(copy.generation_mode))) ||
      (copy.content_level !== undefined && !['light', 'moderate', 'detailed'].includes(String(copy.content_level))) ||
      (copy.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(String(copy.difficulty))) ||
      (copy.question_types !== undefined && (copy.question_types as string[]).some(type => !QUESTION_TYPES.has(type))) ||
      (copy.reviewer_types !== undefined && (copy.reviewer_types as string[]).some(type => !REVIEWER_TYPES.has(type))) ||
      (copy.academic_level !== undefined && !['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', '1st Year', '2nd Year', '3rd Year', '4th Year', 'Grad'].includes(String(copy.academic_level))))
    throw new Error('Generation settings are invalid.');
  const fingerprint = canonical(copy);
  if (fingerprint.length > 100_000) throw new Error('Generation settings are too large.');
  return { payload: copy as unknown as GenerationRequest, fingerprint };
}
function validJob(value: unknown, documentId: string): value is GenerationJob {
  return object(value) && typeof value.generation_id === 'string' && UUID.test(value.generation_id) &&
    value.document_id === documentId && ['PENDING', 'PROCESSING', 'GENERATING', 'VALIDATING', 'COMPLETED', 'FAILED'].includes(String(value.status)) &&
    typeof value.stage === 'string' && typeof value.message === 'string' &&
    typeof value.progress === 'number' && Number.isInteger(value.progress) && value.progress >= 0 && value.progress <= 100 &&
    ['created_at', 'updated_at'].every(field => typeof value[field] === 'string' && Number.isFinite(Date.parse(value[field] as string))) &&
    (value.study_set_id == null || typeof value.study_set_id === 'string') &&
    (value.error == null || typeof value.error === 'string') &&
    (value.generation_config == null || object(value.generation_config));
}

export interface GenerationDraftSnapshot { revision: number; route: string; binding: AccountBinding }
/** A completed request may affect UI only in the route/account that started it. */
export class GenerationDraftScope {
  private revision = 0;
  private current: GenerationDraftSnapshot | null = null;
  activate(route: string, binding: AccountBinding): GenerationDraftSnapshot {
    this.current = { revision: ++this.revision, route, binding: { ...binding } };
    return this.current;
  }
  invalidate(): void { this.revision++; this.current = null; }
  capture(): GenerationDraftSnapshot | null { return this.current; }
  matches(snapshot: GenerationDraftSnapshot | null, binding: AccountBinding, route = this.current?.route): boolean {
    return !!snapshot && this.current?.revision === snapshot.revision && this.current.route === snapshot.route &&
      snapshot.route === route &&
      snapshot.binding.owner === binding.owner && snapshot.binding.epoch === binding.epoch;
  }
}

export interface GenerationIntent {
  version: 1; id: string; owner: string; payload: GenerationRequest; fingerprint: string;
  createdAt: string; job?: GenerationJob;
}
export interface GenerationIntentResult { intentId: string; binding: AccountBinding; job: GenerationJob }
type Dependencies = {
  db?: LocalDatabase;
  send?: (payload: GenerationRequest, key: string, binding: AccountBinding) => Promise<GenerationJob>;
  online?: (binding: AccountBinding) => Promise<boolean>;
  uuid?: () => Promise<string>;
};
const flights = new WeakMap<LocalDatabase, Map<string, Promise<GenerationIntentResult>>>();

/** Pending settings/results remain durable until the destination consumes them. */
export class GenerationIntentService {
  private readonly db: LocalDatabase;
  private readonly send: NonNullable<Dependencies['send']>;
  private readonly online: NonNullable<Dependencies['online']>;
  private readonly uuid: NonNullable<Dependencies['uuid']>;
  constructor(deps: Dependencies = {}) {
    this.db = deps.db ?? localDb;
    this.send = deps.send ?? (async (payload, key, binding) => (await import('../api/generations')).createGeneration(payload, key, binding));
    this.online = deps.online ?? (async binding => {
      try { await (await import('../api/client')).apiFetch('/health', {}, 5000, { expectedBinding: binding }); return true; }
      catch { return false; }
    });
    this.uuid = deps.uuid ?? (async () => (await import('expo-crypto')).randomUUID());
  }
  private assert(binding: AccountBinding) {
    const active = this.db.currentBinding();
    if (active.owner !== binding.owner || active.epoch !== binding.epoch) throw new Error('Your account changed. Open this action again.');
  }
  private async list(binding: AccountBinding): Promise<GenerationIntent[]> {
    const rows = await this.db.readRecords('generation_request', binding);
    return rows.map(row => {
      const value = row.data;
      if (!object(value) || value.version !== 1 || value.id !== row.id || typeof value.id !== 'string' || !UUID.test(value.id) ||
          value.owner !== binding.owner || !object(value.payload) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)))
        throw new Error('Saved generation settings are corrupt.');
      const normalized = normalize(value.payload as unknown as GenerationRequest);
      if (value.fingerprint !== normalized.fingerprint || (value.job !== undefined && !validJob(value.job, normalized.payload.document_id)))
        throw new Error('Saved generation settings are corrupt.');
      return value as unknown as GenerationIntent;
    });
  }
  async unfinished(documentId: string, mode: 'reviewer' | 'quiz'): Promise<GenerationIntent | null> {
    const binding = this.db.currentBinding();
    const rows = await this.list(binding);
    this.assert(binding);
    return rows.filter(row => row.payload.document_id === documentId && row.payload.generation_mode === mode).at(-1) ?? null;
  }
  submit(payload: GenerationRequest): Promise<GenerationIntentResult> {
    const binding = this.db.currentBinding();
    const normalized = normalize(payload);
    let pending = flights.get(this.db);
    if (!pending) { pending = new Map(); flights.set(this.db, pending); }
    const key = `${binding.owner}:${binding.epoch}:${normalized.fingerprint}`;
    const existing = pending.get(key);
    if (existing) return existing;
    const task = this.run(normalized, binding).finally(() => pending!.delete(key));
    pending.set(key, task);
    return task;
  }
  private async run(normalized: ReturnType<typeof normalize>, binding: AccountBinding): Promise<GenerationIntentResult> {
    const rows = await this.list(binding);
    let intent = rows.find(row => row.fingerprint === normalized.fingerprint);
    if (!intent) {
      const id = await this.uuid(); this.assert(binding);
      if (!UUID.test(id)) throw new Error('Could not prepare the generation request.');
      intent = { version: 1, id, owner: binding.owner, ...normalized, createdAt: new Date().toISOString() };
      await this.db.writeRecords([{ kind: 'generation_request', id, data: intent }], binding);
    }
    this.assert(binding);
    if (intent.job) return { intentId: intent.id, binding, job: intent.job };
    if (!await this.online(binding)) throw new Error('Connect to the internet to create your reviewer. Your settings are saved.');
    this.assert(binding);
    const job = await this.send(intent.payload, intent.id, binding);
    this.assert(binding);
    if (!validJob(job, intent.payload.document_id)) throw new Error('The generation response could not be verified. Your settings are saved.');
    intent = { ...intent, job };
    await this.db.writeRecords([{ kind: 'generation_request', id: intent.id, data: intent }], binding);
    this.assert(binding);
    return { intentId: intent.id, binding, job };
  }
  /** Called only once the generation destination has accepted this exact job. */
  async acknowledge(intentId: string, jobId: string, binding: AccountBinding = this.db.currentBinding()): Promise<void> {
    this.assert(binding);
    const intent = (await this.list(binding)).find(row => row.id === intentId);
    if (!intent) return;
    if (intent.job?.generation_id !== jobId) throw new Error('The saved generation does not match this reviewer.');
    await this.db.writeRecords([{ kind: 'generation_request', id: intentId }], binding);
  }
}
export const generationIntents = new GenerationIntentService();

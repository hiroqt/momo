import { composeReply, localDecision, type ChatMessage } from './policy';
import type { PreviewDecisionProvider } from './provider';

export async function answerPreview(message: string, history: ChatMessage[], provider?: PreviewDecisionProvider) {
  const fallback = localDecision(message, history);
  const protectedTone = fallback.tone === 'injection' || fallback.tone === 'sensitive';
  const decision = !protectedTone && provider ? await provider.decide(message, history).catch(() => null) : null;
  // An obvious product question must not become an unrelated deflection.
  const conflicting = fallback.factIds.length > 0 && (!decision?.factIds.length || !decision.factIds.some(id => fallback.factIds.includes(id)));
  return composeReply(decision && !conflicting ? decision : fallback, history);
}

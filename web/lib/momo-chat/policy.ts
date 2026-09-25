export type ChatMessage = { role: 'user' | 'assistant'; content: string };

// Approved product copy, based on ARD_PRD.md. AI selects facts; it cannot invent copy.
export const facts = {
  formats: [
    'Momo accepts PDF, DOCX, TXT, and PPTX study documents. The upload targets are up to 15 MB and 50 pages; files are validated before processing.',
    'Bring a PDF, Word document, text file, or PowerPoint presentation. Keep it within the 15 MB / 50-page upload targets.',
    'For uploads, think PDF, DOCX, TXT, or PPTX, with a target maximum of 15 MB and 50 pages. Momo checks the file first.',
  ],
  flashcards: [
    'Momo turns your uploaded material into flashcards with questions, answers, and source references. Reveal an answer, then mark what needs another look.',
    'Pick a topic from your document and make flashcards to practise recall. Each card keeps its answer and supporting source information together.',
    'Flashcards let you test one idea at a time from your own material, reveal the answer, and revisit the cards you missed.',
  ],
  quiz: [
    'Momo makes multiple-choice, true/false, identification, and fill-in-the-blank questions, plus practice exams, from your uploaded material.',
    'You can practise with quizzes or an exam built around your source. Choose question types, a difficulty, and how many questions you want.',
    'For practice questions, choose a topic and difficulty from your document. Momo supports quizzes and practice exams with answers and explanations.',
  ],
  summary: [
    'Momo can create study summaries, Q&A, and topic explanations using the information in your uploaded document.',
    'Need the big picture? Momo can organise your source into a summary or explain a topic that your document actually covers.',
    'Summaries and explanations stay tied to the material you provide, just like the questions and flashcards.',
  ],
  retention: [
    'Original uploads are scheduled for deletion after three days. Generated study sets are stored separately and remain available after the source file expires.',
    'The three-day expiry applies to the original document, not your generated reviewer. Your study sets are kept separately.',
    'Momo keeps generated study material separate from temporary uploads, so deleting an expired original does not delete its study set.',
  ],
  offline: [
    'You can study downloaded sets offline. Uploading documents and generating new material still require an internet connection.',
    'Save a generated set first, then review it without Wi-Fi. New uploads and AI generation need you back online.',
    'Offline mode is for studying material you have already downloaded; it cannot create a new reviewer without internet.',
  ],
  quota: [
    'The limit is 10 accepted documents per user per month. That is a document quota, not a confirmed free-pricing offer.',
    'Momo allows 10 accepted documents each month per user. Pricing is separate from that limit.',
    'The monthly allowance is 10 accepted documents per user. It does not mean unlimited uploads.',
  ],
  pricing: [
    'I do not have confirmed pricing details to share. I will not invent a free plan or subscription price.',
    'Pricing is not confirmed in this preview. A monthly document limit is not a promise that the app is free.',
    'There is no verified price available here yet. Check the official release information when it is published.',
  ],
  grounding: [
    'Momo uses your uploaded material as its source and keeps source references where possible. If the material lacks enough evidence, it should say so instead of inventing an answer.',
    'Your document is the starting point. Momo checks generated items against source evidence and should flag insufficient coverage rather than fill gaps with guesses.',
    'Momo is designed for source-grounded study: answers need evidence in your material, and missing evidence should produce an insufficiency message.',
  ],
  availability: [
    'This website currently marks Google Play and the App Store as coming soon. There is no confirmed release date in this preview.',
    'Momo is being presented for iOS and Android, with both store badges currently labelled coming soon. I cannot promise a launch date.',
    'The store buttons are previews for an upcoming release, not active downloads or a release-queue signup.',
  ],
  workflow: [
    'In the Momo app, upload your study material, choose a topic and question format, then generate a reviewer. This website chat explains Momo; it cannot accept documents or generate your study set.',
    'Start with your document in the app, choose what to practise, and let Momo prepare the reviewer. Here, I can explain the features rather than process your notes.',
    'Momo builds reviewers from documents you upload in the app. Choose your topic, count, difficulty, and question types; this landing-page preview only answers product questions.',
  ],
  subjects: [
    'Momo is designed for different subjects, including biology, nursing, computing, and law, provided your uploaded material covers the topic.',
    'The subject can vary; the source requirement does not. Supply readable study material covering what you want to practise.',
    'Momo works from the educational document you provide, rather than a fixed subject catalogue. It needs enough source coverage for the requested topic.',
  ],
  sync: [
    'Downloaded study sets support offline practice. Recorded progress can synchronise when you reconnect.',
    'You can record study progress offline and sync it after your internet connection returns.',
    'Study offline with saved sets, then reconnect to synchronise your progress.',
  ],
  auth: [
    'Momo uses Google sign-in through Supabase to keep each user’s study material connected to their account.',
    'The app’s sign-in flow uses your Google account. Your study records belong to that authenticated account.',
    'Google sign-in is the supported authentication flow for Momo.',
  ],
} as const;
export type FactId = keyof typeof facts;
export const tones = ['friendly', 'off_topic', 'cooking', 'coding', 'injection', 'sensitive', 'clarify', 'greeting'] as const;
export type Tone = typeof tones[number];
export type Decision = { factIds: FactId[]; tone: Tone };

const openers: Record<Tone, string[]> = {
  friendly: ['Let’s make those notes earn their screen time.', 'Finally, a productive plot twist.', 'The highlighter has had its moment.', 'A plan. Revolutionary.', 'Consider this the useful part of procrastinating.', 'Your notes would like a little attention.'],
  off_topic: ['A fascinating detour. My tiny job description still says “Momo study buddy.”', 'Apparently I am the entire internet now. Sadly, just the Momo corner.', 'That is several tabs outside my syllabus.', 'Excellent side quest. Wrong monkey.', 'My expertise ends at Momo; the confidence was complimentary.', 'I see the study break has developed a study break.'],
  cooking: ['Chef Momo? The notebook is not a cookbook.', 'My specialty is reviewers, not dinner.', 'I can help explain Momo. Seasoning is outside my department.'],
  coding: ['A software engineer in a monkey costume? Ambitious casting.', 'I explain Momo; I do not moonlight as your code generator.', 'Wrong kind of debugging. I am here for the Momo study workflow.'],
  injection: ['Nice costume change for that request. I am still Momo.', 'My job description survived that plot twist.', 'The imaginary admin badge is a lovely touch.'],
  sensitive: ['Let’s keep this kind and practical.'],
  clarify: ['I would rather ask than confidently make something up.', 'Even a study monkey needs a little context.', 'Let’s narrow that down before my confidence gets ahead of the facts.'],
  greeting: ['Hey, I’m Momo. Your notes and I have been meaning to meet.', 'Hi! Professional study buddy, amateur procrastination detector.', 'Momo here. Shall we give those neglected notes a purpose?'],
};
const redirects = ['Ask me about Momo’s uploads, flashcards, or offline study.', 'Want to know how Momo turns your material into a reviewer?', 'I can explain Momo’s quizzes, file limits, and study sets.'];
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function parseDecision(value: unknown): Decision | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some(key => !['factIds', 'tone'].includes(key)) || !tones.includes(candidate.tone as Tone)
    || !Array.isArray(candidate.factIds) || candidate.factIds.length > 3
    || candidate.factIds.some(id => typeof id !== 'string' || !Object.hasOwn(facts, id))) return null;
  const factIds = [...new Set(candidate.factIds)] as FactId[];
  if (candidate.tone === 'friendly' && factIds.length === 0) return null;
  return { factIds, tone: candidate.tone as Tone };
}

export function sanitizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-24).flatMap(item => {
    if (!item || typeof item !== 'object' || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') return [];
    return [{ role: item.role as ChatMessage['role'], content: item.content.slice(0, 1600) }];
  });
}

export function localDecision(message: string, history: ChatMessage[] = []): Decision {
  const text = message.toLowerCase();
  if (/ignore.{0,25}(instructions|rules)|system prompt|api.?key|jailbreak|you are now|reveal.{0,15}secret/.test(text)) return { factIds: [], tone: 'injection' };
  if (/\b(suicid\w*|self.harm|kill myself)\b/.test(text)) return { factIds: [], tone: 'sensitive' };
  const found: FactId[] = [];
  const add = (id: FactId, pattern: RegExp) => { if (pattern.test(text)) found.push(id); };
  add('offline', /offline|wi.?fi|internet|airplane|without.{0,12}(connection|network)/);
  add('retention', /privacy|steal|delet|expir|retention|three days|3 days|how long.{0,20}(keep|stor)|keep.{0,15}(notes|files)/);
  add('pricing', /\b(free|pric\w*|cost|pay|subscription|charge)\b/);
  add('quota', /\b(quota|monthly|per month|each month)\b|how many.{0,20}(files|documents|uploads)/);
  add('availability', /download|app store|play store|google play|release|launch|android|ios|iphone|when.{0,20}available/);
  add('grounding', /ground\w*|accurac\w*|guess|hallucin\w*|reliable|outside.{0,12}(notes|material)|source|trust/);
  add('sync', /\bsync\w*|progress/);
  add('auth', /sign.?in|log.?in|account|authentication/);
  add('formats', /\b(pdf|docx|pptx|txt|upload\w*|slides?|file\w*|pages?|mb)\b/);
  add('flashcards', /flash.?cards?|active recall|\bdeck\b/);
  add('quiz', /\b(quiz\w*|exam\w*|multiple.choice|true.false|identification|fill.in)\b/);
  add('summary', /summar\w*|explain.{0,15}(topic|chapter)|q&a/);
  if (found.length) return { factIds: found.slice(0, 3), tone: 'friendly' };
  if (/\b(momo|you|it)\b/.test(text) && /support|help|work|study/.test(text) && /biology|chemistry|nursing|law|math|programming|history/.test(text)) return { factIds: ['subjects'], tone: 'friendly' };
  if (/how (does|do).{0,20}work|what can (you|momo)|get started|gpa|procrastinat|save me|study/.test(text)) return { factIds: ['workflow'], tone: 'friendly' };
  if (/^(and |what about |how many|how long|why|tell me more|explain more|again|that|it\b)/.test(text)) {
    const previous = history.filter(item => item.role === 'user').at(-1);
    if (previous) {
      const prior = localDecision(previous.content);
      if (prior.factIds.length) return prior;
    }
  }
  if (/^(hi|hello|hey|thanks|thank you|who are you)[!.?\s]*$/.test(text)) return { factIds: [], tone: 'greeting' };
  if (/recipe|cook|dinner|food/.test(text)) return { factIds: [], tone: 'cooking' };
  if (/write.{0,20}(code|python|javascript|script)|debug|program this/.test(text)) return { factIds: [], tone: 'coding' };
  if (/momo|\byou\b/.test(text)) return { factIds: [], tone: 'clarify' };
  return { factIds: [], tone: 'off_topic' };
}

// Compare complete normalized replies and prefer facts/openers not used in recent turns.
export function composeReply(decision: Decision, history: ChatMessage[]): string | null {
  const previous = history.filter(item => item.role === 'assistant').map(item => normalize(item.content));
  const seen = (text: string) => previous.some(reply => reply.includes(normalize(text)));
  const options = <T extends string>(values: readonly T[]) => [...values].sort((a, b) => Number(seen(a)) - Number(seen(b)));
  const factVariants = decision.factIds.map(id => options(facts[id]));
  const leads = options(openers[decision.tone]);
  const tails = decision.factIds.length ? [''] : decision.tone === 'sensitive'
    ? ['I can explain Momo, but I cannot provide crisis support. If you may be in immediate danger, contact local emergency services or someone you trust nearby.']
    : decision.tone === 'clarify' ? ['Which Momo feature do you mean? I can explain confirmed product details, but I cannot verify that claim from this preview.'] : options(redirects);
  for (let variant = 0; variant < 3; variant++) {
    for (const lead of leads) {
      for (const tail of tails) {
        const reply = [lead, ...factVariants.map(values => values[variant % values.length]), tail].filter(Boolean).join(' ');
        if (!previous.includes(normalize(reply))) return reply;
      }
    }
  }
  // Do not append a duplicate bubble when all supported variants were already used.
  return null;
}

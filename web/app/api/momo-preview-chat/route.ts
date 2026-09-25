import { NextResponse } from 'next/server';
import { sanitizeHistory } from '../../../lib/momo-chat/policy';
import { OpenRouterPreviewProvider } from '../../../lib/momo-chat/provider';
import { createPreviewLimiter } from '../../../lib/momo-chat/rate-limit';
import { answerPreview } from '../../../lib/momo-chat/service';

const allowRequest = createPreviewLimiter();

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host') || new URL(req.url).host;
    if (origin) {
      let originHost: string | undefined;
      try { originHost = new URL(origin).host; } catch { /* Invalid origins are forbidden. */ }
      if (originHost !== host) return NextResponse.json({ error: 'This preview accepts requests from the Momo website only.' }, { status: 403 });
    }
    if (Number(req.headers.get('content-length')) > 48_000) {
      return NextResponse.json({ error: 'This conversation is too long. Please start a new preview.' }, { status: 413 });
    }
    const raw = await req.text();
    if (raw.length > 48_000) return NextResponse.json({ error: 'Message is too large.' }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid message.' }, { status: 400 }); }
    if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.trim().length > 500) {
      return NextResponse.json({ error: 'Please ask a question between 1 and 500 characters.' }, { status: 400 });
    }
    // Trust forwarded IP headers only behind a proxy that overwrites them.
    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'local').trim();
    if (!allowRequest(ip)) return NextResponse.json({ error: 'Even monkey paws need a breather. Please wait a moment before asking again.' }, { status: 429 });
    const history = sanitizeHistory(body.history);
    const apiKey = process.env.OPENROUTER_API_KEY;
    const provider = apiKey && !apiKey.includes('your-openrouter-api-key')
      ? new OpenRouterPreviewProvider(apiKey, process.env.NEMOTRON_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free')
      : undefined;
    const reply = await answerPreview(body.message.trim(), history, provider);
    if (!reply) return NextResponse.json({ error: 'We have covered that one. Try asking about a different Momo feature so I can give you something new.' }, { status: 409 });
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: 'Momo could not respond right now. Please try again in a moment.' }, { status: 500 });
  }
}

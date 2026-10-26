import type {
  EnhancedTranscript,
  ProviderConfig,
  ProviderConfigs,
  ProviderId,
  ProviderSettings,
  TranscriptData,
  TranscriptSegment,
} from './types';
import {
  PROVIDER_META,
  isProviderConfigured,
  resolveProviderConfig,
} from './types';

// ---------------------------------------------------------------------------
// Provider abstraction for transcription + LLM chat.
//
// Each provider has a per-user config (base URL, API key, model) edited in
// Settings. Providers that don't require a key (Ollama, OpenAI-compatible
// local servers) are always considered "configured". When a provider isn't
// configured we fall back to a mock so the workspace stays usable in demos.
// ---------------------------------------------------------------------------

export interface TranscribeOptions {
  audio: Blob;
  language?: string;
  onProgress?: (ratio: number, label: string) => void;
  signal?: AbortSignal;
}

export interface ChatOptions {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

export async function transcribeAudio(
  settings: ProviderSettings,
  opts: TranscribeOptions,
): Promise<TranscriptData> {
  const provider = settings.transcriptionProvider;
  const cfg = resolveProviderConfig(provider, settings.configs);
  if (!isProviderConfigured(provider, settings.configs)) {
    return mockTranscribe(opts);
  }
  try {
    switch (provider) {
      case 'openai':
      case 'groq':
        return await openaiCompatibleTranscribe(provider, cfg, opts);
      case 'deepgram':
        return await deepgramTranscribe(cfg, opts);
      case 'ollama':
        return await ollamaTranscribe(cfg, opts);
      default:
        return mockTranscribe(opts);
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    // Network/CORS in sandbox — fall back to mock so UI keeps working.
    return mockTranscribe(opts);
  }
}

// OpenAI / Groq share the /audio/transcriptions endpoint shape.
async function openaiCompatibleTranscribe(
  provider: ProviderId,
  cfg: ProviderConfig,
  opts: TranscribeOptions,
): Promise<TranscriptData> {
  const form = new FormData();
  form.append('file', opts.audio, 'recording.webm');
  form.append('model', cfg.model || 'whisper-1');
  form.append('response_format', 'verbose_json');
  if (opts.language) form.append('language', opts.language);
  opts.onProgress?.(0.3, `Uploading audio to ${PROVIDER_META[provider].label}…`);
  const headers: Record<string, string> = {};
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const res = await fetch(joinUrl(cfg.baseUrl, '/audio/transcriptions'), {
    method: 'POST',
    headers,
    body: form,
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`${PROVIDER_META[provider].label} transcription failed: ${res.status}`);
  const data = await res.json();
  const segments: TranscriptSegment[] = (data.segments ?? []).map(
    (s: { start: number; end: number; text: string; speaker?: string }, i: number) => ({
      id: `seg-${i}`,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
      speaker: s.speaker,
    }),
  );
  return { segments, provider, language: data.language, durationSec: data.duration };
}

async function deepgramTranscribe(cfg: ProviderConfig, opts: TranscribeOptions): Promise<TranscriptData> {
  const params = new URLSearchParams({
    model: cfg.model || 'nova-2',
    smart_format: 'true',
    diarize: 'true',
    utterances: 'true',
  });
  opts.onProgress?.(0.3, 'Uploading audio to Deepgram…');
  const res = await fetch(joinUrl(cfg.baseUrl, `/listen?${params.toString()}`), {
    method: 'POST',
    headers: { Authorization: `Token ${cfg.apiKey}`, 'Content-Type': opts.audio.type || 'audio/webm' },
    body: opts.audio,
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Deepgram transcription failed: ${res.status}`);
  const data = await res.json();
  const utterances = data.results?.utterances ?? [];
  const segments: TranscriptSegment[] = utterances.map(
    (u: { start: number; end: number; transcript: string; speaker: number }, i: number) => ({
      id: `seg-${i}`,
      start: u.start,
      end: u.end,
      text: u.transcript.trim(),
      speaker: `Speaker ${u.speaker ?? 0}`,
    }),
  );
  return { segments, provider: 'deepgram', durationSec: data.metadata?.duration };
}

// Ollama has no first-party Whisper endpoint. Two common ways users run local
// transcription: (1) an OpenAI-compatible proxy in front of Ollama that
// exposes /v1/audio/transcriptions, or (2) a whisper model served via
// Ollama's /api/generate. We try the OpenAI-compatible path on the same base
// URL (appending /v1 if not present) and fall back to mock on failure.
async function ollamaTranscribe(cfg: ProviderConfig, opts: TranscribeOptions): Promise<TranscriptData> {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const v1Base = base.endsWith('/v1') ? base : `${base}/v1`;
  opts.onProgress?.(0.3, 'Sending audio to local Ollama transcription…');
  try {
    const form = new FormData();
    form.append('file', opts.audio, 'recording.webm');
    form.append('model', cfg.model || 'whisper');
    form.append('response_format', 'verbose_json');
    const res = await fetch(`${v1Base}/audio/transcriptions`, {
      method: 'POST',
      body: form,
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`Ollama transcription failed: ${res.status}`);
    const data = await res.json();
    const segments: TranscriptSegment[] = (data.segments ?? []).map(
      (s: { start: number; end: number; text: string; speaker?: string }, i: number) => ({
        id: `seg-${i}`,
        start: s.start,
        end: s.end,
        text: s.text.trim(),
        speaker: s.speaker,
      }),
    );
    return { segments, provider: 'ollama', language: data.language, durationSec: data.duration };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    // No local transcription endpoint — fall back to mock with a clear note.
    opts.onProgress?.(1, 'Local transcription endpoint not available — using demo transcript.');
    const mock = await mockTranscribe(opts);
    return { ...mock, provider: 'ollama' };
  }
}

// Mock fallback — generates a realistic-looking multi-segment transcript.
async function mockTranscribe(opts: TranscribeOptions): Promise<TranscriptData> {
  const steps = ['Analyzing waveform…', 'Detecting speech segments…', 'Transcribing audio…', 'Aligning timestamps…'];
  for (let i = 0; i < steps.length; i++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    opts.onProgress?.((i + 1) / steps.length, steps[i]);
    await sleep(420);
  }
  const duration = Math.max(8, Math.round((opts.audio.size / 16_000) || 30));
  const mockLines = [
    "Welcome everyone, thanks for joining today's session. Let's dive in.",
    "The first item on the agenda is the Q3 roadmap and our priorities.",
    "I think we should prioritize the authentication refactor before the new features.",
    "Agreed. That unblocks the team-workspace work downstream.",
    "What's the budget outlook for the infrastructure migration?",
    "We have roughly forty percent headroom in the current cloud allocation.",
    "Let's circle back on the timeline by end of week and confirm next steps.",
    "Great. Action item: I'll draft the migration plan and share it Friday.",
  ];
  const segCount = Math.min(mockLines.length, Math.max(4, Math.floor(duration / 5)));
  const segDur = duration / segCount;
  const segments: TranscriptSegment[] = Array.from({ length: segCount }, (_, i) => ({
    id: `seg-${i}`,
    start: Math.round(i * segDur * 10) / 10,
    end: Math.round((i + 1) * segDur * 10) / 10,
    text: mockLines[i % mockLines.length],
    speaker: i % 2 === 0 ? 'Speaker A' : 'Speaker B',
  }));
  return { segments, provider: 'mock', durationSec: duration };
}

// ---------------------------------------------------------------------------
// LLM Chat / Document generation
// ---------------------------------------------------------------------------

export async function chatComplete(
  settings: ProviderSettings,
  opts: ChatOptions,
): Promise<string> {
  const provider = settings.chatProvider;
  const cfg = resolveProviderConfig(provider, settings.configs);
  if (!isProviderConfigured(provider, settings.configs)) {
    return mockChat(opts);
  }
  try {
    switch (provider) {
      case 'openai':
      case 'groq':
      case 'deepseek':
      case 'openai-compatible':
        return await openaiCompatibleChat(provider, cfg, opts);
      case 'anthropic':
        return await anthropicChat(cfg, opts);
      case 'ollama':
        return await ollamaChat(cfg, opts);
      default:
        return mockChat(opts);
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return mockChat(opts);
  }
}

// OpenAI / Groq / DeepSeek / OpenAI-compatible all speak /chat/completions.
async function openaiCompatibleChat(
  provider: ProviderId,
  cfg: ProviderConfig,
  opts: ChatOptions,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
  };
  // DeepSeek's reasoner model supports a `reasoning` flag but ignores unknown
  // fields, so the same body works for all OpenAI-compatible providers.
  const res = await fetch(joinUrl(cfg.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`${PROVIDER_META[provider].label} chat failed: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function anthropicChat(cfg: ProviderConfig, opts: ChatOptions): Promise<string> {
  const system = opts.messages.find((m) => m.role === 'system')?.content ?? '';
  const conv = opts.messages.filter((m) => m.role !== 'system');
  const res = await fetch(joinUrl(cfg.baseUrl, '/messages'), {
    method: 'POST',
    headers: {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.model,
      system,
      max_tokens: 4096,
      messages: conv.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Anthropic chat failed: ${res.status}`);
  const data = await res.json();
  return data.content?.map((c: { text: string }) => c.text).join('') ?? '';
}

// Ollama native /api/chat. No API key. system message goes in the messages
// array — Ollama accepts a system role.
async function ollamaChat(cfg: ProviderConfig, opts: ChatOptions): Promise<string> {
  const res = await fetch(joinUrl(cfg.baseUrl, '/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      messages: opts.messages,
      stream: false,
      options: { temperature: opts.temperature ?? 0.3 },
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Ollama chat failed: ${res.status}`);
  const data = await res.json();
  return data.message?.content ?? '';
}

async function mockChat(opts: ChatOptions): Promise<string> {
  await sleep(700);
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const last = [...opts.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const hasTranscript = opts.messages.some((m) => m.role === 'system' && m.content.includes('transcript'));
  if (hasTranscript) {
    if (/summari/i.test(last)) {
      return '**Summary**\n\nThe session covered Q3 priorities, an authentication refactor, and a cloud infrastructure migration. The team agreed to prioritize the auth work first since it unblocks the team-workspace feature. Budget headroom of about 40% was confirmed for the migration, with a follow-up timeline to be finalized by Friday.\n\n**Key takeaways**\n- Auth refactor is the top priority\n- Migration plan to be drafted by Friday\n- ~40% cloud budget headroom available';
    }
    if (/action|decision|next step/i.test(last)) {
      return '**Action items**\n\n| Task | Assignee | Deadline |\n|---|---|---|\n| Draft infrastructure migration plan | Speaker A | Friday |\n| Review auth refactor scope | Speaker B | Next standup |\n| Confirm migration timeline | Whole team | End of week |';
    }
    return `Based on the transcript: the conversation centered on roadmap priorities and an infrastructure migration. A relevant quote — *"Let's prioritize the authentication refactor before the new features."* Ask me to summarize, extract action items, or pull quotes for any specific time range.`;
  }
  return `I'm running in offline/demo mode (no provider configured). Your message: "${last.slice(0, 160)}". Configure a provider in Settings to enable live responses.`;
}

// ---------------------------------------------------------------------------
// Transcript enhancement
// ---------------------------------------------------------------------------

export interface EnhanceOptions {
  signal?: AbortSignal;
}

const ENHANCE_SYSTEM_PROMPT = `You are an expert transcript editor. You will receive a raw, messy, automatically-generated transcript with timestamps and speakers. Produce a CLEANED, READABLE, well-structured version that "makes sense of everything".

Your output MUST be a single valid JSON object (no markdown, no code fences, no prose around it) with this exact schema:

{
  "segments": [
    { "start": <seconds number>, "end": <seconds number>, "speaker": "<name or Speaker A/B>", "text": "<cleaned text>" }
  ],
  "summary": "<2-3 sentence plain-language summary of what was discussed>",
  "topics": ["<short topic tag>", "..."]
}

Rules for the cleaned segments:
- Remove filler words (um, uh, like, you know), stutters, and false starts.
- Fix punctuation, capitalization, and sentence boundaries.
- Merge consecutive fragments from the same speaker into coherent sentences/paragraphs.
- Split overly long runs into readable segments (each segment one or a few sentences, max ~60 words).
- Preserve the original timestamps as closely as possible — interpolate linearly when you merge or split. start/end are floats in seconds.
- Keep speaker labels consistent and meaningful. If speakers were not identified, label them "Speaker A", "Speaker B", etc. based on turn-taking.
- Correct obvious transcription errors using context (e.g. homophones, misheard technical terms) — but DO NOT invent content that isn't supported by the text.
- Drop pure noise segments (non-speech, just "..." or "[music]").

Keep the original language. Return ONLY the JSON object.`;

export async function enhanceTranscript(
  settings: ProviderSettings,
  raw: TranscriptData,
  opts: EnhanceOptions = {},
): Promise<EnhancedTranscript> {
  // No provider configured → produce a deterministic, lightly-cleaned version
  // so the feature is demonstrable in demo mode.
  if (!isProviderConfigured(settings.chatProvider, settings.configs)) {
    await sleep(800);
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return mockEnhance(raw, settings);
  }

  const rawText = raw.segments
    .map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.speaker ? `${s.speaker}: ` : ''}${s.text}`)
    .join('\n');

  const result = await chatComplete(settings, {
    messages: [
      { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
      { role: 'user', content: `Raw transcript to enhance:\n\n${rawText}` },
    ],
    temperature: 0.2,
    signal: opts.signal,
  });

  return parseEnhanced(result, settings, raw);
}

function mockEnhance(raw: TranscriptData, settings: ProviderSettings): EnhancedTranscript {
  const segments: TranscriptSegment[] = raw.segments.map((s, i) => ({
    id: `es-${i}`,
    start: s.start,
    end: s.end,
    speaker: s.speaker,
    text: s.text
      .replace(/\b(um|uh|er|ah|like, you know)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,;!?])/g, '$1')
      .trim(),
  })).filter((s) => s.text.length > 0);
  return {
    segments,
    summary: 'Demo-mode enhancement: filler words removed and whitespace normalized. Configure a provider in Settings for full LLM-based cleanup with summary and topic detection.',
    topics: ['Discussion'],
    generatedAt: Date.now(),
    provider: settings.chatProvider,
    model: resolveProviderConfig(settings.chatProvider, settings.configs).model,
  };
}

function parseEnhanced(content: string, settings: ProviderSettings, raw?: TranscriptData): EnhancedTranscript {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const obj = JSON.parse(cleaned) as {
      segments?: Array<{ start?: number; end?: number; speaker?: string; text?: string }>;
      summary?: string;
      topics?: string[];
    };
    const segments: TranscriptSegment[] = (obj.segments ?? []).map((s, i) => ({
      id: `es-${i}`,
      start: typeof s.start === 'number' ? s.start : 0,
      end: typeof s.end === 'number' ? s.end : 0,
      speaker: s.speaker?.trim() || undefined,
      text: (s.text ?? '').trim(),
    })).filter((s) => s.text.length > 0);
    return {
      segments,
      summary: obj.summary?.trim() || undefined,
      topics: Array.isArray(obj.topics) ? obj.topics.map((t) => String(t)) : undefined,
      generatedAt: Date.now(),
      provider: settings.chatProvider,
      model: resolveProviderConfig(settings.chatProvider, settings.configs).model,
    };
  } catch {
    const base = (raw?.segments ?? []).map((s, i) => ({
      id: `es-${i}`,
      start: s.start,
      end: s.end,
      speaker: s.speaker,
      text: s.text
        .replace(/\b(um|uh|er|ah)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim(),
    })).filter((s) => s.text.length > 0);
    return {
      segments: base,
      summary: undefined,
      topics: undefined,
      generatedAt: Date.now(),
      provider: settings.chatProvider,
      model: resolveProviderConfig(settings.chatProvider, settings.configs).model,
    };
  }
}

// Helper for UI to fetch the list of locally-running Ollama models, so the
// Settings modal can populate the model dropdown with what's actually pulled.
export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(joinUrl(baseUrl.replace(/\/+$/, ''), '/api/tags'), { method: 'GET' });
    if (!res.ok) return [];
    const data = await res.json();
    const names: string[] = (data.models ?? []).map((m: { name?: string; model?: string }) => m.name ?? m.model ?? '').filter(Boolean);
    return names;
  } catch {
    return [];
  }
}

// Re-export for components that import from ai.ts
export type { ProviderConfigs };

// Shared domain types for Sonexa AI Meeting Copilot

export type SessionStatus =
  | 'recording'
  | 'recorded'
  | 'transcribing'
  | 'transcribed'
  | 'enhancing'
  | 'enhanced'
  | 'error';

export interface TranscriptSegment {
  id: string;
  start: number; // seconds
  end: number;
  speaker?: string;
  text: string;
}

export interface TranscriptData {
  segments: TranscriptSegment[];
  provider?: string;
  language?: string;
  durationSec?: number;
}

export interface EnhancedTranscript {
  segments: TranscriptSegment[]; // re-flowed, deduplicated, punctuation fixed
  summary?: string; // short paragraph summary
  topics?: string[]; // detected topic tags
  generatedAt: number;
  provider?: string;
  model?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  provider?: string;
  model?: string;
}

export interface GeneratedDocument {
  id: string;
  templateId: string;
  title: string;
  content: string; // markdown
  createdAt: number;
  provider?: string;
  model?: string;
}

export type SavedItemKind = 'chat' | 'document';

export interface SavedItemVersion {
  id: string;
  versionNumber: number;
  title: string;
  content: string; // markdown snapshot
  timestamp: number;
  note?: string;
}

export interface SavedItem {
  id: string;
  kind: SavedItemKind;
  title: string;
  content: string; // markdown
  sourceLabel?: string; // e.g. template name, or "Chat reply"
  createdAt: number;
  updatedAt?: number;
  versions?: SavedItemVersion[];
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  folderId?: string | null;
  durationSec?: number;
  mimeType?: string;
  source?: 'recording' | 'upload';
  fileName?: string;
  audioBlobKey?: string; // key into audio store
  transcript?: TranscriptData;
  transcriptProvider?: string;
  enhancedTranscript?: EnhancedTranscript;
  chat: ChatMessage[];
  documents: GeneratedDocument[];
  savedItems: SavedItem[];
  tags?: string[];
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// AI providers
// ---------------------------------------------------------------------------

export type ProviderId =
  | 'openai'
  | 'deepgram'
  | 'groq'
  | 'anthropic'
  | 'deepseek'
  | 'openai-compatible'
  | 'ollama';

export type ProviderCapability = 'transcription' | 'chat';

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// Partial: every field optional so users can fill only what they need.
export type ProviderConfigs = Partial<Record<ProviderId, Partial<ProviderConfig>>>;

export interface ProviderSettings {
  configs: ProviderConfigs;
  transcriptionProvider: ProviderId;
  chatProvider: ProviderId;
}

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  description: string;
  capabilities: ProviderCapability[];
  defaultBaseUrl: string;
  defaultModel: string;
  modelSuggestions: string[];
  requiresKey: boolean; // false for local Ollama
  keyHint?: string;
  keyLink?: string;
  baseUrlEditable: boolean;
  isLocal?: boolean;
}

export const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    description: 'Whisper transcription and GPT-4o chat.',
    capabilities: ['transcription', 'chat'],
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    modelSuggestions: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'whisper-1'],
    requiresKey: true,
    keyHint: 'platform.openai.com/api-keys',
    keyLink: 'https://platform.openai.com/api-keys',
    baseUrlEditable: true,
  },
  deepgram: {
    id: 'deepgram',
    label: 'Deepgram',
    description: 'Nova-2 transcription (no chat).',
    capabilities: ['transcription'],
    defaultBaseUrl: 'https://api.deepgram.com/v1',
    defaultModel: 'nova-2',
    modelSuggestions: ['nova-2', 'nova-2-general', 'nova-2-meeting'],
    requiresKey: true,
    keyHint: 'console.deepgram.com',
    keyLink: 'https://console.deepgram.com',
    baseUrlEditable: true,
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    description: 'Whisper Large transcription + Llama chat.',
    capabilities: ['transcription', 'chat'],
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    modelSuggestions: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'whisper-large-v3'],
    requiresKey: true,
    keyHint: 'console.groq.com/keys',
    keyLink: 'https://console.groq.com/keys',
    baseUrlEditable: true,
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude chat (no transcription).',
    capabilities: ['chat'],
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    modelSuggestions: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    requiresKey: true,
    keyHint: 'console.anthropic.com',
    keyLink: 'https://console.anthropic.com',
    baseUrlEditable: true,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'DeepSeek chat models (OpenAI-compatible API).',
    capabilities: ['chat'],
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    modelSuggestions: ['deepseek-chat', 'deepseek-reasoner'],
    requiresKey: true,
    keyHint: 'platform.deepseek.com',
    keyLink: 'https://platform.deepseek.com/api_keys',
    baseUrlEditable: true,
  },
  'openai-compatible': {
    id: 'openai-compatible',
    label: 'OpenAI-compatible',
    description: 'Any endpoint speaking the OpenAI chat completions format (Together, OpenRouter, vLLM, LM Studio, etc.).',
    capabilities: ['chat'],
    defaultBaseUrl: 'http://localhost:1234/v1',
    defaultModel: '',
    modelSuggestions: [],
    requiresKey: false, // many local servers use no key
    baseUrlEditable: true,
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    description: 'Runs fully locally via Ollama. Install from ollama.com, then `ollama pull` a model. No API key required.',
    capabilities: ['transcription', 'chat'],
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    modelSuggestions: ['llama3.2', 'llama3.1', 'qwen2.5', 'mistral', 'gemmascope', 'fwhisper'],
    requiresKey: false,
    keyHint: 'ollama.com',
    keyLink: 'https://ollama.com',
    baseUrlEditable: true,
    isLocal: true,
  },
};

export const PROVIDER_ORDER: ProviderId[] = [
  'openai', 'deepgram', 'groq', 'anthropic', 'deepseek', 'openai-compatible', 'ollama',
];

export const PROVIDER_LABELS: Record<ProviderId, string> = Object.fromEntries(
  PROVIDER_ORDER.map((id) => [id, PROVIDER_META[id].label]),
) as Record<ProviderId, string>;

export function providersWithCapability(cap: ProviderCapability): ProviderId[] {
  return PROVIDER_ORDER.filter((id) => PROVIDER_META[id].capabilities.includes(cap));
}

// Resolve a provider's effective config (filling defaults for missing fields).
export function resolveProviderConfig(id: ProviderId, configs: ProviderConfigs): ProviderConfig {
  const meta = PROVIDER_META[id];
  const c = configs[id] ?? {};
  return {
    baseUrl: (c.baseUrl ?? '').trim() || meta.defaultBaseUrl,
    apiKey: (c.apiKey ?? '').trim(),
    model: (c.model ?? '').trim() || meta.defaultModel,
  };
}

export function isProviderConfigured(id: ProviderId, configs: ProviderConfigs): boolean {
  const meta = PROVIDER_META[id];
  if (!meta.requiresKey) {
    // Local / no-key providers are "configured" as long as a base URL resolves
    // (it always does, via defaults), so they're always usable.
    return true;
  }
  return Boolean(configs[id]?.apiKey?.trim());
}

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  configs: {},
  transcriptionProvider: 'openai',
  chatProvider: 'openai',
};

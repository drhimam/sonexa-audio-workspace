import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Loader2, MessageSquare, Sparkles, Trash2, Bookmark } from 'lucide-react';
import type { ChatMessage, ProviderSettings, SavedItem, TranscriptData } from '@/lib/types';
import { resolveProviderConfig } from '@/lib/types';
import { chatComplete } from '@/lib/ai';
import { renderMarkdown } from '@/lib/export';
import { clsx, uid, formatDate } from '@/lib/utils';

interface ChatPanelProps {
  transcript: TranscriptData | null;
  messages: ChatMessage[];
  settings: ProviderSettings;
  onMessages: (messages: ChatMessage[]) => void;
  onSaveItem: (item: SavedItem) => void;
  savedIds: Set<string>;
}

const SUGGESTIONS = ['Summarize this transcript', 'Extract action items', 'What were the key decisions?', 'List open questions'];

function buildSystemPrompt(transcript: TranscriptData | null): string {
  const text = transcript?.segments.map((s) => `[${s.start.toFixed(1)}s] ${s.speaker ? `${s.speaker}: ` : ''}${s.text}`).join('\n') ?? '';
  return `You are an expert assistant helping a user analyze an audio transcript. Answer strictly based on the transcript below. If the answer is not in the transcript, say so clearly. Quote exact phrases when useful and include the timestamp in brackets like [00:12]. Use markdown for structure.\n\nTRANSCRIPT:\n${text}`;
}

export function ChatPanel({ transcript, messages, settings, onMessages, onSaveItem, savedIds }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const systemPrompt = useMemo(() => buildSystemPrompt(transcript), [transcript]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    const userMsg: ChatMessage = { id: uid('msg-'), role: 'user', content, createdAt: Date.now() };
    const next = [...messages, userMsg];
    onMessages(next);
    setInput('');
    setBusy(true);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const conv = [
        { role: 'system' as const, content: systemPrompt },
        ...next.map((m) => ({ role: m.role, content: m.content })),
      ];
      const reply = await chatComplete(settings, { messages: conv, signal: ac.signal });
      const assistant: ChatMessage = {
        id: uid('msg-'),
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
        provider: settings.chatProvider,
        model: resolveProviderConfig(settings.chatProvider, settings.configs).model,
      };
      onMessages([...next, assistant]);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Could not get a response. Check your API key in Settings and try again.');
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const clear = () => { onMessages([]); setError(null); };

  const saveMessage = (m: ChatMessage) => {
    if (savedIds.has(m.id)) return;
    const preview = m.content.replace(/[#*`>_~]/g, '').slice(0, 60).trim() || 'Chat reply';
    onSaveItem({
      id: m.id,
      kind: 'chat',
      title: preview.length < m.content.length ? `${preview}…` : preview,
      content: m.content,
      sourceLabel: 'Chat reply',
      createdAt: Date.now(),
    });
  };

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2.5 border-b border-app flex items-center gap-2">
        <MessageSquare size={15} className="text-primary" />
        <h3 className="text-sm font-semibold">Chat with transcript</h3>
        {messages.length > 0 && (
          <button onClick={clear} className="btn-ghost !px-1.5 !py-1 ml-auto text-xs text-muted" aria-label="Clear chat">
            <Trash2 size={13} /> Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin px-3 py-3 space-y-3">
        {messages.length === 0 && !busy && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <Sparkles size={24} className="text-primary mb-2" />
            <p className="text-sm font-medium">Ask anything about your transcript</p>
            <p className="text-xs text-muted mt-1 max-w-xs mb-4">The current transcript is sent as context. Summarize, extract action items, find quotes, or ask about specific moments.</p>
            <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="chip surface-2 text-muted hover:bg-primary/10 hover:text-primary transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={clsx('flex animate-slide-up group/msg', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={clsx(
              'max-w-[88%] rounded-2xl px-3.5 py-2.5',
              m.role === 'user'
                ? 'bg-primary text-white rounded-br-md'
                : 'surface-2 text-[var(--text)] rounded-bl-md',
            )}>
              {m.role === 'assistant'
                ? <div className="prose-chat" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                : <p className="text-sm whitespace-pre-wrap">{m.content}</p>}
              <div className={clsx('flex items-center gap-2 mt-1', m.role === 'user' ? 'text-white' : 'text-muted')}>
                <span className="text-[10px] opacity-60">{formatDate(m.createdAt)}</span>
                {m.role === 'assistant' && (
                  <button
                    onClick={() => saveMessage(m)}
                    disabled={savedIds.has(m.id)}
                    className={clsx(
                      'ml-auto flex items-center gap-1 text-[10px] transition opacity-0 group-hover/msg:opacity-100',
                      savedIds.has(m.id) ? 'text-primary opacity-100' : 'hover:text-primary',
                    )}
                    aria-label={savedIds.has(m.id) ? 'Saved' : 'Save to Saved content'}
                  >
                    <Bookmark size={11} className={savedIds.has(m.id) ? 'fill-primary' : ''} />
                    {savedIds.has(m.id) ? 'Saved' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="surface-2 rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-2 text-xs text-muted">
              <Loader2 size={14} className="animate-spin text-primary" /> Thinking…
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-500 text-center px-4">{error}</p>}
      </div>

      <div className="px-3 py-2.5 border-t border-app">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about the transcript…  (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="input resize-none max-h-32 text-sm"
          />
          <button onClick={() => send(input)} disabled={busy || !input.trim()} className="btn-primary !px-2.5 !py-2 rounded-lg shrink-0">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

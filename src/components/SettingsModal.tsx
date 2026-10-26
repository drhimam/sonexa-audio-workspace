import { useEffect, useState } from 'react';
import {
  KeyRound, Eye, EyeOff, Loader2, Check, Info, Server, Cpu, RefreshCw,
  CircleCheck, CircleAlert, Globe, Mic, MessageSquare, ExternalLink, Database, Cloud,
} from 'lucide-react';
import { Modal } from './Modal';
import type { ProviderConfig, ProviderId, ProviderSettings } from '@/lib/types';
import {
  PROVIDER_META, PROVIDER_LABELS,
  isProviderConfigured, resolveProviderConfig,
  providersWithCapability,
} from '@/lib/types';
import { listOllamaModels } from '@/lib/ai';
import { clsx } from '@/lib/utils';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: ProviderSettings;
  onUpdate: (patch: Partial<ProviderSettings>) => Promise<void>;
  onOpenBackup?: () => void;
  onOpenCloudSync?: () => void;
}

type TabId = 'transcription' | 'chat';
type DraftConfigs = Record<ProviderId, ProviderConfig>;

function toDraft(settings: ProviderSettings): DraftConfigs {
  const draft = {} as DraftConfigs;
  for (const id of Object.keys(PROVIDER_META) as ProviderId[]) {
    draft[id] = resolveProviderConfig(id, settings.configs);
  }
  return draft;
}

export function SettingsModal({ open, onClose, settings, onUpdate, onOpenBackup, onOpenCloudSync }: SettingsModalProps) {
  const [tab, setTab] = useState<TabId>('transcription');
  const [draft, setDraft] = useState<DraftConfigs>(() => toDraft(settings));
  const [transcriptionProvider, setTranscriptionProvider] = useState(settings.transcriptionProvider);
  const [chatProvider, setChatProvider] = useState(settings.chatProvider);
  const [visible, setVisible] = useState<Partial<Record<ProviderId, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    if (open) {
      setDraft(toDraft(settings));
      setTranscriptionProvider(settings.transcriptionProvider);
      setChatProvider(settings.chatProvider);
      setSaved(false);
      setOllamaStatus('idle');
      setOllamaModels([]);
      setTab('transcription');
    }
  }, [open, settings]);

  const setField = (id: ProviderId, field: keyof ProviderConfig, value: string) => {
    setDraft((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  };

  const checkOllama = async () => {
    setOllamaStatus('checking');
    const models = await listOllamaModels(draft.ollama.baseUrl);
    setOllamaModels(models);
    setOllamaStatus(models.length > 0 ? 'ok' : 'fail');
    if (models.length > 0 && !draft.ollama.model) {
      setField('ollama', 'model', models[0]);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const configs: ProviderSettings['configs'] = {};
      for (const id of Object.keys(PROVIDER_META) as ProviderId[]) {
        const meta = PROVIDER_META[id];
        const c = draft[id];
        const touched =
          c.apiKey.trim() ||
          c.baseUrl.trim() !== meta.defaultBaseUrl ||
          c.model.trim() !== meta.defaultModel;
        if (touched) {
          configs[id] = {
            baseUrl: c.baseUrl.trim() || meta.defaultBaseUrl,
            apiKey: c.apiKey.trim(),
            model: c.model.trim(),
          };
        }
      }
      await onUpdate({ configs, transcriptionProvider, chatProvider });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 700);
    } finally {
      setSaving(false);
    }
  };

  const transcribeProviders = providersWithCapability('transcription');
  const chatProviders = providersWithCapability('chat');

  const activeProviderId = tab === 'transcription' ? transcriptionProvider : chatProvider;
  const activeMeta = PROVIDER_META[activeProviderId];
  const activeConfig = draft[activeProviderId];
  const activeConfigured = isProviderConfigured(activeProviderId, draftToConfigs(draft));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI providers"
      subtitle="Pick a provider for each task, then configure it below. Stored locally in your browser only."
      icon={<KeyRound size={18} />}
      maxWidth="max-w-xl"
      footer={
        <>
          {onOpenBackup && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBackup();
              }}
              className="btn-outline mr-auto text-xs !py-1.5 flex items-center gap-1.5"
              title="Export or Import database JSON file"
            >
              <Database size={13} className="text-primary" />
              <span>Backup / Transfer Data</span>
            </button>
          )}
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl surface-2">
          <TabButton
            active={tab === 'transcription'}
            onClick={() => setTab('transcription')}
            icon={<Mic size={15} />}
            label="Transcription"
          />
          <TabButton
            active={tab === 'chat'}
            onClick={() => setTab('chat')}
            icon={<MessageSquare size={15} />}
            label="Chat & LLM"
          />
        </div>

        {/* Provider selector for the active tab */}
        <div>
          <label className="text-xs font-medium text-muted">
            {tab === 'transcription' ? 'Transcription provider' : 'Chat / LLM provider'}
          </label>
          <div className="relative mt-1.5">
            <select
              value={activeProviderId}
              onChange={(e) => {
                const v = e.target.value as ProviderId;
                if (tab === 'transcription') setTranscriptionProvider(v);
                else setChatProvider(v);
                setOllamaStatus('idle');
              }}
              className="input appearance-none pr-9 text-sm font-medium"
            >
              {(tab === 'transcription' ? transcribeProviders : chatProviders).map((p) => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
            <Cpu size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-soft pointer-events-none" />
          </div>
          <p className="text-[11px] text-muted mt-1.5">{activeMeta.description}</p>
        </div>

        {/* Config card for the selected provider only */}
        <div className="rounded-xl border border-app overflow-hidden">
          <div className="px-4 py-3 surface-2 border-b border-app flex items-center gap-2">
            <div className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              activeMeta.isLocal ? 'bg-primary/10 text-primary' : 'bg-primary/10 text-primary',
            )}>
              {activeMeta.isLocal ? <Server size={16} /> : <Globe size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{activeMeta.label}</span>
                {activeMeta.isLocal && <span className="chip bg-primary/10 text-primary !py-0.5 !px-1.5 text-[10px]">local</span>}
                {activeConfigured
                  ? <span className="chip bg-primary/10 text-primary !py-0.5 !px-1.5 text-[10px] flex items-center gap-1"><CircleCheck size={10} /> ready</span>
                  : <span className="chip surface-2 text-soft !py-0.5 !px-1.5 text-[10px] flex items-center gap-1"><CircleAlert size={10} /> not configured</span>}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Base URL */}
            {activeMeta.baseUrlEditable && (
              <Field label="Base URL" icon={<Globe size={12} />}>
                <input
                  value={activeConfig.baseUrl}
                  onChange={(e) => setField(activeProviderId, 'baseUrl', e.target.value)}
                  placeholder={activeMeta.defaultBaseUrl}
                  className="input text-sm font-mono"
                  spellCheck={false}
                />
              </Field>
            )}

            {/* API key */}
            {activeMeta.requiresKey ? (
              <Field
                label="API key"
                icon={<KeyRound size={12} />}
                trailing={
                  activeMeta.keyLink && (
                    <a href={activeMeta.keyLink} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                      {activeMeta.keyHint} <ExternalLink size={10} />
                    </a>
                  )
                }
              >
                <div className="relative">
                  <input
                    type={visible[activeProviderId] ? 'text' : 'password'}
                    value={activeConfig.apiKey}
                    onChange={(e) => setField(activeProviderId, 'apiKey', e.target.value)}
                    placeholder={`Paste ${activeMeta.label} key…`}
                    className="input pr-9 text-sm font-mono"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((v) => ({ ...v, [activeProviderId]: !v[activeProviderId] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-soft hover:text-[var(--text)]"
                    aria-label={visible[activeProviderId] ? 'Hide key' : 'Show key'}
                  >
                    {visible[activeProviderId] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </Field>
            ) : (
              <div className="rounded-lg bg-primary/5 px-3 py-2 text-[11px] text-muted flex items-center gap-2">
                <Info size={13} className="text-primary shrink-0" />
                <span>No API key required{activeMeta.isLocal ? ' — runs entirely on your machine.' : '.'}</span>
              </div>
            )}

            {/* Model */}
            <Field label="Model" icon={<Server size={12} />}>
              <div className="flex gap-1.5">
                {activeProviderId === 'ollama' && ollamaModels.length > 0 ? (
                  <select
                    value={activeConfig.model}
                    onChange={(e) => setField(activeProviderId, 'model', e.target.value)}
                    className="input text-sm flex-1"
                  >
                    {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : activeMeta.modelSuggestions.length > 0 ? (
                  <>
                    <input
                      value={activeConfig.model}
                      onChange={(e) => setField(activeProviderId, 'model', e.target.value)}
                      list={`models-${activeProviderId}`}
                      placeholder={activeMeta.defaultModel || 'model id'}
                      className="input text-sm flex-1"
                    />
                    <datalist id={`models-${activeProviderId}`}>
                      {activeMeta.modelSuggestions.map((m) => <option key={m} value={m} />)}
                    </datalist>
                  </>
                ) : (
                  <input
                    value={activeConfig.model}
                    onChange={(e) => setField(activeProviderId, 'model', e.target.value)}
                    placeholder={activeMeta.defaultModel || 'model id'}
                    className="input text-sm flex-1"
                  />
                )}
                {activeProviderId === 'ollama' && (
                  <button
                    type="button"
                    onClick={checkOllama}
                    className="btn-outline !px-2.5 !py-2 text-xs shrink-0"
                    title="Fetch models from local Ollama"
                  >
                    {ollamaStatus === 'checking' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    <span className="ml-1.5 hidden sm:inline">Detect</span>
                  </button>
                )}
              </div>
              {activeProviderId === 'ollama' && ollamaStatus === 'ok' && (
                <p className="text-[11px] text-primary mt-1.5 flex items-center gap-1">
                  <CircleCheck size={11} /> Connected — {ollamaModels.length} models available
                </p>
              )}
              {activeProviderId === 'ollama' && ollamaStatus === 'fail' && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                  <CircleAlert size={11} /> No server at that URL. Start Ollama with <code className="font-mono">ollama serve</code>.
                </p>
              )}
              {activeProviderId === 'ollama' && ollamaStatus === 'idle' && (
                <p className="text-[11px] text-soft mt-1.5">Run <code className="font-mono">ollama serve</code> locally, then click Detect to list your pulled models.</p>
              )}
            </Field>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-app">
          {onOpenCloudSync && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCloudSync();
              }}
              className="text-xs text-primary hover:underline flex items-center gap-1.5"
            >
              <Cloud size={13} />
              <span>Multi-Cloud Sync (Google Drive, OneDrive, WebDAV)</span>
            </button>
          )}
          {onOpenBackup && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBackup();
              }}
              className="text-xs text-muted hover:text-app flex items-center gap-1.5 ml-auto"
            >
              <Database size={13} />
              <span>Backup Database (JSON)</span>
            </button>
          )}
        </div>

        <div className="text-[11px] text-soft text-center">
          Configs persist in IndexedDB on this device. Values never leave your browser except the API calls you trigger.
        </div>
      </div>
    </Modal>
  );
}

function draftToConfigs(draft: DraftConfigs): ProviderSettings['configs'] {
  const configs: ProviderSettings['configs'] = {};
  for (const id of Object.keys(PROVIDER_META) as ProviderId[]) {
    if (draft[id].apiKey.trim() || !PROVIDER_META[id].requiresKey) {
      configs[id] = draft[id];
    }
  }
  return configs;
}

function TabButton({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-[var(--bg)] text-primary shadow-sm' : 'text-muted hover:text-[var(--text)]',
      )}
    >
      {icon} {label}
    </button>
  );
}

function Field({
  label, icon, children, trailing,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-medium text-muted flex items-center gap-1">
          {icon} {label}
        </label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

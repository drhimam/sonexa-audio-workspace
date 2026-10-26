import { useEffect, useState, useCallback } from 'react';
import { getSetting, setSetting } from './db';
import { DEFAULT_PROVIDER_SETTINGS, type ProviderId, type ProviderSettings } from './types';
import { PROVIDER_META } from './types';

const SETTING_ID = 'provider-settings';

// Migrate the old settings shape ({ keys, chatModel }) into the new per-
// provider config shape ({ configs }). Old keys map onto default base URLs
// and the previously-selected chatModel.
function migrate(raw: Record<string, unknown> | null | undefined): ProviderSettings | null {
  if (!raw) return null;
  // Already new shape?
  if (raw.configs && typeof raw.configs === 'object') {
    const s = raw as unknown as ProviderSettings;
    return {
      configs: s.configs ?? {},
      transcriptionProvider: s.transcriptionProvider ?? 'openai',
      chatProvider: s.chatProvider ?? 'openai',
    };
  }
  // Old shape: { keys: { openai?: string, ... }, chatModel?: string, ... }
  const oldKeys = raw.keys as Record<ProviderId, string | undefined> | undefined;
  if (!oldKeys) return null;
  const configs: ProviderSettings['configs'] = {};
  const chatModel = (raw.chatModel as string | undefined) ?? '';
  const chatProvider = (raw.chatProvider as ProviderId | undefined) ?? 'openai';
  const transcriptionProvider = (raw.transcriptionProvider as ProviderId | undefined) ?? 'openai';
  (Object.keys(oldKeys) as ProviderId[]).forEach((id) => {
    const key = oldKeys[id]?.trim();
    if (!key) return;
    const meta = PROVIDER_META[id];
    if (!meta) return;
    configs[id] = {
      baseUrl: meta.defaultBaseUrl,
      apiKey: key,
      model: id === chatProvider && chatModel ? chatModel : meta.defaultModel,
    };
  });
  return { configs, transcriptionProvider, chatProvider };
}

export function useProviderSettings(): {
  settings: ProviderSettings;
  ready: boolean;
  update: (patch: Partial<ProviderSettings>) => Promise<void>;
} {
  const [settings, setSettings] = useState<ProviderSettings>(DEFAULT_PROVIDER_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    getSetting<Record<string, unknown>>(SETTING_ID, {}).then((raw) => {
      if (!alive) return;
      const migrated = migrate(raw) ?? DEFAULT_PROVIDER_SETTINGS;
      setSettings(migrated);
      setReady(true);
      // Persist the migrated shape so future loads skip migration.
      if (migrate(raw)) setSetting(SETTING_ID, migrated);
    });
    return () => { alive = false; };
  }, []);

  const update = useCallback(async (patch: Partial<ProviderSettings>) => {
    setSettings((prev) => {
      const next: ProviderSettings = {
        ...prev,
        ...patch,
        configs: patch.configs ? { ...prev.configs, ...patch.configs } : prev.configs,
      };
      setSetting(SETTING_ID, next);
      return next;
    });
  }, []);

  return { settings, ready, update };
}

import { useMemo, useState } from 'react';
import {
  Loader2, Sparkles, Copy, Download, FileText, ChevronDown, PenLine, Check, Bookmark,
  GraduationCap, ClipboardList, Clock, MessageCircle, Stethoscope, Braces,
  type LucideIcon,
} from 'lucide-react';
import type { GeneratedDocument, ProviderSettings, SavedItem, TranscriptData } from '@/lib/types';
import { resolveProviderConfig } from '@/lib/types';
import { DOC_TEMPLATES, getTemplate, buildDocumentUserPrompt, type DocTemplate } from '@/lib/templates';
import { chatComplete } from '@/lib/ai';
import { copyToClipboard, downloadMarkdown, exportPdf, renderMarkdown } from '@/lib/export';
import { clsx, uid, formatDate } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  GraduationCap, ClipboardList, Clock, MessageCircle, Stethoscope, PenLine, Braces,
};

interface StructuredPanelProps {
  transcript: TranscriptData | null;
  documents: GeneratedDocument[];
  settings: ProviderSettings;
  onDocuments: (docs: GeneratedDocument[]) => void;
  onSaveItem: (item: SavedItem) => void;
  savedIds: Set<string>;
}

export function StructuredPanel({ transcript, documents, settings, onDocuments, onSaveItem, savedIds }: StructuredPanelProps) {
  const [templateId, setTemplateId] = useState<string>(DOC_TEMPLATES[0].id);
  const [customPrompt, setCustomPrompt] = useState<string>(DOC_TEMPLATES[0].systemPrompt);
  const [extra, setExtra] = useState('');
  const [title, setTitle] = useState(DOC_TEMPLATES[0].defaultTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [openDoc, setOpenDoc] = useState<string | null>(documents[0]?.id ?? null);

  const template = useMemo<DocTemplate>(() => getTemplate(templateId)!, [templateId]);

  const selectTemplate = (id: string) => {
    const t = getTemplate(id);
    if (!t) return;
    setTemplateId(id);
    setCustomPrompt(t.systemPrompt);
    setTitle(t.defaultTitle);
  };

  const generate = async () => {
    if (!transcript || transcript.segments.length === 0) { setError('Transcribe audio first.'); return; }
    setError(null); setBusy(true);
    try {
      const userPrompt = buildDocumentUserPrompt(template, transcript, extra);
      const content = await chatComplete(settings, {
        messages: [{ role: 'system', content: customPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.2,
      });
      const doc: GeneratedDocument = {
        id: uid('doc-'),
        templateId,
        title,
        content,
        createdAt: Date.now(),
        provider: settings.chatProvider,
        model: resolveProviderConfig(settings.chatProvider, settings.configs).model,
      };
      const next = [doc, ...documents];
      onDocuments(next);
      setOpenDoc(doc.id);
    } catch (err) {
      setError('Generation failed. Check your API key in Settings.');
    } finally {
      setBusy(false);
    }
  };

  const activeDoc = documents.find((d) => d.id === openDoc) ?? documents[0];

  const handleCopy = async () => {
    if (!activeDoc) return;
    const ok = await copyToClipboard(activeDoc.content);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
  };

  const handleDownloadMd = () => {
    if (activeDoc) downloadMarkdown(`${slug(activeDoc.title)}.md`, activeDoc.content);
  };
  const handleExportPdf = () => {
    if (activeDoc) exportPdf(activeDoc.title, activeDoc.content);
  };

  const handleSave = () => {
    if (!activeDoc || savedIds.has(activeDoc.id)) return;
    const t = getTemplate(activeDoc.templateId);
    onSaveItem({
      id: activeDoc.id,
      kind: 'document',
      title: activeDoc.title,
      content: activeDoc.content,
      sourceLabel: t?.name ?? 'Document',
      createdAt: Date.now(),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 h-full">
      {/* Config column */}
      <div className="card flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-app flex items-center gap-2">
          <Sparkles size={15} className="text-primary" />
          <h3 className="text-sm font-semibold">Structured Content Lab</h3>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted">Template</label>
            <div className="relative mt-1.5">
              <select
                value={templateId}
                onChange={(e) => selectTemplate(e.target.value)}
                className="input appearance-none pr-9 text-sm"
              >
                {DOC_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-soft pointer-events-none" />
            </div>
            <p className="text-[11px] text-soft mt-1.5">{template.description}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted">Document title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1.5 text-sm" />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted">System prompt (editable)</label>
              <button
                onClick={() => setCustomPrompt(template.systemPrompt)}
                className="text-[11px] text-primary hover:underline"
              >
                Reset to template
              </button>
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={10}
              className="input mt-1.5 text-xs font-mono leading-relaxed resize-y scroll-thin"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted">Extra instructions (optional)</label>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={3}
              placeholder="e.g. Keep it under 300 words, focus on the budget discussion…"
              className="input mt-1.5 text-xs resize-y scroll-thin"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-app">
          <button onClick={generate} disabled={busy || !transcript} className="btn-primary w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {busy ? 'Generating…' : 'Generate document'}
          </button>
          {!transcript && <p className="text-[11px] text-soft mt-1.5 text-center">Transcribe audio to enable generation.</p>}
          {error && <p className="text-[11px] text-red-500 mt-1.5 text-center">{error}</p>}
        </div>
      </div>

      {/* Output column */}
      <div className="card flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-app flex items-center gap-2 flex-wrap">
          <FileText size={15} className="text-primary" />
          <h3 className="text-sm font-semibold">Generated documents</h3>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={handleSave} disabled={!activeDoc || (activeDoc != null && savedIds.has(activeDoc.id))} className="btn-ghost !py-1.5 !px-2 text-xs">
              <Bookmark size={13} className={activeDoc && savedIds.has(activeDoc.id) ? 'fill-primary text-primary' : ''} /> {activeDoc && savedIds.has(activeDoc.id) ? 'Saved' : 'Save'}
            </button>
            <button onClick={handleCopy} disabled={!activeDoc} className="btn-ghost !py-1.5 !px-2 text-xs">
              {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />} Copy
            </button>
            <button onClick={handleDownloadMd} disabled={!activeDoc} className="btn-ghost !py-1.5 !px-2 text-xs">
              <Download size={13} /> .md
            </button>
            <button onClick={handleExportPdf} disabled={!activeDoc} className="btn-ghost !py-1.5 !px-2 text-xs">
              <FileText size={13} /> PDF
            </button>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Sparkles size={26} className="text-soft mb-3" />
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs text-muted mt-1 max-w-xs">Pick a template, tweak the prompt if you like, then hit Generate document.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 pt-2 flex gap-1.5 flex-wrap border-b border-app pb-2">
              {documents.map((d) => {
                const t = getTemplate(d.templateId);
                const Icon = (t && ICONS[t.icon]) || FileText;
                return (
                  <button
                    key={d.id}
                    onClick={() => setOpenDoc(d.id)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition max-w-[200px]',
                      (activeDoc?.id === d.id) ? 'bg-primary/10 text-primary' : 'surface-2 text-muted hover:text-[var(--text)]',
                    )}
                  >
                    <Icon size={12} className="shrink-0" />
                    <span className="truncate">{d.title}</span>
                  </button>
                );
              })}
            </div>
            {activeDoc && (
              <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4">
                <div className="flex items-center gap-2 text-[11px] text-soft mb-3">
                  <span>{formatDate(activeDoc.createdAt)}</span>
                  {activeDoc.provider && <span className="chip surface-2 !py-0.5 capitalize">{activeDoc.provider} · {activeDoc.model}</span>}
                </div>
                <div className="prose-doc" dangerouslySetInnerHTML={{ __html: renderMarkdown(activeDoc.content) }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
}

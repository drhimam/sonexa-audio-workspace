import { marked } from 'marked';

import type { TranscriptData, EnhancedTranscript } from './types';
import { formatTimestamp } from './utils';

marked.setOptions({ gfm: true, breaks: false });

export function renderMarkdown(src: string): string {
  return marked.parse(src ?? '', { async: false }) as string;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadMarkdown(filename: string, md: string): void {
  downloadBlob(filename, new Blob([md], { type: 'text/markdown;charset=utf-8' }));
}

export function downloadPlainText(filename: string, text: string): void {
  downloadBlob(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }));
}

export interface ExportOptions {
  includeTimestamps?: boolean;
}

export function transcriptToPlainText(
  transcript: TranscriptData,
  sessionTitle?: string,
  options?: ExportOptions
): string {
  const withTime = options?.includeTimestamps ?? true;
  const lines: string[] = [];
  if (sessionTitle) {
    lines.push(sessionTitle);
    lines.push('='.repeat(Math.max(sessionTitle.length, 20)));
    lines.push('');
  }

  const meta: string[] = [];
  if (transcript.language) meta.push(`Language: ${transcript.language}`);
  if (transcript.provider) meta.push(`Provider: ${transcript.provider}`);
  if (transcript.durationSec) meta.push(`Duration: ${Math.round(transcript.durationSec)}s`);
  if (transcript.segments.length) meta.push(`Segments: ${transcript.segments.length}`);
  if (meta.length > 0) {
    lines.push(meta.join(' | '));
    lines.push('');
  }

  for (const s of transcript.segments) {
    const time = withTime ? `[${formatTimestamp(s.start)}] ` : '';
    const speaker = s.speaker ? `${s.speaker}: ` : '';
    lines.push(`${time}${speaker}${s.text}`);
  }

  return lines.join('\n');
}

export function transcriptToMarkdown(
  transcript: TranscriptData,
  sessionTitle?: string,
  options?: ExportOptions
): string {
  const withTime = options?.includeTimestamps ?? true;
  const lines: string[] = [];
  lines.push(`# ${sessionTitle || 'Audio Transcript'}`);
  lines.push('');

  const meta: string[] = [];
  if (transcript.language) meta.push(`- **Language:** ${transcript.language}`);
  if (transcript.provider) meta.push(`- **Provider:** ${transcript.provider}`);
  if (transcript.durationSec) meta.push(`- **Duration:** ${Math.round(transcript.durationSec)} seconds`);
  meta.push(`- **Segments:** ${transcript.segments.length}`);
  lines.push(meta.join('\n'));
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const s of transcript.segments) {
    let header = '';
    if (withTime && s.speaker) {
      header = `### [${formatTimestamp(s.start)}] ${s.speaker}`;
    } else if (withTime) {
      header = `**[${formatTimestamp(s.start)}]**`;
    } else if (s.speaker) {
      header = `### ${s.speaker}`;
    }

    if (header) {
      lines.push(header);
      lines.push('');
    }
    lines.push(s.text);
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function enhancedTranscriptToPlainText(
  enhanced: EnhancedTranscript,
  sessionTitle?: string,
  options?: ExportOptions
): string {
  const withTime = options?.includeTimestamps ?? true;
  const lines: string[] = [];
  const heading = `${sessionTitle || 'Audio Transcript'} (Enhanced)`;
  lines.push(heading);
  lines.push('='.repeat(Math.max(heading.length, 20)));
  lines.push('');

  if (enhanced.summary) {
    lines.push('EXECUTIVE SUMMARY');
    lines.push('-----------------');
    lines.push(enhanced.summary);
    lines.push('');
  }

  if (enhanced.topics && enhanced.topics.length > 0) {
    lines.push('KEY TOPICS');
    lines.push('----------');
    lines.push(enhanced.topics.map((t) => `• ${t}`).join('\n'));
    lines.push('');
  }

  lines.push('TRANSCRIPT');
  lines.push('----------');
  for (const s of enhanced.segments) {
    const time = withTime ? `[${formatTimestamp(s.start)}] ` : '';
    const speaker = s.speaker ? `${s.speaker}: ` : '';
    lines.push(`${time}${speaker}${s.text}`);
  }

  return lines.join('\n');
}

export function enhancedTranscriptToMarkdown(
  enhanced: EnhancedTranscript,
  sessionTitle?: string,
  options?: ExportOptions
): string {
  const withTime = options?.includeTimestamps ?? true;
  const lines: string[] = [];
  lines.push(`# ${sessionTitle || 'Audio Transcript'} — Enhanced`);
  lines.push('');

  if (enhanced.summary) {
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(`> ${enhanced.summary}`);
    lines.push('');
  }

  if (enhanced.topics && enhanced.topics.length > 0) {
    lines.push('**Key Topics:** ' + enhanced.topics.map((t) => `\`${t}\``).join(' '));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Cleaned Dialogue');
  lines.push('');

  for (const s of enhanced.segments) {
    let header = '';
    if (withTime && s.speaker) {
      header = `### [${formatTimestamp(s.start)}] ${s.speaker}`;
    } else if (withTime) {
      header = `**[${formatTimestamp(s.start)}]**`;
    } else if (s.speaker) {
      header = `### ${s.speaker}`;
    }

    if (header) {
      lines.push(header);
      lines.push('');
    }
    lines.push(s.text);
    lines.push('');
  }

  return lines.join('\n').trim();
}

// Minimal PDF export via printable HTML window — no heavy deps. Preserves
// headings, tables, lists, and basic styling. Works in Chrome/Edge/Firefox.
export function exportPdf(htmlTitle: string, markdown: string): void {
  const body = renderMarkdown(markdown);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(htmlTitle)}</title>
<style>
  @page { margin: 22mm 18mm; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#111827; line-height:1.55; font-size:12pt; }
  h1 { font-size:20pt; margin:0 0 8pt; }
  h2 { font-size:15pt; margin:18pt 0 6pt; border-bottom:1px solid #e5e7eb; padding-bottom:3pt; }
  h3 { font-size:13pt; margin:12pt 0 4pt; }
  p { margin:6pt 0; }
  ul,ol { margin:6pt 0 6pt 18pt; }
  li { margin:2pt 0; }
  table { width:100%; border-collapse:collapse; margin:8pt 0; font-size:10pt; }
  th,td { border:1px solid #d1d5db; padding:5pt 7pt; text-align:left; vertical-align:top; }
  th { background:#f3f4f6; font-weight:600; }
  blockquote { border-left:3px solid #10a37f; margin:8pt 0; padding:4pt 12pt; color:#374151; font-style:italic; }
  code { font-family:'JetBrains Mono', ui-monospace, monospace; font-size:10pt; background:#f3f4f6; padding:1pt 4pt; border-radius:3pt; }
  pre { background:#f3f4f6; padding:8pt; border-radius:6pt; overflow:auto; }
  pre code { background:none; padding:0; }
  a { color:#0c8c6d; }
</style></head><body>${body}</body></html>`;
  const w = window.open('', '_blank');
  if (!w) {
    // Popup blocked — fall back to downloading an HTML file the user can print.
    downloadBlob(`${slug(htmlTitle)}.html`, new Blob([html], { type: 'text/html' }));
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try { w.print(); } catch { /* user can print manually */ }
  }, 350);
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]!));
}

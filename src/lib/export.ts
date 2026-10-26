import { marked } from 'marked';

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

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]!));
}

/** A deliberately small Markdown-to-HTML renderer for model output.
 *
 * The model is not allowed to provide HTML.  Rendering a small Markdown
 * subset here keeps the Note writer independent of a browser DOM and, more
 * importantly, makes the output safe in Zotero's privileged note editor.
 */

export class BriefMarkdownError extends Error {
  readonly code = 'BRIEF_MARKDOWN_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'BriefMarkdownError';
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(value: string): string | null {
  const url = value.trim();
  if (!/^(?:https?:|mailto:)/iu.test(url) || /[\u0000-\u001f\u007f]/u.test(url)) {
    return null;
  }
  return escapeHtml(url);
}

function inline(value: string): string {
  // Remove raw tags, including event attributes and embedded scripts.  They
  // are not part of the supported Markdown subset.
  let text = value.replace(/<[^>]*>/gu, '');
  const code: string[] = [];
  text = text.replace(/`([^`\n]*)`/gu, (_, body: string) => {
    code.push(`<code>${escapeHtml(body)}</code>`);
    return `\u0000${code.length - 1}\u0000`;
  });
  text = escapeHtml(text);
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/gu, (_, label: string, href: string) => {
    const safe = safeHref(href);
    return safe ? `<a href="${safe}">${label}</a>` : label;
  });
  text = text.replace(/\*\*([^*\n]+)\*\*/gu, '<strong>$1</strong>');
  text = text.replace(/__([^_\n]+)__/gu, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/gu, '$1<em>$2</em>');
  text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/gu, '$1<em>$2</em>');
  return text.replace(/\u0000(\d+)\u0000/gu, (_, index: string) => code[Number(index)] || '');
}

function isTableSeparator(value: string): boolean {
  const cells = value.trim().replace(/^\||\|$/g, '').split('|');
  return cells.length > 0 && cells.every(cell => /^\s*:?-{3,}:?\s*$/u.test(cell));
}

/** Convert supported Markdown to safe HTML. Empty output is rejected. */
export function markdownToSafeHtml(markdown: string): string {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    throw new BriefMarkdownError('Brief Markdown must not be empty.');
  }
  const lines = markdown.replace(/\r\n?/gu, '\n').split('\n');
  const output: string[] = [];
  let paragraph: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let quote: string[] = [];
  let codeLines: string[] | null = null;
  let table: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${inline(paragraph.join('\n')).replace(/\n/gu, '<br>')}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => { if (list) { output.push(`</${list}>`); list = null; } };
  const flushQuote = () => {
    if (quote.length) {
      flushList();
      output.push(`<blockquote>${quote.map(line => `<p>${inline(line)}</p>`).join('')}</blockquote>`);
      quote = [];
    }
  };
  const flushTable = () => {
    if (!table) return;
    flushParagraph();
    if (table.length >= 2 && isTableSeparator(table[1])) {
      const rows = [table[0], ...table.slice(2)].map(row =>
        row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()),
      );
      const head = rows.shift() || [];
      output.push(`<table><thead><tr>${head.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>`);
      for (const row of rows) {
        output.push(`<tr>${head.map((_, index) => `<td>${inline(row[index] || '')}</td>`).join('')}</tr>`);
      }
      output.push('</tbody></table>');
    } else {
      paragraph.push(...table);
      flushParagraph();
    }
    table = null;
  };
  const flushCode = () => {
    if (codeLines) {
      flushParagraph();
      flushList();
      flushQuote();
      output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      codeLines = null;
    }
  };

  for (const line of lines) {
    if (codeLines) {
      if (/^\s*```/u.test(line)) flushCode();
      else codeLines.push(line);
      continue;
    }
    if (/^\s*```/u.test(line)) {
      flushTable(); flushParagraph(); flushList(); flushQuote();
      codeLines = [];
      continue;
    }
    const tableRow = /^\s*\|?.+\|.+\|?\s*$/u.test(line);
    if (table && tableRow) { table.push(line); continue; }
    if (table) flushTable();
    if (!line.trim()) { flushParagraph(); flushList(); flushQuote(); continue; }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    if (heading) {
      flushParagraph(); flushList(); flushQuote();
      const level = heading[1].length;
      output.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      continue;
    }
    if (/^\s*\|?.+\|.+\|?\s*$/u.test(line)) { table = [line]; continue; }
    const quoteLine = /^\s*>\s?(.*)$/u.exec(line);
    if (quoteLine) { flushParagraph(); flushList(); quote.push(quoteLine[1]); continue; }
    const item = /^\s*(?:[-*+]\s+)(.+)$/u.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.+)$/u.exec(line);
    if (item || numbered) {
      flushParagraph(); flushQuote();
      const next: 'ul' | 'ol' = numbered ? 'ol' : 'ul';
      if (list !== next) { flushList(); output.push(`<${next}>`); list = next; }
      output.push(`<li>${inline((item || numbered)![1])}</li>`);
      continue;
    }
    paragraph.push(line);
  }
  flushCode(); flushTable(); flushParagraph(); flushList(); flushQuote();
  const html = output.join('');
  if (!html.replace(/<[^>]*>/gu, '').trim()) throw new BriefMarkdownError('Brief Markdown produced empty HTML.');
  return html;
}

export const renderBriefMarkdown = markdownToSafeHtml;

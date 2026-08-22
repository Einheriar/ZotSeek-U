/**
 * Convert Zotero note HTML into stable, structure-aware plain text.
 *
 * Zotero's note editor exposes notes to plugins as HTML via item.getNote().
 * Embeddings only need the visible text and meaningful block boundaries, so
 * this deliberately avoids a Markdown conversion dependency.
 */

declare const Zotero: any;
declare const Services: any;

const SKIPPED_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'svg',
]);

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'tfoot',
  'thead',
  'tr',
  'ul',
]);

function appendBreak(parts: string[]): void {
  if (parts.length === 0 || parts[parts.length - 1].endsWith('\n')) return;
  parts.push('\n');
}

function getDOMParserConstructor(): (new () => DOMParser) | null {
  if (typeof DOMParser !== 'undefined') return DOMParser;

  try {
    const mainWindow = typeof Zotero !== 'undefined' ? Zotero.getMainWindow?.() : null;
    if (mainWindow?.DOMParser) return mainWindow.DOMParser;
  } catch {
    // Fall through to the hidden window.
  }

  try {
    const hiddenWindow = typeof Services !== 'undefined'
      ? Services.appShell?.hiddenDOMWindow
      : null;
    if (hiddenWindow?.DOMParser) return hiddenWindow.DOMParser;
  } catch {
    // A conservative regex fallback is used below.
  }

  return null;
}

function walkVisibleText(node: Node, parts: string[]): void {
  if (node.nodeType === 3) {
    parts.push(node.nodeValue || '');
    return;
  }

  if (node.nodeType !== 1) return;

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (SKIPPED_TAGS.has(tag)) return;

  if (tag === 'br') {
    appendBreak(parts);
    return;
  }

  if (tag === 'img') {
    const alt = element.getAttribute('alt')?.trim();
    if (alt) parts.push(alt);
    return;
  }

  const isBlock = BLOCK_TAGS.has(tag);
  if (isBlock) appendBreak(parts);

  if (tag === 'li') {
    appendBreak(parts);
    parts.push('• ');
  }

  const children = Array.from(element.childNodes);
  children.forEach((child, index) => {
    walkVisibleText(child, parts);
    if ((tag === 'td' || tag === 'th') && index < children.length - 1) {
      parts.push(' ');
    }
  });

  if (tag === 'td' || tag === 'th') parts.push('\t');
  if (tag === 'li' || isBlock) appendBreak(parts);
}

function decodeBasicEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const value = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function fallbackHTMLToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n• ')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|blockquote|tr|table|ul|ol|section|article)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeBasicEntities(withBreaks);
}

/** Normalize already-visible note text so hashes ignore formatting-only edits. */
export function normalizeNoteText(text: string): string {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim());

  const normalized: string[] = [];
  let previousWasBlank = true;
  for (const line of lines) {
    const isBlank = line.length === 0;
    if (isBlank) {
      if (!previousWasBlank) normalized.push('');
    } else {
      normalized.push(line);
    }
    previousWasBlank = isBlank;
  }

  while (normalized.length > 0 && normalized[normalized.length - 1] === '') {
    normalized.pop();
  }
  return normalized.join('\n').trim();
}

/** Convert the HTML returned by Zotero.Item.getNote() to embedding-ready text. */
export function noteHTMLToText(noteHTML: string): string {
  if (!noteHTML || !noteHTML.trim()) return '';

  const Parser = getDOMParserConstructor();
  if (!Parser) return normalizeNoteText(fallbackHTMLToText(noteHTML));

  try {
    const document = new Parser().parseFromString(
      `<!doctype html><html><body>${noteHTML}</body></html>`,
      'text/html'
    );
    const parts: string[] = [];
    for (const child of Array.from(document.body.childNodes)) {
      walkVisibleText(child, parts);
    }
    return normalizeNoteText(parts.join(''));
  } catch {
    return normalizeNoteText(fallbackHTMLToText(noteHTML));
  }
}

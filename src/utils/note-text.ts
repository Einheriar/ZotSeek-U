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
  'li',
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

const GENERIC_ROOT_HEADINGS = new Set([
  '简报',
  '学术简报',
  '科普文简报',
  'academic brief',
]);

const BASIC_INFO_HEADINGS = new Set([
  '基本信息',
  '论文基本信息',
  '文献基本信息',
  'basic information',
]);

// Prefer false negatives to false positives: only reference-first grammatical
// families are filtered, while explicitly analytical tails remain indexable.
const CHINESE_REFERENCE_START = /^(?:(?:核心|关键|主要|精选|推荐)\s*)?参考(?:文献|书目)/u;
const CHINESE_REFERENCE_ANALYTICAL_TAIL = /^(?:在.+(?:作用|角色|意义|价值|应用|影响)(?:与(?:局限|问题))?|的(?:局限|偏差|问题)(?:与.+)?)$/u;
const CHINESE_DIRECTED_READING_HEADING = /^(?:(?:本(?:章|节)\s*)?引用(?:的)?|(?:推荐|必读)(?:阅读)?(?:的)?)(?:(?:核心|关键|主要|精选|关联|延伸)\s*)*(?:参考)?(?:文献|书目)(?:列表|清单|目录|导读)?$/u;
const CHINESE_EVIDENCE_SOURCES_HEADING = /^(?:用于)?支撑(?:核心|关键|主要)?证据的(?:(?:原始|核心|关键|主要)\s*)*(?:参考)?文献(?:列表|清单|目录)?$/u;
const ENGLISH_REFERENCE_START = /^(?:(?:core|key|selected|recommended)\s+)?(?:references?|bibliography)\b/u;
const ENGLISH_REFERENCE_ANALYTICAL_TAIL = /^(?:about|in|within)\b/u;
const ENGLISH_READING_HEADING = /^(?:(?:recommended|further|essential)\s+reading)(?:\s+list)?$/u;

export interface NoteSection {
  path: string[];
  pathLevels: number[];
  /** Unique occurrence of the containing h2; titles alone are not unique. */
  h2Group?: number;
  paragraphs: string[];
}

export interface StructuredNoteText {
  visibleText: string;
  /** Faithful filtered text for bounded keyword evidence. */
  filteredText: string;
  /** Stable filtered representation used by Note fingerprints. */
  indexText: string;
  sections: NoteSection[];
  meaningfulHeadingCount: number;
  onlyGenericRoot: boolean;
  filteredPreambleChars: number;
  filteredBasicChars: number;
  filteredReferenceChars: number;
}

export interface NoteParseOptions {
  /** Keep indexing exclusions enabled by default; readers can request all visible sections. */
  filterIndexSubtrees?: boolean;
}

type NoteBlock = {
  kind: 'heading' | 'text';
  text: string;
  level?: number;
};

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

function normalizeBlockText(text: string): string {
  return decodeBasicEntities(text)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeHeading(text: string): string {
  return normalizeBlockText(text)
    .replace(/^[：:。.!！?？\-—_\s]+|[：:。.!！?？\-—_\s]+$/gu, '')
    .toLocaleLowerCase();
}

function isGenericRootHeading(text: string): boolean {
  return GENERIC_ROOT_HEADINGS.has(normalizeHeading(text));
}

function isBasicInfoHeading(text: string): boolean {
  return BASIC_INFO_HEADINGS.has(normalizeHeading(text));
}

function normalizeReferenceHeading(text: string): string {
  return normalizeHeading(text)
    .replace(
      /^(?:[（(](?:\d+(?:[.．]\d+)*|[一二三四五六七八九十百]+|[ivxlcdm]+)[）)]\s*|(?:\d+(?:[.．]\d+)*|[一二三四五六七八九十百]+|[ivxlcdm]+)(?:\s*[、.．:：-]\s*|\s+))/iu,
      '',
    )
    .replace(
      /\s*[（(](?:(?:core|key|selected)\s+(?:references?|bibliography)|references?|bibliography|关键引用)[）)]\s*$/iu,
      '',
    )
    .trim();
}

function isReferenceHeading(text: string): boolean {
  const heading = normalizeReferenceHeading(text);
  const chineseReferenceStart = heading.match(CHINESE_REFERENCE_START)?.[0];
  if (chineseReferenceStart) {
    const tail = heading.slice(chineseReferenceStart.length)
      .replace(/^[：:；;、,，\-—_\s]+/u, '')
      .trim();
    return !CHINESE_REFERENCE_ANALYTICAL_TAIL.test(tail);
  }

  const englishReferenceStart = heading.match(ENGLISH_REFERENCE_START)?.[0];
  if (englishReferenceStart) {
    const tail = heading.slice(englishReferenceStart.length)
      .replace(/^[：:;,.\-—_\s]+/u, '')
      .trim();
    return !ENGLISH_REFERENCE_ANALYTICAL_TAIL.test(tail);
  }

  return CHINESE_DIRECTED_READING_HEADING.test(heading) ||
    CHINESE_EVIDENCE_SOURCES_HEADING.test(heading) ||
    ENGLISH_READING_HEADING.test(heading);
}

/**
 * Parse Zotero's stable note HTML into heading and text blocks.
 *
 * This lightweight tokenizer is also used by Node tests, where DOMParser is
 * unavailable. Zotero note markup is editor-generated rather than arbitrary
 * web HTML, so preserving h1-h6 and visible block boundaries is sufficient.
 */
function parseNoteBlocks(noteHTML: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  const parts: string[] = [];
  let headingLevel: number | undefined;
  const skippedTags: string[] = [];

  const flush = () => {
    const text = normalizeBlockText(parts.join(''));
    parts.length = 0;
    if (!text) return;
    blocks.push(headingLevel
      ? { kind: 'heading', text, level: headingLevel }
      : { kind: 'text', text });
  };

  const tokens = noteHTML.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (!token.startsWith('<')) {
      if (skippedTags.length === 0) parts.push(token);
      continue;
    }

    const closing = /^<\s*\//u.test(token);
    const tagMatch = token.match(/^<\s*\/?\s*([a-z0-9]+)/iu);
    if (!tagMatch) continue;
    const tag = tagMatch[1].toLocaleLowerCase();

    if (SKIPPED_TAGS.has(tag)) {
      if (closing) {
        const index = skippedTags.lastIndexOf(tag);
        if (index >= 0) skippedTags.splice(index, 1);
      } else if (!/\/\s*>$/u.test(token)) {
        skippedTags.push(tag);
      }
      continue;
    }
    if (skippedTags.length > 0) continue;

    const headingMatch = tag.match(/^h([1-6])$/u);
    if (headingMatch) {
      flush();
      headingLevel = closing ? undefined : Number(headingMatch[1]);
      continue;
    }

    if (tag === 'br') {
      parts.push('\n');
      continue;
    }
    if (tag === 'img' && !closing) {
      const alt = token.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu);
      if (alt) parts.push(alt[1] ?? alt[2] ?? alt[3] ?? '');
      continue;
    }
    if (tag === 'td' || tag === 'th') {
      if (closing) parts.push(' ');
      continue;
    }
    if (BLOCK_TAGS.has(tag)) {
      flush();
      if (!closing && tag === 'li') parts.push('• ');
    }
  }
  flush();
  return blocks;
}

/** Parse headings, filter non-semantic subtrees, and retain deterministic paths. */
export function noteHTMLToStructuredText(
  noteHTML: string,
  options: NoteParseOptions = {},
): StructuredNoteText {
  const filterIndexSubtrees = options.filterIndexSubtrees !== false;
  const blocks = parseNoteBlocks(noteHTML || '');
  const headings = blocks.filter((block): block is NoteBlock & { level: number } =>
    block.kind === 'heading' && block.level !== undefined);
  const stack: Array<{ level: number; title: string }> = [];
  const sections: NoteSection[] = [];
  let currentSection: NoteSection | null = null;
  let skipLevel: number | null = null;
  let skipKind: 'basic' | 'reference' | null = null;
  let filteredBasicChars = 0;
  let filteredReferenceChars = 0;
  let filteredPreambleChars = 0;
  let h2Sequence = 0;
  let currentH2Group: number | undefined;
  const hasMeaningfulHeading = headings.some(heading =>
    !(heading.level === 1 && isGenericRootHeading(heading.text)));

  const countFiltered = (text: string) => {
    if (skipKind === 'basic') filteredBasicChars += text.length;
    if (skipKind === 'reference') filteredReferenceChars += text.length;
  };

  for (const block of blocks) {
    if (block.kind === 'heading') {
      const level = block.level || 1;
      if (skipLevel !== null && level <= skipLevel) {
        skipLevel = null;
        skipKind = null;
      }
      if (skipLevel !== null) {
        countFiltered(block.text);
        continue;
      }

      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
      if (filterIndexSubtrees && isBasicInfoHeading(block.text)) {
        skipLevel = level;
        skipKind = 'basic';
        filteredBasicChars += block.text.length;
        currentSection = null;
        continue;
      }
      if (filterIndexSubtrees && isReferenceHeading(block.text)) {
        skipLevel = level;
        skipKind = 'reference';
        filteredReferenceChars += block.text.length;
        currentSection = null;
        continue;
      }
      if (level < 2) currentH2Group = undefined;
      if (level === 2) currentH2Group = ++h2Sequence;
      stack.push({ level, title: block.text });
      currentSection = null;
      continue;
    }

    if (skipLevel !== null) {
      countFiltered(block.text);
      continue;
    }
    const meaningful = stack.filter(entry =>
      !(entry.level === 1 && isGenericRootHeading(entry.title)));
    const isGenericRootPreamble = filterIndexSubtrees && hasMeaningfulHeading && meaningful.length === 0 &&
      stack.some(entry => entry.level === 1 && isGenericRootHeading(entry.title));
    if (isGenericRootPreamble) {
      // Generated briefs often place a citation line between the generic h1
      // and the first real h2. Item metadata already supplies that context.
      filteredPreambleChars += block.text.length;
      continue;
    }
    const path = meaningful.map(entry => entry.title);
    const pathLevels = meaningful.map(entry => entry.level);
    if (!currentSection || currentSection.path.join('\u0000') !== path.join('\u0000')) {
      currentSection = { path, pathLevels, h2Group: currentH2Group, paragraphs: [] };
      sections.push(currentSection);
    }
    currentSection.paragraphs.push(block.text);
  }

  const meaningfulHeadingCount = headings.filter(heading =>
    !(heading.level === 1 && isGenericRootHeading(heading.text))).length;
  const visibleText = normalizeNoteText(blocks.map(block => block.text).join('\n\n'));
  const indexText = sections.map(section => {
    const encodedPath = section.path.map((title, index) =>
      `h${section.pathLevels[index]}:${title}`).join(' > ');
    const body = section.paragraphs.join('\n\n');
    return encodedPath ? `${encodedPath}\n${body}` : body;
  }).join('\n\n').trim();
  const filteredText = sections.map(section => [
    ...section.path,
    ...section.paragraphs,
  ].join('\n\n')).join('\n\n').trim();

  return {
    visibleText,
    filteredText,
    indexText,
    sections: sections.filter(section => section.paragraphs.some(Boolean)),
    meaningfulHeadingCount,
    onlyGenericRoot: headings.length > 0 && meaningfulHeadingCount === 0,
    filteredPreambleChars,
    filteredBasicChars,
    filteredReferenceChars,
  };
}

/** Return the first explicit heading for read-side title fallback. */
export function noteHTMLFirstHeading(noteHTML: string): string | undefined {
  return parseNoteBlocks(noteHTML || '').find(block => block.kind === 'heading')?.text;
}

/** Filtered representation used by automatic Note change detection. */
export function noteHTMLToIndexText(noteHTML: string): string {
  return noteHTMLToStructuredText(noteHTML).indexText;
}

/** Return a Unicode-safe, query-centred excerpt with a strict character cap. */
export function boundedTextSnippet(text: string, query: string, maxChars = 1200): string {
  const normalized = text.trim();
  const characters = Array.from(normalized);
  if (characters.length <= maxChars || maxChars < 4) {
    return characters.slice(0, Math.max(0, maxChars)).join('');
  }

  const lower = normalized.toLocaleLowerCase();
  const candidates = [query.trim(), ...query.trim().split(/\s+/u)]
    .map(value => value.toLocaleLowerCase())
    .filter(Boolean);
  let matchOffset = -1;
  for (const candidate of candidates) {
    const offset = lower.indexOf(candidate);
    if (offset >= 0 && (matchOffset < 0 || offset < matchOffset)) matchOffset = offset;
  }

  const matchCharacter = matchOffset >= 0
    ? Array.from(normalized.slice(0, matchOffset)).length
    : 0;
  const contentBudget = maxChars - 2;
  const start = Math.max(0, Math.min(
    characters.length - contentBudget,
    matchCharacter - Math.floor(contentBudget / 3),
  ));
  const end = Math.min(characters.length, start + contentBudget);
  return `${start > 0 ? '…' : ''}${characters.slice(start, end).join('')}${end < characters.length ? '…' : ''}`;
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

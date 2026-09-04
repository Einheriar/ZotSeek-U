import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateCloudTokens,
  estimateTokens,
  chunkDocument,
  chunkDocumentEx,
  chunkDocumentWithPagesEx,
  createPageEstimationContext,
  estimatePageNumber,
  estimatePageForRange,
  countParagraphsUpTo,
  chunkNoteTexts,
  combineFullModeChunks,
  assessChunkStrategyState,
  CHUNK_STRATEGY_VERSION,
  NOTE_CHUNK_STRATEGY_VERSION,
  getChunkOptionsFromPrefs,
  getIndexingMode,
} from '../src/utils/chunker';
import { boundedTextSnippet, noteHTMLToStructuredText } from '../src/utils/note-text';

/**
 * Prose with real sentence boundaries. The chunker can only split an oversized
 * paragraph at sentence ends, so filler like 'x '.repeat(n) is NOT a valid
 * stand-in for body text: it produces one unsplittable chunk and would make
 * these assertions test the wrong thing.
 */
function paragraphs(count: number, sentencesEach = 12): string {
  const out: string[] = [];
  for (let p = 0; p < count; p++) {
    const sentences: string[] = [];
    for (let s = 0; s < sentencesEach; s++) {
      sentences.push(`Paragraph ${p} sentence ${s} discusses semantic retrieval over academic text.`);
    }
    out.push(sentences.join(' '));
  }
  return out.join('\n\n');
}

describe('estimateTokens', () => {
  test('counts whitespace-separated words at ~1.3 tokens each', () => {
    assert.equal(estimateTokens('one two three four five'), Math.ceil(5 * 1.3));
  });

  test('is zero for empty or whitespace-only input', () => {
    assert.equal(estimateTokens(''), 0);
    assert.equal(estimateTokens('   \n\n  '), 0);
  });

  test('collapses runs of whitespace rather than counting them as words', () => {
    assert.equal(estimateTokens('a    b\n\n\tc'), estimateTokens('a b c'));
  });
});

describe('estimateCloudTokens', () => {
  test('preserves the historical English estimate', () => {
    const text = 'one two three four five';
    assert.equal(estimateCloudTokens(text), estimateTokens(text));
  });

  test('counts contiguous CJK text conservatively without whitespace', () => {
    assert.equal(estimateCloudTokens('中文かなカナ한글'), 16);
  });

  test('adds English words and CJK characters in mixed text', () => {
    assert.equal(estimateCloudTokens('cloud 中文 embedding'), 7);
    assert.equal(estimateCloudTokens('   \n\n  '), 0);
  });

  test('splits unpunctuated Cloud CJK input against the estimated target', () => {
    const result = chunkDocumentEx(
      'Cloud 文献',
      '连续中文摘要内容'.repeat(40),
      null,
      'abstract',
      {
        maxTokens: 40,
        maxChunks: 100,
        maxChars: 8000,
        tokenCounter: estimateCloudTokens,
      },
    );

    assert.ok(result.chunks.length > 1);
    assert.ok(result.chunks.every(chunk => estimateCloudTokens(chunk.text) <= 40));
  });
});

describe('chunkDocument, abstract mode', () => {
  test('produces exactly one summary chunk and ignores the fulltext', () => {
    const chunks = chunkDocument('A Title', 'An abstract long enough to be kept as its own text.', paragraphs(20), 'abstract');
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].type, 'summary');
    assert.match(chunks[0].text, /A Title/);
    assert.match(chunks[0].text, /An abstract long enough/);
  });

  test('falls back to the title alone when the abstract is too short to be useful', () => {
    // Under 50 characters the abstract is treated as noise and dropped.
    const chunks = chunkDocument('A Title', 'Too short.', null, 'abstract');
    assert.equal(chunks[0].text, 'A Title');
  });

  test('truncates a very long title instead of emitting it whole', () => {
    const chunks = chunkDocument('T'.repeat(500), null, null, 'abstract');
    assert.ok(chunks[0].text.length < 500, 'long title is cut down');
    assert.match(chunks[0].text, /\.\.\.$/, 'and marked as truncated');
  });
});

describe('chunkDocument, full mode', () => {
  test('emits the summary chunk first, then body chunks', () => {
    const chunks = chunkDocument('T', 'An abstract that is comfortably longer than fifty characters.', paragraphs(6), 'full');
    assert.ok(chunks.length > 1, 'body produced chunks beyond the summary');
    assert.equal(chunks[0].type, 'summary');
    assert.ok(chunks.slice(1).every((c) => c.type !== 'summary'), 'only one summary chunk');
  });

  test('numbers chunks consecutively from zero', () => {
    const chunks = chunkDocument('T', null, paragraphs(8), 'full');
    assert.deepEqual(chunks.map((c) => c.index), chunks.map((_, i) => i));
  });

  test('ignores fulltext under 500 characters as not meaningful', () => {
    const chunks = chunkDocument('T', null, 'Short body text.', 'full');
    assert.equal(chunks.length, 1, 'only the summary survives');
    assert.equal(chunks[0].type, 'summary');
  });

  test('treats maxTokens as a ceiling for splittable prose', () => {
    const { chunks } = chunkDocumentEx('T', null, paragraphs(10), 'full', { maxTokens: 150, maxChunks: 200 });
    const body = chunks.filter((c) => c.type !== 'summary');
    assert.ok(body.length > 1, 'prose was actually split');
    for (const c of body) {
      assert.ok(
        estimateTokens(c.text) <= 150,
        `chunk of ${estimateTokens(c.text)} tokens exceeds the 150 ceiling`,
      );
    }
  });

  test('respects the default character ceiling when no options are given', () => {
    // The explicit-option tests below would still pass if DEFAULT_OPTIONS were
    // widened, so exercise the no-options path that production uses too.
    const { chunks } = chunkDocumentEx('T', null, paragraphs(60), 'full');
    for (const c of chunks) {
      assert.ok(c.text.length <= 8000, `chunk of ${c.text.length} chars exceeds the default maxChars`);
    }
  });

  test('respects the default chunk cap when no options are given', () => {
    const { chunks } = chunkDocumentEx('T', null, paragraphs(400), 'full');
    assert.ok(chunks.length <= 100, `${chunks.length} chunks exceeds the default maxChunks of 100`);
  });

  test('never exceeds the configured character split threshold', () => {
    // maxChars is an upstream chunking policy. Inference receives every
    // resulting chunk unchanged and lets the tokenizer enforce token limits.
    const { chunks } = chunkDocumentEx('T', null, paragraphs(30), 'full', { maxChars: 1000, maxChunks: 500 });
    for (const c of chunks) {
      assert.ok(c.text.length <= 1000, `chunk of ${c.text.length} chars exceeds maxChars`);
    }
  });
});

describe('chunk limit and truncation reporting', () => {
  test('reports wasTruncated when the cap cuts content short', () => {
    const { chunks, wasTruncated } = chunkDocumentEx('T', null, paragraphs(40), 'full', { maxTokens: 100, maxChunks: 3 });
    assert.equal(chunks.length, 3);
    assert.equal(wasTruncated, true);
  });

  test('does not claim truncation when everything fitted', () => {
    const { wasTruncated } = chunkDocumentEx('T', null, paragraphs(3), 'full', { maxTokens: 2000, maxChunks: 100 });
    assert.equal(wasTruncated, false);
  });
});

describe('page estimation', () => {
  test('calibrates chars-per-page from the real page count when Zotero supplies it', () => {
    const ctx = createPageEstimationContext(10_000, 5);
    assert.equal(ctx.charsPerPage, 2000);
  });

  test('falls back to a default when the page count is unknown or zero', () => {
    const unknown = createPageEstimationContext(10_000);
    const zero = createPageEstimationContext(10_000, 0);
    assert.equal(unknown.charsPerPage, zero.charsPerPage);
    assert.ok(unknown.charsPerPage > 0);
  });

  test('page numbers are 1-based and clamped to the document length', () => {
    const ctx = createPageEstimationContext(10_000, 5);
    assert.equal(estimatePageNumber(0, ctx), 1, 'offset 0 is page 1, not 0');
    assert.equal(estimatePageNumber(-50, ctx), 1, 'a negative offset cannot go below page 1');
    assert.equal(estimatePageNumber(2500, ctx), 2);
    assert.equal(estimatePageNumber(999_999, ctx), 5, 'clamped to totalPages');
  });

  test('a range is attributed to the page containing its midpoint', () => {
    const ctx = createPageEstimationContext(10_000, 5);
    // Midpoint 2500 lands on page 2 even though the range starts on page 1.
    assert.equal(estimatePageForRange(1000, 4000, ctx), 2);
  });

  test('counts paragraphs preceding a character position', () => {
    const text = 'first\n\nsecond\n\nthird';
    assert.equal(countParagraphsUpTo(text, 0), 0);
    assert.equal(countParagraphsUpTo(text, text.indexOf('second')), 1);
    assert.equal(countParagraphsUpTo(text, text.indexOf('third')), 2);
  });
});

describe('preference reading', () => {
  // These two take Zotero as an explicit argument, so they need no global stub.
  const fakeZotero = (prefs: Record<string, unknown>) => ({
    Prefs: { get: (k: string) => prefs[k] },
    debug: () => {},
  });

  test('reads chunk options from prefs', () => {
    const opts = getChunkOptionsFromPrefs(fakeZotero({
      'zotseek.maxTokens': 512,
      'zotseek.maxChunksPerPaper': 7,
    }));
    assert.equal(opts.maxTokens, 512);
    assert.equal(opts.maxChunks, 7);
  });

  test('falls back to the documented defaults when prefs are unset', () => {
    // Pinned, not just checked for plausibility. These are the values the
    // README and settings pane document, and they are what production actually
    // runs with whenever a pref is missing. maxChars in particular must match
    // MAX_CHARS in the embedding worker.
    const opts = getChunkOptionsFromPrefs(fakeZotero({}));
    assert.equal(opts.maxTokens, 450);
    assert.equal(opts.maxChunks, 100);
    assert.equal(opts.maxChars, 8000);
  });

  test('ignores non-numeric pref values rather than passing them through', () => {
    const opts = getChunkOptionsFromPrefs(fakeZotero({
      'zotseek.maxTokens': 'lots',
      'zotseek.maxChunksPerPaper': null,
    }));
    assert.equal(opts.maxTokens, 450);
    assert.equal(opts.maxChunks, 100);
  });

  test('recognises all indexing modes', () => {
    assert.equal(getIndexingMode(fakeZotero({ 'zotseek.indexingMode': 'abstract' })), 'abstract');
    assert.equal(getIndexingMode(fakeZotero({ 'zotseek.indexingMode': 'notes' })), 'notes');
    assert.equal(getIndexingMode(fakeZotero({ 'zotseek.indexingMode': 'full' })), 'full');
  });

  test('uses notes for a missing preference and fails closed for unknown values', () => {
    assert.equal(getIndexingMode(fakeZotero({})), 'notes');
    assert.equal(getIndexingMode(fakeZotero({ 'zotseek.indexingMode': 'nonsense' })), 'abstract');
    assert.equal(getIndexingMode(undefined), 'notes');
  });
});

describe('persisted chunk strategy state', () => {
  test('uses strategy 8 for R1 Note embedding breadcrumbs', () => {
    assert.equal(CHUNK_STRATEGY_VERSION, 8);
  });

  test('initializes an empty partition even when it has no marker', () => {
    assert.equal(assessChunkStrategyState(0, undefined), 'initialize');
  });

  test('accepts only the current marker for a non-empty partition', () => {
    assert.equal(NOTE_CHUNK_STRATEGY_VERSION, CHUNK_STRATEGY_VERSION);
    assert.equal(assessChunkStrategyState(20, CHUNK_STRATEGY_VERSION), 'current');
    assert.equal(assessChunkStrategyState(20, undefined), 'rebuild-required');
    assert.equal(
      assessChunkStrategyState(20, CHUNK_STRATEGY_VERSION - 1),
      'rebuild-required',
    );
  });
});

describe('Full-mode source allocation', () => {
  const makeChunks = (
    type: 'summary' | 'note' | 'content',
    count: number,
  ) => Array.from({ length: count }, (_, index) => ({
    index,
    text: `${type}-${index}`,
    type,
    tokenCount: 1,
    pageNumber: index + 1,
    paragraphIndex: index,
    startChar: index * 10,
    endChar: index * 10 + 9,
  }));

  test('keeps metadata first, caps Notes at 30, then fills with PDF', () => {
    const result = combineFullModeChunks({
      summaryChunks: makeChunks('summary', 1),
      noteChunks: makeChunks('note', 80),
      pdfChunks: makeChunks('content', 100),
      pagesTotal: 100,
    }, { maxChunks: 100 });

    assert.equal(result.chunks.length, 100);
    assert.equal(result.chunks.filter(chunk => chunk.type === 'summary').length, 1);
    assert.equal(result.chunks.filter(chunk => chunk.type === 'note').length, 30);
    assert.equal(result.chunks.filter(chunk => chunk.type === 'content').length, 69);
    assert.deepEqual(result.chunks.map(chunk => chunk.index),
      Array.from({ length: 100 }, (_, index) => index));
    assert.equal(result.wasTruncated, true);
    assert.equal(result.pagesIndexed, 69);
    assert.equal(result.pagesTotal, 100);
  });

  test('gives PDF every slot left when Notes use less than their cap', () => {
    const result = combineFullModeChunks({
      summaryChunks: makeChunks('summary', 1),
      noteChunks: makeChunks('note', 5),
      pdfChunks: makeChunks('content', 100),
    }, { maxChunks: 20 });

    assert.equal(result.chunks.filter(chunk => chunk.type === 'note').length, 5);
    assert.equal(result.chunks.filter(chunk => chunk.type === 'content').length, 14);
  });

  test('keeps the 30-Note cap even when no PDF can use the free slots', () => {
    const result = combineFullModeChunks({
      summaryChunks: makeChunks('summary', 1),
      noteChunks: makeChunks('note', 80),
      pdfChunks: [],
    }, { maxChunks: 100 });

    assert.equal(result.chunks.length, 31);
    assert.equal(result.chunks.filter(chunk => chunk.type === 'note').length, 30);
    assert.equal(result.wasTruncated, true);
  });

  test('lets PDF use all capacity after metadata when Notes are absent', () => {
    const result = combineFullModeChunks({
      summaryChunks: makeChunks('summary', 1),
      noteChunks: [],
      pdfChunks: makeChunks('content', 20),
    }, { maxChunks: 10 });

    assert.equal(result.chunks.filter(chunk => chunk.type === 'content').length, 9);
    assert.equal(result.pagesIndexed, 9);
  });

  test('allows higher-priority sources to leave no capacity for PDF', () => {
    const result = combineFullModeChunks({
      summaryChunks: makeChunks('summary', 1),
      noteChunks: makeChunks('note', 50),
      pdfChunks: makeChunks('content', 50),
    }, { maxChunks: 20 });

    assert.equal(result.chunks.filter(chunk => chunk.type === 'summary').length, 1);
    assert.equal(result.chunks.filter(chunk => chunk.type === 'note').length, 19);
    assert.equal(result.chunks.filter(chunk => chunk.type === 'content').length, 0);
    assert.equal(result.wasTruncated, true);
  });

  test('clears source locations from metadata and Notes but preserves PDF pages', () => {
    const result = combineFullModeChunks({
      summaryChunks: makeChunks('summary', 1),
      noteChunks: makeChunks('note', 1),
      pdfChunks: makeChunks('content', 1),
    }, { maxChunks: 10 });

    for (const chunk of result.chunks.filter(chunk => chunk.type !== 'content')) {
      assert.equal(chunk.pageNumber, undefined);
      assert.equal(chunk.paragraphIndex, undefined);
      assert.equal(chunk.startChar, undefined);
      assert.equal(chunk.endChar, undefined);
    }
    assert.equal(result.chunks.find(chunk => chunk.type === 'content')?.pageNumber, 1);
  });

  test('lets metadata consume the entire per-paper limit', () => {
    const result = combineFullModeChunks({
      summaryChunks: makeChunks('summary', 4),
      noteChunks: makeChunks('note', 5),
      pdfChunks: makeChunks('content', 5),
    }, { maxChunks: 3 });

    assert.deepEqual(result.chunks.map(chunk => chunk.text), [
      'summary-0',
      'summary-1',
      'summary-2',
    ]);
    assert.equal(result.wasTruncated, true);
  });
});

describe('exact token-aware note chunking', () => {
  // Simulates a tokenizer that counts every Unicode code point plus document
  // prefix/special-token overhead. Production injects multilingual E5 here.
  const exactCounter = (text: string) => Array.from(text).length + 8;

  test('splits an unpunctuated Chinese note without losing its tail', () => {
    const note = '这是没有空格也没有句号的中文长笔记'.repeat(80);
    const { chunks, wasTruncated } = chunkNoteTexts('测试文献', [note], {
      maxTokens: 120,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });

    assert.ok(chunks.length > 1, 'long Chinese note was split');
    assert.equal(wasTruncated, false);
    assert.ok(chunks.every(chunk => exactCounter(chunk.text) <= 120));
    assert.ok(chunks.every(chunk => chunk.tokenCount === exactCounter(chunk.embedText ?? chunk.text)));
    assert.ok(chunks.every(chunk => !chunk.text.includes('测试文献')));
    assert.ok(chunks.every(chunk => (chunk.embedText ?? '').startsWith('文献：测试文献\n')));

    const recovered = chunks.map(chunk => chunk.text).join('');
    assert.equal(recovered, note, 'all original Chinese characters survive');
  });

  test('keeps short mixed-language paragraphs together when they fit', () => {
    const note = [
      '亲子互动 parent-child interaction 与情绪调节。',
      '第二段 combines 中文 notes with English terminology.',
    ].join('\n\n');
    const { chunks } = chunkNoteTexts('Mixed paper', [note], {
      maxTokens: 180,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });

    assert.equal(chunks.length, 1);
    assert.match(chunks[0].text, /parent-child interaction/);
    assert.match(chunks[0].text, /第二段/);
    assert.equal(chunks[0].tokenCount, exactCounter(chunks[0].embedText ?? chunks[0].text));
    assert.ok(!chunks[0].text.includes('Mixed paper'));
  });

  test('never merges different Zotero child notes', () => {
    const { chunks } = chunkNoteTexts('Parent', ['第一条独立笔记', 'Second independent note'], {
      maxTokens: 180,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });

    assert.equal(chunks.length, 2);
    assert.match(chunks[0].text, /第一条独立笔记/);
    assert.match(chunks[1].text, /Second independent note/);
  });

  test('filters basic information and reference subtrees but resumes at a peer heading', () => {
    const note = noteHTMLToStructuredText([
      '<h1>学术简报</h1>',
      '<p>Author (2024). 完整论文标题与期刊信息。</p>',
      '<h2>基本信息</h2><p>论文标题：应被过滤</p><h3>作者</h3><p>某某</p>',
      '<h2>核心发现</h2><h3>机制</h3><p>执行功能预测后续学业表现。</p>',
      '<h2>参考文献</h2><p>Author, 2024.</p><h3>更多文献</h3><p>Other, 2023.</p>',
      '<h2>附记</h2><p>这一段应当恢复索引。</p>',
    ].join(''));

    assert.ok(!note.indexText.includes('应被过滤'));
    assert.ok(!note.indexText.includes('完整论文标题'));
    assert.ok(!note.indexText.includes('Author, 2024'));
    assert.match(note.indexText, /执行功能预测/);
    assert.match(note.indexText, /这一段应当恢复/);
    assert.ok(note.filteredPreambleChars > 0);
    assert.deepEqual(note.sections.map(section => section.path), [
      ['核心发现', '机制'],
      ['附记'],
    ]);
  });

  test('filters numbered and annotated reference headings found in generated briefs', () => {
    const generatedReferenceStarts = ['', '核心', '关键', '主要', '精选', '推荐']
      .flatMap(modifier => ['参考文献', '参考书目']
        .flatMap(subject => ['', '列表', '目录', '及其贡献', '列表与点评']
          .map(tail => `${modifier}${subject}${tail}`)));
    const generatedEvidenceSources = ['', '核心', '关键', '主要']
      .flatMap(evidence => ['', '原始', '核心', '关键']
        .flatMap(source => ['文献', '参考文献']
          .map(subject => `用于支撑${evidence}证据的${source}${subject}清单`)));
    const referenceOnlyHeadings = [...new Set([
      '6. 核心参考文献列表',
      '4.2 支撑关键证据的原始文献',
      '4.2. 支撑关键证据的原始文献',
      '（四）支撑主要证据的关键文献清单',
      '核心参考文献简要说明',
      '五、关键参考文献追踪线索',
      '4. 核心参考文献列表 (Core References)',
      '七、核心参考文献',
      '关键参考文献与延伸阅读',
      '参考文献（关键引用）',
      '4. 核心参考文献列表',
      '核心参考文献精要',
      '8. 核心参考文献列表',
      '关键参考文献',
      '5. 核心参考文献列表 (Key Bibliography)',
      '4. 关键参考文献导读 (Core References)',
      '关键参考文献列表',
      '7. 核心参考文献及其证据支撑',
      '核心参考文献列表与证据说明',
      '核心参考文献及其贡献',
      '核心参考文献列表与点评',
      '参考文献线索',
      '关键参考文献（按图索骥）',
      '引用的关键文献',
      '本章引用的主要文献目录',
      '必读关联文献',
      '推荐阅读的关键文献导读',
      'IX. Selected References',
      'Recommended Bibliography Guide',
      'Further Reading',
      ...generatedReferenceStarts,
      ...generatedEvidenceSources,
    ])];

    referenceOnlyHeadings.forEach((heading, index) => {
      const note = noteHTMLToStructuredText([
        '<h1>学术简报</h1>',
        '<h2>核心发现</h2><p>保留正文。</p>',
        `<h2>${heading}</h2><p>泄漏引用-${index}</p><h3>引用说明</h3><p>继续泄漏-${index}</p>`,
        `<h2>附记</h2><p>恢复正文-${index}</p>`,
      ].join(''));

      assert.ok(!note.indexText.includes(`泄漏引用-${index}`), heading);
      assert.ok(!note.indexText.includes(`继续泄漏-${index}`), heading);
      assert.match(note.indexText, new RegExp(`恢复正文-${index}`), heading);
    });
  });

  test('keeps analytical and mixed headings that merely mention literature or citations', () => {
    const analyticalHeadings = [
      '文献筛选与数据来源',
      '当前文献的主要局限',
      '核心定义与关键文献',
      '关键术语与参考文献线索',
      '关键证据与引用',
      '五、讨论部分的关键证据与文献支撑',
      '6. 学术定位与延伸文献',
      '参考文献在研究设计中的作用',
      '主要参考文献的局限',
      'References in the current literature review',
      'Reference about G*Power',
    ];
    const note = noteHTMLToStructuredText([
      '<h1>学术简报</h1>',
      ...analyticalHeadings.map((heading, index) =>
        `<h2>${heading}</h2><p>必须保留的分析正文-${index}</p>`),
    ].join(''));

    analyticalHeadings.forEach((heading, index) => {
      assert.match(note.indexText, new RegExp(`必须保留的分析正文-${index}`), heading);
    });
    assert.deepEqual(note.sections.map(section => section.path[0]), analyticalHeadings);
  });

  test('keeps a mixed terminology section but filters its reference child subtree', () => {
    const note = noteHTMLToStructuredText([
      '<h1>学术简报</h1>',
      '<h2>关键术语与参考文献线索</h2>',
      '<h3>核心术语</h3><p>保留术语定义。</p>',
      '<h3>4.2 支撑关键证据的原始文献</h3><p>删除原始文献列表。</p>',
      '<h2>附记</h2><p>保留后续正文。</p>',
    ].join(''));

    assert.match(note.indexText, /保留术语定义/u);
    assert.ok(!note.indexText.includes('删除原始文献列表'));
    assert.match(note.indexText, /保留后续正文/u);
  });

  test('uses heading paths for embeddings, keeps paths as metadata, and never crosses h2', () => {
    const note = noteHTMLToStructuredText([
      '<h1>简报</h1>',
      '<h2>研究背景</h2><h3>Gap</h3><p>现有研究缺少纵向证据。</p>',
      '<h3>问题</h3><p>本研究检验发展路径。</p>',
      '<h2>核心发现</h2><h3>结果</h3><p>路径系数显著。</p>',
    ].join(''));
    const { chunks } = chunkNoteTexts('应只进入嵌入的论文标题', [note], {
      maxTokens: 220,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });

    assert.equal(chunks.length, 2, 'the two small h3 sections merge, but the next h2 stays separate');
    assert.deepEqual(chunks[0].sectionPaths, [
      ['研究背景', 'Gap'],
      ['研究背景', '问题'],
    ]);
    assert.deepEqual(chunks[1].sectionPaths, [['核心发现', '结果']]);
    assert.match(chunks[0].embedText ?? '', /^文献：应只进入嵌入的论文标题\n章节：研究背景/u);
    assert.ok(chunks.every(chunk => !chunk.text.includes('应只进入嵌入的论文标题')));
    assert.ok(chunks.every(chunk => exactCounter(chunk.text) <= 220));
  });

  test('does not merge two distinct h2 occurrences that happen to share a title', () => {
    const note = noteHTMLToStructuredText([
      '<h1>简报</h1>',
      '<h2>核心发现</h2><h3>研究一</h3><p>第一段证据。</p>',
      '<h2>核心发现</h2><h3>研究二</h3><p>第二段证据。</p>',
    ].join(''));
    const { chunks } = chunkNoteTexts('Parent title', [note], {
      maxTokens: 220,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });

    assert.equal(chunks.length, 2);
    assert.notEqual(note.sections[0].h2Group, note.sections[1].h2Group);
  });

  test('treats a generic h1-only note as plain text without a synthetic path', () => {
    const note = noteHTMLToStructuredText('<h1>简报</h1><p>只有随手记录的正文。</p>');
    const { chunks } = chunkNoteTexts('Parent title', [note], {
      maxTokens: 180,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });

    assert.equal(note.onlyGenericRoot, true);
    assert.deepEqual(chunks[0].sectionPaths, []);
    assert.equal(chunks[0].embedText, '文献：Parent title\n只有随手记录的正文。');
    assert.equal(chunks[0].text, '只有随手记录的正文。');
  });

  test('bounds keyword Note evidence around the query without splitting Unicode characters', () => {
    const text = `${'前'.repeat(900)}🧠关键证据${'后'.repeat(900)}`;
    const snippet = boundedTextSnippet(text, '关键证据', 1200);
    assert.ok(Array.from(snippet).length <= 1200);
    assert.match(snippet, /🧠关键证据/u);
    assert.match(snippet, /^…/u);
    assert.match(snippet, /…$/u);
  });

  test('keeps pathological long headings within the body budget before adding R1', () => {
    const longHeading = '过长章节标题'.repeat(80);
    const note = noteHTMLToStructuredText(
      `<h1>简报</h1><h2>${longHeading}</h2><p>仍然需要保留的正文证据。</p>`,
    );
    const { chunks } = chunkNoteTexts('Parent title', [note], {
      maxTokens: 120,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });

    assert.ok(chunks.length > 1);
    assert.ok(chunks.every(chunk => exactCounter(chunk.text) <= 120));
    assert.ok(chunks.every(chunk => (chunk.embedText ?? '').startsWith('文献：Parent title\n')));
    assert.ok(chunks.every(chunk => chunk.sectionPaths?.[0]?.[0] === longHeading));
  });

  test('shortens only an exceptional parent-title breadcrumb at the model hard limit', () => {
    const body = '正文证据保持完整。';
    const { chunks } = chunkNoteTexts('极长父标题'.repeat(100), [body], {
      maxTokens: 120,
      modelMaxInputTokens: 150,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });

    assert.equal(chunks[0].text, body);
    assert.match(chunks[0].embedText ?? '', /^文献：.+…\n正文证据保持完整。$/u);
    assert.ok(exactCounter(chunks[0].embedText ?? '') <= 150);
  });

  test('splits a long multilingual summary with exact final-input counts', () => {
    const abstract = '这是没有空格的长摘要内容'.repeat(80);
    const result = chunkDocumentEx('测试文献', abstract, null, 'abstract', {
      maxTokens: 120,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });

    assert.ok(result.chunks.length > 1);
    assert.ok(result.chunks.every(chunk => chunk.type === 'summary'));
    assert.ok(result.chunks.every(chunk => chunk.tokenCount === exactCounter(chunk.text)));
    assert.ok(result.chunks.every(chunk => exactCounter(chunk.text) <= 120));
    const recovered = result.chunks
      .map(chunk => chunk.text.slice(chunk.text.indexOf('\n\n') + 2))
      .join('');
    assert.equal(recovered, abstract);
  });

  test('keeps every exact chunk that fits before reporting the chunk cap', () => {
    const result = chunkDocumentEx('测试文献', '长摘要'.repeat(200), null, 'abstract', {
      maxTokens: 80,
      maxChunks: 2,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });
    assert.equal(result.chunks.length, 2);
    assert.equal(result.wasTruncated, true);
    assert.ok(result.chunks.every(chunk => exactCounter(chunk.text) <= 80));
  });

  test('splits legacy PDF text exactly without losing an unpunctuated tail', () => {
    const fulltext = '无空格中文PDF正文内容'.repeat(100);
    const result = chunkDocumentEx('PDF title', null, fulltext, 'full', {
      maxTokens: 140,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });
    const bodyChunks = result.chunks.filter(chunk => chunk.type !== 'summary');
    assert.ok(bodyChunks.length > 1);
    assert.ok(bodyChunks.every(chunk => exactCounter(chunk.text) <= 140));
    const recovered = bodyChunks
      .map(chunk => chunk.text.slice(chunk.text.indexOf('\n\n') + 2))
      .join('');
    assert.equal(recovered, fulltext);
  });

  test('keeps exact page-aware PDF chunks on their original page', () => {
    const pageText = '逐页中文内容没有空格但必须完整保留'.repeat(60);
    const result = chunkDocumentWithPagesEx('Page title', null, [
      { pageNumber: 7, text: pageText },
    ], 'full', {
      maxTokens: 130,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });
    const bodyChunks = result.chunks.filter(chunk => chunk.type !== 'summary');
    assert.ok(bodyChunks.length > 1);
    assert.ok(bodyChunks.every(chunk => chunk.pageNumber === 7));
    assert.ok(bodyChunks.every(chunk => exactCounter(chunk.text) <= 130));
    const recovered = bodyChunks
      .map(chunk => chunk.text.slice(chunk.text.indexOf('\n\n') + 2))
      .join('');
    assert.equal(recovered, pageText);
  });

  test('packs adjacent short PDF paragraphs on the same physical page by default', () => {
    const first = 'The first short body paragraph preserves enough ordinary prose to remain searchable.';
    const second = 'The second adjacent paragraph should share one embedding input when the token budget allows it.';
    const result = chunkDocumentWithPagesEx('Packed PDF title', null, [
      { pageNumber: 4, text: `${first}\n\n${second}` },
    ], 'full', {
      maxTokens: 260,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });
    const bodyChunks = result.chunks.filter(chunk => chunk.type !== 'summary');

    assert.equal(bodyChunks.length, 1);
    assert.equal(bodyChunks[0].pageNumber, 4);
    assert.equal(bodyChunks[0].paragraphIndex, 0);
    assert.equal(bodyChunks[0].text, `Packed PDF title\n\n${first}\n\n${second}`);
    assert.equal(bodyChunks[0].tokenCount, exactCounter(bodyChunks[0].text));
  });

  test('never packs PDF paragraphs across physical page boundaries', () => {
    const pageOne = 'The final paragraph on page one is deliberately short but still long enough to be indexed. It also carries ordinary searchable prose.';
    const pageTwo = 'The first paragraph on page two must retain its own physical page breadcrumb and chunk. It also carries ordinary searchable prose.';
    const result = chunkDocumentWithPagesEx('Page boundary title', null, [
      { pageNumber: 1, text: pageOne },
      { pageNumber: 2, text: pageTwo },
    ], 'full', {
      maxTokens: 300,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });
    const bodyChunks = result.chunks.filter(chunk => chunk.type !== 'summary');

    assert.equal(bodyChunks.length, 2);
    assert.deepEqual(bodyChunks.map(chunk => chunk.pageNumber), [1, 2]);
  });

  test('can disable same-page PDF paragraph packing for frozen benchmark replay', () => {
    const first = 'The first benchmark paragraph is long enough to be indexed as an independent legacy chunk.';
    const second = 'The second benchmark paragraph must also remain independent when paragraph packing is off.';
    const result = chunkDocumentWithPagesEx('Frozen benchmark title', null, [
      { pageNumber: 6, text: `${first}\n\n${second}` },
    ], 'full', {
      maxTokens: 300,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
      pdfParagraphPacking: 'off',
    });
    const bodyChunks = result.chunks.filter(chunk => chunk.type !== 'summary');

    assert.equal(bodyChunks.length, 2);
    assert.deepEqual(bodyChunks.map(chunk => chunk.paragraphIndex), [0, 1]);
  });

  test('applies the PDF chunk cap after same-page paragraph packing', () => {
    const page = [
      'First compact paragraph contains enough body text to pass the PDF minimum length threshold.',
      'Second compact paragraph should fit beside the first one inside the exact model token budget.',
      'Third compact paragraph is also retained because packing happens before the document chunk cap.',
    ].join('\n\n');
    const packed = chunkDocumentWithPagesEx('Cap ordering title', null, [
      { pageNumber: 1, text: page },
    ], 'full', {
      maxTokens: 340,
      maxChunks: 2,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });
    const legacy = chunkDocumentWithPagesEx('Cap ordering title', null, [
      { pageNumber: 1, text: page },
    ], 'full', {
      maxTokens: 340,
      maxChunks: 2,
      maxChars: 8000,
      tokenCounter: exactCounter,
      pdfParagraphPacking: 'off',
    });

    assert.equal(packed.chunks.filter(chunk => chunk.type !== 'summary').length, 1);
    assert.equal(packed.wasTruncated, false);
    assert.match(packed.chunks[1].text, /Third compact paragraph/);
    assert.equal(legacy.chunks.filter(chunk => chunk.type !== 'summary').length, 1);
    assert.equal(legacy.wasTruncated, true);
    assert.doesNotMatch(legacy.chunks[1].text, /Second compact paragraph/);
  });

  test('preserves physical page numbering when an intermediate page is blank', () => {
    const pageOneText = '第一页正文用于验证物理页码不会被空白页压缩。'.repeat(12);
    const pageThreeText = '第三页正文必须仍然标记为第三页而不是第二页。'.repeat(12);
    const result = chunkDocumentWithPagesEx('Physical page title', null, [
      { pageNumber: 1, text: pageOneText },
      { pageNumber: 2, text: '' },
      { pageNumber: 3, text: pageThreeText },
    ], 'full', {
      maxTokens: 1000,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });
    const bodyChunks = result.chunks.filter(chunk => chunk.type !== 'summary');

    assert.equal(result.pagesTotal, 3);
    assert.equal(result.pagesIndexed, 2);
    assert.deepEqual([...new Set(bodyChunks.map(chunk => chunk.pageNumber))], [1, 3]);
  });

  test('keeps legacy page-aware PDF reference filtering enabled by default', () => {
    const result = chunkDocumentWithPagesEx('Reference filter title', null, [
      { pageNumber: 1, text: 'This body paragraph is long enough to become a searchable PDF chunk before the bibliography begins. It repeats enough ordinary prose to satisfy the minimum paragraph and token thresholds deterministically.' },
      { pageNumber: 2, text: 'References\n\n[1] Smith, A. (2024). A bibliography entry that is long enough to become a chunk if filtering is disabled.' },
      { pageNumber: 3, text: 'This trailing paragraph is intentionally long enough to expose the legacy document-tail latch.' },
    ], 'full', {
      maxTokens: 420,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
    });
    const bodyText = result.chunks.filter(chunk => chunk.type !== 'summary').map(chunk => chunk.text).join('\n');

    assert.match(bodyText, /body paragraph/);
    assert.doesNotMatch(bodyText, /bibliography entry/);
    assert.doesNotMatch(bodyText, /trailing paragraph/);
  });

  test('can disable both legacy PDF reference filters for benchmark isolation', () => {
    const result = chunkDocumentWithPagesEx('Reference filter title', null, [
      { pageNumber: 1, text: 'Data Availability Statement: the complete dataset is available at https://doi.org/10.1234/example and this正文 paragraph must remain searchable.' },
      { pageNumber: 2, text: 'References\n\n[1] Smith, A. (2024). A bibliography entry that is long enough to become a chunk when filtering is disabled.' },
      { pageNumber: 3, text: 'This trailing paragraph is intentionally long enough to prove that later physical pages remain eligible.' },
    ], 'full', {
      maxTokens: 420,
      maxChunks: 100,
      maxChars: 8000,
      pdfReferenceFiltering: 'off',
    });
    const bodyChunks = result.chunks.filter(chunk => chunk.type !== 'summary');
    const bodyText = bodyChunks.map(chunk => chunk.text).join('\n');

    assert.match(bodyText, /Data Availability Statement/);
    assert.match(bodyText, /bibliography entry/);
    assert.match(bodyText, /trailing paragraph/);
    assert.deepEqual([...new Set(bodyChunks.map(chunk => chunk.pageNumber))], [1, 2, 3]);
  });

  test('can disable the PDF body title breadcrumb for a benchmark ablation', () => {
    const body = 'This PDF paragraph is deliberately long enough to survive the exact page-aware chunking path without any title breadcrumb.';
    const result = chunkDocumentWithPagesEx('Breadcrumb title', null, [
      { pageNumber: 1, text: body },
    ], 'full', {
      maxTokens: 420,
      maxChunks: 100,
      maxChars: 8000,
      tokenCounter: exactCounter,
      pdfTitlePrefix: 'off',
    });
    const bodyChunks = result.chunks.filter(chunk => chunk.type !== 'summary');

    assert.equal(bodyChunks.length, 1);
    assert.equal(bodyChunks[0].text, body);
    assert.equal(bodyChunks[0].pageNumber, 1);
    assert.equal(bodyChunks[0].tokenCount, exactCounter(body));
    assert.equal(result.chunks[0].text, 'Breadcrumb title');
  });

  test('preserves a title that is longer than the character split threshold', () => {
    const title = '超长标题'.repeat(40);
    const { chunks } = chunkDocumentEx(title, null, null, 'abstract', { maxChars: 50, maxChunks: 100 });
    assert.equal(chunks.map(chunk => chunk.text).join(''), title);
    assert.ok(chunks.every(chunk => chunk.text.length <= 50));
  });
});

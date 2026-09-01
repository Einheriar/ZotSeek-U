import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  PDF_ATTACHMENT_SELECTOR_ID,
  PDF_ATTACHMENT_SELECTOR_VERSION,
  PdfAttachmentText,
  selectMainPdfAttachment,
} from '../src/utils/pdf-attachment-selector';

function attachment(
  attachmentId: number,
  attachmentKey: string,
  fileName: string,
  pages: string[],
  status: PdfAttachmentText['status'] = 'ok',
): PdfAttachmentText {
  return {
    attachmentId,
    attachmentKey,
    fileName,
    pagesTotal: pages.length || null,
    pages: pages.map((text, index) => ({ pageNumber: index + 1, text })),
    status,
  };
}

describe('frozen PDF main attachment selector', () => {
  test('selects the main article when a supplement appears first', () => {
    const title = 'Maternal chemosignals enhance infant adult brain synchrony';
    const supplement = attachment(
      10,
      'SUPP',
      'sciadv.abg6867_sm.pdf',
      [`Supporting Online Material\n${title}\nSupplementary Methods`],
    );
    const main = attachment(
      20,
      'MAIN',
      'maternal-chemosignals.pdf',
      [`Research Article\n${title}\nAbstract\nIntroduction`],
    );

    const result = selectMainPdfAttachment(title, [supplement, main]);

    assert.equal(result.selectorId, PDF_ATTACHMENT_SELECTOR_ID);
    assert.equal(result.selectorVersion, PDF_ATTACHMENT_SELECTOR_VERSION);
    assert.equal(result.decision, 'selected-main');
    assert.equal(result.selectedAttachmentKey, 'MAIN');
    assert.equal(result.predictions.find(item => item.attachmentKey === 'SUPP')?.role, 'supplement');
  });

  test('does not treat ordinary support words as supplement filename tokens', () => {
    const title = 'Shared flexibility supports rhythmic coordination';
    const result = selectMainPdfAttachment(title, [
      attachment(
        1,
        'M',
        'shared-flexibility-supports-rhythmic-coordination.pdf',
        [`Abstract\n${title}\nIntroduction`],
      ),
    ]);

    assert.equal(result.selectedAttachmentKey, 'M');
    assert.doesNotMatch(
      result.predictions[0].reasons.join(' '),
      /filename:supplement-token/,
    );
  });

  test('classifies correction, commentary bundle and concatenated main-annex as unknown', () => {
    const title = 'Toward a second person neuroscience';
    const main = attachment(1, 'M', 'main.pdf', [`Research Article\n${title}\nAbstract`]);
    const supplement = attachment(2, 'S', 'paper_som.pdf', ['Supporting Online Material']);
    const concatenated = attachment(3, 'C', 'combined.pdf', [
      `Research Article\n${title}\nAbstract`,
      'Supporting Online Material',
    ]);
    const correction = attachment(4, 'E', 'erratum.pdf', [`Correction to\n${title}`]);
    const commentary = attachment(5, 'R', 'response.pdf', [
      `Research Article\n${title}\nAbstract`,
      "Open Peer Commentary\nAuthors' Response",
    ]);

    const result = selectMainPdfAttachment(title, [
      main,
      supplement,
      concatenated,
      correction,
      commentary,
    ]);
    const roles = new Map(result.predictions.map(item => [item.attachmentKey, item]));

    assert.equal(result.selectedAttachmentKey, 'M');
    assert.equal(roles.get('C')?.documentComposition, 'main-with-annex');
    assert.equal(roles.get('E')?.documentComposition, 'correction');
    assert.equal(roles.get('R')?.documentComposition, 'main-with-commentaries');
    assert.equal(roles.get('C')?.role, 'unknown');
  });

  test('abstains instead of falling back when main evidence is absent or ambiguous', () => {
    const unknown = attachment(1, 'U', 'unresolved.pdf', ['A short cover sheet with no article structure.']);
    const firstMain = attachment(2, 'M1', 'one.pdf', ['Research Article\nAbstract\nIntroduction']);
    const secondMain = attachment(3, 'M2', 'two.pdf', ['Research Article\nAbstract\nIntroduction']);
    const failed = attachment(4, 'F', 'failed.pdf', [], 'failed');

    assert.equal(selectMainPdfAttachment('Target title', []).abstainReason, 'missing-pdf');
    assert.equal(selectMainPdfAttachment('Target title', [unknown]).abstainReason, 'no-main');
    assert.equal(selectMainPdfAttachment('Target title', [failed]).abstainReason, 'unavailable');
    assert.equal(
      selectMainPdfAttachment('Target title', [firstMain, secondMain]).abstainReason,
      'multiple-main',
    );
  });

  test('keeps the selected key invariant under attachment order and does not mutate inputs', () => {
    const title = 'Target paper title';
    const main = attachment(1, 'M', 'target.pdf', [`Research Article\n${title}\nAbstract`]);
    const supplement = attachment(2, 'S', 'target_mmc1.pdf', [`Supporting Information\n${title}`]);
    const before = JSON.stringify([main, supplement]);

    const forward = selectMainPdfAttachment(title, [main, supplement]);
    const reverse = selectMainPdfAttachment(title, [supplement, main]);

    assert.equal(forward.selectedAttachmentKey, 'M');
    assert.equal(reverse.selectedAttachmentKey, 'M');
    assert.equal(JSON.stringify([main, supplement]), before);
  });
});

const CJK_CHARACTER = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/;

export const MIN_CJK_QUERY_LENGTH = 2;
export const MIN_OTHER_QUERY_LENGTH = 3;

/**
 * CJK terms carry more information per character than space-delimited words.
 * Accept two-character CJK queries while retaining the original three-character
 * floor for other scripts to avoid overly broad searches while typing.
 */
export function isValidSearchQuery(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) return false;

  const minimumLength = CJK_CHARACTER.test(normalized)
    ? MIN_CJK_QUERY_LENGTH
    : MIN_OTHER_QUERY_LENGTH;

  return Array.from(normalized).length >= minimumLength;
}

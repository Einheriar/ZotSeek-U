/** Return why a provider vector is unsafe to store, or null when it is valid. */
export function embeddingVectorValidationError(
  embedding: unknown,
  dimensions: number,
): string | null {
  if (!Array.isArray(embedding)) return 'embedding is not an array';
  if (embedding.length !== dimensions) {
    return `expected ${dimensions} values but received ${embedding.length}`;
  }
  if (embedding.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    return 'embedding contains a non-finite numeric value';
  }
  if (embedding.every(value => value === 0)) return 'embedding is an all-zero vector';
  return null;
}

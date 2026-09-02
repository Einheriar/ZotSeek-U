/**
 * Pure planning helpers for indexing-mode transitions.
 *
 * Callers must separately prove that the old and new index configurations
 * differ only by mode. Once that gate passes, an unchanged target chunk can
 * carry its existing vector forward while all descriptive metadata is rebuilt
 * from the target extraction.
 */

import type { Chunk, ChunkType } from '../utils/chunker';
import type { PaperEmbedding, TextSourceType } from './vector-store-sqlite';

export interface ModeTransitionReusePlan {
  reusableByTargetIndex: Map<number, PaperEmbedding>;
  chunksToEmbed: Chunk[];
}

function canonicalSource(source: ChunkType | TextSourceType): string {
  return source === 'summary' || source === 'abstract' || source === 'title_only'
    ? 'summary'
    : source;
}

function normalizedSectionPaths(paths: string[][] | undefined): string[][] {
  return (paths || []).map(path => [...path]);
}

function reuseKey(
  source: ChunkType | TextSourceType,
  text: string,
  sectionPaths: string[][] | undefined,
): string {
  return JSON.stringify([
    canonicalSource(source),
    text,
    normalizedSectionPaths(sectionPaths),
  ]);
}

/**
 * Match target chunks against the active model's stored chunks. Queues retain
 * multiplicity, so duplicate text cannot reuse one stored vector twice.
 */
export function planModeTransitionReuse(
  targetChunks: Chunk[],
  existingChunks: PaperEmbedding[],
  modelId: string,
): ModeTransitionReusePlan {
  const available = new Map<string, PaperEmbedding[]>();
  for (const existing of existingChunks) {
    if (existing.modelId !== modelId || !existing.chunkText) continue;
    const key = reuseKey(
      existing.textSource,
      existing.chunkText,
      existing.sectionPaths,
    );
    const queue = available.get(key) || [];
    queue.push(existing);
    available.set(key, queue);
  }

  const reusableByTargetIndex = new Map<number, PaperEmbedding>();
  const chunksToEmbed: Chunk[] = [];
  for (const target of targetChunks) {
    const key = reuseKey(target.type, target.text, target.sectionPaths);
    const queue = available.get(key);
    const reusable = queue?.shift();
    if (reusable) reusableByTargetIndex.set(target.index, reusable);
    else chunksToEmbed.push(target);
  }

  return { reusableByTargetIndex, chunksToEmbed };
}

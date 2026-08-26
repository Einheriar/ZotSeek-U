/** Pure prefix preparation shared by local and server inference paths. */

export interface WorkerInputConfig {
  queryPrefix: string;
  docPrefix: string;
}

export function prepareWorkerInput(
  text: string,
  kind: 'query' | 'doc',
  config: WorkerInputConfig,
): string {
  const prefix = kind === 'query' ? config.queryPrefix : config.docPrefix;
  // Do not alter the source text here. Local Transformers.js tokenizers apply
  // their model_max_length automatically; server limits are server-managed.
  return prefix ? prefix + text : text;
}

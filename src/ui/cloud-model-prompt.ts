/** Small prompt adapters for Cloud consent and password-style BYOK entry. */

export interface PromptServiceLike {
  confirm(parent: unknown, title: string, message: string): boolean;
  promptPassword(
    parent: unknown,
    title: string,
    message: string,
    value: { value: string },
    checkMessage: string | null,
    checkState: { value: boolean } | null,
  ): boolean;
}

export function confirmCloudDisclosure(
  prompt: PromptServiceLike,
  parent: unknown,
  title: string,
  message: string,
): boolean {
  return prompt.confirm(parent, title, message);
}

export function promptForCloudApiKey(
  prompt: PromptServiceLike,
  parent: unknown,
  title: string,
  message: string,
): string | null {
  const value = { value: '' };
  const accepted = prompt.promptPassword(parent, title, message, value, null, null);
  if (!accepted) return null;
  const apiKey = value.value.trim();
  return apiKey || null;
}

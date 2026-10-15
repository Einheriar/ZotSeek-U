/** Keep the last connection test visible only for the configuration it tested. */
export type BriefConnectionPhase = 'testing' | 'verified' | 'failed';

interface ConnectionContext {
  provider: string;
  baseUrl: string;
  config: { fingerprint: string; revision: number };
}

export function briefConnectionContext(status: ConnectionContext, credentialRevision: number): string {
  return JSON.stringify([
    status.provider, status.baseUrl, status.config.fingerprint,
    status.config.revision, credentialRevision,
  ]);
}

export class BriefConnectionFeedback {
  private attempt = 0;
  private feedback: { context: string; phase: BriefConnectionPhase; message: string } | null = null;

  begin(context: string, message: string): number {
    this.feedback = { context, phase: 'testing', message };
    return ++this.attempt;
  }

  finish(attempt: number, phase: 'verified' | 'failed', message: string): void {
    // A late completion must not replace a newer test's feedback.
    if (attempt === this.attempt && this.feedback) {
      this.feedback = { ...this.feedback, phase, message };
    }
  }

  read(context: string, verified: boolean): { phase: BriefConnectionPhase; message: string } | null {
    const feedback = this.feedback;
    if (!feedback || feedback.context !== context) return null;
    // Verification remains owned by the service, including changes in another window.
    if (feedback.phase === 'verified' && !verified) return null;
    if (feedback.phase === 'failed' && verified) return null;
    return feedback;
  }
}

export function renderBriefConnectionStatus(
  node: any, message: string, phase?: BriefConnectionPhase,
): void {
  if (!node) return;
  if (node.namespaceURI === 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul') {
    node.textContent = '';
    node.setAttribute('value', message);
  } else node.textContent = message;
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('data-connection-state', phase || 'idle');
  node.style.color = phase === 'failed'
    ? 'var(--zotseek-red, #c23b32)'
    : phase === 'verified'
      ? 'var(--zotseek-green, #237a45)'
      : phase === 'testing'
        ? 'var(--zotseek-blue, #2b6bcc)'
        : 'var(--zotseek-text-secondary, #77809a)';
}

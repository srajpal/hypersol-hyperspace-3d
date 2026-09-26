import { LitElement, css, html, nothing } from 'lit';
import type { ShellBridge } from '../../shared/commands';
import type { DownloadInfo, DownloadOp, DownloadRequest } from '../../shared/downloads';
import { formatBytes } from '../inspect-format';
import { panelStyles } from './panel-styles';
import './controls';

/**
 * The Downloads panel (milestone 8): this session's downloads, newest
 * first, with progress, open, show in folder, cancel, and clearing the
 * list. Files go straight to the Downloads folder. Escape closes it.
 *
 * Events: hs-panel-closed.
 */
export class HsDownloads extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    items: { attribute: false },
    message: { state: true },
  };

  declare open: boolean;
  declare items: DownloadInfo[];
  declare message: string;
  bridge: ShellBridge | null = null;

  constructor() {
    super();
    this.open = false;
    this.items = [];
    this.message = '';
  }

  static override styles = [
    panelStyles,
    css`
      ul {
        flex: 1;
        overflow: auto;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 2px;
        border-bottom: 1px solid color-mix(in srgb, var(--hs-accent) 15%, transparent);
      }
      .name {
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .detail {
        font-family: var(--hs-font-mono);
        font-size: 12px;
        color: var(--hs-text-muted);
      }
      .row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .top {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
    `,
  ];

  show(): void {
    this.open = true;
    this.message = '';
    void this.refresh();
    void this.updateComplete.then(() => (this.renderRoot.querySelector('button') as HTMLElement | null)?.focus());
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('hs-panel-closed', { bubbles: true, composed: true }));
  }

  async refresh(): Promise<void> {
    const list = await this.ask({ op: 'downloads.list' });
    if (list) this.items = list;
  }

  override render() {
    const newest = [...this.items].reverse();
    return html`<section role="dialog" aria-label="Downloads" data-testid="downloads" @keydown=${this.onKey}>
      <header>
        <h2>Downloads</h2>
        <button class="icon-button" aria-label="Close Downloads" data-testid="downloads-close" @click=${() => this.close()}>×</button>
      </header>
      <div class="top">
        <button data-testid="downloads-clear" ?disabled=${!this.items.some((d) => d.finished)} @click=${() => void this.act({ op: 'downloads.clear' })}>
          Clear list
        </button>
      </div>
      ${newest.length === 0 ? html`<p class="empty" data-testid="downloads-empty">No downloads yet</p><p class="muted">Files you download are saved to your Downloads folder.</p>` : nothing}
      <ul data-testid="downloads-list">
        ${newest.map((d) => this.item(d))}
      </ul>
      ${this.message ? html`<p class="error" role="alert">${this.message}</p>` : nothing}
    </section>`;
  }

  private item(d: DownloadInfo) {
    const size = d.total > 0 ? `${formatBytes(d.received)} of ${formatBytes(d.total)}` : formatBytes(d.received);
    const state =
      d.state === 'completed'
        ? `Done · ${formatBytes(d.received)}`
        : d.state === 'cancelled'
          ? 'Cancelled'
          : d.state === 'interrupted'
            ? d.finished
              ? 'Stopped'
              : `Paused · ${size}` // interrupted, can still resume
            : size;
    return html`<li data-testid="download" data-state=${d.state}>
      <span class="name">${d.filename}</span>
      ${d.state === 'progressing'
        ? html`<hs-meter label="Saving" .fraction=${d.total > 0 ? d.received / d.total : 0} .display=${size}></hs-meter>`
        : html`<span class="detail">${state}</span>`}
      <div class="row">
        ${d.state === 'completed' ? html`<button data-testid="download-open" @click=${() => void this.act({ op: 'downloads.open', id: d.id })}>Open</button>` : nothing}
        ${d.state === 'completed' ? html`<button data-testid="download-show" @click=${() => void this.act({ op: 'downloads.show', id: d.id })}>Show in folder</button>` : nothing}
        ${!d.finished ? html`<button class="danger" data-testid="download-cancel" @click=${() => void this.act({ op: 'downloads.cancel', id: d.id })}>Cancel</button>` : nothing}
      </div>
    </li>`;
  }

  private async act(request: DownloadRequest): Promise<void> {
    this.message = '';
    await this.ask(request as Extract<DownloadRequest, { op: DownloadOp }>);
    await this.refresh();
  }

  private async ask<K extends DownloadOp>(request: Extract<DownloadRequest, { op: K }>): Promise<DownloadInfo[] | null> {
    if (!this.bridge) return null;
    const reply = await this.bridge.downloads(request).catch((e: unknown) => ({ ok: false as const, error: String(e) }));
    if (!reply.ok) {
      this.message = reply.error;
      return null;
    }
    return Array.isArray(reply.value) ? (reply.value as DownloadInfo[]) : null;
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
    }
  };
}

customElements.define('hs-downloads', HsDownloads);

declare global {
  interface HTMLElementTagNameMap {
    'hs-downloads': HsDownloads;
  }
}

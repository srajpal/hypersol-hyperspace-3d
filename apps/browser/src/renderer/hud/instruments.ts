import { LitElement, css, html, nothing } from 'lit';
import type { BrowserReadout, ConsoleEntry, NetEntry, PageReadout, SceneReadout } from '../../shared/inspect';
import type { ConsoleFilter } from '../../shared/settings';
import {
  filterNet,
  formatBytes,
  formatMs,
  fraction,
  levelShown,
  netKind,
  netStatus,
  shortName,
  type NetKind,
} from '../inspect-format';
import './controls';

export interface InstrumentParts {
  readouts: boolean;
  gauges: boolean;
  console: boolean;
  network: boolean;
}

export interface BrowserGauges {
  tabs: number;
  /** Frames the 3D room drew in the last second (0 while nothing moves). */
  fps: number;
  filtersAge: string;
  dns: string;
  clock: string;
  uptime: string;
}

/** Widths the page gives up while the panels show (the room lays the page out around them). */
export const RIGHT_COLUMN = 300;
export const BOTTOM_STRIP = 206;

const LEVEL_TAGS = { error: 'ERR', warning: 'WARN', info: 'INFO', debug: 'DBG' } as const;

const KINDS: { kind: NetKind; label: string }[] = [
  { kind: 'all', label: 'All' },
  { kind: 'doc', label: 'Doc' },
  { kind: 'script', label: 'JS' },
  { kind: 'style', label: 'CSS' },
  { kind: 'image', label: 'Img' },
  { kind: 'xhr', label: 'XHR' },
  { kind: 'other', label: 'Other' },
];

/**
 * The instrument panel (milestone 7): floating glass panels along the
 * right side (the page's readouts, the browser's gauges) and the bottom
 * (the page's console and network list). The shell's controller
 * (renderer/instruments.ts) fills in the data.
 *
 * With a HoloML page in front, the right column also has a Scene part
 * (milestone 15): the scene's objects as a tree, the selected one's facts,
 * and the page's problems.
 *
 * Events: hs-inspect-devtools, hs-inspect-clear, hs-console-level (detail: ConsoleFilter),
 * hs-scene-select (detail: entry index), hs-scene-pick (detail: boolean).
 */
export class HsInstruments extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    parts: { attribute: false },
    consoleLevel: { type: String },
    railShown: { type: Boolean },
    page: { attribute: false },
    scene: { attribute: false },
    host: { type: String },
    net: { attribute: false },
    consoleEntries: { attribute: false },
    browser: { attribute: false },
    gauges: { attribute: false },
    netKind: { state: true },
    netText: { state: true },
    consoleText: { state: true },
    maximized: { type: String, reflect: true },
  };

  declare open: boolean;
  declare parts: InstrumentParts;
  declare consoleLevel: ConsoleFilter;
  /** The tab rail is showing on the left: the bottom strip starts after it. */
  declare railShown: boolean;
  declare page: PageReadout | null;
  /** The HoloML page's scene, or null for other pages. */
  declare scene: SceneReadout | null;
  declare host: string;
  declare net: NetEntry[];
  declare consoleEntries: ConsoleEntry[];
  declare browser: BrowserReadout | null;
  declare gauges: BrowserGauges;
  declare netKind: NetKind;
  declare netText: string;
  declare consoleText: string;
  /** The console or network list shown large, for reading (owner, prompt 36); '' for neither. */
  declare maximized: '' | 'console' | 'network';

  constructor() {
    super();
    this.open = false;
    this.parts = { readouts: true, gauges: true, console: true, network: true };
    this.consoleLevel = 'all';
    this.railShown = false;
    this.page = null;
    this.scene = null;
    this.host = '';
    this.net = [];
    this.consoleEntries = [];
    this.browser = null;
    this.gauges = { tabs: 0, fps: 0, filtersAge: '', dns: '', clock: '', uptime: '' };
    this.netKind = 'all';
    this.netText = '';
    this.consoleText = '';
    this.maximized = '';
  }

  /** Shows the console or the network list large, or back in the strip. */
  maximize(which: '' | 'console' | 'network'): void {
    this.maximized = which;
    void this.updateComplete.then(() =>
      (this.renderRoot.querySelector(which ? '.max [data-max]' : '[data-max]') as HTMLElement | null)?.focus(),
    );
  }

  /** Space the page must leave free, in CSS pixels. */
  get insets(): { right: number; bottom: number } {
    if (!this.open) return { right: 0, bottom: 0 };
    return {
      right: this.parts.readouts || this.parts.gauges ? RIGHT_COLUMN + 16 : 0,
      bottom: this.parts.console || this.parts.network ? BOTTOM_STRIP + 12 : 0,
    };
  }

  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 12;
      pointer-events: none;
      display: none;
      color: var(--hs-text);
      font-size: 12px;
      /* Drift with the room's parallax (set by the controller), so the panels float. */
      --hs-drift-x: 0;
      --hs-drift-y: 0;
    }
    :host([open]) {
      display: block;
    }
    .panel {
      position: absolute;
      box-sizing: border-box;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 45%, transparent);
      background: color-mix(in srgb, var(--hs-panel-glass) 86%, transparent);
      box-shadow:
        0 14px 40px var(--hs-shadow),
        0 0 calc(24px * var(--hs-glow-strength)) color-mix(in srgb, var(--hs-accent) 22%, transparent),
        inset 0 1px 0 color-mix(in srgb, var(--hs-text) 12%, transparent);
      backdrop-filter: blur(6px);
    }
    .column {
      position: absolute;
      top: 72px;
      right: 20px;
      bottom: 72px;
      width: ${RIGHT_COLUMN}px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      /* Leans in toward the page, like a panel mounted at the side of the room. */
      transform: perspective(1400px) translate(calc(var(--hs-drift-x) * -6px), calc(var(--hs-drift-y) * 4px)) rotateY(-9deg);
      transform-origin: right center;
    }
    .column .panel {
      position: relative;
      flex: 0 1 auto;
      min-height: 0;
      overflow: auto;
    }
    .strip {
      position: absolute;
      bottom: 14px;
      height: ${BOTTOM_STRIP}px;
      display: flex;
      gap: 12px;
      pointer-events: none;
      /* Tilts back like a desk console under the page. */
      transform: perspective(1400px) translate(calc(var(--hs-drift-x) * -4px), calc(var(--hs-drift-y) * 3px)) rotateX(8deg);
      transform-origin: center bottom;
    }
    .strip .panel {
      position: relative;
      flex: 1 1 0;
      min-width: 0;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
    }
    h2 {
      margin: 0;
      flex: 1;
      font-family: var(--hs-font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--hs-accent);
    }
    .host {
      font-family: var(--hs-font-mono);
      color: var(--hs-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 140px;
    }
    .dials {
      display: flex;
      justify-content: space-around;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .grid .wide {
      grid-column: 1 / -1;
    }
    .meters {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    button,
    input,
    select {
      font: inherit;
      font-family: var(--hs-font-mono);
      font-size: 11px;
      color: inherit;
    }
    button,
    select {
      cursor: pointer;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 50%, transparent);
      background: transparent;
    }
    select {
      background: var(--hs-panel-glass);
    }
    button:hover {
      background: color-mix(in srgb, var(--hs-accent) 16%, transparent);
    }
    button[aria-pressed='true'] {
      background: color-mix(in srgb, var(--hs-accent) 26%, transparent);
      color: var(--hs-accent);
    }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--hs-accent);
      outline-offset: 1px;
    }
    input {
      /* In a narrow panel the controls wrap to a second line rather than
         run under the next panel (a 1024-pixel screen, milestone 12). */
      min-width: 0;
      flex: 1 1 64px;
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, var(--hs-accent) 30%, transparent);
      background: color-mix(in srgb, var(--hs-background-bottom) 55%, transparent);
    }
    .chips {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .log {
      flex: 1;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      margin: 0;
      padding: 0;
      list-style: none;
      font-family: var(--hs-font-mono);
      font-size: 11px;
      border-top: 1px solid color-mix(in srgb, var(--hs-accent) 20%, transparent);
    }
    .log li {
      display: grid;
      gap: 8px;
      padding: 2px 2px;
      border-bottom: 1px solid color-mix(in srgb, var(--hs-accent) 10%, transparent);
    }
    .console li {
      grid-template-columns: 58px 44px 1fr;
    }
    .net li {
      grid-template-columns: 52px 40px minmax(0, 1fr) 56px 50px;
    }
    .log span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .muted {
      color: var(--hs-text-muted);
    }
    [data-level='error'],
    [data-state='bad'] {
      color: var(--hs-warning);
    }
    [data-level='warning'],
    [data-state='blocked'] {
      color: var(--hs-accent2);
    }
    [data-level='debug'] {
      color: var(--hs-text-muted);
    }
    .source {
      grid-column: 3;
      color: var(--hs-text-muted);
    }
    footer {
      font-family: var(--hs-font-mono);
      font-size: 11px;
      color: var(--hs-text-muted);
    }
    .empty {
      margin: 6px 0;
      color: var(--hs-text-muted);
    }
    /* A panel shown large: flat, over the room and the page, for reading. */
    .max {
      position: fixed;
      inset: 72px 24px 70px 24px;
      z-index: 2;
      font-size: 13px;
    }
    .max .panel {
      position: absolute;
      inset: 0;
    }
    .max .log {
      font-size: 12px;
    }
    .max .net li {
      grid-template-columns: 70px 56px 56px minmax(0, 1fr) 80px 70px;
    }
    .max .console li {
      grid-template-columns: 70px 50px 1fr;
    }
    .max .console .message {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .max .log span.url {
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1;
      pointer-events: auto;
      background: color-mix(in srgb, var(--hs-background-bottom) 55%, transparent);
    }
    .max-button {
      width: 26px;
      padding: 2px 0;
    }
    /* The Scene part comes first for room: the page and browser panels scroll instead. */
    .column .scene {
      flex: 3 1 0;
      min-height: 340px;
      overflow: hidden;
    }
    .scene .tree {
      flex: 1 1 0;
      min-height: 48px;
    }
    .tree li {
      display: block;
      padding: 0;
    }
    .tree button {
      display: block;
      width: 100%;
      text-align: left;
      border: 0;
      border-radius: 4px;
      padding: 1px 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tree button[aria-current='true'] {
      background: color-mix(in srgb, var(--hs-accent) 26%, transparent);
      color: var(--hs-accent);
    }
    .detail,
    .problems {
      margin: 0;
      font-family: var(--hs-font-mono);
      font-size: 11px;
      max-height: 34%;
      overflow: auto;
      flex: 0 0 auto;
    }
    .detail dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 1px 8px;
      margin: 4px 0 0;
    }
    .detail dt {
      color: var(--hs-text-muted);
    }
    .detail dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .detail code {
      display: block;
      white-space: pre;
      overflow-x: auto;
      padding: 2px 4px;
      border-radius: 4px;
      background: color-mix(in srgb, var(--hs-background-bottom) 55%, transparent);
    }
    .problems ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .problems li {
      padding: 1px 0;
      color: var(--hs-warning);
    }
  `;

  override updated(): void {
    // Keep the newest console lines in view.
    const log = this.renderRoot.querySelector('.console');
    if (log) log.scrollTop = log.scrollHeight;
  }

  override render() {
    if (!this.open) return nothing;
    const { readouts, gauges, console: showConsole, network } = this.parts;
    const stripLeft = this.railShown ? 216 : 24;
    const stripRight = readouts || gauges ? RIGHT_COLUMN + 36 : 170;
    const max = this.maximized;
    return html`
      ${max
        ? html`<div class="backdrop" @click=${() => this.maximize('')}></div>
            <div class="max" @keydown=${this.onMaxKey}>${max === 'console' ? this.consolePanel(true) : this.networkPanel(true)}</div>`
        : nothing}
      ${readouts || gauges
        ? html`<div class="column" data-testid="inst-column">
            ${readouts ? this.pagePanel() : nothing} ${readouts && this.scene ? this.scenePanel(this.scene) : nothing}
            ${gauges ? this.browserPanel() : nothing}
          </div>`
        : nothing}
      ${showConsole || network
        ? html`<div class="strip" data-testid="inst-strip" style=${`left:${stripLeft}px;right:${stripRight}px`}>
            ${showConsole ? this.consolePanel() : nothing} ${network ? this.networkPanel() : nothing}
          </div>`
        : nothing}
    `;
  }

  private pagePanel() {
    const p = this.page;
    const expiry = p?.cert ? new Date(p.cert.validExpiry * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    return html`<section class="panel" aria-label="Page readouts" data-testid="inst-page">
      <header>
        <h2>Page</h2>
        <span class="host">${this.host}</span>
        <button data-testid="inst-devtools" ?disabled=${!p} @click=${() => this.fire('hs-inspect-devtools')}>DevTools</button>
      </header>
      ${p
        ? html`<div class="dials">
              <hs-dial data-testid="inst-load" label="Load" unit="sec" .value=${p.loadMs < 0 ? 0 : p.loadMs / 1000} .max=${10}
                .display=${p.loadMs < 0 ? '…' : (p.loadMs / 1000).toFixed(1)}></hs-dial>
              <hs-dial data-testid="inst-requests" label="Requests" unit="req" .value=${p.requests} .max=${200}></hs-dial>
              <hs-dial data-testid="inst-blocked" label="Blocked" unit="req" .value=${p.blocked} .max=${50}></hs-dial>
            </div>
            <div class="meters">
              <hs-meter label="Data" .fraction=${fraction(p.bytes, 10 * 1024 * 1024)} .display=${formatBytes(p.bytes)}></hs-meter>
              <hs-meter label="CPU" .fraction=${fraction(p.cpuPercent, 100)} .display=${`${p.cpuPercent.toFixed(1)}%`}></hs-meter>
              <hs-meter label="Memory" .fraction=${fraction(p.memoryKB, 1024 * 1024)} .display=${formatBytes(p.memoryKB * 1024)}></hs-meter>
            </div>
            <div class="grid">
              <hs-lcd data-testid="inst-secure" label="Connection" .value=${p.secure ? 'SECURE' : 'NOT SECURE'} tone=${p.secure ? 'good' : 'warn'}></hs-lcd>
              <hs-lcd data-testid="inst-failed" label="Failed" .value=${String(p.failed)} tone=${p.failed > 0 ? 'warn' : 'normal'}></hs-lcd>
              ${p.cert
                ? html`<hs-lcd class="wide" data-testid="inst-cert" label="Certificate issuer" .value=${p.cert.issuer}></hs-lcd>
                    <hs-lcd data-testid="inst-expiry" label="Expires" .value=${expiry}></hs-lcd>
                    <hs-lcd data-testid="inst-verified" label="Verified" .value=${p.cert.verification} tone=${p.cert.verification === 'OK' ? 'good' : 'warn'}></hs-lcd>`
                : nothing}
            </div>`
        : html`<p class="empty">No web page in this tab.</p>`}
    </section>`;
  }

  private scenePanel(s: SceneReadout) {
    const d = s.detail;
    const num = (v: number[]) => v.map((n) => (Math.abs(n) >= 1000 ? n.toFixed(0) : n.toFixed(2))).join(', ');
    const deg = (v: number[]) => v.map((n) => `${Math.round(n)}°`).join(', ');
    const stateName = (st: string) => (st === 'left-out' ? 'left out' : st);
    // What went wrong, each at its place in the page's text.
    const trouble = [
      ...(s.error ? [{ at: `${s.error.line}:${s.error.column}`, text: `${s.error.code}: ${s.error.message}` }] : []),
      ...s.problems.map((p) => ({ at: `${p.line}:${p.column}`, text: `${p.code}: ${p.message}` })),
      ...s.entries
        .filter((e) => e.state === 'failed' || e.state === 'left-out' || e.state === 'refused')
        .map((e) => ({ at: `${e.line}:${e.column}`, text: `${e.kind} ${e.name} ${stateName(e.state ?? '')}${e.reason ? `: ${e.reason}` : ''}` })),
      ...(s.leftOutElements > 0 ? [{ at: '', text: `${s.leftOutElements.toLocaleString()} elements left out (limit 10,000)` }] : []),
    ];
    return html`<section class="panel scene" aria-label="Scene" data-testid="inst-scene">
      <header>
        <h2>Scene</h2>
        <span class="host" data-testid="inst-scene-totals">${formatBytes(s.totals.bytes)} · ${s.totals.triangles.toLocaleString()} tri</span>
        <button data-testid="inst-scene-pick" aria-pressed=${s.picking ? 'true' : 'false'}
          title="Pick: a click in the scene selects an object instead of following a link"
          @click=${() => this.fire('hs-scene-pick', !s.picking)}>Pick</button>
      </header>
      <ul class="log tree" data-testid="inst-scene-tree" aria-label="Scene objects" @keydown=${this.onTreeKey}>
        ${s.entries.map(
          (e) => html`<li>
            <button data-index=${e.index} aria-current=${e.index === s.selected ? 'true' : 'false'}
              style=${`padding-left:${4 + Math.min(e.depth, 12) * 10}px`}
              @click=${() => this.fire('hs-scene-select', e.index)}>${e.kind}${e.name ? html` <span class="muted">${e.name}</span>` : nothing}${e.state && e.state !== 'loaded'
                ? html` <span data-state="bad">(${stateName(e.state)})</span>`
                : nothing}</button>
          </li>`,
        )}
        ${s.entryCount > s.entries.length ? html`<li class="muted">and ${(s.entryCount - s.entries.length).toLocaleString()} more</li>` : nothing}
      </ul>
      ${d
        ? html`<div class="detail" data-testid="inst-scene-detail">
            <div>Line ${d.line}, column ${d.column}</div>
            <code data-testid="inst-scene-source">${d.source}</code>
            <dl>
              ${d.bounds ? html`<dt>Bounds</dt><dd data-testid="inst-scene-bounds">${num(d.bounds[0])} to ${num(d.bounds[1])}</dd>` : nothing}
              <dt>Position</dt><dd data-testid="inst-scene-position">${num(d.position)}</dd>
              <dt>Rotation</dt><dd>${deg(d.rotation)}</dd>
              <dt>Scale</dt><dd>${num(d.scale)}</dd>
              ${d.triangles !== null ? html`<dt>Triangles</dt><dd data-testid="inst-scene-triangles">${d.triangles.toLocaleString()}</dd>` : nothing}
              ${d.pictures.length ? html`<dt>Pictures</dt><dd>${d.pictures.map((p) => `${p.width}×${p.height}`).join(', ')}</dd>` : nothing}
            </dl>
          </div>`
        : html`<p class="empty">Select an object, or Pick one in the scene.</p>`}
      <div class="problems" data-testid="inst-scene-problems">
        ${trouble.length
          ? html`<ul>
              ${trouble.map((t) => html`<li>${t.at ? html`<span class="muted">${t.at}</span> ` : nothing}${t.text}</li>`)}
            </ul>`
          : html`<span class="muted">No problems.</span>`}
      </div>
    </section>`;
  }

  /** Up and down (and Home, End) move through the tree's objects, selecting as they go. */
  private readonly onTreeKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const buttons = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button[data-index]')];
    if (buttons.length === 0) return;
    const at = buttons.indexOf(e.composedPath()[0] as HTMLButtonElement);
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
    e.preventDefault();
    e.stopPropagation();
    const target = buttons[next]!;
    target.focus();
    this.fire('hs-scene-select', Number(target.dataset['index']));
  };

  private browserPanel() {
    const b = this.browser;
    const g = this.gauges;
    return html`<section class="panel" aria-label="Browser gauges" data-testid="inst-browser">
      <header><h2>Browser</h2><span class="host" data-testid="inst-clock">${g.clock}</span></header>
      <div class="dials">
        <hs-dial data-testid="inst-tabs" label="Tabs" unit="open" .value=${g.tabs} .max=${20}></hs-dial>
        <hs-dial data-testid="inst-memory" label="Memory" unit="MB" .value=${b ? b.memoryKB / 1024 : 0} .max=${4096}></hs-dial>
        <hs-dial data-testid="inst-fps" label="3D frames" unit="per s" .value=${g.fps} .max=${60}></hs-dial>
      </div>
      <div class="grid">
        <hs-lcd data-testid="inst-dns" label="Encrypted DNS" .value=${g.dns}></hs-lcd>
        <hs-lcd data-testid="inst-lists" label="Filter lists" .value=${g.filtersAge}></hs-lcd>
        <hs-lcd label="CPU (all)" .value=${b ? `${b.cpuPercent.toFixed(1)}%` : ''}></hs-lcd>
        <hs-lcd label="Up" .value=${g.uptime}></hs-lcd>
      </div>
    </section>`;
  }

  private maxButton(which: 'console' | 'network', big: boolean) {
    const name = which === 'console' ? 'console' : 'network list';
    const label = big ? `Shrink the ${name}` : `Maximize the ${name}`;
    return html`<button class="max-button" data-max data-testid=${`inst-max-${which}`} aria-label=${label} title=${label}
      aria-pressed=${big ? 'true' : 'false'} @click=${() => this.maximize(big ? '' : which)}>${big ? '⤡' : '⤢'}</button>`;
  }

  private readonly onMaxKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.maximize('');
    }
  };

  private consolePanel(big = false) {
    const q = this.consoleText.trim().toLowerCase();
    const shown = this.consoleEntries.filter(
      (e) => levelShown(this.consoleLevel, e.level) && (q === '' || e.message.toLowerCase().includes(q)),
    );
    return html`<section class="panel" aria-label="Console" data-testid=${big ? 'inst-console-max' : 'inst-console'}>
      <header>
        <h2>Console</h2>
        <input aria-label="Filter the console" placeholder="Filter" .value=${this.consoleText}
          @input=${(e: Event) => (this.consoleText = (e.target as HTMLInputElement).value)} />
        <select aria-label="Messages to show" data-testid="inst-level" .value=${this.consoleLevel}
          @change=${(e: Event) => this.fire('hs-console-level', (e.target as HTMLSelectElement).value)}>
          <option value="all">All</option>
          <option value="warnings">Warnings</option>
          <option value="errors">Errors</option>
        </select>
        <button data-testid="inst-clear" @click=${() => this.fire('hs-inspect-clear')}>Clear</button>
        ${this.maxButton('console', big)}
      </header>
      <ul class="log console" data-testid=${big ? 'inst-console-list-max' : 'inst-console-list'}>
        ${shown.map(
          (e) => html`<li data-level=${e.level}>
            <span class="muted">${new Date(e.at).toLocaleTimeString(undefined, { hour12: false })}</span>
            <span data-level=${e.level}>${LEVEL_TAGS[e.level]}</span>
            <span class="message" title=${e.message}>${e.message}</span>
            ${e.source ? html`<span class="source">${shortName(e.source)}:${e.line}</span>` : nothing}
          </li>`,
        )}
      </ul>
      ${shown.length === 0 ? html`<p class="empty">No messages.</p>` : nothing}
    </section>`;
  }

  private networkPanel(big = false) {
    const rows = filterNet(this.net, this.netKind, this.netText);
    const bytes = rows.reduce((s, e) => s + Math.max(0, e.bytes), 0);
    const blocked = rows.filter((e) => e.blocked).length;
    return html`<section class="panel" aria-label="Network" data-testid=${big ? 'inst-network-max' : 'inst-network'}>
      <header>
        <h2>Network</h2>
        <input aria-label="Filter requests" placeholder="Filter" data-testid="inst-net-filter" .value=${this.netText}
          @input=${(e: Event) => (this.netText = (e.target as HTMLInputElement).value)} />
        ${this.maxButton('network', big)}
      </header>
      <div class="chips" role="group" aria-label="Request types">
        ${KINDS.map(
          (k) => html`<button data-testid=${`inst-kind-${k.kind}`} aria-pressed=${this.netKind === k.kind ? 'true' : 'false'}
            @click=${() => (this.netKind = k.kind)}>${k.label}</button>`,
        )}
      </div>
      <ul class="log net" data-testid=${big ? 'inst-net-list-max' : 'inst-net-list'}>
        ${rows.map(
          (e) => html`<li>
            <span data-state=${e.blocked ? 'blocked' : e.error || e.status >= 400 ? 'bad' : ''}>${netStatus(e)}</span>
            <span class="muted">${netKind(e.type)}</span>
            ${big ? html`<span class="muted">${e.method}</span><span class="url">${e.url}</span>` : html`<span title=${e.url}>${shortName(e.url)}</span>`}
            <span class="muted">${e.fromCache ? 'cache' : formatBytes(e.bytes)}</span>
            <span class="muted">${formatMs(e.ms)}</span>
          </li>`,
        )}
      </ul>
      <footer data-testid="inst-net-totals">${rows.length} requests · ${formatBytes(bytes)} · ${blocked} blocked</footer>
    </section>`;
  }

  private fire(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

customElements.define('hs-instruments', HsInstruments);

declare global {
  interface HTMLElementTagNameMap {
    'hs-instruments': HsInstruments;
  }
}

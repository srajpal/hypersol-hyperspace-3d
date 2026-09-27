import type { Bookmark, HistoryEntry } from '../../shared/data';
import { EXAMPLES, exampleUrl } from '../examples';

export interface StartData {
  bookmarks: Bookmark[];
  recent: HistoryEntry[];
  /** Set when saved data cannot be read. */
  unavailable?: string;
}

const MAX_BOOKMARKS = 12;
const MAX_RECENT = 8;

/**
 * The new-tab start panel: a search box, then a grid of bookmarks and a
 * list of recent history, each with an empty state, and links to try
 * HoloML's example sites (milestones 16 and 17), which are published from
 * the holoml repository; only a click opens one, and the panel itself asks
 * nothing of the network.
 */
export class StartPanel {
  readonly element: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly bookmarks: HTMLElement;
  private readonly recent: HTMLElement;

  constructor(
    onSubmit: (text: string) => void,
    private readonly onOpen: (url: string) => void,
    onExamples: () => void = () => undefined,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'hs-start';
    this.element.dataset['testid'] = 'start-panel';

    const title = document.createElement('h1');
    title.textContent = 'HyperSpace 3D';

    const form = document.createElement('form');
    form.className = 'hs-start-search';
    form.setAttribute('role', 'search');
    this.input = document.createElement('input');
    this.input.type = 'search';
    this.input.placeholder = 'Search the web or type an address';
    this.input.setAttribute('aria-label', 'Search the web or type an address');
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    this.input.dataset['testid'] = 'start-search';
    form.append(this.input);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = this.input.value.trim();
      if (text !== '') onSubmit(text);
    });

    this.bookmarks = section('Bookmarks', 'start-bookmarks');
    this.recent = section('Recent', 'start-recent');
    const holoml = section('Try HoloML', 'start-holoml');
    const rows = EXAMPLES.map((ex) => {
      const row = this.link(exampleUrl(ex.id), ex.row, 'hs-start-row');
      row.dataset['testid'] = ex.id === 'showroom' ? 'start-showroom' : `start-example-${ex.id}`;
      return row;
    });
    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'hs-start-row';
    all.dataset['testid'] = 'start-examples';
    const label = document.createElement('span');
    label.className = 'hs-start-label';
    label.textContent = 'All HoloML examples, with pictures…';
    all.append(label);
    all.addEventListener('click', () => onExamples());
    holoml.append(...rows, all);
    this.element.append(title, form, this.bookmarks, this.recent, holoml);
    this.setData({ bookmarks: [], recent: [] });
  }

  focus(): void {
    this.input.focus();
  }

  setData(data: StartData): void {
    const bookmarkBody = data.unavailable
      ? [message(data.unavailable, 'Browsing still works; nothing new is saved for now.')]
      : data.bookmarks.length === 0
        ? [message('Nothing saved yet', 'Pages you bookmark will show up here.')]
        : [this.grid(data.bookmarks.slice(0, MAX_BOOKMARKS))];
    this.bookmarks.replaceChildren(this.bookmarks.firstElementChild!, ...bookmarkBody);

    const recentBody = data.unavailable
      ? []
      : data.recent.length === 0
        ? [message('Nothing saved yet', 'Pages you visit will show up here.')]
        : [this.list(data.recent.slice(0, MAX_RECENT))];
    this.recent.replaceChildren(this.recent.firstElementChild!, ...recentBody);
    this.recent.hidden = Boolean(data.unavailable);
  }

  private grid(bookmarks: Bookmark[]): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'hs-start-grid';
    for (const b of bookmarks) {
      const tile = this.link(b.url, b.title, 'hs-start-tile');
      const icon = document.createElement(b.favicon ? 'img' : 'span');
      icon.className = 'hs-start-icon';
      if (b.favicon) (icon as HTMLImageElement).src = b.favicon;
      icon.setAttribute('aria-hidden', 'true');
      if (!b.favicon) icon.textContent = (b.title.trim()[0] ?? '·').toUpperCase();
      tile.prepend(icon);
      grid.append(tile);
    }
    return grid;
  }

  private list(entries: HistoryEntry[]): HTMLElement {
    const ul = document.createElement('ul');
    ul.className = 'hs-start-list';
    for (const h of entries) {
      const li = document.createElement('li');
      li.append(this.link(h.url, h.title, 'hs-start-row'));
      ul.append(li);
    }
    return ul;
  }

  private link(url: string, title: string, className: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.title = url;
    b.dataset['url'] = url;
    const label = document.createElement('span');
    label.className = 'hs-start-label';
    label.textContent = title || url;
    b.append(label);
    b.addEventListener('click', () => this.onOpen(url));
    return b;
  }
}

function section(name: string, testId: string): HTMLElement {
  const el = document.createElement('section');
  el.className = 'hs-start-section';
  el.dataset['testid'] = testId;
  const heading = document.createElement('h2');
  heading.textContent = name;
  el.append(heading);
  return el;
}

function message(text: string, hint: string): HTMLElement {
  const box = document.createElement('div');
  const main = document.createElement('p');
  main.className = 'hs-empty';
  main.textContent = text;
  const small = document.createElement('p');
  small.className = 'hs-empty-hint';
  small.textContent = hint;
  box.append(main, small);
  return box;
}

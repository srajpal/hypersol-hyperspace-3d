import type { RoomView } from '../../browser/src/renderer/scene/room';

/**
 * A tab's place in the room on Android (milestone 24). The desktop puts a
 * Chromium view there; here the room places this element, and the app
 * draws the tab's real page over the outline the room gives it. The
 * element shows what the room itself draws for the tab: a start tab's
 * panel, and otherwise the page's last picture, seen while a menu covers
 * the page and the app hides it.
 */
export class StandIn implements RoomView {
  readonly element: HTMLDivElement;
  private readonly picture: HTMLImageElement;
  private content: HTMLElement | null = null;
  width = 0;
  height = 0;

  constructor(readonly tabId: number) {
    this.element = document.createElement('div');
    this.element.className = 'hs-stand-in';
    this.element.dataset['tabId'] = String(tabId);
    this.picture = document.createElement('img');
    this.picture.className = 'hs-stand-in-picture';
    this.picture.alt = '';
    this.picture.hidden = true;
    this.element.append(this.picture);
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
  }

  setInFront(on: boolean): void {
    this.element.dataset['front'] = String(on);
  }

  /** What a start tab shows: its panel (or nothing, for a tab with a page). */
  setContent(content: HTMLElement | null): void {
    if (this.content === content) return;
    this.content?.remove();
    this.content = content;
    if (content) this.element.append(content);
    this.picture.hidden = content !== null || this.picture.src === '';
  }

  /** The page's last picture, shown under the page. */
  setPicture(dataUrl: string): void {
    this.picture.src = dataUrl;
    this.picture.hidden = this.content !== null;
  }

  dispose(): void {
    this.element.remove();
  }
}

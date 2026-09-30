/**
 * A web page shown in the 3D room. There is one implementation, the live
 * panel (the browser's renderer/scene/tab-view.ts: a Chromium view placed
 * with CSS 3D transforms). A texture panel (offscreen rendering onto a 3D
 * surface) is the upgrade path, and would implement the same interface.
 * A panel tells whoever made it its status (PageStatus) as it changes.
 */

export type PageState = 'loading' | 'loaded' | 'failed' | 'crashed';

export interface PageStatus {
  state: PageState;
  url: string;
  title?: string;
  /** Plain-language reason, for failed and crashed states. */
  message?: string;
}

export interface PagePanel {
  readonly kind: 'live' | 'texture';
  /** Current size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  load(url: string): void;
  reload(): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

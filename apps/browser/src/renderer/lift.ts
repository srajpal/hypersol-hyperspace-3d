import type { ShellBridge } from '../shared/commands';
import { MAX_LIFTED, MIN_LIFT_SIDE, chooseToLift, parseLiftItem, type LiftItem } from '../shared/lift';
import type { HsNotice } from './hud/notice';
import { decodeModel } from './scene/lift-decoder';
import type { Room } from './scene/room';
import type { TabView } from './scene/tab-view';

/**
 * Lifting into the room (milestone 28; owner, prompt 198): the shell's
 * part. "Lift into the room" in a page's right-click menu lifts what was
 * clicked; the top bar's Lift button and its shortcut lift everything in
 * view (Q2 a), up to MAX_LIFTED from one page.
 *
 * A picture is captured from the page as it is drawn (Q1 a), before the
 * arc of lifted objects takes room beside the page (the page then gets
 * narrower and moves). A model is fetched by the main process from the
 * page's own site and decoded in a sandboxed frame (Q3 a); it stands in
 * its place in the arc while it comes. What cannot be lifted is said in a
 * notice, which screen readers hear, and the rest lift.
 */

export interface LiftDeps {
  bridge: ShellBridge;
  room: Room;
  notice: HsNotice;
  /** The tab in front, with its view. */
  focused(): { tabId: number; view: TabView } | null;
  view(tabId: number): TabView | undefined;
  /** The tab whose page this is, if any. */
  tabOf(webContentsId: number): number | undefined;
  /** What the top bar shows may have changed. */
  changed(): void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export class LiftController {
  constructor(private readonly deps: LiftDeps) {
    const layer = deps.room.lifted;
    if (layer) {
      layer.onPutBack = (info) => {
        layer.announce(`Put back into the page: ${info.name}`);
        deps.changed();
      };
    }
  }

  /** Why the tab in front cannot lift now, in words for the button's title; '' when it can. */
  reason(): string {
    const room = this.deps.room;
    if (!room.lifted) return room.drawsRoom ? 'not offered here' : "this computer can't draw the 3D room";
    const f = this.deps.focused();
    if (!f || f.view.isStart || f.view.webContentsId === null) return 'there is no page in this tab';
    if (f.view.isHoloml) return 'not on HoloML pages: the scene is 3D already';
    return '';
  }

  /** The top bar's button and the shortcut: everything in view, up to MAX_LIFTED from the page. */
  async liftInView(): Promise<void> {
    const reason = this.reason();
    const f = this.deps.focused();
    if (reason || !f) {
      this.say(`Nothing can be lifted: ${reason || 'there is no page in this tab'}.`, 'failed');
      return;
    }
    const layer = this.deps.room.lifted!;
    const items = await f.view.liftQuery();
    const room = MAX_LIFTED - layer.count(f.tabId);
    const chosen = chooseToLift(items, layer.liftedIds(f.tabId), room);
    if (chosen.length === 0) {
      const fresh = chooseToLift(items, layer.liftedIds(f.tabId), MAX_LIFTED);
      this.say(
        room <= 0 && fresh.length > 0
          ? `Up to ${MAX_LIFTED} things can be lifted from a page: put one back first.`
          : `Nothing more in view to lift: pictures at least ${MIN_LIFT_SIDE} pixels each way, and 3D models.`,
        'failed',
      );
      return;
    }
    await this.lift(f.tabId, f.view, chosen);
  }

  /** "Lift into the room" in a page's right-click menu: what its preload found where it was clicked. */
  async liftClicked(webContentsId: number, raw: unknown): Promise<void> {
    const tabId = this.deps.tabOf(webContentsId);
    const item = parseLiftItem(raw);
    const f = this.deps.focused();
    if (tabId === undefined || !item || !f || f.tabId !== tabId) return;
    const reason = this.reason();
    if (reason) {
      this.say(`It cannot be lifted: ${reason}.`, 'failed');
      return;
    }
    const layer = this.deps.room.lifted!;
    if (layer.liftedIds(tabId).has(item.id)) {
      this.say(`Already in the room: ${item.name}.`, 'failed');
      return;
    }
    if (layer.count(tabId) >= MAX_LIFTED) {
      this.say(`Up to ${MAX_LIFTED} things can be lifted from a page: put one back first.`, 'failed');
      return;
    }
    if (item.kind !== 'model' && (item.rect.width < MIN_LIFT_SIDE || item.rect.height < MIN_LIFT_SIDE)) {
      this.say(`Too small to lift: a picture must show at least ${MIN_LIFT_SIDE} pixels each way.`, 'failed');
      return;
    }
    await this.lift(tabId, f.view, [item]);
  }

  /**
   * Lifts these: every picture captured first, then all of them rise into
   * the arc at once, then each model is fetched and decoded in turn.
   */
  private async lift(tabId: number, view: TabView, items: LiftItem[]): Promise<void> {
    const layer = this.deps.room.lifted!;
    const page = view.pageSeq;
    const id = view.webContentsId;
    if (id === null) return;
    const zoom = view.zoom;
    const pictures = await Promise.all(
      items.map(async (item) => {
        if (item.kind === 'model') return null;
        const bytes = await this.deps.bridge.liftCapture(id, item.rect).catch(() => null);
        if (!bytes) return null;
        // Rows from the bottom, as a picture is drawn on a surface in the room.
        return createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }), { imageOrientation: 'flipY' }).catch(() => null);
      }),
    );
    // The page went meanwhile (or the tab): nothing of it is lifted.
    if (this.deps.view(tabId) !== view || view.pageSeq !== page) {
      for (const p of pictures) p?.close();
      return;
    }
    const failed: string[] = [];
    let lifted = 0;
    const models: LiftItem[] = [];
    items.forEach((item, i) => {
      const from = { x: item.rect.x * zoom, y: item.rect.y * zoom, width: item.rect.width * zoom, height: item.rect.height * zoom };
      const picture = pictures[i];
      if (item.kind === 'model') {
        layer.add(tabId, item.id, item.kind, item.name, from);
        models.push(item);
        lifted += 1;
      } else if (picture) {
        layer.add(tabId, item.id, item.kind, item.name, from, picture);
        lifted += 1;
      } else {
        failed.push(item.name);
      }
    });
    this.deps.changed();
    if (lifted > 0) {
      const what = items.length === 1 ? items[0]!.name : plural(lifted, 'thing', 'things');
      const coming = models.length > 0 ? ` (${plural(models.length, 'model is', 'models are')} on the way)` : '';
      this.say(`Lifted into the room: ${what}${coming}.${failed.length > 0 ? ` Not lifted: ${failed.join(', ')}.` : ''}`, 'done');
    } else if (failed.length > 0) {
      this.say(`Could not lift: ${failed.join(', ')}.`, 'failed');
    }
    // Each model in turn; what could not be lifted is said once, at the end.
    const refused: string[] = [];
    for (const item of models) {
      const why = await this.liftModel(tabId, view, page, id, item);
      if (why) refused.push(`${item.name} (${why})`);
    }
    if (refused.length > 0) this.say(`Could not lift ${refused.length === 1 ? '' : `${refused.length} models: `}${refused.join('; ')}.`, 'failed');
  }

  /** Fetches, decodes, and shows one model; why it could not be, or null. */
  private async liftModel(tabId: number, view: TabView, page: number, id: number, item: LiftItem): Promise<string | null> {
    const layer = this.deps.room.lifted!;
    const gone = () => this.deps.view(tabId) !== view || view.pageSeq !== page || !layer.liftedIds(tabId).has(item.id);
    const reply = await this.deps.bridge.liftModel(id, item.src).catch(() => ({ ok: false as const, reason: 'it could not be fetched' }));
    if (gone()) return null;
    let why: string;
    if (reply.ok) {
      try {
        const shape = await decodeModel(reply);
        if (gone()) {
          for (const p of shape.pictures) p.close();
          return null;
        }
        layer.setModel(tabId, item.id, shape);
        const without = reply.skipped.length > 0 ? `, without ${plural(reply.skipped.length, 'file', 'files')} from another site` : '';
        layer.announce(`In the room: ${item.name}${without}.`);
        return null;
      } catch (e) {
        if (gone()) return null;
        why = e instanceof Error ? e.message : 'it could not be decoded';
      }
    } else {
      why = reply.reason;
    }
    layer.drop(tabId, item.id);
    this.deps.changed();
    return why;
  }

  private say(text: string, kind: 'done' | 'failed'): void {
    this.deps.notice.show({ text, kind, actions: [] });
  }
}

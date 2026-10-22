import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { cosmeticsRequest, inBlock, pageScripts } from './cosmetics';
import { buildEngine } from './filters-build';

/** GitHub issue #133: the page's scripts for the page preload, and what the blocker's library is given in place of the page's request. */

function request() {
  const insertCSS = vi.fn(() => Promise.resolve('key'));
  const pageScript = vi.fn(() => Promise.resolve(undefined));
  const frameScript = vi.fn(() => Promise.resolve(undefined));
  const event = {
    frameId: 7,
    processId: 3,
    sender: { isDestroyed: () => false, insertCSS, executeJavaScript: pageScript },
    senderFrame: { isDestroyed: () => false, executeJavaScript: frameScript },
  } as unknown as IpcMainInvokeEvent;
  return { event, insertCSS, pageScript, frameScript };
}

/** An engine with these rules and the page scripts included with the app. */
function engineWith(rules: string[]): ElectronBlocker {
  const filters = join(__dirname, '..', '..', '..', 'resources', 'filters');
  const scripts = (JSON.parse(readFileSync(join(filters, 'starter.json'), 'utf8')) as { resources: { sha256: string } }).resources.sha256;
  return ElectronBlocker.deserialize(buildEngine([rules.join('\n')], new Uint8Array(readFileSync(join(filters, 'starter.bin'))), scripts));
}

describe('the blocker request', () => {
  it('keeps the frame and process ids the library reads', () => {
    const { event } = request();
    const r = cosmeticsRequest(event);
    expect([r.frameId, r.processId]).toEqual([7, 3]);
  });

  it('runs no script, in the page or the frame: the page preload has run them', async () => {
    const { event, pageScript, frameScript } = request();
    await cosmeticsRequest(event).sender.executeJavaScript('class JSONPath {}', true);
    expect(pageScript).not.toHaveBeenCalled();
    expect(frameScript).not.toHaveBeenCalled();
  });

  it('puts styles in through the page, as the library does, and catches a failure', async () => {
    const { event, insertCSS } = request();
    await cosmeticsRequest(event).sender.insertCSS('.ad { display: none }', { cssOrigin: 'user' });
    expect(insertCSS).toHaveBeenCalledWith('.ad { display: none }', { cssOrigin: 'user' });
    insertCSS.mockImplementationOnce(() => Promise.reject(new Error('gone')));
    await expect(cosmeticsRequest(event).sender.insertCSS('x')).resolves.toBe('');
  });

  it("hands the page preload a page's scripts from the lists at once, each in a block, and none for another site", () => {
    const engine = engineWith(['example.com##+js(set-constant, hs1, true)', 'example.com##+js(json-edit, .c)', 'example.com##.ad']);
    const scripts = pageScripts(engine, { frameId: 0, processId: 1 }, 'https://example.com/page');
    expect(scripts).toHaveLength(2);
    expect(scripts.every((s) => s.startsWith('{\n') && s.endsWith('\n}'))).toBe(true);
    expect(scripts.join('')).toMatch(/hs1/);
    expect(pageScripts(engine, { frameId: 0, processId: 1 }, 'https://other.test/')).toEqual([]);
  });

  it("puts no styles in: they are left to the library's own request", () => {
    const onInject = vi.fn((r: IpcMainInvokeEvent) => {
      void r.sender.insertCSS('.ad { display: none }');
      void r.sender.executeJavaScript('x');
      return Promise.resolve();
    });
    expect(pageScripts({ onInjectCosmeticFilters: onInject }, { frameId: 0, processId: 1 }, 'https://example.com/')).toEqual(['{\nx\n}']);
  });

  it("a class declared at the top of two scripts in one realm: the second fails alone, in blocks both run, and a var still reaches the page's global scope", () => {
    const script = 'class JSONPath {}\nvar ran = (typeof ran === "number" ? ran : 0) + 1;';
    const bare = createContext({});
    runInContext(script, bare);
    expect(() => runInContext(script, bare)).toThrow(/already been declared/);
    const blocked = createContext({});
    runInContext(inBlock(script), blocked);
    runInContext(inBlock(script), blocked);
    expect(runInContext('ran', blocked)).toBe(2);
  });
});

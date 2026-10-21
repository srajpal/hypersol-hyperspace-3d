import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { cosmeticsRequest, inBlock } from './cosmetics';

/** GitHub issue #133: what the blocker's library is given in place of the page's request. */

function request(frame: { destroyed: boolean; run: (code: string, gesture: boolean) => Promise<unknown> } | null) {
  const insertCSS = vi.fn(() => Promise.resolve('key'));
  const pageScript = vi.fn(() => Promise.resolve(undefined));
  const event = {
    frameId: 7,
    processId: 3,
    sender: { isDestroyed: () => false, insertCSS, executeJavaScript: pageScript },
    senderFrame: frame && { isDestroyed: () => frame.destroyed, executeJavaScript: frame.run },
  } as unknown as IpcMainInvokeEvent;
  return { event, insertCSS, pageScript };
}

describe('the blocker request', () => {
  it('keeps the frame and process ids the library reads', () => {
    const { event } = request(null);
    const r = cosmeticsRequest(event);
    expect([r.frameId, r.processId]).toEqual([7, 3]);
  });

  it("runs a script in the frame that asked, in a block of its own, with no user gesture; never in the page's top frame", async () => {
    const run = vi.fn<(code: string, gesture: boolean) => Promise<unknown>>(() => Promise.resolve(undefined));
    const { event, pageScript } = request({ destroyed: false, run });
    await cosmeticsRequest(event).sender.executeJavaScript('class JSONPath {}');
    expect(run).toHaveBeenCalledWith('{\nclass JSONPath {}\n}', false);
    expect(pageScript).not.toHaveBeenCalled();
  });

  it('catches a script that fails, and runs nothing in a frame that has gone', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('Script failed to execute')));
    await expect(cosmeticsRequest(request({ destroyed: false, run: failing }).event).sender.executeJavaScript('x')).resolves.toBeUndefined();
    const gone = vi.fn(() => Promise.resolve(undefined));
    await cosmeticsRequest(request({ destroyed: true, run: gone }).event).sender.executeJavaScript('x');
    expect(gone).not.toHaveBeenCalled();
  });

  it('puts styles in through the page, as the library does, and catches a failure', async () => {
    const { event, insertCSS } = request(null);
    await cosmeticsRequest(event).sender.insertCSS('.ad { display: none }', { cssOrigin: 'user' });
    expect(insertCSS).toHaveBeenCalledWith('.ad { display: none }', { cssOrigin: 'user' });
    insertCSS.mockImplementationOnce(() => Promise.reject(new Error('gone')));
    await expect(cosmeticsRequest(event).sender.insertCSS('x')).resolves.toBe('');
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

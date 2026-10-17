/**
 * The landing page as built (the promotion plan's step 9, GitHub issue
 * #96): checks LP1 to LP4 (TODO.md, "Issue #96"). The page is built alone,
 * without the viewer, into a folder of its own (`node site/build.mjs --page
 * <folder>`; the builder is run as the workflow runs it, not imported, as
 * the type check does not read .mjs files), and read back as text: no
 * browser is needed for what these check. LP5 is WV8 in
 * tests/e2e/web-viewer.e2e.ts, with the viewer; LP6 the published page, by
 * hand.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SITE = fileURLToPath(new URL('./', import.meta.url));
const ROOT = join(SITE, '..');
const EXAMPLES = ['showroom', 'blockworld', 'sofa-studio', 'harbour-loft', 'sneaker-store', 'aquarium', 'words'];
const ZIPS = ['windows-x64', 'macos-arm64', 'macos-x64', 'linux-x64'];

let out = '';
let html = '';
let css = '';

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'hyperspace3d-landing-'));
  execFileSync(process.execPath, [join(SITE, 'build.mjs'), '--page', out], { stdio: 'pipe' });
  html = readFileSync(join(out, 'index.html'), 'utf8');
  css = readFileSync(join(out, 'style.css'), 'utf8');
});

afterAll(() => {
  if (out) rmSync(out, { recursive: true, force: true });
});

/** The value of an attribute on a tag's text, or undefined. */
const attribute = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
/** Every tag of a name in the page, as its text. */
const tags = (name: string) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => m[0]);

describe('LP1: the page as built', () => {
  it('holds the page, the stylesheet, and the pictures the page names', () => {
    for (const file of ['index.html', 'style.css', '.nojekyll']) expect(existsSync(join(out, file)), file).toBe(true);
    const named = tags('img').map((t) => attribute(t, 'src') ?? '');
    expect(named.length).toBeGreaterThanOrEqual(7);
    expect(named).toContain('pictures/hyperspace-3d.gif'); // the GIF of the promotion plan's step 6 (issue #93)
    for (const src of named) {
      expect(src, 'a picture of the site').toMatch(/^pictures\/[\w.-]+$/);
      expect(existsSync(join(out, src)), src).toBe(true);
    }
    expect(existsSync(join(out, 'pictures/icon.png')), 'the tab icon').toBe(true);
  });

  it("writes the app's version into the download links, one per zip of the release workflow", () => {
    const version = JSON.parse(readFileSync(join(ROOT, 'apps/browser/package.json'), 'utf8')).version as string;
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(html).not.toContain('{{');
    expect(html).toContain(`Download ${version}`);
    const links = tags('a').map((t) => attribute(t, 'href') ?? '');
    for (const zip of ZIPS) {
      expect(links).toContain(`https://github.com/srajpal/hypersol-hyperspace-3d/releases/download/v${version}/HyperSpace3D-${version}-${zip}.zip`);
    }
  });
});

describe('LP2: links and pictures', () => {
  it('every link to a file of the site holds, and every part a link names is there', () => {
    const ids = new Set(tags('[a-z0-9]+').map((t) => attribute(t, 'id')).filter((id): id is string => Boolean(id)));
    for (const href of tags('a').map((t) => attribute(t, 'href') ?? '')) {
      expect(href, 'every link has an address').not.toBe('');
      if (href.startsWith('#')) expect(ids.has(href.slice(1)), href).toBe(true);
      else if (!/^https:\/\//.test(href)) {
        // A file of the site, or the viewer's page with a query.
        const [path] = href.split('?');
        const file = path!.endsWith('/') ? `${path}index.html` : path!;
        const local = join(out, file);
        // The viewer is not built here (LP5 checks it beside the page); everything else must be.
        if (!file.startsWith('viewer/')) expect(existsSync(local), href).toBe(true);
      }
    }
  });

  it('every picture has its text, width, and height', () => {
    for (const img of tags('img')) {
      expect(attribute(img, 'alt'), img).toBeDefined();
      expect(attribute(img, 'width'), img).toMatch(/^\d+$/);
      expect(attribute(img, 'height'), img).toMatch(/^\d+$/);
    }
    // The screenshots' texts are the README's, not empty.
    expect(tags('img').filter((t) => attribute(t, 'alt') !== '').length).toBeGreaterThanOrEqual(5);
  });

  it("the seven examples open in the viewer page, each with the holoml site's address beside it", () => {
    const links = tags('a').map((t) => attribute(t, 'href') ?? '');
    for (const example of EXAMPLES) {
      expect(links, example).toContain(`viewer/?page=https://srajpal.github.io/holoml/${example}/index.holoml`);
      expect(links, example).toContain(`https://srajpal.github.io/holoml/${example}/`);
    }
    expect(links).toContain('viewer/');
  });
});

describe('LP3: nothing fetched, nothing run', () => {
  it('has no script, and loads nothing from another site', () => {
    expect(tags('script')).toEqual([]);
    expect(tags('iframe')).toEqual([]);
    expect(tags('object')).toEqual([]);
    expect(tags('embed')).toEqual([]);
    expect(tags('video')).toEqual([]);
    expect(tags('audio')).toEqual([]);
    for (const link of tags('link')) expect(attribute(link, 'href'), link).toMatch(/^(style\.css|pictures\/[\w.-]+)$/);
    // The video is linked, not embedded: nothing plays or loads from elsewhere.
    expect(tags('a').map((t) => attribute(t, 'href'))).toContain('https://github.com/srajpal/hypersol-hyperspace-3d/releases/download/v0.9.1/hyperspace-3d-0.9.1.webm');
    for (const tag of [...tags('img'), ...tags('source')]) expect(attribute(tag, 'src') ?? '', tag).toMatch(/^pictures\//);
    expect(css).not.toMatch(/url\(|@import/);
    expect(html).not.toMatch(/\son[a-z]+="/);
  });

  it("has the content security policy: nothing by default, the site's own styles and pictures", () => {
    const meta = tags('meta').find((t) => attribute(t, 'http-equiv') === 'Content-Security-Policy');
    expect(meta).toBeDefined();
    const policy = attribute(meta!, 'content') ?? '';
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("style-src 'self'");
    expect(policy).toContain("img-src 'self'");
    expect(policy).toContain("form-action 'none'");
    expect(policy).not.toMatch(/script-src|'unsafe-inline'|https:/);
  });
});

describe('LP4: access', () => {
  it('has one h1, headings in order, a skip link, and the language', () => {
    expect(tags('html')[0]).toContain('lang="en"');
    expect(tags('h1')).toHaveLength(1);
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i += 1) expect(levels[i]! - levels[i - 1]!, `heading ${i}`).toBeLessThanOrEqual(1);
    expect(html).toMatch(/<a class="skip" href="#main">/);
    expect(html).toMatch(/<main id="main">/);
    for (const section of tags('section')) {
      const by = attribute(section, 'aria-labelledby');
      expect(by, section).toBeDefined();
      expect(html).toContain(`id="${by}"`);
    }
    // The command block scrolls sideways on a narrow screen, so the keyboard must reach it.
    for (const pre of tags('pre')) expect(pre).toContain('tabindex="0"');
  });

  it('every colour pair meets WCAG 2.2 AA, in light and in dark', () => {
    const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1]!, m[2]!]));
    const light = tokens(/:root \{([^}]*)\}/.exec(css)![1]!);
    const dark = tokens(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}/.exec(css)![1]!);
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    for (const [scheme, t] of [['light', light], ['dark', dark]] as const) {
      for (const text of ['fg', 'muted', 'link', 'visited']) {
        for (const ground of ['bg', 'surface']) {
          expect(contrast(t[text]!, t[ground]!), `${scheme}: ${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      // The first button is the link colour with the page's background as its text.
      expect(contrast(t.bg!, t.link!), `${scheme}: the download button`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.focus!, t.bg!), `${scheme}: the focus ring`).toBeGreaterThanOrEqual(3);
      expect(contrast(t.focus!, t.surface!), `${scheme}: the focus ring on the top`).toBeGreaterThanOrEqual(3);
      expect(contrast(t.border!, t.bg!), `${scheme}: the download links' borders`).toBeGreaterThanOrEqual(3);
    }
    expect(css).toMatch(/:focus-visible \{\s*outline: 3px solid var\(--focus\);/);
  });
});

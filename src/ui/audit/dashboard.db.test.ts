import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The dashboard is plain HTML and JavaScript with no build step, so nothing
 * tells it that `$('todayCount')` no longer exists - it throws at runtime, in
 * the browser, on a page whose whole job is to be trusted from outside the
 * clinic.
 *
 * This is the cheapest thing that catches the one mistake a markup change
 * actually makes: an element renamed or moved out from under the code that
 * writes to it. It is not a rendering test and does not pretend to be.
 */

const WEB = join(__dirname, '..', '..', '..', 'web');
const html = readFileSync(join(WEB, 'index.html'), 'utf8');
const js = readFileSync(join(WEB, 'app.js'), 'utf8');
const notFound = readFileSync(join(WEB, '404.html'), 'utf8');

const matchAll = (src: string, re: RegExp) => [...src.matchAll(re)].map((m) => m[1]);

describe('web dashboard', () => {
  test('every element app.js reaches for exists in the page', () => {
    const ids = new Set(matchAll(html, /\bid="([^"]+)"/g));
    const missing = [...new Set(matchAll(js, /\$\('([^']+)'\)/g))].filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });

  test('every tab has a pane and every pane has a tab', () => {
    const tabs = matchAll(html, /class="tab"[^>]*data-tab="([^"]+)"/g);
    const panes = matchAll(html, /class="pane[^"]*"\s+data-tab="([^"]+)"/g);
    expect(tabs.length).toBeGreaterThan(1);
    expect(tabs.sort()).toEqual(panes.sort());
  });

  test('exactly one tab starts selected, and one pane starts visible', () => {
    // `<button`-anchored, so the `.tab[aria-selected="true"]` CSS rule above
    // is not counted as a selected tab.
    expect(matchAll(html, /<button([^>]*aria-selected="true")/g)).toHaveLength(1);
    expect(matchAll(html, /class="(pane[^"]*)"/g).filter((c) => !c.includes('hide'))).toHaveLength(1);
  });

  /**
   * The CSP is what makes a missed esc() inert instead of exploitable, and it
   * is one line in a file nobody reads top to bottom. Deleting it would break
   * nothing visible, which is exactly why it needs a test.
   */
  test.each([
    ['index.html', html],
    ['404.html', notFound],
  ])('%s sets a Content-Security-Policy that blocks foreign script', (_name, page) => {
    const csp = page.match(/http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/s)?.[1];
    expect(csp).toBeDefined();
    // 'self' or 'none' - either blocks an injected <script src>. 'unsafe-inline'
    // anywhere in script-src would make the whole policy decorative.
    expect(csp).toMatch(/script-src '(self|none)'|default-src 'none'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  test.each([
    ['index.html', html],
    ['404.html', notFound],
  ])('%s links a favicon that exists', (_name, page) => {
    const icon = page.match(/<link rel="icon" href="([^"]+)"/)?.[1];
    expect(icon).toBeDefined();
    expect(existsSync(join(WEB, icon!))).toBe(true);
  });

  // EAS Hosting serves index.html for unknown paths unless a 404.html is
  // present, so without this file a typo silently renders the dashboard at
  // status 200 - which is how a wrong URL comes to look like working software.
  test('the 404 page offers a way back', () => {
    expect(notFound).toMatch(/href="\/"/);
  });

  // Section 10a and DASHBOARD.md both promise this page cannot write. A read
  // path is a GET; anything else against /rest/v1 would be a new capability.
  test('read only', () => {
    expect(js).not.toMatch(/method:\s*'(POST|PATCH|PUT|DELETE)'[\s\S]{0,200}rest\/v1/);
    expect(js).not.toMatch(/rest\/v1[\s\S]{0,200}method:\s*'(POST|PATCH|PUT|DELETE)'/);
  });
});

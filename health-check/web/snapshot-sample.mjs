// Makes the marketing sample: the Vellmoor sample report, rendered once and frozen as plain HTML.
// No scripts, no buttons, no forms, no links. Run after build.mjs:  NODE_PATH=$(npm root -g) node web/snapshot-sample.mjs
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
await page.goto(pathToFileURL(join(here, '../dist/index.html')).toString());
await page.waitForTimeout(1500);
const html = await page.evaluate(() => {
  const kill = (sel) => document.querySelectorAll(sel).forEach((e) => e.remove());
  // everything a visitor could press
  kill('#runForm, .btns, #bgswitch, #toolbar, .addfix, #fixlist, .fab, .foot-talk, #talk, .rv form, .rv .acts, .sbs-empty, #rvPrivacy, #rvNone, .ba-seg, #ba, .swipe, .src, .cmp-table, #hcAuto, #hcNotes, #dtip, #baNote, #tkey, #ticks, script');
  kill('.cost-lead');
  // links and buttons that carry content become plain text
  document.querySelectorAll('a').forEach((a) => { const s = document.createElement('span'); s.className = a.className; s.innerHTML = a.innerHTML; a.replaceWith(s); });
  document.querySelectorAll('button').forEach((b) => { const d = document.createElement('div'); d.className = b.className; d.setAttribute('style', b.getAttribute('style') || ''); d.innerHTML = b.innerHTML; b.replaceWith(d); });
  document.querySelectorAll('[tabindex]').forEach((e) => e.removeAttribute('tabindex'));
  document.querySelectorAll('svg a, svg g.balloon-g').forEach((g) => g.removeAttribute('href'));
  document.querySelectorAll('details').forEach((d) => d.remove());
  // the sample's wording for a page that is only looked at
  const tag = document.querySelector('.spec-tag'); if (tag) tag.textContent = 'Sample report';
  const st = document.querySelector('#runStatus'); if (st) st.remove();
  const css = document.createElement('style');
  css.textContent = '.board{grid-template-columns:1fr!important}.catbtn,.chip{cursor:default}.catbtn:hover{transform:none}.balloon-g{cursor:default}'
    + '.mkt-note{max-width:38em;margin:0 0 22px;padding:12px 16px;border-radius:14px;border:1.5px dashed var(--hero-rule);font:500 15px/1.5 var(--f-body);color:var(--hero-ink)}';
  document.head.appendChild(css);
  const note = document.createElement('p'); note.className = 'mkt-note';
  note.textContent = 'A sample Website Health Check for a fictional manufacturer, Vellmoor Precision. Every score and price on this page is an example.';
  const client = document.querySelector('#client'); if (client) client.parentNode.insertBefore(note, client);
  // wording that told the reader to press things
  const setText = (sel, t) => { const e = document.querySelector(sel); if (e) e.textContent = t; };
  document.querySelectorAll('.sec-h p').forEach((p) => { if (/^Select an area/.test(p.textContent)) p.remove(); });
  document.querySelectorAll('[data-copy="drawingHelp"]').forEach((p) => { p.textContent = 'Each numbered balloon marks one check on a mock-up of the home page.'; });
  setText('[data-copy="rvKicker"]', 'In the full report');
  setText('#rvH', 'Benchmarked against a competitor');
  setText('[data-copy="rvIntro"]', 'The full report puts your site side by side with one competitor you name, across the same checks. Here the competitor is a fictional firm.');
  document.querySelectorAll('.rv .ill').forEach((p) => p.remove());
  document.title = 'Website Health Check Sample';
  return '<!doctype html>\n' + document.documentElement.outerHTML;
});
const out = join(here, '../dist/sample.html');
writeFileSync(out, html.replace(/<!--[\s\S]*?-->/g, ''));
console.log('wrote dist/sample.html', Math.round(html.length / 1024) + ' KB');
// check: nothing to press
const chk = await browser.newPage({ viewport: { width: 390, height: 844 } });
await chk.goto(pathToFileURL(out).toString());
const left = await chk.evaluate(() => ({ a: document.querySelectorAll('a').length, button: document.querySelectorAll('button,input,select,textarea,details,form').length, script: document.querySelectorAll('script').length, over: document.documentElement.scrollWidth - innerWidth }));
console.log('left on page:', JSON.stringify(left));
await chk.screenshot({ path: '/tmp/claude-0/hc-shots/sample-phone.png' });
const d = await browser.newPage({ viewport: { width: 1280, height: 900 } }); await d.goto(pathToFileURL(out).toString()); await d.screenshot({ path: '/tmp/claude-0/hc-shots/sample-desk.png' });
await d.evaluate(() => document.querySelector('#list').scrollIntoView()); await d.screenshot({ path: '/tmp/claude-0/hc-shots/sample-desk2.png' });
await browser.close();

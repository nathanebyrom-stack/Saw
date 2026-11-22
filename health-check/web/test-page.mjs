// Browser test of the built page: sample view, a live run on each local test site, errors,
// reload by report id, and the artifact (Supabase connector) path with a stand-in connector.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { startMock } from './mock-api.mjs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
const OUT = process.env.SHOTS || '/tmp/claude-0/hc-shots'; mkdirSync(OUT, { recursive: true });
const mock = await startMock(4810);
const file = pathToFileURL(new URL('../dist/index.html', import.meta.url).pathname).toString();
const API = 'https://faaraefaigsngvuuvsyv.supabase.co/functions/v1/health-check';
const browser = await chromium.launch();
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(API)) {
      const rq = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
      if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      return fetch('http://127.0.0.1:4810/' + u.slice(API.length), { method: rq.method(), body: rq.method() === 'POST' ? rq.postData() : undefined, headers: { 'content-type': 'application/json' } })
        .then(async (r) => route.fulfill({ status: r.status, headers: { ...cors, 'content-type': 'application/json' }, body: await r.text() }));
    }
    if (u.startsWith('file:') || u.startsWith('http://127.0.0.1')) return route.continue();
    return route.abort();
  });
  if (opts.init) await page.addInitScript(opts.init);
  return { page, errors, ctx };
}
const txt = (page, sel) => page.locator(sel).first().innerText();
async function run(page, url) { await page.fill('#runUrl', url); await page.click('#runBtn'); }

// 1 sample
let { page, errors } = await newPage();
await page.goto(file); await page.waitForTimeout(2200);
assert.equal(await txt(page, '#dialNum'), '43'); assert.equal(await page.locator('article.metric').count(), 18);
assert.ok(await page.locator('#drawing').isVisible()); assert.match(await txt(page, '#runStatus'), /sample report/);
assert.equal(await page.locator('#tally > div').count(), 4); assert.match(await txt(page, '#verdictSay'), /Close call/);
assert.match(await page.title(), /Vellmoor Precision \(sample\)/);
await page.screenshot({ path: OUT + '/1-sample.png' });

// 2 bad address
await run(page, 'not a website'); assert.match(await txt(page, '#runStatus'), /doesn’t look right/);
// 3 unreachable site -> engine error surfaces
await run(page, 'nowhere.test'); await page.waitForFunction(() => /couldn’t reach/.test(document.getElementById('runStatus').textContent), null, { timeout: 15000 });
assert.equal(await page.locator('#runBtn').isDisabled(), false);

// 4 live run on the poor site
await run(page, 'www.tired.test'); await page.waitForFunction(() => /Report for tired\.test/.test(document.getElementById('runStatus').textContent), null, { timeout: 30000 });
await page.waitForTimeout(2000);
assert.match(await txt(page, '#client'), /Harrowgate/); assert.ok(!(await page.locator('#drawing').isVisible()));
assert.equal(await page.locator('#tally > div').count(), 5); assert.equal(await page.locator('article.metric').count(), 18);
const tiredDial = Number(await txt(page, '#dialNum')); assert.ok(tiredDial > 20 && tiredDial < 45, 'tired dial ' + tiredDial);
assert.match(await txt(page, '#m-headline'), /Welcome to our website/); assert.match(await txt(page, '#m-offer-structure'), /Doesn’t say what you offer/);
assert.match(await txt(page, '#m-local-listing'), /Not measured/i);
assert.match(await txt(page, '#m-local-listing .fix'), /until it’s been checked/); assert.equal(await page.locator('#m-local-listing .addfix').count(), 0);
assert.match(await txt(page, '#rivals'), /Harrowgate/); assert.match(await txt(page, '#cmpRows'), /Not measured/i);
assert.match(page.url(), /[?&]r=00000000-/); assert.match(await txt(page, 'footer'), /produced automatically/);
assert.match(await page.title(), /Harrowgate$/);
assert.ok(!/vellmoor/i.test(await page.locator('#hcRoot').innerText()), 'no trace of the sample client on a live report');
assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ghead .ba')].filter((e) => getComputedStyle(e).position === 'absolute').length), 0);
console.log('tired: dial', tiredDial, '| verdict:', (await txt(page, '#verdictSay')).slice(0, 40), '| tally:', (await txt(page, '#tally')).replace(/\s+/g, ' '));
await page.screenshot({ path: OUT + '/2-tired-top.png' });
await page.locator('#m-headline').scrollIntoViewIfNeeded(); await page.screenshot({ path: OUT + '/3-tired-cards.png' });
await page.locator('#compare').scrollIntoViewIfNeeded(); await page.screenshot({ path: OUT + '/4-tired-compare.png' });
// fix list still works on a live report
await page.click('#addFail'); assert.ok(await page.locator('#flItems li:not(.empty)').count() >= 5);
const reportUrl = page.url();

// 5 live run on the good site
await run(page, 'sharp.test'); await page.waitForFunction(() => /Report for sharp\.test/.test(document.getElementById('runStatus').textContent), null, { timeout: 30000 });
await page.waitForTimeout(1800);
const sharpDial = Number(await txt(page, '#dialNum')); assert.ok(sharpDial >= 75, 'sharp dial ' + sharpDial);
assert.match(await txt(page, '#m-tap-to-call .fix'), /Nothing to fix here/); assert.match(await txt(page, '#m-tap-to-call .cost'), /No cost/);
assert.equal(await page.locator('#m-tap-to-call .addfix').count(), 0);
console.log('sharp: dial', sharpDial, '| verdict:', (await txt(page, '#verdictSay')).slice(0, 40));
await page.locator('#m-tap-to-call').scrollIntoViewIfNeeded(); await page.screenshot({ path: OUT + '/5-sharp-cards.png' });

// 6 back to the sample
await page.click('#runStatus [data-sample]'); await page.waitForTimeout(1800);
assert.equal(await txt(page, '#dialNum'), '43'); assert.ok(await page.locator('#drawing').isVisible()); assert.ok(!/[?&]r=/.test(page.url()));
assert.deepEqual(errors, [], 'no script errors (web mode)');

// 7 open a saved report by its link
await page.goto(reportUrl); await page.waitForFunction(() => /Report for tired\.test/.test(document.getElementById('runStatus').textContent), null, { timeout: 15000 });
assert.match(await txt(page, '#client'), /Harrowgate/);

// 8 phone width
const ph = await newPage({ viewport: { width: 390, height: 844 } });
await ph.page.goto(reportUrl); await ph.page.waitForFunction(() => /Report for tired\.test/.test(document.getElementById('runStatus').textContent), null, { timeout: 15000 });
await ph.page.waitForTimeout(1500);
const over = await ph.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
assert.ok(over <= 1, 'no sideways scroll on a phone, overflow=' + over);
await ph.page.screenshot({ path: OUT + '/6-phone.png' }); assert.deepEqual(ph.errors, []);

// 9 inside a Claude artifact: no outside network, runs go through the viewer's Supabase connector
const calls = [];
await ph.ctx.exposeFunction('hcSql', async (q) => {
  calls.push(q); const wrap = (rows) => ({ result: 'Below is the result of the SQL query.\n\n<untrusted-data-x>\n' + JSON.stringify(rows) + '\n</untrusted-data-x>\n\nUse this data.' });
  let m;
  if ((m = /values \('(.+?)', 'artifact'\)/.exec(q))) return wrap([{ r: 'HCID:' + mock.start(m[1]) + ':END' }]);
  if ((m = /where id = '([0-9a-f-]{36})'/.exec(q))) { const row = mock.rows.get(m[1]); if (!row) return wrap([]);
    const b64 = Buffer.from(JSON.stringify({ status: row.status, error: row.error || null, report: row.report || null }), 'utf8').toString('base64').replace(/(.{76})/g, '$1\n');
    return wrap([{ r: 'HCB64:' + b64 + ':END' }]); }
  throw new Error('unexpected sql');
});
const art = await ph.ctx.newPage(); const artErr = []; art.on('pageerror', (e) => artErr.push(e.message));
await art.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));   // like the artifact frame: no network at all
await art.addInitScript(() => { window.claude = { use: (name) => Promise.resolve(name === 'mcp' ? { callTool: (server, tool, input) => window.hcSql(input.query).then((p) => ({ payload: p, content: [] })) } : null) }; });
await art.goto(file); await art.waitForTimeout(1500);
await art.fill('#runUrl', "sharp.test"); await art.click('#runBtn');
await art.waitForFunction(() => /Report for sharp\.test/.test(document.getElementById('runStatus').textContent), null, { timeout: 30000 });
assert.match(await art.locator('#client').innerText(), /Calderbrook/); assert.match(art.url(), /#r-00000000-/);
assert.ok(calls.some((q) => q.startsWith('insert into public.hc_reports')) && calls.some((q) => q.startsWith("select 'HCB64:'")));
assert.deepEqual(artErr, []);
// a viewer with no connector gets the sample and a plain explanation
const none = await ph.ctx.newPage(); await none.addInitScript(() => { window.claude = { use: () => Promise.resolve(null) }; });
await none.goto(file); await none.waitForTimeout(1200);
assert.match(await none.locator('#runStatus').innerText(), /aren’t available in this view/); assert.ok(await none.locator('#runBtn').isDisabled());

console.log('ALL PAGE TESTS PASSED · screenshots in', OUT);
await browser.close(); mock.close();

import { audit, normaliseUrl } from '../engine.ts';
import { serve } from './fixtures.mjs';
import assert from 'node:assert/strict';
const a = await serve('tired', 4801, 120), b = await serve('sharp', 4802, 5);
// The fixtures are plain http on localhost, so "https://127.0.0.1" fails and the engine falls back to http.
const now = new Date('2026-11-21T12:00:00Z');
const tired = await audit('http://127.0.0.1:4801/', { allowLocal: true, now, timeoutMs: 4000 });
const sharp = await audit('http://127.0.0.1:4802/', { allowLocal: true, now, timeoutMs: 4000 });
const show = (r) => { console.log('\n' + r.name, '·', r.pages.length, 'pages'); for (const [k, c] of Object.entries(r.checks)) console.log(' ', k.padEnd(16), String(c.score ?? 'NM').padStart(4), ' ', c.flaw); };
show(tired); show(sharp);
const t = tired.checks, s = sharp.checks;
assert.equal(t['headline'].score, 3.0); assert.ok(t["image-weight"].score <= 3.5, "tired page is heavy");
assert.equal(t['tap-to-call'].score, 5.0); assert.equal(t['responsive'].score, 2.5); assert.equal(t['quote-form'].score, 3.5);
assert.equal(t['case-studies'].score, 1.5); assert.equal(t['certs'].score, 6.5); assert.equal(t['titles-meta'].score, 3.0);
assert.ok(t['platform-ready'].score < 4, 'Drupal 7 fails'); assert.equal(t['tools-in-use'].score, 2.0);
assert.ok(t['offer-structure'].score < 4, 'tired offer unclear'); assert.equal(t['local-listing'].score, null);
assert.equal(s['headline'].score, 7.0); assert.equal(s['tap-to-call'].score, 9.0); assert.equal(s['responsive'].score, 8.0);
assert.equal(s['quote-form'].score, 9.0); assert.equal(s['reply-promise'].score, 8.0); assert.equal(s['case-studies'].score, 8.5);
assert.equal(s['certs'].score, 9.0); assert.equal(s['titles-meta'].score, 9.0); assert.equal(s['spec-page'].score, 8.0);
assert.equal(s['machine-list'].score, 7.5); assert.ok(s['platform-ready'].score >= 8, 'current WordPress passes'); assert.equal(s['tools-in-use'].score, 9.0);
assert.ok(s['image-weight'].score > 9); assert.ok(t['hosting'].score <= s['hosting'].score);
assert.equal(sharp.values.cert.v, 'shown'); assert.equal(tired.values.cert.v, 'named'); assert.equal(sharp.values.upload.v, true);
// guards
for (const bad of ['http://localhost/', 'http://127.0.0.1/', 'http://10.0.0.5/', 'http://[::1]/', 'intranet', 'http://example.com:8080/', 'ftp://example.com'])
  await assert.rejects(() => audit(bad, { timeoutMs: 500 }), (e) => ['blocked_host', 'bad_url'].includes(e.code), bad);
assert.equal(normaliseUrl('www.Example.co.uk').toString(), 'https://www.example.co.uk/');
// one-page site: work section counts as case studies; custom code on Cloudflare is ready for chat/AI
const c = await serve('onepage', 4803, 5);
const one = await audit('http://127.0.0.1:4803/', { allowLocal: true, now, timeoutMs: 4000 }); show(one);
assert.equal(one.checks['case-studies'].score, 8.5); assert.match(one.checks['case-studies'].flaw, /3 examples/);
assert.equal(one.checks['platform-ready'].score, 7.5); assert.match(one.checks['platform-ready'].finding, /custom-built site on Cloudflare/); assert.match(one.checks['platform-ready'].flaw, /ready to add chat or AI/);
assert.match(one.checks['platform-ready'].finding, /security settings/);

assert.equal(one.sector.key, 'agency'); assert.equal(one.checks['spec-page'].score, null); assert.equal(one.checks['machine-list'].score, null);
assert.ok(one.checks['offer-structure'].score >= 7, 'one-page offer is clear'); assert.match(one.checks['offer-structure'].finding, /digital or marketing agency, for UK engineering firms/);
assert.equal(sharp.sector.key, 'manufacturing'); assert.equal(s['spec-page'].score, 8.0); assert.ok(s['offer-structure'].score >= 7);
c.close();
// main image, scored on resolution only
assert.equal(t['hero-photo'].score, 3.0); assert.match(t['hero-photo'].flaw, /1,024 × 640 px/); assert.match(t['hero-photo'].note, /resolution only/);
assert.equal(s['hero-photo'].score, 9.0); assert.match(s['hero-photo'].flaw, /2,560 ×/);
assert.equal(one.checks['hero-photo'].score, 8.0); assert.equal(one.checks['hero-photo'].evidence.found, 'hero video'); assert.match(one.checks['hero-photo'].finding, /opens with a video, 1,920 × 1,080 px\. Its still frame.*1,440 px wide/);
assert.match(one.checks['offer-structure'].note, /reads as a digital or marketing agency/);
console.log('\nALL ENGINE TESTS PASSED');
a.close(); b.close();

// Local stand-in for the Edge Function, for browser tests only. Same routes; runs the real engine
// against the two local test sites (tired.test -> :4801, sharp.test -> :4802).
import http from 'node:http';
import { audit } from '../engine/engine.ts';
import { serve } from '../engine/test/fixtures.mjs';
const MAP = { 'tired.test': 'http://127.0.0.1:4801/', 'sharp.test': 'http://127.0.0.1:4802/' };
export async function startMock(port = 4810) {
  const sites = [await serve('tired', 4801, 40), await serve('sharp', 4802, 5)];
  const rows = new Map(); let n = 0;
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  const send = (res, code, body) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const start = (url) => {
    const id = '00000000-0000-4000-8000-' + String(++n).padStart(12, '0');
    const host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    rows.set(id, { id, status: 'running', url });
    if (!MAP[host]) setTimeout(() => rows.set(id, { id, status: 'error', error: 'We couldn’t reach that website. Check the address and try again.' }), 300);
    else audit(MAP[host], { allowLocal: true, timeoutMs: 4000 }).then((report) => { report.domain = host; rows.set(id, { id, status: 'done', url, report }); }, (e) => rows.set(id, { id, status: 'error', error: e.message }));
    return id;
  };
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const u = new URL(req.url, 'http://x');
    if (req.method === 'GET') { const row = rows.get(u.searchParams.get('id')); return row ? send(res, 200, row) : send(res, 404, { error: 'No report with that id.' }); }
    let b = ''; req.on('data', (c) => b += c); req.on('end', () => { const j = JSON.parse(b || '{}'); send(res, 202, { id: start(j.url), status: 'running' }); });
  }).listen(port, '127.0.0.1');
  return { rows, start, close() { server.close(); sites.forEach((s) => s.close()); } };
}

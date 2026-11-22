// Supabase Edge Function "health-check".
//   POST {url}      start a run, returns {id} straight away; the run carries on in the background
//   POST {id}       run a row that was inserted as 'queued' (called by the database trigger)
//   GET  ?id=<uuid> read a run: {id, status, url, report, error}
// Public by design (the report page calls it without a login), so it does its own checks:
// address validation and private-network blocking live in engine.ts; rate limits live here.
// Deployed build imports the engine pinned to a commit of the public repo (see deploy notes in README).
// Locally and in tests, "./engine.ts" is used.
import { audit, HcError, normaliseUrl } from "./engine.ts";


const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PSI_KEY = Deno.env.get("PSI_API_KEY") || undefined;
const PER_IP_PER_HOUR = 8, ALL_PER_HOUR = 60;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,authorization,apikey", "access-control-max-age": "86400" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function db(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(SB + "/rest/v1/" + path, { ...init, headers: { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json", ...(init.headers || {}) } });
}
async function count(filter: string): Promise<number> {
  const r = await db("hc_reports?select=id&" + filter, { headers: { prefer: "count=exact", range: "0-0" } });
  try { await r.body?.cancel(); } catch { /* ignore */ }
  const n = Number((r.headers.get("content-range") || "").split("/")[1]);
  return Number.isFinite(n) ? n : 0;
}
async function sha(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function patch(id: string, body: Record<string, unknown>, extra = ""): Promise<number> {
  const r = await db("hc_reports?id=eq." + id + extra, { method: "PATCH", body: JSON.stringify(body), headers: { prefer: "return=representation" } });
  const rows = r.ok ? await r.json() : []; return Array.isArray(rows) ? rows.length : 0;
}
async function run(id: string, url: string) {
  try {
    const report = await Promise.race([
      audit(url, { psiKey: PSI_KEY }),
      new Promise<never>((_, no) => setTimeout(() => no(new HcError("timeout", "That site took too long to check. Try again in a few minutes.")), 125_000)),
    ]);
    await patch(id, { status: "done", report, finished_at: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof HcError ? e.message : "Something went wrong while checking that site. Try again in a few minutes.";
    if (!(e instanceof HcError)) console.error("health-check failed", id, e);
    await patch(id, { status: "error", error: msg, finished_at: new Date().toISOString() });
  }
}
// deno-lint-ignore no-explicit-any
const background = (p: Promise<unknown>) => { const er = (globalThis as any).EdgeRuntime; if (er?.waitUntil) er.waitUntil(p); };

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const u = new URL(req.url);

    if (req.method === "GET") {
      const id = u.searchParams.get("id") || "";
      if (!UUID.test(id)) return json({ error: "A report id is needed." }, 400);
      const r = await db("hc_reports?id=eq." + id + "&select=id,status,url,report,error,created_at");
      const rows = r.ok ? await r.json() : [];
      if (!rows.length) return json({ error: "No report with that id." }, 404);
      const row = rows[0];
      if ((row.status === "running" || row.status === "queued") && Date.now() - Date.parse(row.created_at) > 4 * 60_000) { row.status = "error"; row.error = "That check didn’t finish. Run it again."; }
      return json(row);
    }

    if (req.method !== "POST") return json({ error: "Use GET or POST." }, 405);
    let body: { url?: unknown; id?: unknown; source?: unknown } = {};
    try { body = await req.json(); } catch { return json({ error: "Send JSON." }, 400); }

    // a queued row, kicked by the database trigger
    if (typeof body.id === "string" && UUID.test(body.id)) {
      const r = await db("hc_reports?id=eq." + body.id + "&status=eq.queued&select=id,url");
      const rows = r.ok ? await r.json() : [];
      if (!rows.length) return json({ ok: false, error: "Nothing queued with that id." }, 404);
      let target: string;
      try { target = normaliseUrl(rows[0].url).toString(); } catch (e) { await patch(body.id, { status: "error", error: (e as Error).message, finished_at: new Date().toISOString() }); return json({ ok: false }, 400); }
      if (!(await patch(body.id, { status: "running" }, "&status=eq.queued"))) return json({ ok: false }, 409);
      background(run(body.id, target));
      return json({ ok: true, id: body.id });
    }

    // a new run from the report page
    if (typeof body.url !== "string" || body.url.length > 500) return json({ error: "Enter a website address." }, 400);
    let target: string;
    try { target = normaliseUrl(body.url).toString(); } catch (e) { return json({ error: (e as Error).message }, 400); }
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const ipHash = await sha(ip + "|" + SB);
    const since = "created_at=gte." + encodeURIComponent(new Date(Date.now() - 3600_000).toISOString());
    const [mine, all] = await Promise.all([count(since + "&ip_hash=eq." + ipHash), count(since)]);
    if (mine >= PER_IP_PER_HOUR || all >= ALL_PER_HOUR) return json({ error: "That’s a lot of checks in one hour. Try again a little later." }, 429);
    const ins = await db("hc_reports", { method: "POST", body: JSON.stringify({ url: target, status: "running", source: typeof body.source === "string" ? body.source.slice(0, 40) : "web", ip_hash: ipHash }), headers: { prefer: "return=representation" } });
    const rows = ins.ok ? await ins.json() : [];
    if (!rows.length) return json({ error: "The check couldn’t be started. Try again in a few minutes." }, 500);
    background(run(rows[0].id, target));
    return json({ id: rows[0].id, status: "running" }, 202);
  } catch (e) {
    console.error("health-check handler", e);
    return json({ error: "Something went wrong. Try again in a few minutes." }, 500);
  }
});

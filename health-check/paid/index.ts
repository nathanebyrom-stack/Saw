// Supabase Edge Function "hc-order": the paid Performance Test (£4.99).
//   POST {url, name, email, competitor?, consent}  web order form: make the order and its Stripe checkout -> {checkout_url}
//   POST {action:"checkout", id}                   database trigger: make the checkout for an order queued from a Claude artifact
//   POST .../stripe                                Stripe webhook: payment confirmed -> paid, deadline set, sites queued, emails sent
//   POST {action:"deliver", id}                    database trigger: the designer published the report -> email the customer
//   GET  ?open                                     whether orders are being taken (asked before any personal details are sent)
//   GET  ?status=<order id>                        thank-you page: status and deadline only, no personal details
//   GET  ?token=<access token>                     the customer's full report, once published
// Secrets (Supabase > Edge Functions > Secrets): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY.
// Orders are refused while hc_config.paid_on is false (privacy notice not yet live).
import { dueAfterWorkingMinutes, londonText } from "./hours.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE = Deno.env.get("STRIPE_SECRET_KEY") || "";
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SITE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const FAILED = "Your order couldn’t be started. Nothing has been charged. Try again in a few minutes.";

type Row = Record<string, unknown>;
async function db(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(SB + "/rest/v1/" + path, { ...init, headers: { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json", ...(init.headers || {}) } });
}
async function rows(path: string): Promise<Row[]> { const r = await db(path); return r.ok ? await r.json() : []; }
async function patchOrder(id: string, body: Row, extra = ""): Promise<Row[]> {
  const r = await db("hc_orders?id=eq." + id + extra, { method: "PATCH", body: JSON.stringify(body), headers: { prefer: "return=representation" } });
  return r.ok ? await r.json() : [];
}
async function config(): Promise<Row> { return (await rows("hc_config?id=eq.1&select=*"))[0] || {}; }
const bare = (u: string) => String(u || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "").toLowerCase();
const site = (u: string) => "https://" + String(u || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "") + "/";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
async function sha(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- order checks ---------- */
function checkOrder(o: Row): string {
  const url = String(o.url || ""), name = String(o.customer_name || o.name || "").trim(), email = String(o.customer_email || o.email || "").trim();
  if (!SITE.test(bare(url))) return "That website address doesn’t look right.";
  if (!name || name.length > 80) return "Add your name.";
  if (!EMAIL.test(email) || email.length > 120) return "Add an email address we can send your report to.";
  const cn = String(o.competitor_name || "").trim(), cu = String(o.competitor_url || "").trim();
  if (!!cn !== !!cu) return "For a competitor, add both their company name and their website, or leave both blank.";
  if (cu && !SITE.test(bare(cu))) return "That competitor’s website address doesn’t look right.";
  return "";
}

/* ---------- Stripe ---------- */
async function makeCheckout(order: Row, cfg: Row): Promise<string> {
  if (!STRIPE) throw new Error("STRIPE_SECRET_KEY is not set");
  const page = String(cfg.report_page_url);
  const f = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": String(cfg.currency || "gbp"),
    "line_items[0][price_data][unit_amount]": String(cfg.price_pence || 499),
    "line_items[0][price_data][product_data][name]": "Website Performance Test",
    "line_items[0][price_data][product_data][description]": `A designer’s review of ${bare(String(order.url))}` + (order.competitor_url ? `, compared with ${bare(String(order.competitor_url))}` : ""),
    customer_email: String(order.customer_email),
    client_reference_id: String(order.id),
    "metadata[order_id]": String(order.id),
    "payment_intent_data[metadata][order_id]": String(order.id),
    success_url: page + "?paid=" + order.id,
    cancel_url: page + "?cancelled=" + order.id,
    expires_at: String(Math.floor(Date.now() / 1000) + 60 * 60),
  });
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", body: f, headers: { authorization: "Bearer " + STRIPE, "content-type": "application/x-www-form-urlencoded", "idempotency-key": "hc-" + order.id } });
  const j = await r.json();
  if (!r.ok || !j.url) throw new Error("Stripe: " + (j?.error?.message || r.status));
  await patchOrder(String(order.id), { status: "checkout", checkout_url: j.url, stripe_session_id: j.id, amount_pence: cfg.price_pence });
  return j.url;
}
async function stripeSigned(raw: string, header: string): Promise<boolean> {
  if (!WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const t = Number(parts.t); if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + raw)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return sigs.some((s) => s.length === hex.length && [...s].every((c, i) => c === hex[i]));
}

/* ---------- email (Resend) ---------- */
async function send(cfg: Row, to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!RESEND || !to) { console.warn("email not sent (no key or no recipient):", subject); return false; }
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + RESEND, "content-type": "application/json" },
    body: JSON.stringify({ from: cfg.from_email, to: [to], subject, html, text }) });
  if (!r.ok) console.error("resend", r.status, await r.text());
  return r.ok;
}
const wrap = (body: string) => `<div style="font:16px/1.55 Arial,sans-serif;color:#0E0F11;max-width:560px">${body}<p>Thanks, Nathan<br><span style="color:#4F5358">34 Automation</span></p></div>`;

async function onPaid(orderId: string, sessionId: string, amount: number) {
  const cfg = await config();
  const now = new Date(), due = dueAfterWorkingMinutes(now, 180);
  const upd = await patchOrder(orderId, { status: "paid", paid_at: now.toISOString(), due_at: due.toISOString(), amount_pence: amount, stripe_session_id: sessionId }, "&status=in.(new,checkout)");
  if (!upd.length) return;   // already handled (Stripe retries) or unknown
  const o = upd[0];
  // measure the site and the competitor straight away, so the designer starts from the automatic results
  const ins = await db("hc_reports", { method: "POST", headers: { prefer: "return=representation" },
    body: JSON.stringify([{ url: site(String(o.url)), source: "order" }].concat(o.competitor_url ? [{ url: site(String(o.competitor_url)), source: "order-competitor" }] : [])) });
  const reps: Row[] = ins.ok ? await ins.json() : [];
  await patchOrder(orderId, { report_id: reps[0]?.id ?? null, competitor_report_id: reps[1]?.id ?? null });
  const dueText = londonText(due), siteName = bare(String(o.url)), comp = o.competitor_url ? `${o.competitor_name} (${bare(String(o.competitor_url))})` : "";
  await send(cfg, String(cfg.reviewer_email || ""), `New Performance Test: ${siteName}, due ${dueText}`,
    wrap(`<p>A Performance Test has been paid for.</p><p><b>Website:</b> ${esc(siteName)}<br>${comp ? `<b>Competitor:</b> ${esc(comp)}<br>` : ""}<b>Due:</b> ${esc(dueText)}</p>${cfg.reviewer_page_url ? `<p><a href="${esc(cfg.reviewer_page_url)}">Open the reviewer screen</a></p>` : ""}`),
    `A Performance Test has been paid for.\nWebsite: ${siteName}\n${comp ? "Competitor: " + comp + "\n" : ""}Due: ${dueText}\n${cfg.reviewer_page_url || ""}\n\nThanks, Nathan`);
  await send(cfg, String(o.customer_email), "Your Performance Test is booked in",
    wrap(`<p>Hi ${esc(o.customer_name)},</p><p>Thanks for ordering a Performance Test for <b>${esc(siteName)}</b>${comp ? `, compared with ${esc(comp)}` : ""}. A designer is going through it now, and your full report will be with you by <b>${esc(dueText)}</b>.</p><p>Stripe sends your payment receipt separately.</p>`),
    `Hi ${o.customer_name},\n\nThanks for ordering a Performance Test for ${siteName}${comp ? ", compared with " + comp : ""}. A designer is going through it now, and your full report will be with you by ${dueText}.\n\nStripe sends your payment receipt separately.\n\nThanks, Nathan\n34 Automation`);
}
async function onDeliver(orderId: string) {
  const cfg = await config();
  const o = (await rows("hc_orders?id=eq." + orderId + "&status=eq.delivered&delivery_emailed_at=is.null&select=*"))[0];
  if (!o) return;
  const link = String(cfg.report_page_url) + "?full=" + o.access_token, siteName = bare(String(o.url));
  const ok = await send(cfg, String(o.customer_email), `Your Performance Test for ${siteName} is ready`,
    wrap(`<p>Hi ${esc(o.customer_name)},</p><p>Your Performance Test for <b>${esc(siteName)}</b> is ready.</p><p><a href="${esc(link)}" style="display:inline-block;background:#C9A24C;color:#0E0F11;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">Open your report</a></p><p>The link is private to you. Keep this email to come back to it.</p>`),
    `Hi ${o.customer_name},\n\nYour Performance Test for ${siteName} is ready:\n${link}\n\nThe link is private to you. Keep this email to come back to it.\n\nThanks, Nathan\n34 Automation`);
  if (ok) await patchOrder(orderId, { delivery_emailed_at: new Date().toISOString() });
}
const background = (p: Promise<unknown>) => { const er = (globalThis as unknown as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime; if (er?.waitUntil) er.waitUntil(p); };

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const u = new URL(req.url);

    if (req.method === "GET") {
      const st = u.searchParams.get("status"), token = u.searchParams.get("token");
      if (u.searchParams.has("open")) { const cfg = await config(); return json({ open: !!cfg.paid_on, price_pence: cfg.price_pence, privacy_url: cfg.privacy_url }); }
      if (st && UUID.test(st)) {
        const o = (await rows("hc_orders?id=eq." + st + "&select=status,due_at,url"))[0];
        return o ? json({ status: o.status, due_at: o.due_at, due_text: o.due_at ? londonText(new Date(String(o.due_at))) : null, site: bare(String(o.url)) }) : json({ error: "No order with that reference." }, 404);
      }
      if (token && /^[0-9a-f]{48}$/.test(token)) {
        const o = (await rows("hc_orders?access_token=eq." + token + "&status=eq.delivered&select=id,url,competitor_name,competitor_url,review,delivered_at,report_id,competitor_report_id"))[0];
        if (!o) return json({ error: "That report link isn’t valid, or the report isn’t ready yet." }, 404);
        const [rep] = await rows("hc_reports?id=eq." + o.report_id + "&select=report");
        const [comp] = o.competitor_report_id ? await rows("hc_reports?id=eq." + o.competitor_report_id + "&select=report") : [];
        return json({ order: { site: bare(String(o.url)), competitor_name: o.competitor_name, competitor_url: o.competitor_url, review: o.review, delivered_at: o.delivered_at }, report: rep?.report || null, competitor_report: comp?.report || null });
      }
      return json({ error: "Nothing asked for." }, 400);
    }
    if (req.method !== "POST") return json({ error: "Use GET or POST." }, 405);

    // Stripe webhook: the raw body is needed for the signature check
    if (u.pathname.endsWith("/stripe")) {
      const raw = await req.text();
      if (!(await stripeSigned(raw, req.headers.get("stripe-signature") || ""))) return json({ error: "bad signature" }, 400);
      const ev = JSON.parse(raw);
      if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
        const s = ev.data?.object || {};
        const id = s.metadata?.order_id || s.client_reference_id;
        if (UUID.test(String(id)) && s.payment_status === "paid") background(onPaid(String(id), String(s.id), Number(s.amount_total) || 0));
      } else if (ev.type === "checkout.session.expired") {
        const id = ev.data?.object?.metadata?.order_id;
        if (UUID.test(String(id))) await patchOrder(String(id), { status: "expired" }, "&status=eq.checkout");
      }
      return json({ received: true });
    }

    let body: Row = {};
    try { body = await req.json(); } catch { return json({ error: "Send JSON." }, 400); }

    if (body.action === "deliver" && UUID.test(String(body.id))) { background(onDeliver(String(body.id))); return json({ ok: true }); }
    if (body.action === "checkout" && UUID.test(String(body.id))) {
      const o = (await rows("hc_orders?id=eq." + body.id + "&status=eq.new&select=*"))[0];
      if (!o) return json({ ok: false }, 404);
      const cfg = await config();
      if (!cfg.paid_on) { await patchOrder(String(o.id), { status: "error", error: "We’re not taking Performance Test orders just yet, so nothing has been charged." }); return json({ ok: false }); }
      const bad = checkOrder(o); if (bad) { await patchOrder(String(o.id), { status: "error", error: bad }); return json({ ok: false }); }
      try { await makeCheckout(o, cfg); } catch (e) { console.error(e); await patchOrder(String(o.id), { status: "error", error: FAILED }); }
      return json({ ok: true });
    }

    // the web order form
    const cfg = await config();
    if (!cfg.paid_on) return json({ error: "We’re not taking Performance Test orders just yet, so nothing has been sent or charged." }, 503);
    if (body.consent !== true) return json({ error: "Please tick to agree to the privacy notice." }, 400);
    const comp = (body.competitor || {}) as Row;
    const order: Row = { url: bare(String(body.url || "")), customer_name: String(body.name || "").trim(), customer_email: String(body.email || "").trim(),
      competitor_name: String(comp.name || "").trim() || null, competitor_url: comp.url ? bare(String(comp.url)) : null };
    const bad = checkOrder(order); if (bad) return json({ error: bad }, 400);
    const ipHash = await sha(((req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown") + "|" + SB);
    const recent = await db("hc_orders?select=id&ip_hash=eq." + ipHash + "&created_at=gte." + encodeURIComponent(new Date(Date.now() - 3600_000).toISOString()), { headers: { prefer: "count=exact", range: "0-0" } });
    if (Number((recent.headers.get("content-range") || "/0").split("/")[1]) >= 5) return json({ error: "That’s a lot of orders in one hour. Try again a little later." }, 429);
    const ins = await db("hc_orders", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ ...order, consent_at: new Date().toISOString(), source: "web", ip_hash: ipHash }) });
    const made: Row[] = ins.ok ? await ins.json() : [];
    if (!made.length) return json({ error: FAILED }, 500);
    try { return json({ checkout_url: await makeCheckout(made[0], cfg) }); }
    catch (e) { console.error(e); await patchOrder(String(made[0].id), { status: "error", error: FAILED }); return json({ error: FAILED }, 502); }
  } catch (e) {
    console.error("hc-order", e);
    return json({ error: "Something went wrong. Try again in a few minutes." }, 500);
  }
});

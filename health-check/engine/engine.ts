// Website Health Check engine. Web-standard APIs only (fetch, URL, AbortController),
// so the same file runs in a Supabase Edge Function (Deno) and under Node 22 for tests.
// It measures a site from outside and returns one report: 18 checks scored 0-10 (or
// null = Not measured) plus the raw comparison measures the report page draws.
//
// The scoring rules below are a first draft written for the automated build. They have
// NOT been reviewed by Ruby or Leo. Every threshold lives in RUBRIC so it can be tuned
// in one place.

export const ENGINE_VERSION = "1.2.1";

export interface Options {
  allowLocal?: boolean;        // tests only: lets the engine fetch localhost
  psiKey?: string;             // Google PageSpeed Insights API key (optional)
  now?: Date;
  timeoutMs?: number;
  maxPages?: number;
  fetchImpl?: typeof fetch;
}
export interface CheckResult {
  score: number | null;        // 0-10, one decimal. null = Not measured
  flaw: string;                // short "Found" line
  finding: string;             // one sentence of detail
  nm?: string;                 // why it wasn't measured
  basis: "measured" | "rule" | "not-measured";
  evidence?: Record<string, unknown>;
  note?: string;               // shown under the check on the report
}
export interface Report {
  schema: "hc-report/1";
  engine: string;
  url: string;
  domain: string;
  name: string;
  tested: string;
  sources: { psi: boolean; pages: number };
  checks: Record<string, CheckResult>;
  values: Record<string, { v: unknown; at: string; runs?: number[]; nm?: string }>;
  pages: { url: string; status: number; title: string }[];
  screenshot?: string;
  notes: string[];
  sector?: { key: string; label: string; scores: Record<string, number> };
}

/* ------------------------------------------------------------------ rubric */
export const RUBRIC = {
  // piecewise-linear maps: [measure, score]
  weightKiB: [[500, 10], [1600, 8], [3000, 6], [5000, 4], [8000, 2.5], [12000, 1]],
  ttfbS: [[0.2, 10], [0.8, 8], [1.8, 5], [3, 3], [5, 1]],
  lcpS: [[1.2, 10], [2.5, 8], [4, 6], [6, 4], [8, 3], [12, 1]],
  https: { none: 2.0, noRedirect: 5.0, mixed: 6.0, clean: 9.5 },
  tap: { link: 9.0, numberNoLink: 5.0, noNumber: 3.0 },
  responsive: { noViewport: 2.5, viewportOnly: 5.0, viewportAndBreakpoints: 8.0 },
  quote: { formWithUpload: 9.0, form: 7.0, mailtoOnly: 3.5, nothing: 2.0 },
  reply: { found: 8.0, notFound: 4.0 },
  cases: { none: 1.5, testimonialsOnly: 5.0, page: 7.0, pageWithSeveral: 8.5 },
  certs: { none: 3.0, named: 6.5, shown: 9.0 },
  titles: { noTitle: 2.0, allSame: 3.0, someSame: 5.0, uniqueNoDesc: 6.5, uniqueWithDesc: 9.0, onePage: 8.0 },
  spec: { both: 8.0, one: 5.0, neither: 3.0 },
  machines: { listed: 7.5, listedStale: 6.0, pageOnly: 5.0, none: 3.0 },
  headline: { none: 2.5, generic: 3.0, tooShort: 4.5, recorded: 7.0 },
  hero: { noImages: 3.0 },
  // main image, scored on resolution only: width in pixels of the largest version the site offers
  heroWidth: [[2560, 9.0, "Sharp on large and high-resolution screens"], [1920, 8.0, "Sharp on standard desktop screens"], [1600, 6.5, "Fine on laptops, slightly soft on large screens"], [1280, 5.0, "Soft on desktop screens"], [800, 3.0, "Blurry or pixelated on desktop screens"], [0, 1.5, "Too small for a main image"]] as [number, number, string][],
  tools: { none: 2.0, one: 8.0, several: 9.0 },
  platform: { legacy: 2.5, unsupported: 3.0, behind: 6.0, supported: 8.0, staleBy: 1.5, noOutsideScriptsBy: 0.5, freshBonus: 0.5 },
} as const;

function lerp(points: readonly (readonly number[])[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return points[points.length - 1][1];
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.max(0, Math.min(10, n));
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

/* ------------------------------------------------------------- url + guard */
export function normaliseUrl(input: string): URL {
  let s = String(input || "").trim();
  if (!s) throw new HcError("bad_url", "Enter a website address.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try { u = new URL(s); } catch { throw new HcError("bad_url", "That website address doesn’t look right."); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new HcError("bad_url", "Only http and https addresses can be checked.");
  u.hash = ""; u.username = ""; u.password = "";
  return u;
}
export class HcError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
  if (h.includes(":")) return true;                       // any IPv6 literal
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) return true;                                      // bare IPv4 addresses are never a public website name
  if (/^\d+$/.test(h) || /^0x/i.test(h)) return true;      // decimal / hex encoded addresses
  if (!h.includes(".")) return true;
  return false;
}
function guard(u: URL, o: Options) {
  if (o.allowLocal) return;
  if (isPrivateHost(u.hostname)) throw new HcError("blocked_host", "That address can’t be checked.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new HcError("blocked_host", "That address can’t be checked.");
}

/* ------------------------------------------------------------------- fetch */
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 WebsiteHealthCheck/1.0";
interface Fetched { ok: boolean; status: number; url: string; chain: string[]; headers: Headers | null; text: string; raw?: Uint8Array; bytes: number; sized: boolean; ttfb: number; error?: string }

async function get(start: string, o: Options, want: "text" | "size" | "head" | "bytes" = "text", maxBytes = 3_000_000): Promise<Fetched> {
  const f = o.fetchImpl || fetch;
  const chain: string[] = [];
  let url = start, ttfb = 0;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs || 12000);
  try {
    for (let hop = 0; hop < 6; hop++) {
      const u = new URL(url);
      guard(u, o);
      chain.push(url);
      const t0 = Date.now();
      const res = await f(url, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": UA, "accept": "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en-GB,en;q=0.9" } });
      ttfb = (Date.now() - t0) / 1000;
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        url = new URL(res.headers.get("location")!, url).toString();
        continue;
      }
      let text = "", bytes = 0; let raw: Uint8Array | undefined;
      const len = Number(res.headers.get("content-length") || 0);
      if (want === "head" || (want === "size" && len > 0)) {
        bytes = len; try { await res.body?.cancel(); } catch { /* ignore */ }
      } else if (res.body) {
        const reader = res.body.getReader(); const chunks: Uint8Array[] = [];
        for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (want === "text" || want === "bytes") chunks.push(value); if (bytes > maxBytes) { try { await reader.cancel(); } catch { /* ignore */ } break; } }
        if (want === "text" || want === "bytes") { const all = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0)); let p = 0; for (const c of chunks) { all.set(c, p); p += c.byteLength; } if (want === "text") text = new TextDecoder("utf-8").decode(all); else raw = all; }
        if (len > 0 && len < bytes) bytes = len;             // transfer size when the server states it
      }
      return { ok: res.status >= 200 && res.status < 300, status: res.status, url, chain, headers: res.headers, text, raw, bytes, sized: len > 0, ttfb };
    }
    return { ok: false, status: 0, url, chain, headers: null, text: "", bytes: 0, sized: false, ttfb, error: "too many redirects" };
  } catch (e) {
    if (e instanceof HcError) throw e;
    return { ok: false, status: 0, url, chain, headers: null, text: "", bytes: 0, sized: false, ttfb, error: String((e as Error)?.message || e) };
  } finally { clearTimeout(timer); }
}
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

/* -------------------------------------------------------------- html tools */
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£", copy: "©", reg: "®", trade: "™", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", plusmn: "±", micro: "µ", deg: "°" };
function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : " "; }
    return ENT[e.toLowerCase()] ?? m;
  });
}
function attrs(tag: string): Record<string, string> {
  const o: Record<string, string> = {}; const re = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g; let m;
  const body = tag.replace(/^<\/?[a-zA-Z][\w:-]*/, "");
  while ((m = re.exec(body))) o[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return o;
}
function openTags(html: string, name: string): Record<string, string>[] {
  const re = new RegExp("<" + name + "\\b[^>]*>", "gi"); return (html.match(re) || []).map(attrs);
}
function blocks(html: string, name: string): { a: Record<string, string>; inner: string }[] {
  const re = new RegExp("<" + name + "\\b([^>]*)>([\\s\\S]*?)</" + name + "\\s*>", "gi"); const out = []; let m;
  while ((m = re.exec(html))) out.push({ a: attrs("<" + name + m[1] + ">"), inner: m[2] });
  return out;
}
function strip(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi, " ");
}
function textOf(html: string): string {
  return decode(strip(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
interface Link { href: string; text: string; raw: string }
function links(html: string, base: string): Link[] {
  const out: Link[] = [];
  for (const b of blocks(strip(html), "a")) {
    const raw = (b.a.href || "").trim(); if (!raw) continue;
    let href = raw; try { href = new URL(raw, base).toString(); } catch { /* keep raw */ }
    const img = /<img\b[^>]*>/i.exec(b.inner);
    const text = (textOf(b.inner) || (img ? attrs(img[0]).alt || "" : "") || b.a.title || b.a["aria-label"] || "").slice(0, 120);
    out.push({ href, text, raw });
  }
  return out;
}
const sameSite = (a: string, b: string) => { try { return new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, ""); } catch { return false; } };
const noHash = (u: string) => u.replace(/#.*$/, "");

interface Page { url: string; status: number; html: string; text: string; title: string; links: Link[]; kind: string }
function makePage(f: Fetched, kind: string): Page {
  const t = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(f.text);
  return { url: f.url, status: f.status, html: f.text, text: textOf(f.text), title: t ? decode(t[1]).replace(/\s+/g, " ").trim() : "", links: links(f.text, f.url), kind };
}

/* --------------------------------------------------------------- patterns */
const P = {
  contact: /contact|quote|enquir|inquir|get[-\s]?in[-\s]?touch|rfq/i,
  cases: /case[-\s]?stud|projects?\b|portfolio|our[-\s]?work|success[-\s]?stor|^\s*(selected |recent |see (the |our )?)?work\s*$|\/work\/?$/i,
  caseSection: /^(work|our-?work|selected-?work|recent-?work|case-?stud(y|ies)|projects?|portfolio|results|clients-?work)$/i,
  testimonials: /testimonial|reviews?\b|what our (clients|customers) say/i,
  spec: /capabilit|specification|\bspecs?\b|tolerance|materials|services|what[-\s]?we[-\s]?do|precision|machining/i,
  machines: /machine|plant[-\s]?list|equipment|facilit|capacity|our[-\s]?kit|workshop/i,
  about: /about|who[-\s]?we[-\s]?are|company/i,
  quality: /quality|accreditation|certif|approvals?/i,
  generic: /^(welcome|welcome to .{0,40}|home|home ?page|index|untitled|hello|welcome to our (web)?site!?)$/i,
  phone: /(\+44\s?\(?0?\)?\s?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}|\(?0\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4})/,
  reply: /(within|in)\s+(\d+|one|two|three|24|48)\s*(working\s+|business\s+)?(hours?|hrs?|days?)|same[-\s]day (reply|response|quote)|next[-\s]working[-\s]day|respond(s|ing)? (to all enquiries )?within|get back to you within|reply within|quotes? (back )?(within|in) /i,
  tolerance: /±\s?\d|\+\s?\/\s?-\s?\d|\d\s?(µm|μm|microns?)\b|\b\d+(\.\d+)?\s?thou\b|tolerances? (of|to|down to|as tight as|within) [±+]?\s?\d/i,
  material: /\b(stainless|alumin(i)?um|titanium|brass|copper|mild steel|carbon steel|tool steel|inconel|hastelloy|duplex|bronze|316L?|304L?|6082|7075|EN ?\d{1,2}[A-Z]?|peek|acetal|delrin|nylon|ptfe|polycarbonate|monel|magnesium)\b/i,
  machineBrand: /\b(mazak|dmg ?mori|mori seiki|haas|doosan|hurco|okuma|matsuura|citizen|star micronics|trumpf|amada|bystronic|mitutoyo|zeiss|fanuc|hermle|makino|xyz machine|colchester|bridgeport|nakamura|miyano|index traub|kitamura|leadwell|dugard|hardinge|studer|jones ?& ?shipman|agie|sodick|charmilles|lvd|durma|safan|faro|hexagon|renishaw|aberlink|esab|kemppi|fronius|engel|arburg|krauss ?maffei|sumitomo|demag|battenfeld|brother speedio|biglia|spinner|chiron|grob|heller|dn solutions|tornos|gildemeister|deckel|maho|cincinnati|kasto|flow waterjet|omax)\b/gi,
  standard: /\b(ISO\s?-?\s?9001|ISO\s?-?\s?14001|ISO\s?-?\s?45001|ISO\s?-?\s?13485|ISO\s?-?\s?27001|ISO\s?-?\s?3834|AS\s?-?\s?9100|AS\s?-?\s?9120|IATF\s?-?\s?16949|BS\s?EN\s?1090|EN\s?1090|NADCAP|Cyber Essentials|SafeContractor|Constructionline|CHAS|JOSCAR|SC21|Fit\s?4\s?Nuclear|UKAS|Investors in People|Achilles|RISQS|Gas Safe|NICEIC|TrustMark)\b/i,
  certBody: /bsigroup\.|ukas\.com|nqa\.com|lrqa\.|iafcertsearch\.|sgs\.com|tuv|dnv\.|intertek\.|isoqar|alcumus|bmtrada|qms(uk)?\.|british-assessment|ncsc\.gov\.uk|iasme\./i,
  certFile: /(cert|iso|as9100|accredit|approval)[^"'\s]*\.(pdf|jpe?g|png)/i,
  stockHost: /shutterstock|istockphoto|gettyimages|unsplash\.com|pexels\.com|stock\.adobe|depositphotos|123rf|dreamstime|pixabay/i,
};
const CHAT: [string, RegExp][] = [
  ["Intercom", /widget\.intercom\.io|intercomSettings/i], ["Drift", /js\.driftt\.com|drift\.com\/widget/i], ["Tawk.to", /embed\.tawk\.to/i],
  ["Crisp", /client\.crisp\.chat/i], ["Tidio", /code\.tidio\.co/i], ["LiveChat", /cdn\.livechatinc\.com/i], ["Zendesk", /static\.zdassets\.com|zopim/i],
  ["HubSpot chat", /js\.usemessages\.com|js\.hs-scripts\.com/i], ["Olark", /static\.olark\.com/i], ["Freshchat", /wchat\.freshchat\.com|fw-cdn\.com/i],
  ["Smartsupp", /smartsuppchat\.com/i], ["JivoChat", /code\.jivosite\.com|jivo\.chat/i], ["Zoho SalesIQ", /salesiq\.zoho/i], ["Chatwoot", /chatwoot/i],
  ["Messenger chat", /customerchat|m\.me\//i], ["Chatbase", /chatbase\.co/i], ["Botpress", /cdn\.botpress\.cloud/i], ["Voiceflow", /cdn\.voiceflow\.com/i],
  ["Landbot", /landbot\.io/i], ["Userlike", /userlike-cdn/i], ["Gorgias", /gorgias\.chat/i], ["Pure Chat", /app\.purechat\.com/i], ["LiveAgent", /ladesk\.com/i],
  ["Elfsight chat", /elfsight.*chat/i], ["Chaport", /app\.chaport\.com/i], ["Help Scout Beacon", /beacon-v2\.helpscout\.net/i],
];
const WHATSAPP = /wa\.me\/|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send|whatsapp:\/\/send|chat\.whatsapp\.com/i;
const BOOKING: [string, RegExp][] = [
  ["Calendly", /calendly\.com/i], ["Cal.com", /\bcal\.com\//i], ["Acuity", /acuityscheduling\.com/i], ["Square Appointments", /squareup\.com\/appointments|square\.site\/book/i],
  ["SimplyBook", /simplybook\.(me|it)/i], ["Setmore", /setmore\.com/i], ["YouCanBookMe", /youcanbook\.me/i], ["HubSpot meetings", /meetings\.hubspot\.com/i],
  ["Microsoft Bookings", /outlook\.office(365)?\.com\/(owa\/calendar|book)/i], ["TidyCal", /tidycal\.com/i], ["SavvyCal", /savvycal\.com/i], ["Bookwhen", /bookwhen\.com/i],
  ["Zoho Bookings", /zohobookings|bookings\.zoho/i], ["Fresha", /fresha\.com/i], ["Booksy", /booksy\.com/i], ["Google appointments", /calendar\.google\.com\/calendar\/appointments|calendar\.app\.google/i],
];

/* ------------------------------------------------------------ image sizes */
// Pixel size from the first bytes of an image file: JPEG, PNG, GIF, WebP and AVIF.
export function imageSize(b: Uint8Array): { w: number; h: number; type: string } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1], u32 = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const le16 = (i: number) => b[i] | (b[i + 1] << 8), le24 = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const str = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b.length < 24) return null;
  if (b[0] === 0x89 && str(1, 3) === "PNG") return { w: u32(16), h: u32(20), type: "PNG" };
  if (str(0, 3) === "GIF") return { w: le16(6), h: le16(8), type: "GIF" };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i += m === 0xff ? 1 : 2; continue; }
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { w: u16(i + 7), h: u16(i + 5), type: "JPEG" };
      i += 2 + u16(i + 2);
    }
    return null;
  }
  if (str(0, 4) === "RIFF" && str(8, 4) === "WEBP") {
    const c = str(12, 4);
    if (c === "VP8X") return { w: 1 + le24(24), h: 1 + le24(27), type: "WebP" };
    if (c === "VP8 ") return { w: le16(26) & 0x3fff, h: le16(28) & 0x3fff, type: "WebP" };
    if (c === "VP8L") { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1, type: "WebP" }; }
    return null;
  }
  if (str(4, 4) === "ftyp" && /avif|avis|mif1|heic/.test(str(8, 4) + str(16, 16))) {
    let best: { w: number; h: number } | null = null;
    for (let i = 0; i + 20 < b.length; i++) if (b[i] === 0x69 && str(i, 4) === "ispe") { const w = u32(i + 8), h = u32(i + 12); if (!best || w * h > best.w * best.h) best = { w, h }; }
    return best ? { ...best, type: "AVIF" } : null;
  }
  return null;
}
// Frame size of an MP4/MOV video from its track header (only when that header is near the start of the file).
export function videoSize(b: Uint8Array): { w: number; h: number; type: string } | null {
  const u32 = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  let best: { w: number; h: number } | null = null;
  for (let i = 4; i + 100 < b.length; i++) {
    if (b[i] !== 0x74 || b[i + 1] !== 0x6b || b[i + 2] !== 0x68 || b[i + 3] !== 0x64) continue;   // "tkhd"
    const start = i - 4, off = b[i + 4] === 1 ? 96 : 84;
    const w = u32(start + off) >>> 16, h = u32(start + off + 4) >>> 16;
    if (w > 0 && h > 0 && w < 20000 && (!best || w * h > best.w * best.h)) best = { w, h };
  }
  return best ? { ...best, type: "video" } : null;
}
// Site builders serve a small or blurred placeholder first and swap in the real image with script.
// Ask their image servers for the original instead.
export function fullImageUrl(u: string): string {
  const wix = /^(https:\/\/static\.wixstatic\.com\/media\/[^/]+?\.(?:jpe?g|png|webp|gif))\/v1\//i.exec(u);
  if (wix) return wix[1];
  if (/squarespace-cdn\.com\//i.test(u)) return u.replace(/[?&]format=\d+w/i, "").replace(/(\?|$)/, (m) => (m ? "?format=2500w&" : "?format=2500w"));
  if (/cdn\.shopify\.com\//i.test(u)) return u.replace(/_(\d+x\d*|\d*x\d+)(?=\.)/, "").replace(/([?&])width=\d+&?/, "$1");
  return u;
}
function srcsetBest(srcset: string, base: string): string | null {
  let best: { u: string; n: number } | null = null;
  for (const part of srcset.split(/,\s+(?=\S)/)) {
    const [u, d] = part.trim().split(/\s+/); if (!u) continue;
    const n = d ? parseFloat(d) * (/x$/i.test(d) ? 1000 : 1) : 1;
    if (!best || n > best.n) { try { best = { u: new URL(u, base).toString(), n }; } catch { /* ignore */ } }
  }
  return best ? best.u : null;
}

/* ---------------------------------------------------------------- sectors */
// What the site is for, read from its words. The page title, description and main headings count three times.
const SECTORS: { key: string; label: string; re: RegExp }[] = [
  { key: "manufacturing", label: "a manufacturer or engineering firm", re: /\b(cnc|machin(ing|ed|ist)|turning|milling|grinding|fabricat\w*|precision engineer\w*|toolmak\w*|sheet metal|welding|castings?|forgings?|injection mould\w*|presswork|turned parts|laser cutting|powder coat\w*|we manufacture|manufactur(er|ers) of|sub-?contract (machining|manufacturing)|plant list|as ?9100)\b/gi },
  { key: "agency", label: "a digital or marketing agency", re: /\b(web ?design|websites|website (design|builds?|rebuilds?|overhauls?)|web development|seo|digital marketing|marketing agency|branding|brand identity|lead magnets?|landing pages?|social media|ppc|content marketing|agency|quote systems?|ai (tools|agents|workflows))\b/gi },
  { key: "charity", label: "a charity or community organisation", re: /\b(registered charity|charity (no|number)|charit(y|able)|donat(e|ion|ions)|volunteer\w*|fundrais\w*|community (group|interest|organisation|project)|community interest company|non-profit|not-for-profit|young people|support group)\b/gi },
  { key: "trades", label: "a trades or home-services business", re: /\b(plumb\w*|electricians?|roofing|roofers?|boilers?|heating engineers?|gas safe|builders?|joinery|carpent\w*|plaster\w*|decorators?|landscap\w*|kitchen fitt\w*|bathroom fitt\w*|loft conversions?|niceic|emergency call-?outs?)\b/gi },
  { key: "retail", label: "a shop or online store", re: /\b(add to (basket|cart|bag)|basket|checkout|free delivery|shop now|in stock|online shop|buy now)\b/gi },
  { key: "professional", label: "a professional services firm", re: /\b(solicitors?|law firm|legal services|accountan\w*|bookkeep\w*|tax returns?|financial advis\w*|consultan(cy|ts?)|recruitment|estate agents?|surveyors?|architects?|insurance brok\w*)\b/gi },
  { key: "hospitality", label: "a hospitality or leisure business", re: /\b(restaurant|book a table|caf[eé]|pub|hotel|bed and breakfast|wedding venue|events venue|takeaway|brunch)\b/gi },
  { key: "health", label: "a health, beauty or wellbeing business", re: /\b(clinic|dentists?|dental|physio\w*|chiropract\w*|salon|beauty|aesthetics?|treatments?|therap(y|ist)|massage|osteopath\w*|opticians?|veterinary)\b/gi },
];
function sectorOf(hero: string, body: string): { key: string; label: string; scores: Record<string, number> } {
  const scores: Record<string, number> = {};
  for (const x of SECTORS) scores[x.key] = 3 * (hero.match(x.re) || []).length + Math.min(20, (body.match(x.re) || []).length);
  const ranked = [...SECTORS].sort((a, b) => scores[b.key] - scores[a.key]);
  const top = ranked[0], second = ranked[1];
  if (scores[top.key] < 4 || scores[top.key] < 1.5 * scores[second.key]) return { key: "unknown", label: "", scores };
  return { key: top.key, label: top.label, scores };
}
const WHO = /\bfor\s+((?:the\s+)?(?:[\w&'’-]+\s+){0,3}?(?:firms|companies|businesses|manufacturers|engineers|homeowners|landlords|families|parents|children|young people|schools|charities|retailers|brands|startups|contractors|trade|traders|industry|sector|aerospace|automotive|medical|defence|nuclear|rail|marine|construction|food|pharma\w*|clients|customers|people|teams|owners))\b/i;
const WHERE = /\b(uk|united kingdom|britain|england|scotland|wales|northern ireland|london|manchester|birmingham|leeds|sheffield|bristol|liverpool|newcastle|nottingham|leicester|glasgow|edinburgh|cardiff|belfast|nationwide|[a-z]+shire|yorkshire|midlands)\b/i;

/* --------------------------------------------------------------- platform */
interface Platform { name: string; version?: string; status: "supported" | "behind" | "unsupported" | "legacy" | "unknown"; note: string }
function detectPlatform(html: string, headers: Headers | null): Platform {
  const gen = (openTags(html, "meta").find((m) => (m.name || "").toLowerCase() === "generator")?.content || "").trim();
  const xgen = headers?.get("x-generator") || "", powered = headers?.get("x-powered-by") || "";
  const hosted = (name: string): Platform => ({ name, status: "supported", note: `${name} is a hosted platform that’s kept up to date for you.` });
  if (/wix\.com/i.test(gen) || /static\.(wixstatic|parastorage)\.com/i.test(html) || headers?.get("x-wix-request-id")) return hosted("Wix");
  if (/squarespace/i.test(gen) || /static1\.squarespace\.com|This is Squarespace/i.test(html)) return hosted("Squarespace");
  if (/cdn\.shopify\.com|Shopify\.theme/i.test(html)) return hosted("Shopify");
  if (/webflow/i.test(gen) || /data-wf-site=/i.test(html)) return hosted("Webflow");
  if (/weebly/i.test(gen) || /cdn\d?\.editmysite\.com/i.test(html)) return hosted("Weebly");
  if (/godaddy|starfield/i.test(gen) || /img1\.wsimg\.com/i.test(html)) return hosted("GoDaddy Website Builder");
  if (/duda/i.test(gen) || /irp\.cdn-website\.com|dudaone/i.test(html)) return hosted("Duda");
  if (/hubspot/i.test(gen)) return hosted("HubSpot CMS");
  if (/framer/i.test(gen) || /framerusercontent\.com/i.test(html)) return hosted("Framer");
  if (/jimdo/i.test(gen) || /jimstatic\.com/i.test(html)) return hosted("Jimdo");
  if (/ionos|1&1|mywebsite/i.test(gen)) return hosted("IONOS MyWebsite");
  if (/rocketspark/i.test(html)) return hosted("Rocketspark");
  if (/frontpage/i.test(gen)) return { name: "Microsoft FrontPage", status: "legacy", note: "Built with Microsoft FrontPage, which was discontinued in 2006." };
  if (/adobe muse/i.test(gen) || /museutils|musecdn/i.test(html)) return { name: "Adobe Muse", status: "legacy", note: "Built with Adobe Muse, which Adobe stopped supporting in 2020." };
  if (/InstanceBegin template=|\.dwt"/i.test(html) || /dreamweaver/i.test(gen)) return { name: "Dreamweaver template", status: "legacy", note: "A hand-built Dreamweaver template site." };
  if (/golive/i.test(gen)) return { name: "Adobe GoLive", status: "legacy", note: "Built with Adobe GoLive, discontinued in 2008." };
  const dr = /drupal\s*(\d+)?/i.exec(gen + " " + xgen);
  if (dr || /Drupal\.settings|\/sites\/(default|all)\/(files|themes|modules)|\/misc\/drupal\.js|data-drupal-/i.test(html)) {
    let v = dr?.[1] ? Number(dr[1]) : /Drupal\.settings|\/misc\/drupal\.js/i.test(html) ? 7 : /data-drupal-/i.test(html) ? 0 : 0;
    if (!v) return { name: "Drupal", status: "unknown", note: "Runs on Drupal; the version isn’t shown." };
    const eol: Record<number, string> = { 5: "2011", 6: "February 2016", 7: "January 2025", 8: "November 2021", 9: "November 2023" };
    if (eol[v]) return { name: "Drupal", version: String(v), status: "unsupported", note: `Drupal ${v}, out of security support since ${eol[v]}.` };
    return { name: "Drupal", version: String(v), status: "supported", note: `Drupal ${v}, a supported version.` };
  }
  if (/joomla/i.test(gen) || /\/media\/jui\/|\/media\/system\/js\/|\/components\/com_/i.test(html)) {
    if (/\/media\/jui\//i.test(html)) return { name: "Joomla", version: "3", status: "unsupported", note: "Joomla 3, out of security support since August 2023." };
    return { name: "Joomla", status: "unknown", note: "Runs on Joomla; the version isn’t shown." };
  }
  const wp = /wordpress\s*([\d.]+)?/i.exec(gen);
  if (wp || /\/wp-content\/|\/wp-includes\//i.test(html)) {
    let ver = wp?.[1] || "";
    if (!ver) { const m = /wp-includes\/[^"']+\?ver=(\d+\.\d+(?:\.\d+)?)/i.exec(html); if (m) ver = m[1]; }
    if (!ver) return { name: "WordPress", status: "supported", note: "Runs on WordPress; the version is hidden, which is good practice." };
    const [maj, min] = ver.split(".").map(Number); const n = maj + (min || 0) / 10;
    if (n < 6.0) return { name: "WordPress", version: ver, status: "unsupported", note: `WordPress ${ver}, several major versions behind and missing security updates.` };
    if (n < 6.7) return { name: "WordPress", version: ver, status: "behind", note: `WordPress ${ver}, behind the current release.` };
    return { name: "WordPress", version: ver, status: "supported", note: `WordPress ${ver}, a recent version.` };
  }
  if (/magento|mage\/cookies|Mage\.Cookies/i.test(html + gen)) return { name: "Magento", status: "unknown", note: "Runs on Magento; the version isn’t shown." };
  if (/prestashop/i.test(gen + html.slice(0, 20000))) return { name: "PrestaShop", status: "unknown", note: "Runs on PrestaShop; the version isn’t shown." };
  if (/typo3/i.test(gen)) return { name: "TYPO3", status: "unknown", note: "Runs on TYPO3; the version isn’t shown." };
  if (/umbraco/i.test(html)) return { name: "Umbraco", status: "unknown", note: "Runs on Umbraco; the version isn’t shown." };
  if (/craft cms/i.test(gen + powered)) return { name: "Craft CMS", status: "supported", note: "Runs on Craft CMS." };
  if (/__NEXT_DATA__|\/_next\/static\//i.test(html)) return { name: "Next.js", status: "supported", note: "A custom site built on Next.js, a current framework." };
  if (/__NUXT__|\/_nuxt\//i.test(html)) return { name: "Nuxt", status: "supported", note: "A custom site built on Nuxt, a current framework." };
  if (/gatsby/i.test(gen) || /___gatsby/i.test(html)) return { name: "Gatsby", status: "supported", note: "A custom site built on Gatsby." };
  if (/astro/i.test(gen)) return { name: "Astro", status: "supported", note: "A custom site built on Astro, a current framework." };
  if (gen) return { name: gen.slice(0, 60), status: "unknown", note: `Built with ${gen.slice(0, 60)}.` };
  // no CMS or site builder found: judge the page code itself and where it's hosted
  const host = hostOf(headers);
  const on = host ? ` on ${host}` : "";
  const html5 = /^\s*(<!--[\s\S]*?-->\s*)*<!doctype html\s*>/i.test(html);
  const oldDoctype = /<!doctype html public "-\/\/w3c\/\/dtd (x?html 1|html 4|html 3)/i.test(html);
  const oldMarkup = (html.match(/<font\b|<center\b|<frameset\b|\bbgcolor=|<marquee\b/gi) || []).length + ((html.match(/<table\b/gi) || []).length >= 4 ? 2 : 0);
  const viewport = /<meta[^>]+name=["']?viewport/i.test(html);
  if (oldDoctype || oldMarkup >= 2 || (!html5 && !viewport)) return { name: "Hand-built site", status: "legacy", note: `An older hand-built site${on}: the page code is dated and isn’t set up for phones.` };
  if (html5 && viewport) return { name: "Custom-built site", status: "supported", note: `A custom-built site${on} with current page code. Whoever looks after the code can add chat, WhatsApp, booking or an AI assistant directly.` };
  return { name: "Custom-built site", status: "behind", note: `A hand-built site${on}. Chat or booking can be added, but how easily depends on who looks after the code.` };
}
function hostOf(h: Headers | null): string {
  if (!h) return "";
  const server = (h.get("server") || "").toLowerCase();
  if (h.get("cf-ray") || server === "cloudflare") return "Cloudflare";
  if (h.get("x-vercel-id") || server === "vercel") return "Vercel";
  if (h.get("x-nf-request-id") || server.startsWith("netlify")) return "Netlify";
  if (server === "github.com") return "GitHub Pages";
  if (h.get("x-amz-cf-id")) return "Amazon CloudFront";
  if (h.get("x-firebase-hosting") || /firebase/.test(server)) return "Firebase";
  return "";
}

/* ------------------------------------------------------------------- PSI */
async function psi(url: string, o: Options): Promise<{ lcp?: number; weightKiB?: number; viewport?: boolean; screenshot?: string } | null> {
  try {
    const f = o.fetchImpl || fetch;
    const q = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile&category=performance&category=seo&url=" + encodeURIComponent(url) + (o.psiKey ? "&key=" + encodeURIComponent(o.psiKey) : "");
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 70000);
    const res = await f(q, { signal: ctl.signal }); clearTimeout(t);
    if (!res.ok) { try { await res.body?.cancel(); } catch { /* ignore */ } return null; }
    const j = await res.json(); const a = j?.lighthouseResult?.audits; if (!a) return null;
    const out: { lcp?: number; weightKiB?: number; viewport?: boolean; screenshot?: string } = {};
    const lcp = a["largest-contentful-paint"]?.numericValue; if (typeof lcp === "number") out.lcp = lcp / 1000;
    const w = a["total-byte-weight"]?.numericValue; if (typeof w === "number") out.weightKiB = w / 1024;
    const vp = a["viewport"]?.score; if (typeof vp === "number") out.viewport = vp >= 0.9;
    const shot = a["final-screenshot"]?.details?.data; if (typeof shot === "string" && shot.startsWith("data:image/") && shot.length < 400_000) out.screenshot = shot;
    return out;
  } catch { return null; }
}

// Text files sent compressed arrive here already unpacked and without a stated length.
// Their transfer size is estimated at 30% of the unpacked size (typical for HTML, CSS and JS).
const TEXT_RATIO = 0.3;
function wire(f: Fetched, isText: boolean): number { return f.sized || !isText ? f.bytes : Math.round(f.bytes * TEXT_RATIO); }

/* ------------------------------------------------------------- the audit */
export async function audit(input: string, opts: Options = {}): Promise<Report> {
  const o = { timeoutMs: 12000, maxPages: 7, ...opts };
  const now = o.now || new Date();
  const at = now.toISOString().slice(0, 16);
  const year = now.getUTCFullYear();
  const notes: string[] = [];
  const start = normaliseUrl(input);
  guard(start, o);
  const host = start.host;

  // home page: https first, then http; three timed fetches for a median time to first byte
  const psiP = o.allowLocal ? Promise.resolve(null) : psi(start.toString(), o);
  let home = await get("https://" + host + start.pathname + start.search, o);
  const httpsWorks = home.ok && home.url.startsWith("https:");
  if (!home.ok) { const h2 = await get("http://" + host + start.pathname + start.search, o); if (h2.ok) home = h2; }
  if (!home.ok) throw new HcError("unreachable", home.status ? `The site answered with an error (${home.status}), so it couldn’t be checked.` : "We couldn’t reach that website. Check the address and try again.");
  if (!/<html|<body|<head|<!doctype/i.test(home.text)) throw new HcError("not_html", "That address didn’t return a web page.");
  const httpProbe = await get("http://" + host + "/", o, "head");
  const httpRedirects = httpProbe.url.startsWith("https:") && httpProbe.status > 0 && httpProbe.status < 500;
  const runs = [home.ttfb];
  for (let i = 0; i < 2; i++) { const r = await get(home.url, o, "head"); if (r.status) runs.push(r.ttfb); }
  const ttfb = median(runs);

  const hp = makePage(home, "home");
  const base = home.url;
  const internal = hp.links.filter((l) => /^https?:/i.test(l.href) && sameSite(l.href, base) && !/\.(pdf|jpe?g|png|gif|zip|docx?|xlsx?|mp4)(\?|$)/i.test(l.href));
  const seen = new Set<string>([noHash(base).replace(/\/$/, "")]);
  const pick: { url: string; kind: string }[] = [];
  const add = (kind: string, re: RegExp) => {
    const l = internal.find((x) => (re.test(x.text) || re.test(new URL(x.href).pathname)) && !seen.has(noHash(x.href).replace(/\/$/, "")));
    if (l) { seen.add(noHash(l.href).replace(/\/$/, "")); pick.push({ url: noHash(l.href), kind }); }
  };
  add("contact", P.contact); add("cases", P.cases); add("spec", P.spec); add("machines", P.machines); add("quality", P.quality); add("about", P.about); add("testimonials", P.testimonials);
  for (const l of internal) { if (pick.length >= o.maxPages) break; const k = noHash(l.href).replace(/\/$/, ""); if (!seen.has(k)) { seen.add(k); pick.push({ url: noHash(l.href), kind: "other" }); } }
  const fetched = await pool(pick.slice(0, o.maxPages), 4, async (p) => ({ p, f: await get(p.url, o) }));
  const pages: Page[] = [hp, ...fetched.filter((x) => x.f.ok && /<html|<body|<head/i.test(x.f.text)).map((x) => makePage(x.f, x.p.kind))];
  const allText = pages.map((p) => p.text).join(" \n ");
  const allHtml = pages.map((p) => p.html).join("\n");
  const cleanHome = strip(home.text);

  // sub-resources of the home page: sizes for page weight, text for stylesheets
  const res = new Map<string, "img" | "js" | "css">();
  const addRes = (u: string | undefined, t: "img" | "js" | "css") => { if (!u || /^data:|^blob:|^javascript:/i.test(u)) return; try { const abs = new URL(u.trim(), base).toString(); if (!res.has(abs)) res.set(abs, t); } catch { /* ignore */ } };
  for (const a of openTags(home.text, "img")) { addRes(a.src || a["data-src"] || a["data-lazy-src"], "img"); }
  for (const a of openTags(cleanHome, "source")) if (a.srcset) addRes(a.srcset.split(",")[0].trim().split(/\s+/)[0], "img");
  for (const a of openTags(home.text, "script")) addRes(a.src, "js");
  for (const a of openTags(home.text, "link")) if (/stylesheet/i.test(a.rel || "")) addRes(a.href, "css");
  for (const m of home.text.matchAll(/background(?:-image)?\s*:[^;"']*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) addRes(m[1], "img");
  const resList = [...res.entries()].slice(0, 70);
  let cssText = blocks(home.text, "style").map((b) => b.inner).join("\n");
  let cssFetched = 0;
  const sizes = await pool(resList, 10, async ([u, t]) => {
    try {
      if (t === "css" && cssFetched < 5 && sameSite(u, base)) { cssFetched++; const r = await get(u, o, "text", 600_000); cssText += "\n" + r.text; return wire(r, true); }
      return wire(await get(u, o, "size", 15_000_000), t !== "img");
    } catch { return 0; }
  });
  const ownWeightKiB = (wire(home, true) + sizes.reduce((a, b) => a + b, 0)) / 1024;
  const mixed = httpsWorks ? [...res.keys()].filter((u) => u.startsWith("http://")).length + openTags(cleanHome, "iframe").filter((a) => (a.src || "").startsWith("http://")).length : 0;
  if (res.size > resList.length) notes.push(`Page weight counts the first ${resList.length} of ${res.size} files the home page loads.`);

  const p = await psiP;
  const weightKiB = p?.weightKiB ?? ownWeightKiB;
  const checks: Record<string, CheckResult> = {};
  const values: Report["values"] = {};
  const nm = (why: string): CheckResult => ({ score: null, flaw: "Not measured", finding: why, nm: why, basis: "not-measured" });
  const NEEDS_EYE = "This one needs a person’s eye, so it isn’t scored automatically. We go through it with you in your Performance Test.";

  /* 1 hero photo: scored on resolution only. The photo itself is judged by a designer in the Performance Test. */
  const HERO_NOTE = "Scored on resolution only. Sharpness, lighting and whether it shows your real work are judged by a designer in the Performance Test.";
  const notIcon = (a: Record<string, string>) => !/logo|icon|sprite|pixel|badge|avatar|flag|payment|spacer|\.svg(\?|$)/i.test((a.src || "") + " " + (a.alt || "") + " " + (a.class || "") + " " + (a.id || ""))
    && !(Number(a.width) > 0 && Number(a.width) < 300) && !(Number(a.height) > 0 && Number(a.height) < 150);
  const cands: { url: string; how: string }[] = [];
  const addC = (u: string | null | undefined, how: string) => { if (!u || /^data:/i.test(u) || /blur_\d/i.test(u)) return; try { cands.push({ url: fullImageUrl(new URL(u.trim(), base).toString()), how }); } catch { /* ignore */ } };
  for (const l of openTags(home.text, "link")) if (/preload/i.test(l.rel || "") && /^image$/i.test(l.as || "")) addC(l.imagesrcset ? srcsetBest(l.imagesrcset, base) : l.href, "preloaded");
  const heroBlock = /<(section|div|header|figure)\b[^>]*\b(id|class)=["'][^"']*\b(hero|banner|masthead|slider|carousel|jumbotron|splash|cover|intro)[\w-]*[^"']*["'][^>]*>([\s\S]{0,30000})/i.exec(home.text);
  const scanImgs = (html: string, how: string) => { for (const a of openTags(html, "img").filter(notIcon).slice(0, 3)) addC((a.srcset || a["data-srcset"]) ? srcsetBest(a.srcset || a["data-srcset"], base) : (a.src || a["data-src"] || a["data-lazy-src"]), how); };
  for (const a of openTags(home.text, "img")) if (/high/i.test(a.fetchpriority || "") && notIcon(a)) addC(a.srcset ? srcsetBest(a.srcset, base) : a.src, "marked high priority");
  if (heroBlock) {
    scanImgs(heroBlock[4], "in the hero area");
    const bg = /url\(\s*['"]?([^'")]+\.(?:jpe?g|png|webp|avif)[^'")]*)['"]?\s*\)/i.exec(heroBlock[4] + heroBlock[0]); if (bg) addC(bg[1], "hero background");
    for (const v of openTags(heroBlock[4], "video")) addC(v.poster, "video poster");
  }
  for (const v of openTags(home.text, "video")) addC(v.poster, "video poster");
  scanImgs(cleanHome, "first large image");
  const og = openTags(home.text, "meta").find((m) => /og:image$/i.test(m.property || ""))?.content;
  let heroImg: { url: string; how: string; w: number; h: number; type: string; kb: number } | null = null;
  const videoTags = (heroBlock ? openTags(heroBlock[4], "video").concat(openTags(heroBlock[4], "source")) : []).concat(openTags(home.text, "video"), openTags(home.text, "source"));
  const vsrc = videoTags.map((v) => v.src).find((x) => x && /\.(mp4|m4v|mov)(\?|$)/i.test(x));
  let heroVideo: { w: number; h: number } | null = null;
  if (vsrc) { try { const r = await get(new URL(vsrc, base).toString(), o, "bytes", 400_000); heroVideo = r.raw ? videoSize(r.raw) : null; } catch { /* ignore */ } }
  for (const c of cands.filter((c, i) => cands.findIndex((d) => d.url === c.url) === i).slice(0, 4)) {
    const r = await get(c.url, o, "bytes", 300_000);
    const dim = r.raw ? imageSize(r.raw) : null;
    if (dim && dim.w >= 200) { heroImg = { ...c, ...dim, kb: Math.round((Number(r.headers?.get("content-length")) || r.bytes) / 1024) }; break; }
  }
  if (!heroImg && og) { const r = await get(new URL(og, base).toString(), o, "bytes", 300_000); const dim = r.raw ? imageSize(r.raw) : null; if (dim) heroImg = { url: og, how: "the image your site shares on social media", ...dim, kb: Math.round(r.bytes / 1024) }; }
  if (heroVideo && (!heroImg || heroImg.how === "video poster" || heroVideo.w >= heroImg.w)) {
    const still = heroImg && heroImg.how === "video poster" ? ` Its still frame, shown before the video plays, is ${heroImg.w.toLocaleString("en-GB")} px wide.` : "";
    heroImg = { url: vsrc!, how: "hero video", w: heroVideo.w, h: heroVideo.h, type: "video", kb: 0 };
    (heroImg as { still?: string }).still = still;
  }
  if (heroImg) {
    const band = RUBRIC.heroWidth.find(([min]) => heroImg!.w >= min)!;
    const isVideo = heroImg.type === "video";
    const px = `${heroImg.w.toLocaleString("en-GB")} × ${heroImg.h.toLocaleString("en-GB")} px`;
    const big = heroImg.w > 4500 ? ` It’s also far wider than any screen needs, which slows the page (see Page weight).` : "";
    checks["hero-photo"] = { score: band[1], flaw: `${isVideo ? "Main video" : "Main image"} ${px}: ${band[2].charAt(0).toLowerCase() + band[2].slice(1)}`,
      finding: `${isVideo ? `Your home page opens with a video, ${px}.${(heroImg as { still?: string }).still || ""}` : `The largest version of your main home-page image is ${px} (${heroImg.type}).`} A main image shown across the full screen needs at least 1,920 px to look sharp on a desktop, and about 2,560 px on high-resolution screens.${big}`,
      basis: "measured", note: HERO_NOTE, evidence: { url: heroImg.url.slice(0, 200), found: heroImg.how, w: heroImg.w, h: heroImg.h, type: heroImg.type, kb: heroImg.kb } };
  } else if (!openTags(home.text, "img").filter(notIcon).length && !openTags(home.text, "video").length) {
    checks["hero-photo"] = { score: RUBRIC.hero.noImages, flaw: "No main image on the home page", finding: "The home page has no photo of your work, your products or your premises.", basis: "measured", note: HERO_NOTE };
  } else checks["hero-photo"] = { ...nm("We couldn’t pick out and measure your main image, so this one’s Not measured. A designer checks it in the Performance Test."), note: HERO_NOTE };

  /* 2 headline */
  const h1s = blocks(cleanHome, "h1").map((b) => textOf(b.inner) || (attrs((/<img\b[^>]*>/i.exec(b.inner) || [""])[0]).alt || "")).filter(Boolean);
  const h1 = h1s[0] || "";
  const siteName = (openTags(home.text, "meta").find((m) => (m.property || "") === "og:site_name")?.content || "").trim();
  const label = start.hostname.replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]/g, "");
  const parts = hp.title.split(/\s[|\-–—:·]\s/).map((s) => s.trim()).filter((s) => s && !P.generic.test(s));
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const byDomain = parts.find((s) => { const q = squash(s); return q.length > 2 && (label.includes(q) || q.includes(label) || label.startsWith(q.slice(0, 5))); });
  const appName = (openTags(home.text, "meta").find((m) => (m.name || "").toLowerCase() === "application-name")?.content || "").trim();
  const guessName = siteName || appName || byDomain || [...parts].sort((a, b) => a.length - b.length)[0] || start.hostname.replace(/^www\./, "");
  if (!h1) checks["headline"] = { score: RUBRIC.headline.none, flaw: "No main headline on the home page", finding: "The home page has no main headline (H1), so visitors and search engines aren’t told what you do.", basis: "rule" };
  else if (P.generic.test(h1) || h1.toLowerCase() === guessName.toLowerCase()) checks["headline"] = { score: RUBRIC.headline.generic, flaw: `“${h1.slice(0, 70)}” headline`, finding: "The headline doesn’t say what you make, who for, or in what quantities.", basis: "rule", evidence: { h1 } };
  else if (h1.split(/\s+/).length <= 2) checks["headline"] = { score: RUBRIC.headline.tooShort, flaw: `“${h1.slice(0, 70)}” headline`, finding: "The headline is only a word or two, so it can’t say what you make or who for.", basis: "rule", evidence: { h1 } };
  else checks["headline"] = { score: RUBRIC.headline.recorded, flaw: `Headline: “${h1.slice(0, 90)}”`, finding: "There’s a real headline on the home page. How well it sells isn’t judged automatically; we look at that with you in your Performance Test.", basis: "rule", evidence: { h1 } };
  values.h1 = h1 ? { v: h1.slice(0, 140), at } : { v: null, at, nm: "No H1 found" };

  /* 3 offer structure: what the site is for, who it serves and how focused the offer is, by fixed rules */
  const descText = (openTags(home.text, "meta").find((m) => (m.name || "").toLowerCase() === "description")?.content || "").trim();
  const h2s = blocks(cleanHome, "h2").map((b) => textOf(b.inner)).filter(Boolean).slice(0, 3);
  const hero = [hp.title, descText, h1, ...h2s].join(" · ");
  const sector = sectorOf(hero, allText);
  const whoM = WHO.exec(hero); const who = whoM ? whoM[1].replace(/\s+/g, " ").trim() : "";
  const what = sector.key !== "unknown" && sector.scores[sector.key] >= 3 && (SECTORS.find((x) => x.key === sector.key)!.re.test(hero));
  SECTORS.forEach((x) => { x.re.lastIndex = 0; });
  const where = WHERE.test(hero);
  const svcSec = /<(section|div)\b[^>]*\bid=["'][^"']*(services|what-we-do|capabilit|offer)[^"']*["'][^>]*>([\s\S]{0,40000}?)(?=<section\b|<footer\b)/i.exec(home.text);
  const svcCount = svcSec ? (svcSec[3].match(/<h[3-4]\b/gi) || []).length : 0;
  const listCount = Math.max(svcCount, ...pages.filter((pg) => pg.kind === "spec").map((pg) => (pg.html.match(/<li\b/gi) || []).length > 40 ? 0 : (strip(pg.html).match(/<h[3-4]\b/gi) || []).length));
  const generic = !h1 || P.generic.test(h1);
  let cs = 2.5 + (what ? 2.5 : 0) + (who ? 2 : 0) + (where ? 0.5 : 0) + (listCount >= 2 && listCount <= 8 ? 0.5 : 0) - (listCount > 12 ? 1 : 0) - (generic ? 1 : 0);
  cs = Math.max(1, Math.min(8, cs));   // rules can't award top marks: that needs a person's or an AI's read
  const reads = sector.key !== "unknown" ? `Your site reads as ${sector.label}${who ? `, for ${who}` : ""}.` : "We couldn’t tell from your headline, title and description what kind of business this is.";
  const flawO = what && who ? "Says what you offer and who it’s for" : what ? "Says what you offer, not who it’s for" : who ? "Says who it’s for, not clearly what you offer" : "Doesn’t say what you offer or who it’s for";
  checks["offer-structure"] = {
    score: cs, flaw: flawO + (listCount > 12 ? `; ${listCount} services listed` : ""),
    finding: `${reads} ${listCount > 12 ? `There are ${listCount} services or processes listed, which is a lot for a buyer to sort through. ` : ""}Judged by fixed rules from your page title, description and headings, not by a person.`,
    basis: "rule", evidence: { sector: sector.key, who: who || null, where, services: listCount },
    note: `${reads} Scored by fixed rules from your page title, description and headings. A designer judges how clear it is to a buyer in the Performance Test.`,
  };

  /* 4 spec page */
  const specPage = pages.find((pg) => P.tolerance.test(pg.text) && P.material.test(pg.text));
  const anyTol = P.tolerance.test(allText), anyMat = P.material.test(allText);
  if (specPage) checks["spec-page"] = { score: RUBRIC.spec.both, flaw: "Tolerances and materials are published", finding: "A page gives a tolerance figure and names materials, so an engineer can start to shortlist you.", basis: "measured", evidence: { page: specPage.url } };
  else if (anyTol || anyMat) checks["spec-page"] = { score: RUBRIC.spec.one, flaw: anyMat ? "Materials named, no tolerances" : "Tolerances given, no materials named", finding: "Part of what an engineer needs is there, but not tolerances and materials together on one page.", basis: "measured" };
  else checks["spec-page"] = { score: RUBRIC.spec.neither, flaw: "No tolerances or materials found", finding: "No tolerance figure or named material was found on the home page or the pages linked from it.", basis: "measured" };
  values.spec = { v: !!specPage, at };

  /* 5 machine list */
  const brands = [...new Set((allText.match(P.machineBrand) || []).map((s) => s.toLowerCase()))];
  const machinePage = pages.find((pg) => pg.kind === "machines") || pages.find((pg) => P.machines.test(new URL(pg.url).pathname));
  const upd = /(?:last\s+)?updated[^.]{0,30}?(20\d{2})/i.exec(machinePage?.text || "");
  if (brands.length >= 3) {
    const stale = upd && Number(upd[1]) < year - 2;
    checks["machine-list"] = stale
      ? { score: RUBRIC.machines.listedStale, flaw: `Machine list last updated in ${upd![1]}`, finding: `Named machines are listed, but the list is dated ${upd![1]}.`, basis: "measured", evidence: { brands: brands.slice(0, 8) } }
      : { score: RUBRIC.machines.listed, flaw: `${brands.length} machine makes named`, finding: "Named machines are listed. Whether the list is current can’t be told from outside.", basis: "measured", evidence: { brands: brands.slice(0, 8) } };
  } else if (machinePage) checks["machine-list"] = { score: RUBRIC.machines.pageOnly, flaw: "Equipment page, few machines named", finding: "There’s a page about equipment or facilities, but it names few or no machines.", basis: "measured", evidence: { page: machinePage.url } };
  else checks["machine-list"] = { score: RUBRIC.machines.none, flaw: "No machine or equipment list found", finding: "No machine or equipment list was found on the home page or the pages linked from it.", basis: "measured" };

  /* 6 tap to call */
  const telLink = hp.links.some((l) => /^tel:/i.test(l.raw));
  const hasNumber = P.phone.test(hp.text);
  checks["tap-to-call"] = telLink
    ? { score: RUBRIC.tap.link, flaw: "Tap-to-call link found", finding: "The phone number on the home page can be tapped to call.", basis: "measured" }
    : hasNumber
      ? { score: RUBRIC.tap.numberNoLink, flaw: "Phone number can’t be tapped to call", finding: "On a phone the number is plain text, so a buyer has to copy it to call.", basis: "measured" }
      : { score: RUBRIC.tap.noNumber, flaw: "No phone number on the home page", finding: "No phone number or tap-to-call link was found on the home page.", basis: "measured" };
  values.tap = { v: telLink, at };

  /* 7 phone layout */
  const vpMeta = openTags(home.text, "meta").find((m) => (m.name || "").toLowerCase() === "viewport");
  const hasViewport = p?.viewport ?? !!(vpMeta && /width\s*=/i.test(vpMeta.content || ""));
  const breakpoints = (cssText.match(/@media[^{]*\b(max|min)-width/gi) || []).length;
  const builder = /Wix|Squarespace|Shopify|Webflow|Framer|Duda|GoDaddy/.test(detectPlatform(home.text, home.headers).name);
  checks["responsive"] = !hasViewport
    ? { score: RUBRIC.responsive.noViewport, flaw: "No phone layout set", finding: "The page doesn’t tell phones how to size it, so it shows as a shrunken desktop page.", basis: "measured" }
    : breakpoints > 0 || builder
      ? { score: RUBRIC.responsive.viewportAndBreakpoints, flaw: "Phone layout is set up", finding: "The page is set up to resize for phones. Sideways scrolling is checked on a real phone in your Performance Test.", basis: "measured", evidence: { breakpoints } }
      : { score: RUBRIC.responsive.viewportOnly, flaw: "Phone sizing set, no phone layout rules found", finding: "The page sets a phone width but no layout rules for small screens were found, so parts may run off the side.", basis: "measured" };
  values.mobile = { v: hasViewport && (breakpoints > 0 || builder), at };

  /* 8 page weight */
  const wScore = r1(lerp(RUBRIC.weightKiB, weightKiB));
  const mb = (weightKiB / 1024).toFixed(1);
  checks["image-weight"] = { score: wScore, flaw: `${mb} MB home page`, finding: weightKiB <= 1600 ? `The home page downloads ${mb} MB, inside Google’s 1.6 MB target.` : `The home page downloads ${mb} MB. Google’s target is 1.6 MB or less.`, basis: "measured", evidence: { kib: Math.round(weightKiB), files: res.size, method: p?.weightKiB ? "PageSpeed Insights" : "sum of the files the home page loads; compressed text files estimated" } };
  values.weight = { v: Math.round(weightKiB), at };

  /* 9 server speed */
  const tScore = lerp(RUBRIC.ttfbS, ttfb);
  const sScore = r1(p?.lcp != null ? (tScore + lerp(RUBRIC.lcpS, p.lcp)) / 2 : tScore);
  checks["hosting"] = {
    score: sScore,
    flaw: p?.lcp != null ? `${p.lcp.toFixed(1)} s to main content` : `${ttfb.toFixed(2)} s server response`,
    finding: p?.lcp != null ? `Main content takes ${p.lcp.toFixed(1)} s to appear on a phone, and the server takes ${ttfb.toFixed(2)} s to respond.` : `The server takes ${ttfb.toFixed(2)} s to start responding (target: 0.8 s or less). Time to main content on a phone wasn’t measured in this run.`,
    basis: "measured", evidence: { ttfbRuns: runs.map((x) => +x.toFixed(2)), lcp: p?.lcp ?? null },
  };
  values.ttfb = { v: +ttfb.toFixed(2), runs: runs.map((x) => +x.toFixed(2)).sort((a, b) => a - b), at };
  values.lcp = p?.lcp != null ? { v: +p.lcp.toFixed(1), at } : { v: null, at, nm: "Needs a PageSpeed Insights key" };

  /* 10 quote form */
  const formPages = pages.filter((pg) => pg.kind === "home" || pg.kind === "contact");
  const isRealForm = (inner: string, a: Record<string, string>) => {
    if (/search/i.test((a.role || "") + (a.class || "") + (a.id || "") + (a.action || ""))) return false;
    const inputs = openTags(inner, "input").filter((i) => !/^(hidden|submit|button|search|image|reset)$/i.test(i.type || "text"));
    return /<textarea\b/i.test(inner) || inputs.length >= 2;
  };
  let form = false, upload = false;
  for (const pg of formPages) {
    for (const b of blocks(strip(pg.html), "form")) if (isRealForm(b.inner, b.a)) { form = true; if (/type\s*=\s*["']?file/i.test(b.inner)) upload = true; }
    if (/hsforms\.(net|com)|hbspt\.forms\.create|jotform\.com|typeform\.com|docs\.google\.com\/forms|wufoo\.com|cognitoforms|formstack|paperform|tally\.so|form\.jotform|gravity_form|wpforms|wpcf7|elementor-form|ninja-forms|fluentform/i.test(pg.html)) form = true;
  }
  const mailto = pages.some((pg) => pg.links.some((l) => /^mailto:/i.test(l.raw)));
  checks["quote-form"] = form && upload
    ? { score: RUBRIC.quote.formWithUpload, flaw: "Quote form with drawing upload", finding: "There’s an enquiry form within one click of the home page, and it takes a file upload.", basis: "measured" }
    : form
      ? { score: RUBRIC.quote.form, flaw: "Enquiry form, no drawing upload", finding: "There’s an enquiry form within one click of the home page, but no way to attach a drawing.", basis: "measured" }
      : mailto
        ? { score: RUBRIC.quote.mailtoOnly, flaw: "Only an email link, no quote form", finding: "The only route to a quote is an email link, with no form and no way to attach a drawing.", basis: "measured" }
        : { score: RUBRIC.quote.nothing, flaw: "No quote form or email link found", finding: "No enquiry form or email link was found on the home page or the contact page.", basis: "measured" };
  values.quote = { v: form, at }; values.upload = { v: upload, at };

  /* 11 reply promise */
  const replyText = formPages.map((pg) => pg.text).join(" ");
  const rp = P.reply.exec(replyText);
  checks["reply-promise"] = rp
    ? { score: RUBRIC.reply.found, flaw: "Reply time is stated", finding: `The site says when you’ll reply (“${replyText.slice(Math.max(0, rp.index - 30), rp.index + 50).trim()}”). Whether it’s kept can’t be measured; we never send test enquiries.`, basis: "measured" }
    : { score: RUBRIC.reply.notFound, flaw: "No reply-time promise found", finding: "Nothing on the home or contact page says when an enquiry will get a reply.", basis: "measured" };
  values.reply = { v: !!rp, at };

  /* 12 case studies */
  const casePage = pages.find((pg) => pg.kind === "cases" && pg.text.split(/\s+/).length >= 80);
  const caseKids = casePage ? new Set(casePage.links.filter((l) => sameSite(l.href, base) && noHash(l.href).replace(/\/$/, "").startsWith(noHash(casePage.url).replace(/\/$/, "") + "/")).map((l) => noHash(l.href))).size : 0;
  const testimonials = P.testimonials.test(allText) || pages.some((pg) => pg.kind === "testimonials");
  // one-page sites: a section on the home page, found by its id or by a menu link that jumps to it
  const secIds = new Set<string>();
  for (const a of openTags(home.text, "section").concat(openTags(home.text, "div"), openTags(home.text, "article"))) if (a.id && P.caseSection.test(a.id)) secIds.add(a.id);
  for (const l of hp.links) if (/^#[\w-]+$/.test(l.raw) && P.cases.test(l.text)) secIds.add(l.raw.slice(1));
  let workSec: { id: string; entries: number; words: number } | null = null;
  for (const id of secIds) {
    const m = new RegExp("<(section|div|article|main)\\b[^>]*\\bid=[\"']" + id.replace(/[^\w-]/g, "") + "[\"'][^>]*>", "i").exec(home.text);
    if (!m) continue;
    let body = home.text.slice(m.index + m[0].length, m.index + m[0].length + 60000);
    const end = body.search(/<section\b|<footer\b/i); if (end > 0) body = body.slice(0, end);
    const entries = Math.max((body.match(/<h[3-4]\b/gi) || []).length, (body.match(/<article\b/gi) || []).length, (body.match(/<figure\b/gi) || []).length);
    const words = textOf(body).split(/\s+/).filter(Boolean).length;
    if (words >= 25 && (!workSec || entries > workSec.entries)) workSec = { id, entries, words };
  }
  if (workSec && (!casePage || (caseKids < 3 && workSec.entries >= 3))) checks["case-studies"] = workSec.entries >= 3
    ? { score: RUBRIC.cases.pageWithSeveral, flaw: `Work section with ${workSec.entries} examples`, finding: `The home page has a work section with ${workSec.entries} examples of past jobs. How good they are isn’t judged.`, basis: "measured", evidence: { section: "#" + workSec.id, entries: workSec.entries } }
    : { score: RUBRIC.cases.page, flaw: "Work section on the home page", finding: "The home page has a section showing past work. We check that it’s there, not how good it is.", basis: "measured", evidence: { section: "#" + workSec.id, entries: workSec.entries } };
  else checks["case-studies"] = casePage
    ? caseKids >= 3
      ? { score: RUBRIC.cases.pageWithSeveral, flaw: `${caseKids} case studies or projects found`, finding: "There’s a case studies or projects section with several entries. How good they are isn’t judged.", basis: "measured", evidence: { page: casePage.url } }
      : { score: RUBRIC.cases.page, flaw: "Case studies or projects page found", finding: "There’s a case studies or projects page. We check that it exists, not how good it is.", basis: "measured", evidence: { page: casePage.url } }
    : testimonials
      ? { score: RUBRIC.cases.testimonialsOnly, flaw: "Testimonials, no case studies", finding: "There are testimonials or reviews, but no written examples of past work.", basis: "measured" }
      : { score: RUBRIC.cases.none, flaw: "No case studies", finding: "There are no examples of past work, so the capability claims have nothing behind them.", basis: "measured" };
  values.cases = { v: !!casePage || !!workSec, at };

  /* 13 certificates */
  const std = P.standard.exec(allText);
  const allLinks = pages.flatMap((pg) => pg.links);
  const shown = !!std && (allLinks.some((l) => P.certBody.test(l.href) || P.certFile.test(l.href)) || openTags(allHtml, "img").some((a) => /certificat|iso[-_ ]?9001|as[-_ ]?9100|accredit|ukas/i.test((a.src || "") + " " + (a.alt || ""))));
  const certLevel = !std ? "none" : shown ? "shown" : "named";
  checks["certs"] = certLevel === "none"
    ? { score: RUBRIC.certs.none, flaw: "No quality standard named", finding: "No quality standard or accreditation is named on the home page or the pages linked from it.", basis: "measured" }
    : certLevel === "named"
      ? { score: RUBRIC.certs.named, flaw: `${std![0]} mentioned, certificate not linked`, finding: `${std![0]} is mentioned, but the certificate isn’t shown or linked.`, basis: "measured" }
      : { score: RUBRIC.certs.shown, flaw: `${std![0]} certificate shown or linked`, finding: `${std![0]} is named and a certificate or certification-body link is shown. Validity isn’t checked.`, basis: "measured" };
  values.cert = { v: certLevel, at };

  /* 14 page titles */
  const titles = pages.map((pg) => pg.title.toLowerCase()).filter(Boolean);
  const uniq = new Set(titles).size;
  const desc = (openTags(home.text, "meta").find((m) => (m.name || "").toLowerCase() === "description")?.content || "").trim();
  let tk: keyof typeof RUBRIC.titles, tf = "", tfi = "";
  if (!hp.title) { tk = "noTitle"; tf = "Home page has no title"; tfi = "The home page has no title, so search results and browser tabs show only the address."; }
  else if (pages.length < 2) { tk = desc ? "onePage" : "uniqueNoDesc"; tf = desc ? "Title and description found" : "No description on the home page"; tfi = "Only the home page could be read, so titles couldn’t be compared across pages."; }
  else if (uniq === 1) { tk = "allSame"; tf = `Every page titled “${hp.title.slice(0, 60)}”`; tfi = "Every page read has the same title, so search results and browser tabs all look alike."; }
  else if (uniq < titles.length) { tk = "someSame"; tf = `${titles.length - uniq + 1} pages share a title`; tfi = "Some pages share the same title, so search engines can’t tell them apart."; }
  else if (!desc) { tk = "uniqueNoDesc"; tf = "Unique titles, no home-page description"; tfi = "Each page has its own title, but the home page has no description for search results."; }
  else { tk = "uniqueWithDesc"; tf = "Unique titles and a description"; tfi = `Each of the ${pages.length} pages read has its own title, and the home page has a description.`; }
  checks["titles-meta"] = { score: RUBRIC.titles[tk], flaw: tf, finding: tfi, basis: "measured", evidence: { pages: pages.length, unique: uniq } };
  values.titles = { v: !!hp.title && uniq === titles.length && !!desc && pages.length > 1, at };

  /* 15 local listing */
  checks["local-listing"] = nm("Your Google Business Profile is checked by hand, signed out, so it isn’t scored automatically. We go through it with you in your Performance Test.");
  values.listing = { v: null, at, nm: "Checked by hand" };

  /* 16 https */
  const hk = !httpsWorks ? "none" : !httpRedirects ? "noRedirect" : mixed > 0 ? "mixed" : "clean";
  checks["security-https"] = {
    none: { score: RUBRIC.https.none, flaw: "“Not secure” warning: no HTTPS", finding: "The site doesn’t load over HTTPS, so browsers flag it as “Not secure”.", basis: "measured" as const },
    noRedirect: { score: RUBRIC.https.noRedirect, flaw: "HTTPS works, but the old address isn’t redirected", finding: "The site loads over HTTPS, but the http:// address doesn’t send visitors to the secure version.", basis: "measured" as const },
    mixed: { score: RUBRIC.https.mixed, flaw: `${mixed} insecure file${mixed === 1 ? "" : "s"} on a secure page`, finding: `The site loads over HTTPS but the home page pulls in ${mixed} file${mixed === 1 ? "" : "s"} over plain http, which browsers block or flag.`, basis: "measured" as const },
    clean: { score: RUBRIC.https.clean, flaw: "HTTPS throughout", finding: "The site loads over HTTPS, the old address redirects to it, and the home page loads nothing insecure.", basis: "measured" as const },
  }[hk];
  values.https = { v: hk === "clean", at };

  /* 17 platform */
  const plat = detectPlatform(home.text, home.headers);
  const thirdParty = [...res.entries()].filter(([u, t]) => t === "js" && !sameSite(u, base)).length;
  const cy = [...hp.text.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map((m) => Number(m[1]));
  const copyYear = cy.length ? Math.max(...cy) : null;
  let lastmod: string | null = null;
  try { const sm = await get(new URL("/sitemap.xml", base).toString(), o, "text", 400_000); if (sm.ok) { const d = [...sm.text.matchAll(/<lastmod>\s*(\d{4}-\d{2}-\d{2})/gi)].map((m) => m[1]).sort(); lastmod = d.length ? d[d.length - 1] : null; } } catch { /* ignore */ }
  const fresh = (lastmod && (now.getTime() - Date.parse(lastmod)) < 365 * 864e5) || copyYear === year;
  const stale = !fresh && ((copyYear != null && copyYear <= year - 2) || (lastmod != null && (now.getTime() - Date.parse(lastmod)) > 2 * 365 * 864e5));
  if (plat.status === "unknown" && !plat.name) checks["platform-ready"] = nm("We couldn’t tell what the site’s built on, so this one’s Not measured. It doesn’t count as a Fail.");
  else {
    let s: number = plat.status === "legacy" ? RUBRIC.platform.legacy : plat.status === "unsupported" ? RUBRIC.platform.unsupported : plat.status === "behind" ? RUBRIC.platform.behind : plat.status === "unknown" ? RUBRIC.platform.behind : RUBRIC.platform.supported;
    const ok = plat.status === "supported";
    if (stale) s -= RUBRIC.platform.staleBy;
    if (ok && thirdParty === 0) s -= RUBRIC.platform.noOutsideScriptsBy;
    if (ok && fresh && thirdParty > 0) s += RUBRIC.platform.freshBonus;
    const csp = home.headers?.get("content-security-policy") || "";
    const cspNote = /script-src/i.test(csp) ? "Its security settings list which scripts may run, so a chat or booking widget has to be added to that list too." : "";
    const bits = [plat.note, cspNote, thirdParty ? `${thirdParty} outside script${thirdParty === 1 ? "" : "s"} already load${thirdParty === 1 ? "s" : ""}.` : "No outside scripts load.", fresh ? "It’s been updated in the last 12 months." : stale ? `It looks untouched since ${copyYear ?? (lastmod || "").slice(0, 4)}.` : "When it was last updated couldn’t be told."];
    checks["platform-ready"] = { score: r1(clamp(s)), flaw: plat.name === "Custom-built site" && ok ? "Custom-built site, ready to add chat or AI tools" : plat.status === "supported" ? `${plat.name}${plat.version ? " " + plat.version : ""}, a supported platform` : plat.note.replace(/\.$/, ""), finding: bits.filter(Boolean).join(" "), basis: "measured", evidence: { platform: plat.name, version: plat.version || null, thirdParty, copyYear, lastmod } };
  }

  /* 18 chat and booking */
  const toolHtml = formPages.map((pg) => pg.html).join("\n");
  const chat = CHAT.filter(([, re]) => re.test(toolHtml)).map(([n]) => n);
  const wa = WHATSAPP.test(toolHtml);
  const book = BOOKING.filter(([, re]) => re.test(toolHtml)).map(([n]) => n);
  const kinds = (chat.length ? 1 : 0) + (wa ? 1 : 0) + (book.length ? 1 : 0);
  const found = [...chat, ...(wa ? ["WhatsApp"] : []), ...book];
  checks["tools-in-use"] = kinds === 0
    ? { score: RUBRIC.tools.none, flaw: "No chat, WhatsApp or booking found", finding: "No chat, WhatsApp or booking was found in the page code. Buyers get a phone number or an email link, and that’s it.", basis: "measured" }
    : { score: kinds > 1 ? RUBRIC.tools.several : RUBRIC.tools.one, flaw: `${found.slice(0, 3).join(", ")} found`, finding: `${found.join(", ")} found in the page code. We don’t send anything to test it.`, basis: "measured", evidence: { found } };

  // checks 4 and 5 are written for manufacturers: leave them out for a site that clearly isn't one
  if (sector.key !== "unknown" && sector.key !== "manufacturing") for (const k of ["spec-page", "machine-list"]) checks[k] = nm(`This check is written for manufacturers. Your site reads as ${sector.label}, so it’s left out of your score.`);
  for (const k of Object.keys(checks)) { const c = checks[k]; if (c.score != null) c.score = r1(clamp(c.score)); }
  if (hp.text.length < 250 && openTags(home.text, "script").length > 2) notes.push("This site builds its pages with JavaScript, so the automatic checks may have missed some of what visitors see.");
  if (!p) notes.push("Mobile load time (LCP) wasn’t measured: it needs a Google PageSpeed Insights key.");
  if (sector.key === "unknown") notes.push("We couldn’t tell what kind of business this is, so the two manufacturer checks (spec page, machine list) were still applied.");

  return {
    schema: "hc-report/1", engine: ENGINE_VERSION,
    url: home.url, domain: new URL(home.url).hostname.replace(/^www\./, ""), name: guessName.slice(0, 80),
    tested: now.toISOString(), sources: { psi: !!p, pages: pages.length },
    checks, values, pages: pages.map((pg) => ({ url: pg.url, status: pg.status, title: pg.title.slice(0, 120) })),
    screenshot: p?.screenshot, notes, sector,
  };
}

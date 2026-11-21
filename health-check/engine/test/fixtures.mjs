// Two local test sites: "tired" (a Vellmoor-like poor site) and "sharp" (a well-kept one).
import http from 'node:http';
const big = Buffer.alloc(2_400_000, 1);
const tired = {
  '/': `<html><head><title>Home | Harrowgate</title><meta name="generator" content="Drupal 7 (http://drupal.org)"></head><body>
    <table width="960"><tr><td><img src="/img/hero.jpg"><img src="/img/a.jpg"><img src="/img/b.jpg"><img src="http://tired.test/img/c.jpg"></td></tr></table>
    <h1>Welcome to our website!</h1><p>Harrowgate Engineering. Call 01234 567890. ISO 9001 registered.</p>
    <a href="/about.html">About</a> <a href="/services.html">Services</a> <a href="/contact.html">Contact us</a>
    <a href="mailto:sales@harrowgate.test">Click here to email us</a><script>Drupal.settings = {};</script>
    <p>Copyright 2013 Harrowgate</p></body></html>`,
  '/about.html': `<html><head><title>Home | Harrowgate</title></head><body><h1>About</h1><p>We have been machining since 1974.</p></body></html>`,
  '/services.html': `<html><head><title>Home | Harrowgate</title></head><body><h1>Services</h1><p>Turning, milling, grinding, drilling and more.</p></body></html>`,
  '/contact.html': `<html><head><title>Home | Harrowgate</title></head><body><h1>Contact</h1><p>Ring us.</p></body></html>`,
};
const kids = [1,2,3,4].map(n => `<a href="/case-studies/job-${n}">Job ${n}</a>`).join(' ');
const filler = 'We machined a batch of housings for a pump maker and delivered on time. '.repeat(14);
const sharp = {
  '/': `<!doctype html><html><head><title>Precision CNC machining in Leeds | Calderbrook</title><meta name="description" content="5-axis CNC machining for aerospace and medical, 1 to 5,000 off.">
    <meta name="viewport" content="width=device-width, initial-scale=1"><meta name="generator" content="WordPress 6.8.1"><link rel="stylesheet" href="/wp-content/themes/c/style.css">
    <script src="https://js.hs-scripts.com/123.js"></script><script src="https://www.googletagmanager.com/gtm.js"></script></head><body>
    <nav><a href="/capabilities">Capabilities</a><a href="/plant-list">Plant list</a><a href="/case-studies">Case studies</a><a href="/quality">Quality</a><a href="/contact">Request a quote</a></nav>
    <h1>5-axis CNC machining for aerospace and medical, 1 to 5,000 off</h1><img src="/img/shop.webp" alt="Our shop floor">
    <a href="tel:+441130000000">0113 000 0000</a> <a href="https://wa.me/441130000000">WhatsApp us</a> <a href="https://calendly.com/calderbrook/call">Book a call</a>
    <p>© 2026 Calderbrook Precision. AS9100 and ISO 9001 certified.</p></body></html>`,
  '/capabilities': `<html><head><title>Capabilities and tolerances | Calderbrook</title></head><body><h1>Capabilities</h1><p>We hold ±0.01 mm on titanium, 316L stainless and 7075 aluminium.</p></body></html>`,
  '/plant-list': `<html><head><title>Plant list | Calderbrook</title></head><body><h1>Plant list</h1><p>Mazak Variaxis, DMG Mori NLX, Hermle C42, Zeiss Contura CMM. Updated 2026.</p></body></html>`,
  '/case-studies': `<html><head><title>Case studies | Calderbrook</title></head><body><h1>Case studies</h1><p>${filler}</p>${kids}</body></html>`,
  '/quality': `<html><head><title>Quality and approvals | Calderbrook</title></head><body><h1>Quality</h1><p>AS9100 Rev D.</p><a href="/docs/as9100-certificate.pdf">Download our certificate</a></body></html>`,
  '/contact': `<html><head><title>Request a quote | Calderbrook</title></head><body><h1>Request a quote</h1><p>We reply within 4 working hours.</p>
    <form action="/send" method="post"><input type="text" name="name"><input type="email" name="email"><textarea name="msg"></textarea><input type="file" name="drawing"><button>Send</button></form></body></html>`,
  '/wp-content/themes/c/style.css': `body{margin:0}@media (max-width:700px){nav{display:block}}`,
  '/sitemap.xml': `<urlset><url><loc>http://sharp.test/</loc><lastmod>2026-10-02</lastmod></url></urlset>`,
};
export function serve(site, port, delay = 0) {
  const pages = site === 'tired' ? tired : sharp;
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const path = req.url.split('?')[0];
      setTimeout(() => {
        if (path.startsWith('/img/')) { const b = site === 'tired' ? big : Buffer.alloc(60_000, 1); res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': b.length }); return res.end(b); }
        if (pages[path] == null) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<html><body>Not found</body></html>'); }
        res.writeHead(200, { 'content-type': path.endsWith('.css') ? 'text/css' : path.endsWith('.xml') ? 'application/xml' : 'text/html; charset=utf-8' });
        res.end(pages[path]);
      }, delay);
    }).listen(port, '127.0.0.1', () => ok(s));
  });
}

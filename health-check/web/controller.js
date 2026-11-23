
/* =====================================================================
   v5 · LIVE REPORTS (controller). The page above is drawn by hcBoot(report).
   With no report it shows the Vellmoor sample. A website address typed into
   the form is sent to the Health Check engine; when the report comes back the
   page is redrawn from it. Two ways to reach the engine:
     - on a normal web page: fetch() to the Supabase Edge Function (API)
     - inside a Claude artifact (no outside network): the viewer's Supabase
       connector, which queues the run in the hc_reports table and reads it back
   Strings marked [v5] are new and have not been through Maya, Edie or Quinn.
   ===================================================================== */
(function(){
  "use strict";
  var ROOT = document.getElementById('hcRoot'); if (!ROOT) return;
  var TEMPLATE = ROOT.innerHTML;
  var API = 'https://faaraefaigsngvuuvsyv.supabase.co/functions/v1/health-check';
  var ORDER_API = 'https://faaraefaigsngvuuvsyv.supabase.co/functions/v1/hc-order';
  /* Paid orders stay OFF until the privacy notice's Health Check section is live (team rule, ticket 23).
     The switch is hc_config.paid_on in Supabase. The page asks it before sending any personal details. */
  var PROJECT = 'faaraefaigsngvuuvsyv', SERVER = 'Supabase';
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var T = {                                                    /* all [v5] */
    sample:  "This is a sample report for a fictional client. Enter a website address to check a real one.",
    running: "Checking {d}… {n} s. Most sites take under a minute.",
    loading: "Loading that report…",
    ready:   "Report for {d}, measured {when}.",
    sampleLink: "Show the sample",
    badUrl:  "That website address doesn’t look right. Try something like www.yourcompany.co.uk",
    failed:  "The check couldn’t be run just now. Try again in a few minutes.",
    offline: "We couldn’t reach the checker. Check your connection and try again.",
    slow:    "That site is taking too long to check. Try again in a few minutes.",
    noLive:  "Live checks aren’t available in this view, so this is the sample report.",
    connect: "Connect Supabase under Settings, Connectors in Claude to run live checks from this page.",
    allow:   "Live checks need your permission to use Supabase from this page. Run it again and choose Allow.",
    notFound:"That report couldn’t be found. Run the check again.",
    btn: "Run health check", btnBusy: "Checking…"
  };
  var inArtifact = !!(window.claude && typeof window.claude.use === 'function');
  var ui = {value:'', text:T.sample, err:false, busy:false, link:false, live:true};
  var tick = null, runSeq = 0;
  function $(id){ return document.getElementById(id); }
  function fill(t, o){ return String(t).replace(/\{(\w+)\}/g, function(_, k){ return o[k] != null ? o[k] : ''; }); }
  function bare(u){ return String(u || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase(); }
  function okUrl(u){
    u = String(u || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._~:\/?#@!$&()*+,;=%-]{2,300}$/.test(u)) return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(bare(u));
  }

  /* ---------- draw ---------- */
  function paint(){
    var inp = $('runUrl'), btn = $('runBtn'), st = $('runStatus'), bar = $('runBar'); if (!inp || !btn || !st) return;
    if (inp.value !== ui.value) inp.value = ui.value;
    inp.disabled = ui.busy || !ui.live; btn.disabled = ui.busy || !ui.live;
    btn.textContent = ui.busy ? T.btnBusy : T.btn;
    if (ui.err) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
    st.className = 'runstatus' + (ui.err ? ' err' : '');
    st.textContent = ui.text;
    if (ui.link && !ui.busy){ var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-sample', ''); b.textContent = T.sampleLink; st.appendChild(b); }
    if (bar) bar.hidden = !ui.busy;
  }
  function say(text, err, link){ ui.text = text; ui.err = !!err; ui.link = !!link; paint(); }
  function mount(report){
    ROOT.innerHTML = TEMPLATE;
    try { hcBoot(report || null); } catch (e){ if (window.console) console.error(e); }
    var f = $('runForm'), inp = $('runUrl'), st = $('runStatus');
    if (f) f.addEventListener('submit', onSubmit);
    if (inp) inp.addEventListener('input', function(){ ui.value = inp.value; if (ui.err){ ui.err = false; inp.removeAttribute('aria-invalid'); } });
    if (st) st.addEventListener('click', function(e){ if (!e.target.closest('[data-sample]')) return; setRef(null); ui.value = ''; ui.text = T.sample; ui.err = false; ui.link = false; mount(null); });
    wireOrder(report);
    paint();
  }

  /* ---------- Performance Test order form ---------- */
  var O = {                                                    /* all [v5.2] */
    url: 'Add your website address.', name: 'Add your name.', email: 'Add an email address we can send your report to.',
    comp: 'For a competitor, add both their company name and their website, or leave both blank.', compUrl: 'That competitor’s website address doesn’t look right.',
    consent: 'Please tick to agree to the privacy notice.', off: 'We’re not taking Performance Test orders just yet, so nothing has been sent or charged.',
    making: 'Setting up your secure payment…', go: 'Taking you to Stripe to pay…', link: 'Continue to secure payment', failed: 'Your order couldn’t be started. Nothing has been charged. Try again in a few minutes.'
  };
  function wireOrder(report){
    var card = document.querySelector('.pt-card'), f = $('ptForm'); if (!card || !f) return;
    var err = $('ptErr'), st = $('ptStatus'), pay = $('ptPay');
    function open(){ f.hidden = false; card.classList.add('open'); $('ptOpen').hidden = true;
      var u = $('ptUrl'); if (!u.value) u.value = (report && report.domain) || (okUrl(ui.value) ? bare(ui.value) : '');
      try { (u.value ? $('ptName') : u).focus(); } catch (e){} }
    function close(){ f.hidden = true; card.classList.remove('open'); $('ptOpen').hidden = false; err.textContent = ''; st.textContent = ''; }
    $('ptOpen').addEventListener('click', open);
    document.querySelectorAll('[data-pt-open]').forEach(function(b){ b.addEventListener('click', function(){ open(); try { card.scrollIntoView({behavior:'smooth', block:'center'}); } catch (e){} }); });
    $('ptCancel').addEventListener('click', close);
    f.addEventListener('submit', function(e){
      e.preventDefault(); st.textContent = '';
      f.querySelectorAll('[aria-invalid]').forEach(function(x){ x.removeAttribute('aria-invalid'); });
      var v = function(id){ return ($(id).value || '').trim(); };
      var bad = function(id, msg){ $(id).setAttribute('aria-invalid', 'true'); err.textContent = msg; try { $(id).focus(); } catch (x){} };
      var cn = v('ptCompName'), cu = v('ptCompUrl');
      if (!okUrl(v('ptUrl'))) return bad('ptUrl', O.url);
      if (!v('ptName')) return bad('ptName', O.name);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('ptEmail'))) return bad('ptEmail', O.email);
      if (!!cn !== !!cu) return bad(cn ? 'ptCompUrl' : 'ptCompName', O.comp);
      if (cu && !okUrl(cu)) return bad('ptCompUrl', O.compUrl);
      if (!$('ptConsent').checked) return bad('ptConsent', O.consent);
      err.textContent = '';
      var order = {url: v('ptUrl'), name: v('ptName'), email: v('ptEmail'), competitor: cn ? {name: cn, url: cu} : null, consent: true};
      pay.disabled = true; st.textContent = O.making;
      var tp0 = null;
      transport().then(function(tp){ if (!tp || !tp.order) throw {hc: T.noLive}; tp0 = tp; return tp.isOpen(); }).then(function(open){
        if (!open) throw {hc: O.off};                 /* nothing personal has left the page */
        return tp0.order(order);
      }).then(function(r){
        if (!r || !r.checkout_url || !/^https:\/\/checkout\.stripe\.com\//.test(r.checkout_url)) throw {hc: (r && r.error) || O.failed};
        if (!inArtifact){ st.textContent = O.go; location.href = r.checkout_url; return; }
        st.textContent = ''; var a = document.createElement('a'); a.href = r.checkout_url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = O.link + ' →'; st.appendChild(a); pay.disabled = false;
      }).catch(function(e2){ pay.disabled = false; st.textContent = (e2 && e2.hc) || O.failed; });
    });
  }

  /* ---------- reaching the engine ---------- */
  var transportP = null;
  function transport(){
    if (!transportP) transportP = inArtifact
      ? window.claude.use('mcp').then(function(mcp){ return mcp ? viaConnector(mcp) : null; }, function(){ return null; })
      : Promise.resolve(viaFetch());
    return transportP;
  }
  function viaFetch(){
    function body(r){ return r.json().catch(function(){ return {}; }).then(function(b){ b = b || {}; if (!r.ok && !b.error) b.error = T.failed; return b; }); }
    return {
      start: function(url){ return fetch(API, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({url:url, source:'web'})}).then(body); },
      read:  function(id){ return fetch(API + '?id=' + encodeURIComponent(id), {cache:'no-store'}).then(body); },
      order: function(o){ return fetch(ORDER_API, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(o)}).then(body); },
      isOpen: function(){ return fetch(ORDER_API + '?open', {cache:'no-store'}).then(body).then(function(b){ return !!(b && b.open); }); },
      full:  function(token){ return fetch(ORDER_API + '?token=' + encodeURIComponent(token), {cache:'no-store'}).then(body); },
      paid:  function(id){ return fetch(ORDER_API + '?status=' + encodeURIComponent(id), {cache:'no-store'}).then(body); }
    };
  }
  function viaConnector(mcp){
    var kicked = {};
    function sql(q){
      return mcp.callTool(SERVER, 'execute_sql', {project_id: PROJECT, query: q}, {cache:false}).then(function(res){
        var p = res && res.payload; return typeof p === 'string' ? p : (p && typeof p.result === 'string') ? p.result : JSON.stringify(res || '');
      });
    }
    return {
      start: function(url){
        var q = "insert into public.hc_reports (url, source) values ('" + url.replace(/'/g, "''") + "', 'artifact') returning 'HCID:' || id::text || ':END' as r";
        return sql(q).then(function(txt){ var m = /HCID:([0-9a-f-]{36}):END/i.exec(txt); return m ? {id: m[1]} : {error: T.failed}; });
      },
      read: function(id){
        if (!UUID.test(id)) return Promise.resolve({error: T.notFound});
        var q = "select 'HCB64:' || encode(convert_to(json_build_object('status', status, 'error', error, 'report', report, 'age', extract(epoch from now() - created_at))::text, 'UTF8'), 'base64') || ':END' as r from public.hc_reports where id = '" + id + "'";
        return sql(q).then(function(txt){
          var m = /HCB64:([A-Za-z0-9+\/=\\\s]+?):END/.exec(txt); if (!m) return {error: T.notFound};
          var bin = atob(m[1].replace(/\\[nr]/g, '').replace(/[^A-Za-z0-9+\/=]/g, ''));
          var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          var row = JSON.parse(new TextDecoder('utf-8').decode(bytes));
          /* a run still waiting after 20 s missed its start signal: send it once more */
          if (row && row.status === 'queued' && row.age > 20 && !kicked[id]){
            kicked[id] = true;
            sql("select net.http_post(url := '" + API + "', body := jsonb_build_object('id', id), headers := '{\"Content-Type\":\"application/json\"}'::jsonb) from public.hc_reports where id = '" + id + "' and status = 'queued'").catch(function(){});
          }
          return row;
        });
      },
      isOpen: function(){ return sql("select 'HCOPEN:' || paid_on::text || ':END' as r from public.hc_config where id = 1").then(function(t){ return /HCOPEN:true:END/.test(t); }); },
      /* the customer's full report, by its private token (same data the web route returns) */
      full: function(token){
        if (!/^[0-9a-f]{48}$/.test(token)) return Promise.resolve({error: T.notFound});
        var q = "select 'HCB64:' || encode(convert_to(json_build_object('order', json_build_object('site', regexp_replace(regexp_replace(o.url, '^https?://', ''), '^www\\.', ''), 'competitor_name', o.competitor_name, 'competitor_url', o.competitor_url, 'review', o.review, 'delivered_at', o.delivered_at), 'report', r.report, 'competitor_report', c.report)::text, 'UTF8'), 'base64') || ':END' as r from public.hc_orders o left join public.hc_reports r on r.id = o.report_id left join public.hc_reports c on c.id = o.competitor_report_id where o.access_token = '" + token + "' and o.status in ('delivered', 'review')";
        return sql(q).then(function(txt){
          var m = /HCB64:([A-Za-z0-9+\/=\\\s]+?):END/.exec(txt); if (!m) return {error: T.notFound};
          var bin = atob(m[1].replace(/\\[nr]/g, '').replace(/[^A-Za-z0-9+\/=]/g, ''));
          var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return JSON.parse(new TextDecoder('utf-8').decode(bytes));
        });
      },
      /* in a Claude artifact: queue the order in the database; the order function makes the Stripe checkout and stores its link */
      order: function(o){
        var q = function(x){ return x == null ? 'null' : "'" + String(x).replace(/'/g, "''") + "'"; };
        var ins = "insert into public.hc_orders (url, customer_name, customer_email, competitor_name, competitor_url, consent_at, source) values (" + [q(o.url), q(o.name), q(o.email), q(o.competitor && o.competitor.name), q(o.competitor && o.competitor.url)].join(', ') + ", now(), 'artifact') returning 'HCID:' || id::text || ':END' as r";
        return sql(ins).then(function(txt){
          var m = /HCID:([0-9a-f-]{36}):END/i.exec(txt); if (!m) return {error: O.failed};
          var id = m[1], tries = 0;
          return new Promise(function(ok){ (function again(){ setTimeout(function(){
            sql("select 'HCURL:' || coalesce(checkout_url, '') || '|' || coalesce(error, '') || ':END' as r from public.hc_orders where id = '" + id + "'").then(function(t){
              var r = /HCURL:([^|]*)\|([^:]*(?::[^E][^:]*)*):END/.exec(t) || [];
              if (r[1]) return ok({checkout_url: r[1]});
              if (r[2]) return ok({error: r[2]});
              if (++tries > 15) return ok({error: O.failed}); again();
            }, function(){ if (++tries > 15) return ok({error: O.failed}); again(); });
          }, 1500); })(); });
        });
      }
    };
  }
  function msgOf(e){
    if (e && e.hc) return e.hc;
    var c = e && e.code;
    if (c === 'server_not_connected' || c === 'needs_reauth' || c === 'selection_required' || c === 'server_not_found') return T.connect;
    if (c === 'not_in_manifest' || c === 'not_granted' || c === 'approval_required' || c === 'consent_required' || c === 'blocked_by_policy') return T.allow;
    if (c) return T.failed;
    return (e instanceof TypeError) ? T.offline : T.failed;
  }

  /* ---------- where the current report lives in the address ---------- */
  function refFromAddress(){
    try { var q = new URLSearchParams(location.search).get('r'); if (q && UUID.test(q)) return q; } catch (e){}
    var h = /^#r-([0-9a-f-]{36})$/i.exec(location.hash || ''); return h && UUID.test(h[1]) ? h[1] : null;
  }
  function setRef(id){
    try {
      if (inArtifact){ if (id) location.hash = 'r-' + id; else if (/^#r-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); }
      else { var u = new URL(location.href); if (id) u.searchParams.set('r', id); else u.searchParams.delete('r'); u.hash = ''; history.replaceState(null, '', u.toString()); }
    } catch (e){}
  }

  /* ---------- run ---------- */
  function poll(tp, id, seq){
    return new Promise(function(ok, no){
      var tries = 0, misses = 0;
      (function again(){
        setTimeout(function(){
          if (seq !== runSeq) return;
          tp.read(id).then(function(row){
            misses = 0; row = row || {};
            if (row.status === 'done' && row.report) return ok(row.report);
            if (row.status === 'error' || (row.error && !row.status)) return no({hc: row.error || T.failed});
            if (++tries > 60) return no({hc: T.slow});
            again();
          }, function(err){ if (err && err.code && !err.retryable) return no(err); if (++misses > 3 || ++tries > 60) return no(err); again(); });
        }, tries < 2 ? 2500 : 3500);
      })();
    });
  }
  function stopTick(){ if (tick){ clearInterval(tick); tick = null; } }
  function when(iso){ var t = Date.parse(iso); if (!t) return ''; var mins = Math.round((Date.now() - t) / 60000); if (mins < 3) return 'just now';
    try { return 'on ' + new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'long', year:'numeric', timeZone:'Europe/London'}).format(new Date(t)); } catch (e){ return 'on ' + String(iso).slice(0, 10); } }
  function finish(report, id){
    stopTick(); ui.busy = false; setRef(id);
    ui.value = report.domain || ui.value; ui.text = fill(T.ready, {d: report.domain || '', when: when(report.tested)}); ui.err = false; ui.link = true;
    mount(report);
    try { window.scrollTo(0, 0); } catch (e){}
  }
  function fail(e){ stopTick(); ui.busy = false; say(msgOf(e), true, false); }
  function onSubmit(e){
    e.preventDefault(); if (ui.busy || !ui.live) return;
    var raw = ($('runUrl').value || '').trim(); ui.value = raw;
    if (!okUrl(raw)){ say(T.badUrl, true, false); try { $('runUrl').focus(); } catch (x){} return; }
    var seq = ++runSeq, t0 = Date.now(), d = bare(raw);
    ui.busy = true; say(fill(T.running, {d: d, n: 0}), false, false);
    stopTick(); tick = setInterval(function(){ if (seq === runSeq && ui.busy) say(fill(T.running, {d: d, n: Math.round((Date.now() - t0) / 1000)}), false, false); }, 1000);
    var runId = null;
    transport().then(function(tp){
      if (!tp) throw {hc: T.noLive};
      return tp.start(raw).then(function(b){ if (!b || !b.id) throw {hc: (b && b.error) || T.failed}; runId = b.id; return poll(tp, b.id, seq); });
    }).then(function(report){ if (seq === runSeq) finish(report, runId); }, function(err){ if (seq === runSeq) fail(err); });
  }

  /* ---------- the paid Performance Test report: the automatic report with the designer's review laid over it ---------- */
  function mergeFull(d){
    var rep = JSON.parse(JSON.stringify(d.report || {})), rv = (d.order && d.order.review) || {}, ch = rv.checks || {};
    rep.checks = rep.checks || {};
    Object.keys(ch).forEach(function(k){
      var x = ch[k] || {}, c = rep.checks[k] || (rep.checks[k] = {});
      if (typeof x.score === 'number' && isFinite(x.score)) { c.score = Math.max(0, Math.min(10, Math.round(x.score * 10) / 10)); c.basis = 'designer'; }
      if (x.found) c.flaw = String(x.found);
      c.note = x.note ? 'Designer’s note: ' + x.note : (c.basis === 'designer' ? 'Checked by a designer.' : c.note);
    });
    var cr = d.competitor_report, o = d.order || {};
    rep.full = { summary: rv.summary || '', priorities: (rv.priorities || []).filter(Boolean), competitorNote: rv.competitor_note || '', delivered_at: o.delivered_at,
      competitor: cr ? { name: o.competitor_name || cr.name, domain: bare(o.competitor_url || cr.domain), url: 'https://' + bare(o.competitor_url || cr.domain), values: cr.values || {} } : null };
    return rep;
  }
  function fullFromAddress(){
    try { var q = new URLSearchParams(location.search).get('full'); if (q && /^[0-9a-f]{48}$/.test(q)) return q; } catch (e){}
    var h = /^#full-([0-9a-f]{48})$/.exec(location.hash || ''); return h ? h[1] : null;
  }
  var P = {                                                    /* [v5.2] */
    loading: 'Loading your Performance Test…', ready: 'Your Performance Test for {d}, reviewed by a 34 Automation designer.',
    paid: 'Payment received, thank you. Your Performance Test for {d} will be with you by email by {due}.',
    paidSoon: 'Payment received, thank you. Your Performance Test will be with you by email within 3 working hours.',
    cancelled: 'Payment cancelled. Nothing has been charged.', missing: 'That report link isn’t valid, or the report isn’t ready yet.'
  };

  /* ---------- start ---------- */
  mount(null);
  var ref = refFromAddress(), fullTok = fullFromAddress(), qs = {};
  try { var sp = new URLSearchParams(location.search); qs.paid = sp.get('paid'); qs.cancelled = sp.get('cancelled'); } catch (e){}
  if (fullTok){
    ref = null; var seqF = ++runSeq; ui.busy = true; say(P.loading, false, false);
    transport().then(function(tp){ if (!tp || !tp.full) throw {hc: T.noLive}; return tp.full(fullTok); }).then(function(d){
      if (seqF !== runSeq) return;
      if (!d || !d.report) throw {hc: (d && d.error) || P.missing};
      var rep = mergeFull(d); stopTick(); ui.busy = false; ui.value = rep.domain || ''; ui.err = false; ui.link = false;
      ui.text = fill(P.ready, {d: rep.domain || ''}); mount(rep); try { window.scrollTo(0, 0); } catch (e){}
    }).catch(function(err){ if (seqF === runSeq) fail(err); });
  } else if (qs.paid && UUID.test(qs.paid)){
    say(P.paidSoon, false, false);
    transport().then(function(tp){ return tp && tp.paid ? tp.paid(qs.paid) : null; }).then(function(r){ if (r && r.due_text) say(fill(P.paid, {d: r.site || '', due: r.due_text}), false, false); }).catch(function(){});
  } else if (qs.cancelled){ say(P.cancelled, false, false); }
  if (ref && !fullTok){
    var seq0 = ++runSeq; ui.busy = true; say(T.loading, false, false);
    transport().then(function(tp){ if (!tp) throw {hc: T.noLive}; return tp.read(ref); })
      .then(function(row){ if (seq0 !== runSeq) return; if (row && row.status === 'done' && row.report) finish(row.report, ref); else if (row && (row.status === 'running' || row.status === 'queued')) return transport().then(function(tp){ return poll(tp, ref, seq0); }).then(function(rep){ if (seq0 === runSeq) finish(rep, ref); }); else throw {hc: (row && row.error) || T.notFound}; })
      .catch(function(err){ if (seq0 === runSeq) fail(err); });
  } else if (inArtifact){
    transport().then(function(tp){ if (!tp){ ui.live = false; say(T.noLive, false, false); } });
  }
})();


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
    paint();
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
      read:  function(id){ return fetch(API + '?id=' + encodeURIComponent(id), {cache:'no-store'}).then(body); }
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

  /* ---------- start ---------- */
  mount(null);
  var ref = refFromAddress();
  if (ref){
    var seq0 = ++runSeq; ui.busy = true; say(T.loading, false, false);
    transport().then(function(tp){ if (!tp) throw {hc: T.noLive}; return tp.read(ref); })
      .then(function(row){ if (seq0 !== runSeq) return; if (row && row.status === 'done' && row.report) finish(row.report, ref); else if (row && (row.status === 'running' || row.status === 'queued')) return transport().then(function(tp){ return poll(tp, ref, seq0); }).then(function(rep){ if (seq0 === runSeq) finish(rep, ref); }); else throw {hc: (row && row.error) || T.notFound}; })
      .catch(function(err){ if (seq0 === runSeq) fail(err); });
  } else if (inArtifact){
    transport().then(function(tp){ if (!tp){ ui.live = false; say(T.noLive, false, false); } });
  }
})();

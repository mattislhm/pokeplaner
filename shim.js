// PokéPlaner im Browser / als Handy-App: ersetzt die Mac-Funktionen (window.rhNet), die sonst preload.js bereitstellt.
// In der Mac-App ist window.rhNet schon da, dann passiert hier nichts.
(function () {
  if (window.rhNet) return;
  window.PP_WEB = true;
  document.documentElement.classList.add('web');

  // Verbindungsdaten aus dem QR-Code-Link (#sync=TOKEN.GISTID) übernehmen und aus der Adresse löschen
  try {
    const m = /[#&]sync=([^&]+)/.exec(location.hash);
    if (m) {
      const [token, gist] = decodeURIComponent(m[1]).split('.');
      const cur = JSON.parse(localStorage.getItem('pokeplaner-sync') || '{}');
      localStorage.setItem('pokeplaner-sync', JSON.stringify(Object.assign(cur, { token, gist: gist || cur.gist || '' })));
      history.replaceState(null, '', location.pathname);
    }
  } catch (e) {}

  // Zwischengespeicherte Daten vom Mac (Events, News, Hintergründe, Bosse) vor dem App-Start holen,
  // weil manche Seiten sich nicht direkt aus dem Browser abrufen lassen
  try {
    const s = JSON.parse(localStorage.getItem('pokeplaner-sync') || '{}');
    if (s.token && s.gist && navigator.onLine !== false) {
      const x = new XMLHttpRequest();
      x.open('GET', 'https://api.github.com/gists/' + s.gist, false);
      x.setRequestHeader('Authorization', 'Bearer ' + s.token);
      x.setRequestHeader('Accept', 'application/vnd.github+json');
      x.send();
      if (x.status === 200) {
        const g = JSON.parse(x.responseText), f = g.files && g.files['cache.json'];
        let txt = f && f.content;
        if (f && f.truncated && f.raw_url) { const y = new XMLHttpRequest(); y.open('GET', f.raw_url, false); y.send(); if (y.status === 200) txt = y.responseText; }
        if (txt) {
          const c = JSON.parse(txt);
          Object.keys(c.keys || {}).forEach(k => {
            let mine = null; try { mine = JSON.parse(localStorage.getItem(k)); } catch (e) {}
            const at = o => (o && (o.at || o.fetchedAt || o.t)) || 0;
            if (!mine || at(c.keys[k]) >= at(mine)) localStorage.setItem(k, JSON.stringify(c.keys[k]));
          });
        }
        // Pokémon-Liste gleich mit übernehmen, damit die App schon beim Start den neuesten Stand zeigt
        const d = g.files && g.files['pokeplaner.json'];
        let dt = d && d.content;
        if (d && d.truncated && d.raw_url) { const y = new XMLHttpRequest(); y.open('GET', d.raw_url, false); y.send(); if (y.status === 200) dt = y.responseText; }
        if (dt) localStorage.setItem('pokeplaner-remote', dt);
      }
    }
  } catch (e) {}

  let ocrWorker = null;
  async function getOcr() {
    if (ocrWorker) return ocrWorker;
    if (!window.Tesseract) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'vendor/tesseract.min.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
    const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    ocrWorker = await window.Tesseract.createWorker('deu', 1, { workerPath: base + 'vendor/worker.min.js', corePath: base + 'vendor/core', langPath: base + 'lang', gzip: false, workerBlobURL: false });
    return ocrWorker;
  }

  window.rhNet = {
    web: true,
    get: url => fetch(url, { cache: 'no-store' }).then(r => r.text().then(text => ({ ok: r.ok, status: r.status, text }))).catch(err => ({ ok: false, error: String(err) })),
    ics: (id, text) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
      a.download = (id || 'event') + '.ics'; document.body.appendChild(a); a.click(); a.remove();
      return Promise.resolve({ ok: true });
    },
    ocr: async (img, rects) => {
      try {
        const w = await getOcr(), out = {};
        for (const k of Object.keys(rects)) { const { data } = await w.recognize(img, { rectangle: rects[k] }); out[k] = data.text; }
        return { ok: true, text: out };
      } catch (err) { return { ok: false, error: String(err) }; }
    }
  };

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();

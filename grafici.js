/* Cruscotto dei conti: andamento nel tempo e ripartizioni.
   SVG scritto a mano, nessuna libreria. Tavolozza verificata sul fondo scuro. */
(() => {
'use strict';
  const TINTE = ['#bb862c', '#1f9aad', '#d9693a', '#5b78d6', '#5aa33f', '#b957a0'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n || 0));
  const breve = (n) => { n = Math.round(n || 0); return n >= 1000 ? (n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'k' : String(n); };
  const giorno = (iso) => { const d = new Date(String(iso) + 'T12:00:00'); return isFinite(d) ? d.getTime() / 86400000 : null; };

  let stato = null;   // dati dell'andamento, per il mirino

  /* ---- andamento: capitale impegnato e guadagno maturato ---- */
  function andamento(me) {
    const ops = (me.operazioni || []).map((o) => ({ inizio: o.inizio, fine: o.fine, investito: +o.investito || 0, guadagno: +o.guadagnoPrevisto || 0 }));
    const quote = (me.rete || []).map((r) => ({ inizio: r.inizio, fine: r.fine, investito: 0, guadagno: +r.importo || 0 }));
    const tutte = ops.concat(quote).filter((o) => giorno(o.inizio) != null && giorno(o.fine) != null);
    if (!tutte.length) { stato = null; return ''; }

    const a = Math.min(...tutte.map((o) => giorno(o.inizio)));
    const b = Math.max(...tutte.map((o) => giorno(o.fine)));
    const span = Math.max(b - a, 1);
    const N = 56, W = 100, H = 34, ml = 11, mr = 2, mt = 3.5, mb = 6.5;
    const px = (i) => ml + (W - ml - mr) * i / (N - 1);
    const serie = [...Array(N)].map((_, i) => {
      const t = a + span * i / (N - 1); let cap = 0, gua = 0;
      for (const o of tutte) {
        const s0 = giorno(o.inizio), e0 = giorno(o.fine), dur = Math.max(e0 - s0, 1);
        if (t >= s0 && t < e0) cap += o.investito;
        gua += o.guadagno * Math.max(0, Math.min((t - s0) / dur, 1));
      }
      return [cap, gua];
    });
    const picco = Math.max(1, ...serie.map(([c, g]) => c + g));
    const py = (v) => mt + (H - mt - mb) * (1 - v / picco);
    const linea = (f) => serie.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(2)} ${py(f(v)).toFixed(2)}`).join(' ');
    const area = (f) => linea(f) + ` L${px(N - 1).toFixed(2)} ${py(0).toFixed(2)} L${px(0).toFixed(2)} ${py(0).toFixed(2)} Z`;

    const oggi = giorno(me.oggi || new Date().toISOString().slice(0, 10));
    const xOggi = (oggi != null && oggi >= a && oggi <= b) ? px((oggi - a) / span * (N - 1)) : null;
    const tacche = [0, .5, 1].map((f) => [px(f * (N - 1)), new Date((a + span * f) * 86400000).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })]);

    stato = { serie, N, a, span, W, H, ml, mr, px, py };

    return `<figure class="gr gr-and">
      <figcaption>Andamento · capitale e guadagno maturato</figcaption>
      <div class="tela">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento nel tempo del capitale impegnato e del guadagno maturato">
          ${[0, .5, 1].map((f) => `<line class="gri" x1="${ml}" x2="${W - mr}" y1="${py(picco * f).toFixed(2)}" y2="${py(picco * f).toFixed(2)}"/>`).join('')}
          <path class="ar2" d="${area((v) => v[0] + v[1])}"/>
          <path class="ar1" d="${area((v) => v[0])}"/>
          <path class="li2" d="${linea((v) => v[0] + v[1])}"/>
          <path class="li1" d="${linea((v) => v[0])}"/>
          ${xOggi != null ? `<line class="oggi" x1="${xOggi.toFixed(2)}" x2="${xOggi.toFixed(2)}" y1="${mt - 1.2}" y2="${py(0).toFixed(2)}"/>
          <text class="oggi-t" x="${Math.min(xOggi + 1, W - mr - 6).toFixed(2)}" y="${mt - 1.6}">oggi</text>` : ''}
          <line class="asse" x1="${ml}" x2="${W - mr}" y1="${py(0).toFixed(2)}" y2="${py(0).toFixed(2)}"/>
          ${[0, .5, 1].map((f) => `<text class="ay" x="${ml - 1.6}" y="${(py(picco * f) + 1).toFixed(2)}">${breve(picco * f)} €</text>`).join('')}
          ${tacche.map(([x, t], i) => `<text class="ax" x="${x.toFixed(2)}" y="${H - 1.6}" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${t}</text>`).join('')}
          <g class="mirino"><line y1="${mt - 1}" y2="${py(0).toFixed(2)}"/><circle r="1.1" class="p2"/><circle r="1.1" class="p1"/></g>
        </svg>
        <div class="suggerimento-g" hidden></div>
      </div>
      <ul class="leg"><li><i style="background:${TINTE[0]}"></i>Capitale impegnato</li>
      <li><i style="background:${TINTE[1]}"></i>Guadagno maturato</li></ul></figure>`;
  }

  /* ---- ciambella con etichette diesse accanto ---- */
  function torta(voci, titolo, vuoto) {
    const tot = voci.reduce((s, v) => s + v[1], 0);
    if (!tot) return `<figure class="gr gr-torta"><figcaption>${esc(titolo)}</figcaption><p class="vuoto-g">${esc(vuoto)}</p></figure>`;
    const R = 38, r = 23, cx = 50, cy = 50; let ang = -Math.PI / 2;
    const archi = voci.map(([et, val], i) => {
      const frazione = val / tot, delta = frazione * Math.PI * 2, fine = ang + delta;
      const p = (al, rr) => [(cx + rr * Math.cos(al)).toFixed(2), (cy + rr * Math.sin(al)).toFixed(2)];
      const [x1, y1] = p(ang, R), [x2, y2] = p(fine, R), [x3, y3] = p(fine, r), [x4, y4] = p(ang, r);
      const grande = delta > Math.PI ? 1 : 0; ang = fine;
      return `<path d="M${x1} ${y1} A${R} ${R} 0 ${grande} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${grande} 0 ${x4} ${y4} Z"
        fill="${TINTE[i % TINTE.length]}"><title>${esc(et)}: ${eur(val)} · ${Math.round(frazione * 100)}%</title></path>`;
    }).join('');
    return `<figure class="gr gr-torta"><figcaption>${esc(titolo)}</figcaption>
      <div class="torta-riga">
        <svg viewBox="0 0 100 100" role="img" aria-label="${esc(titolo)}">${archi}
          <text class="t-mez" x="50" y="48">${breve(tot)} €</text><text class="t-sot" x="50" y="59">totale</text></svg>
        <ul class="leg leg-v">${voci.map(([et, val], i) =>
          `<li><i style="background:${TINTE[i % TINTE.length]}"></i><span>${esc(et)}</span><b>${eur(val)}</b></li>`).join('')}</ul>
      </div></figure>`;
  }

  function raggruppa(coppie, massimo, etichettaResto) {
    const v = coppie.filter((c) => c[1] > 0).sort((x, y) => y[1] - x[1]);
    return v.length > massimo
      ? v.slice(0, massimo).concat([[etichettaResto, v.slice(massimo).reduce((s, c) => s + c[1], 0)]])
      : v;
  }

  function cruscotto(me) {
    if (!me) return '';
    const ops = me.ruolo === 'master' ? [] : (me.operazioni || []);
    const rete = me.rete || [];
    if (!ops.length && !rete.length) return '';
    const quoteTot = rete.reduce((s, r) => s + (+r.importo || 0), 0);
    const tt = me.totali || {};
    const prossima = ops.filter((o) => o.stato !== 'conclusa').map((o) => giorno(o.fine)).filter((x) => x != null).sort((a, b) => a - b)[0];
    const giorniMancanti = prossima != null ? Math.max(0, Math.round(prossima - Date.now() / 86400000)) : null;

    return `<section class="cruscotto">
      <div class="kpis">
        <div><span class="lbl">Capitale</span><b>${eur(tt.investito || 0)}</b></div>
        <div><span class="lbl">Guadagno previsto</span><b class="pos">${eur((tt.guadagnoPrevisto || 0) + quoteTot)}</b></div>
        <div><span class="lbl">Totale alla chiusura</span><b>${eur((tt.investito || 0) + (tt.guadagnoPrevisto || 0) + quoteTot)}</b></div>
        <div><span class="lbl">${giorniMancanti != null ? 'Prossima chiusura' : 'Operazioni'}</span><b>${giorniMancanti != null ? giorniMancanti + ' giorni' : ops.length}</b></div>
      </div>
      ${andamento(me)}
      <div class="torte">
        ${torta(raggruppa(ops.map((o) => [o.titolo, +o.investito || 0]), 5, 'Altre operazioni'), 'Capitale per operazione', 'Nessun capitale impegnato')}
        ${torta(raggruppa(ops.map((o) => [o.titolo, +o.guadagnoPrevisto || 0]), 4, 'Altre operazioni')
            .concat(quoteTot > 0 ? [['Quote dai tuoi clienti', quoteTot]] : []), 'Da dove arriva il guadagno', 'Nessun guadagno previsto')}
      </div>
    </section>`;
  }

  /* il mirino legge i valori del giorno sotto il puntatore */
  function cabla(radice) {
    const tela = radice && radice.querySelector('.gr-and .tela');
    if (!tela || !stato || tela.dataset.cablato) return;
    tela.dataset.cablato = '1';
    const d = stato, mir = tela.querySelector('.mirino'), sug = tela.querySelector('.suggerimento-g');
    const li = mir.querySelector('line'), p1 = mir.querySelector('.p1'), p2 = mir.querySelector('.p2');
    const leggi = (e) => {
      const r = tela.getBoundingClientRect(); if (!r.width) return;
      const u = (e.clientX - r.left) / r.width * d.W;
      const i = Math.max(0, Math.min(d.N - 1, Math.round((u - d.ml) / (d.W - d.ml - d.mr) * (d.N - 1))));
      const [cap, gua] = d.serie[i], x = d.px(i);
      li.setAttribute('x1', x); li.setAttribute('x2', x);
      p1.setAttribute('cx', x); p1.setAttribute('cy', d.py(cap));
      p2.setAttribute('cx', x); p2.setAttribute('cy', d.py(cap + gua));
      mir.classList.add('on');
      sug.innerHTML = '<b>' + new Date((d.a + d.span * i / (d.N - 1)) * 86400000).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) + '</b>'
        + '<i style="background:' + TINTE[0] + '"></i>Capitale ' + eur(cap) + '<br>'
        + '<i style="background:' + TINTE[1] + '"></i>Guadagno ' + eur(gua);
      sug.hidden = false;
      sug.style.left = Math.max(12, Math.min(tela.clientWidth - 12, x / d.W * tela.clientWidth)) + 'px';
      sug.style.top = (d.py(cap + gua) / d.H * tela.clientHeight) + 'px';
    };
    const via = () => { mir.classList.remove('on'); sug.hidden = true; };
    tela.addEventListener('pointermove', leggi);
    tela.addEventListener('pointerdown', leggi);
    tela.addEventListener('pointerleave', via);
    tela.addEventListener('pointercancel', via);
  }

  window.GraficiFGMA = { cruscotto, cabla };
})();

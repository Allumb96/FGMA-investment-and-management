(() => {
'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
  const dataIt = (iso, o = { day: 'numeric', month: 'long', year: 'numeric' }) => new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', o);

  function meter(op) {
    const pct = Math.round(op.progresso * 100);
    return `<div class="meter" data-p="${op.progresso}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Avanzamento dell'operazione">
      <div class="meter-fill" style="--p:${op.progresso}"></div>
    </div>`;
  }

  const STATO = { non_iniziata: ['Non ancora iniziata', ''], in_corso: ['In corso', 'run'], conclusa: ['Conclusa', 'done'] };
  const giorni = (n) => `${n} ${n === 1 ? 'giorno' : 'giorni'}`;
  const ilData = (iso, b) => { const g = Number(String(iso).slice(8, 10)); const t = b ? `<b>${dataIt(iso)}</b>` : dataIt(iso); return (g === 8 || g === 11 ? "l'" : 'il ') + t; };
  const fraseStato = (x) => x.stato === 'conclusa' ? `L'operazione si è conclusa ${ilData(x.fine, true)}.`
    : x.stato === 'non_iniziata' ? `L'operazione partirà ${ilData(x.inizio, true)}.`
    : `Mancano <b>${giorni(x.giorniMancanti)}</b> alla chiusura, ${ilData(x.fine)}.`;

  // scheda a fisarmonica: tocchi e si apre verso il basso, tocchi di nuovo e si chiude
  function scheda(key, { titolo, desc, x, riga1, riga2, img, dettaglio }) {
    const [txt, cls] = STATO[x.stato];
    return `<article class="op acc${img ? ' con-img img-' + esc(img) : ''}" data-reveal>
      <button type="button" class="acc-head" aria-expanded="false" aria-controls="acc-${esc(key)}">
        <div class="op-head"><div><h2>${esc(titolo)}</h2><p class="desc">${esc(desc)}</p></div><span class="pill ${cls}"><i></i>${txt}</span></div>
        <div class="meter-top"><span class="lbl">Avanzamento</span><b>${Math.round(x.progresso * 100)}%</b></div>
        ${meter(x)}
        <div class="mini-foot"><span>${riga1}</span><span>${riga2}</span></div>
        <span class="apri"><span class="apri-t">Mostra i dettagli</span> <i aria-hidden="true">›</i></span>
      </button>
      <div class="acc-body" id="acc-${esc(key)}" role="region" aria-label="Dettagli di ${esc(titolo)}"><div class="acc-in"><div class="acc-pad">${dettaglio}</div></div></div>
    </article>`;
  }

  // riepilogo + schede di una persona (usato dall'area cliente e, per ogni cliente, dall'area master)
  function pannello(me, pre) {
    // un'operazione reinveste il totale della precedente (capitale + guadagno) solo se quella si è già chiusa quando questa parte;
    // operazioni che si sovrappongono restano in parallelo, ognuna con il suo capitale (più "catene" indipendenti)
    const reteL = me.rete || [];
    const ord = me.operazioni.slice().sort((x, y) => (x.inizio < y.inizio ? -1 : x.inizio > y.inizio ? 1 : 0));
    const catene = [];
    let reteContata = 0;
    ord.forEach((op) => {
      const libere = catene.filter((c) => !c[c.length - 1].incassa && c[c.length - 1].fine <= op.inizio).sort((a, b) => (a[a.length - 1].fine < b[b.length - 1].fine ? 1 : -1));
      const c = libere[0];
      op.succ = false;
      if (c) {
        const prima = c[c.length - 1];
        // le quote da affiliati già maturate all'inizio di questa operazione vengono reinvestite insieme al resto
        const maturata = reteL.filter((r) => r.fine <= op.inizio).reduce((t, r) => t + r.importo, 0);
        op.dalRete = Math.round((maturata - reteContata) * 100) / 100;
        reteContata += op.dalRete;
        op.riporto = prima.totaleAllaFine;
        op.aggiunta = Math.round((op.investito - op.riporto - op.dalRete) * 100) / 100;
        prima.succ = true;
        c.push(op);
      } else {
        // prima operazione di una catena: può partire anche con guadagni da clienti già maturati e reinvestiti (indicati a mano)
        const disp = Math.round((reteL.filter((r) => r.fine <= op.inizio).reduce((t, r) => t + r.importo, 0) - reteContata) * 100) / 100;
        op.dalRete = Math.max(0, Math.min(op.daRete || 0, disp, op.investito));
        reteContata += op.dalRete;
        op.riporto = 0; op.aggiunta = Math.round((op.investito - op.dalRete) * 100) / 100;
        catene.push([op]);
      }
    });
    const iniziale = catene.reduce((t, c) => t + c[0].investito - c[0].dalRete, 0);
    const aggiunte = ord.reduce((t, o) => t + (o.riporto > 0 ? o.aggiunta : 0), 0);
    const guadagni = ord.reduce((t, o) => t + o.guadagnoPrevisto, 0);
    const versato = iniziale + aggiunte;
    const dCorta = (d) => dataIt(d, { day: 'numeric', month: 'short', year: 'numeric' });
    const subV = aggiunte !== 0 ? `<small class="sub">Iniziale ${eur(iniziale)} ${aggiunte < 0 ? '−' : '+'} ${aggiunte < 0 ? 'prelievi' : 'aggiunte'} ${eur(Math.abs(aggiunte))}</small>`
      : (catene.length > 1 || iniziale !== (ord[0] || {}).investito ? `<small class="sub">${catene.map((c) => `${esc(c[0].titolo)} ${eur(c[0].investito - c[0].dalRete)}`).join(' · ')}</small>` : '');
    const rete = reteL;
    const princ = reteL.some((r) => r.tipo === 'principale');
    const terzi = reteL.length > 0 && reteL.every((r) => r.tipo === 'terzi');
    const lblRete = princ ? 'clienti' : terzi ? 'altre entrate' : 'affiliati';
    const affiliati = rete.length ? me.totaliRete.importo : 0;
    // soldi effettivamente in mano alla chiusura delle ultime operazioni di ogni catena, dopo i reinvestimenti
    const finali = catene.map((c) => c[c.length - 1]).sort((a, b) => (a.fine < b.fine ? -1 : 1));
    const ultima = finali.length ? finali[finali.length - 1] : null;
    const reteNonReinv = Math.round((affiliati - reteContata) * 100) / 100;
    const inMano = Math.round((finali.reduce((t, o) => t + o.totaleAllaFine, 0) + reteNonReinv) * 100) / 100;
    const gainReinv = ord.filter((o) => o.succ).reduce((t, o) => t + o.guadagnoPrevisto, 0);
    const subG = gainReinv > 0 ? `<small class="sub">Di cui ${eur(gainReinv)} reinvestiti nelle operazioni successive</small>` : '<small class="sub">Da incassare alla chiusura</small>';
    const subA = reteContata > 0 ? `<small class="sub">Di cui ${eur(reteContata)} reinvestiti${reteNonReinv > 0 ? ' · ' + eur(reteNonReinv) + ' da incassare' : ''}</small>` : `<small class="sub">${princ ? 'Parte del ritorno che non va ai clienti' : terzi ? 'Margine sul capitale di terzi' : 'Quote sulla tua rete'}</small>`;
    const coda = reteNonReinv > 0 ? ' + ' + eur(reteNonReinv) + ' da ' + lblRete : '';
    const subT = !ultima ? '' : finali.length === 1
      ? `<small class="sub">In mano alla chiusura (${dCorta(ultima.fine)})${ord.length > 1 ? ', dopo i reinvestimenti' : ''}: ${eur(ultima.investito)} + ${eur(ultima.guadagnoPrevisto)} di guadagno finale${coda}</small>`
      : `<small class="sub">In mano alle chiusure: ${finali.map((o) => `${eur(o.totaleAllaFine)} da ${esc(o.titolo)} (${dCorta(o.fine)})`).join(' + ')}${coda}</small>`;
    const kpi = me.operazioni.length
      ? `<div class="kpis${rete.length ? ' kpis-4' : ''}" data-reveal><div><span class="lbl">Capitale versato</span><b>${eur(versato)}</b>${subV}</div><div><span class="lbl">Guadagni previsti</span><b class="pos">+${eur(guadagni)}</b>${subG}</div>${rete.length ? `<div><span class="lbl">${terzi ? 'Altre entrate' : 'Guadagno da ' + lblRete}</span><b class="pos">+${eur(affiliati)}</b>${subA}</div>` : ''}<div><span class="lbl">Totale previsto</span><b>${eur(inMano)}</b>${subT}</div></div>`
      : '';

    const dettOp = (op) => `<div class="dates"><span>${dataIt(op.inizio)}</span><span>${dataIt(op.fine)}</span></div>
        <p class="statement">${op.riporto > 0 ? `Capitale dell'operazione: <b>${eur(op.investito)}</b>, cioè il totale dell'operazione precedente (<b>${eur(op.riporto)}</b>)${op.dalRete > 0 ? `, il guadagno da ${lblRete} reinvestito (<b>${eur(op.dalRete)}</b>)` : ''}${op.aggiunta ? ` ${op.aggiunta < 0 ? 'meno il tuo prelievo' : (op.dalRete > 0 ? 'e la tua aggiunta' : 'più la tua aggiunta')} (<b>${eur(Math.abs(op.aggiunta))}</b>)` : ', reinvestito per intero'}.`
          : op.dalRete > 0 ? `Capitale dell'operazione: <b>${eur(op.investito)}</b>, cioè il guadagno da ${lblRete} reinvestito (<b>${eur(op.dalRete)}</b>)${op.aggiunta > 0 ? ` più la tua aggiunta (<b>${eur(op.aggiunta)}</b>)` : ''}, ${ilData(op.inizio, true)}.` : `Hai versato <b>${eur(op.investito)}</b> ${ilData(op.inizio, true)}.`} ${fraseStato(op)}</p>
        <dl class="facts" style="margin-bottom:0">
          <div><span class="lbl">Capitale dell'operazione</span><b>${eur(op.investito)}</b></div>
          ${op.riporto > 0 ? `<div><span class="lbl">Reinvestito dalla precedente</span><b>${eur(op.riporto)}</b></div>` : ''}${op.dalRete > 0 ? `<div><span class="lbl">Da ${lblRete} reinvestito</span><b>${eur(op.dalRete)}</b></div>` : ''}${(op.riporto > 0 || op.dalRete > 0) && op.aggiunta ? `<div><span class="lbl">${op.aggiunta < 0 ? 'Prelievo' : 'Tua aggiunta'}</span><b>${op.aggiunta < 0 ? '−' : '+'}${eur(Math.abs(op.aggiunta))}</b></div>` : ''}
          <div><span class="lbl">Rendimento concordato</span><b>${op.rendimentoPct}%</b></div>
          <div><span class="lbl">Guadagno previsto</span><b class="pos">+${eur(op.guadagnoPrevisto)}</b></div>
          <div><span class="lbl">Totale a fine operazione</span><b>${eur(op.totaleAllaFine)}</b></div>
        </dl>
        <p class="note">Il guadagno indicato è quello previsto in base al rendimento concordato e viene riconosciuto alla chiusura dell'operazione.</p>`;
    const ops = me.operazioni.map((op, i) => scheda(pre + 'op' + i, { titolo: op.titolo, desc: op.descrizione, x: op, img: op.immagine,
      riga1: `Investito <b>${eur(op.investito)}</b>`, riga2: `Totale previsto <b>${eur(op.totaleAllaFine)}</b>`, dettaglio: dettOp(op) })).join('')
      || '<div class="empty">Non ci sono operazioni attive al momento.</div>';

    // guadagni da clienti: raggruppati per investimento, un elenco per nome con i soli dati che contano
    const gruppi = {}, inizi = {};
    me.operazioni.forEach((o) => { gruppi[o.titolo] = gruppi[o.titolo] || []; inizi[o.titolo] = o.inizio; });
    rete.forEach((r) => { (gruppi[r.titolo] = gruppi[r.titolo] || []).push(r); inizi[r.titolo] = r.inizio; });
    const titoli = Object.keys(gruppi).sort((x, y) => (inizi[x] < inizi[y] ? -1 : inizi[x] > inizi[y] ? 1 : 0));
    const pctF = (n) => (Number.isInteger(n) ? n : String(n).replace('.', ',')) + '%';
    const gruppoHtml = (titolo, tutte, k) => {
      const righe = tutte.filter((x) => x.cliente), rett = tutte.filter((x) => x.tipo === 'rettifica');
      const inv = righe.reduce((s, r) => s + r.investitoCliente, 0), gua = tutte.reduce((s, r) => s + (r.importo || 0), 0);
      const lordo = righe.reduce((s, r) => s + r.importo, 0);
      const rettHtml = rett.length ? `<div class="rl-rett">${rett.map((r) => `<div><span>${esc(r.etichetta)}</span><b>${r.importo < 0 ? '−' : '+'}${eur(Math.abs(r.importo))}</b></div>`).join('')}<div class="tot"><span>Guadagno effettivo (${eur(lordo)} calcolato)</span><b class="pos">+${eur(gua)}</b></div></div>` : '';
      const soloTerzi = righe.length > 0 && righe.every((r) => r.tipo === 'terzi');
      const sintesi = soloTerzi ? `Capitale di terzi <b>${eur(inv)}</b> · tuo margine <b class="pos">+${eur(gua)}</b>`
        : righe.length ? `${righe.length} ${righe.length === 1 ? 'cliente' : 'clienti'} · investito <b>${eur(inv)}</b> · tuo guadagno <b class="pos">+${eur(gua)}</b>` : (terzi ? 'Nessuna entrata' : 'Nessun cliente · nessun guadagno');
      const corpo = righe.length ? `<div class="rl-list">${righe.map((r) => `<div class="rl-row"><b class="rl-n">${esc(r.cliente)}</b><dl>
          <div><dt>${r.tipo === 'terzi' ? 'Capitale' : 'Investito'}</dt><dd>${eur(r.investitoCliente)}</dd></div>
          <div><dt>${r.tipo === 'terzi' ? 'Interesse dovuto' : 'Ritorno cliente'}</dt><dd>${pctF(r.clientePct)}${r.tipo === 'terzi' ? ` <small>(${eur(Math.round(r.investitoCliente * r.clientePct) / 100)})</small>` : ''}</dd></div>
          <div><dt>${r.tipo === 'terzi' ? 'Tuo margine' : 'Tuo ritorno'}</dt><dd>${pctF(r.quotaPct)}</dd></div>
          <div><dt>Tuo guadagno</dt><dd class="pos">+${eur(r.importo)}</dd></div></dl></div>`).join('')}</div>${rettHtml}`
        : `<p class="rl-vuoto">Su questo investimento non ci sono clienti portati da te, quindi non c'è nessun guadagno da clienti.</p>`;
      return `<article class="op acc rl" data-reveal>
        <button type="button" class="acc-head" aria-expanded="false" aria-controls="acc-${esc(k)}">
          <div class="op-head"><div><h2>${esc(titolo)}</h2><p class="desc">${sintesi}</p></div></div>
          <span class="apri"><span class="apri-t">Mostra i dettagli</span> <i aria-hidden="true">›</i></span>
        </button>
        <div class="acc-body" id="acc-${esc(k)}" role="region" aria-label="Dettagli di ${esc(titolo)}"><div class="acc-in"><div class="acc-pad">${corpo}</div></div></div>
      </article>`;
    };
    const reteHtml = rete.length ? `<h2 class="sezione-t rete">${princ ? 'Guadagni dai tuoi clienti' : terzi ? 'Altre entrate' : 'Guadagni dalla tua rete'}</h2><p class="sezione-s">${terzi ? 'Capitale di terzi impiegato nelle operazioni. Dal rendimento dell\'operazione si corrisponde l\'interesse concordato: la differenza è il tuo margine, indicato a parte dai tuoi guadagni personali e incluso nel totale previsto.' : princ ? 'Su Caffè Ferrante ai clienti spetta la loro percentuale: a te spetta il resto del ritorno, calcolato sul totale investito. Sono indicati a parte dai tuoi guadagni personali e sono inclusi nel totale previsto.' : 'Quote sugli investimenti dei clienti che hai presentato. Sono indicate a parte dai tuoi guadagni personali e sono incluse nel totale previsto.'}</p>
      <div class="kpis" data-reveal><div><span class="lbl">${terzi ? 'Capitale di terzi' : 'Investito dai tuoi clienti'}</span><b>${eur(me.totaliRete.investitoClienti)}</b></div><div><span class="lbl">${princ ? 'Tuoi guadagni previsti' : terzi ? 'Margine previsto' : 'Quote rete previste'}</span><b class="pos">+${eur(me.totaliRete.importo)}</b></div></div>
      <div class="op-grid">${titoli.map((t, i) => gruppoHtml(t, gruppi[t].filter((x) => x.cliente || x.tipo === 'rettifica'), pre + 'rl' + i)).join('')}</div>` : '';

    // per la lavagna: la catena di reinvestimenti più lunga (a parità, quella che si chiude per ultima)
    const filo = catene.slice().sort((a, b) => b.length - a.length || (b[b.length - 1].fine > a[a.length - 1].fine ? 1 : -1))[0] || [];
    return { kpi, ops, reteHtml, rete, versato, guadagni, affiliati, inMano, n: me.operazioni.length, ord: filo };
  }


const stella = livello => `<span>${esc(({oro:'Decisionale',argento:'Referente di fiducia',bronzo:'Cliente',vuota:'Nuovo profilo'})[livello] || livello || '')}</span>`;

  const seguitiHtml = (me) => (me.clientiSeguiti && me.clientiSeguiti.length) ? `<h2 class="sezione-t rete">I tuoi clienti</h2><p class="sezione-s">Le persone che segui come referente di fiducia.</p>
    <ul class="ref-l seguiti" data-reveal>${me.clientiSeguiti.map((c) => `<li>${stella(c.livello)}<span><b>${esc(c.nome)}</b><small>${c.investimenti ? c.investimenti + (c.investimenti === 1 ? ' investimento' : ' investimenti') : 'Nessun investimento per ora'}</small></span></li>`).join('')}</ul>` : '';
  // tutti gli investimenti (solo decisionali e referenti), con la loro percentuale
  const catalogoHtml = (me) => (me.investimenti && me.investimenti.length) ? `<h2 class="sezione-t rete">Tutti gli investimenti</h2><p class="sezione-s">Le operazioni concluse, in corso e in arrivo, con la tua percentuale dove è già definita.</p>
    <div class="cat-grid">${me.investimenti.map((i) => { const st = i.stato === 'non_iniziata' ? ['In arrivo', 'soon'] : STATO[i.stato]; return `<article class="op cat" data-reveal>
      <div class="op-head"><div><h2>${esc(i.titolo)}</h2><p class="desc">${esc(i.descrizione)}</p></div><span class="pill ${st[1]}"><i></i>${st[0]}</span></div>
      <div class="cat-f"><span>${dataIt(i.inizio, { day: 'numeric', month: 'short', year: 'numeric' })} → ${dataIt(i.fine, { day: 'numeric', month: 'short', year: 'numeric' })}</span>${i.tuaPct != null ? `<span class="cat-pct">La tua percentuale <b>${i.tuaPct}%</b></span>` : ''}</div>
    </article>`; }).join('')}</div>` : '';

  function lavagnaHtml(me, ord) {
    const cat = (me.investimenti || []).filter((i) => i.tuaPct != null);
    const corto = (t) => esc(String(t).replace(/^Import Export /, '').replace(/^Caffè /, 'Caffè '));
    const eurC = eur;
    let graf = '';
    if (ord && ord.length) {
      const pts = [{ v: ord[0].investito }].concat(ord.map((o) => ({ v: o.totaleAllaFine, pct: o.rendimentoPct, t: o.titolo })));
      const W = 640, H = 300, L = 46, R = 70, T = 46, Bm = 58;
      const vs = pts.map((p) => p.v), mn = Math.min(...vs) * 0.82, mx = Math.max(Math.max(...vs) * 1.06, mn + 1);
      const X = (i) => L + i * (W - L - R) / (pts.length - 1), Y = (v) => T + (1 - (v - mn) / (mx - mn)) * (H - T - Bm);
      let d = `M${X(0)},${Y(pts[0].v)}`;
      for (let i = 1; i < pts.length; i++) { const x0 = X(i - 1), x1 = X(i), y0 = Y(pts[i - 1].v), y1 = Y(pts[i].v), m = (x1 - x0) * 0.45; d += ` C${x0 + m},${y0} ${x1 - m},${y1} ${x1},${y1}`; }
      const base = H - Bm + 8;
      graf = `<svg class="lv-g" viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento del tuo capitale">
        <path class="tr" pathLength="1" style="--d:.1s" d="M${L - 8},${base} L${W - 18},${base} M${W - 30},${base - 8} L${W - 18},${base} L${W - 30},${base + 8}"/>
        <path class="tr" pathLength="1" style="--d:.3s" d="M${L - 8},${base} L${L - 8},${T - 26} M${L - 16},${T - 14} L${L - 8},${T - 26} L${L},${T - 14}"/>
        <path class="tr linea" pathLength="1" style="--d:.7s" d="${d}"/>
        ${pts.map((p, i) => `<circle class="sc" style="--d:${0.9 + i * 0.35}s" cx="${X(i)}" cy="${Y(p.v)}" r="5"/><text class="sc v" style="--d:${1 + i * 0.35}s" x="${X(i)}" y="${Y(p.v) - 14}" text-anchor="middle">${eurC(p.v)}</text>`).join('')}
        ${pts.slice(1).map((p, i) => { const xm = (X(i) + X(i + 1)) / 2, ym = (Y(pts[i].v) + Y(p.v)) / 2; return `<text class="sc pc" style="--d:${1.3 + i * 0.4}s" x="${xm + 10}" y="${ym + 46}" text-anchor="middle">+${p.pct}%</text><text class="sc t" style="--d:${1.4 + i * 0.4}s" x="${xm}" y="${base + 30}" text-anchor="middle">${corto(p.t)}</text>`; }).join('')}
      </svg>`;
    } else graf = `<p class="lv-vuoto">Ancora nessuna operazione: qui comparirà il tuo andamento.</p>`;
    const pc = cat.length ? `<div class="lv-pc"><p class="lv-st">Le tue percentuali</p><ul>${cat.map((c, i) => `<li class="sc" style="--d:${1.8 + i * 0.25}s"><span>${corto(c.titolo)}</span><svg viewBox="0 0 60 12" aria-hidden="true"><path class="tr" pathLength="1" style="--d:${1.8 + i * 0.25}s" d="M2,6 L50,6 M44,1 L52,6 L44,11"/></svg><b>${c.tuaPct}%</b></li>`).join('')}</ul></div>` : '';
    return `<div class="lavagna"><p class="lv-t">${me.ruolo === 'master' ? 'Percentuali in corso' : 'Il tuo andamento'}</p>${me.ruolo === 'master' ? '' : graf}${pc}</div>`;
  }

  // Reuse the portal's accounting rules; never sum formatted currency strings.
  const copia = me => JSON.parse(JSON.stringify(me));
  const schedaCliente = (me, pre) => {
    const p = pannello(me, pre);
    return { ...p, html: `${me.referente ? `<p>Referente: ${esc(me.referente)}</p>` : ''}${p.kpi}<h3>I tuoi investimenti</h3><div class="op-grid">${p.ops}</div>
      <section class="andamento"><h3>Andamento previsto</h3>
      <p>Valori previsti alla chiusura della catena di reinvestimenti più lunga; non sono guadagni già incassati. Le operazioni parallele sono dettagliate sopra.</p>
      ${lavagnaHtml(me, p.ord)}</section>${p.reteHtml}${seguitiHtml(me)}${catalogoHtml(me)}` };
  };
  function master(me) {
    const capitale = c => c.operazioni.reduce((s,o)=>s+o.investito,0);
    const clienti = me.clienti.map((c,i) => ({c, p:pannello(c, `master-${i}-`)}))
      .sort((a,b)=>capitale(b.c)-capitale(a.c)||a.c.nome.localeCompare(b.c.nome,'it'));
    const somma = k => clienti.reduce((s,x) => s+x.p[k],0);
    const gruppi = new Map();
    clienti.forEach(({c}) => c.operazioni.forEach(o => {
      const key = [o.titolo,o.inizio,o.fine].join('|');
      if (!gruppi.has(key)) gruppi.set(key,{o,righe:[]});
      gruppi.get(key).righe.push({nome:c.nome,o});
    }));
    const dettaglio = o => `<div class="facts"><div><span class="lbl">Capitale nell'operazione</span><b>${eur(o.investito)}</b></div>
      <div><span class="lbl">Rendimento concordato</span><b>${o.rendimentoPct}%</b></div>
      <div><span class="lbl">Guadagno previsto</span><b class="pos">${eur(o.guadagnoPrevisto)}</b></div>
      <div><span class="lbl">Totale a fine operazione</span><b>${eur(o.totaleAllaFine)}</b></div></div>
      <p>${dataIt(o.inizio)} → ${dataIt(o.fine)} · ${STATO[o.stato][0]}</p>${o.descrizione?`<p>${esc(o.descrizione)}</p>`:''}`;
    const riga = (titolo, sotto, html) => `<details><summary><span class="riepilogo-titolo">${esc(titolo)}</span><span class="riepilogo-dettagli">${sotto}</span><span class="riepilogo-invito">Apri / chiudi dettagli</span></summary>${html}</details>`;
    return `<div class="master-conti"><div class="kpis"><div><span class="lbl">Capitale complessivo delle operazioni</span><b>${eur(clienti.reduce((s,{c})=>s+capitale(c),0))}</b><small>Somma degli importi impiegati in tutte le operazioni, anche successive; non è il saldo attuale.</small></div>
      <div><span class="lbl">Guadagni previsti dei clienti</span><b class="pos">${eur(somma('guadagni'))}</b></div>
      <div><span class="lbl">Totale previsto ai clienti</span><b>${eur(somma('inMano'))}</b></div></div>
      <p>${clienti.length} clienti · ${somma('n')} operazioni</p><h3>Capitale per investimento</h3>
      ${Array.from(gruppi.values()).sort((a,b)=>a.o.inizio.localeCompare(b.o.inizio)).map(({o,righe})=>riga(o.titolo,
        `${eur(righe.reduce((s,r)=>s+r.o.investito,0))} impiegati · ${dataIt(o.inizio)} → ${dataIt(o.fine)}`,
        `<p>Clienti ordinati per capitale nell'operazione, dal più alto al più basso.</p>`+
        righe.sort((a,b)=>b.o.investito-a.o.investito||a.nome.localeCompare(b.nome,'it')).map(r=>riga(r.nome,`${eur(r.o.investito)} nell'operazione`,dettaglio(r.o))).join(''))).join('')}
      <h3>Tutti i clienti · ${clienti.length}</h3>
      ${clienti.map(({c})=>riga(c.nome,`${eur(capitale(c))} complessivi nelle operazioni · ${c.operazioni.length} operazioni`,
        c.operazioni.slice().sort((a,b)=>b.investito-a.investito||a.inizio.localeCompare(b.inizio)).map(o=>riga(o.titolo,`${eur(o.investito)} nell'operazione`,dettaglio(o))).join('')||'<p>Nessuna operazione registrata.</p>')).join('')}${catalogoHtml(me)}</div>`;
  }
  window.VisteFGMA = {
    // Exposed pure renderer also allows regression checks against the original portal.
    pannello, lavagnaHtml,
    investimenti(me) {
      if (!me) return '<p>Accedi per consultare i tuoi investimenti.</p>';
      const m=copia(me);
      return m.ruolo==='master' ? master(m) : schedaCliente(m,'cliente-').html;
    },
    clienti(me) {
      if (!me) return '<p>Accedi per consultare i tuoi clienti.</p>';
      const m=copia(me);
      if(m.ruolo==='master') return master(m);
      const p=pannello(m,'rete-');
      return `${p.reteHtml || '<p>Nessuna quota della rete registrata.</p>'}${seguitiHtml(m)}`;
    }
  };
  document.addEventListener('click', e => {
    const b=e.target.closest('.conti .acc-head');
    if(!b) return;
    const open=b.closest('.acc').classList.toggle('open');
    b.setAttribute('aria-expanded',String(open));
    const t=b.querySelector('.apri-t'); if(t)t.textContent=open?'Nascondi i dettagli':'Mostra i dettagli';
  });
})();

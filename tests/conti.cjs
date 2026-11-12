const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{},document:{addEventListener(){}},Intl,console};
vm.createContext(context);vm.runInContext(fs.readFileSync('viste-clienti.js','utf8'),context);
const views=context.window.VisteFGMA;
const op=(investito,pct,inizio,fine,extra={})=>({titolo:'Operazione',investito,rendimentoPct:pct,inizio,fine,guadagnoPrevisto:Math.round(investito*pct)/100,totaleAllaFine:investito+Math.round(investito*pct)/100,stato:'in_corso',progresso:.5,giorniMancanti:10,...extra});
const person=(ops,rete=[])=>({nome:'Cliente di prova',ruolo:'cliente',operazioni:ops,rete,totaliRete:{importo:rete.reduce((s,r)=>s+r.importo,0),investitoClienti:rete.reduce((s,r)=>s+r.investitoCliente,0)},clientiSeguiti:[],investimenti:[]});
const a=op(1000,10,'2026-01-01','2026-02-01');
const b=op(1250.25,20,'2026-02-01','2026-03-01');
const fixtures=[person([]),person([a]),person([a,b]),person([a,{...b,investito:1000,guadagnoPrevisto:200,totaleAllaFine:1200}]),person([a,{...b,inizio:'2026-01-15'}]),person([{...a,incassa:true},b]),person([a,b],[{cliente:'Rete',titolo:'Operazione',inizio:'2026-01-01',fine:'2026-02-01',importo:50.25,investitoCliente:100,quotaPct:50.25,clientePct:10}]),person([op(0,0,'2026-01-01','2026-02-01')])];
const expected=[[0,0,0],[1000,100,1100],[1150.25,350.05,1500.3],[900,300,1200],[2250.25,350.05,2600.3],[2250.25,350.05,2600.3],[1100,350.05,1500.3],[0,0,0]];
// Independently load original portal renderer, to compare all account details.
let old=fs.readFileSync('portale.html','utf8');
let oldFns=old.slice(old.indexOf('  const STATO ='),old.indexOf('  // novità: quelle non ancora'));
const pre=fs.readFileSync('viste-clienti.js','utf8').split('  const STATO =')[0];
const reference={window:{},document:{},Intl};vm.createContext(reference);vm.runInContext(pre+oldFns+'window.original=pannello;})();',reference);
for(let i=0;i<fixtures.length;i++){
 const m=structuredClone(fixtures[i]), p=views.pannello(m,'test-');
 for(const [k,j] of [['versato',0],['guadagni',1],['inMano',2]])assert(Math.abs(p[k]-expected[i][j])<.000001,`${i} ${k}: ${p[k]}`);
 const orig=reference.window.original(structuredClone(fixtures[i]),'test-');
 for(const k of ['kpi','reteHtml','versato','guadagni','affiliati','inMano','n'])assert.equal(p[k],orig[k],`original parity: ${i} ${k}`);
 const before=JSON.stringify(fixtures[i]);const html=views.investimenti(fixtures[i]);
 assert.equal(JSON.stringify(fixtures[i]),before,'render must not mutate session');
 assert(!/NaN|Infinity/.test(html));assert(html.includes('Andamento previsto'));
}
const master={nome:'Master',ruolo:'master',clienti:[fixtures[2],fixtures[4]],investimenti:[]};
const html=views.investimenti(master);assert(html.includes('Capitale per investimento'));assert(html.includes('4.500,50'));assert(!html.includes('Di cui reinvestito'));assert(!html.includes('Capitale versato netto'));
const fractional=views.clienti(fixtures[6]);assert(fractional.includes('50,25'));assert(!fractional.includes('5.025'));
fs.writeFileSync('/tmp/fgma-fixture.json',JSON.stringify(fixtures[6]));
console.log('PASS: 8 accounting scenarios, original portal parity, master aggregation, cents, immutable session, empty graph');

const reinvestor=person([op(1000,100,'2026-01-01','2026-02-01'),op(2000,10,'2026-02-01','2026-03-01')]);reinvestor.nome='Reinvestitore';
const newcomer=person([op(1500,10,'2026-02-01','2026-03-01')]);newcomer.nome='Nuovo cliente';
const ordered=views.investimenti({ruolo:'master',nome:'Master',clienti:[newcomer,reinvestor],investimenti:[]});
const group=ordered.split('2 febbraio')[0];
const pos=ordered.indexOf('3.500');
assert(pos>=0);const second=ordered.slice(pos);
assert(second.indexOf('Reinvestitore')<second.indexOf('Nuovo cliente'),'reinvested 2000 must precede fresh 1500');
assert(second.includes('2.000'));assert(!ordered.includes('Aggiunta / prelievo'));
console.log('PASS: master sorts by full operation capital including reinvested gains');

assert(ordered.includes('Da dare ai clienti a scadenza: <strong>3.850'),'operation payout must include 3500 capital plus 350 gains');
assert(ordered.includes('Capitale da restituire'));assert(ordered.includes('Guadagni previsti da riconoscere'));
console.log('PASS: operation payout equals capital plus each client gain');

const soloClienti=views.clienti({ruolo:'master',nome:'Master',clienti:[newcomer,reinvestor],investimenti:[]});
assert(soloClienti.includes('Scheda di ogni cliente')&&!soloClienti.includes('Capitale per investimento'),'clients screen lists clients only');
assert(ordered.includes('Capitale per investimento')&&!ordered.includes('Scheda di ogni cliente'),'investments screen groups by operation only');
console.log('PASS: master splits the two room screens');

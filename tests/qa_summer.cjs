// Sommerbilanz: Zählung gegen kontrollierte Wetterdaten prüfen.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
const P=n=>String(n).padStart(2,'0');
// Aktuelles Jahr: ganzer Juni heiß+tropisch+trocken, ab Juli kühl und nass
function curDaily(y){
  const t=[],mx=[],mn=[],pr=[];
  for(let m=6;m<=8;m++)for(let d=1;d<=31;d++){
    if(m===6&&d>30)continue;
    t.push(y+'-'+P(m)+'-'+P(d));
    const hot=(m===6);
    mx.push(hot?32:20); mn.push(hot?21:12); pr.push(hot?0:5);
  }
  return {time:t,temperature_2m_max:mx,temperature_2m_min:mn,precipitation_sum:pr};
}
// Referenzperiode: je Jahr genau 10 heiße Junitage, 0 Tropennächte
function climDaily(){
  const t=[],mx=[],mn=[],pr=[];
  for(let y=1991;y<=2020;y++)for(let m=6;m<=8;m++)for(let d=1;d<=31;d++){
    if(m===6&&d>30)continue;
    t.push(y+'-'+P(m)+'-'+P(d));
    const hot=(m===6&&d<=10);
    mx.push(hot?31:18); mn.push(10); pr.push(3);
  }
  return {time:t,temperature_2m_max:mx,temperature_2m_min:mn,precipitation_sum:pr};
}
let archiveCalls=0;
function sf(u){u=String(u);
  if(u.includes('archive-api')){archiveCalls++;return Promise.resolve({ok:true,json:()=>Promise.resolve({daily:climDaily()})});}
  if(u.includes('open-meteo')&&u.includes('past_days'))return Promise.resolve({ok:true,json:()=>Promise.resolve({daily:curDaily(new Date().getFullYear())})});
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});
  if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('ul_lang','en');w.localStorage.setItem('nh_city','utr');}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,110));
let fails=0;const ok=(n,v,i)=>{console.log((v?'  ✓ ':'  ✗ ')+n+(i?'  ['+i+']':''));if(!v)fails++;};
setTimeout(async()=>{const w=window,d=w.document;
  const mon=new Date().getMonth()+1;
  console.log('— Sommerbilanz — (Testmonat '+mon+')');
  if(mon<6||mon>9){
    // außerhalb der Saison: bewusst keine Bilanz
    await new Promise(r=>{w.briefLoadSummer(x=>{ok('Außerhalb der Saison keine Bilanz',x===null);r();});});
    console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.length);
    process.exit(fails?1:0);
  }
  // Zählung
  const res=await new Promise(r=>w.briefLoadSummer(r));
  ok('Bilanz geliefert',!!res&&!!res.cur);
  ok('30 Hitzetage im Juni gezählt',res.cur.hot===30,res.cur.hot+' Hitzetage');
  ok('30 Tropennächte gezählt',res.cur.trop===30,res.cur.trop+' Nächte');
  ok('Trockenphase ≥ 30 Tage',res.cur.dry>=30,res.cur.dry+' Tage');
  ok('Klimamittel geladen',!!res.norm&&res.norm.years===30,res.norm?res.norm.years+' Jahre':'—');
  ok('Mittel = 10 Hitzetage',Math.abs(res.norm.hot-10)<0.01,res.norm.hot.toFixed(1));
  ok('Archiv genau einmal abgefragt',archiveCalls===1,archiveCalls+'×');
  // Cache: zweiter Aufruf ohne Archiv
  const res2=await new Promise(r=>w.briefLoadSummer(r));
  ok('Zweiter Aufruf nutzt Cache',archiveCalls===1&&!!res2.norm);
  ok('Cache in localStorage',/"hot":10/.test(w.localStorage.getItem('nh_clim_utr')||''));
  // Anzeige
  const h=w.briefSummerHtml(res);
  ok('Text: Hitzetage',/30 hot days/.test(h));
  ok('Text: Tropennächte',/30 tropical nights/.test(h));
  ok('Text: Trockenphase',/longest dry spell/.test(h));
  ok('Vergleich +200 %',/\+200 %/.test(h),h.match(/[+-]\d+ %/)?h.match(/[+-]\d+ %/)[0]:'—');
  ok('Referenzperiode genannt',/1991–2020/.test(h));
  // im Briefing
  w.showBriefing(true);
  await new Promise(r=>setTimeout(r,400));
  const bc=d.getElementById('briefCard');
  ok('Briefing zeigt Sommerzeile',bc&&/This summer/.test(bc.textContent));
  ok('Briefing weiterhin mit Empfehlung',bc&&/Recommended next action/.test(bc.textContent));
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.filter(e=>!/getContext/.test(e)).length,errs.slice(0,2));
  process.exit(fails?1:0);
},3200);

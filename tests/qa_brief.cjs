const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];
function mk(pre){
  const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
  function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
  const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
  return new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);if(pre)pre(w);}});
}
let fails=0;const ok=(n,v)=>{console.log((v?'  ✓ ':'  ✗ ')+n);if(!v)fails++;};
(async()=>{
  // Szenario 1: wiederkehrender Nutzer, Utrecht, EN → Briefing erscheint
  const d1=mk(w=>{w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('nh_city','utr');w.localStorage.setItem('ul_lang','en');
    w.localStorage.setItem('nh_briefms_utr',JSON.stringify({sch:41,str:40,ts:Date.now()}));});
  await new Promise(r=>setTimeout(r,4600));
  const w1=d1.window,c1=w1.document.getElementById('briefCard');
  console.log('— Szenario 1: wiederkehrend (EN, utr, Missions-Cache) —');
  ok('Briefing erscheint automatisch',!!c1);
  const t1=c1?c1.textContent.replace(/\s+/g,' '):'';
  ok('Begrüßung EN',/Good (morning|afternoon|evening)/.test(t1));
  ok('Priorisierungs-Headline (N of M districts)',/of\s+\d+\s*districts need attention/.test(t1));
  ok('Hitze-Zeile',/heat load/.test(t1));
  ok('Missions-Cache-Zeile (41 Schulen/40 Straßen)',/41.*school heat hotspots/.test(t1)&&/40.*high-priority street/.test(t1));
  ok('Empfohlene Aktion mit Fall',/Recommended next action/.test(t1)&&/NICE \d+/.test(t1));
  ok('Kein Deutsch',!/[äöüß]|Stadtteil|Aufmerksamkeit|Missionen(?!s)/.test(t1));
  // Fall öffnen
  w1.briefGo();
  await new Promise(r=>setTimeout(r,700));
  ok('briefGo öffnet Drawer',w1.document.getElementById('drawer').classList.contains('open'));
  ok('Briefing danach zu',!w1.document.getElementById('briefCard'));
  ok('Session-Sperre gesetzt',w1.sessionStorage.getItem('nh_brief_s')==='1');
  w1.showBriefing(false);
  ok('kein erneutes Auto-Zeigen in Session',!w1.document.getElementById('briefCard'));
  w1.showBriefing(true);
  ok('force zeigt wieder',!!w1.document.getElementById('briefCard'));
  w1.closeBriefing();
  // Szenario 2: Erstbesucher → Intro hat Vorrang, kein Briefing
  const d2=mk(w=>{w.localStorage.setItem('nh_city','utr');});
  await new Promise(r=>setTimeout(r,4600));
  const w2=d2.window;
  console.log('— Szenario 2: Erstbesucher —');
  ok('Intro sichtbar',w2.document.getElementById('introOverlay').classList.contains('on'));
  ok('kein Briefing',!w2.document.getElementById('briefCard'));
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.length,errs.slice(0,2));
  process.exit(fails?1:0);
})();

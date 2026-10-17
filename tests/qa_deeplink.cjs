const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];
function mk(url,pre){
  const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
  function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
  const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
  return new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url,virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);if(pre)pre(w);}});
}
let fails=0;const ok=(n,v)=>{console.log((v?'  ✓ ':'  ✗ ')+n);if(!v)fails++;};
(async()=>{
  // 1 · ?district=Overvecht → Drawer direkt, kein Intro/Briefing
  const d1=mk('https://test.local/?district=Overvecht');
  await new Promise(r=>setTimeout(r,5200));
  const w1=d1.window;
  console.log('— ?district=Overvecht —');
  ok('Drawer offen',w1.document.getElementById('drawer').classList.contains('open'));
  ok('Overvecht im Drawer',/Overvecht/.test(w1.document.getElementById('drawer').textContent));
  ok('Intro unterdrückt',!w1.document.getElementById('introOverlay').classList.contains('on'));
  ok('kein Briefing',!w1.document.getElementById('briefCard'));
  // 2 · ?case=UTR-STR-002 → Straßen-Mission, Fall #2
  const d2=mk('https://test.local/?case=UTR-STR-002',w=>{w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('nh_city','utr');});
  await new Promise(r=>setTimeout(r,9000));
  const w2=d2.window;
  console.log('— ?case=UTR-STR-002 —');
  ok('Mission offen',w2.document.getElementById('missionPanel').classList.contains('open'));
  const cb=w2.document.getElementById('msBody').innerHTML;
  ok('Fall #2 offen (Case-ID)',/UTR-STR-002/.test(cb));
  ok('Fall = Streets[1]',w2.eval('MISSION.streets[1]')&&cb.includes(w2.eval('MISSION.streets[1].name')));
  // 3 · Navigation schreibt URL
  const d3=mk('https://test.local/',w=>{w.localStorage.setItem('nh_intro_v1','1');w.sessionStorage.setItem('nh_brief_s','1');});
  await new Promise(r=>setTimeout(r,4200));
  const w3=d3.window;
  console.log('— URL-Mitschrift —');
  w3.eval('openDrawer("Overvecht",CITY_CFG.utr.data["Overvecht"])');
  ok('district in URL',/district=Overvecht/.test(w3.location.search));
  w3.closeDrawer();
  ok('district wieder raus',!/district=/.test(w3.location.search));
  w3.toggleMission();w3.chooseMission('streets');
  await new Promise(r=>setTimeout(r,3000));
  ok('mission in URL',/mission=streets/.test(w3.location.search));
  w3.streetCase(0);
  ok('case in URL',/case=UTR-STR-001/.test(w3.location.search));
  w3.closeMission();
  ok('mission+case raus',!/mission=|case=/.test(w3.location.search));
  // 4 · Reset-Layers + Briefing-Hitzezeile
  w3.eval("activeLayers['heat']=true;activeLayers['flood']=true;updateMapLegend()");
  w3.resetLayers();
  ok('alle Layer aus',w3.eval("Object.values(activeLayers).every(v=>!v)"));
  w3.eval("const hw=document.getElementById('heatWarn');hw.classList.add('on');hw.innerHTML='<span>Heat · Utrecht — 31 °C</span><button>✕</button>'");
  w3.showBriefing(true);
  const bc=w3.document.getElementById('briefCard');
  ok('Briefing zeigt Warnzeile',bc&&/31 °C/.test(bc.textContent));
  ok('heatWarn versteckt (brief-on)',w3.getComputedStyle(w3.document.getElementById('heatWarn')).display==='none');
  w3.closeBriefing();
  ok('heatWarn wieder sichtbar',w3.getComputedStyle(w3.document.getElementById('heatWarn')).display!=='none');
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.length,errs.slice(0,2));
  process.exit(fails?1:0);
})();

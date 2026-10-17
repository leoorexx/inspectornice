const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const vc=new VirtualConsole();
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;
setTimeout(()=>{const w=window,d=w.document;
  console.log('lang =',w.eval('lang'));
  w.eval('openDrawer("Overvecht",CITY_CFG.utr.data["Overvecht"])');
  setTimeout(()=>{
  const DEHIT=/[^.·|»«]{0,45}(?:[äöüÄÖÜß]|Hitzebetroffenheit|Wahlbet|Maßnahmen|Förderung|Übersicht|Szenarien|Fünftel|Nebengeb|Baujahr|Note [A-F]|Schließen|Bericht|Zitat|Soziale Lage|Epoche|Stadtteil|Quelle)[^.·|»«]{0,45}/g;
  const zones=['dGrade','dAlert','dExplain','tp0','tp1','tp2','tp3','tp4','modeBar3d','m3loader','m3legend'];
  zones.forEach(id=>{const el=d.getElementById(id);if(!el){console.log('['+id+'] fehlt');return;}
    const txt=el.textContent.replace(/\s+/g,' ').trim();
    const hits=[...new Set(txt.match(DEHIT)||[])];
    if(hits.length){console.log('\n['+id+'] '+hits.length+':');hits.slice(0,16).forEach(h=>console.log('  >'+h.trim().slice(0,90)));}
  });
  const dr=d.getElementById('drawer');
  const head=dr?dr.textContent.slice(0,600).replace(/\s+/g,' '):'';
  console.log('\n[drawer-Kopf/Tabs]:',(head.match(DEHIT)||[]).slice(0,10).map(s=>'>'+s.trim().slice(0,60)).join('  '));
  const left=d.querySelector('.left');
  console.log('\n[linke Liste]:',[...new Set((left.textContent.replace(/\s+/g,' ').match(DEHIT)||[]))].slice(0,10).map(s=>'>'+s.trim().slice(0,60)).join('  '));
  // Layer-Panel + Legende (waren blinde Flecken: hartkodierte Titel / LGT)
  const lp=d.querySelector('.layer-panel');
  if(lp){const hits=[...new Set((lp.textContent.replace(/\s+/g,' ').match(DEHIT)||[]))];
    console.log('\n[layer-panel] '+hits.length+':',hits.slice(0,10).map(s=>'>'+s.trim().slice(0,60)).join('  '));}
  try{w.eval("activeLayers['heat']=true;activeLayers['flood']=true;activeLayers['noise']=true;updateMapLegend();");
    const lg=d.getElementById('mapLegend');
    const hits=[...new Set((lg.textContent.replace(/\s+/g,' ').match(DEHIT)||[]))];
    console.log('[mapLegend] '+hits.length+':',hits.slice(0,8).map(s=>'>'+s.trim().slice(0,50)).join('  '));
  }catch(e){console.log('[mapLegend] Fehler:',String(e).slice(0,60));}
  process.exit(0);
  },1400);
},3200);

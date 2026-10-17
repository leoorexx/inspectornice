const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('ul_lang','en');w.localStorage.setItem('nh_city','utr');}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,110));
let fails=0;const ok=(n,v)=>{console.log((v?'  ✓ ':'  ✗ ')+n);if(!v)fails++;};
setTimeout(async()=>{const w=window,d=w.document;
  console.log('— Schwarzplan —');
  ok('Plan-Button im Toggle',!!d.querySelector('#baseToggle button[data-bm="plan"]'));
  w.setBasemap('plan');
  ok('Plan aktiv (Button on)',d.querySelector('#baseToggle button[data-bm="plan"]').classList.contains('on'));
  ok('Plan-Basiskarte (PDOK water) aktiv',w.eval('(()=>{let x=false;map.eachLayer(l=>{if(l._url&&l._url.includes("achtergrondkaart/wmts/v2_0/water"))x=true;});return x;})()'));
  ok('PLAN.on',w.eval('PLAN.on')===true);
  // bei Zoom 12: Hinweis statt Gebäude
  await new Promise(r=>setTimeout(r,400));
  ok('Zoom-Hinweis bei niedriger Zoomstufe',!!d.getElementById('planHint'));
  // BAG laden (24 MB) + reinzoomen
  let t=0; while(!w.eval('PLAN.grid')&&t++<80) await new Promise(r=>setTimeout(r,250));
  ok('BAG geladen + Grid indiziert',!!w.eval('PLAN.grid')&&w.eval('PLAN.data.length')>50000);
  // jsdom hat einen 0x0-Container → echte Kartengröße vortäuschen, sonst sind die Grenzen ein Punkt
  w.eval('map.getSize=function(){return L.point(1280,800)};map.setView([52.0907,5.1214],16);');
  w.eval('planRender()');
  await new Promise(r=>setTimeout(r,600));
  const n=w.eval('PLAN.layer?PLAN.layer.getLayers().length:0');
  console.log('   sichtbare Gebäude:',n);
  ok('Gebäude im Viewport gerendert (>200)',n>200);
  ok('Kappung greift nicht (<30000)',n<30000);
  // jedes gezeichnete Gebäude liegt wirklich im Ausschnitt (Rasterzellen sind viel größer)
  const inside=w.eval('(function(){const b=map.getBounds().pad(0.12);let bad=0;PLAN.layer.eachLayer(l=>{const p=l.feature.geometry.coordinates[0][0];if(p[0]<b.getWest()||p[0]>b.getEast()||p[1]<b.getSouth()||p[1]>b.getNorth())bad++;});return bad;})()');
  ok('kein Gebäude außerhalb des Ausschnitts',inside===0,inside+' außerhalb');
  ok('Hinweis wechselt zum Klick-Hinweis',/Click a building/.test((d.getElementById('planHint')||{}).textContent||''));
  // zurück zu Karte
  w.setBasemap('map');
  ok('Zurück zu Karte: Plan-Layer weg',!w.eval('PLAN.layer')&&w.eval('PLAN.on')===false);
  ok('Amtliche Karte (PDOK grijs) wieder aktiv',w.eval('(()=>{let x=false;map.eachLayer(l=>{if(l._url&&l._url.includes("achtergrondkaart/wmts/v2_0/grijs"))x=true;});return x;})()'));
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(fails?1:0);
},3200);

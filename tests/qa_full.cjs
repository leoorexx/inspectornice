const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
let html = fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errors=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load img|Could not parse CSS|fetch/.test(m))errors.push(m.slice(0,140));});
function stubFetch(url){url=String(url);
  if(url.includes('overpass'))return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  if(url.includes('open-meteo'))return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({current:{wind_speed_10m:10,wind_direction_10m:270,wind_gusts_10m:15}})});
  let f=null;
  if(url.includes('/_d/data/layers/'))f='public/data/layers/'+url.split('/_d/data/layers/')[1].split('?')[0];
  else if(url.includes('/_d/data/'))f='public/data/'+url.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctxStub=new Proxy({},{get:(t,p)=>p==='canvas'?{width:1200,height:800,style:{}}:(p==='getImageData'?(()=>({data:new Uint8ClampedArray(4)})):(p==='measureText'?(()=>({width:10})):(()=>{}))),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,
  beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctxStub;w.fetch=(u)=>stubFetch(u);w.URL.createObjectURL=()=>'blob:x';w.scrollTo=()=>{};w.requestAnimationFrame=cb=>setTimeout(cb,0);}});
const {window}=dom;
window.onerror=(m)=>errors.push('onerr:'+String(m).slice(0,140));
window.addEventListener('unhandledrejection',ev=>{const r=ev.reason;errors.push('reject:'+String(r&&r.message||r).slice(0,140));});
let DRAW=0;
function patchL(){const L=window.L;if(!L)return;['circleMarker','marker','circle','polyline','polygon','rectangle','geoJSON'].forEach(fn=>{const o=L[fn];if(typeof o!=='function')return;L[fn]=function(){if(fn==='geoJSON'){const g=arguments[0];DRAW+=g&&g.features?g.features.length:1;}else DRAW++;return o.apply(this,arguments);};});if(L.heatLayer){const h=L.heatLayer;L.heatLayer=function(){DRAW+=(arguments[0]&&arguments[0].length)||1;return h.apply(this,arguments);};}}
const LAYERS=['double_vuln','duh_ampel','traffic_co2','raumklang','flood','heat','noise','bike','parks','schools','health','community','trees','benches','footways_quality','retail','social','sport','parking','osm_trees','osm_benches','osm_transit','osm_lamps'];
setTimeout(async ()=>{
  patchL();
  console.log('INIT:',errors.length?errors.slice(0,5):'sauber');
  window.eval("map.getSize=function(){return L.point(1200,800);}; map.setView([52.0907,5.1214],16); if(typeof loadCityMobility==='function')loadCityMobility('utr'); if(typeof loadCityBundle==='function')loadCityBundle('utr');");
  await new Promise(r=>setTimeout(r,1500));
  const ok=[],bad=[];
  for(const id of LAYERS){
    DRAW=0;const b=errors.length;
    try{window.toggleLayer(id);}catch(e){bad.push(id+'✗'+e.message.slice(0,40));continue;}
    await new Promise(r=>setTimeout(r,300));
    const ne=errors.slice(b).filter(e=>!/getContext/.test(e));
    if(ne.length)bad.push(id+'→'+ne[0].slice(0,55)); else ok.push(id+'('+DRAW+')');
    try{if(window.eval("activeLayers['"+id+"']"))window.toggleLayer(id);}catch(e){}
  }
  console.log('\nOK:',ok.join(' '));
  console.log('\nFEHLER:',bad.length?bad.join(' | '):'keine');
  // gezielt flood/heat
  console.log('\nFlood+Heat haben Objekte:',ok.filter(x=>/^(flood|heat)\(/.test(x)).join(', ')||'NEIN — PRÜFEN');
  process.exit(0);
},4000);

const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch|maplibre/.test(m))errs.push(m.slice(0,130));});
let bagFetched=false;
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});
  if(u.includes('bag_utr.json'))bagFetched=true;
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){
  w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);
  // MapLibre-Stub
  w.maplibregl={Map:function(){return Object.assign(this,{on(){return this},once(ev,cb){if(ev==='load')setTimeout(cb,0);return this},addControl(){return this},resize(){},jumpTo(){},flyTo(){},getCenter:()=>({lat:52.09,lng:5.12}),getZoom:()=>15,getSource:()=>null,addSource(){},addLayer(){},getCanvas:()=>({style:{}})});},NavigationControl:function(){},Popup:function(){return {setLngLat(){return this},setHTML(){return this},addTo(){return this}}}};
}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
window.addEventListener('unhandledrejection',ev=>errs.push('r:'+String(ev.reason&&ev.reason.message||ev.reason).slice(0,120)));
setTimeout(async()=>{
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,4));
  const fns=['enter3D','exit3D','set3DMode','m3load','m3legend'].map(f=>typeof window[f]).join(',');
  console.log('Funktionen (enter3D,exit3D,set3DMode,m3load,m3legend):',fns);
  window.enter3D(); await new Promise(r=>setTimeout(r,300));
  const ov=window.document.getElementById('map3d-overlay'), mb=window.document.getElementById('modeBar3d'), lg=window.document.getElementById('m3legend');
  console.log('Overlay sichtbar:',ov.style.display==='block','| Modus-Leiste aktiv:',mb.classList.contains('active'),'| Legende gefüllt:',lg.innerHTML.length>20,'| bag geladen:',bagFetched,'| M3.active:',window.eval('M3.active'));
  window.set3DMode('heat'); await new Promise(r=>setTimeout(r,100));
  console.log('Modus heat aktiv:',window.eval("M3.mode")==='heat','| Hitze-Button on:',window.document.querySelector('.m3mode[data-m=heat]').classList.contains('on'));
  window.exit3D(); await new Promise(r=>setTimeout(r,100));
  console.log('exit3D → Overlay aus:',ov.style.display==='none','| M3.active:',window.eval('M3.active'));
  console.log('Fehler gesamt:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},3500);

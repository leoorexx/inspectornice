const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch|maplibre/.test(m))errs.push(m.slice(0,130));});
let bagFFM=false;
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});
  if(u.includes('bag_ffm'))bagFFM=true;
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/_d/index.html',virtualConsole:vc,beforeParse(w){
  w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);
  w.__cam={create:null,fly:null};
  w.maplibregl={Map:function(o){w.__cam.create=o&&o.center;return Object.assign(this,{on(){return this},once(ev,cb){if(ev==='load')setTimeout(cb,0);return this},addControl(){return this},resize(){},jumpTo(){},flyTo(o){w.__cam.fly=o&&o.center;},getCenter:()=>({lat:50.11,lng:8.68}),getZoom:()=>15,getSource:()=>null,addSource(){},addLayer(){},getCanvas:()=>({style:{}})});},NavigationControl:function(){},Popup:function(){return {setLngLat(){return this},setHTML(){return this},addTo(){return this}}}};
  try{Object.defineProperty(w,'localStorage',{configurable:true,value:{_d:{'nh_intro_v1':'1'},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}}});}catch(e){}
}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{const w=window;
  console.log('INIT-Fehler:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  // NEUES Verhalten (User-Feedback): Stadtwechsel nach FFM startet KEIN Auto-3D mehr
  w.switchCity('ffm');
  await new Promise(r=>setTimeout(r,1800));
  const auto3d=w.eval('M3.active');
  console.log('nach switchCity(ffm): 3D auto gestartet:',auto3d,'(erwartet false — Erstnutzer fanden es irritierend)');
  // Manuelle Skyline-Funktion existiert weiter (für 3D-Button/Showcase)
  const hasFn=typeof w.showcaseSkyline==='function' && !!w.eval('CITY_CFG.ffm.skyline');
  console.log('showcaseSkyline manuell verfügbar + Konfig:',hasFn);
  w.showcaseSkyline();
  await new Promise(r=>setTimeout(r,900));
  const c=w.eval('window.__cam').create||w.eval('window.__cam').fly;
  const okCam=Array.isArray(c)&&Math.abs(c[0]-8.6705)<0.02&&Math.abs(c[1]-50.1118)<0.02;
  console.log('manuell → 3D aktiv:',w.eval('M3.active'),'| Kamera auf Skyline:',okCam);
  console.log('\nCHECKS: kein Auto-3D:',auto3d===false,'| manuelle Skyline ok:',okCam,'| Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},3500);

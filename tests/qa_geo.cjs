const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
let photonCalls=0,nomCalls=0,photonEmpty=false;
function sf(u){u=String(u);
  if(u.includes('photon.komoot')){photonCalls++; if(photonEmpty)return Promise.resolve({ok:true,json:()=>Promise.resolve({features:[]})}); return Promise.resolve({ok:true,json:()=>Promise.resolve({features:[
    {properties:{name:'Amsterdam',osm_key:'place',osm_value:'city',type:'city',state:'Noord-Holland',country:'Nederland'},geometry:{coordinates:[4.8936,52.3728]}},
    {properties:{name:'Amstelveen',osm_key:'place',osm_value:'town',state:'Noord-Holland'},geometry:{coordinates:[4.86,52.30]}},
    {properties:{name:'SomeStreet',osm_key:'highway',osm_value:'residential'},geometry:{coordinates:[4.9,52.3]}}]})});}
  if(u.includes('nominatim')){nomCalls++;return Promise.resolve({ok:true,json:()=>Promise.resolve([{display_name:'Berlin, Deutschland',lat:'52.52',lon:'13.4',type:'city'}])});}
  if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);w.AbortController=class{constructor(){this.signal={};}abort(){}};}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{const w=window,d=w.document;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  // Photon primär, Straße gefiltert
  w.geocodeCity('amster'); await new Promise(r=>setTimeout(r,250));
  let drop=d.getElementById('citySearchDrop').innerHTML;
  console.log('Photon: Amsterdam+Amstelveen da:',/Amsterdam/.test(drop)&&/Amstelveen/.test(drop),'| Straße gefiltert:',!/SomeStreet/.test(drop),'| photonCalls:',photonCalls,'nomCalls:',nomCalls);
  // Cache: zweiter Aufruf ohne neuen fetch
  const pc=photonCalls; w.geocodeCity('amster'); await new Promise(r=>setTimeout(r,100));
  console.log('Cache greift (kein neuer Photon-Call):',photonCalls===pc);
  // Fallback: Photon leer → Nominatim
  photonEmpty=true; const nc=nomCalls; w.geocodeCity('berlin'); await new Promise(r=>setTimeout(r,250));
  drop=d.getElementById('citySearchDrop').innerHTML;
  console.log('Fallback zu Nominatim (Berlin):',/Berlin/.test(drop)&&nomCalls>nc);
  // Loading-Zustand
  w.renderCsDrop('xyz',null,true);
  console.log('Loading-Zustand:',/suchen|Searching|zoeken/.test(d.getElementById('citySearchDrop').innerHTML));
  // Utrecht/Frankfurt immer als volle Vorschläge
  w.renderCsDrop('',null,false);
  console.log('Utrecht+Frankfurt Vorschläge:',/Utrecht/.test(d.getElementById('citySearchDrop').innerHTML)&&/Frankfurt/.test(d.getElementById('citySearchDrop').innerHTML));
  console.log('Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},1400);

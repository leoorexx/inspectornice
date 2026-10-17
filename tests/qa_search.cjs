const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
function sf(u){u=String(u);
  if(u.includes('nominatim'))return Promise.resolve({ok:true,json:()=>Promise.resolve([{display_name:'Amsterdam, Noord-Holland, Nederland',lat:'52.3728',lon:'4.8936',type:'city'},{display_name:'Berlin, Deutschland',lat:'52.52',lon:'13.40',type:'city'}])});
  if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);let s={};w.localStorage={getItem:k=>s[k]??null,setItem:(k,v)=>s[k]=''+v,removeItem:k=>delete s[k]};}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{const w=window,d=w.document;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  w.eval("map.getSize=function(){return L.point(1200,800);};map.setView([52.09,5.12],13);");
  console.log('Funktionen:',['citySearchInput','pickFull','pickFree','exitFree','renderCsDrop'].map(f=>typeof w[f]).join(','));
  // Dropdown ohne Query → Utrecht+Frankfurt
  w.renderCsDrop('',null);
  const drop=d.getElementById('citySearchDrop').innerHTML;
  console.log('Vorschläge Utrecht+Frankfurt:',/Utrecht/.test(drop)&&/Frankfurt/.test(drop),'| Voll-Badge:',/csbadge full/.test(drop));
  // Geocode (stub) → Amsterdam als OSM
  w.geocodeCity('amster'); await new Promise(r=>setTimeout(r,200));
  console.log('Geocode → Amsterdam(OSM):',/Amsterdam/.test(d.getElementById('citySearchDrop').innerHTML)&&/csbadge osm/.test(d.getElementById('citySearchDrop').innerHTML));
  // pickFree → OSM-Modus
  const b=errs.length; try{w.pickFree(52.3728,4.8936,'Amsterdam, Nederland');}catch(e){console.log('pickFree WARF:',e.message.slice(0,60));}
  await new Promise(r=>setTimeout(r,200));
  console.log('FREE gesetzt:',!!w.eval('FREE'),'| body.free-mode:',d.body.classList.contains('free-mode'),'| Banner an:',d.getElementById('freeBanner').classList.contains('on'));
  // Gate: kuratierter Layer blockiert, OSM erlaubt
  const st={textContent:''}; w.loadLayer('heat',st); console.log('  heat (kuratiert) → gesperrt:',/nur Utrecht|Utrecht\/FFM/.test(st.textContent));
  const b2=errs.length; w.loadLayer('osm_trees',{textContent:''}); await new Promise(r=>setTimeout(r,150));
  console.log('  osm_trees → kein Fehler/erlaubt:',errs.slice(b2).filter(e=>!/getContext/.test(e)).length===0);
  // Zurück zu Utrecht
  w.pickFull('utr'); await new Promise(r=>setTimeout(r,300));
  console.log('exitFree → FREE null:',!w.eval('FREE'),'| free-mode weg:',!d.body.classList.contains('free-mode'));
  console.log('Fehler gesamt:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},4000);

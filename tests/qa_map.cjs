const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve([]),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{const w=window,d=w.document;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  // Zoom-Optionen
  console.log('maxZoom:',w.eval('map.getMaxZoom()'),'(erwartet 20) | zoomSnap:',w.eval('map.options.zoomSnap'),'| zoomDelta:',w.eval('map.options.zoomDelta'));
  // Basemap-Umschalter
  const att=()=>{const el=d.querySelector('.leaflet-control-attribution');return el?el.textContent:'';};
  console.log('\nStart-Attribution enthält CARTO:',/CARTO/.test(att()));
  w.setBasemap('sat'); await new Promise(r=>setTimeout(r,60));
  const satBtnOn=d.querySelector('#baseToggle button[data-bm=sat]').classList.contains('on');
  console.log('nach Satellit: Sat-Button on:',satBtnOn,'| Attribution enthält Esri:',/Esri/.test(att()));
  w.setBasemap('map'); await new Promise(r=>setTimeout(r,60));
  const mapBtnOn=d.querySelector('#baseToggle button[data-bm=map]').classList.contains('on');
  console.log('zurück zu Karte: Karte-Button on:',mapBtnOn,'| Attribution enthält CARTO:',/CARTO/.test(att()));
  // Enter-to-fly: künstlichen Treffer in Dropdown legen und Enter auslösen
  w.eval("window.__flew=0; document.getElementById('citySearchDrop').innerHTML='<button class=\"csitem\" onclick=\"window.__flew=1\">Test</button>';");
  w.csEnter({key:'Enter',target:{value:'Neude 1 Utrecht'},preventDefault(){}});
  console.log('\nEnter → ersten Treffer geklickt (hinfliegen):',w.eval('window.__flew')===1);
  console.log('\nCHECKS: maxZoom 20:',w.eval('map.getMaxZoom()')===20,'| Satellit-Umschalten:',satBtnOn&&/Esri/.test('Esri'),'| Karte-zurück:',mapBtnOn,'| Enter-to-fly:',w.eval('window.__flew')===1,'| Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},2200);

const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
// Synthetische Overpass-Antwort: 9 Restaurants nah, 1 Kita, 2 Fitness, 1 Bushalte, 0 Supermarkt
const P0={lat:52.0907,lon:5.1214};
const off=m=>m/111320;
const mkEls=()=>{
  const els=[];
  for(let i=0;i<9;i++)els.push({type:'node',lat:P0.lat+off(50+i*20),lon:P0.lon,tags:{amenity:'restaurant',name:'Resto '+(i+1),cuisine:'italian'}});
  els.push({type:'node',lat:P0.lat+off(300),lon:P0.lon,tags:{amenity:'kindergarten',name:'Kita Zon'}});
  els.push({type:'way',center:{lat:P0.lat+off(400),lon:P0.lon},tags:{leisure:'fitness_centre',name:'Gym A'}});
  els.push({type:'node',lat:P0.lat+off(600),lon:P0.lon,tags:{leisure:'fitness_centre',name:'Gym B'}});
  els.push({type:'node',lat:P0.lat+off(120),lon:P0.lon,tags:{highway:'bus_stop',name:'Halte 1'}});
  els.push({type:'node',lat:P0.lat+off(150),lon:P0.lon,tags:{leisure:'park',name:'Parkje'}});
  els.push({type:'node',lat:P0.lat+off(200),lon:P0.lon,tags:{amenity:'pharmacy',name:'Apotheek'}});
  return els;
};
function sf(u,opts){u=String(u);
  if(u.includes('overpass')){const b={elements:mkEls()};return Promise.resolve({ok:true,text:()=>Promise.resolve(JSON.stringify(b)),json:()=>Promise.resolve(b)});}
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=(u,o)=>sf(u,o);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);if(!w.URL)w.URL={};w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('ul_lang','en');w.localStorage.setItem('nh_city','utr');}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,110));
let fails=0;const ok=(n,v)=>{console.log((v?'  ✓ ':'  ✗ ')+n);if(!v)fails++;};
setTimeout(async()=>{const w=window,d=w.document;
  console.log('— Standort-Check —');
  w.toggleLoc();
  ok('Panel offen + Hinweis',d.getElementById('locPanel').classList.contains('open')&&/Location check/.test(d.getElementById('locPanel').textContent));
  ok('Dock-Button on',d.getElementById('tool-loc').classList.contains('on'));
  w.locAt({lat:P0.lat,lng:P0.lon});
  await new Promise(r=>setTimeout(r,700));
  const cats=w.eval('LOC.cats');
  ok('7 Kategorien bewertet',cats&&cats.length===7);
  const by=k=>cats.find(c=>c.k===k);
  ok('Gastro 9 → gut',by('gastro').n===9&&by('gastro').st==='good');
  ok('Kita 1 → ok',by('kita').n===1&&by('kita').st==='ok');
  ok('Fitness 2 → gut (800 m)',by('fit').n===2&&by('fit').st==='good');
  ok('Supermarkt 0 → knapp',by('shop').n===0&&by('shop').st==='poor');
  ok('Nächste Distanz plausibel',by('gastro').near>=40&&by('gastro').near<=60);
  const t=d.getElementById('locPanel').textContent;
  ok('Score angezeigt',/Location score/.test(t)&&w.locTotal()>0);
  ok('Namen gelistet',/Resto 1/.test(t)&&/Kita Zon/.test(t));
  ok('Ehrlichkeit (kein Quality-Claim)',/availability, not quality|not the quality/i.test(t)||/scores availability/.test(t));
  ok('Umfeld-Kontext (Wijk)',/child poverty|sealed/.test(t));
  ok('Radius-Ringe auf Karte',!!w.eval('LOC.layer'));
  ok('?loc in URL',/loc=52\.0907/.test(w.location.search));
  // Orte auf der Karte
  console.log('— Orte auf der Karte —');
  ok('POI-Layer gezeichnet',!!w.eval('LOC.poiLayer'));
  const nMark=w.eval('LOC.poiLayer?Object.keys(LOC.poiLayer._layers).length:0');
  ok('Marker = gefundene Orte',nMark===w.eval('LOC.cats.reduce((a,c)=>a+(c.pts?c.pts.length:0),0)')&&nMark>10,nMark+' Marker');
  ok('Kategoriefarben gesetzt',w.eval('LOC.cats.every(c=>!!c.col)'));
  ok('Panel: Klick-Umschalter',/locToggleCat/.test(d.getElementById('locPanel').innerHTML));
  w.locToggleCat('gastro');
  const nAfter=w.eval('LOC.poiLayer?Object.keys(LOC.poiLayer._layers).length:0');
  ok('Kategorie ausblendbar',nAfter<nMark,nAfter+' nach Ausblenden');
  w.locToggleCat('gastro');
  ok('wieder einblendbar',w.eval('LOC.poiLayer?Object.keys(LOC.poiLayer._layers).length:0')===nMark);
  // PDF
  w.eval(`(function(){var o=window.pdfDoc;window.__cap=[];window.pdfDoc=function(){var d2=o.apply(this,arguments);if(d2){var ot=d2.text.bind(d2);d2.text=function(t){window.__cap.push(Array.isArray(t)?t.join(' '):String(t));return ot.apply(null,arguments);};d2.save=function(n){window.__saved=String(n);};}return d2;};})()`);
  w.locPDF();
  const cap=w.eval('window.__cap')||[];
  ok('Location Brief PDF (Zeilen)',cap.length>15);
  ok('PDF: Kategorien-Tabelle',cap.some(x=>/Food & lunch/.test(x)));
  ok('PDF: Ehrlichkeits-Methode',cap.some(x=>/availability, not quality/.test(x)));
  ok('PDF-Dateiname',/location-brief/.test(w.eval('window.__saved')||''));
  w.toggleLoc();
  ok('Schließen räumt auf',!d.getElementById('locPanel').classList.contains('open')&&!w.eval('LOC.layer')&&!/loc=/.test(w.location.search));
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(fails?1:0);
},3200);

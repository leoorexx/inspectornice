const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const vc=new VirtualConsole();let lastPhoton='',lastNom='';
function sf(u){u=String(u);
  if(u.includes('photon.komoot.io')){lastPhoton=u;return Promise.resolve({ok:true,json:()=>Promise.resolve({features:[]})});}
  if(u.includes('nominatim')){lastNom=u;return Promise.resolve({ok:true,json:()=>Promise.resolve([])});}
  if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve([]),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;
setTimeout(async()=>{const w=window;
  console.log('Stadt:',w.eval('city'));
  console.log('geoBiasViewbox (utr):',w.geoBiasViewbox());
  console.log('geoBiasCenter (utr):',JSON.stringify(w.geoBiasCenter()));
  await w.photonGeocode('Neude'); await w.nominatimGeocode('Neude');
  const utrPhoton=/lat=52\.09/.test(lastPhoton)&&/lon=5\.12/.test(lastPhoton);
  const utrNom=/viewbox=5\.05,52\.04,5\.20,52\.14/.test(lastNom)&&/bounded=0/.test(lastNom);
  console.log('\nUtrecht → Photon lat/lon-Bias:',utrPhoton,'| Nominatim viewbox:',utrNom);
  // Frankfurt
  w.switchCity('ffm'); await new Promise(r=>setTimeout(r,1400));
  await w.photonGeocode('Zeil'); await w.nominatimGeocode('Zeil');
  const ffmPhoton=/lat=50\.11/.test(lastPhoton)&&/lon=8\.68/.test(lastPhoton);
  const ffmNom=/viewbox=8\.55,50\.05,8\.82,50\.22/.test(lastNom);
  console.log('Frankfurt → Photon-Bias:',ffmPhoton,'| Nominatim viewbox:',ffmNom);
  // FREE-Modus (außerhalb): Bias auf gesuchten Ort, keine viewbox
  w.eval("FREE={name:'Berlin',lat:52.52,lon:13.40};");
  await w.photonGeocode('Str'); await w.nominatimGeocode('Str');
  const freePhoton=/lat=52\.52/.test(lastPhoton)&&/lon=13\.4/.test(lastPhoton);
  const freeNom=!/viewbox/.test(lastNom);
  console.log('FREE(Berlin) → Photon-Bias auf Ort:',freePhoton,'| keine viewbox:',freeNom);
  console.log('\nCHECKS: Utrecht-Bias:',utrPhoton&&utrNom,'| Frankfurt-Bias:',ffmPhoton&&ffmNom,'| FREE-Bias:',freePhoton&&freeNom);
  process.exit(0);
},2200);

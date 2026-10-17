const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{const w=window;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  console.log('Stadt:',w.eval('city'),'| geoFeatures (Stadtteile):',w.eval('geoFeatures.length'));
  const field=await w.loadHeatField();
  console.log('LST-Feld:',!!field);
  // Zentraler Utrecht-Punkt
  const la=52.089, lo=5.115;
  const d=w.pawDistrictAt(la,lo);
  console.log('pawDistrictAt(zentr.) → Versiegelung:',d?d.versieg+'%':'kein Stadtteil','| ΔLST:',d?d.lst_delta:'-');
  const sc=(t,a)=>w.pawScore({landuse:t},la,lo,a,field);
  const forest=sc('forest',60000), park=sc('park',20000), grass=sc('grass',400), flower=sc('flowerbed',200);
  console.log('\nPAW-Score (gleicher Ort, versch. Vegetation):');
  console.log('  Wald(groß):',forest,'| Park:',park,'| Rasen(klein):',grass,'| Beet(winzig):',flower);
  console.log('  Farben:',w.pawColor(forest),w.pawColor(park),w.pawColor(grass),w.pawColor(flower));
  // Sensitivität: gleiche Vegetation an versiegeltem-heißem vs. grünem-kühlem Ort
  const ds=w.eval('Object.entries(CITY_CFG.utr.data)');
  const varied = forest>park && park>grass && grass>=flower;
  // Layer togglen und rendern
  w.eval("document.getElementById('map')&&(map.getSize=()=>L.point(1200,800));");
  try{ map=w.map; }catch(e){}
  w.toggleLayer('paw');
  await new Promise(r=>setTimeout(r,900));
  const lyr=w.eval('layerObjs.paw');
  let n=0; try{ n=Object.keys(lyr._layers||{}).length; }catch(e){}
  console.log('\nLayer gerendert:',!!lyr,'| Sub-Layer (Flächen):',n);
  console.log('Legende paw vorhanden:',w.eval("!!LAYER_LEGEND.paw"));
  console.log('\nCHECKS: Modell reagiert auf Typ (Wald>Park>Rasen>Beet):',varied,'| Score-Spanne sinnvoll('+forest+'>'+flower+'):',forest-flower>=20,'| Layer rendert (>100 Flächen):',n>100,'| Versiegelung gesampelt:',!!(d&&d.versieg!=null),'| Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},2600);

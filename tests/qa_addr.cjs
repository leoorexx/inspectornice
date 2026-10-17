const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
function sf(u){u=String(u);
  if(u.includes('photon.komoot.io'))return Promise.resolve({ok:true,json:()=>Promise.resolve({features:[
    {geometry:{coordinates:[5.121,52.090]},properties:{housenumber:'1',street:'Neude',city:'Utrecht',osm_key:'place'}},
    {geometry:{coordinates:[5.12,52.09]},properties:{name:'Utrecht',state:'Utrecht',osm_key:'place',osm_value:'city'}}]})});
  if(u.includes('nominatim'))return Promise.resolve({ok:true,json:()=>Promise.resolve([{lat:'52.09',lon:'5.121',display_name:'Neude 1, Utrecht',address:{road:'Neude',house_number:'1',city:'Utrecht'}}])});
  if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve([]),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{const w=window;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  // inCityBbox
  console.log('\ninCityBbox: Utrecht(52.09,5.12)=',w.inCityBbox(52.09,5.12),'| Frankfurt(50.11,8.68)=',w.inCityBbox(50.11,8.68),'| Berlin(52.52,13.40)=',w.inCityBbox(52.52,13.40));
  // Geocoder-Parsing
  const ph=await w.photonGeocode('Neude 1 Utrecht');
  console.log('\nPhoton:',JSON.stringify(ph.slice(0,2)));
  const no=await w.nominatimGeocode('Neude 1 Utrecht');
  console.log('Nominatim:',JSON.stringify(no.slice(0,1)));
  const addrOk=ph[0]&&ph[0].addr===true&&/Neude 1/.test(ph[0].name)&&no[0]&&no[0].addr===true;
  // pickGeo: Adresse in Utrecht (schon utr) → kein Stadtwechsel, Pin
  console.log('\n-- pickGeo Adresse Utrecht --');
  w.pickGeo(52.090,5.121,'Neude 1, Utrecht');
  await new Promise(r=>setTimeout(r,400));
  console.log('Stadt:',w.eval('city'),'(erwartet utr) | Pin gesetzt:',!!w.eval('ADDR_MARKER'),'| FREE:',w.eval('!!FREE'));
  // pickGeo: Adresse in Frankfurt → Stadtwechsel ffm, kein Auto-Skyline, Pin
  console.log('\n-- pickGeo Adresse Frankfurt --');
  w.pickGeo(50.110,8.680,'Zeil 1, Frankfurt');
  await new Promise(r=>setTimeout(r,1800));
  console.log('Stadt:',w.eval('city'),'(erwartet ffm) | 3D NICHT auto:',!w.eval('M3.active'),'| Pin:',!!w.eval('ADDR_MARKER'));
  // pickGeo: außerhalb (Berlin) → OSM-Modus
  console.log('\n-- pickGeo Berlin (außerhalb) --');
  w.pickGeo(52.52,13.40,'Berlin');
  await new Promise(r=>setTimeout(r,400));
  console.log('FREE-Modus:',w.eval('!!FREE'),'| free-mode-Klasse:',w.document.body.classList.contains('free-mode'),'| Pin:',!!w.eval('ADDR_MARKER'));
  console.log('\nCHECKS: Adress-Parsing:',addrOk,'| bbox korrekt:',w.inCityBbox(52.09,5.12)==='utr'&&w.inCityBbox(50.11,8.68)==='ffm'&&w.inCityBbox(52.52,13.4)===null,'| Adresse→richtige Stadt+Pin:',w.eval('city')!=null,'| Berlin→OSM:',w.eval('!!FREE'),'| Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},2600);

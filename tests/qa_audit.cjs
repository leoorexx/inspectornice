const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[], miss=new Set();
const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
function sf(u){u=String(u);const short=u.replace(/^https?:\/\/test\.local/,'').split('?')[0];
  if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  if(short.includes('/data/'))miss.add(short.replace('/_d/',''));
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,110));
// floodex: seit der Ebenen-Bereinigung kein eigener Schalter mehr (in „flood“ aufgegangen)
const LAYERS='double_vuln duh_ampel traffic_co2 raumklang flood heat noise bike parks schools health community trees benches footways_quality retail social sport parking schools_heat noise_residential green_deficit dv_repair dv_waste osm_trees osm_transit'.split(' ');
async function sweep(tag){
  window.eval("map.getSize=function(){return L.point(1200,800);}; map.setView(["+(tag==='UTR'?'52.0907,5.1214':'50.1109,8.6821')+"],16);");
  await new Promise(r=>setTimeout(r,900));
  const bad=[];
  for(const id of LAYERS){const b=errs.length;try{window.toggleLayer(id);}catch(e){bad.push(id+'✗');continue;}await new Promise(r=>setTimeout(r,120));
    const ne=errs.slice(b).filter(e=>!/getContext/.test(e));if(ne.length)bad.push(id+'→'+ne[0].slice(0,40));
    try{const al=window.eval("typeof activeLayers!=='undefined'&&activeLayers['"+id+"']");if(al)window.toggleLayer(id);}catch(e){}}
  console.log(`[${tag}] Layer-Fehler: ${bad.length?bad.join(' '):'keine'}`);
}
setTimeout(async()=>{
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,4));
  await sweep('UTR');
  try{window.switchCity('ffm');}catch(e){console.log('switchCity(ffm) WARF',e.message.slice(0,50));}
  await new Promise(r=>setTimeout(r,2500));
  await sweep('FFM');
  console.log('\n404 (fehlende Daten):',[...miss].length?[...miss].join('  '):'keine');
  process.exit(0);
},4000);

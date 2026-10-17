const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
let html = fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errors=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load img|Could not parse CSS|fetch/.test(m))errors.push(m.slice(0,140));});
function stubFetch(url){url=String(url);
  if(url.includes('overpass'))return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  if(url.includes('open-meteo'))return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({current:{wind_speed_10m:10,wind_direction_10m:270,wind_gusts_10m:15}})});
  let f=null;
  if(url.includes('/_d/data/layers/'))f='public/data/layers/'+url.split('/_d/data/layers/')[1].split('?')[0];
  else if(url.includes('/_d/data/'))f='public/data/'+url.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctxStub=new Proxy({},{get:(t,p)=>p==='canvas'?{width:1200,height:800,style:{}}:(p==='getImageData'?(()=>({data:new Uint8ClampedArray(4)})):(p==='measureText'?(()=>({width:10})):(()=>{}))),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,
  beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctxStub;w.fetch=(u)=>stubFetch(u);w.URL.createObjectURL=()=>'blob:x';w.scrollTo=()=>{};w.requestAnimationFrame=cb=>setTimeout(cb,0);
    w.localStorage=(()=>{let s={};return{getItem:k=>s[k]??null,setItem:(k,v)=>s[k]=''+v,removeItem:k=>delete s[k]};})();}});
const {window}=dom;
window.onerror=(m)=>errors.push('onerr:'+String(m).slice(0,140));
window.addEventListener('unhandledrejection',ev=>{errors.push('reject:'+String(ev.reason&&ev.reason.message||ev.reason).slice(0,140));});
setTimeout(async ()=>{
  console.log('INIT:',errors.length?errors.slice(0,5):'sauber');
  window.eval("map.getSize=function(){return L.point(1200,800);}; map.setView([52.0907,5.1214],16);");
  await new Promise(r=>setTimeout(r,800));
  const check=async(name,fn)=>{const b=errors.length;try{fn();await new Promise(r=>setTimeout(r,200));const ne=errors.slice(b).filter(e=>!/getContext/.test(e));console.log('  '+name+':',ne.length?'FEHLER '+ne[0].slice(0,70):'OK');}catch(e){console.log('  '+name+': WARF '+e.message.slice(0,60));}};
  console.log('\n=== Merge: Analyse-Werkzeug ===');
  await check('toggleAnalyse AN',()=>window.toggleAnalyse());
  console.log('   STREET.active=',window.eval('STREET.active'),'INSPECT.active=',window.eval('INSPECT.active'),'(beide true erwartet)');
  await check('inspectAt (Punkt)',()=>window.eval("inspectAt({lat:52.091,lng:5.121})"));
  await check('toggleAnalyse AUS',()=>window.toggleAnalyse());
  console.log('   STREET.active=',window.eval('STREET.active'),'INSPECT.active=',window.eval('INSPECT.active'),'(beide false erwartet)');
  console.log('\n=== Mitwirken (Supabase an, localStorage als Fallback) ===');
  await check('supaOn() true',()=>{if(!window.eval('supaOn()'))throw new Error('supaOn sollte true sein (Keys eingetragen)');});
  await check('supaHdr apikey+Bearer',()=>{const h=JSON.parse(window.eval('JSON.stringify(supaHdr())'));if(!h.apikey||h.Authorization!=='Bearer '+window.eval('SUPABASE_KEY'))throw new Error('Header falsch');});
  await check('toggleMitwirkung AN',()=>window.toggleMitwirkung());
  await check('addReport',()=>window.eval("addReport(52.091,5.121,'barrier')"));
  console.log('   Reports gespeichert:',window.eval("getReports().length"));
  await check('voteMeasure',()=>window.eval("voteMeasure('A01')"));
  console.log('   Votes:',window.eval("JSON.stringify(getVotes())"));
  console.log('\nGesamt-Fehler:',errors.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},4000);

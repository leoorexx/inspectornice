const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('public/dashboard.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,140));});
function sf(u){u=String(u);let f=null;
  if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  else if(u.includes('data/cities.json'))f='public/data/cities.json';
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/_d/dashboard.html',virtualConsole:vc,
  beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
window.addEventListener('unhandledrejection',ev=>errs.push('r:'+String(ev.reason&&ev.reason.message||ev.reason).slice(0,120)));
setTimeout(()=>{
  const cg=window.document.getElementById('cityGrid');
  const html2=cg?cg.innerHTML:'';
  console.log('INIT-Fehler:',errs.filter(e=>!/getContext/.test(e)).slice(0,4));
  console.log('cityGrid gefüllt:', html2.length>50);
  console.log('Säulen-Klassen in Balken:', /p-clim/.test(html2), /p-eco/.test(html2), /p-soc/.test(html2));
  console.log('Fraunces-Vars vorhanden:', window.eval("getComputedStyle(document.documentElement).getPropertyValue('--font-serif')").trim()||'(leer)');
  process.exit(0);
},2500);

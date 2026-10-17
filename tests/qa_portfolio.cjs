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
setTimeout(()=>{const w=window,d=w.document;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  const A=d.getElementById('pfA').innerHTML,B=d.getElementById('pfB').innerHTML,C=d.getElementById('pfC').innerHTML;
  const rows=s=>(s.match(/prio-row/g)||[]).length;
  console.log('Portfolios gefüllt: A',rows(A),'| B',rows(B),'| C',rows(C));
  console.log('KPI-Chips: Projekte:',/Projekte|projects/.test(A),'| Einwohner:',/Einwohner|residents/.test(A),'| vulnerable:',/vulnerable|kwetsbare/.test(A),'| Förderquote:',/Förderquote|funding/.test(A));
  // Zielkonflikt sichtbar: A ≠ B (unterschiedliche Projekt-Zusammensetzung)
  const names=s=>(s.match(/<b>[^<]+<\/b>/g)||[]).join('|');
  console.log('A ≠ B (Zielkonflikt sichtbar):',names(A)!==names(B),'| B ≠ C:',names(B)!==names(C));
  // Budget-Reaktion: 10 → 40 Mio ⇒ mehr Projekte
  const beforeN=rows(A);
  d.getElementById('pfBudget').value='40'; w.renderPortfolios();
  const afterHTML=d.getElementById('pfA').innerHTML;
  const more=/\+\d+ (weitere|more|meer)/.test(afterHTML)||rows(afterHTML)>beforeN;
  console.log('Budget 40 Mio → mehr Projekte:',more,'| Anzeige:',d.getElementById('pfVal').textContent);
  // Stadtwechsel-Robustheit
  try{w.setCity('ffm');}catch(e){}
  setTimeout(()=>{
    const A2=d.getElementById('pfA').innerHTML;
    console.log('nach setCity(ffm) gefüllt:',rows(A2)>0);
    console.log('\nCHECKS: alle 3 gefüllt:',rows(A)>3&&rows(B)>3&&rows(C)>3,'| Konflikt sichtbar:',names(A)!==names(B),'| Budget reagiert:',more,'| Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
    process.exit(0);
  },1200);
},2500);

// Einstieg von der klassischen Startseite in die neue Ansicht + Schriften (klassisch: aufrechte Fraunces, neu: Syne + DM Sans)
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const OFF=f=>JSON.parse(fs.readFileSync('public/data/official/'+f,'utf8'));
const CBS=OFF('cbs_utr.json'),TREES=OFF('trees_utr.json'),FURN=OFF('furniture_utr.json'),MAN=OFF('manifest_utr.json');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
function sf(u){u=String(u);
  if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('ul_lang','de');w.localStorage.setItem('nh_city','utr');}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,110));
let fails=0;const ok=(n,v,i)=>{console.log((v?'  ✓ ':'  ✗ ')+n+(i!=null&&i!==''?'  ['+i+']':''));if(!v)fails++;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const expect=w=>({pop:w.pop,sgb2:w.bijstand,kinderarmut:w.armoede,einkommen:w.inkomen,arbeitslos:w.ww,abitur:Math.round(w.hbowo),mig:Math.round(w.herkunft)});
setTimeout(async()=>{const w=window,d=w.document;
  console.log('— Einstieg in die neue Ansicht —');
  const b=d.querySelector('.nav-new');
  ok('Startseite: Knopf „Neu: Straßenlabor" im Kopf',!!b&&/Straßenlabor/.test(b.textContent)&&b.getAttribute('href').startsWith('next.html?lab='),b&&b.getAttribute('href'));
  ok('…sichtbar in Utrecht',b.style.display==='');
  w.eval("setLang('en')");await wait(50);ok('…übersetzt (EN)',/Street lab/.test(b.textContent));w.eval("setLang('de')");
  try{w.switchCity('ffm');}catch(e){}await wait(1500);
  ok('…ausgeblendet in Frankfurt (neue Ansicht nur Utrecht)',b.style.display==='none');
  console.log('— Schrift —');
  const nx=fs.readFileSync('public/next.html','utf8');
  ok('Klassisch: Fraunces ohne „wonky"-Schräglettern (WONK fest 0)',/family=Fraunces:opsz,wght,WONK@9\.\.144,400\.\.700,0&/.test(html));
  ok('Neue Ansicht: Syne (Titel) + DM Sans (Text), Fraunces raus',/family=Syne:wght@400\.\.800/.test(nx)&&/family=DM\+Sans/.test(nx)&&/--serif:'Syne'/.test(nx)&&/--sans:'DM Sans'/.test(nx)&&!/Fraunces/.test(nx));
  ok('Keine erzwungene Kursivschrift mehr (Ladetext, Intro)',!/font-style:italic/.test(nx)&&!/\.kd-empty\{[^}]*italic/.test(html));
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.filter(e=>!/getContext/.test(e)).length,errs.slice(0,3));
  process.exit(fails?1:0);
},3200);

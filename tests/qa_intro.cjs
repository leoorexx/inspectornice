const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);let s={};w.localStorage={getItem:k=>s[k]??null,setItem:(k,v)=>s[k]=''+v,removeItem:k=>delete s[k]};}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(()=>{const w=window,d=w.document;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  const ov=d.getElementById('introOverlay'), card=d.getElementById('introCard');
  console.log('auto-gezeigt:',ov.classList.contains('on'),'| Headline da:',/am stärksten belastet/.test(card.innerHTML),'| Säulen-Pills:',/Klima.*Energie/.test(card.innerHTML),'| NICE:',/29 Indikatoren/.test(card.innerHTML),'| nav-help-Button:',!!d.querySelector('.nav-help'));
  w.closeIntro();
  console.log('nach closeIntro → versteckt:',!ov.classList.contains('on'),'| localStorage gesetzt:',w.localStorage.getItem('nh_intro_v1')==='1');
  w.openIntro();
  console.log('nach openIntro → wieder sichtbar:',ov.classList.contains('on'));
  // erneutes showIntro(false) darf NICHT zeigen (schon gesehen)
  w.closeIntro(); w.showIntro(false);
  console.log('showIntro(false) nach gesehen → bleibt aus:',!ov.classList.contains('on'));
  // EN
  w.eval("lang='en'"); w.renderIntro();
  console.log('EN-Render:',/most burdened/.test(card.innerHTML)&&/social urban developers/.test(card.innerHTML));
  console.log('Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},1200);

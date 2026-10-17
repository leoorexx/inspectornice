const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,140));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,140));
setTimeout(async()=>{const w=window,d=w.document;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  w.eval("map.getSize=function(){return L.point(1200,800);};map.setView([52.0907,5.1214],16);");
  console.log('Linsen-Buttons:',d.querySelectorAll('.lens-btn2').length,'(4)');
  const active=()=>Object.keys(w.eval('activeLayers'));
  w.activateLens('hitze'); await new Promise(r=>setTimeout(r,150));
  console.log('Hitze → aktiv:',JSON.stringify(active()),'| Button on:',d.querySelector('.lens-btn2[data-lens=hitze]').classList.contains('on'));
  w.activateLens('wasser'); await new Promise(r=>setTimeout(r,150));
  console.log('Wasser → aktiv:',JSON.stringify(active()),'| hitze-Button aus:',!d.querySelector('.lens-btn2[data-lens=hitze]').classList.contains('on'));
  w.activateLens('wasser'); await new Promise(r=>setTimeout(r,100));
  console.log('Wasser erneut → aus:',active().length===0,'| kein Button on:',d.querySelectorAll('.lens-btn2.on').length===0);
  // i18n
  w.eval("lang='en'");if(typeof w.applyLang==='function')w.applyLang();else if(typeof w.setLang==='function')w.setLang('en');
  const lb=d.querySelector('.lens-btn2[data-lens=leben] span:last-child');
  console.log('EN-Label Lebensqualität→Livability:',lb?lb.textContent:'—');
  console.log('Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},4000);

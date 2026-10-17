const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
function sf(u){u=String(u);
  if(u.includes('open-meteo')&&u.includes('temperature_2m_max'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{temperature_2m:32.6},daily:{temperature_2m_max:[34.2]}})});
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});
  if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);let s={};w.localStorage={getItem:k=>s[k]??null,setItem:(k,v)=>s[k]=''+v,removeItem:k=>delete s[k]};}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{const w=window,d=w.document;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  console.log('heatLevel: 26→'+w.heatLevel(26)+' 28→'+w.heatLevel(28)+' 31→'+w.heatLevel(31)+' 36→'+w.heatLevel(36)+' (0/1/2/3)');
  w.loadHeatWarn(); await new Promise(r=>setTimeout(r,400));
  const hw=d.getElementById('heatWarn');
  console.log('Warnung an:',hw.classList.contains('on'),'| Text:',/Hitze|Heat|Hitte/.test(hw.innerHTML),/34 °C/.test(hw.innerHTML),/Utrecht/.test(hw.innerHTML));
  console.log('Advice + Icon (kein Emoji):',/genug trinken|drink enough|drink genoeg/.test(hw.innerHTML)&&/<svg/.test(hw.innerHTML)&&!/[☀🌡️]/.test(hw.innerHTML));
  // dismiss → weg + merkt sich
  const btn=hw.querySelector('button'); const dkey=btn.getAttribute('onclick').match(/'([^']+)'/)[1];
  w.dismissHeatWarn(dkey);
  console.log('nach dismiss → weg:',!hw.classList.contains('on'));
  w.loadHeatWarn(); await new Promise(r=>setTimeout(r,300));
  console.log('bleibt heute weg (schon dismissed):',!hw.classList.contains('on'));
  console.log('Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},1400);

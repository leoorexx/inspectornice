const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('public/dashboard.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,140));});
function sf(u){u=String(u);let f=null;if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/_d/dashboard.html',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>(()=>{}),set:()=>true});w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);const s={nh_city:'utr'};try{Object.defineProperty(w,'localStorage',{configurable:true,value:{getItem:k=>(k in s?s[k]:null),setItem:(k,x)=>{s[k]=''+x;},removeItem:k=>{delete s[k];}}});}catch(e){}}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,140));
setTimeout(()=>{const d=window.document;
  console.log('Fehler:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  const pd=d.getElementById('prioDistricts'),pm=d.getElementById('prioMeasures'),po=d.getElementById('prioOverlap');
  console.log('Top-Stadtteile Zeilen:',pd.querySelectorAll('.prio-row').length,'(5 erwartet)');
  console.log('  Beispiel:',pd.querySelector('.prio-main b')?pd.querySelector('.prio-main b').textContent+' · Score '+pd.querySelector('.prio-val').textContent:'—');
  console.log('  Klick öffnet Karte (#utr/):',/index.html#utr\//.test(pd.innerHTML));
  console.log('Beste Maßnahmen Zeilen:',pm.querySelectorAll('.prio-row').length,'(7) · zeigt ×-Ratio:',/\d\.\d×/.test(pm.innerHTML));
  console.log('Mehrfachbelastung:',po.querySelectorAll('.prio-row').length,'Wijken · Titel:',/Mehrfachbelastung|Overlapping/.test(po.innerHTML));
  console.log('Prio-Titel:',d.getElementById('prioTitle').textContent.slice(0,40));
  process.exit(0);
},2200);

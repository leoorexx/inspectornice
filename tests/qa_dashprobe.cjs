const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('public/dashboard.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const vc=new VirtualConsole();
function sf(u){u=String(u);let f=null;if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://t.local/_d/dashboard.html',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>(()=>{}),set:()=>true});w.fetch=sf;w.requestAnimationFrame=c=>setTimeout(c,0);try{Object.defineProperty(w,'localStorage',{configurable:true,value:{_d:{nh_city:'utr'},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]}}});}catch(e){}}});
setTimeout(()=>{const d=dom.window.document;
  console.log('lang:',dom.window.eval('lang'));
  const t=d.querySelector('.page')?d.querySelector('.page').textContent.replace(/\s+/g,' '):'';
  const hits=[...new Set(t.match(/[^.·|]{0,40}(?:[äöüß]|Stadtteile|Maßnahmen|Wijken|Prioritäten|Herausforder|Rahmen|zuerst|Gefälle|Klimarisiko|wachsend|Wohnungs|Spaltung|gekoppelt|identifiziert|dringlich|Bebauung|Nachkriegs|Verdichtung vs|Soziale|bewertet|angepasst|heruntergebrochen)[^.·|]{0,40}/g)||[])];
  console.log('Deutsch-Treffer:',hits.length);console.log('Utrecht-Karten EN:',/Housing shortage & densification/.test(t),/Heat stress Overvecht/.test(t),/Social divide & flooding/.test(t),'| Titel:',/Key challenges — Utrecht/.test(t));hits.slice(0,16).forEach(x=>console.log('  >'+x.trim().slice(0,85)));
  process.exit(0);
},3600);

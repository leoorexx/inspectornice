const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
let DRAW=0;
setTimeout(async()=>{
  const L=window.L;['circleMarker','marker'].forEach(fn=>{const o=L[fn];L[fn]=function(){DRAW++;return o.apply(this,arguments);};});
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  for(const id of ['dv_repair','dv_waste']){
    DRAW=0;const b=errs.length;
    window.toggleLayer(id); await new Promise(r=>setTimeout(r,400));
    const st=window.document.getElementById('st-'+id);
    console.log('  '+id+': Objekte='+DRAW+' Status="'+(st?st.textContent:'?')+'" Fehler='+errs.slice(b).filter(e=>!/getContext/.test(e)).length);
    window.toggleLayer(id);
  }
  process.exit(0);
},3500);

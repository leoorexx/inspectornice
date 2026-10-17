const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{const w=window;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  console.log('HEAT.view default:',w.eval('HEAT.view'));
  const field=await w.loadHeatField();
  console.log('Feld pts (Gebäude):',field&&field.pts?field.pts.length:0);
  const bb=w.eval("window.__b=L.latLngBounds([52.088,5.088],[52.108,5.118]);window.__b");
  const data=w.heatGrid(bb,{trees:[],shops:[],green:[]},field,{s:52.088,w:5.088,n:52.108,e:5.118});
  const cs=data.cells;
  const withBden=cs.filter(c=>c.bden>0).length, withPot=cs.filter(c=>c.pot>0.14).length;
  console.log('Zellen:',cs.length,'| mit Gebäuden:',withBden,'| mit Potenzial:',withPot);
  // Klassen via potInfo
  const classes={};cs.forEach(c=>{const cl=w.potInfo(c).cls;classes[cl]=(classes[cl]||0)+1;});
  console.log('Klassen:',JSON.stringify(classes),'(green/dense/pot/low erwartet)');
  const dense=cs.find(c=>c.bden>=7), open=cs.find(c=>c.pot>0.3);
  console.log('Beispiel dicht (bden>=7):',dense?('bden='+dense.bden+' → '+w.potInfo(dense).cls):'—');
  console.log('Beispiel Potenzial (pot>0.3):',open?('pot='+open.pot.toFixed(2)+' bden='+open.bden+' → '+w.potInfo(open).cls):'—');
  console.log('setHeatView:',typeof w.setHeatView,'| Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},2000);

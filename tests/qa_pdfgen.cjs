const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const vc=new VirtualConsole();
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);if(!w.URL)w.URL={};w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};}});
const {window}=dom;
setTimeout(()=>{const w=window;
  // EN wie der Launch-Markt
  w.eval("lang='en'");
  w.eval(`(function(){var orig=window.pdfDoc;window.__docs=[];window.pdfDoc=function(){var d=orig.apply(this,arguments);if(d){var os=d.save.bind(d);d.save=function(n){window.__lastName=n;window.__lastBuf=d.output('arraybuffer');};}return d;};})()`);
  w.districtPDF('Overvecht');
  fs.writeFileSync(require('path').join(require('os').tmpdir(),'inspector-district.pdf'),Buffer.from(w.eval('window.__lastBuf')));
  console.log('district:',w.eval('window.__lastName'));
  // Mission laden, dann PDF
  w.toggleMission();
  setTimeout(()=>{
    try{ w.missionPDF(); fs.writeFileSync(require('path').join(require('os').tmpdir(),'inspector-mission.pdf'),Buffer.from(w.eval('window.__lastBuf'))); console.log('mission:',w.eval('window.__lastName')); }catch(e){console.log('mission FEHLER:',e.message);}
    process.exit(0);
  },2600);
},3000);

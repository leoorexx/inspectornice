const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{const w=window;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  const field=await w.loadHeatField();
  console.log('LST-Feld geladen:',!!field,'| Punkte-Cluster:',field?field.idx.size:0);
  const lst=w.sampleLst(field,52.098,5.098); // Overvecht-nähe
  console.log('sampleLst(Overvecht) =',lst!=null?lst.toFixed(2)+' °C (echt)':'null');
  // Zoom-Stabilität: Gitter bei zwei Zoomstufen, gleiche Mitte
  w.eval("window.__mkB=(s,ww,n,e)=>({getSouth:()=>s,getWest:()=>ww,getNorth:()=>n,getEast:()=>e});");
  const C={la:52.098,lo:5.098};
  function cell(half){const view={s:C.la-half,w:C.lo-half,n:C.la+half,e:C.lo+half};const bb=w.eval(`window.__mkB(${view.s-0.004},${view.w-0.006},${view.n+0.004},${view.e+0.006})`);
    const d=w.heatGrid(bb,{trees:[],shops:[],green:[]},field,view);
    const cc=d.cells.find(x=>Math.abs((x.bnds[0][0]+x.bnds[1][0])/2-C.la)<0.0004&&Math.abs((x.bnds[0][1]+x.bnds[1][1])/2-C.lo)<0.0006);
    return cc?{dt0:+cc.dt0.toFixed(2),measured:cc.measured}:null;}
  const A=cell(0.003), B=cell(0.012);
  console.log('Zelle zoom16:',JSON.stringify(A),'| zoom13:',JSON.stringify(B),'→',JSON.stringify(A)===JSON.stringify(B)?'STABIL ✓':'WACKELT ✗');
  console.log('Basis gemessen (measured=true):',A&&A.measured);
  console.log('Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},2000);

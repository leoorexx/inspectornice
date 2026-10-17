const {JSDOM}=require('jsdom');const fs=require('fs');
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
function load(file,base,cityVal){return new Promise(res=>{
  let html=fs.readFileSync(file,'utf8').replace(/\/urbanlens\//g,'/_d/');
  const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
  const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/_d/'+base,beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);
    const store={nh_city:cityVal};
    try{Object.defineProperty(w,'localStorage',{configurable:true,value:{getItem:k=>(k in store?store[k]:null),setItem:(k,x)=>{store[k]=''+x;},removeItem:k=>{delete store[k];}}});}catch(e){}
  }});
  setTimeout(()=>res(dom.window),1800);
});}
(async()=>{
  const wi=await load('index.html','index.html','ffm');
  console.log('index (nh_city=ffm) → city:',wi.eval('city'));
  const wd=await load('public/dashboard.html','dashboard.html','ffm');
  console.log('dashboard (nh_city=ffm) → CITYKEY:',wd.eval('CITYKEY'));
  const wm=await load('public/methodik.html','methodik.html','ffm');
  console.log('methodik (nh_city=ffm) → Badge:',wm.document.getElementById('mCityBadge').textContent);
  const wi2=await load('index.html','index.html','utr');
  console.log('index (nh_city=utr) → city:',wi2.eval('city'),'(Standard Utrecht)');
  process.exit(0);
})();

const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch|maplibre/.test(m))errs.push(m.slice(0,130));});
let bagUrl='';
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});
  if(u.includes('bag_'))bagUrl=u.split('/').pop();
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/_d/index.html?city=ffm',virtualConsole:vc,beforeParse(w){
  w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);
  w.maplibregl={Map:function(){return Object.assign(this,{on(){return this},once(ev,cb){if(ev==='load')setTimeout(cb,0);return this},addControl(){return this},resize(){},jumpTo(){},flyTo(){},getCenter:()=>({lat:50.11,lng:8.68}),getZoom:()=>15,getSource:()=>null,addSource(){},addLayer(){},getCanvas:()=>({style:{}})});},NavigationControl:function(){},Popup:function(){return {setLngLat(){return this},setHTML(){return this},addTo(){return this}}}};
}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{
  console.log('INIT-Fehler:',errs.filter(e=>!/getContext/.test(e)).slice(0,4));
  console.log('Stadt:',window.eval('city'));
  window.enter3D(); await new Promise(r=>setTimeout(r,600));
  const F=window.eval('M3.features||[]');
  if(!F.length){console.log('❌ keine Features geladen | bag-Datei:',bagUrl);process.exit(1);}
  const hs=F.map(f=>f.properties._h);
  const maxH=Math.max(...hs);
  const tall=hs.filter(h=>h>=100).length, sky=hs.filter(h=>h>=200).length;
  const co2=F.filter(f=>f.properties.co2!=null).length, lst=F.filter(f=>f.properties.lst!=null).length;
  const grey=F.filter(f=>f.properties.co2==null).length;
  console.log('bag-Datei geladen:',bagUrl);
  console.log('Gebäude gesamt:',F.length);
  console.log('Höchstes:',maxH.toFixed(1),'m | ≥200m (Türme):',sky,'| ≥100m:',tall);
  console.log('mit CO₂:',co2,'| mit Hitze:',lst,'| grau/Neben:',grey);
  // Höhen-Verteilung
  const p=q=>{const a=hs.slice().sort((x,y)=>x-y);return a[Math.floor(a.length*q)].toFixed(1);};
  console.log('Höhen-Quantile p50/p90/p99:',p(.5),'/',p(.9),'/',p(.99),'m');
  console.log('CHECKS: Türme>=200m vorhanden:',sky>=3,'| Skyline realistisch (max>=250):',maxH>=250,'| viele Gebäude(>50k):',F.length>50000,'| Analyse-Anteil>60%:',(co2/F.length)>0.6);
  process.exit(0);
},3500);

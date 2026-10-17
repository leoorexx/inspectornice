// Gemeinsame Testhilfe fürs Straßenlabor: Seite mit eingesetzten Modulen, Netz-Ersatz (3D BAG, BGT, AHN, LIWO, Open-Meteo …),
// Leinwand-Ersatz und ein 40 × 40-AHN-Raster mit Gefälle. extra(u) kann zusätzliche Antworten liefern (oder null).
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const page=fs.readFileSync('public/next.html','utf8').replace(/<script src="js\/((?:lab[a-z0-9-]*|act|nx-[a-z]*)\.js)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync('public/js/'+f,'utf8')+'</script>');
let EXTRA=null;
const errs=[];const C=[52.0907,5.1214],D=0.0001;                  // 0,0001° Länge ≈ 6,85 m
const box=(w,s,e,n)=>[[[w,s],[e,s],[e,n],[w,n],[w,s]]];
const BAG={features:[
  {properties:{b3_h_70p:13,b3_h_maaiveld:1},geometry:{type:'Polygon',coordinates:box(C[1]-2.5*D,C[0]-3*D,C[1]-D,C[0]+3*D)}},
  {properties:{b3_h_70p:19,b3_h_maaiveld:1},geometry:{type:'Polygon',coordinates:box(C[1]+D,C[0]-3*D,C[1]+2.5*D,C[0]+3*D)}}]};
const lane=(w,e,f,fy,plus,extra)=>({properties:{functie:f,fysiek_voorkomen:fy,plus_fysiek_voorkomen:plus,...(extra||{})},geometry:{type:'Polygon',coordinates:box(C[1]+w*D,C[0]-3*D,C[1]+e*D,C[0]+3*D)}});
const WEG={features:[lane(-1,-.7,'voetpad','open verharding','tegels'),lane(-.7,-.4,'fietspad','gesloten verharding','asfalt'),lane(-.4,.4,'rijbaan lokale weg','gesloten verharding','asfalt'),lane(.4,1,'parkeervlak','open verharding','betonstraatstenen'),
  lane(-.4,.4,'fietspad','gesloten verharding','asfalt',{eind_registratie:'2019-01-01T00:00:00Z'})],links:[]};   // frühere Fassung: muss ignoriert werden
let bgtUrls=[],gfi=0,wcs=0,om=0;
const LIWO_D={1:-9999,2:0.41,3:0.93,4:1.24,5:1.31};
function times(){const d=new Date(),p=n=>String(n).padStart(2,'0'),o=[];for(let h=0;h<48;h++){const t=new Date(d.getFullYear(),d.getMonth(),d.getDate(),h);o.push(`${t.getFullYear()}-${p(t.getMonth()+1)}-${p(t.getDate())}T${p(t.getHours())}:00`);}return o;}
function sf(u){u=String(u);if(EXTRA){const x=EXTRA(u);if(x)return x;}const J=v=>Promise.resolve({ok:true,json:()=>Promise.resolve(v),arrayBuffer:()=>Promise.resolve(new ArrayBuffer(8)),text:()=>Promise.resolve(JSON.stringify(v))});
  if(u.includes('3dbag'))return J(/STARTINDEX=0/.test(u)?BAG:{features:[]});
  if(u.includes('/lv/bgt/')){bgtUrls.push(u);
    if(u.includes('/wegdeel/'))return J(WEG);
    if(u.includes('/openbareruimtelabel/'))return J({features:[{properties:{openbareruimtenaam:'Teststraat'},geometry:{type:'Point',coordinates:[C[1],C[0]+.0002]}},{properties:{openbareruimtenaam:'Altname',eind_registratie:'2016-01-01T00:00:00Z'},geometry:{type:'Point',coordinates:[C[1],C[0]]}}],links:[]});
    return J({features:[],links:[]});}
  if(u.includes('basisinformatie-overstromingen')&&u.includes('plaatsgebonden')){
    if(u.includes('GetLegendGraphic'))return J({Legend:[{rules:[{symbolizers:[{Raster:{colormap:{entries:[1,2,3,4,5].map(v=>({quantity:String(v),color:'#'+String(v).repeat(6),label:'NL '+v}))}}}]}]}]});
    const y=/totaal_(huidig|2050|2100)_/.exec(u)[1];return J({features:[{properties:{GRAY_INDEX:{huidig:4,'2050':2,'2100':2}[y]}}]});}
  if(u.includes('basisinformatie-overstromingen')){
    if(u.includes('GetLegendGraphic'))return J({Legend:[{rules:[{symbolizers:[{Raster:{colormap:{entries:[{quantity:'0.01',color:'#fff'},{label:'< 0.5',color:'#CEFEFE'},{label:'0.5 - 1.0',color:'#94BFF7'},{label:'> 5.0',color:'#73004C'}]}}}]}]}]});
    gfi++;const k=+/Kaart(\d)/.exec(u)[1];return J({features:[{properties:{GRAY_INDEX:LIWO_D[k]}}]});}
  if(u.includes('ahn/wcs')){wcs++;const b=Uint8Array.from([u.includes('dsm_05m')?1:2]).buffer;return Promise.resolve({ok:true,arrayBuffer:()=>Promise.resolve(b)});}
  if(u.includes('open-meteo')){if(!/temperature_2m_max/.test(u))om++;const n=(new URL(u).searchParams.get('latitude')||'').split(',').length,T=times();
    return J(Array.from({length:n},(_,i)=>({latitude:52+i*.01,longitude:5+i*.01,hourly:{time:T,temperature_2m:T.map((_,h)=>15+h%12),apparent_temperature:T.map(()=>14),wind_speed_10m:T.map(()=>5),wind_direction_10m:T.map(()=>270),wind_gusts_10m:T.map(()=>9),precipitation:T.map(()=>0)}})));}
  if(u.includes('Klimaatknelpuntenkaart')){const l=+/FeatureServer\/(\d)/.exec(u)[1];return J({type:'FeatureCollection',features:l===2?[{type:'Feature',properties:{Opmerkingen:'Testbuurt',urg_amb:'urgentie'},geometry:{type:'Polygon',coordinates:box(C[1]-3*D,C[0]-3*D,C[1]+3*D,C[0]+3*D)}}]:[]});}
  if(u.includes('data.rivm.nl/geo/ank'))return J({features:[{properties:{GRAY_INDEX:2.154884}}]});
  if(u.includes('locatieserver'))return J({response:{docs:[]}});
  const f=u.replace(/^.*?(data\/)/,'public/$1').split('?')[0];
  if(fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.reject(new Error('404')),text:()=>Promise.resolve('')});}
function ctx(){const r={fills:[]};return new Proxy(r,{get:(t,k)=>k in t?t[k]:k==='measureText'?(s=>({width:String(s).length*6})):k==='getImageData'||k==='createImageData'?((a,b,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w||a)*(h||b))*4)})):(()=>{}),set:(t,k,v)=>{t[k]=v;return true;}});}
function mk(url){
  const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS/.test(m))errs.push(m.slice(0,160));});
  const dom=new JSDOM(page,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url,virtualConsole:vc,beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=function(){return this._c||(this._c=ctx());};w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(()=>c(Date.now()),16);w.cancelAnimationFrame=id=>clearTimeout(id);
    w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};w.localStorage.setItem('ul_lang','de');w.localStorage.setItem('nx_hint','1');
    // AHN-Raster 40 × 40: Gefälle von −1 m (West) bis +5 m (Ost), eine Gebäudelücke
    // DSM (Oberfläche) = Gelände + 12 m: jeder Registerbaum misst 12 m
    w.GeoTIFF={fromArrayBuffer:async(buf)=>{const dsm=new Uint8Array(buf)[0]===1;return {getImage:async()=>({getWidth:()=>40,getHeight:()=>40,readRasters:async()=>{const z=new Float32Array(1600);for(let j=0;j<40;j++)for(let i=0;i<40;i++)z[j*40+i]=-1+6*i/39+(dsm?12:0);if(!dsm)z[20*40+20]=3.4e38;return [z];}})};}};}});
  dom.window.onerror=m=>errs.push('e:'+String(m).slice(0,160));return dom.window;}

let fails=0;const ok=(n,v,i)=>{console.log((v?'  ✓ ':'  ✗ ')+n+(i!=null&&i!==''?'  ['+i+']':''));if(!v)fails++;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const J=v=>Promise.resolve({ok:true,json:()=>Promise.resolve(v),arrayBuffer:()=>Promise.resolve(new ArrayBuffer(8)),text:()=>Promise.resolve(JSON.stringify(v))});
module.exports={mk,ok,wait,errs,C,D,box,BAG,J,setExtra:f=>{EXTRA=f;},get fails(){return fails;}};

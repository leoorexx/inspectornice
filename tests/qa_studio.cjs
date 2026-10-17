// Studio (js/lab-studio.js): Themen mit Zielen, Stile, Diagramm-SVG, Explosionszeichnung, Lasercut
// (Grundrisse je Schicht vereinigt, Platten packen, SVG/DXF, ZIP), Baujahr/Dach aus 3D BAG.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const page=fs.readFileSync('public/next.html','utf8').replace(/<script src="js\/((?:lab[a-z0-9-]*|act|nx-[a-z]*)\.js)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync('public/js/'+f,'utf8')+'</script>');
const errs=[];const C=[52.0907,5.1214],D=0.0001;                  // 0,0001° Länge ≈ 6,85 m
const box=(w,s,e,n)=>[[[w,s],[e,s],[e,n],[w,n],[w,s]]];
const BAG={features:[
  {properties:{b3_h_70p:13,b3_h_maaiveld:1,oorspronkelijkbouwjaar:1932,b3_opp_dak_plat:40,b3_opp_dak_schuin:0},geometry:{type:'Polygon',coordinates:box(C[1]-2.5*D,C[0]-3*D,C[1]-D,C[0]+3*D)}},
  {properties:{b3_h_70p:19,b3_h_maaiveld:1,oorspronkelijkbouwjaar:2011,b3_opp_dak_plat:0,b3_opp_dak_schuin:60},geometry:{type:'Polygon',coordinates:box(C[1]+D,C[0]-3*D,C[1]+2.5*D,C[0]+3*D)}}]};
const lane=(w,e,f,fy,plus,extra)=>({properties:{functie:f,fysiek_voorkomen:fy,plus_fysiek_voorkomen:plus,...(extra||{})},geometry:{type:'Polygon',coordinates:box(C[1]+w*D,C[0]-3*D,C[1]+e*D,C[0]+3*D)}});
const WEG={features:[lane(-1,-.7,'voetpad','open verharding','tegels'),lane(-.7,-.4,'fietspad','gesloten verharding','asfalt'),lane(-.4,.4,'rijbaan lokale weg','gesloten verharding','asfalt'),lane(.4,1,'parkeervlak','open verharding','betonstraatstenen'),
  lane(-.4,.4,'fietspad','gesloten verharding','asfalt',{eind_registratie:'2019-01-01T00:00:00Z'})],links:[]};   // frühere Fassung: muss ignoriert werden
let bgtUrls=[],gfi=0,wcs=0,om=0;
const LIWO_D={1:-9999,2:0.41,3:0.93,4:1.24,5:1.31};
function times(){const d=new Date(),p=n=>String(n).padStart(2,'0'),o=[];for(let h=0;h<48;h++){const t=new Date(d.getFullYear(),d.getMonth(),d.getDate(),h);o.push(`${t.getFullYear()}-${p(t.getMonth()+1)}-${p(t.getDate())}T${p(t.getHours())}:00`);}return o;}
function sf(u){u=String(u);const J=v=>Promise.resolve({ok:true,json:()=>Promise.resolve(v),arrayBuffer:()=>Promise.resolve(new ArrayBuffer(8)),text:()=>Promise.resolve(JSON.stringify(v))});
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
  if(u.includes('open-meteo')){om++;const n=(new URL(u).searchParams.get('latitude')||'').split(',').length,T=times();
    return J(Array.from({length:n},(_,i)=>({latitude:52+i*.01,longitude:5+i*.01,hourly:{time:T,temperature_2m:T.map((_,h)=>15+h%12),apparent_temperature:T.map(()=>14),wind_speed_10m:T.map(()=>5),wind_direction_10m:T.map(()=>270),wind_gusts_10m:T.map(()=>9),precipitation:T.map(()=>0)}})));}
  if(u.includes('nationaal-wegenbestand')){const P=(dx,dy)=>[C[1]+dx*D,C[0]+dy*D],seg=(a,b,ia,ib,code)=>({type:'Feature',properties:{bst_code:code,jte_id_beg:ia,jte_id_end:ib},geometry:{type:'LineString',coordinates:[P(...a),P(...b)]}});
    return J({features:[seg([0,0],[10,0],1,2,''),seg([10,0],[10,10],2,3,'FP'),seg([10,10],[0,10],3,4,'VP'),seg([0,10],[0,0],4,1,'RB'),seg([0,0],[-40,0],1,5,'HR')],links:[]});}
  if(u.includes('api.gbif.org'))return J({count:42,facets:[{counts:[{name:'1',count:20},{name:'2',count:22}]}]});
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

const cp=require('child_process'),os=require('os'),path=require('path');
const w=mk('https://test.local/next.html');
setTimeout(async()=>{const d=w.document,LAB=w.LAB,A=LAB.api,map=w.eval('map'),L_=w.L,S=LAB.studio;
  map.getSize=()=>L_.point(1024,768);
  console.log('— Anmeldung & Daten —');
  ok('Studio als Werkzeug angemeldet (Gruppe Gestalten)',LAB._t.TOOLS.map(t=>t.id).join()==='sun,surface,street,water,wind,standort,route,building,area,studio,export'&&LAB._t.TOOLS.find(t=>t.id==='studio').grp==='make',LAB._t.TOOLS.map(t=>t.id).join());
  map.setView(C,17,{animate:false});w.__NX.openLab(null,'studio');await wait(60);
  for(let i=0;i<60&&(S.ST.busy||!S.ST.stats);i++)await wait(100);
  ok('Baujahr und Dachflächen aus 3D BAG übernommen',S.SN.B.some(b=>b.yr===1932&&b.fl===40)&&S.SN.B.some(b=>b.yr===2011&&b.sl===60));
  ok('Gebietsdaten als eigene Momentaufnahme (bleibt beim Herauszoomen)',S.SN.B&&S.SN.B.length===2&&S.SN.S&&S.SN.S.length>0);
  ok('Kennzahlen berechnet (2 Gebäude, Grundfläche > 0)',S.ST.stats&&S.ST.stats.n===2&&S.ST.stats.foot>0,S.ST.stats&&S.ST.stats.n);
  console.log('— Themen & Stile —');
  ok('13 Themen (inkl. Himmelssicht, Gehen, Lebensraum), 4 Stile',d.querySelectorAll('.st-dias [data-d]').length===13&&d.querySelectorAll('.st-stys [data-s]').length===4);
  d.querySelector('.st-dias [data-d="age"]').click();await wait(20);
  ok('Baujahr: Anteil vor 1975 und Energie-Hinweis',/% vor 1975/.test(d.querySelector('.st-kpi').textContent)&&/Dämm/.test(d.querySelector('.st-goal').textContent));
  const k=S.kpi();ok('… Grundfläche nach Bauzeit (vor 1945 / ab 2006)',k.parts[0]>0&&k.parts[4]>0&&k.parts[1]===0);
  d.querySelector('.st-dias [data-d="green"]').click();await wait(20);
  ok('3-30-300: Balken mit Ziel 30 %',!!d.querySelector('.st-bar s')&&/Ziel 30 %/.test(d.querySelector('.st-kpi').textContent));
  d.querySelector('.st-dias [data-d="roof"]').click();await wait(20);
  ok('Dächer: Flachdachfläche summiert',/40/.test(d.querySelector('.st-big b').textContent)&&/Flachdach/.test(d.querySelector('.st-big').textContent),d.querySelector('.st-big').textContent);
  d.querySelector('.st-stys [data-s="night"]').click();await wait(20);
  ok('Stil umschaltbar',S.ST.sty==='night'&&d.querySelector('.st-stys .on').dataset.s==='night');
  console.log('— Frameworks: Gehen, Lebensraum —');
  d.querySelector('.st-dias [data-d="walk"]').click();for(let i=0;i<60&&S.EXT.busy;i++)await wait(50);await wait(20);
  ok('Gehen: Netz aus dem NWB, Autobahn ausgeschlossen, Gehminuten je Abschnitt',S.EXT.walk&&!S.EXT.walk.err&&S.EXT.walk.segs[0].length===4,S.EXT.walk&&S.EXT.walk.segs.map(x=>x.length).join('/'));
  ok('Gehen: Kennzahl Bänke in 5 Minuten',/Bänke in 5 Minuten/.test(d.querySelector('.st-kpi').textContent));
  d.querySelector('.st-dias [data-d="habitat"]').click();for(let i=0;i<60&&S.EXT.busy;i++)await wait(50);await wait(20);
  ok('Lebensraum: Gattungen, 20-%-Regel als Ziel, GBIF-Arten',S.EXT.hab&&S.EXT.hab.gbif&&S.EXT.hab.gbif.species===2&&/Ziel 20 %/.test(d.querySelector('.st-kpi').textContent)&&/Arten seit 2015/.test(d.querySelector('.st-kpi').textContent),S.EXT.hab&&JSON.stringify({n:S.EXT.hab.n,g:S.EXT.hab.genera}));
  d.querySelector('.st-dias [data-d="roof"]').click();await wait(20);
  console.log('— Ausgabe —');
  const svg=await S.diagramSvg();
  ok('Diagramm-SVG: rund zugeschnitten, Titel, Maßstab, Quelle',/<clipPath id="ar">/.test(svg)&&/Dächer/.test(svg)&&/50 m|20 m|100 m/.test(svg)&&/3D BAG/.test(svg));
  const axo=S.axoSvg();
  const miss=['Boden','Hitzeflächen','Wege &amp; Schatten','Grün &amp; Bäume','Gebäude','Ziel 30 %'].filter(t=>!axo.includes(t));
  ok('Explosionszeichnung: 5 Ebenen mit Zielen, Gebäude als Körper',!miss.length&&(axo.match(/fill-opacity="0\.\d+"/g)||[]).length>=4,miss.join(','));
  console.log('— Lasercut: Geometrie —');
  const sq=(x,y,s)=>[[x,y],[x+s,y],[x+s,y+s],[x,y+s]];
  const u1=S.unionRings([sq(0,0,10),sq(10,0,10)],.05);
  ok('Zwei Nachbarn mit gemeinsamer Wand → ein Teil (4 Ecken)',u1.length===1&&u1[0].length===4,u1.map(r=>r.length).join());
  const u2=S.unionRings([[[0,0],[20,0],[20,10],[0,10]],sq(0,10,10),sq(10,10,10)],.05);
  ok('T-Stoß (eine lange, zwei kurze Wände) → ein Teil',u2.length===1&&u2[0].length===4,u2.map(r=>r.length).join());
  const ring=[[[0,0],[30,0],[30,10],[0,10]],[[0,20],[30,20],[30,30],[0,30]],[[0,10],[10,10],[10,20],[0,20]],[[20,10],[30,10],[30,20],[20,20]]];
  const u3=S.unionRings(ring,.05),pc=S.piecesOf(u3);
  ok('Innenhof bleibt als Loch erhalten (1 Teil, 1 Loch)',pc.length===1&&pc[0].h.length===1,pc.map(p=>p.h.length).join());
  const tx=S.strokeText('1.12',0,10,6);ok('Einstrich-Schrift für Nummern (Laser-tauglich)',tx.length>=5&&tx.every(p=>p.length>=2));
  console.log('— Lasercut: Platten —');
  Object.assign(S.ST.laser,{scale:500,th:3,bed:'1000x600',touched:true});w.LAB.area.AR.r=100;   // Ø 200 m → 400 mm
  const Lz=await S.buildLaser();
  ok('1:500 bei 3 mm → 1 Schicht = 1,5 m; 12/18 m → 8/12 Schichten',Lz.Hl===1.5&&Lz.K===12&&Lz.nLv[0]===2&&Lz.nLv[8]===1,Lz.K+' · '+Lz.nLv.join('/'));
  ok('Teile gepackt, keins zu groß',Lz.sheets.length>=1&&Lz.over.length===0&&Lz.sheets.every(s=>s.items.every(p=>p.dx+p.bb[2]<=1000-5+.01&&p.dy+p.bb[3]<=600-5+.01)));
  const sv=S.sheetSvg(Lz,Lz.sheets[0],0);
  ok('Platte als SVG in mm: rot schneiden, blau gravieren',/width="1000mm" height="600mm"/.test(sv)&&/id="SCHNEIDEN"[^>]*stroke="#ff0000"/.test(sv)&&/id="GRAVIEREN"[^>]*stroke="#0000ff"/.test(sv));
  const dx=S.sheetDxf(Lz,Lz.sheets[0],0);
  ok('Platte als DXF (R12): Ebenen SCHNEIDEN/GRAVIEREN, EOF',/\nSCHNEIDEN\n/.test(dx)&&/\nGRAVIEREN\n/.test(dx)&&/EOF$/.test(dx));
  const files=S.laserFiles(Lz);ok('Anleitung nennt Maßstab, Schichthöhe, Zusammenbau',/1:500/.test(files.find(f=>f.name==='anleitung.txt').data)&&/1 Schicht = 1,50 m/.test(files.find(f=>f.name==='anleitung.txt').data)&&/ZUSAMMENBAU/.test(files.find(f=>f.name==='anleitung.txt').data));
  ok('CRC-32 korrekt („123456789" → CBF43926)',S.crc32(new w.TextEncoder().encode('123456789')).toString(16)==='cbf43926');
  const z=S.zip(files),tmp=path.join(os.tmpdir(),'qa_studio_'+process.pid+'.zip');fs.writeFileSync(tmp,Buffer.from(z));
  let zt='';try{zt=cp.execSync('unzip -t '+tmp,{encoding:'utf8'});}catch(e){zt=String(e.stdout||e);}fs.unlinkSync(tmp);
  ok('ZIP gültig (unzip -t), alle Dateien drin',/No errors detected/.test(zt)&&files.every(f=>zt.includes(f.name)),files.length+' Dateien');
  console.log('— Lasercut: Bedienung —');
  d.querySelector('.ex-fmt [data-x="laser"]').click();await wait(20);
  ok('Laser-Bereich: Maßstab, Stärke, Bett, Optionen',d.querySelectorAll('.st-lz [data-lo="scale"]').length>=3&&d.querySelectorAll('.st-lz [data-lo="th"]').length===4&&d.querySelectorAll('.st-lz [data-lc]').length===4);
  S.ST.laser.touched=false;S.ST.laser.bed='600x400';w.LAB.area.AR.r=400;S.ST.laser.scale=500;S.ST.laser.res=null;w.LAB.api.rerender();await wait(10);
  d.getElementById('stLz').click();for(let i=0;i<80&&S.ST.laser.busy!==false;i++)await wait(50);await wait(50);
  ok('Grundplatte zu groß → Maßstab passend zum Bett gewählt',S.ST.laser.scale>500&&S.ST.laser.auto===true&&S.ST.laser.res.over.length===0,'1:'+S.ST.laser.scale);
  ok('Ergebnis: Platten, Teile, Schnitt-/Gravurlänge, Vorschau',d.querySelectorAll('.st-lg div').length===4&&!!d.querySelector('.st-prev svg')&&!!d.getElementById('stZip'));
  d.getElementById('stZip').click();await wait(10);
  ok('ZIP-Download angestoßen',/lasercut_1-\d+_.*\.zip/.test(S.ST.laser.last||''),S.ST.laser.last);
  console.log('— 3D-Ansicht (Sonne) —');
  LAB.setTool('sun');await wait(30);
  ok('Sonne: Knopf „In 3D ansehen"',!!d.getElementById('v3dBtn')&&/In 3D ansehen/.test(d.getElementById('v3dBtn').textContent));
  const V=LAB.v3d;ok('3D-Bausteine: Baujahr-Stufen, Mittagssonne im Süden (+z)',V._t.BUCKET(1632)===1600&&V._t.BUCKET(1987)===1980&&V._t.BUCKET(1005)===null&&Math.abs(V._t.sunDir({alt:0,az:0})[2]-1)<1e-9,V._t.sunDir({alt:0,az:0}).map(v=>v.toFixed(2)).join());
  d.getElementById('v3dBtn').click();for(let i=0;i<40&&V.busy;i++)await wait(50);
  ok('Ohne Grafik-Bibliothek: ehrlicher Hinweis statt Absturz',!V.on&&!!V.err&&/3D/.test(d.querySelector('.lab-dock .wt-warn').textContent));
  ok('Keine Emojis im Studio',!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u.test(d.querySelector('.lab-dock').innerHTML));
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.length,errs.slice(0,3));
  process.exit(fails?1:0);
},2500);

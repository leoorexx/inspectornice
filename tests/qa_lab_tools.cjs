// Straßenlabor-Werkzeugkasten: Straße (Querschnitt), Wasser (LIWO + AHN), Wind (Open-Meteo),
// Fläche (Steckbrief), Export (DXF/OBJ/GeoJSON/SVG), Hintergrund, nur aktuelle BGT-Objekte, Direktlink.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const page=fs.readFileSync('public/next.html','utf8').replace(/<script src="js\/((?:lab[a-z0-9-]*|act|nx-[a-z]*)\.js)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync('public/js/'+f,'utf8')+'</script>');
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
const w=mk('https://test.local/next.html');
setTimeout(async()=>{const d=w.document,LAB=w.LAB,A=LAB.api,map=w.eval('map'),L_=w.L;
  map.getSize=()=>L_.point(1024,768);
  console.log('— Werkzeugkasten —');
  ok('11 Werkzeuge angemeldet (Sonne, Hitze, Straße, Wasser, Wind, Standort, Route, Gebäude, Fläche, Studio, CAD)',LAB._t.TOOLS.map(t=>t.id).join()==='sun,surface,street,water,wind,standort,route,building,area,studio,export',LAB._t.TOOLS.map(t=>t.id).join());
  map.setView(C,17,{animate:false});w.__NX.openLab(null);await wait(50);
  ok('Werkzeugleiste mit 11 Schaltflächen in drei Gruppen, aktiv: Sonne',d.querySelectorAll('.lab-tools [data-t]').length===11&&d.querySelectorAll('.lab-tg').length===3&&d.querySelector('.lab-tools .on').dataset.t==='sun');
  console.log('— Genauigkeit der Grundlagen —');
  const rt=A.fromRD(...A.toRD(52.09095284,5.12105653));
  ok('RD → WGS84 → RD: Rundreise < 0,5 m',Math.hypot((rt[0]-52.09095284)*111320,(rt[1]-5.12105653)*111320*Math.cos(52.09*Math.PI/180))<.5);
  const pd=A.fromRD(136760.29,455888.356);
  ok('RD → WGS84 trifft PDOK (Domplein 9) auf < 1 m',Math.hypot((pd[0]-52.09095284)*111320,(pd[1]-5.12105653)*68560)<1,pd.map(v=>v.toFixed(6)).join(', '));
  await A.ensure('s');
  ok('BGT nur aktuelle Objekte: Filter im Abruf',bgtUrls.length>0&&bgtUrls.every(u=>/filter=eind_registratie%20IS%20NULL/.test(u)),bgtUrls.length+' Abrufe');
  ok('…und frühere Fassungen werden zusätzlich verworfen',A.S.list.filter(o=>o.k==='wegdeel').length===4,A.S.list.filter(o=>o.k==='wegdeel').map(o=>o.f).join(', '));
  console.log('— Gemessene Baumhöhen (AHN) —');
  await A.ensureTrees();const before=A.TREES.filter(t=>Math.abs(t[0]-C[0])<.002&&Math.abs(t[1]-C[1])<.003).slice(0,50);
  ok('Ohne Messung: vorsichtige Schätzung (≤ 20 m)',A.TREES.every(t=>t[3]<=20));
  await A.measureTrees();
  const mt=before.filter(t=>t[8]===1);
  ok('Höhe = AHN-Oberfläche − Gelände (12 m) für Bäume im Ausschnitt',mt.length>20&&mt.every(t=>Math.abs(t[3]-12)<.6),mt.length+' gemessen');
  ok('Krone höchstens 0,45 × gemessene Höhe',mt.every(t=>t[2]<=.45*t[3]+1e-9));
  const ti=A.treeInfo(mt[0]);ok('Baum antippen: Gattung, Pflanzjahr, gemessene Höhe',/gemessen, AHN/.test(ti)&&/1[12],\d m/.test(ti),ti.replace(/<[^>]+>/g,' ').slice(0,90));
  console.log('— Zukunft: Hitze 2050/2100 —');
  d.querySelector('.lab-tools [data-t="surface"]').click();for(let k=0;k<30&&!d.querySelector('.fz');k++)await wait(50);await wait(80);
  const KN=JSON.parse(fs.readFileSync('public/data/official/knmi23_debilt.json','utf8')),fz=d.querySelector('.fz')?d.querySelector('.fz').textContent.replace(/\s+/g,' '):'';
  ok('KNMI\'23 De Bilt im Build abgerufen (Datum, Quelle, 1991–2020)',/^\d{4}-\d\d-\d\d$/.test(KN.meta.fetched)&&KN.meta.reference==='1991-2020'&&KN.ind.tropisch.ref===5,KN.meta.fetched);
  ok('Spanne über alle sechs Szenarien: Tropentage 5 → 8,8–14 → 8,8–39',/5 ?→ 8,8–14 ?→ 8,8–39/.test(fz),fz.slice(0,140));
  ok('Tropennächte und Sommertage ebenso',/0,3 ?→ 1,2–3,4 ?→ 1,2–24/.test(fz)&&/28 ?→ 39–54 ?→ 39–98/.test(fz));
  ok('Wärmeinsel am Punkt (RIVM 2022) mit Einordnung „Umland + Stadt"',/\+2,2 °C/.test(fz)&&/Umland/.test(fz));
  console.log('— Straße (Querschnitt wie Streetmix) —');
  d.querySelector('.lab-tools [data-t="street"]').click();await wait(30);
  ok('Leerer Zustand erklärt das Antippen',/Tippe auf eine Straße/.test(d.querySelector('.lab-body').textContent));
  map.fire('click',{latlng:L_.latLng(C[0],C[1]+.1*D),containerPoint:L_.point(500,380)});
  for(let k=0;k<40&&!(LAB.street.SEC&&LAB.street.SEC.segs);k++)await wait(50);
  const S=LAB.street.SEC;
  ok('Querschnitt gefunden, Straßenname aus der BGT (aktuelles Schild)',S&&S.name==='Teststraat',S&&S.name);
  const W=S.segs.reduce((p,s)=>p+s.w,0);
  ok('Breite Fassade–Fassade ≈ 13,7 m',Math.abs(W-13.7)<.5,W.toFixed(2));
  ok('Reihenfolge West→Ost: Gehweg · Radweg · Fahrbahn · Parken',S.segs.map(s=>s.t).join()==='walk,bike,car,park',S.segs.map(s=>s.t+' '+s.w.toFixed(1)).join(' | '));
  ok('Breiten auf ±0,3 m (2,1 · 2,1 · 5,5 · 4,1)',[2.06,2.06,5.48,4.11].every((v,i)=>Math.abs(S.segs[i].w-v)<.35));
  ok('Fassadenhöhen gemessen: West 12 m, Ost 18 m',S.hl===12&&S.hr===18,S.hl+' / '+S.hr);
  ok('Profil-Grafik, H/B-Einordnung, Tabelle',!!d.querySelector('.sx')&&/H\/B 1,(09|10)/.test(d.querySelector('.sx-head').textContent)&&!!d.querySelector('.sx-tab'),d.querySelector('.sx-head span').textContent);
  const mb=LAB.street.metrics(null);
  ok('Heute: 100 % versiegelt, 0 % Grün',Math.round(mb.sealed)===100&&mb.green===0,JSON.stringify({s:Math.round(mb.sealed),g:mb.green,h:mb.heat}));
  d.querySelector('#sxEdit').click();await wait(20);
  ok('Umbauen: Parkstreifen vorausgewählt, Palette sichtbar',!!d.querySelector('.sx-pal')&&d.querySelector('.sx-seg.on')&&/Parken/.test(d.querySelector('.sx-seg.on').textContent));
  d.querySelector('.sx-pal [data-ty="trees"]').click();await wait(20);
  const ma=LAB.street.metrics(w.eval('null')||null);
  const after=d.querySelector('.sx-tab').textContent;
  ok('Nachher: Baumstreifen statt Parken → weniger versiegelt, mehr Grün, Kronendach, neue Bäume',/70 %/.test(after)&&/30 %/.test(after)&&/\+13/.test(after),after.replace(/\s+/g,' ').slice(0,160));
  LAB.dateKey='jun';LAB.min=13*60+40;const sh=LAB.street.shadeNow();
  ok('Schatten im Schnitt: 21. Juni, Sonnenhöchststand (Süden) → N-S-Straße kaum beschattet',!sh.night&&sh.shaded<1.5,sh.night?'Nacht':sh.shaded.toFixed(2)+' m');
  LAB.min=17*60;const sh2=LAB.street.shadeNow();
  ok('…nachmittags (21. Juni, 17 Uhr) wirft die Westseite Schatten nach Osten',!sh2.night&&sh2.parts.some(p=>p.side==='l')&&sh2.shaded>1,!sh2.night&&sh2.parts.map(p=>p.side+' '+(p.b-p.a).toFixed(1)+' m').join());
  LAB.dateKey='today';
  console.log('— Maßnahmen im Straßenraum —');
  LAB.dateKey='today';LAB.street.EDIT=null;await LAB.measures.context(LAB.street.SEC);A.rerender();await wait(20);
  const pl=LAB.measures.plan();
  ok('Parkspur erkannt → Bäume und Wadi vorgeschlagen',pl.some(m=>m.id==='trees')&&pl.some(m=>m.id==='wadi'),pl.map(m=>m.id).join());
  const tr=pl.find(m=>m.id==='trees'),wd=pl.find(m=>m.id==='wadi');
  ok('Mengen je 100 m aus gemessenen Breiten (Bäume, m² entsiegelt, m³ Regen)',tr&&tr.q[0][0]===11&&/m²/.test(tr.q[1][0])&&wd&&/m³/.test(wd.q[1][0]),tr&&tr.q.map(q=>q[0]).join(' / '));
  ok('Abwägung offen genannt (Parkplätze weniger)',/Parkplätze weniger/.test(tr.x));
  ok('Maßnahmen-Karten im Straßen-Werkzeug, beste zuerst',d.querySelectorAll('.lab-body .ms-c').length===pl.length&&!!d.querySelector('.lab-body .ms-c.best'));
  ok('Keine Klassen-Kollision mit der Kopfzeile (.top) im Werkzeug',![...d.querySelectorAll('.lab-dock [class]')].some(e=>e.classList.contains('top')));
  d.querySelector('.lab-body [data-ms="trees"]').click();await wait(20);
  ok('„Im Querschnitt zeigen" setzt den Umbau (Parkspur → Baumstreifen)',LAB.street.EDIT&&LAB.street.EDIT.includes('trees')&&/Umbau/.test(d.querySelector('.sx-tab').textContent));
  await LAB.measures.rahmen();A.rerender();await wait(20);
  const tc=d.querySelector('.lab-body .ms-c');
  ok('Kosten je 100 m als Spanne mit Quelle, Förderung mit Status, Regelwerk',/je 100 m/.test(tc.textContent)&&/€/.test(tc.querySelector('.ms-cost').textContent)&&!!tc.querySelector('.ms-fo a')&&!!tc.querySelector('.ms-no a'));
  ok('Kostenhinweis ehrlich: Spannen aus NL-Quellen, keine Rechtsberatung',/keine Utrechter Einheitspreise/.test(d.querySelector('.ms-n').textContent)&&/Keine Rechtsberatung/.test(d.querySelector('.ms-n').textContent));
  const pl2=LAB.measures.plan(),li=pl2.findIndex(m=>m.id==='light');
  ok('Helle Beläge zurückgestuft und ehrlich beschriftet (Maatlat 2025 gestrichen)',li===-1||(li>0&&/April 2025/.test(pl2[li].x)));
  LAB.street.EDIT=null;
  console.log('— Wasser (amtlich + Höhenmodell) —');
  d.querySelector('.lab-tools [data-t="water"]').click();await wait(60);
  const wl=()=>{let f=null;map.eachLayer(l=>{if(l.wmsParams)f=l;});return f;};
  ok('Wasser startet mit Starkregen (Alltagsrisiko der Stadt), 4 Modi',LAB.water.W.mode==='rain'&&d.querySelectorAll('.lab-body .lab-seg [data-m]').length===4&&/Starkregen/.test(d.querySelector('.lab-body .lab-seg').textContent));
  { // Priority-Flood: Schüssel 5 × 5, Rand 1 m, Mitte 0 m → Mulde füllt bis 1 m; Abfluss-Zelle lässt eine zweite Schüssel leerlaufen
    const w5=5,z=new Float32Array(25).fill(1);z[12]=0;z[11]=.5;const F=LAB.water.fillSinks(z,w5,5,new Uint8Array(25),new Uint8Array(25));
    const o=new Uint8Array(25);o[11]=1;const F2=LAB.water.fillSinks(z,w5,5,new Uint8Array(25),o);
    ok('Mulden: Schüssel füllt bis zum Rand (1 m tief), mit Abfluss bleibt sie leer',Math.abs(F[12]-1)<1e-6&&Math.abs(F[11]-1)<1e-6&&Math.abs(F2[12]-0.5)<1e-6,[F[12],F[11],F2[12]].map(v=>v.toFixed(2)).join());
    const wall=new Uint8Array(25);[6,7,8,11,13,16,17,18].forEach(i=>wall[i]=1);const z3=new Float32Array(25).fill(0),d3=LAB.water.sinkDepth(z3,w5,5,wall,new Uint8Array(25));
    ok('Geschlossener Innenhof: höchstens 10 cm statt Dachhöhe; offenes Gelände bleibt trocken',Math.abs(d3[12]-.1)<1e-6&&d3[0]===0&&d3[6]===0,[d3[12],d3[0]].map(v=>v.toFixed(2)).join());}
  await LAB.water.knelpunten();
  ok('Klimaknelpunte der Gemeente geladen (Schäden an Gebäuden)',LAB.water.RN.kp.length===1&&LAB.water.RN.kp[0].name==='Testbuurt'&&LAB.water.RN.kp[0].l===2);
  ok('Starkregen ehrlich: Obergrenze ohne Kanalisation',/ohne Kanalisation/.test(d.querySelector('.lab-body').textContent)||/heranzoomen|Zoome/.test(d.querySelector('.lab-body').textContent));
  d.querySelector('.lab-body [data-m="flood"]').click();await wait(40);
  ok('Amtliche LIWO-Karte als Ebene (Standard 1/1.000 pro Jahr)',wl()&&wl().wmsParams.layers==='LIWO_Basis:MaximaleWaterdiepteNederland_Kaart3',wl()&&wl().wmsParams.layers);
  ok('Fünf Wahrscheinlichkeiten von 1/10 bis 1/100.000 pro Jahr',d.querySelectorAll('.wt-cls button').length===5&&/1\/10\b/.test(d.querySelector('.wt-cls').textContent)&&/1\/100\.000/.test(d.querySelector('.wt-cls').textContent));
  ok('Amtliche Legende (Farben + Tiefen)',d.querySelectorAll('.wt-leg i').length===3&&/0,5 - 1,0 m/.test(d.querySelector('.wt-leg').textContent));
  d.querySelector('.wt-cls [data-k="5"]').click();await wait(20);
  ok('Klasse wechseln tauscht die Ebene',wl()&&wl().wmsParams.layers.endsWith('Kaart5')&&/100\.000 Jahren/.test(d.querySelector('.wt-cap').textContent));
  await A.refresh();
  ok('Amtliche Farben unverfälscht: eigene Ebene außerhalb des Basiskarten-Filters',wl().options.pane==='labWms'&&!!map.getPane('labWms'));
  ok('Legende bleibt nach dem Nachladen die Wasser-Legende',!!d.querySelector('.wt-leg')&&!/Gebäudeschatten/.test(d.querySelector('.lab-body').textContent));
  map.fire('click',{latlng:L_.latLng(C[0],C[1]),containerPoint:L_.point(500,380)});await wait(120);
  const inf=d.querySelector('.lab-info').textContent;
  ok('Antippen: Wassertiefe in allen fünf Szenarien',gfi>=5&&/trocken/.test(inf)&&/0,41 m/.test(inf)&&/1,31 m/.test(inf),inf.replace(/\s+/g,' '));
  d.querySelector('.lab-body [data-m="chance"]').click();await wait(40);
  ok('Zukunft: LIWO-Wahrscheinlichkeit heute (> 20 cm) als Ebene',wl()&&wl().wmsParams.layers==='LIWO_Basis:plaatsgebonden_kans_totaal_huidig_20',wl()&&wl().wmsParams.layers);
  d.querySelector('[data-y="2050"]').click();await wait(20);
  ok('2050 klar als Deich-Norm-Ziel beschriftet, nicht als Vorhersage',wl().wmsParams.layers.endsWith('2050_20')&&/gesetzliche Norm/.test(d.querySelector('.wt-cap').textContent)&&/keine Vorhersage/.test(d.querySelector('.wt-cap').textContent));
  ok('Legende übersetzt (5 Klassen, von groß bis extrem klein)',d.querySelectorAll('.wt-leg-c span').length===5&&/1\/300 bis 1\/30/.test(d.querySelector('.wt-leg-c').textContent));
  map.fire('click',{latlng:L_.latLng(C[0],C[1]),containerPoint:L_.point(500,380)});await wait(120);
  const ci=d.querySelector('.lab-info').textContent;
  ok('Antippen: heute / 2050 / 2100 im Vergleich',/heute/.test(ci)&&/mittel: 1\/300 bis 1\/30/.test(ci)&&(ci.match(/sehr klein/g)||[]).length===2,ci.replace(/\s+/g,' ').slice(0,150));
  ok('Klassen auf Deutsch (nicht „kleine kans")',!/kans/.test(d.querySelector('.lab-body').textContent));
  d.querySelector('.lab-body [data-m="terrain"]').click();await wait(80);for(let k=0;k<20&&!LAB.water.W.dem;k++)await wait(50);
  ok('Höhenmodell (AHN) geladen, ohne LIWO-Ebene',!!LAB.water.W.dem&&!wl()&&wcs>0);
  ok('Gedankenexperiment klar gekennzeichnet',/ohne Deiche/.test(d.querySelector('.wt-warn').textContent));
  const D0=LAB.water.W.dem;LAB.water.W.level=2;LAB.water.paint();
  ok('Wasserstand +2 m: Anteil unter dem Wasserstand korrekt (≈ 50 %)',Math.abs(LAB.water.W.below-.5)<.05,(LAB.water.W.below*100).toFixed(1)+' %');
  ok('Gebäudelücke im Gelände wird nicht als Wasser gezählt',D0.lo>=-1.01&&D0.hi<=5.01);
  console.log('— Wind (wie Ventusky) —');
  d.querySelector('.lab-tools [data-t="wind"]').click();await wait(150);
  const m=LAB.wind.mean(LAB.wind.WD.hour);
  ok('25 Modellpunkte in einem Abruf (KNMI über Open-Meteo)',om===1&&LAB.wind.WD.data.pts.length===25);
  ok('Westwind 5 m/s richtig gedeutet (aus W, Bft 3)',Math.abs(m.sp-5)<.01&&Math.round(m.dir)===270&&LAB.wind.bft(m.sp)===3,m.dir.toFixed(0)+'° '+m.sp);
  const [u,v]=LAB.wind.windAt(C[0],C[1],LAB.wind.WD.hour);
  ok('Strömungsvektor zeigt nach Osten (u > 0, v ≈ 0)',u>4.99&&Math.abs(v)<1e-9);
  ok('Anzeige: Temperatur, Wind, Böen, 36-h-Verlauf, Zeitregler',/°/.test(d.querySelector('.wd-big').textContent)&&/Bft 3/.test(d.querySelector('.wd-num').textContent)&&!!d.querySelector('.wd-tl')&&!!d.querySelector('#wdH'));
  ok('Partikel-Ebene läuft nur im Wind-Werkzeug',d.querySelector('.lab-wind')&&d.querySelector('.lab-wind').style.display==='block');
  console.log('— Fläche (Steckbrief wie aino) —');
  d.querySelector('.lab-tools [data-t="area"]').click();await wait(30);
  const AR=LAB.area.AR;AR.center=L_.latLng(C[0],C[1]);AR.r=100;await LAB.area.compute();
  const st=AR.stats;
  ok('Kreis r = 100 m ≈ 31.400 m²',Math.abs(st.Am-Math.PI*1e4)/(Math.PI*1e4)<.01,Math.round(st.Am));
  ok('Beide Gebäude erfasst, Höhen gemessen, max. 18 m',st.n===2&&st.meas===2&&st.hmax===18);
  ok('Geschossfläche geschätzt (Höhe ÷ 3,2 m)',st.gfa>0&&/Geschossfläche/.test(d.querySelector('.ar-grid').textContent));
  ok('Bäume aus dem Register im Kreis + häufigste Gattungen',st.trees>0&&st.gen.length>0,st.trees+' · '+st.gen.map(g=>g[0]).join(', '));
  ok('Einordnung nach 3-30-300 im Steckbrief',/3-30-300|30 %/.test(d.querySelector('.ar-ins').textContent));
  console.log('— Export (wie CADMapper) —');
  const E=LAB.area.exportSet(),dx=LAB.area.dxf(E,{bld:true,surf:true,trees:true}).split('\n');
  ok('Export-Satz: Gebäude, Flächen, Bäume, RD-Ursprung auf 10 m',E.blds.length===2&&E.surfs.length===4&&E.trees.length===st.trees&&E.ox%10===0&&E.oy%10===0&&E.ox>130000&&E.oy>450000,E.ox+' / '+E.oy);
  let pairs=dx.length%2===0,codes=true;for(let i=0;i<dx.length;i+=2)if(!/^-?\d+$/.test(dx[i].trim()))codes=false;
  const ent=(n)=>dx.filter((x,i)=>i%2===1&&x===n).length;
  ok('DXF: Gruppencode/Wert-Paare, Abschnitte geschlossen, EOF',pairs&&codes&&ent('SECTION')===ent('ENDSEC')&&dx[dx.length-1]==='EOF');
  ok('DXF: Polylinien mit SEQEND, 3DFACE für Wände + Dächer, Kreise für Bäume',ent('POLYLINE')===ent('SEQEND')&&ent('3DFACE')>=2*(4+2)&&ent('CIRCLE')===E.trees.length,`${ent('POLYLINE')} PL · ${ent('3DFACE')} 3DFACE · ${ent('CIRCLE')} CIRCLE`);
  ok('DXF: Gebäudehöhe als Objekthöhe (12 m und 18 m)',dx.some((x,i)=>x==='39'&&+dx[i+1]===12)&&dx.some((x,i)=>x==='39'&&+dx[i+1]===18));
  const ob=LAB.area.obj(E).split('\n'),vs=ob.filter(l=>l.startsWith('v ')).length,fi=ob.filter(l=>l.startsWith('f ')).flatMap(l=>l.slice(2).split(' ').map(Number));
  ok('OBJ: alle Flächen verweisen auf vorhandene Punkte, Höhe bis 18 m',vs===16&&fi.every(i=>i>=1&&i<=vs)&&ob.some(l=>/^v \S+ 18 /.test(l)),vs+' Punkte');
  const gj=JSON.parse(LAB.area.geojson(E,{bld:true,surf:true,trees:true}));
  ok('GeoJSON: Objekte mit Quelle, Höhe, Funktion, Albedo',gj.features.length===2+4+E.trees.length&&gj.features.some(f=>f.properties.hoehe_m===18)&&gj.features.some(f=>f.properties.funktion==='parkeervlak'&&f.properties.albedo===.25));
  const sv=LAB.area.svg(E,{bld:true,surf:true,trees:true,shadow:true});
  ok('SVG: Plan mit Maßstab, Nordpfeil, Quellen',sv.startsWith('<svg')&&sv.endsWith('</svg>')&&/>N</.test(sv)&&/3D BAG/.test(sv)&&/ m</.test(sv));
  d.querySelector('.lab-tools [data-t="export"]').click();await wait(30);
  d.querySelector('.ex-fmt [data-f="geojson"]').click();await wait(80);
  ok('Download-Knopf meldet Datei und Umfang',/\.geojson · \d+ KB/.test(d.querySelector('.ex-last').textContent),d.querySelector('.ex-last').textContent);
  console.log('— Hintergrund & OSM —');
  d.querySelector('.lab-base [data-b="photo"]').click();await wait(20);
  let photo=false;map.eachLayer(l=>{if(l._url&&/luchtfoto/.test(l._url))photo=true;});
  ok('Luftbild (PDOK) als Hintergrund',photo&&d.body.dataset.base==='photo');
  ok('„In OSM öffnen" zeigt auf denselben Ort',/openstreetmap\.org\/#map=17\/52\.090\d+\/5\.12/.test(d.querySelector('.lab-osm').href),d.querySelector('.lab-osm').href);
  ok('Tastfelder: Werkzeuge ≥ 52 px, Wahrscheinlichkeit ≥ 48 px, Export ≥ 72 px',/\.lab-tools button\{[^}]*min-height:52px/.test(page)&&/\.wt-cls button\{[^}]*min-height:48px/.test(page)&&/\.ex-fmt button\{[^}]*min-height:72px/.test(page));
  d.querySelector('.lab-tools [data-t="water"]').click();await wait(30);
  LAB.close();await wait(20);
  let left=false;map.eachLayer(l=>{if(l.wmsParams||(l._url&&/luchtfoto/.test(l._url)))left=true;});
  ok('Schließen räumt LIWO-Ebene und Luftbild weg',!left&&d.body.dataset.base==='map');
  console.log('— Direktlink —');
  const w2=mk('https://test.local/next.html?lab=52.0907,5.1214&tool=water');await wait(2500);
  ok('?lab=…&tool=water öffnet direkt das Wasser-Werkzeug',w2.LAB&&w2.LAB.on&&w2.LAB.tool==='water');
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.length,errs.slice(0,4));
  process.exit(fails||errs.length?1:0);
},3000);

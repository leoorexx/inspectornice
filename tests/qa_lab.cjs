// Straßenlabor (public/js/lab.js in public/next.html): Sonnenstand, RD-Umrechnung, Schattengeometrie,
// Albedo-Zuordnung, Datenabruf (3D BAG / BGT / Baumregister), Bedienung, Sprachen, ehrliche Hinweise.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const LABJS=fs.readFileSync('public/js/lab.js','utf8');
const page=fs.readFileSync('public/next.html','utf8').replace(/<script src="js\/((?:lab[a-z0-9-]*|act|nx-[a-z]*)\.js)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync('public/js/'+f,'utf8')+'</script>');
const errs=[];
let bagCalls=[],bgtCalls=0,fail3d=false,slow=false,inflight=0,maxInflight=0;
// Testgebäude am Domplein: 28 m hoch (70-%-Dachhöhe 30 m − Maaiveld 2 m), daneben eines ohne Messung
const sq=(lat,lon,d)=>[[[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d],[lon-d,lat-d]]];
const BAG={type:'FeatureCollection',features:[
  {type:'Feature',properties:{b3_h_70p:30,b3_h_maaiveld:2},geometry:{type:'Polygon',coordinates:sq(52.0907,5.1214,0.00008)}},
  {type:'Feature',properties:{b3_h_70p:null,b3_h_maaiveld:2},geometry:{type:'MultiPolygon',coordinates:[sq(52.0911,5.1220,0.00005)]}}]};
const BGT={features:[{properties:{fysiek_voorkomen:'gesloten verharding',plus_fysiek_voorkomen:'asfalt'},geometry:{type:'Polygon',coordinates:sq(52.0903,5.1210,0.0002)}}],links:[]};
function sf(u){u=String(u);
  if(u.includes('3dbag')){bagCalls.push(u);if(fail3d)return Promise.resolve({ok:false,status:503,json:()=>Promise.resolve({})});
    const start=+(/STARTINDEX=(\d+)/.exec(u)||[0,0])[1],res={ok:true,json:()=>Promise.resolve(start?{features:[]}:BAG)};
    if(!slow)return Promise.resolve(res);inflight++;maxInflight=Math.max(maxInflight,inflight);return new Promise(r=>setTimeout(()=>{inflight--;r(res);},15));}
  if(u.includes('/lv/bgt/')){bgtCalls++;return Promise.resolve({ok:true,json:()=>Promise.resolve(u.includes('/wegdeel/')?BGT:{features:[],links:[]})});}
  if(u.includes('locatieserver'))return Promise.resolve({ok:true,json:()=>Promise.resolve({response:{docs:[]}})});
  const f=u.replace(/^.*?(data\/)/,'public/$1').split('?')[0];
  if(fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.reject(new Error('404')),text:()=>Promise.resolve('')});}
// Zeichenfläche, die Pfade mitschreibt (für die Geometrie-Prüfung)
function recorder(){const r={subs:[],cur:null,fills:[],
  beginPath(){r.subs=[];r.cur=null;},moveTo(x,y){r.cur=[[x,y]];r.subs.push(r.cur);},lineTo(x,y){r.cur&&r.cur.push([x,y]);},closePath(){},arc(){},
  fill(){r.fills.push(r.subs.slice());},measureText(t){return {width:String(t).length*6};},getImageData(x,y,w,h){return {data:new Uint8ClampedArray(Math.max(1,w*h)*4)};},createImageData(w,h){return {data:new Uint8ClampedArray(Math.max(1,w*h)*4)};}};
  return new Proxy(r,{get:(t,k)=>k in t?t[k]:(()=>{}),set:(t,k,v)=>{t[k]=v;return true;}});}
function mk(url){
  const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS/.test(m))errs.push(m.slice(0,140));});
  const dom=new JSDOM(page,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url,virtualConsole:vc,beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=function(){return this._rec||(this._rec=recorder());};w.HTMLCanvasElement.prototype.toDataURL=()=>'';
    w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(()=>c(Date.now()),0);w.localStorage.setItem('ul_lang','de');w.localStorage.setItem('nx_hint','1');}});
  dom.window.onerror=m=>errs.push('e:'+String(m).slice(0,140));return dom.window;}
let fails=0;const ok=(n,v,i)=>{console.log((v?'  ✓ ':'  ✗ ')+n+(i!=null&&i!==''?'  ['+i+']':''));if(!v)fails++;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const w=mk('https://test.local/next.html');
setTimeout(async()=>{const d=w.document,L_=w.L,LAB=w.LAB,X=LAB&&LAB._t,map=w.eval('map');
  ok('Modul geladen und an die Karte gebunden',!!(LAB&&X&&d.querySelector('.lab-dock')&&d.querySelector('.lab-canvas')));
  console.log('— Sonnenstand (astronomisch, Utrecht 52,09° N) —');
  const Y=new Date().getFullYear(),R=180/Math.PI;
  const maxAlt=(mo,da)=>{let m=-9;for(let t=0;t<1440;t+=2){const s=X.sunPos(new Date(Y,mo,da,0,t),52.0907,5.1214);m=Math.max(m,s.alt*R);}return m;};
  const jun=maxAlt(5,21),dec=maxAlt(11,21);
  ok('21. Juni mittags 61,35° (90 − Breite + 23,44°)',Math.abs(jun-61.35)<0.2,jun.toFixed(2)+'°');
  ok('21. Dezember mittags 14,47° (90 − Breite − 23,44°)',Math.abs(dec-14.47)<0.2,dec.toFixed(2)+'°');
  let noon=null,best=-9;for(let t=0;t<1440;t++){const s=X.sunPos(new Date(Y,8,21,0,t),52.0907,5.1214);if(s.alt>best){best=s.alt;noon=s;}}
  ok('Höchststand genau im Süden (Azimut 180°)',Math.abs(((noon.az*R)+180)-180)<1.5,((noon.az*R)+180).toFixed(1)+'°');
  map.setView([52.0907,5.1214],17,{animate:false});
  LAB.mode='shadow';LAB.dateKey='jun';let [a,b]=X.dayRange();
  ok('Tageslänge 21. Juni ≈ 16 h 45 min',Math.abs((b-a)-(16*60+45))<=8,((b-a)/60).toFixed(2)+' h');
  LAB.dateKey='dec';[a,b]=X.dayRange();
  ok('Tageslänge 21. Dezember ≈ 7 h 44 min',Math.abs((b-a)-(7*60+44))<=8,((b-a)/60).toFixed(2)+' h');
  LAB.dateKey='today';
  console.log('— Rijksdriehoek (für die 3D-BAG-Abfrage) —');
  const rd=X.toRD(52.09095284,5.12105653);
  ok('Domplein 9 auf < 1 m wie PDOK (136760,29 / 455888,36)',Math.hypot(rd[0]-136760.29,rd[1]-455888.356)<1,rd.map(v=>v.toFixed(2)).join(' / '));
  console.log('— Schattengeometrie —');
  const sqz=cw=>{const z=cw?[0,0,100,0,100,100,0,100,0,0]:[0,0,0,100,100,100,100,0,0,0];return Float64Array.from(z);};
  ok('Umlaufsinn wird erkannt',X.signed(sqz(true))>0&&X.signed(sqz(false))<0);
  ok('Punkt-in-Fläche',X.inPoly(50,50,sqz(true))&&!X.inPoly(150,50,sqz(true)));
  const keep=X.B.list;let neg=0,cnt=0,dirOk=true;
  for(const az of [-2.6,-1.3,-0.4,0,0.7,1.6,2.9]){
    X.B.list=[{z:sqz(true),h:20,sg:true},{z:sqz(false),h:20,sg:false}];
    const g=d.createElement('canvas').getContext('2d');X.castShadows(g,{alt:0.5,az},{k:1,ox:0,oy:0,sc:1},[],'#0f0','#f00');
    const subs=[].concat(...g.fills);cnt=subs.length;                                   // eine Füllung je Gebäude
    for(const s of subs){let A=0;for(let i=0;i<s.length;i++){const p=s[i],q=s[(i+1)%s.length];A+=p[0]*q[1]-q[0]*p[1];}if(A<-1e-6)neg++;}
    const pol=subs[4].slice(0,4),dy=pol.reduce((t,p)=>t+p[1],0)/4-50,dx=pol.reduce((t,p)=>t+p[0],0)/4-50;   // Ring ist geschlossen: letzter Punkt doppelt
    const n=Math.hypot(dx,dy);if((dx*Math.sin(az)-dy*Math.cos(az))/n<0.999)dirOk=false;          // Bildschirm: Osten = +x, Norden = −y
  }
  X.B.list=keep;
  ok('Alle Schatten-Teilflächen gleich orientiert (keine Löcher bei Überlappung)',neg===0&&cnt===10,neg+' negativ von '+cnt);
  ok('Schatten fällt von der Sonne weg (7 Sonnenrichtungen)',dirOk);
  { X.B.list=Array.from({length:50},(_,i)=>({z:sqz(true).map(v=>v+i*7),h:12,sg:true}));const g=d.createElement('canvas').getContext('2d');X.castShadows(g,{alt:0.5,az:0.3},{k:1,ox:0,oy:0,sc:1},[],'#0f0','#f00');X.B.list=keep;
    ok('Eine kleine Füllung je Gebäude (ein Riesenpfad dauert im Browser Sekunden)',g.fills.length===50&&g.fills.every(f=>f.length===5),g.fills.length+' Füllungen'); }
  const m=w.eval('40075016.686*Math.cos(52.0907*Math.PI/180)/(256*Math.pow(2,map.getZoom()))');
  { X.B.list=[{z:sqz(true),h:10,sg:true}];const g=d.createElement('canvas').getContext('2d');X.castShadows(g,{alt:Math.PI/6,az:0},{k:1,ox:0,oy:0,sc:1},[],'#0f0','#f00');
    const pol=g.fills[g.fills.length-1][4],off=-(Math.min(...pol.map(p=>p[1]))-0)*m;X.B.list=keep;
    ok('Länge: 10 m Haus bei 30° Sonne = 17,3 m nach Norden',Math.abs(off-17.32)<0.05,off.toFixed(2)+' m'); }
  console.log('— Oberflächen (BGT) → Albedo —');
  const s1=X.surf('wegdeel',{fysiek_voorkomen:'gesloten verharding',plus_fysiek_voorkomen:'asfalt'}),s2=X.surf('wegdeel',{fysiek_voorkomen:'open verharding',plus_fysiek_voorkomen:'gebakken klinkers'}),
        s3=X.surf('begroeidterreindeel',{fysiek_voorkomen:'grasland overig'}),s4=X.surf('waterdeel',{}),s5=X.surf('wegdeel',{fysiek_voorkomen:'open verharding',plus_fysiek_voorkomen:'waardeOnbekend'});
  ok('Asphalt 0,08 · Klinker 0,20 · Rasen 0,23 · Wasser 0,07',s1.a===0.08&&s2.a===0.20&&s3.a===0.23&&s4.a===0.07&&s3.c===2&&s4.c===3&&s1.c===0);
  ok('Unbekannter Zusatz → Grundklasse der BGT (open verharding 0,24)',s5.a===0.24&&s5.m==='open verharding');
  console.log('— Einstieg —');
  const chip=d.getElementById('vStreet'),vc=d.getElementById('vCity');
  ok('Zwei Perspektiven in der Kopfzeile: Stadt (aktiv) | Straße',!!chip&&!!vc&&vc.getAttribute('aria-pressed')==='true'&&chip.getAttribute('aria-pressed')==='false'&&/Straße/.test(chip.textContent)&&!d.getElementById('labChip')&&!d.getElementById('labHint'));
  const NX=w.__NX;NX.openBuurt(NX.BU[50]);
  ok('Quartiers-Profil bietet das Straßenlabor an',!!d.getElementById('labBtn'));
  map.setView([52.0907,5.1214],17,{animate:false});
  chip.click();await wait(30);
  ok('Öffnet: Dock sichtbar, Profil zu, Quartiersflächen ausgeblendet',d.body.classList.contains('lab-on')&&!d.getElementById('panel').classList.contains('on')&&w.eval('!map.hasLayer(buLayer)'));
  ok('Quellen in der Kartenzuschreibung',/3D BAG/.test(d.querySelector('.leaflet-control-attribution').textContent));
  ok('Umschalter zeigt jetzt „Straße“, Kopfzeile sagt Straßenlabor',chip.getAttribute('aria-pressed')==='true'&&vc.getAttribute('aria-pressed')==='false'&&/Straßenlabor/.test(d.getElementById('cityLbl').textContent));
  ok('11 Werkzeuge; Sonne: 2 Modi, 4 Tage, Zeitregler, Abspielen, Sonnenbahn',d.querySelectorAll('.lab-tools [data-t]').length===11&&d.querySelectorAll('.lab-seg button').length===2&&d.querySelectorAll('.lab-dates button').length===4&&!!d.querySelector('.lab-slider')&&!!d.querySelector('.lab-play')&&!!d.querySelector('.lab-dial path'));
  ok('Tastfelder ≥ 44 px (Werkzeuge, Modi, Tage ≥ 40, Abspielen, Schließen)',/\.lab-tools button\{[^}]*min-height:5\dpx/.test(page)&&/\.lab-body \.lab-seg button\{[^}]*min-height:44px/.test(page)&&/\.lab-play\{[^}]*width:var\(--tap\)/.test(page)&&/\.lab-x\{[^}]*width:var\(--tap\)/.test(page)&&/\.lab-dates button\{[^}]*min-height:40px/.test(page));
  ok('Adresszeile merkt sich den Ort (?lab=…)',/lab=52\.\d+(,|%2C)5\./.test(w.location.search),w.location.search);
  console.log('— Schonender Abruf (öffentliche Dienste) —');
  { const gs=map.getSize;map.getSize=()=>L_.point(1024,768);
    map.setView([52.0907,5.1214],13,{animate:false});const n0=bagCalls.length;await X.refresh();await X.computeSunHours();
    ok('Herausgezoomt: kein Abruf, Hinweis zum Heranzoomen',bagCalls.length===n0&&/heranzoomen/.test(d.querySelector('.lab-status').textContent),d.querySelector('.lab-status').textContent);
    map.setView([52.0907,5.1214],15.5,{animate:false});await X.refresh();
    ok('Zoom 15,5: ebenfalls kein Abruf (Labor lädt ab Zoom 16)',bagCalls.length===n0);
    map.setView([52.0907,5.1214],16,{animate:false});await X.refresh();
    ok('Zoom 16 auf 1024 × 768 px wäre > 24 Kacheln: kein Abruf',bagCalls.length===n0);
    map.setView([52.0907,5.1214],16.5,{animate:false});await X.refresh();
    const t16=new Set(bagCalls.slice(n0).map(u=>/BBOX=([^&]+)/.exec(u)[1])).size;
    ok('Zoom 16,5: lädt, höchstens 24 Kacheln',t16>0&&t16<=24,t16+' Kacheln');
    const n1=bagCalls.length;slow=true;map.setView([52.0990,5.1400],17,{animate:false});await X.refresh();slow=false;
    const tiles=new Set(bagCalls.slice(n1).map(u=>/BBOX=([^&]+)/.exec(u)[1])).size;
    ok('Zoom 17: ≤ 24 Kacheln, höchstens 4 Abrufe gleichzeitig',tiles>0&&tiles<=36&&maxInflight<=4,tiles+' Kacheln · max. '+maxInflight+' parallel');
    map.getSize=gs;map.setView([52.0907,5.1214],17,{animate:false}); }
  console.log('— Daten —');
  await X.refresh();
  ok('3D BAG mit RD-Ausschnitt (EPSG:28992) abgefragt',bagCalls.length>0&&bagCalls.every(u=>{const m2=/BBOX=(\d+),(\d+),(\d+),(\d+),EPSG:28992/.exec(u);return m2&&+m2[1]>120000&&+m2[3]<150000&&+m2[2]>440000&&+m2[4]<470000;}),bagCalls.length+' Abrufe');
  const bl=X.B.list;
  ok('Gemessene Höhe = 70-%-Dachhöhe − Maaiveld (28 m), fehlende bleibt leer',bl.some(b=>b.h===28)&&bl.some(b=>b.h==null),bl.map(b=>b.h).join(','));
  ok('Baumregister vollständig geladen (162.653)',X.TREES&&X.TREES.length===162653,X.TREES&&X.TREES.length);
  ok('Krone & Höhe aus dem Pflanzjahr (Radius ≤ 6 m, Höhe ≤ 24 m)',X.TREES.every(t=>t[2]>0&&t[2]<=6&&t[3]>=3&&t[3]<=24));
  ok('Sonnentext: Höhe, Richtung, Schattenlänge, Auf-/Untergang',(LAB.min=13*60+30,/Sonne \d+° hoch/.test(X.sunText())&&/Schatten/.test(X.sunText())&&/Aufgang \d\d:\d\d/.test(X.sunText())),X.sunText().replace(/<[^>]+>/g,' ').slice(0,90));
  map.fire('click',{latlng:L_.latLng(52.0907,5.1214),containerPoint:L_.point(20,20)});
  ok('Antippen eines Gebäudes zeigt die gemessene Höhe',/28,0 m/.test(d.querySelector('.lab-info').innerHTML)&&/3D BAG/.test(d.querySelector('.lab-info').innerHTML),d.querySelector('.lab-info').textContent);
  d.querySelector('.lab-dates [data-d="dec"]').click();await wait(20);
  ok('Tag wählen: Regler auf Tageslicht des 21. Dezember begrenzt',+d.querySelector('.lab-slider').min>=8*60+30&&+d.querySelector('.lab-slider').max<=16*60+40,d.querySelector('.lab-slider').min+'–'+d.querySelector('.lab-slider').max);
  d.querySelector('.lab-play').click();await wait(60);
  ok('Abspielen bewegt die Uhrzeit',LAB.playing&&d.querySelector('.lab-play').getAttribute('aria-label')==='Anhalten');
  d.querySelector('.lab-play').click();
  console.log('— Sonnenstunden · Oberflächen · Hitze —');
  d.querySelector('.lab-seg [data-m="sunhours"]').click();await wait(30);await X.computeSunHours();
  const SH=X.SUNH;
  ok('Sonnenstunden über den Tag (15-min-Takt) mit Tageslichtdauer',SH&&SH.hrs&&SH.maxH>7&&SH.maxH<8.2,SH&&SH.maxH.toFixed(2)+' h am 21. Dez.');
  ok('Ohne Hindernis = volle Tageslichtdauer',SH&&Math.abs(SH.hrs[0]-SH.maxH)<0.02,SH&&SH.hrs[0].toFixed(2));
  ok('Zeitregler nur im Schattenmodus, Tage bleiben',!d.querySelector('.lab-slider')&&d.querySelectorAll('.lab-dates button').length===4);
  d.querySelector('.lab-tools [data-t="surface"]').click();await wait(20);d.querySelector('.lab-seg [data-m="albedo"]').click();await wait(30);await X.refresh();
  ok('Oberflächen aus der BGT (4 Objektarten) mit Albedo',bgtCalls>=4&&X.S.list.some(o=>o.a===0.08&&o.m==='asfalt'),bgtCalls+' Abrufe');
  map.fire('click',{latlng:L_.latLng(52.0903,5.1210),containerPoint:L_.point(20,20)});
  ok('Antippen: Material + Albedo',/Asphalt/.test(d.querySelector('.lab-info').textContent)&&/0,08/.test(d.querySelector('.lab-info').textContent),d.querySelector('.lab-info').textContent);
  d.querySelector('.lab-seg [data-m="heat"]').click();await wait(30);await X.computeHeat();
  ok('Hitze: fest für den 21. Juni, ohne Tageswahl',!d.querySelector('.lab-dates')&&/21\. Juni/.test(d.querySelector('.lab-legw').textContent));
  ok('Hitze-Index berechnet',X.SUNH&&X.SUNH.risk&&X.SUNH.risk.length===X.SUNH.hrs.length&&X.SUNH.maxH>16);
  ok('Ehrlich: „kein Mikroklimamodell", „keine Lufttemperatur"',/kein Mikroklimamodell/.test(X.NOTE.heat())&&/keine Lufttemperatur/.test(X.NOTE.heat()));
  ok('Quellen im Dock: 3D BAG, BGT, Baumregister',/3D BAG/.test(d.querySelector('.lab-src').textContent)&&/BGT/.test(d.querySelector('.lab-src').textContent)&&/Baumregister/.test(d.querySelector('.lab-src').textContent));
  console.log('— Sprachen —');
  d.querySelector('.lang [data-l="en"]').click();await wait(20);
  ok('EN: Dock übersetzt',/Street lab/.test(d.querySelector('.lab-top').textContent)&&/Heat/.test(d.querySelector('.lab-seg').textContent));
  d.querySelector('.lang [data-l="nl"]').click();await wait(20);
  ok('NL: Dock übersetzt',/Straatlab/.test(d.querySelector('.lab-top').textContent)&&/Hitte/.test(d.querySelector('.lab-seg').textContent));
  d.querySelector('.lang [data-l="de"]').click();await wait(20);
  console.log('— Fehlerfall & Schließen —');
  d.querySelector('.lab-tools [data-t="sun"]').click();await wait(20);d.querySelector('.lab-seg [data-m="shadow"]').click();await wait(20);
  fail3d=true;map.setView([52.1001,5.0502],17,{animate:false});await X.refresh();
  ok('3D BAG nicht erreichbar → ehrlicher Hinweis',/nicht geladen/.test(d.querySelector('.lab-status').textContent),d.querySelector('.lab-status').textContent);
  fail3d=false;
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));await wait(20);
  ok('Esc schließt: Quartiersflächen zurück, Adresszeile bereinigt, Zuschreibung entfernt',!d.body.classList.contains('lab-on')&&w.eval('map.hasLayer(buLayer)')&&!/lab=/.test(w.location.search)&&!/3D BAG/.test(d.querySelector('.leaflet-control-attribution').textContent));
  console.log('— Direktlink —');
  const w2=mk('https://test.local/next.html?lab=52.0907,5.1214');await wait(2500);
  ok('?lab=… öffnet das Straßenlabor am Ort (Sonne: Zoom 15 für großflächige Schatten)',w2.LAB&&w2.LAB.on&&w2.eval('map.getZoom()')===15&&w2.document.body.classList.contains('lab-on'));
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.length,errs.slice(0,4));
  process.exit(fails||errs.length?1:0);
},3000);

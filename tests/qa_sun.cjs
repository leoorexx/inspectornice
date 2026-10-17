// Besonnungsrechnung: prüft die Astronomie gegen bekannte Sollwerte, dann die Verschattung.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('ul_lang','en');w.localStorage.setItem('nh_city','utr');}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,110));
let fails=0;const ok=(n,v,info)=>{console.log((v?'  ✓ ':'  ✗ ')+n+(info?'  ['+info+']':''));if(!v)fails++;};
const LAT=52.0907,LON=5.1214,DEG=180/Math.PI;
setTimeout(async()=>{const w=window;
  // ── 1 · Astronomie gegen Lehrbuchwerte ──
  // Sonnenhöhe im Meridiandurchgang = 90° − Breite ± Deklination (23,44°)
  console.log('— Sonnenstand (Sollwerte aus der Astronomie) —');
  const maxAlt=(y,mo,da)=>{let m=-99;for(let t=0;t<1440;t+=2){const sp=w.sunPosition(new Date(Date.UTC(y,mo-1,da,0,t,0)),LAT,LON);if(sp.alt*DEG>m)m=sp.alt*DEG;}return m;};
  const jun=maxAlt(2026,6,21), dec=maxAlt(2026,12,21), mar=maxAlt(2026,3,20);
  ok('21.06. Mittagshöhe ≈ 61,3°',Math.abs(jun-61.35)<0.6,jun.toFixed(2)+'°');
  ok('21.12. Mittagshöhe ≈ 14,5°',Math.abs(dec-14.47)<0.6,dec.toFixed(2)+'°');
  ok('Tagundnachtgleiche ≈ 37,9°',Math.abs(mar-37.91)<0.8,mar.toFixed(2)+'°');
  // Tageslänge: amtlicher Sonnenauf-/untergang zählt ab −0,833° (Refraktion + Sonnenradius)
  const dayLen=(y,mo,da,thr)=>{let n=0;for(let t=0;t<1440;t+=2){if(w.sunPosition(new Date(Date.UTC(y,mo-1,da,0,t,0)),LAT,LON).alt*DEG>thr)n+=2;}return n/60;};
  const offJun=dayLen(2026,6,21,-0.833), offDec=dayLen(2026,12,21,-0.833);
  ok('Tageslänge 21.06. amtlich ≈ 16,73 h',Math.abs(offJun-16.73)<0.15,offJun.toFixed(2)+' h');
  ok('Tageslänge 21.12. amtlich ≈ 7,73 h',Math.abs(offDec-7.73)<0.15,offDec.toFixed(2)+' h');
  const dJun=dayLen(2026,6,21,0), dDec=dayLen(2026,12,21,0);
  ok('Sonne über 0° kürzer als amtlich',dJun<offJun&&dDec<offDec,dJun.toFixed(2)+' h / '+dDec.toFixed(2)+' h');
  // Azimut: mittags steht die Sonne im Süden (Kompass ≈ 180°)
  let best=-99,bestAz=0;
  for(let t=0;t<1440;t+=2){const sp=w.sunPosition(new Date(Date.UTC(2026,5,21,0,t,0)),LAT,LON);if(sp.alt>best){best=sp.alt;bestAz=((sp.az+Math.PI)*DEG+360)%360;}}
  ok('Höchststand im Süden (≈180°)',Math.abs(bestAz-180)<3,bestAz.toFixed(1)+'°');

  // ── 2 · Verschattung mit echten Gebäudedaten ──
  console.log('— Verschattung (echte BAG-Gebäude) —');
  const loaded=await w.planLoad();
  ok('Gebäude geladen + Maximalhöhe',loaded===true&&w.eval('PLAN.data.length')>50000&&w.eval('PLAN.maxh')>20,w.eval('PLAN.data.length')+' Geb., max '+w.eval('PLAN.maxh')+' m');
  // freies Feld weit außerhalb → Horizont leer, Besonnung = Tageslänge
  const horFree=w.sunHorizon(52.30,5.40);
  const freeMax=Math.max(...Array.from(horFree));
  ok('Freies Feld: kein Horizont-Hindernis',freeMax===0);
  const freeJun=w.sunHoursOn(52.30,5.40,2026,6,21,horFree);
  ok('Freies Feld 21.06. ≈ Tageslänge',Math.abs(freeJun-dJun)<0.5,freeJun.toFixed(1)+' h vs '+dJun.toFixed(1)+' h');
  // Innenstadt (Neude) → Horizont vorhanden, weniger Sonne
  const horCity=w.sunHorizon(LAT,LON);
  const cityMax=Math.max(...Array.from(horCity))*DEG;
  ok('Innenstadt: Bebauung im Horizont',cityMax>5,'höchstes Hindernis '+cityMax.toFixed(1)+'°');
  const cJun=w.sunHoursOn(LAT,LON,2026,6,21,horCity), cDec=w.sunHoursOn(LAT,LON,2026,12,21,horCity);
  ok('Innenstadt ≤ freies Feld',cJun<=freeJun+0.001,cJun.toFixed(1)+' h');
  ok('Winter < Sommer',cDec<cJun,cDec.toFixed(1)+' h (Dez) < '+cJun.toFixed(1)+' h (Jun)');
  ok('Werte plausibel (0…Tageslänge)',cJun>=0&&cJun<=dJun&&cDec>=0&&cDec<=dDec);
  // Süd-Hindernis muss stärker verschatten als Nord-Hindernis
  // Breite Wand (≈70 m) in 12 m Abstand — verdeckt ~140° Himmel, wie eine echte Blockrandbebauung
  const mk=(brgDeg,h)=>{const b=brgDeg*Math.PI/180,d=12;const dLat=(Math.cos(b)*d)/111320,dLon=(Math.sin(b)*d)/(111320*Math.cos(LAT*Math.PI/180));
    const la=LAT+dLat,lo=LON+dLon,eLon=0.0005,eLat=0.00005;
    return {g:[[lo-eLon,la-eLat],[lo+eLon,la-eLat],[lo+eLon,la+eLat],[lo-eLon,la+eLat],[lo-eLon,la-eLat]],h};};
  w.eval('window.__save={d:PLAN.data,g:PLAN.grid,m:PLAN.maxh}');
  const testOne=(bldg)=>{
    w.eval('(function(b){const C=0.004;PLAN.data=[b];const G=new Map();const p=b.g[0];'+
           'G.set(Math.round(p[0]/C)+"_"+Math.round(p[1]/C),[0]);PLAN.grid=G;PLAN.maxh=b.h;})('+JSON.stringify(bldg)+')');
    const hor=w.sunHorizon(LAT,LON);return w.sunHoursOn(LAT,LON,2026,3,21,hor);};
  const southBlock=testOne(mk(180,30)), northBlock=testOne(mk(0,30));
  ok('Wand im Süden verschattet stark',southBlock<4.0,southBlock.toFixed(1)+' h am 21.03.');
  ok('Wand im Norden verschattet kaum',northBlock>10,northBlock.toFixed(1)+' h am 21.03.');
  ok('Süd deutlich schlechter als Nord',northBlock-southBlock>6,(northBlock-southBlock).toFixed(1)+' h Unterschied');
  w.eval('PLAN.data=window.__save.d;PLAN.grid=window.__save.g;PLAN.maxh=window.__save.m');

  // ── 3 · Panel + Norm + PDF ──
  console.log('— Panel, Norm, PDF —');
  w.toggleLoc();
  w.eval('LOC.pt={lat:'+LAT+',lon:'+LON+'};LOC.cats=[{k:"gastro",de:"G",en:"G",nl:"G",r:300,goal:[8,3],n:5,near:40,names:[],st:"ok",ds:[40,90]}];LOC.env=null;LOC.sun=null;');
  w.renderLocPanel();
  ok('Knopf vor Berechnung da',!!w.document.getElementById('sunBtn'));
  const hor2=w.sunHorizon(LAT,LON);
  w.eval('LOC.sun={y:2026,rows:'+JSON.stringify(w.eval('SUN_DATES').map(([mo,da,lbl])=>({lbl,h:+w.sunHoursOn(LAT,LON,2026,mo,da,hor2).toFixed(1)})))+'}');
  w.renderLocPanel();
  const pt=w.document.getElementById('locPanel').textContent;
  ok('5 Stichtage im Panel',(pt.match(/\d\d\.\d\d\./g)||[]).length>=5);
  ok('TNO-Norm geprüft (Utrecht)',/TNO light/.test(pt)&&/TNO strict/.test(pt));
  ok('Näherung ehrlich benannt',/Approximation|storey counts/.test(pt)&&/Not a substitute/.test(pt));
  const nm=w.sunNorm();
  ok('Normwerte korrekt (2 h / 3 h)',nm.length===2&&nm[0].req===2&&nm[1].req===3&&nm[0].d==='19.02.');
  // PDF
  w.eval(`(function(){var o=window.pdfDoc;window.__cap=[];window.pdfDoc=function(){var d2=o.apply(this,arguments);if(d2){var ot=d2.text.bind(d2);d2.text=function(t){window.__cap.push(Array.isArray(t)?t.join(' '):String(t));return ot.apply(null,arguments);};d2.save=function(n){window.__saved=String(n);};}return d2;};})()`);
  w.locPDF();
  const cap=w.eval('window.__cap')||[];
  ok('PDF: Besonnungs-Abschnitt',cap.some(x=>/Sun exposure/.test(x)));
  ok('PDF: Norm-Spalte',cap.some(x=>/TNO/.test(x)));
  ok('PDF: Quelle Gebäudehöhen',cap.some(x=>/building heights/.test(x)));
  ok('PDF: Näherung benannt',cap.some(x=>/Not a substitute for a certified/.test(x)));
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.filter(e=>!/getContext/.test(e)).length,errs.slice(0,2));
  process.exit(fails?1:0);
},3200);

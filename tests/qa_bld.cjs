const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);if(!w.URL)w.URL={};w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('ul_lang','en');w.localStorage.setItem('nh_city','utr');}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,110));
let fails=0;const ok=(n,v,i)=>{console.log((v?'  ✓ ':'  ✗ ')+n+(i?'  ['+i+']':''));if(!v)fails++;};
setTimeout(async()=>{const w=window,d=w.document;
  console.log('— Gebäude-Steckbrief —');
  await w.planLoad();
  ok('Gebäudedaten da',w.eval('PLAN.data.length')>50000);
  // Flächenformel gegen bekanntes Rechteck prüfen
  const la=52.09, e=0.0005, n=0.0002;
  const ring=[[5.12-e,la-n],[5.12+e,la-n],[5.12+e,la+n],[5.12-e,la+n],[5.12-e,la-n]];
  const soll=(2*e*111320*Math.cos(la*Math.PI/180))*(2*n*111320);
  const ist=w.ringAreaM2(ring,la);
  ok('Flächenformel korrekt',Math.abs(ist-soll)/soll<0.01,Math.round(ist)+' m² vs '+Math.round(soll)+' m²');
  // ein reales Gebäude mit Daten öffnen
  const idx=w.eval('PLAN.data.findIndex(b=>b.co2!=null&&b.lst!=null&&b.era&&b.h>5)');
  ok('Gebäude mit vollen Daten gefunden',idx>=0);
  w.bldOpen(idx);
  const p=d.getElementById('bldPanel');
  ok('Panel offen',p.classList.contains('open'));
  const t=p.textContent;
  ok('Kennwerte gezeigt',/Height/.test(t)&&/Footprint/.test(t)&&/Volume/.test(t));
  ok('Klimadaten gezeigt',/Surface temperature/.test(t)&&/Flood exposure/.test(t)&&/CO₂ intensity/.test(t));
  ok('Umriss hervorgehoben',!!w.eval('BLD.hl'));
  ok('Grundfläche plausibel (10–5000 m²)',w.eval('BLD.cur.area')>10&&w.eval('BLD.cur.area')<5000,Math.round(w.eval('BLD.cur.area'))+' m²');
  ok('Geschosse aus Höhe',w.eval('BLD.cur.levels')>=1&&w.eval('BLD.cur.levels')===Math.max(1,Math.round(w.eval('BLD.cur.b.h')/3.1)));
  ok('Ehrlichkeit: modelliert/abgeleitet benannt',/modelled/.test(t)&&/derived from storey/.test(t)&&/not a building simulation/i.test(t));
  // Solar
  ok('Solar-Knopf vor Berechnung',/Calculate solar potential/.test(t));
  w.bldSolarCalc();
  const s=w.eval('BLD.cur.solar');
  const t2=p.textContent;
  ok('Solarwerte berechnet',s&&s.kwp>0&&s.factor>=0&&s.factor<=1,'kWp '+s.kwp.toFixed(1)+' · Faktor '+Math.round(s.factor*100)+'%');
  ok('Ertrag = kWp × 950 × Faktor',Math.abs(s.kwh-(s.kwp*950*s.factor))<0.01);
  ok('Ertrag im Panel',/Yield \(estimate\)/.test(t2)&&/kWh\/a/.test(t2));
  ok('Solar-Annahmen offengelegt',/Envelope estimate/.test(t2)&&/not a yield assessment/.test(t2));
  // PDF
  w.eval(`(function(){var o=window.pdfDoc;window.__cap=[];window.pdfDoc=function(){var d2=o.apply(this,arguments);if(d2){var ot=d2.text.bind(d2);d2.text=function(t){window.__cap.push(Array.isArray(t)?t.join(' '):String(t));return ot.apply(null,arguments);};d2.save=function(n){window.__saved=String(n);};}return d2;};})()`);
  w.bldPDF();
  const cap=w.eval('window.__cap')||[];
  ok('PDF erzeugt',cap.length>15);
  ok('PDF: Baukörper + Klima + Solar',cap.some(x=>/Building body/.test(x))&&cap.some(x=>/Climate & risk/.test(x))&&cap.some(x=>/Solar potential/.test(x)));
  ok('PDF: Methode ehrlich',cap.some(x=>/not a substitute for building, daylight or yield/.test(x)));
  ok('PDF-Dateiname',/gebaeude_/.test(w.eval('window.__saved')||''));
  // Schließen
  w.closeBld();
  ok('Schließen räumt auf',!p.classList.contains('open')&&!w.eval('BLD.hl')&&!w.eval('BLD.cur'));
  // kein neuer Dock-Knopf (Übersicht bewahren)
  ok('Steckbrief hat keinen eigenen Dock-Knopf',![...d.querySelectorAll('.tool-btn')].some(b=>/bld/i.test(b.getAttribute('onclick')||'')),d.querySelectorAll('.tool-btn').length+' Knöpfe unverändert');
  // Dach-Besonnung muss besser sein als Straßenniveau (Module liegen oben)
  const C2=w.eval('PLAN.data['+idx+']');
  const cen=w.eval('(function(){const b=PLAN.data['+idx+'];const c=geoCentroid([b.g]);return {lat:c[1],lon:c[0],h:b.h};})()');
  const hGround=w.sunHorizon(cen.lat,cen.lon,0), hRoof=w.sunHorizon(cen.lat,cen.lon,cen.h);
  const mx=a=>Math.max(...Array.from(a))*180/Math.PI;
  ok('Horizont auf Dachhöhe niedriger als am Boden',mx(hRoof)<=mx(hGround),'Dach '+mx(hRoof).toFixed(1)+'° vs Boden '+mx(hGround).toFixed(1)+'°');
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.filter(e=>!/getContext/.test(e)).length,errs.slice(0,2));
  process.exit(fails?1:0);
},3200);

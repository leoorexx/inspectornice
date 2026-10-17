const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);if(!w.URL)w.URL={};w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(async()=>{const w=window,d=w.document;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  console.log('Stadt:',w.eval('city'));
  // Flow 1: öffnen → Launcher → Mission wählen
  w.toggleMission();
  const launcher=/mcard|Woran arbeiten|What are you working/.test(d.getElementById('msBody').innerHTML);
  console.log('Panel offen:',d.getElementById('missionPanel').classList.contains('open'),'| Button on:',d.getElementById('tool-mission').classList.contains('on'),'| Launcher:',launcher);
  w.chooseMission('schools');
  await new Promise(r=>setTimeout(r,2500));
  const S=w.eval('MISSION.schools');
  console.log('\n— Priorisierung —');
  console.log('Schulen analysiert:',S.length);
  if(!S.length){console.log('❌ keine Schulen');process.exit(1);}
  const sorted=S.every((s,i)=>i===0||S[i-1].prio>=s.prio);
  console.log('Top 3:',S.slice(0,3).map(s=>s.name.slice(0,22)+'('+s.prio+')').join(', '));
  console.log('sortiert:',sorted,'| Komponenten da:',!!S[0].c&&S[0].c.heat!=null,'| LST echt:',S.filter(s=>s.lst!=null).length+'/'+S.length,'| Wijk-Sozial:',S.filter(s=>s.soc!=null).length+'/'+S.length);
  const body=d.getElementById('msBody').innerHTML;
  console.log('Liste gerendert:',/ms-item/.test(body),'| Budget-Sim:',/Budget-Simulator|Budget simulator/.test(body),'| Marker-Layer:',!!w.eval('MISSION.layer'));
  // Flow 2: Budget ändern
  w.eval('MISSION.budget=10');w.renderMission();
  const {pick,sum}=w.missionBudgetCalc();
  console.log('\n— Budget 10 Mio → Schulen:',pick.length,'| Summe:',(sum/1e6).toFixed(1),'Mio (unter Budget:',sum<=10e6,')');
  // Flow 3: Challenge Case
  w.missionCase(0);
  const cb=d.getElementById('msBody').innerHTML;
  const caseIdOk=/UTR-SCH-001|FFM-SCH-001/.test(cb), whyOk=/Warum relevant|Why relevant/.test(cb), metricsOk=/Betroffene|Affected/.test(cb), briefBtn=/caseBrief\('schools'/.test(cb), navOk=/backToMissions/.test(cb);
  console.log('\n— Challenge Case —');
  console.log('Case:',/Urban Challenge Case/.test(cb),'| Case-ID:',caseIdOk,'| Warum:',whyOk,'| Kennzahlen:',metricsOk,'| Brief-Btn:',briefBtn,'| Missionen-Nav:',navOk,'| Pakete:',/Maßnahmenpakete|Action packages/.test(cb),'| empfohlen:',/empfohlen|recommended/.test(cb));
  // Flow 4: PDF (Spy) — Missions-Bericht + Entscheidungs-Brief
  w.eval(`(function(){var o=window.pdfDoc;window.__cap=[];window.pdfDoc=function(){var d2=o.apply(this,arguments);if(d2){var ot=d2.text.bind(d2);d2.text=function(t){window.__cap.push(Array.isArray(t)?t.join(' '):String(t));return ot.apply(null,arguments);};d2.save=function(n){window.__saved=1;window.__savedN=String(n);};}return d2;};})()`);
  w.missionPDF();
  const cap=w.eval('window.__cap')||[];
  w.eval('window.__cap=[];window.__brief=0;'); w.caseBrief('schools',0);
  const bcap=w.eval('window.__cap')||[]; const briefName=w.eval('window.__savedN');
  console.log('\n— PDF —  Bericht-Zeilen:',cap.length,'| Top10:',cap.some(t=>/Top 10/.test(t)),'| Methode:',cap.some(t=>/Copernicus/.test(t)));
  console.log('— Brief —  Zeilen:',bcap.length,'| Empfehlung:',bcap.some(t=>/Empfehlung|Recommendation/.test(t)),'| Betroffene:',bcap.some(t=>/Betroffene|Affected/.test(t)),'| Datei:',/brief_UTR-SCH-001|brief_FFM-SCH-001/.test(briefName||''));
  // Flow 5: schließen + Stadtwechsel-Reset
  w.closeMission();
  console.log('\ngeschlossen:',!d.getElementById('missionPanel').classList.contains('open'),'| Layer weg:',!w.eval('MISSION.layer'));
  console.log('\nCHECKS: >80 Schulen:',S.length>80,'| sortiert:',sorted,'| Case ok:',/Urban Challenge Case/.test(cb),'| Case-ID:',caseIdOk,'| Brief-Btn:',briefBtn,'| PDF ok:',cap.length>15,'| Brief ok:',bcap.length>12,'| Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},3000);

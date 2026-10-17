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
  // Flow 1: Mission öffnen (Schulen) → auf Straßen umschalten
  w.toggleMission();
  await new Promise(r=>setTimeout(r,2200));
  const launcher=/mcard|Woran arbeiten|What are you working/.test(d.getElementById('msBody').innerHTML);
  console.log('Launcher da (Missionsauswahl):',launcher);
  w.chooseMission('streets');
  await new Promise(r=>setTimeout(r,2800));
  const S=w.eval('MISSION.streets');
  console.log('\n— Priorisierung —');
  console.log('Straßen bewertet:',S.length,'| Segmente:',S.reduce((a,s)=>a+s.n,0));
  if(!S.length){console.log('❌ keine Straßen');process.exit(1);}
  const sorted=S.every((s,i)=>i===0||S[i-1].prio>=s.prio);
  console.log('Top 3:',S.slice(0,3).map(s=>s.name.slice(0,24)+'('+s.prio+')').join(', '));
  console.log('sortiert:',sorted,'| Komponenten da:',!!S[0].c&&S[0].c.shade!=null,'| LST echt:',S.filter(s=>s.lst!=null).length+'/'+S.length,'| Wijk-Sozial:',S.filter(s=>s.soc!=null).length+'/'+S.length,'| Faktor 1–6:',S.every(s=>s.factor>=1&&s.factor<=6));
  const body=d.getElementById('msBody').innerHTML;
  console.log('Liste gerendert:',/ms-item/.test(body),'| Budget-Sim:',/Budget-Simulator|Budget simulator/.test(body),'| Layer:',!!w.eval('MISSION.layer'),'| Missionen-Nav:',/backToMissions/.test(body));
  // Flow 2: Budget ändern
  w.eval('MISSION.budgetT=15');w.renderStreets();
  const {pick,sum}=w.stBudgetCalc();
  console.log('\n— Budget 15 Mio → Straßen:',pick.length,'| Summe:',(sum/1e6).toFixed(1),'Mio (unter Budget:',sum<=15e6,')');
  // Flow 3: Challenge Case
  w.streetCase(0);
  const cb=d.getElementById('msBody').innerHTML;
  console.log('\n— Challenge Case —');
  console.log('Case:',/Urban Challenge Case/.test(cb),'| Pakete:',/Maßnahmenpakete|Action packages/.test(cb),'| empfohlen:',/empfohlen|recommended/.test(cb),'| Vorher/Nachher:',/Vorher|Before/.test(cb),'| Konfidenz:',/Konfidenz|Confidence/.test(cb),'| Phase 2 ehrlich:',/[Pp]hase 2|fase 2/.test(cb));
  // Zurück → Straßen-Liste (renderMission muss branchen)
  w.renderMission();
  const back=/Budget-Simulator|Budget simulator/.test(d.getElementById('msBody').innerHTML)&&/streetCase/.test(d.getElementById('msBody').innerHTML);
  console.log('Zurück-Branch (renderMission→Straßen):',back);
  // Flow 4: PDF (Spy)
  w.eval(`(function(){var o=window.pdfDoc;window.__cap=[];window.pdfDoc=function(){var d2=o.apply(this,arguments);if(d2){var ot=d2.text.bind(d2);d2.text=function(t){window.__cap.push(Array.isArray(t)?t.join(' '):String(t));return ot.apply(null,arguments);};d2.save=function(n){window.__saved=String(n);};}return d2;};})()`);
  w.streetsPDF();
  const cap=w.eval('window.__cap')||[];
  console.log('\n— PDF —  Zeilen:',cap.length,'| Datei:',w.eval('window.__saved'),'| Top10:',cap.some(t=>/Top 10/.test(t)),'| Methode:',cap.some(t=>/Copernicus/.test(t)));
  // Flow 5: zurück zu Schulen + schließen
  w.setMissionKind('schools');
  await new Promise(r=>setTimeout(r,300));
  const backS=w.eval('MISSION.kind')==='schools'&&w.eval('MISSION.schools').length>0;
  console.log('\nzurück zu Schulen (Cache):',backS);
  w.closeMission();
  console.log('geschlossen:',!d.getElementById('missionPanel').classList.contains('open'),'| Layer weg:',!w.eval('MISSION.layer'));
  console.log('\nCHECKS: >80 Straßen:',S.length>80,'| sortiert:',sorted,'| Case ok:',/Urban Challenge Case/.test(cb),'| Zurück ok:',back,'| PDF ok:',cap.length>15,'| Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
  process.exit(0);
},3000);

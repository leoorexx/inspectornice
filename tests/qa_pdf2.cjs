const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,140));});
function sf(u){u=String(u);if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{}})});let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/layers/'))f='public/data/layers/'+u.split('/_d/data/layers/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){
  w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);
  if(!w.URL)w.URL={};w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,140));
setTimeout(()=>{const w=window;
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  w.eval("lang='de'");
  if(w.eval('typeof (window.jspdf&&window.jspdf.jsPDF)')!=='function'){console.log('jsPDF NICHT geladen — Test übersprungen');process.exit(0);}
  // pdfDoc() wrappen: jede erzeugte Doc-Instanz spiegelt text()/save() mit (text ist instanz-gebunden, nicht auf dem Prototyp)
  w.eval(`(function(){var orig=window.pdfDoc;window.__cap=[];window.__saved=0;window.pdfDoc=function(){var d=orig.apply(this,arguments);if(d){var ot=d.text.bind(d);d.text=function(t){try{window.__cap.push(Array.isArray(t)?t.join(' '):String(t));}catch(e){}return ot.apply(null,arguments);};var os=d.save.bind(d);d.save=function(){window.__saved++;return os.apply(null,arguments);};}return d;};})()`);
  const has=(arr,s)=>arr.some(t=>t.includes(s));
  // ---- districtPDF (Stadtteil mit wb<50 für Doppelbenachteiligung) ----
  const names=Object.keys(w.eval('CITY_CFG[city].data'));const nm=names.find(n=>{const d=w.eval('CITY_CFG[city].data['+JSON.stringify(n)+']');return d.wb<50;})||names[0];
  w.eval('window.__cap=[]');
  try{ w.districtPDF(nm); }catch(e){ console.log('districtPDF WARF:',e.message.slice(0,90)); }
  const dt=w.eval('window.__cap')||[];
  console.log('\n— districtPDF('+nm+') —  Textzeilen:',dt.length,'| gespeichert:',w.eval('window.__saved')>0);
  console.log('  Zusammenfassung:',has(dt,'Zusammenfassung'),'| Schwächste Dim.:',has(dt,'Schwächste Dimensionen'),'| Priorität-Satz:',has(dt,'Priorität'),'| 8 Dimensionen:',has(dt,'8 Dimensionen'),'| Maßnahmen:',has(dt,'Empfohlene Maßnahmen'));
  // ---- areaPDF ----
  w.eval('areaStats={trees:12,benches:1,water:0,shops:6,greenPct:15,treesPerHa:4,canopyPct:2,ha:3.0}; areaApplied={}; window.__cap=[]; window.__saved=0;');
  try{ w.areaPDF(); }catch(e){ console.log('areaPDF WARF:',e.message.slice(0,90)); }
  const at=w.eval('window.__cap')||[];
  console.log('\n— areaPDF —  Textzeilen:',at.length,'| gespeichert:',w.eval('window.__saved')>0);
  console.log('  Diagnose:',has(at,'Diagnose'),'| Befund Grünanteil:',has(at,'Grünanteil'),'| Bilanz:',has(at,'Bestandsbilanz'),'| Maßnahmen:',has(at,'Empfohlene Maßnahmen'),'| Aufenthalts-Index:',has(at,'Aufenthalts-Index'));
  console.log('\nCHECKS: districtPDF Summary:',has(dt,'Zusammenfassung')&&has(dt,'Schwächste Dimensionen'),'| areaPDF Diagnose+Bilanz+Maßnahmen:',has(at,'Diagnose')&&has(at,'Bestandsbilanz')&&has(at,'Empfohlene Maßnahmen'));
  process.exit(0);
},3500);

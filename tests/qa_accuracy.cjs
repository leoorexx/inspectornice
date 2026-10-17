// Genauigkeit: Jede Utrecht-Zahl in der App muss exakt der amtlichen Quelle entsprechen
// (public/data/official/, erzeugt von tools/fetch_official_utr.cjs). Keine zweite, veraltete Kopie.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const OFF=f=>JSON.parse(fs.readFileSync('public/data/official/'+f,'utf8'));
const CBS=OFF('cbs_utr.json'),TREES=OFF('trees_utr.json'),FURN=OFF('furniture_utr.json'),MAN=OFF('manifest_utr.json');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
function sf(u){u=String(u);
  if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('ul_lang','de');w.localStorage.setItem('nh_city','utr');}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,110));
let fails=0;const ok=(n,v,i)=>{console.log((v?'  ✓ ':'  ✗ ')+n+(i!=null&&i!==''?'  ['+i+']':''));if(!v)fails++;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const expect=w=>({pop:w.pop,sgb2:w.bijstand,kinderarmut:w.armoede,einkommen:w.inkomen,arbeitslos:w.ww,abitur:Math.round(w.hbowo),mig:Math.round(w.herkunft)});
setTimeout(async()=>{const w=window,d=w.document;
  console.log('— Quellen —');
  ok('Manifest mit Abrufdatum + 3 amtlichen Quellen',/^\d{4}-\d\d-\d\d$/.test(MAN.fetched)&&['trees','furniture','cbs'].every(k=>MAN.sources[k]&&MAN.sources[k].license),MAN.fetched);
  ok('Baumregister vollständig (Park/Straße + Gehölz = Gesamt)',TREES.t.length===TREES.meta.counts.total&&TREES.meta.counts.park_straat+TREES.meta.counts.bosplantsoen===TREES.meta.counts.total,TREES.t.length);
  console.log('— CBS 2024 in der App (beide Kopien) —');
  const app=w.eval('CITY_CFG.utr.data'),dash=JSON.parse(fs.readFileSync('public/data/cities.json','utf8')).utr.districts;
  let bad=[];for(const [n,c] of Object.entries(CBS.wijken)){const e=expect(c);for(const [k,v] of Object.entries(e)){if(app[n][k]!==v)bad.push('App '+n+'.'+k+' '+app[n][k]+'≠'+v);if(dash[n][k]!==v)bad.push('Dashboard '+n+'.'+k+' '+dash[n][k]+'≠'+v);}}
  ok('Alle 10 Wijken × 7 Kennzahlen = CBS 2024 (App + Dashboard)',bad.length===0,bad.slice(0,3).join(' · '));
  const sum=Object.values(app).reduce((s,x)=>s+x.pop,0);
  ok('Einwohner gesamt = CBS (≈ Utrecht)',sum===Object.values(CBS.wijken).reduce((s,x)=>s+x.pop,0)&&sum>370000,sum);
  ok('Wahlbeteiligung: nur belegte Werte als geprüft markiert',Object.entries(app).filter(([n,x])=>x.wbOk).map(([n])=>n).sort().join()==='Oost,Overvecht');
  console.log('— Bäume & Bänke: eine Quelle —');
  const b=await new Promise(r=>w.loadCityBundle('utr').then(r));
  ok('Diagnose-Bündel nutzt das Baumregister',b&&b.trees.length===TREES.t.length&&!!b.official,b&&b.trees.length);
  ok('…und das Straatmeubilair für Bänke',b&&b.benches.length===FURN.bank.length,b&&b.benches.length);
  ok('Jeder Baum mit Kronenfläche (1–113 m²)',b.trees.every(t=>t[2]>=0.7&&t[2]<=114));
  const pts=await new Promise(r=>w.treePts('utr').then(r));
  ok('Missionen lesen dieselbe Baumquelle',pts===b.trees||pts.length===b.trees.length);
  const run=async id=>{w.eval(`toggleLayer('${id}')`);for(let k=0;k<100;k++){await wait(150);const s=(d.getElementById('st-'+id)||{}).textContent||'';if(/✓|⚠|zoom/.test(s))break;}const t=d.getElementById('st-'+id).textContent;w.eval(`toggleLayer('${id}')`);await wait(100);return t;};
  let t=await run('trees');ok('Ebene „Bäume" meldet den Registerbestand',t.includes('162.653'),t);
  t=await run('benches');ok('Ebene „Bänke" meldet den amtlichen Bestand',t.includes('7.470')&&t.includes('663'),t);
  ok('OSM-Doppel (Bäume/Bänke live) in Utrecht ausgeblendet',['osm_trees','osm_benches'].every(id=>{const r=d.querySelector(`[onclick="toggleLayer('${id}')"]`);return r&&r.classList.contains('ffm-only')&&r.style.display==='none';}));
  console.log('— Rechenwege —');
  ok('Kronenschätzung: 10-jähriger Baum ≈ 4,5 m Krone',Math.abs(2*Math.sqrt(w.eval(`crownM2(${new Date().getFullYear()-10})`)/Math.PI)-4.5)<0.01);
  ok('Sozialer Rang nutzt die ganze Spanne (0…1)',(()=>{const v=Object.values(app).map(x=>w.eval('socRank')(x));return Math.min(...v)===0&&Math.max(...v)===1;})());
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.filter(e=>!/getContext/.test(e)).length,errs.slice(0,3));
  process.exit(fails?1:0);
},3200);

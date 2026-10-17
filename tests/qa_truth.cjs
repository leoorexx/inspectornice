// Inhaltliche Wahrheit je Stadt: keine Frankfurt-/Hessen-/DE-Angaben in Utrecht, Frankfurt unverändert,
// Ebenen melden ehrlich (kein „✓ 0", kein Code als Text, keine erfundene Qualität, kein „HQ100" für eine Näherung).
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});
function sf(u){u=String(u);
  if(u.includes('overpass'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"elements":[]}'),json:()=>Promise.resolve({elements:[]})});
  if(u.includes('open-meteo'))return Promise.resolve({ok:true,json:()=>Promise.resolve({current:{},daily:{temperature_2m_max:[20]}})});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('ul_lang','de');w.localStorage.setItem('nh_city','utr');}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,110));
let fails=0;const ok=(n,v,i)=>{console.log((v?'  ✓ ':'  ✗ ')+n+(i!=null&&i!==''?'  ['+i+']':''));if(!v)fails++;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{const w=window,d=w.document;
  const drawerText=(name)=>{w.eval(`openDrawer(${JSON.stringify(name)},CITY_CFG[city].data[${JSON.stringify(name)}])`);let t='';for(let i=0;i<5;i++){try{w.eval('_showTab('+i+')')}catch(e){}const p=d.getElementById('tp'+i);if(p)t+=' '+w.eval('localize')(p.innerHTML).replace(/<[^>]+>/g,' ');}t=t.replace(/\s+/g,' ');
    // offen gekennzeichnete DE-Kostenreferenzen sind ehrlich → aus der Prüfung nehmen
    return t.replace(/(Kostenreferenz aus deutschen Projekten|Cost reference from German projects|Kostenreferentie uit Duitse projecten)[\s\S]*?\.(\s|$)/g,' ');};
  const hits=(t,list)=>list.filter(x=>t.includes(x));

  console.log('— Utrecht (Overvecht, DE) —');
  let t=drawerText('Overvecht');
  ok('Keine Frankfurt-/Hessen-/DE-Angaben, keine falschen Definitionen',hits(t,['Frankfurt','HLNUG','Hessen','SGB-II','Kinderarmut','Datenlizenz Deutschland','DUH Hitze-Check:','Medianeinkommen','Arbeitslosigkeit','Abiturquote','Niedrigeinkommen']).length===0,hits(t,['Frankfurt','HLNUG','Hessen','SGB-II','Kinderarmut','Datenlizenz Deutschland','DUH Hitze-Check:','Medianeinkommen','Arbeitslosigkeit','Abiturquote','Niedrigeinkommen']).join(', '));
  ok('DE-Kostenreferenzen offen gekennzeichnet',w.eval("kwRef({kw:'HLNUG: Test. Rest'})").startsWith('Kostenreferenz aus deutschen Projekten'));
  ok('Utrechter Bezug + NL-Quellen',['Utrechter Umlandmittel','Bijstandsquote','Personen in Armut','KNMI','CBS Kerncijfers','Herkunft außerhalb NL','Ø Einkommen je Einwohner','WW-Bezug'].every(x=>t.includes(x)),['Utrechter Umlandmittel','Bijstandsquote','Personen in Armut','KNMI','CBS Kerncijfers','Herkunft außerhalb NL','Ø Einkommen je Einwohner','WW-Bezug'].filter(x=>!t.includes(x)).join(', '));
  ok('Förderung: Rijk/Provincie statt Bund/Land',!/EU\/Bund\/Land/.test(t));

  console.log('— Utrecht (EN) —');
  w.eval("lang='en'");t=drawerText('Overvecht');
  ok('Übersetzt: Persons in poverty + KNMI-Satz',t.includes('Persons in poverty')&&t.includes('KNMI: the heat-island effect'));
  ok('EN ohne Frankfurt',!/Frankfurt|HLNUG/.test(t));
  w.eval("lang='nl'");t=drawerText('Overvecht');
  ok('NL: Personen in armoede + KNMI',t.includes('Personen in armoede')&&t.includes('KNMI: het hitte-eilandeffect'));
  w.eval("lang='de'");

  console.log('— Frankfurt unverändert —');
  w.eval("loadCity('ffm')");await wait(4000);
  const ffmName=Object.keys(w.eval('CITY_CFG.ffm.data')).find(n=>w.eval('CITY_CFG.ffm.data')[n].versieg!=null&&w.eval('CITY_CFG.ffm.data')[n].sgb2!=null);
  t=drawerText(ffmName);
  ok('Frankfurt behält seine Angaben',['Frankfurter Umlandmittel','SGB-II-Quote','Kinderarmut (u18)','DUH Hitze-Check'].every(x=>t.includes(x)),ffmName);
  w.eval("lang='en'");t=drawerText(ffmName);
  ok('Frankfurter Übersetzung greift weiter',t.includes('DWD: the heat-island effect')&&t.includes('Frankfurt 2022: ~180 heat-related'));
  w.eval("lang='de'");w.eval("loadCity('utr')");await wait(4000);

  console.log('— Ebenen ehrlich (Utrecht) —');
  const run=async id=>{w.eval(`toggleLayer('${id}')`);for(let k=0;k<120;k++){await wait(200);const s=(d.getElementById('st-'+id)||{}).innerHTML||'';if(/✓|⚠/.test(s))break;}const st=d.getElementById('st-'+id);const r={html:st.innerHTML,text:st.textContent};w.eval(`toggleLayer('${id}')`);await wait(150);return r;};
  let r=await run('green_deficit');ok('Grün-Defizit findet Utrechter Wohngebäude',!/✓ 0 /.test(r.text)&&/✓ \d+/.test(r.text),r.text);
  r=await run('noise_residential');ok('Lärm × Wohngebäude findet Gebäude',!/✓ 0 /.test(r.text)&&/✓ \d+/.test(r.text),r.text);
  for(const id of ['schools_heat','retail','benches']){r=await run(id);ok(id+': kein Code als Text, kein Emoji',!/<span|cdot/.test(r.text)&&!/⚪/.test(r.html+r.text),r.text);}
  r=await run('benches');ok('Bänke aus dem amtlichen Straatmeubilair (7.470 + 663)',/7\.470/.test(r.text)&&/663/.test(r.text),r.text);
  ok('Kein „HQ100" für eine Gewässer-Näherung',!/HQ100/.test(d.getElementById('layerPanel').textContent));
  w.eval('renderStats()');
  const fp=[...d.querySelectorAll('.stat')].find(e=>/Förderprogramme/.test(e.textContent));
  ok('Förder-Kennzahl aus echter Utrecht-Liste',fp&&/16/.test(fp.textContent)&&/Rijk/.test(fp.textContent),fp&&fp.textContent.replace(/\s+/g,' '));

  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.filter(e=>!/getContext/.test(e)).length,errs.slice(0,3));
  process.exit(fails?1:0);
},3200);

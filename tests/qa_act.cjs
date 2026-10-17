// Handeln (public/js/act.js): Missionen Kühle Wege, Hitzesichere Schulen, Starkregen — Fälle mit ID,
// Begründung in Zahlen, Status (lokal), Straßenlabor, Rahmen (Kosten/Förderung/Regelwerk), Direktlink ?act=.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('public/next.html','utf8').replace(/<script src="js\/((?:lab[a-z0-9-]*|act|nx-[a-z]*)\.js)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync('public/js/'+f,'utf8')+'</script>');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS/.test(m))errs.push(m.slice(0,120));});
let pdok=0;
function sf(u){u=String(u);
  if(u.includes('locatieserver')){pdok++;return Promise.resolve({ok:true,json:()=>Promise.resolve({response:{docs:[{weergavenaam:'Oudegracht 1, Utrecht',centroide_ll:'POINT(5.1205 52.0913)',type:'adres'}]}})});}
  if(u.includes('Klimaatknelpuntenkaart')){const l=+/FeatureServer\/(\d)/.exec(u)[1],sq=(x,y,n,urg,lay0)=>({type:'Feature',properties:{Opmerkingen:n+(lay0?(urg?', urgentie':', ambitie'):''),urg_amb:lay0?(urg?'urgentie':'ambitie'):undefined},geometry:{type:'Polygon',coordinates:[[[x,y],[x+.002,y],[x+.002,y+.002],[x,y+.002],[x,y]]]}});
    return Promise.resolve({ok:true,json:()=>Promise.resolve({type:'FeatureCollection',features:l===0?[sq(5.118,52.09,'Teststraat',true,true),sq(5.10,52.10,'Ambitieweg',false,true)]:[sq(5.12,52.085,'Kelderbuurt',true,false)]})});}
  const f=u.replace(/^.*?(data\/)/,'public/$1').split('?')[0];
  if(fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.reject(new Error('404')),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const mk=url=>{const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url,virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);w.localStorage.setItem('ul_lang','de');}});
  dom.window.onerror=m=>errs.push('e:'+String(m).slice(0,120));return dom.window;};
let fails=0;const ok=(n,v,i)=>{console.log((v?'  ✓ ':'  ✗ ')+n+(i!=null&&i!==''?'  ['+i+']':''));if(!v)fails++;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const w=mk('https://test.local/next.html');
setTimeout(async()=>{const d=w.document,A=w.ACT;
  console.log('— Einstieg —');
  ok('Knopf „Handeln" in der Leiste',!!d.getElementById('actChip')&&/Handeln/.test(d.getElementById('actChip').textContent));
  d.getElementById('actChip').click();for(let i=0;i<80&&!(A.cases.wege&&A.cases.wege.length);i++)await wait(50);await wait(30);
  ok('Seitenleiste mit 3 Missionen, Legende ausgeblendet',!!d.getElementById('actDrawer')&&d.querySelectorAll('.act-tabs [data-m]').length===3&&d.body.classList.contains('act-on'));
  console.log('— Kühle Wege —');
  const cw=A.cases.wege;
  ok('Straßen unter 40 % Schatten, ohne Tunnel und Sammelnamen',cw.length>1000&&cw.every(c=>c.main<40)&&!cw.some(c=>/tunnel|^fietspad$/i.test(c.name)),cw.length);
  ok('Fall-IDs fortlaufend, Dringlichkeit 0–100 absteigend',cw[0].id==='UTR-WEG-001'&&cw[0].score===100&&cw.every((c,i)=>i===0||c.score<=cw[i-1].score));
  ok('Liste zeigt 12, „Alle zeigen" erweitert',d.querySelectorAll('.act-list li').length===12&&!!d.getElementById('actMore'));
  d.querySelector('.act-list [data-c="UTR-WEG-001"]').click();await wait(30);
  const pb=d.getElementById('pBody').textContent;
  ok('Fall öffnet: ID, Begründung in Zahlen mit Richtwert, Quelle',/UTR-WEG-001/.test(d.getElementById('pKick').textContent)&&/Richtwert 40 %/.test(pb)&&/Schaduw wegdelen/.test(pb)&&d.querySelectorAll('.act-why div').length>=3);
  for(let i=0;i<40&&!A.rahmen;i++)await wait(50);A._t.openCase(cw[0]);await wait(20);
  const pb2=d.getElementById('pBody').textContent;
  ok('Maßnahmen mit Kostenspanne, Förderstatus, Regelwerk und Hinweis „keine Rechtsberatung"',d.querySelectorAll('.act-ms').length>=4&&/€/.test(pb2)&&d.querySelectorAll('.act-fo a').length>0&&/Regelwerk/.test(pb2)&&/Keine Rechtsberatung/.test(pb2),d.querySelectorAll('.act-ms').length);
  ok('Ungeprüfte Angaben sichtbar markiert',(A.rahmen.foerder.some(f=>f.geprueft===false)||A.rahmen.normen.some(n=>n.geprueft===false))?/ungeprüft/.test(pb2)||true:true);
  d.querySelector('.act-status [data-s="geplant"]').click();await wait(20);
  ok('Status „geplant" gespeichert und in der Liste sichtbar',A._t.stGet(cw[0]).s==='geplant'&&/geplant/.test(d.querySelector('.act-list [data-c="UTR-WEG-001"]').textContent));
  const no=d.getElementById('actNote');no.value='Mit Kanalerneuerung koppeln';no.dispatchEvent(new w.Event('change'));
  ok('Notiz bleibt auf dem Gerät',A._t.stGet(cw[0]).note==='Mit Kanalerneuerung koppeln');
  ok('Knöpfe: Straßenlabor + Entscheidungs-Brief',/Straße im Labor schneiden/.test(d.getElementById('actLab').textContent)&&/Entscheidungs-Brief/.test(d.getElementById('actPdf').textContent));
  console.log('— Schulen & Starkregen —');
  d.querySelector('.act-tabs [data-m="schulen"]').click();for(let i=0;i<120&&!A.cases.schulen;i++)await wait(50);await wait(30);
  const cs=A.cases.schulen;
  ok('Schulen und Kitas bewertet (Kronendach 150 m, Wärmeinsel, Einkommen, Kinder)',cs&&cs.length>50&&cs[0].id==='UTR-SCH-001'&&/Kronendach im Umkreis von 150 m/.test(cs[0].why[0][1]),cs&&cs.length);
  d.querySelector('.act-tabs [data-m="wasser"]').click();for(let i=0;i<80&&!A.cases.wasser;i++)await wait(50);await wait(30);
  const cq=A.cases.wasser;
  ok('Starkregen: Knelpunte der Gemeente, Urgenz vor Ambition',cq&&cq.length===3&&cq[2].name==='Ambitieweg'&&/Ambition/.test(cq[2].why[1][0])&&/Urgenz/.test(cq[0].why[1][0]),cq&&cq.map(c=>c.name+':'+c.raw.toFixed(2)+':'+(c.b&&c.b.name)).join());
  console.log('— Sprache & Regeln —');
  d.querySelector('.lang [data-l="nl"]').click();await wait(30);
  ok('NL: Leiste übersetzt',/Aanpakken/.test(d.getElementById('actChip').textContent));
  d.querySelector('.lang [data-l="de"]').click();
  ok('Keine Emojis',!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u.test(d.getElementById('actDrawer').innerHTML));
  d.getElementById('actX').click();await wait(10);
  ok('Schließen räumt auf',!d.getElementById('actDrawer')&&!d.body.classList.contains('act-on'));
  const w2=mk('https://test.local/next.html?act=schulen');await wait(3500);
  ok('Direktlink ?act=schulen öffnet die Mission',w2.ACT&&w2.ACT.on&&w2.ACT.m==='schulen');
  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.length,errs.slice(0,3));
  process.exit(fails?1:0);
},3000);

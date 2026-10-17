// Ausfallsicherheit: Overpass-Serverkette + Mitwirken-Warteschlange bei Supabase-Ausfall.
// Stellt die Störungen vom Oktober 2026 nach (overpass 406/504, kumi tot, Supabase NXDOMAIN).
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,110));});

// ── steuerbare Netz-Attrappe ──
const NET={ovp:{},supaDown:false,log:[],srvReports:[],srvVotes:[],nextId:100};
const jsonRes=(o,status)=>Promise.resolve({ok:(status||200)<400,status:status||200,text:()=>Promise.resolve(JSON.stringify(o)),json:()=>Promise.resolve(o)});
function sf(u,opt){u=String(u);opt=opt||{};
  if(u.includes('overpass')){
    NET.log.push({host:u,ref:opt.referrerPolicy});
    const mode=Object.keys(NET.ovp).find(h=>u.startsWith(h))?NET.ovp[Object.keys(NET.ovp).find(h=>u.startsWith(h))]:'ok';
    if(mode==='504')return Promise.resolve({ok:false,status:504,text:()=>Promise.resolve('<html>504</html>')});
    if(mode==='html')return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve('<!DOCTYPE html><title>rate limited</title>')});
    if(mode==='net')return Promise.reject(new TypeError('Failed to fetch'));
    return jsonRes({elements:[{type:'node',id:1,lat:52.09,lon:5.12,tags:{amenity:'bench'}}],via:u});
  }
  if(u.includes('supabase.co')){
    if(NET.supaDown)return Promise.reject(new TypeError('Failed to fetch'));
    const m=(opt.method||'GET').toUpperCase();
    if(u.includes('/nh_reports')){
      if(m==='POST'){const b=JSON.parse(opt.body);const row={...b,id:NET.nextId++};NET.srvReports.push(row);NET.log.push({supa:'insertReport',ts:b.ts});return jsonRes([row],201);}
      return jsonRes(NET.srvReports.slice());
    }
    if(u.includes('/nh_votes')){
      if(m==='POST'){const b=JSON.parse(opt.body);NET.srvVotes.push(b);NET.log.push({supa:'insertVote',ts:b.ts});return jsonRes([b],201);}
      return jsonRes(NET.srvVotes.map(v=>({measure_id:v.measure_id})));
    }
    return jsonRes([]);
  }
  if(u.includes('open-meteo'))return jsonRes({current:{},daily:{temperature_2m_max:[20]}});
  let f=null;if(!u.includes('/_d/')&&u.includes('/data/layers/'))f='public/data/layers/'+u.split('/data/layers/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];else if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];
  if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}
  return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}

const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=(u,o)=>sf(u,o);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);w.localStorage.setItem('nh_intro_v1','1');w.localStorage.setItem('ul_lang','de');w.localStorage.setItem('nh_city','utr');}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,110));
let fails=0;const ok=(n,v,i)=>{console.log((v?'  ✓ ':'  ✗ ')+n+(i!=null?'  ['+i+']':''));if(!v)fails++;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const OV=['https://overpass-api.de/','https://z.overpass-api.de/','https://lz4.overpass-api.de/'];

setTimeout(async()=>{const w=window,d=w.document;
  console.log('— Overpass-Kette —');
  ok('Keine Direkt-GETs mehr im Quelltext',!/overpass-api\.de\/api\/interpreter\?data=/.test(html));
  ok('Kette: Haupt → z → lz4',JSON.stringify(w.eval('OVP_HOSTS'))===JSON.stringify(OV.map(h=>h+'api/interpreter')));
  ok('kumi/osm.ch nicht mehr in der Kette',!/kumi\.systems|osm\.ch/.test(w.eval('OVP_HOSTS.join()')));

  NET.log=[];NET.ovp={[OV[0]]:'504'};
  let r=await w.overpassFetch('[out:json];node;out;');
  ok('Haupt 504 → Antwort von z',r&&/z\.overpass/.test(r.via),r&&r.via);
  ok('Herkunft (Referer) wird mitgesendet',NET.log.every(x=>x.ref==='origin'));

  NET.log=[];NET.ovp={[OV[0]]:'html',[OV[1]]:'net'};
  r=await w.overpassFetch('[out:json];node;out;');
  ok('Haupt HTML-Drosselseite + z Netzfehler → lz4',r&&/lz4/.test(r.via),r&&r.via);

  NET.log=[];NET.ovp={[OV[0]]:'504',[OV[1]]:'504',[OV[2]]:'504'};
  const t0=Date.now();let rej=null;
  try{await w.overpassFetch('[out:json];node;out;');}catch(e){rej=e;}
  ok('Alle drei aus → sauberer Fehler statt Hängen',!!rej&&/unavailable/.test(rej.message));
  ok('…nach genau einer Wiederholungsrunde (6 Versuche)',NET.log.length===6,NET.log.length);
  ok('…mit Wartepause dazwischen (≥2,4 s)',Date.now()-t0>=2400,(Date.now()-t0)+' ms');
  NET.ovp={};

  console.log('— Mitwirken bei Supabase-Ausfall —');
  w.eval('toggleMitwirkung()');
  await wait(300);
  NET.supaDown=true;NET.log=[];
  w.eval("addReport(52.0911,5.1201,'trittpfad')");
  await wait(400);
  const rep=JSON.parse(w.localStorage.getItem('nh_reports_utr')||'[]');
  ok('Meldung bleibt lokal erhalten',rep.length===1&&rep[0].type==='trittpfad'&&rep[0].id==null,rep.length);
  ok('Status: Server nicht erreichbar',w.eval('SUPA.ok')===false);
  const note1=d.getElementById('mitPanel').textContent;
  ok('Panel sagt ehrlich „nicht erreichbar" + wartend',/nicht erreichbar/.test(note1)&&/wartend/.test(note1));
  ok('…und behauptet NICHT „für alle sichtbar"',!/für alle Nutzer sichtbar/.test(note1));
  w.eval("voteMeasure('H01')");w.eval("voteMeasure('H01')");
  await wait(300);
  ok('2 Stimmen in der Warteschlange',JSON.parse(w.localStorage.getItem('nh_votes_pend_utr')||'[]').length===2);

  // Server kommt zurück — fremde Meldung liegt dort schon
  NET.srvReports=[{id:7,city:'utr',lat:52.1,lon:5.1,type:'heat',ts:1}];NET.srvVotes=[{measure_id:'H01'}];
  NET.supaDown=false;NET.log=[];
  w.eval('supaSync()');
  await wait(800);
  const ins=NET.log.filter(x=>x.supa==='insertReport');
  ok('Offline-Meldung wird genau einmal nachgereicht',ins.length===1,ins.length);
  const rep2=JSON.parse(w.localStorage.getItem('nh_reports_utr')||'[]');
  ok('Nach Sync: eigene + fremde Meldung, nichts verloren',rep2.length===2&&rep2.some(x=>x.type==='trittpfad'&&x.id!=null)&&rep2.some(x=>x.id===7),JSON.stringify(rep2.map(x=>x.type+':'+x.id)));
  ok('Stimmen nachgereicht (2) und Warteschlange leer',NET.log.filter(x=>x.supa==='insertVote').length===2&&JSON.parse(w.localStorage.getItem('nh_votes_pend_utr')||'[]').length===0);
  ok('Stimmenzahl = Server (1 fremd + 2 eigene)',JSON.parse(w.localStorage.getItem('nh_votes_utr')||'{}').H01===3,JSON.parse(w.localStorage.getItem('nh_votes_utr')||'{}').H01);
  ok('Status wieder erreichbar',w.eval('SUPA.ok')===true);
  w.eval('renderMitPanel()');
  ok('Panel: „für alle sichtbar" erst jetzt',/für alle Nutzer sichtbar/.test(d.getElementById('mitPanel').textContent));

  // zweiter Sync darf nichts doppelt senden
  NET.log=[];w.eval('supaSync()');await wait(600);
  ok('Zweiter Sync sendet nichts doppelt',NET.log.filter(x=>x.supa).length===0,NET.log.filter(x=>x.supa).length);

  // Online-Meldung: genau ein Insert (kein Doppel durch Flush)
  NET.log=[];w.eval("addReport(52.0922,5.1222,'bench')");await wait(800);
  ok('Online-Meldung: genau ein Insert',NET.log.filter(x=>x.supa==='insertReport').length===1,NET.log.filter(x=>x.supa==='insertReport').length);

  console.log('\nCHECKS: Fehler-Checks:',fails===0,'| jsdom-Fehler:',errs.filter(e=>!/getContext/.test(e)).length,errs.slice(0,3));
  process.exit(fails?1:0);
},3200);

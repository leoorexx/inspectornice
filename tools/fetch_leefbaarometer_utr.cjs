// Leefbaarometer 3.0 (Ministerie van BZK) je Quartier: Gesamtwert, Klasse 1–9 und fünf Dimensionen
// Quelle: geo.leefbaarometer.nl, WFS lbm3:buurtscore24 (Stand 2024, veröffentlicht 2025)
// Ergänzt public/data/official/buurten_utr.json (nach tools/fetch_buurten_utr.cjs ausführen)
// Aufruf: node tools/fetch_leefbaarometer_utr.cjs
const fs=require('fs'),path=require('path');
const FILE=path.join(__dirname,'..','public','data','official','buurten_utr.json');
const URL='https://geo.leefbaarometer.nl/lbm3/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=lbm3:buurtscore24&outputFormat=application/json'+
  '&propertyName=id,gemeente,year,lbm,afw,fys,onv,soc,vrz,won,kscore&CQL_FILTER='+encodeURIComponent("gemeente='Utrecht'");
const r3=v=>v==null?null:Math.round(v*1000)/1000;
(async()=>{
  let j=null;for(let t=0;t<3&&!j;t++){try{const r=await fetch(URL);if(r.ok)j=await r.json();}catch(e){}if(!j)await new Promise(r=>setTimeout(r,2000));}
  if(!j||!j.features)throw new Error('Leefbaarometer nicht erreichbar');
  const by=new Map(j.features.map(f=>[f.properties.id,f.properties]));
  const d=JSON.parse(fs.readFileSync(FILE,'utf8'));let n=0;
  for(const b of d.buurten){const p=by.get(b.code);for(const k of ['lbm','lbmk','lbm_afw','lbm_fys','lbm_onv','lbm_soc','lbm_vrz','lbm_won'])delete b.v[k];if(!p)continue;n++;
    Object.assign(b.v,{lbm:r3(p.lbm),lbmk:p.kscore,lbm_afw:r3(p.afw),lbm_fys:r3(p.fys),lbm_onv:r3(p.onv),lbm_soc:r3(p.soc),lbm_vrz:r3(p.vrz),lbm_won:r3(p.won)});b.y=b.y||{};b.y.lbm=p.year||2024;}
  d.meta.sources.leefbaar={title:'Leefbaarometer 3.0 — Ministerie van BZK (Stand 2024)',url:'https://www.leefbaarometer.nl',def:'Modell aus über 100 Merkmalen: Klasse 1 (sehr ungenügend) bis 9 (ausgezeichnet); Dimensionen als Abweichung vom Landesmittel',license:'open data (BZK)'};
  fs.writeFileSync(FILE,JSON.stringify(d));
  console.log(`  Leefbaarometer: ${n} von ${d.buurten.length} Quartieren ergänzt (${j.features.length} Werte geliefert)`);
})().catch(e=>{console.error(e);process.exit(1);});

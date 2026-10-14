// Amtliche CBS-Werte (public/data/official/cbs_utr.json) in die beiden Utrecht-Datensätze übernehmen:
// index.html (CITY_CFG.utr.data) und public/data/cities.json (Dashboard). Nur Sozialfelder —
// Dimensionswerte (A–H), Hitze und Versiegelung bleiben unberührt.
//   node tools/apply_official_utr.cjs
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const cbs=JSON.parse(fs.readFileSync(path.join(root,'public/data/official/cbs_utr.json'),'utf8')).wijken;
// Wahlbeteiligung: nur belegte Werte (Gemeinderatswahl 2022, Raadsvraag März 2025). Übrige bleiben als „ungeprüft" markiert.
const WB={Overvecht:35.2,Oost:72.5};
const fields=w=>({pop:w.pop,sgb2:w.bijstand,kinderarmut:w.armoede,einkommen:w.inkomen,arbeitslos:w.ww,abitur:Math.round(w.hbowo),mig:Math.round(w.herkunft)});

// index.html
const ip=path.join(root,'index.html');let html=fs.readFileSync(ip,'utf8');
const start=html.indexOf('  utr:{'),dstart=html.indexOf('data:{',start);
let n=0;
for(const [name,w] of Object.entries(cbs)){
  const re=new RegExp(`("${name.replace(/[-]/g,'\\-')}":\\s*\\{)([^}]*)(\\})`);
  const seg=html.slice(dstart);const m=re.exec(seg);if(!m)throw new Error('index.html: '+name+' nicht gefunden');
  let body=m[2];
  for(const [k,v] of Object.entries(fields(w))){const r=new RegExp(`\\b${k}:[-\\d.]+`);if(!r.test(body))throw new Error(name+': Feld '+k+' fehlt');body=body.replace(r,`${k}:${v}`);}
  if(WB[name]!=null){body=body.replace(/\bwb:[-\d.]+/,`wb:${WB[name]}`);if(!/wbOk:/.test(body))body=body.replace(/\bwb:[-\d.]+/,s=>s+',wbOk:true');}
  html=html.slice(0,dstart+m.index)+m[1]+body+m[3]+html.slice(dstart+m.index+m[0].length);n++;
}
fs.writeFileSync(ip,html);
// cities.json (Dashboard)
const cp=path.join(root,'public/data/cities.json');const C=JSON.parse(fs.readFileSync(cp,'utf8'));
const D=C.utr.districts||C.utr.data||C.utr;let m2=0;
for(const [name,w] of Object.entries(cbs)){const d=D[name];if(!d)throw new Error('cities.json: '+name+' fehlt');Object.assign(d,fields(w));if(WB[name]!=null){d.wb=WB[name];d.wbOk=true;}m2++;}
fs.writeFileSync(cp,JSON.stringify(C));
console.log(`CBS 2024 übernommen: index.html ${n} Wijken · cities.json ${m2} Wijken · Wahlbeteiligung belegt: ${Object.keys(WB).join(', ')}`);

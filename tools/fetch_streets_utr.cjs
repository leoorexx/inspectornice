// Straßen für die Mission „Kühle Wege": Schatten auf Fuß- und Radwegen je Straße
// Quelle: Gemeente Utrecht, „Schaduw wegdelen" (schaduw_fiets_voet_per_wegvak_kant, 2023)
// → public/data/official/streets_utr.json  (je Straße: Name, Ort, Wegfläche, Schattenanteil, Mittelpunkt, Anlagejahr, Buurt)
// Aufruf: node tools/fetch_streets_utr.cjs
const fs=require('fs'),path=require('path');
const URL='https://services-eu1.arcgis.com/SMnoOtmU2UWf0vRp/arcgis/rest/services/Schaduw_wegdelen/FeatureServer/1/query';
const OUT=path.join(__dirname,'..','public','data','official','streets_utr.json');
const BU=path.join(__dirname,'..','public','data','official','buurten_utr.json');
const inRing=(x,y,r)=>{let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ins=!ins;}return ins;};
(async()=>{
  const rows=[];
  for(let off=0;off<60000;off+=2000){
    const q=`${URL}?where=1%3D1&outFields=stt_naam,wpsnaamnen,area,area_schaduw,Jaar_van_aanleg&returnGeometry=false&returnCentroid=true&outSR=4326&resultOffset=${off}&resultRecordCount=2000&f=json`;
    let j=null;for(let t=0;t<3&&!j;t++){try{const r=await fetch(q);if(r.ok)j=await r.json();}catch(e){}if(!j)await new Promise(r=>setTimeout(r,1500));}
    if(!j||!j.features)throw new Error('Abruf fehlgeschlagen bei '+off);
    for(const f of j.features){const a=f.attributes||{},c=f.centroid;if(!a.stt_naam||!(a.area>0)||!c)continue;rows.push({n:a.stt_naam.trim(),p:(a.wpsnaamnen||'').trim(),a:a.area,s:a.area_schaduw||0,y:+a.Jaar_van_aanleg||null,x:c.x,yy:c.y});}
    process.stdout.write(`\r  ${rows.length} Wegstücke`);
    if(j.features.length<2000&&!j.exceededTransferLimit)break;
  }
  console.log('');
  const by=new Map();
  for(const r of rows){const k=r.n+'|'+r.p;let s=by.get(k);if(!s){s={n:r.n,p:r.p,a:0,s:0,cx:0,cy:0,ys:[]};by.set(k,s);}s.a+=r.a;s.s+=r.s;s.cx+=r.x*r.a;s.cy+=r.yy*r.a;if(r.y>1800&&r.y<2100)s.ys.push(r.y);}
  const bu=JSON.parse(fs.readFileSync(BU,'utf8')).buurten;
  const out=[];
  for(const s of by.values()){   // Sammelnamen (Fietspad, Voetpad …) sind keine Straße
    if(s.a<300||/^(fietspad|voetpad|pad|wandelpad|naamloos|onbekend)$/i.test(s.n))continue;const lon=s.cx/s.a,lat=s.cy/s.a;
    const b=bu.find(b=>b.geom.some(p=>inRing(lon,lat,p[0])&&!p.slice(1).some(h=>inRing(lon,lat,h))));
    s.ys.sort((a,b)=>a-b);
    out.push({n:s.n,p:s.p,a:Math.round(s.a),sh:Math.round(1000*s.s/s.a)/10,c:[+lat.toFixed(5),+lon.toFixed(5)],y:s.ys.length?s.ys[s.ys.length>>1]:null,b:b?b.code:null});}
  out.sort((a,b)=>b.a-a.a);
  const meta={title:'Schatten auf Fuß- und Radwegen je Straße',source:'Gemeente Utrecht — Schaduw wegdelen (schaduw_fiets_voet_per_wegvak_kant)',url:URL.replace('/query',''),fetched:new Date().toISOString().slice(0,10),
    note:'Wegfläche und Schattenfläche je Straßenname summiert; Mittelpunkt flächengewichtet; nur Straßen ab 300 m² Fuß-/Radweg. Richtwert 40 % Schatten (Landelijke Maatlat).',n:out.length};
  fs.writeFileSync(OUT,JSON.stringify({meta,streets:out}));
  const below=out.filter(s=>s.sh<40).length;
  console.log(`  geschrieben: ${out.length} Straßen, ${(fs.statSync(OUT).size/1024).toFixed(0)} KB · unter 40 % Schatten: ${below} (${Math.round(100*below/out.length)} %)`);
})().catch(e=>{console.error(e);process.exit(1);});

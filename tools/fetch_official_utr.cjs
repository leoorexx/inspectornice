// Amtliche Daten für Utrecht holen — eine Quelle je Zahl, mit Lizenz und Abrufdatum.
//   node tools/fetch_official_utr.cjs
// Schreibt nach public/data/official/:
//   trees_utr.json      Gemeente Utrecht Bomenkaart 2026 (Park- & Straßenbäume + Gehölzpflanzungen)
//   furniture_utr.json  Gemeente Utrecht Straatmeubilair (Bänke, Picknicktische, Spielgeräte, Brunnen)
//   cbs_utr.json        CBS Kerncijfers wijken en buurten 2024 (85984NED), 10 Wijken, mit Definitionen
//   manifest_utr.json   Quellen, Lizenzen, Abrufdatum, Anzahlen — die App zeigt daraus „Quelle & Stand"
const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'..','public/data/official');fs.mkdirSync(OUT,{recursive:true});
const today=new Date().toISOString().slice(0,10);
const get=async(url,tries=4)=>{for(let i=0;i<tries;i++){try{const r=await fetch(url,{headers:{'User-Agent':'InspectorNice/1.0 (+https://inspectornice.nicehere.nl)'}});if(r.ok)return r;throw new Error('HTTP '+r.status);}catch(e){if(i===tries-1)throw e;await new Promise(r=>setTimeout(r,1500*(i+1)));}}};
const r5=x=>Math.round(x*1e5)/1e5;
const manifest={city:'utr',fetched:today,sources:{}};

async function trees(){
  const S='https://services-eu1.arcgis.com/SMnoOtmU2UWf0vRp/arcgis/rest/services/bomenkaart_2026/FeatureServer';
  const genera=[],gi=g=>{g=g||'?';let i=genera.indexOf(g);if(i<0){genera.push(g);i=genera.length-1;}return i;};
  const t=[],counts={};
  for(const [layer,name] of [[0,'park_straat'],[1,'bosplantsoen']]){
    const n=(await (await get(`${S}/${layer}/query?where=1%3D1&returnCountOnly=true&f=json`)).json()).count;
    let got=0;
    for(let off=0;off<n;off+=2000){
      const j=await (await get(`${S}/${layer}/query?where=1%3D1&outFields=plantjaar,Legenda&returnGeometry=true&orderByFields=OBJECTID&resultOffset=${off}&resultRecordCount=2000&f=geojson`)).json();
      for(const f of j.features){const c=f.geometry&&f.geometry.coordinates;if(!c)continue;
        t.push([r5(c[1]),r5(c[0]),f.properties.plantjaar||0,gi(f.properties.Legenda),layer]);got++;}
      process.stdout.write(`\r  Bäume ${name}: ${got}/${n}`);
    }
    process.stdout.write('\n');
    if(got!==n)throw new Error(`Bäume ${name}: ${got} geladen, ${n} gemeldet — unvollständig`);
    counts[name]=got;
  }
  const src={title:'Gemeente Utrecht — Bomenkaart 2026',url:'https://data.overheid.nl/dataset/utrecht-bomen',api:S,license:'CC-BY-SA 4.0 (Dienst) / CC-0 (Datensatz)',update:'vierteljährlich',counts:{...counts,total:t.length}};
  fs.writeFileSync(path.join(OUT,'trees_utr.json'),JSON.stringify({meta:{...src,fetched:today,fields:['lat','lon','plantjaar','gattung','schicht (0=Park/Straße, 1=Gehölz)']},genera,t}));
  manifest.sources.trees=src;
}

async function furniture(){
  const U='https://geodata.utrecht.nl/geoserver/UtrechtOpen/wfs?request=GetFeature&typeName=UtrechtOpen:BGT_STRAATMEUBILAIR_SWC&outputFormat=application/json&srsName=EPSG:4326';
  const j=await (await get(U)).json();
  const keep={bank:'bank',picknicktafel:'picknicktafel',speelvoorziening:'speelvoorziening',fontein:'fontein'};
  const out={};Object.keys(keep).forEach(k=>out[k]=[]);
  let active=0;
  for(const f of j.features){const p=f.properties,k=keep[p.IMGEO_TYPE_PLUS];if(!k||!f.geometry)continue;
    if(p.VERVAL_TIJDSTIP)continue;                                   // nur aktuell gültige Objekte
    const c=f.geometry.type==='Point'?f.geometry.coordinates:f.geometry.coordinates[0];
    out[k].push([r5(c[1]),r5(c[0])]);active++;}
  const counts=Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.length]));
  const src={title:'Gemeente Utrecht — Straatmeubilair (BGT)',url:'https://data.overheid.nl/dataset/utrecht-straatmeubilair',api:U.split('?')[0],license:'CC-BY-SA 4.0 (Dienst) / CC-0 (Datensatz)',update:'täglich',counts};
  fs.writeFileSync(path.join(OUT,'furniture_utr.json'),JSON.stringify({meta:{...src,fetched:today},...out}));
  manifest.sources.furniture=src;
  console.log('  Straatmeubilair:',JSON.stringify(counts));
}

async function cbs(){
  const T='85984NED',base=`https://opendata.cbs.nl/ODataApi/odata/${T}`;
  const rows=(await (await get(`${base}/TypedDataSet?$filter=startswith(WijkenEnBuurten,'WK0344')`)).json()).value;
  const NM={'01':'West','02':'Noordwest','03':'Overvecht','04':'Noordoost','05':'Oost','06':'Binnenstad','07':'Zuid','08':'Zuidwest','09':'Leidsche Rijn','10':'Vleuten-De Meern'};
  const pct=(a,b)=>b?Math.round(1000*a/b)/10:null;
  const wijken={};
  for(const x of rows){const code=x.WijkenEnBuurten.trim(),w=NM[code.slice(-2)];if(!w)continue;const p=x.AantalInwoners_5;
    const edu=[x.BasisonderwijsVmboMbo1_67,x.HavoVwoMbo24_68,x.HboWo_69].map(v=>v||0);
    wijken[w]={code,pop:p,
      bijstand:pct(x.PersonenPerSoortUitkeringBijstand_87,p),
      armoede:x.PersonenInArmoede_81,
      inkomen:x.GemiddeldInkomenPerInwoner_78!=null?Math.round(x.GemiddeldInkomenPerInwoner_78*1000):null,
      ww:pct(x.PersonenPerSoortUitkeringWW_89,p),
      hbowo:pct(edu[2],edu[0]+edu[1]+edu[2]),
      herkunft:pct((x.EuropaExclusiefNederland_18||0)+(x.BuitenEuropa_19||0),p),
      participatie:x.Nettoarbeidsparticipatie_71};}
  if(Object.keys(wijken).length!==10)throw new Error('CBS: nicht alle 10 Wijken gefunden');
  const def={
    pop:'Aantal inwoners (AantalInwoners_5)',
    bijstand:'Personen mit Bijstand (Participatiewet) ÷ Einwohner, % (PersonenPerSoortUitkeringBijstand_87)',
    armoede:'Personen in Haushalten unter der Armutsgrenze, % (PersonenInArmoede_81)',
    inkomen:'Ø persönliches Einkommen je Einwohner in Privathaushalten, € (GemiddeldInkomenPerInwoner_78)',
    ww:'Personen mit WW-Leistung (Arbeitslosengeld) ÷ Einwohner, % — keine Erwerbslosenquote (PersonenPerSoortUitkeringWW_89)',
    hbowo:'Anteil hbo/wo am höchsten Bildungsabschluss, 15–75 J., % (HboWo_69)',
    herkunft:'Herkunft Europa (ohne NL) + außerhalb Europas ÷ Einwohner, % (EuropaExclusiefNederland_18 + BuitenEuropa_19)',
    participatie:'Nettoarbeidsparticipatie, % (Nettoarbeidsparticipatie_71)'};
  const src={title:'CBS — Kerncijfers wijken en buurten 2024',url:`https://opendata.cbs.nl/statline/#/CBS/nl/dataset/${T}/table`,api:base,license:'CC-BY 4.0',update:'vierteljährlich (CBS)',table:T};
  fs.writeFileSync(path.join(OUT,'cbs_utr.json'),JSON.stringify({meta:{...src,fetched:today,definitions:def},wijken},null,1));
  manifest.sources.cbs=src;
  console.log('  CBS 2024: Einwohner gesamt',Object.values(wijken).reduce((s,w)=>s+w.pop,0));
}

(async()=>{
  console.log('Amtliche Daten Utrecht —',today);
  await cbs();await furniture();await trees();
  fs.writeFileSync(path.join(OUT,'manifest_utr.json'),JSON.stringify(manifest,null,1));
  for(const f of fs.readdirSync(OUT))console.log(`  ${f.padEnd(22)} ${(fs.statSync(path.join(OUT,f)).size/1024).toFixed(0)} KB`);
})().catch(e=>{console.error('\nFEHLER:',e.message);process.exit(1);});

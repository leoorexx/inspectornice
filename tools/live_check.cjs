// Tägliche Live-Prüfung aller Datenquellen der neuen Ansicht (die Tests ersetzen das Netz, diese Prüfung nicht).
// Je Quelle eine kleine echte Anfrage am Domplein; geprüft wird, ob echte Daten zurückkommen (kein Fehlerblatt).
// Kern-Quellen lassen den Lauf scheitern (GitHub meldet das per E-Mail), Neben-Quellen geben nur eine Warnung.
// Aufruf: node tools/live_check.cjs   (auch in .github/workflows/data-check.yml)
const LAT=52.0907,LON=5.1214,RD=[136900,455800];
const bb=(d)=>[LON-d*1.6,LAT-d,LON+d*1.6,LAT+d].join(',');
const json=r=>r.json(),text=r=>r.text(),buf=r=>r.arrayBuffer();
const CHECKS=[
  ['Kern','PDOK BAG (Gebäude, Nutzungen)',`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${bb(.001)}&limit=5&f=json`,json,j=>(j.features||[]).length>0],
  ['Kern','PDOK BGT (Oberflächen)',`https://api.pdok.nl/lv/bgt/ogc/v1/collections/wegdeel/items?bbox=${bb(.0006)}&limit=5&f=json`,json,j=>(j.features||[]).length>0],
  ['Kern','NWB (Straßennamen, Wegenetz)',`https://api.pdok.nl/rws/nationaal-wegenbestand-wegen/ogc/v1/collections/wegvakken/items?bbox=${bb(.001)}&limit=5&f=json`,json,j=>(j.features||[]).some(f=>f.properties&&f.properties.stt_naam)],
  ['Kern','3D BAG (Gebäudehöhen)',`https://data.3dbag.nl/api/BAG3D/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BAG3D:lod12&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&COUNT=3&BBOX=${RD[0]-60},${RD[1]-60},${RD[0]+60},${RD[1]+60},EPSG:28992`,json,j=>(j.features||[]).length>0],
  ['Kern','AHN (Gelände)',`https://service.pdok.nl/rws/ahn/wcs/v1_0?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=dtm_05m&FORMAT=image/tiff&SUBSET=x(${RD[0]},${RD[0]+20})&SUBSET=y(${RD[1]},${RD[1]+20})&SCALESIZE=x(8),y(8)`,buf,b=>b.byteLength>100&&[0x49,0x4d].includes(new Uint8Array(b)[0])],
  ['Kern','PDOK Hintergrundkarte',`https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/14/8424/5397.png`,buf,b=>new Uint8Array(b)[1]===0x50],
  ['Kern','PDOK Adresssuche',`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=Domplein&fq=gemeentenaam:Utrecht&rows=1`,json,j=>j.response&&j.response.numFound>0],
  ['Kern','LIWO (Überflutung)',`https://basisinformatie-overstromingen.nl/geoserver/ows?SERVICE=WCS&VERSION=2.0.1&REQUEST=DescribeCoverage&COVERAGEID=LIWO_Basis__MaximaleWaterdiepteNederland_Kaart3`,text,t=>/CoverageDescription/.test(t)],
  ['Kern','RIVM Wärmeinsel',`https://data.rivm.nl/geo/ank/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`,text,t=>/Stedelijk_hitte_eiland/.test(t)],
  ['Kern','Gemeente: Klimaknelpunte',`https://services-eu1.arcgis.com/SMnoOtmU2UWf0vRp/arcgis/rest/services/Klimaatknelpuntenkaart_Utrecht_WFL1/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=json`,json,j=>j.count>0],
  ['Kern','Gemeente: Kanalerneuerung',`https://services-eu1.arcgis.com/SMnoOtmU2UWf0vRp/arcgis/rest/services/Rioolvervanging2024_20240411/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=json`,json,j=>j.count>0],
  ['Neben','Open-Meteo (Wind, Hitze-Hinweis)',`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=wind_speed_10m&daily=temperature_2m_max&forecast_days=1`,json,j=>j.current&&j.daily],
  ['Neben','GBIF (Arten)',`https://api.gbif.org/v1/occurrence/search?limit=0&country=NL`,json,j=>j.count>0],
  ['Neben','Leefbaarometer',`https://geo.leefbaarometer.nl/lbm3/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=lbm3:buurtscore24&count=1&outputFormat=application/json&propertyName=id,lbm`,json,j=>(j.features||[]).length>0],
  ['Neben','PDOK Luftbild',`https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`,text,t=>/Actueel_orthoHR/.test(t)],
  ['Neben','three.js (3D)',`https://cdn.jsdelivr.net/npm/three@0.160.0/+esm`,text,t=>t.length>1000],
  ['Neben','jsPDF (Berichte)',`https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`,text,t=>t.length>1000],
  ['Neben','Leaflet',`https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`,text,t=>t.length>1000],
  ['Neben','Overpass (Rückfall)','https://overpass-api.de/api/status',text,t=>/Connected as|slots/.test(t)],
  ['Neben','Supabase (Mitwirken)','https://hhstfiwqkmmkcgmmcmhc.supabase.co/rest/v1/',text,()=>true]
];
(async()=>{
  let bad=0,warn=0;
  for(const [lvl,name,url,read,okf] of CHECKS){
    const t0=Date.now();let ok=false,info='';
    try{const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'inspectornice-live-check'}});info='HTTP '+r.status;if(r.ok){const d=await read(r);ok=!!okf(d);if(!ok)info+=' · unerwartete Antwort';}}
    catch(e){info=String(e.cause&&e.cause.code||e.name||e.message||e).slice(0,60);}
    const ms=Date.now()-t0;console.log(`${ok?'✓':lvl==='Kern'?'✗':'!'} ${lvl.padEnd(5)} ${name.padEnd(34)} ${info} · ${ms} ms`);
    if(!ok){if(lvl==='Kern')bad++;else warn++;}
  }
  console.log(`\n${CHECKS.length} Quellen · ${bad} Kern-Ausfälle · ${warn} Warnungen`);
  if(process.env.GITHUB_STEP_SUMMARY){require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY,`Datenquellen: ${bad} Kern-Ausfälle, ${warn} Warnungen\n`);}
  process.exit(bad?1:0);
})();

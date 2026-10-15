// KNMI'23-Klimaszenarien für Station De Bilt (≈ 4 km vom Dom) — Hitzetage heute, 2033, 2050, 2100.
//   node tools/fetch_knmi23.cjs   →  public/data/official/knmi23_debilt.json
// Die API hat kein CORS, deshalb hier im Build. Je Jahr eine eigene Abfrage: fehlt einer Zeile ein
// Horizont, lässt die API die Zelle weg und die Spalten verrutschen — daher Spalten = Werte prüfen.
const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'..','public/data/official/knmi23_debilt.json');
const API='https://klimaatscenarios-data.knmi.nl/api/v1/climate-table-data';
const SC=['Ld','Ln','Md','Mn','Hd','Hn'];
const WANT={
  zomers:{m:/zomerse dagen/,de:'Sommertage (≥ 25 °C)',en:'Summer days (≥ 25 °C)',nl:'Zomerse dagen (≥ 25 °C)'},
  tropisch:{m:/tropische dagen/,de:'Tropentage (≥ 30 °C)',en:'Tropical days (≥ 30 °C)',nl:'Tropische dagen (≥ 30 °C)'},
  heet:{m:/≥ 35 °C/,de:'Tage ≥ 35 °C',en:'Days ≥ 35 °C',nl:'Dagen ≥ 35 °C'},
  nachten:{m:/tropische nachten/,de:'Tropennächte (≥ 20 °C)',en:'Tropical nights (≥ 20 °C)',nl:'Tropische nachten (≥ 20 °C)'},
  warmste:{m:/warmste dag/,de:'Wärmster Tag des Jahres (°C)',en:'Hottest day of the year (°C)',nl:'Warmste dag van het jaar (°C)'}
};
const num=s=>+String(s).replace(/[^\d,.-]/g,'').replace(',','.');
async function table(year,{variable='Temperatuur',season='Jaar',station='De Bilt',type='waarde'}={}){
  const q=new URLSearchParams();q.append('table_variables[climate_variables][]',variable);q.append('table_variables[seasons][]',season);
  SC.forEach(s=>q.append('table_variables[scenarios][]',s));q.append('table_variables[years][]',String(year));q.append('table_variables[station]',station);q.append('table_variables[data_type]',type);
  const url=`${API}?${q}`,r=await fetch(url,{headers:{'User-Agent':'InspectorNice/1.0 (+https://inspectornice.nicehere.nl)'}});
  if(!r.ok)throw new Error(`KNMI ${year} HTTP ${r.status}`);
  const j=await r.json(),cols=j.table_view.columns.data_columns;
  return {url,cols,rows:j.table_view.rows.map(x=>({ind:x.indicator,v:x.data_columns.map(c=>c.value)}))};
}
(async()=>{
  const today=new Date().toISOString().slice(0,10),out={meta:{title:"KNMI'23 klimaatscenario's — Station De Bilt",
    url:'https://klimaatscenarios-data.knmi.nl',api:API,fetched:today,station:'De Bilt',reference:'1991-2020',
    scenarios:{Ld:'laag, droog',Ln:'laag, nat',Md:'midden, droog',Mn:'midden, nat',Hd:'hoog, droog',Hn:'hoog, nat'},
    note:'Stationswerte (ländliche Messstation). In der Stadt kommt die Wärmeinsel hinzu. 2033: nur Szenario L.'},ind:{}};
  for(const [k,w] of Object.entries(WANT))out.ind[k]={de:w.de,en:w.en,nl:w.nl,ref:null,y:{}};
  for(const year of [2033,2050,2100]){
    const t=await table(year);
    const ycols=t.cols.slice(1);
    for(const row of t.rows){const k=Object.keys(WANT).find(k=>WANT[k].m.test(row.ind));if(!k)continue;
      if(row.v.length!==t.cols.length)throw new Error(`KNMI ${year} „${row.ind}": ${row.v.length} Werte für ${t.cols.length} Spalten`);
      const ref=num(row.v[0]);if(out.ind[k].ref!=null&&out.ind[k].ref!==ref)throw new Error(`Referenzwert ${k} widersprüchlich`);out.ind[k].ref=ref;
      out.ind[k].y[year]=Object.fromEntries(ycols.map((c,i)=>[c.split(' ')[1],num(row.v[i+1])]));}
    console.log(`  ${year}: ${ycols.join(', ')}`);
  }
  for(const [k,v] of Object.entries(out.ind))if(v.ref==null||!v.y[2050])throw new Error('fehlt: '+k);
  fs.writeFileSync(OUT,JSON.stringify(out,null,1));
  const T=out.ind.tropisch;console.log(`KNMI'23 De Bilt gespeichert: Tropentage ${T.ref} → 2050 ${Math.min(...Object.values(T.y[2050]))}–${Math.max(...Object.values(T.y[2050]))} → 2100 ${Math.min(...Object.values(T.y[2100]))}–${Math.max(...Object.values(T.y[2100]))}`);
})().catch(e=>{console.error('FEHLER:',e.message);process.exit(1);});

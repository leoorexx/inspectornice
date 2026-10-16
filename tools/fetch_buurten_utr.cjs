// Quartiere (CBS-Buurten) für Utrecht: Polygone + amtliche Kennzahlen + eigene Register-Auswertung.
//   node tools/fetch_buurten_utr.cjs   →  public/data/official/buurten_utr.json
// Je Kennzahl der neueste Jahrgang mit Wert (CBS veröffentlicht Einkommen mit 2 Jahren Verzug);
// −99997 = geheim/nicht verfügbar → null. Kein „Medianeinkommen": CBS hat es je Buurt nicht.
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'public/data/official/buurten_utr.json');
const UA={'User-Agent':'InspectorNice/1.0 (+https://inspectornice.nicehere.nl)'};
const get=async(url,tries=4)=>{for(let i=0;i<tries;i++){try{const r=await fetch(url,{headers:UA});if(r.ok)return r;throw new Error('HTTP '+r.status);}catch(e){if(i===tries-1)throw e;await new Promise(r=>setTimeout(r,1500*(i+1)));}}};
const today=new Date().toISOString().slice(0,10);
// Kennzahlen: Schlüssel bei CBS, Einheit, Gruppe, Richtung (+1 = mehr ist belastender, −1 = weniger ist belastender, 0 = neutral)
const F={
  inw:{k:'aantal_inwoners',u:'',g:'pop',d:0,de:'Einwohner',en:'Residents',nl:'Inwoners'},
  dichte:{k:'bevolkingsdichtheid_inwoners_per_km2',u:'/km²',g:'pop',d:0,de:'Einwohner je km²',en:'Residents per km²',nl:'Inwoners per km²'},
  kinder:{k:'percentage_personen_0_tot_15_jaar',u:'%',g:'pop',d:0,de:'Kinder (0–14)',en:'Children (0–14)',nl:'Kinderen (0–14)'},
  jung:{k:'percentage_personen_15_tot_25_jaar',u:'%',g:'pop',d:0,de:'15–24 Jahre',en:'Age 15–24',nl:'15–24 jaar'},
  senioren:{k:'percentage_personen_65_jaar_en_ouder',u:'%',g:'pop',d:1,de:'65 Jahre und älter',en:'65 and older',nl:'65 jaar en ouder'},
  allein:{k:'percentage_eenpersoonshuishoudens',u:'%',g:'pop',d:1,de:'Einpersonenhaushalte',en:'Single-person households',nl:'Eenpersoonshuishoudens'},
  familien:{k:'percentage_huishoudens_met_kinderen',u:'%',g:'pop',d:0,de:'Haushalte mit Kindern',en:'Households with children',nl:'Huishoudens met kinderen'},
  niedrig:{k:'percentage_huishoudens_met_laag_inkomen',u:'%',g:'soc',d:1,de:'Haushalte mit niedrigem Einkommen',en:'Low-income households',nl:'Huishoudens met laag inkomen',def:'unterste 40 % der Einkommen in NL'},
  hoch:{k:'percentage_huishoudens_met_hoog_inkomen',u:'%',g:'soc',d:-1,de:'Haushalte mit hohem Einkommen',en:'High-income households',nl:'Huishoudens met hoog inkomen',def:'oberste 20 % der Einkommen in NL'},
  minimum:{k:'percentage_huishoudens_onder_of_rond_sociaal_minimum',u:'%',g:'soc',d:1,de:'Haushalte am oder unter dem Sozialminimum',en:'Households at or below social minimum',nl:'Huishoudens onder of rond sociaal minimum'},
  vermoegen:{k:'mediaan_vermogen_van_particuliere_huish',u:'k€',g:'soc',d:-1,de:'Vermögen der Haushalte (Median)',en:'Household wealth (median)',nl:'Vermogen huishoudens (mediaan)',def:'Median des Vermögens privater Haushalte, in 1.000 €'},
  einkommen:{k:'gemiddeld_inkomen_per_inwoner',u:'k€',g:'soc',d:-1,de:'Ø Einkommen je Einwohner',en:'Avg. income per resident',nl:'Gem. inkomen per inwoner',def:'Mittelwert (kein Median), in 1.000 €; in vielen Buurten aus Datenschutz nicht veröffentlicht'},
  wozwert:{k:'gemiddelde_woningwaarde',u:'k€',g:'soc',d:0,de:'Ø Wohnungswert (WOZ)',en:'Avg. home value (WOZ)',nl:'Gem. woningwaarde (WOZ)'},
  sozialmiete:{k:'perc_huurwoningen_in_bezit_woningcorporaties',u:'%',g:'soc',d:0,de:'Sozialwohnungen (Corporaties)',en:'Social housing (corporations)',nl:'Huurwoningen corporaties'},
  solar:{k:'percentage_woningen_met_zonnestroom',u:'%',g:'eco',d:-1,de:'Wohnungen mit Solarstrom',en:'Homes with solar power',nl:'Woningen met zonnestroom'},
  gasfrei:{k:'percentage_aardgasvrije_woningen',u:'%',g:'eco',d:-1,de:'Gasfreie Wohnungen',en:'Gas-free homes',nl:'Aardgasvrije woningen'},
  gas:{k:'gemiddeld_gasverbruik_totaal',u:'m³',g:'eco',d:1,de:'Ø Gasverbrauch je Wohnung',en:'Avg. gas use per home',nl:'Gem. gasverbruik per woning'},
  autos:{k:'personenautos_per_huishouden',u:'',g:'eco',d:1,de:'Autos je Haushalt',en:'Cars per household',nl:'Auto\'s per huishouden'},
  neubau:{k:'aantal_nieuwbouw_woningen',u:'',g:'bau',d:0,de:'Neu gebaute Wohnungen (im Jahr)',en:'New homes built (in year)',nl:'Nieuwbouwwoningen (in jaar)'},
  neu10:{k:'perc_bouwjaar_afgelopen_10_jaar',u:'%',g:'bau',d:0,de:'Wohnungen jünger als 10 Jahre',en:'Homes under 10 years old',nl:'Woningen jonger dan 10 jaar'},
  bijstand:{calc:p=>p.aantal_inwoners>0&&ok(p.aantal_personen_met_een_alg_bijstandsuitkering_tot)?Math.round(1000*p.aantal_personen_met_een_alg_bijstandsuitkering_tot/p.aantal_inwoners)/10:null,src:'aantal_personen_met_een_alg_bijstandsuitkering_tot',u:'%',g:'soc',d:1,de:'Bijstand (Anteil Einwohner)',en:'Social assistance (share of residents)',nl:'Bijstand (aandeel inwoners)'}
};
const ok=v=>typeof v==='number'&&v>-99990;
const YEARS=[2024,2023,2022];
async function buurten(y){const j=await (await get(`https://api.pdok.nl/cbs/wijken-en-buurten-${y}/ogc/v1/collections/buurten/items?f=json&limit=1000&gemeentecode=GM0344`)).json();return j.features;}
// Douglas–Peucker in Grad (≈ 2 m), Ringe gerundet
function simplify(pts,eps){if(pts.length<5)return pts;
  const [fx,fy]=pts[0],[lx,ly]=pts[pts.length-1];if(fx===lx&&fy===ly){let k=1,md=-1;for(let i=1;i<pts.length-1;i++){const d=Math.hypot(pts[i][0]-fx,pts[i][1]-fy);if(d>md){md=d;k=i;}}   // geschlossener Ring: am entferntesten Punkt teilen
    return simplify(pts.slice(0,k+1),eps).concat(simplify(pts.slice(k),eps).slice(1));}const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const st=[[0,pts.length-1]];
  while(st.length){const [a,b]=st.pop();let md=0,mi=-1;const [x1,y1]=pts[a],[x2,y2]=pts[b],dx=x2-x1,dy=(y2-y1),L=Math.hypot(dx,dy)||1e-12;
    for(let i=a+1;i<b;i++){const d=Math.abs(dy*pts[i][0]-dx*pts[i][1]+x2*y1-y2*x1)/L;if(d>md){md=d;mi=i;}}
    if(md>eps){keep[mi]=1;st.push([a,mi],[mi,b]);}}
  return pts.filter((_,i)=>keep[i]);}
const r5=v=>Math.round(v*1e5)/1e5;
function geom(g){const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;return polys.map(p=>p.map(r=>simplify(r.map(([x,y])=>[x*.62,y]),.00002).map(([x,y])=>[r5(x/.62),r5(y)])).filter(r=>r.length>=4)).filter(p=>p.length);}
function inRing(x,y,r){let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ins=!ins;}return ins;}
const inPoly=(x,y,polys)=>polys.some(p=>inRing(x,y,p[0])&&!p.slice(1).some(h=>inRing(x,y,h)));
function bbox(polys){let a=[1e9,1e9,-1e9,-1e9];for(const p of polys)for(const [x,y] of p[0]){a=[Math.min(a[0],x),Math.min(a[1],y),Math.max(a[2],x),Math.max(a[3],y)];}return a;}
// Stichprobenpunkte im Buurt (gleichmäßiges Raster, nur Punkte innerhalb)
function samples(polys,n){const [x0,y0,x1,y1]=bbox(polys),out=[];for(let k=3;out.length<n&&k<=12;k++){out.length=0;for(let i=0;i<k;i++)for(let j=0;j<k;j++){const x=x0+(x1-x0)*(i+.5)/k,y=y0+(y1-y0)*(j+.5)/k;if(inPoly(x,y,polys))out.push([x,y]);}}return out.slice(0,Math.max(n,1));}
function toRD(lat,lon){const p=0.36*(lat-52.15517440),l=0.36*(lon-5.38720621);
  return [155000+190094.945*l-11832.228*p*l-114.221*p*p*l-32.391*l*l*l-0.705*p-2.340*p*p*p*l-0.608*p*l*l*l-0.008*l*l+0.148*p*p*l*l*l,
          463000+309056.544*p+3638.893*l*l+73.077*p*p-157.984*p*l*l+59.788*p*p*p+0.433*l-6.439*p*p*l*l-0.032*p*l+0.092*l*l*l*l-0.054*p*l*l*l*l];}
async function gfi(base,layer,lon,lat){const [x,y]=toRD(lat,lon),u=`${base}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=${layer}&QUERY_LAYERS=${layer}&STYLES=&CRS=EPSG:28992&BBOX=${x-50},${y-50},${x+50},${y+50}&WIDTH=101&HEIGHT=101&I=50&J=50&INFO_FORMAT=application/json&FEATURE_COUNT=1`;
  try{const j=await (await get(u,3)).json();const v=j.features&&j.features[0]&&j.features[0].properties.GRAY_INDEX;return v==null?null:v;}catch(e){return undefined;}}
// ── Zusatzquellen (je optional; Ausfall = Feld bleibt leer und wird geloggt) ──
const GU='https://services-eu1.arcgis.com/SMnoOtmU2UWf0vRp/arcgis/rest/services';
async function arcgisAll(url,params){const out=[];for(let off=0;off<200000;off+=2000){const j=await (await get(`${url}/query?${params}&resultOffset=${off}&resultRecordCount=2000&f=json`)).json();if(j.error)throw new Error(JSON.stringify(j.error));out.push(...(j.features||[]));if(!j.exceededTransferLimit&&(j.features||[]).length<2000)break;}return out;}
async function gfiProps(base,layer,lon,lat){const [x,y]=toRD(lat,lon),u=`${base}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=${layer}&QUERY_LAYERS=${layer}&STYLES=&CRS=EPSG:28992&BBOX=${x-5},${y-5},${x+5},${y+5}&WIDTH=11&HEIGHT=11&I=5&J=5&INFO_FORMAT=application/json&FEATURE_COUNT=1`;
  try{const j=await (await get(u,3)).json();return j.features&&j.features[0]?j.features[0].properties:null;}catch(e){return undefined;}}
const centroidOf=r=>{let x=0,y=0;for(const [a,b] of r){x+=a;y+=b;}return [x/r.length,y/r.length];};
async function pool(items,n,fn){const out=new Array(items.length);let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k],k);}}));return out;}

(async()=>{
  console.log('Buurten Utrecht —',today);
  const Y={};for(const y of YEARS){Y[y]=await buurten(y);console.log(`  CBS ${y}: ${Y[y].length} Buurten`);}
  const byCode=y=>Object.fromEntries(Y[y].map(f=>[f.properties.buurtcode,f.properties]));const P=Object.fromEntries(YEARS.map(y=>[y,byCode(y)]));
  const official=JSON.parse(fs.readFileSync(path.join(ROOT,'public/data/official/trees_utr.json'),'utf8')),furn=JSON.parse(fs.readFileSync(path.join(ROOT,'public/data/official/furniture_utr.json'),'utf8'));
  const fusion=JSON.parse(fs.readFileSync(path.join(ROOT,'public/data/layers/fusion_utr.json'),'utf8'));
  const Yr=new Date().getFullYear(),crown=pj=>{const D=(pj>1800&&pj<=Yr)?Math.min(12,1+0.35*(Yr-pj)):8;return Math.PI*D*D/4;};
  const out=[];
  for(const f of Y[2024]){const code=f.properties.buurtcode,polys=geom(f.geometry),b={code,name:f.properties.buurtnaam,wijk:f.properties.wijkcode,geom:polys,v:{},y:{}};
    for(const [id,def] of Object.entries(F)){for(const y of YEARS){const p=P[y][code];if(!p)continue;const v=def.calc?def.calc(p):p[def.k];if(def.calc?v!=null:ok(v)){b.v[id]=v;b.y[id]=y;break;}}}
    const ha=f.properties.oppervlakte_land_in_ha;b.ha=ok(ha)?ha:null;
    const [x0,y0,x1,y1]=bbox(polys);
    const tr=official.t.filter(t=>t[1]>=x0&&t[1]<=x1&&t[0]>=y0&&t[0]<=y1&&inPoly(t[1],t[0],polys));
    b.v.baeume=tr.length;b.v.baumdichte=b.ha?Math.round(10*tr.length/b.ha)/10:null;b.v.krone=b.ha?Math.min(100,Math.round(1000*tr.reduce((s,t)=>s+crown(t[2]),0)/(b.ha*1e4))/10):null;
    const gen={};for(const t of tr){const n=official.genera[t[3]]||'?';gen[n]=(gen[n]||0)+1;}b.gattungen=Object.entries(gen).sort((p,q)=>q[1]-p[1]).slice(0,3);
    const in_=arr=>arr.filter(([la,lo])=>lo>=x0&&lo<=x1&&la>=y0&&la<=y1&&inPoly(lo,la,polys)).length;
    b.v.baenke=in_(furn.bank);b.v.picknick=in_(furn.picknicktafel);b.v.spiel=in_(furn.speelvoorziening);
    b.v.baenke1000=b.v.inw>0?Math.round(10000*b.v.baenke/b.v.inw)/10:null;
    // 200-m-Signatur gemittelt (für die Rosette)
    const cells=fusion.cells.filter(c=>inPoly(c.c[1],c.c[0],polys));b.sig=cells.length?fusion.cells[0].v.map((_,i)=>Math.round(cells.reduce((s,c)=>s+c.v[i],0)/cells.length)):null;b.cells=cells.length;
    b.s=samples(polys,5);out.push(b);}
  // Wärmeinsel (RIVM 2022) und Überflutungswahrscheinlichkeit (LIWO) an je bis zu 5 Stichproben
  const jobs=[];out.forEach((b,i)=>b.s.forEach(([lon,lat])=>jobs.push({i,lon,lat})));
  console.log(`  Abfragen RIVM/LIWO an ${jobs.length} Punkten …`);
  const UHI=await pool(jobs,4,j=>gfi('https://data.rivm.nl/geo/ank/wms','Stedelijk_hitte_eiland_effect_01062022_v2',j.lon,j.lat));
  const LH=await pool(jobs,4,j=>gfi('https://basisinformatie-overstromingen.nl/geoserver/ows','LIWO_Basis:plaatsgebonden_kans_totaal_huidig_20',j.lon,j.lat));
  const L50=await pool(jobs,4,j=>gfi('https://basisinformatie-overstromingen.nl/geoserver/ows','LIWO_Basis:plaatsgebonden_kans_totaal_2050_20',j.lon,j.lat));
  // Amtlicher Lärm (RIVM): Straßenverkehr Lden 2022 in dB (Mittel der Stichproben) + Belästigung je Buurt (GGD-Monitor 2024, Modell)
  const ALO='https://data.rivm.nl/geo/alo/wms';
  const LDEN=await pool(jobs,4,j=>gfi(ALO,'rivm_20250101_Geluid_lden_wegverkeer_2022',j.lon,j.lat));
  const first=out.map((b,i)=>jobs.find(j=>j.i===i));
  const HIN=await pool(first,4,j=>j?gfiProps(ALO,'rivm_20251201_geluidhinder_bu_weg_2024',j.lon,j.lat):null);
  // Hitze & Gesundheit je Buurt (Klimaateffectatlas: GGD-Gezondheidsmonitor 2024, RIVM-Modell)
  const KEA='https://cas.cloud.sogelink.com/public/data/org/gws/YWFMLMWERURF/kea_public/ows';
  const KOEL=await pool(first,4,j=>j?gfiProps(KEA,'SchaduwOpGebouwen_VerkoelingBinnen',j.lon,j.lat):null);
  const EENZ=await pool(first,4,j=>j?gfiProps(KEA,'nl_sterk_eenzaam_buurt_v20260722',j.lon,j.lat):null);
  const num=v=>{const n=typeof v==='string'?parseFloat(v.replace(',','.')):v;return typeof n==='number'&&isFinite(n)&&n>-50?n:null;};
  const pickKey=(o,re)=>{if(!o)return null;const k=Object.keys(o).find(k=>re.test(k));return k?num(o[k]):null;};
  out.forEach((b,i)=>{const pick=a=>jobs.map((j,k)=>j.i===i?a[k]:null).filter(v=>v!=null&&v>-50);
    const u=pick(UHI);b.v.uhi=u.length?Math.round(100*u.reduce((s,v)=>s+v,0)/u.length)/100:null;
    const h=pick(LH),f5=pick(L50);b.v.flut=h.length?Math.max(...h):null;b.v.flut2050=f5.length?Math.max(...f5):null;
    const ld=pick(LDEN).filter(v=>v>0);b.v.lden=ld.length?Math.round(ld.reduce((s,v)=>s+v,0)/ld.length):null;
    b.v.laermhinder=pickKey(HIN[i],/^b_gel_weg$/);b.v.schlaf=pickKey(HIN[i],/^b_sv_weg$/);
    b.v.kuehlinnen=pickKey(KOEL[i],/VerkoelingVindenBinnen/i);b.v.kuehlaussen=pickKey(KOEL[i],/VerkoelingVindenBuiten/i);b.v.einsam=pickKey(EENZ[i],/^sterk_eenzaam$/);
    delete b.s;});
  // CBS 2026: Anteil 80+ (nur in diesem Jahrgang)
  try{const j=await (await get("https://opendata.cbs.nl/ODataApi/odata/86358NED/TypedDataSet?$filter=startswith(WijkenEnBuurten,'BU0344')&$select=WijkenEnBuurten,AantalInwoners_5,k_80JaarOfOuder_13")).json();
    for(const r of j.value){const b=out.find(x=>x.code===r.WijkenEnBuurten.trim());if(b&&r.AantalInwoners_5>0&&r.k_80JaarOfOuder_13!=null){b.v.ue80=Math.round(1000*r.k_80JaarOfOuder_13/r.AantalInwoners_5)/10;b.y.ue80=2026;}}}catch(e){console.log('  80+: nicht verfügbar',e.message);}
  // Gemeente Utrecht: Grün und Kronendach je Buurt (Luftbildanalyse), Zuordnung über den Mittelpunkt
  try{const fs2=await arcgisAll(`${GU}/1_1_Percentage_groen_in_buurten__oppervlak_groen_en_bladerdek_van_bovenaf_bekeken_/FeatureServer/0`,'where=1%3D1&outFields=Naam_buurt,Percentage_groen,Percentage_bladerdek,Tekort_groen_inclusief_bladerde,Oppervlak_land&returnGeometry=true&outSR=4326&geometryPrecision=5');
    const agg={};for(const f of fs2){const a=f.attributes,rings=f.geometry&&f.geometry.rings;if(!rings)continue;const [x,y]=centroidOf(rings[0]),b=out.find(o=>inPoly(x,y,o.geom));if(!b)continue;const w=a.Oppervlak_land||1;
      const g=agg[b.code]||(agg[b.code]={w:0,gr:0,bl:0,tek:0,n:0});g.w+=w;g.gr+=w*a.Percentage_groen;g.bl+=w*a.Percentage_bladerdek;g.tek+=a.Tekort_groen_inclusief_bladerde||0;g.n++;}
    for(const b of out){const g=agg[b.code];if(!g)continue;b.v.gruen=Math.round(10*g.gr/g.w)/10;b.v.blatt=Math.round(10*g.bl/g.w)/10;b.v.gruenluecke=Math.round(Math.max(0,g.tek)/100)/100;}
    console.log(`  Gemeente Grün/Kronendach: ${fs2.length} Flächen → ${Object.keys(agg).length} Buurten`);}catch(e){console.log('  Gemeente Grün: nicht verfügbar',e.message);}
  // Gemeente Utrecht: Schatten auf Fuß- und Radwegen (je Wegabschnitt, flächengewichtet)
  try{const fs3=await arcgisAll(`${GU}/Schaduw_wegdelen/FeatureServer/1`,'where=1%3D1&outFields=area,area_schaduw&returnGeometry=false&returnCentroid=true&outSR=4326');
    const agg={};for(const f of fs3){const c=f.centroid,a=f.attributes;if(!c||!(a.area>0))continue;const b=out.find(o=>{const [x0,y0,x1,y1]=o._bb||(o._bb=bbox(o.geom));return c.x>=x0&&c.x<=x1&&c.y>=y0&&c.y<=y1&&inPoly(c.x,c.y,o.geom);});if(!b)continue;
      const g=agg[b.code]||(agg[b.code]={a:0,s:0});g.a+=a.area;g.s+=Math.min(a.area,a.area_schaduw||0);}
    for(const b of out){const g=agg[b.code];if(g&&g.a>0)b.v.wegschatten=Math.round(1000*g.s/g.a)/10;delete b._bb;}
    console.log(`  Schatten Wege: ${fs3.length} Abschnitte → ${Object.keys(agg).length} Buurten`);}catch(e){console.log('  Schatten Wege: nicht verfügbar',e.message);}
  // BAG: wo gerade gebaut wird (Status je Pand, ausgegeben von Gemeente 0344)
  const BOUW=[];try{const ST=['Bouwvergunning verleend','Bouw gestart','Verbouwing pand','Sloopvergunning verleend'];
    for(const st of ST){let url=`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?f=json&limit=1000&bbox=4.95,52.02,5.21,52.15&status=${encodeURIComponent(st)}`;
      for(let k=0;k<20&&url;k++){const j=await (await get(url)).json();for(const f of j.features||[]){const p=f.properties||{};if(!String(p.identificatie||'').startsWith('0344'))continue;const g=f.geometry,r=g&&(g.type==='Polygon'?g.coordinates[0]:g.type==='MultiPolygon'?g.coordinates[0][0]:null);if(!r)continue;const [x,y]=centroidOf(r);
        BOUW.push([Math.round(y*1e5)/1e5,Math.round(x*1e5)/1e5,ST.indexOf(st),p.bouwjaar||null,(p.documentdatum||'').slice(0,10)||null,p.aantal_verblijfsobjecten||null]);}
        const nx=(j.links||[]).find(l=>l.rel==='next');url=nx?nx.href:null;}}
    for(const b of out){const [x0,y0,x1,y1]=bbox(b.geom),mine=BOUW.filter(p=>p[1]>=x0&&p[1]<=x1&&p[0]>=y0&&p[0]<=y1&&inPoly(p[1],p[0],b.geom));b.bau=[0,1,2,3].map(i=>mine.filter(p=>p[2]===i).length);}
    fs.writeFileSync(path.join(ROOT,'public/data/official/bouw_utr.json'),JSON.stringify({meta:{title:'BAG — Panden mit Bau-/Abriss-Status (Gemeente Utrecht)',url:'https://api.pdok.nl/kadaster/bag/ogc/v2',fetched:today,status:ST,fields:['lat','lon','status','bouwjaar','documentdatum','verblijfsobjecten'],license:'CC0'},p:BOUW}));
    console.log(`  BAG Bau-Status: ${BOUW.length} Panden (${ST.map((s,i)=>s+' '+BOUW.filter(p=>p[2]===i).length).join(', ')})`);}catch(e){console.log('  BAG: nicht verfügbar',e.message);}

  const meta={title:'Quartiere (CBS-Buurten) Utrecht',fetched:today,
    sources:{cbs:{title:'CBS Kerncijfers wijken en buurten 2022–2024 (via PDOK)',url:'https://api.pdok.nl/cbs/wijken-en-buurten-2024/ogc/v1',license:'CC-BY 4.0'},
      trees:{title:'Gemeente Utrecht — Bomenkaart 2026'},furniture:{title:'Gemeente Utrecht — Straatmeubilair (BGT)'},
      uhi:{title:'RIVM — Stedelijk hitte-eiland effect 2022 (Atlas Natuurlijk Kapitaal)',def:'modellierte mittlere Lufttemperaturdifferenz Stadt–Umland im Sommer (Juni–August), °C',license:'Public Domain Mark 1.0'},
      liwo:{title:'LIWO plaatsgebonden overstromingskans > 20 cm (Rijkswaterstaat)',def:'Klasse 1–5 (extrem klein … groß), 2050: alle Primärdeiche auf Normniveau'},
      laerm:{title:'RIVM — Geluid Lden wegverkeer 2022 (dB) und Geluidhinder je Buurt (GGD-Gezondheidsmonitor 2024, Modell)',license:'Public Domain Mark 1.0'},
      gesundheit:{title:'Klimaateffectatlas — GGD-Gezondheidsmonitor 2024 (Abkühlung finden, starke Einsamkeit), RIVM-Modell'},
      gruen:{title:'Gemeente Utrecht — Percentage groen in buurten (Luftbild, groen + bladerdek)'},
      wegschatten:{title:'Gemeente Utrecht — Schaduw wegdelen (Fuß- und Radwege, Stand 2023; Berechnungszeitpunkt nicht angegeben)'},
      bouw:{title:'BAG — Panden mit Status Baugenehmigung, Bau gestartet, Umbau, Abrissgenehmigung',url:'https://api.pdok.nl/kadaster/bag/ogc/v2'}},
    fields:Object.fromEntries(Object.entries(F).map(([id,d])=>[id,{cbs:d.k||d.src,u:d.u,g:d.g,d:d.d,de:d.de,en:d.en,nl:d.nl,def:d.def||null}])),
    note:'Kein Medianeinkommen je Buurt verfügbar (CBS). −99997 (geheim) → null. Kronendach geschätzt aus Pflanzjahr; private Bäume fehlen. Wärmeinsel und Überflutung als Stichprobe (bis 5 Punkte je Buurt).'};
  fs.writeFileSync(OUT,JSON.stringify({meta,buurten:out}));
  const cov=id=>out.filter(b=>b.v[id]!=null).length;
  const cov2=id=>out.filter(b=>b.v[id]!=null).length;console.log(`  Abdeckung neu: Lden ${cov2('lden')}, Lärmbelästigung ${cov2('laermhinder')}, Abkühlung ${cov2('kuehlinnen')}, Einsamkeit ${cov2('einsam')}, 80+ ${cov2('ue80')}, Gemeente-Grün ${cov2('blatt')}, Wegeschatten ${cov2('wegschatten')}`);
  console.log(`  geschrieben: ${out.length} Buurten, ${(fs.statSync(OUT).size/1024).toFixed(0)} KB · Abdeckung: niedrig ${cov('niedrig')}, Vermögen ${cov('vermoegen')}, Ø Einkommen ${cov('einkommen')}, Wärmeinsel ${cov('uhi')}, Flut ${cov('flut')}`);
  console.log(`  Einwohner Summe: ${out.reduce((s,b)=>s+(b.v.inw||0),0)} · Bäume Summe: ${out.reduce((s,b)=>s+b.v.baeume,0)} · Bänke Summe: ${out.reduce((s,b)=>s+b.v.baenke,0)}`);
})().catch(e=>{console.error('FEHLER:',e.message);process.exit(1);});

// ══════════════════════════════════════════════════════════════
// Straßenlabor · Maßnahmen im Straßen-Werkzeug: aus dem echten Querschnitt
// (BGT-Breiten, 3D BAG, Baumregister) abgeleitet, je 100 m Straße gerechnet —
// Bäume statt Parkplätze, Wadi/Schwammstraße, schmalere Fahrbahn, helle Beläge.
// Dazu Gelegenheiten: geplante Kanalerneuerung (Gemeente Utrecht, Planung 2024),
// Klimaknelpunte der Gemeente und die Klimabelastung des Quartiers.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api||!LAB.street)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n),ST=LAB.street;
const RIO='https://services-eu1.arcgis.com/SMnoOtmU2UWf0vRp/arcgis/rest/services/';
const CX={key:'',riool:null,lang:null,kp:null,buurt:null};
let RAHMEN=null,rahmenLoad=null;   // Kosten, Förderung, Regelwerk (data/rahmen_utr.json, recherchiert mit Quellen)
const rahmen=()=>rahmenLoad||(rahmenLoad=fetch('data/rahmen_utr.json').then(r=>r.ok?r.json():null).catch(()=>null).then(j=>(RAHMEN=j)));
const YNOW=new Date().getFullYear();

// ── Umfeld des Querschnitts: Kanal, Knelpunt, Quartier ──
async function context(S){
  rahmen();
  const key=S.ll.lat.toFixed(5)+','+S.ll.lng.toFixed(5);if(CX.key===key)return CX;CX.key=key;CX.riool=CX.lang=CX.kp=CX.buurt=null;
  const [a,b]=S.ends,pad=.00025,env=[Math.min(a[1],b[1])-pad,Math.min(a[0],b[0])-pad,Math.max(a[1],b[1])+pad,Math.max(a[0],b[0])+pad].join(',');
  const q=(svc,f)=>fetch(`${RIO}${svc}/FeatureServer/0/query?geometry=${env}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${f}&returnGeometry=false&f=json`).then(r=>r.json()).then(j=>(j.features||[]).map(x=>x.attributes)).catch(()=>null);
  const [r1,r2]=await Promise.all([q('Rioolvervanging2024_20240411','Planjaar,Leiding_ty,Projectnaa'),q('Rioolvervanging2024_langetermijn20412050_20240411','Planjaar')]);
  const hits=(r1||[]).filter(x=>+x.Planjaar>=YNOW-1&&+x.Planjaar<=2040).sort((p,q2)=>p.Planjaar-q2.Planjaar);
  CX.riool=hits.length?+hits[0].Planjaar:null;CX.proj=hits.length&&String(hits[0].Projectnaa||'').trim()||null;CX.lang=r2&&r2.length?true:null;
  try{const kp=LAB.water&&await LAB.water.knelpunten();if(kp){const [wx,wy]=A.w20(S.ll.lat,S.ll.lng);
    CX.kp=kp.filter(k=>k.rings.some(r=>{const z=new Float64Array(r.length*2);r.forEach((p,i)=>{z[2*i]=p[0];z[2*i+1]=p[1];});return A.inPoly(wx,wy,z);}));}}catch(e){}
  const o=A.opt();CX.buurt=o.buurtAt?o.buurtAt(S.ll.lat,S.ll.lng):null;
  return CX;
}

// ── Maßnahmen aus dem Querschnitt ──
const heatOf=(S,alb)=>{const W=S.segs.reduce((p,s)=>p+s.w,0)||1;let h=0;S.segs.forEach((s,i)=>{const a=alb&&alb[i]!=null?alb[i]:s.a;h+=s.w*(1-a)*s.F;});return Math.round(100*Math.min(1,h/W/.92));};
function plan(){
  const S=ST.SEC;if(!S||S.err)return [];
  const segs=S.segs,W=segs.reduce((p,s)=>p+s.w,0)||1,base=segs.map(s=>s.t),mb=ST.metrics(null),out=[];
  const parks=segs.map((s,i)=>({s,i})).filter(o=>o.s.t==='park'&&o.s.w>=1.5);
  const carW=segs.filter(s=>s.t==='car').reduce((p,s)=>p+s.w,0),hasTransit=segs.some(s=>s.t==='transit');
  const lost=parks.reduce((n,o)=>n+(o.s.w>=4.2?Math.round(100/2.6):Math.round(100/5.6)),0);   // senkrecht ≈ 2,6 m, längs ≈ 5,6 m je Stellplatz
  const parkA=Math.round(parks.reduce((p,o)=>p+o.s.w*100,0));
  const water=CX.kp&&CX.kp.some(k=>k.l!==1),heat=CX.kp&&CX.kp.some(k=>k.l===1);
  const fx=(ma)=>[
    ma.canopy-mb.canopy>=1?{k:'up',t:T(`Kronendach +${Math.round(ma.canopy-mb.canopy)} Pp.`,`canopy +${Math.round(ma.canopy-mb.canopy)} pp`,`kronendak +${Math.round(ma.canopy-mb.canopy)} pp`)}:null,
    mb.sealed-ma.sealed>=1?{k:'up',t:T(`versiegelt −${Math.round(mb.sealed-ma.sealed)} Pp.`,`sealed −${Math.round(mb.sealed-ma.sealed)} pp`,`verhard −${Math.round(mb.sealed-ma.sealed)} pp`)}:null,
    mb.heat-ma.heat>=1?{k:'up',t:T(`Aufheizung −${mb.heat-ma.heat}`,`surface heating −${mb.heat-ma.heat}`,`opwarming −${mb.heat-ma.heat}`)}:null].filter(Boolean);
  if(parks.length){
    const ed=base.slice();parks.forEach(o=>ed[o.i]='trees');const ma=ST.metrics(ed),n=parks.length*Math.round(100/9);
    out.push({id:'trees',mu:'M3',w:(mb.canopy<15?3:1.5)+(heat?1:0),ed,n,
      t:T('Bäume statt Parkplätze','Trees instead of parking','Bomen in plaats van parkeren'),
      why:T(`Kronendach im Schnitt heute ${Math.round(mb.canopy)} % — Ziel im Quartier 30 %. Die Parkspur ist der Platz, an dem Bäume am leichtesten Wurzeln finden.`,`Canopy across the cut today ${Math.round(mb.canopy)} % — neighbourhood target 30 %. The parking lane is where trees most easily find root space.`,`Kronendak in het profiel nu ${Math.round(mb.canopy)} % — doel in de buurt 30 %. De parkeerstrook is waar bomen het makkelijkst wortelruimte vinden.`),
      q:[[n,T('Bäume','trees','bomen')],[A.fmt(parkA)+' m²',T('entsiegelt','unsealed','onthard')]],fx:fx(ma),
      x:T(`Abwägung: ≈ ${lost} Parkplätze weniger je 100 m`,`Trade-off: ≈ ${lost} fewer parking spaces per 100 m`,`Afweging: ≈ ${lost} parkeerplaatsen minder per 100 m`)});
    const ed2=base.slice();parks.forEach(o=>ed2[o.i]='green');const ma2=ST.metrics(ed2),sto=Math.round(parks.reduce((p,o)=>p+o.s.w*100*.3*.6,0)),mm=Math.round(sto/(W*100)*1000);
    out.push({id:'wadi',mu:'M3',w:(water?3.2:1.2),ed:ed2,area:Math.round(parkA*.6),
      t:T('Wadi statt Parkplätze — Schwammstraße','Swale instead of parking — sponge street','Wadi in plaats van parkeren — sponsstraat'),
      why:water?T('Die Gemeente führt hier einen Klimaknelpunt für Wasser. Eine bepflanzte Mulde nimmt Regen auf, bevor er in Keller und Hauseingänge läuft.','The municipality lists a water hotspot here. A planted swale takes in rain before it runs into basements and entrances.','De gemeente noemt hier een waterknelpunt. Een beplante wadi vangt regen op voordat die kelders en entrees in loopt.'):T('Eine bepflanzte Mulde hält Regen in der Straße, kühlt durch Verdunstung und entlastet den Kanal.','A planted swale keeps rain in the street, cools by evaporation and relieves the sewer.','Een beplante wadi houdt regen in de straat, koelt door verdamping en ontlast het riool.'),
      q:[[A.fmt(parkA)+' m²',T('entsiegelt','unsealed','onthard')],[A.fmt(sto)+' m³',T('Regen zurückhalten','rain held back','regen vasthouden')],[mm+' mm',T('Regen auf dem ganzen Straßenraum','of rain over the whole street','regen over de hele straat')]],fx:fx(ma2),
      x:T(`Abwägung: ≈ ${lost} Parkplätze weniger · Mulde 30 cm tief, etwa 60 % der Fläche nutzbar`,`Trade-off: ≈ ${lost} fewer parking spaces · swale 30 cm deep, about 60 % of the area usable`,`Afweging: ≈ ${lost} parkeerplaatsen minder · wadi 30 cm diep, ongeveer 60 % bruikbaar`)});}
  if(carW>6.6&&!hasTransit){const gain=Math.round((carW-5.5)*10)/10,share=gain/W;
    out.push({id:'narrow',mu:'M3',w:1.4+(share>.15?1:0),ed:null,area:Math.round(gain*100),
      t:T('Fahrbahn schmaler — Grün dazu','Narrower carriageway — add green','Smallere rijbaan — groen erbij'),
      why:T(`Die Fahrbahn ist ${A.nf(carW,1)} m breit. Für Gegenverkehr in einer Wohnstraße reichen etwa 5,5 m.`,`The carriageway is ${A.nf(carW,1)} m wide. About 5.5 m is enough for two-way traffic in a residential street.`,`De rijbaan is ${A.nf(carW,1)} m breed. Voor tweerichtingsverkeer in een woonstraat volstaat ongeveer 5,5 m.`),
      q:[[A.nf(gain,1)+' m',T('Breite frei','width freed','breedte vrij')],[A.fmt(gain*100)+' m²',T('je 100 m für Grün oder Bäume','per 100 m for green or trees','per 100 m voor groen of bomen')]],
      fx:[{k:'up',t:T(`versiegelt −${Math.round(100*share)} Pp.`,`sealed −${Math.round(100*share)} pp`,`verhard −${Math.round(100*share)} pp`)},gain>=2?{k:'up',t:T('Platz für eine Baumreihe','room for a row of trees','ruimte voor een bomenrij')}:null].filter(Boolean),
      x:T('Abwägung: langsamerer Autoverkehr; Busse und Rettungswege prüfen','Trade-off: slower car traffic; check buses and emergency access','Afweging: langzamer autoverkeer; bussen en hulpdiensten controleren')});}
  const dark=segs.map((s,i)=>({s,i})).filter(o=>['walk','bike','park','shared','paved'].includes(o.s.t)&&o.s.a<.12);
  if(dark.length){const alb=segs.map(()=>null);dark.forEach(o=>alb[o.i]=.3);const h0=heatOf(S),h1=heatOf(S,alb),area=Math.round(dark.reduce((p,o)=>p+o.s.w*100,0));
    out.push({id:'light',mu:'M1',w:.5+(heat?.4:0),ed:null,   // zurückgestuft: Maatlat hat helle Oberflächen 2025 gestrichen, Wirkung auf gefühlte Temperatur umstritten
      t:T('Helle Beläge auf Wegen und Stellplätzen','Light paving on paths and parking','Lichte verharding op paden en parkeerplekken'),
      why:T('Dunkler Asphalt wirft kaum Sonnenlicht zurück und heizt sich an Sommertagen stark auf. Helle Klinker oder Platten reflektieren mehr.','Dark asphalt reflects little sunlight and heats up strongly on summer days. Light pavers or slabs reflect more.','Donker asfalt kaatst weinig zonlicht terug en warmt sterk op. Lichte klinkers of tegels weerkaatsen meer.'),
      q:[[A.fmt(area)+' m²',T('heller belegt','repaved lighter','lichter bestraat')]],fx:h0>h1?[{k:'up',t:T(`Aufheizung −${h0-h1}`,`surface heating −${h0-h1}`,`opwarming −${h0-h1}`)}]:[],
      x:T('Albedo 0,08 → 0,30 (Literaturwerte). Ehrlich: Die Landelijke Maatlat hat helle Oberflächen im April 2025 gestrichen, ob die gefühlte Temperatur sinkt, ist umstritten — Schatten wirkt stärker.','Albedo 0.08 → 0.30 (literature values). Honestly: the national Maatlat dropped light surfaces in April 2025, and whether felt temperature drops is disputed — shade works better.','Albedo 0,08 → 0,30 (literatuur). Eerlijk: de Landelijke Maatlat schrapte lichte oppervlakken in april 2025; of de gevoelstemperatuur daalt is omstreden — schaduw werkt beter.'),area});}
  const walks=segs.map((s,i)=>({s,i})).filter(o=>(o.s.t==='walk'||o.s.t==='shared')&&o.s.w>=4.5);
  if(!parks.length&&walks.length&&mb.canopy<30){const ed=base.slice();ed[walks[0].i]='trees';const ma=ST.metrics(ed);
    out.push({id:'walktrees',mu:'M4',w:1.6+(heat?.8:0),ed,n:Math.round(100/9),
      t:T('Bäume am breiten Gehweg','Trees on the wide pavement','Bomen op de brede stoep'),
      why:T(`Der Gehweg ist ${A.nf(walks[0].s.w,1)} m breit — genug für Baumscheiben und Sitzplätze im Schatten, mit mindestens 2 m Durchgang.`,`The pavement is ${A.nf(walks[0].s.w,1)} m wide — enough for tree pits and shaded seating, keeping at least 2 m clear.`,`De stoep is ${A.nf(walks[0].s.w,1)} m breed — genoeg voor boomspiegels en zitplekken in de schaduw, met minstens 2 m doorgang.`),
      q:[[Math.round(100/9),T('Bäume','trees','bomen')]],fx:fx(ma),x:T('Abwägung: Leitungen im Gehweg prüfen (Kabel, Rohre)','Trade-off: check utilities under the pavement (cables, pipes)','Afweging: kabels en leidingen onder de stoep controleren')});}
  // Geveltuin nach Utrechter Regel: bis 60 cm tief ohne Genehmigung, mindestens 1,20 m Gehweg bleiben frei (utrecht.nl/geveltuin)
  const fac=[];if(!S.open[0]&&segs[0]&&(segs[0].t==='walk'||segs[0].t==='shared')&&segs[0].w>=1.5)fac.push(0);
  const li=segs.length-1;if(!S.open[1]&&li>0&&(segs[li].t==='walk'||segs[li].t==='shared')&&segs[li].w>=1.5)fac.push(li);
  if(fac.length){const dep=fac.map(i=>Math.min(.6,segs[i].w-1.2)),m2=Math.round(dep.reduce((s2,d)=>s2+d,0)*100*.8);   // 80 % der Fassadenlänge (Türen, Einfahrten frei)
    out.push({id:'gevel',mu:'M1',w:.9+(mb.green<10?.6:0),ed:null,
      t:T('Fassadengärten (Geveltuinen)','Façade gardens (geveltuinen)','Geveltuinen'),
      why:T('Eine Reihe Platten an der Hauswand raus, Pflanzen und Kletterpflanzen rein: kühlt die Fassade, lässt Regen versickern — Anwohner können das selbst, die Gemeente erlaubt es.','Lift one row of tiles along the house wall and plant: cools the façade and lets rain soak in — residents can do this themselves, the municipality allows it.','Eén rij tegels langs de gevel eruit, planten erin: koelt de gevel en laat regen wegzakken — bewoners kunnen dit zelf, de gemeente staat het toe.'),
      q:[[A.fmt(m2)+' m²',T('entsiegelt','unsealed','onthard')],[fac.length===2?T('beide Seiten','both sides','beide kanten'):T('eine Seite','one side','één kant'),T(`bis ${A.nf(Math.max(...dep)*100,0)} cm tief`,`up to ${A.nf(Math.max(...dep)*100,0)} cm deep`,`tot ${A.nf(Math.max(...dep)*100,0)} cm diep`)]],
      fx:[{k:'up',t:T('Fassade kühler','cooler façade','koelere gevel')}],x:T('Utrechter Regel: bis 60 cm tief, 1,20 m Gehweg bleiben frei, 0,9 m Abstand zu Laternen','Utrecht rule: up to 60 cm deep, 1.20 m of pavement stays clear, 0.9 m from lamp posts','Utrechtse regel: tot 60 cm diep, 1,20 m stoep blijft vrij, 0,9 m afstand tot lantaarnpalen'),n:fac.length*Math.round(100/5.5)});}   // ≈ ein Haus je 5,5 m
  return out.sort((a,b)=>b.w-a.w);
}

// ── Kosten, Förderung, Regelwerk je Maßnahme (aus data/rahmen_utr.json) ──
const tx=o=>o?(o[A.lang()]||o.de||o.en||''):'';
const rnd=v=>v>=100000?Math.round(v/10000)*10000:v>=10000?Math.round(v/1000)*1000:Math.round(v/100)*100;
function rahmenOf(m){
  const R=RAHMEN;if(!R||!R.massnahmen)return '';const x=R.massnahmen.find(q=>q.id===m.id);if(!x)return '';
  const k=x.kosten||{},unit=tx(k.einheit).replace(/^\s*€\s*/,''),perM2=/m²/.test(k.einheit&&k.einheit.de||''),qty=perM2?m.area:m.n;let cost='';
  if(k.lo!=null&&qty)cost=`<p class="ms-cost"><b>≈ ${A.fmt(rnd(k.lo*qty))}–${A.fmt(rnd(k.hi*qty))} €</b> ${T('je 100 m','per 100 m','per 100 m')} <small>(${A.fmt(k.lo)}–${A.fmt(k.hi)} € ${unit}${k.quelle?` · <a href="${k.quelle}" target="_blank" rel="noopener">${T('Quelle','source','bron')}</a>`:''})</small></p>`;
  else if(k.lo!=null)cost=`<p class="ms-cost"><b>${A.fmt(k.lo)}–${A.fmt(k.hi)} €</b> <small>${unit}</small></p>`;
  const ORD={offen:0,laufend:1,ungeklaert:2,geschlossen:3},fo=(x.foerder||[]).map(id=>R.foerder.find(f=>f.id===id)).filter(Boolean).sort((a,b)=>(ORD[a.status]??4)-(ORD[b.status]??4));
  const SN={offen:T('offen','open','open'),laufend:T('läuft','running','lopend'),geschlossen:T('geschlossen','closed','gesloten'),ungeklaert:T('Status unklar','status unclear','status onduidelijk')};
  const no=(x.normen||[]).map(id=>R.normen.find(n=>n.id===id)).filter(Boolean);
  return `${cost}${fo.length?`<p class="ms-fo"><span>${T('Förderung','Funding','Subsidie')}</span>${fo.map(f=>`<a class="${f.status}" href="${f.quelle}" target="_blank" rel="noopener" title="${(f.frist||'').replace(/"/g,'')}">${tx(f.titel)} <em>${SN[f.status]||f.status}</em>${f.geprueft===false?` <em>${T('ungeprüft','unverified','ongecontroleerd')}</em>`:''}</a>`).join('')}</p>`:''}
    ${no.length?`<p class="ms-no"><span>${T('Regelwerk','Rules','Regels')}</span>${no.map(n=>`<a href="${n.quelle}" target="_blank" rel="noopener">${tx(n.titel)}${n.verbindlich==='ja'?` <em>${T('verbindlich','binding','bindend')}</em>`:''}${n.geprueft===false?` <em>${T('ungeprüft','unverified','ongecontroleerd')}</em>`:''}</a>`).join('')}</p>`:''}
    ${(x.hemmnisse||[]).length?`<details class="ms-ah"><summary>${T('Anreize und Hemmnisse','Incentives and barriers','Prikkels en belemmeringen')}</summary>${(x.anreize||[]).map(a=>`<p class="pro">+ ${tx(a)}</p>`).join('')}${(x.hemmnisse||[]).map(h=>`<p class="con">− ${tx(h)}</p>`).join('')}</details>`:''}`;
}

// ── Darstellung ──
function html(){
  const S=ST.SEC;if(!S||S.err)return '';const ms=plan(),MU=(A.opt().muster&&A.opt().muster())||[],L=A.lang();
  const ops=[];
  if(CX.riool)ops.push(`<p class="ms-op"><b>${T(`Kanalerneuerung ${CX.riool} geplant`,`Sewer renewal planned for ${CX.riool}`,`Rioolvervanging gepland in ${CX.riool}`)}${CX.proj?` · ${CX.proj}`:''}</b> — ${T('dann ist die Straße ohnehin offen. Bäume, Wadi und Entsiegelung lassen sich günstig mitbauen.','the street will be opened anyway. Trees, swales and unsealing can be built at the same time for less.','de straat gaat dan toch open. Bomen, wadi en ontharding kunnen goedkoper meegenomen worden.')} <small>Gemeente Utrecht, ${T('Planung','planning','planning')} 2024</small></p>`);
  else if(CX.lang)ops.push(`<p class="ms-op soft">${T('Kanalerneuerung hier langfristig vorgesehen (2041–2050).','Sewer renewal here planned for the long term (2041–2050).','Rioolvervanging hier op lange termijn gepland (2041–2050).')} <small>Gemeente Utrecht</small></p>`);
  if(CX.kp&&CX.kp.length)ops.push(...CX.kp.map(k=>`<p class="ms-op kp"><b>${k.name}</b>: ${k.l===0?T('Straße bei Starkregen unpassierbar','road impassable in heavy rain','weg onbegaanbaar bij hevige neerslag'):k.l===2?T('Wasserschäden an Gebäuden','water damage to buildings','waterschade aan panden'):T('Hitzestress','heat stress','hittestress')} <small>${T('Klimaknelpunt der Gemeente','municipal climate hotspot','klimaatknelpunt gemeente')}</small></p>`));
  const NX=window.__NX,b=CX.buurt;if(b&&NX&&NX.score){const sc=NX.score(b),g=NX.grade(sc);if(sc!=null)ops.push(`<p class="ms-op soft">${T('Quartier','Neighbourhood','Buurt')} <b>${b.name}</b>: ${T('Klimabelastung','climate burden','klimaatbelasting')} ${Math.round(sc)}/100 (${'ABCDE'[g]})</p>`);}
  if(!ms.length)return `<div class="ms"><div class="ms-h">${T('Maßnahmen','Measures','Maatregelen')}</div>${ops.join('')}<p class="lab-hint">${T('Für diesen Querschnitt schlägt das Labor nichts vor: keine Parkspur, keine überbreite Fahrbahn, keine dunklen Wege. Mit „Umbauen" kannst du trotzdem Flächen tauschen.','The lab suggests nothing for this cross-section: no parking lane, no oversized carriageway, no dark paths. You can still swap areas with “Redesign”.','Het lab stelt voor dit profiel niets voor: geen parkeerstrook, geen te brede rijbaan, geen donkere paden. Met „Herinrichten" kun je toch vlakken wisselen.')}</p></div>`;
  return `<div class="ms"><div class="ms-h">${T('Maßnahmen für diesen Straßenraum','Measures for this street','Maatregelen voor deze straat')}<small>${T('je 100 m Straße','per 100 m of street','per 100 m straat')}</small></div>${ops.join('')}
    ${ms.map((m,k)=>{const mu=MU.find(x=>x.id===m.mu);return `<article class="ms-c${k===0?' top':''}">
      <div class="ms-t">${k===0?`<em>${T('passt hier am besten','fits best here','past hier het best')}</em>`:''}<b>${m.t}</b></div>
      <p class="ms-why">${m.why}</p>
      <div class="ms-q">${m.q.map(([v,l])=>`<span><b>${v}</b>${l}</span>`).join('')}</div>
      ${m.fx.length?`<div class="ms-e">${m.fx.map(f=>`<i class="${f.k}">${f.t}</i>`).join('')}</div>`:''}
      <p class="ms-x">${m.x}</p>${rahmenOf(m)}
      <div class="ms-a">${m.ed?`<button class="cta ghost lab-mini" data-ms="${m.id}">${T('Im Querschnitt zeigen','Show in the cross-section','Toon in het profiel')}</button>`:''}${mu?`<span class="ms-mu">${T('Muster','Pattern','Patroon')} ${mu.id}: ${mu.n[L]||mu.n.de}</span>`:''}</div></article>`;}).join('')}
    <p class="ms-n">${RAHMEN?T('Mengen je 100 m Straße aus den gemessenen Breiten. Kosten sind Spannen aus niederländischen Quellen (verschiedene Jahre), keine Utrechter Einheitspreise; Förderstatus Stand ','Quantities per 100 m of street from the measured widths. Costs are ranges from Dutch sources (various years), not Utrecht unit rates; funding status as of ','Hoeveelheden per 100 m straat uit de gemeten breedtes. Kosten zijn bandbreedtes uit Nederlandse bronnen (verschillende jaren), geen Utrechtse eenheidsprijzen; subsidiestatus per ')+RAHMEN.meta.stand+'. '+T('Keine Rechtsberatung.','Not legal advice.','Geen juridisch advies.'):T('Mengen je 100 m Straße aus den gemessenen Breiten; Kronendach und Aufheizung wie in der Tabelle oben. Kosten fehlen bewusst: dafür braucht es örtliche Kostensätze der Gemeente.','Quantities per 100 m of street from the measured widths; canopy and surface heating as in the table above. Costs are deliberately missing: they need local municipal unit rates.','Hoeveelheden per 100 m straat uit de gemeten breedtes; kronendak en opwarming zoals in de tabel. Kosten ontbreken bewust: daarvoor zijn lokale eenheidsprijzen van de gemeente nodig.')}</p></div>`;
}
function bind(root){
  root.querySelectorAll('[data-ms]').forEach(el=>el.onclick=()=>{const m=plan().find(x=>x.id===el.dataset.ms);if(!m||!m.ed)return;ST.EDIT=m.ed.slice();A.rerender();A.req();
    const sx=document.querySelector('.lab-body .sx');if(sx&&sx.scrollIntoView)sx.scrollIntoView({behavior:'smooth',block:'center'});});
}
LAB.measures={html,bind,plan,context,CX,rahmen,get RAHMEN(){return RAHMEN}};
})();

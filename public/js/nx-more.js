// ══════════════════════════════════════════════════════════════
// Mehr — was aus der klassischen Ansicht noch fehlte, neu und übersichtlicher:
//  Methodik          wie die Noten entstehen, Grenzen, Quellen, Begriffe
//  Alle Quartiere    Tabelle (sortierbar, filterbar), Ranglisten, Vergleich, Merkliste, CSV
//  Begriffe          Fachwörter zum Antippen (Maatlat, Wadi, Pp. …) — überall in Panel, Legende, Labor
//  Befehle (⌘K)      Quartier, Werkzeug, Mission, Seite, Sprache — alles mit der Tastatur
//  Hitze-Hinweis     Open-Meteo-Vorhersage, keine amtliche Warnung (amtlich: KNMI)
//  Quartiers-Bericht PDF je Quartier
//  Mitwirken         Meldungen auf der Karte; ohne Server ehrlich auf dem Gerät gespeichert
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const NX=()=>window.__NX;if(!NX())return;
const T=(...a)=>NX().T(...a),L_=()=>NX().lang(),F=v=>NX().fmt(v),N=(v,d)=>NX().nf(v,d);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ST={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
const tn=r=>T(r.de,r.en,r.nl);
const sv=(p,w)=>`<svg width="${w||18}" height="${w||18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC={
  x:sv('<path d="M6 6l12 12M18 6 6 18"/>',16),
  star:sv('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>'),
  starOn:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>',
  doc:sv('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  flag:sv('<path d="M5 21V4h11l-1.5 4L16 12H5"/>'),
  cmp:sv('<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/>'),
  search:sv('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  grid:sv('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  book:sv('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M9 8h7M9 12h5"/>'),
  therm:sv('<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"/>'),
  dl:sv('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  chev:sv('<path d="m9 6 6 6-6 6"/>',16),
  map:sv('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2Z"/><path d="M9 4v14M15 6v14"/>'),
  tool:sv('<circle cx="17" cy="6" r="3"/><path d="M3 21V11h6v10M9 21h12l-6-7H9"/>'),
  lang:sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>')
};
const M=window.NXM={};
const gchip=(v,i)=>{const X=NX(),g=i!=null?i:X.grade(v),c=X.scol(i!=null?[7.5,22.5,37.5,52.5,67.5][i]:v);return `<span class="nxg${g>=3?' lt':''}" style="--c:${c}">${X.GR[g][1]}</span>`;};

// ══ Fenster (HIG: Sheet für eine abgeschlossene Aufgabe; Escape, Fokus bleibt drin, Fokus kehrt zurück) ══
let SH=null;
function sheet(id,title,body,wide){
  close(true);
  const prev=document.activeElement,ov=document.createElement('div');ov.className='nxs-ov';ov.id='nxSheet';
  ov.innerHTML=`<div class="nxs${wide?' wide':''}" role="dialog" aria-modal="true" aria-labelledby="nxsT" data-s="${id}"><div class="nxs-h"><h2 id="nxsT">${title}</h2><button class="close nxs-x" aria-label="${T('Schließen','Close','Sluiten')}">${IC.x}</button></div><div class="nxs-b">${body}</div></div>`;
  document.body.appendChild(ov);SH={id,ov,prev};
  ov.addEventListener('pointerdown',e=>{if(e.target===ov)close();});
  ov.querySelector('.nxs-x').onclick=()=>close();
  ov.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.stopPropagation();close();return;}
    if(e.key!=='Tab')return;const f=[...ov.querySelectorAll('button,a[href],input,select,[tabindex="0"]')].filter(x=>!x.disabled&&x.offsetParent!==null);if(!f.length)return;
    const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}});
  setTimeout(()=>{const x=ov.querySelector('.nxs-x');if(x)x.focus();},0);
  return ov.querySelector('.nxs-b');
}
function close(silent){if(!SH)return;const {ov,prev}=SH;SH=null;ov.remove();if(!silent&&prev&&prev.focus)try{prev.focus();}catch(e){}}
function toast(html,ms){let t=document.getElementById('nxToast');if(!t){t=document.createElement('div');t.id='nxToast';t.className='nxtoast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.innerHTML=html;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),ms||6000);}

// ══ Begriffe (Glossar) ══
const GL={
  klimabelastung:[['Klimabelastung','Climate burden','Klimaatbelasting'],['0 bis 100 Punkte je Quartier aus Hitze, Verkehrslärm, Kronendach und Schatten auf Wegen. Je höher, desto stärker belastet.','0 to 100 points per neighbourhood from heat, traffic noise, tree canopy and shade on paths. Higher means more burdened.','0 tot 100 punten per buurt uit hitte, verkeerslawaai, kronendak en schaduw op routes. Hoe hoger, hoe zwaarder belast.']],
  richtwert:[['Richtwert','Guideline','Richtwaarde'],['Ein anerkannter Zielwert, zum Beispiel von der WHO oder aus der niederländischen Maatlat. Kein Gesetz, aber ein Maßstab.','A recognised target value, for example from the WHO or the Dutch Maatlat. Not a law, but a benchmark.','Een erkende streefwaarde, bijvoorbeeld van de WHO of uit de Maatlat. Geen wet, wel een maatstaf.']],
  uhi:[['Wärmeinsel','Urban heat island','Hitte-eiland'],['Wie viel wärmer es in der Stadt im Sommermittel ist als im Umland. Modell des RIVM, 2022.','How much warmer the city is than the surrounding countryside on an average summer day. RIVM model, 2022.','Hoeveel warmer de stad gemiddeld in de zomer is dan het buitengebied. RIVM-model, 2022.']],
  lden:[['L<sub>den</sub>','L<sub>den</sub>','L<sub>den</sub>'],['Lärm über 24 Stunden gemittelt. Abends zählt jeder Dezibel 5 dB mehr, nachts 10 dB mehr, weil Lärm dann stärker stört.','Noise averaged over 24 hours. Evening noise counts 5 dB extra and night noise 10 dB extra, because it disturbs more then.','Geluid gemiddeld over 24 uur. \'s Avonds telt het 5 dB extra, \'s nachts 10 dB, omdat het dan meer stoort.']],
  krone:[['Kronendach','Tree canopy','Kronendak'],['Anteil der Fläche, die von oben gesehen unter Baumkronen liegt. Gemessen auf Luftbildern.','Share of the ground that lies under tree crowns when seen from above. Measured on aerial photos.','Aandeel van de grond dat van bovenaf onder boomkronen ligt. Gemeten op luchtfoto\'s.']],
  r33:[['3-30-300-Regel','3-30-300 rule','3-30-300-regel'],['Faustregel für grüne Städte: 3 Bäume vom Fenster aus sehen, 30 % Kronendach im Quartier, höchstens 300 m bis zum nächsten Park.','Rule of thumb for green cities: see 3 trees from your window, 30 % canopy in the neighbourhood, at most 300 m to the nearest park.','Vuistregel voor groene steden: 3 bomen zien vanuit je raam, 30 % kronendak in de buurt, hooguit 300 m naar het dichtstbijzijnde park.']],
  maatlat:[['Maatlat','Maatlat','Maatlat'],['„Landelijke Maatlat groene klimaatadaptieve gebouwde omgeving" (2024): nationale Zielwerte der Niederlande für Grün, Hitze und Wasser, zum Beispiel 40 % Schatten auf Wegen.','"Landelijke Maatlat" (2024): the Dutch national targets for green, heat and water, for example 40 % shade on paths.','Landelijke Maatlat groene klimaatadaptieve gebouwde omgeving (2024): landelijke streefwaarden voor groen, hitte en water, zoals 40 % schaduw op routes.']],
  liwo:[['LIWO','LIWO','LIWO'],['Informationssystem von Rijkswaterstaat zu Wasser und Überflutungen. Klassen von „extrem klein" bis „groß" geben an, wie wahrscheinlich mehr als 20 cm Wasser sind.','Rijkswaterstaat\'s information system on water and flooding. Classes from "extremely small" to "large" say how likely more than 20 cm of water is.','Informatiesysteem van Rijkswaterstaat over water en overstromingen. Klassen van „extreem klein" tot „groot" geven aan hoe waarschijnlijk meer dan 20 cm water is.']],
  tropentag:[['Tropentag','Tropical day','Tropische dag'],['Ein Tag mit über 30 °C.','A day above 30 °C.','Een dag boven 30 °C.']],
  tropennacht:[['Tropennacht','Tropical night','Tropische nacht'],['Eine Nacht, in der es nicht unter 20 °C abkühlt. Dann erholt sich der Körper schlecht.','A night that does not cool below 20 °C. The body then recovers poorly.','Een nacht waarin het niet onder 20 °C afkoelt. Het lichaam herstelt dan slecht.']],
  pp:[['Prozentpunkte (Pp.)','Percentage points (pp)','Procentpunten (pp)'],['Unterschied zwischen zwei Prozentwerten: von 16 % auf 41 % sind +25 Prozentpunkte.','Difference between two percentages: from 16 % to 41 % is +25 percentage points.','Verschil tussen twee percentages: van 16 % naar 41 % is +25 procentpunten.']],
  wadi:[['Wadi','Wadi (swale)','Wadi'],['Flache, begrünte Mulde, in der Regenwasser versickert, statt in den Kanal zu laufen.','A shallow planted hollow where rainwater soaks away instead of running into the sewer.','Ondiepe, begroeide greppel waarin regenwater wegzakt in plaats van het riool in te lopen.']],
  knelpunt:[['Klimaknelpunt','Climate hotspot','Klimaatknelpunt'],['Eine Stelle, die die Gemeente als Problem kennt: Straße bei Starkregen unpassierbar, Wasserschäden oder Hitzestress.','A spot the municipality knows as a problem: road impassable in heavy rain, water damage or heat stress.','Een plek die de gemeente kent als probleem: weg onbegaanbaar bij hevige regen, waterschade of hittestress.']],
  entsiegeln:[['Entsiegeln','Depaving','Ontharden'],['Asphalt oder Pflaster entfernen, damit Regen versickert und der Boden kühler bleibt.','Removing asphalt or paving so rain can soak in and the ground stays cooler.','Asfalt of bestrating weghalen, zodat regen kan wegzakken en de grond koeler blijft.']],
  aufheizung:[['Hitze-Index','Heat index','Hitte-index'],['Näherung des Labors: Sonnenstunden × aufgenommene Strahlung × Oberflächenart. Zeigt, wo Flächen sich stark aufheizen — keine Lufttemperatur.','The lab\'s approximation: sun hours × absorbed radiation × surface type. Shows where surfaces heat up strongly — not air temperature.','Benadering van het lab: zonuren × opgenomen straling × soort oppervlak. Laat zien waar oppervlakken sterk opwarmen — geen luchttemperatuur.']],
  bijstand:[['Bijstand','Bijstand','Bijstand'],['Niederländische Sozialhilfe für Menschen ohne ausreichendes Einkommen.','Dutch social assistance for people without sufficient income.','Uitkering voor mensen zonder voldoende inkomen.']],
  bag:[['BAG','BAG','BAG'],['Amtliches Register aller Gebäude und Adressen der Niederlande, mit Baujahr und Status.','The official register of all buildings and addresses in the Netherlands, with year built and status.','Basisregistratie Adressen en Gebouwen, met bouwjaar en status.']],
  bgt:[['BGT','BGT','BGT'],['Amtliche Detailkarte von Straßen, Wegen, Grün- und Wasserflächen (Basisregistratie Grootschalige Topografie).','Official detailed map of roads, paths, green and water areas (Basisregistratie Grootschalige Topografie).','Basisregistratie Grootschalige Topografie: gedetailleerde kaart van wegen, paden, groen en water.']],
  nwb:[['NWB','NWB','NWB'],['Nationales Straßennetz mit Straßennamen (Nationaal Wegenbestand, Rijkswaterstaat).','National road network with street names (Nationaal Wegenbestand, Rijkswaterstaat).','Nationaal Wegenbestand van Rijkswaterstaat, met straatnamen.']],
  ahn:[['AHN','AHN','AHN'],['Höhenmodell der Niederlande aus Laserscans, etwa alle 50 cm ein Messpunkt.','Elevation model of the Netherlands from laser scans, roughly one point every 50 cm.','Actueel Hoogtebestand Nederland uit laserscans, ongeveer elke 50 cm een punt.']],
  knmi:[['KNMI\'23','KNMI\'23','KNMI\'23'],['Klimaszenarien des niederländischen Wetterdienstes von 2023: sechs Varianten, wie warm und nass es bis 2100 wird.','The Dutch weather service\'s 2023 climate scenarios: six variants of how warm and wet it gets by 2100.','Klimaatscenario\'s van het KNMI uit 2023: zes varianten van hoe warm en nat het wordt tot 2100.']],
  median:[['Median','Median','Mediaan'],['Der mittlere Wert: Die Hälfte liegt darüber, die Hälfte darunter.','The middle value: half lie above, half below.','De middelste waarde: de helft ligt erboven, de helft eronder.']],
  svf:[['Himmelssicht','Sky view','Hemelzicht'],['Welcher Anteil des Himmels von einem Punkt aus zu sehen ist. Wenig Himmel heißt: Die Straße kühlt nachts schlecht ab.','How much of the sky is visible from a point. Little sky means the street cools down poorly at night.','Hoeveel van de hemel vanaf een punt zichtbaar is. Weinig hemel betekent: de straat koelt \'s nachts slecht af.']],
  kuehl:[['Kühl-Lücke','Cooling gap','Koelkans'],['Heiße, sonnige, versiegelte Teilfläche ohne Baum, die keine Fahrbahn ist — etwa Parkplatz, Gehweg oder Platz. Dort bringen Baum, Entsiegeln oder heller Belag am meisten.','A hot, sunny, sealed patch without a tree that is not a carriageway — such as parking, pavement or a square. Trees, depaving or lighter paving help most there.','Een hete, zonnige, verharde plek zonder boom die geen rijbaan is — zoals parkeerplaats, stoep of plein. Daar helpen bomen, ontharden of lichte bestrating het meest.']]
};
// Erkennung im Text: nur eindeutige Wörter, je Bereich das erste Vorkommen
const GLX=[['maatlat',/\bMaatlat\b/],['wadi',/\bWadis?\b/],['pp',/\bP(?:p|P)\.(?=\s|$|,)|\bpp\b(?=\s|$|,)/],['knelpunt',/\b(?:Klima)?[Kk]nelpunte?n?\b|\b[Kk]limaatknelpunten?\b|\bclimate hotspots?\b/],
  ['uhi',/Wärmeinsel|heat island|hitte-eiland/i],['tropentag',/Tropentage?|[Tt]ropical days?|[Tt]ropische dagen?/],['tropennacht',/Tropennächte|[Tt]ropical nights?|[Tt]ropische nachten?/],
  ['bijstand',/\bBijstand\b|\bbijstand\b/],['r33',/3-30-300/],['liwo',/\bLIWO\b/],['knmi',/KNMI'23/],['bag',/\bBAG\b/],['bgt',/\bBGT\b/],['nwb',/\bNWB\b/],['ahn',/\bAHN\b/],
  ['entsiegeln',/[Ee]ntsiegel\w*|[Dd]epav\w*|[Oo]nthard\w*/],['median',/\bMedian\b|\bmediaan\b|\bmedian\b/],['svf',/Himmelssicht|[Ss]ky view|[Hh]emelzicht/],['kuehl',/Kühl-Lücken?|[Cc]ooling gaps?|[Kk]oelkansen?/],['aufheizung',/Hitze-Index|[Hh]eat index|[Hh]itte-index/]];
const SKIP='button,a,.gl,script,style,svg,input,select,textarea,summary,h2,h3,h4,.lab-tools,.lab-top,.nxk,.nxg,.sx';
function annotate(root){
  if(!root||!root.isConnected)return;
  const done=new Set([...root.querySelectorAll('.gl[data-gl]')].map(e=>e.dataset.gl));
  const wk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),nodes=[];let n;while((n=wk.nextNode()))if(n.nodeValue.trim().length>2&&!(n.parentElement&&n.parentElement.closest(SKIP)))nodes.push(n);
  for(const [id,re] of GLX){if(done.has(id))continue;
    for(const t of nodes){if(!t.parentNode)continue;const m=re.exec(t.nodeValue);if(!m)continue;
      const after=t.splitText(m.index);after.nodeValue=after.nodeValue.slice(m[0].length);
      const s=document.createElement('span');s.className='gl';s.dataset.gl=id;s.setAttribute('role','button');s.tabIndex=0;s.textContent=m[0];
      t.parentNode.insertBefore(s,after);nodes.push(after);done.add(id);break;}}
  root.querySelectorAll('[data-gl]:not(.gl)').forEach(e=>{e.classList.add('gl');e.setAttribute('role','button');e.tabIndex=0;});
}
const ROOTS='#legend,#pBody,.lab-dock,.act,.nxs-b';
let annT=0;const pend=new Set();
const mo=new MutationObserver(ms=>{for(const m of ms){const el=m.target.nodeType===1?m.target:m.target.parentElement;const r=el&&el.closest&&el.closest(ROOTS);if(r)pend.add(r);}
  if(pend.size&&!annT)annT=setTimeout(()=>{annT=0;const a=[...pend];pend.clear();a.forEach(annotate);},30);});
mo.observe(document.body,{childList:true,subtree:true});
let pop=null;
function glPop(el){
  glClose();const id=el.dataset.gl,g=GL[id];if(!g)return;const L=L_()==='en'?1:L_()==='nl'?2:0;
  pop=document.createElement('div');pop.className='glpop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label',g[0][L].replace(/<[^>]+>/g,''));
  pop.innerHTML=`<b>${g[0][L]}</b><p>${g[1][L]}</p><button class="glall">${T('Alle Begriffe','All terms','Alle begrippen')}</button>`;
  document.body.appendChild(pop);
  const r=el.getBoundingClientRect(),pw=Math.min(300,innerWidth-24),ph=pop.offsetHeight||120;
  pop.style.width=pw+'px';pop.style.left=Math.max(12,Math.min(innerWidth-pw-12,r.left))+'px';
  pop.style.top=(r.bottom+8+ph>innerHeight?Math.max(12,r.top-8-ph):r.bottom+8)+'px';
  pop.querySelector('.glall').onclick=()=>{glClose();M.methodik('begriffe');};
  pop._el=el;el.setAttribute('aria-expanded','true');
}
function glClose(){if(pop){if(pop._el)pop._el.removeAttribute('aria-expanded');pop.remove();pop=null;}}
document.addEventListener('click',e=>{const g=e.target.closest&&e.target.closest('.gl[data-gl]');if(g){e.preventDefault();e.stopPropagation();pop&&pop._el===g?glClose():glPop(g);return;}if(pop&&!pop.contains(e.target))glClose();},true);
document.addEventListener('keydown',e=>{const g=e.target.closest&&e.target.closest('.gl[data-gl]');if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();glPop(g);}else if(e.key==='Escape'&&pop){e.stopPropagation();const el=pop._el;glClose();el&&el.focus();}},true);
M.annotate=annotate;M.GL=GL;

// ══ Methodik ══
const lin=r=>{const p0=r.pt(0),s=r.pt(1)-p0;return {z:-p0/s,f:(1-p0)/s};};
M.methodik=function(focus){
  const X=NX(),R=X.RISKS.filter(r=>r.pt),W=X.RISKS.find(r=>r.city),meta=(X.BU&&X.BU._meta)||{},L=L_()==='en'?1:L_()==='nl'?2:0;
  const rows=R.map(r=>{const {z,f}=lin(r);return `<tr><th>${tn(r)}</th><td>${r.inv?'≥':'≤'} ${r.f(z)}</td><td>${r.lim}</td><td>${r.inv?'≤':'≥'} ${r.f(f)}</td></tr>`;}).join('');
  const lims=[0,15,30,45,60,101];
  const grades=X.GR.map((g,i)=>`<li>${gchip(null,i)}<b>${lims[i]}–${Math.min(100,lims[i+1]-1)}</b> ${X.gname(i)}</li>`).join('');
  const src=Object.values(meta.sources||{}).map(s=>`<li>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`:esc(s.title)}${s.license?` <small>${esc(s.license)}</small>`:''}</li>`).join('');
  const b=sheet('methodik',T('Methodik und Quellen','Methodology and sources','Methodiek en bronnen'),`
    <p class="nxs-lead">${T('Inspector Nice zeigt, wo in Utrecht Klimarisiken und verletzliche Menschen zusammenkommen — nur aus offenen, amtlichen Daten. Hier steht, wie gerechnet wird und was die Zahlen nicht können.','Inspector Nice shows where in Utrecht climate risks and vulnerable people come together — using only open, official data. Here is how it is calculated and what the numbers cannot do.','Inspector Nice laat zien waar in Utrecht klimaatrisico\'s en kwetsbare mensen samenkomen — alleen met open, officiële data. Hier staat hoe er gerekend wordt en wat de cijfers niet kunnen.')}</p>
    <h3>${T('So entsteht die Klimabelastung','How the climate burden is made','Zo ontstaat de klimaatbelasting')}</h3>
    <p>${T('Vier Risiken, die sich von Quartier zu Quartier unterscheiden, geben je 0 bis 25 Punkte. Dazwischen steigen die Punkte gleichmäßig. Die Summe ergibt 0 bis 100.','Four risks that differ from neighbourhood to neighbourhood give 0 to 25 points each, rising evenly in between. Together they make 0 to 100.','Vier risico\'s die per buurt verschillen geven elk 0 tot 25 punten, daartussen gelijkmatig oplopend. Samen 0 tot 100.')}</p>
    <div class="nxs-tw"><table class="nxs-t"><thead><tr><th>${T('Risiko','Risk','Risico')}</th><th>${T('0 Punkte','0 points','0 punten')}</th><th>${T('Richtwert','Guideline','Richtwaarde')}</th><th>${T('25 Punkte','25 points','25 punten')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">${T('Bei Lärm, Kronendach und Schatten beginnen die Punkte genau am Richtwert. Hitze zählt schon ab +0,5 °C Wärmeinsel, weil jede Erwärmung gegenüber dem Umland belastet; ab +1,5 °C gilt sie als stark. Fehlt ein Wert, wird aus den übrigen hochgerechnet; unter drei Werten gibt es keine Note.','For noise, canopy and shade the points start exactly at the guideline. Heat counts from a +0.5 °C heat island, because any warming compared with the countryside adds stress; from +1.5 °C it counts as strong. If one value is missing the others are scaled up; with fewer than three values there is no grade.','Bij geluid, kronendak en schaduw beginnen de punten precies bij de richtwaarde. Hitte telt al vanaf +0,5 °C hitte-eiland, omdat elke opwarming ten opzichte van het buitengebied belast; vanaf +1,5 °C geldt die als sterk. Ontbreekt een waarde, dan wordt uit de rest opgeschaald; onder drie waarden geen cijfer.')}</p>
    <h3>${T('Noten A bis E','Grades A to E','Cijfers A tot E')}</h3><ul class="nxs-gr">${grades}</ul>
    <h3>${W?tn(W):''}</h3>
    <p>${T('Überflutung steht in jedem Profil, zählt aber nicht in die Punkte: Fast ganz Utrecht liegt in derselben LIWO-Klasse. Sie unterscheidet die Stadt vom Land, nicht ein Quartier vom anderen.','Flooding appears in every profile but does not count towards the points: almost all of Utrecht is in the same LIWO class. It separates the city from the countryside, not one neighbourhood from another.','Overstroming staat in elk profiel maar telt niet mee: bijna heel Utrecht valt in dezelfde LIWO-klasse. Het onderscheidt de stad van het platteland, niet de ene buurt van de andere.')}</p>
    <h3>${T('Menschen statt Prozente','People instead of percentages','Mensen in plaats van procenten')}</h3>
    <p>${T('„≈ 300 Menschen über 65" heißt: Anteil laut CBS × Einwohner, sichtbar gerundet (auf 10, 50 oder 100). Werte des GGD-Gesundheitsmonitors (Lärmbelästigung, Schlaf, Einsamkeit, Abkühlung) sind Modellschätzungen je Quartier, keine Zählungen.','"≈ 300 people over 65" means: share according to CBS × residents, visibly rounded (to 10, 50 or 100). Values from the GGD health monitor (noise annoyance, sleep, loneliness, cooling) are model estimates per neighbourhood, not counts.','„≈ 300 mensen boven 65" betekent: aandeel volgens CBS × inwoners, zichtbaar afgerond (op 10, 50 of 100). Waarden uit de GGD-Gezondheidsmonitor (geluidhinder, slaap, eenzaamheid, afkoeling) zijn modelschattingen per buurt, geen tellingen.')}</p>
    <h3>${T('Was die Zahlen nicht können','What the numbers cannot do','Wat de cijfers niet kunnen')}</h3>
    <ul class="nxs-ul">
      <li>${T('Sie zeigen Durchschnitte je Quartier. Einzelne Straßen können viel besser oder schlechter sein — dafür gibt es das Straßenlabor.','They show averages per neighbourhood. Single streets can be much better or worse — that is what the street lab is for.','Ze tonen gemiddelden per buurt. Losse straten kunnen veel beter of slechter zijn — daarvoor is het straatlab.')}</li>
      <li>${T('Die Daten stammen aus verschiedenen Jahren (2022 bis 2026). Das Jahr steht jeweils dabei.','The data come from different years (2022 to 2026). The year is always shown.','De data komen uit verschillende jaren (2022 tot 2026). Het jaar staat er steeds bij.')}</li>
      <li>${T('Hitze ist ein Modell der Lufttemperatur im Sommermittel, keine Messung an einem heißen Tag.','Heat is a model of average summer air temperature, not a measurement on a hot day.','Hitte is een model van de gemiddelde zomertemperatuur, geen meting op een hete dag.')}</li>
      <li>${T('Wer sich gut schützen kann, hängt auch von Wohnung, Gesundheit und Nachbarschaft ab — das erfassen offene Daten nur teilweise.','Who can protect themselves well also depends on housing, health and neighbours — open data capture this only partly.','Wie zich goed kan beschermen, hangt ook af van woning, gezondheid en buren — open data vangen dat maar deels.')}</li>
    </ul>
    <h3>${T('Quellen','Sources','Bronnen')}</h3>
    <ul class="nxs-src">${src}<li>KNMI'23 ${T('Klimaszenarien, Station De Bilt','climate scenarios, De Bilt station','klimaatscenario\'s, station De Bilt')}</li><li>${T('Straßenlabor','Street lab','Straatlab')}: 3D BAG (TU Delft / 3DGI), BGT, AHN, NWB, LIWO, ${T('Baumregister und Klimaknelpunte der Gemeente Utrecht','tree register and climate hotspots of Gemeente Utrecht','bomenregister en klimaatknelpunten van de gemeente Utrecht')}</li></ul>
    <h3 id="nxBegriffe">${T('Begriffe','Terms','Begrippen')}</h3>
    <dl class="nxs-dl">${Object.entries(GL).map(([k,g])=>`<div id="gl-${k}"><dt>${g[0][L]}</dt><dd>${g[1][L]}</dd></div>`).join('')}</dl>
    <p class="note"><a href="methodik.html">${T('Ausführliche Methodik der klassischen Ansicht (mit Konfidenzklassen)','Detailed methodology of the classic view (with confidence classes)','Uitgebreide methodiek van de klassieke weergave (met betrouwbaarheidsklassen)')}</a></p>`);
  if(focus==='begriffe')setTimeout(()=>{const h=b.querySelector('#nxBegriffe');if(h&&h.scrollIntoView)h.scrollIntoView({block:'start'});},40);
};

// ══ Merkliste ══
const pins=()=>ST.get('nx_pins',[]);
const pinToggle=code=>{const p=pins(),i=p.indexOf(code);if(i>=0)p.splice(i,1);else p.push(code);ST.set('nx_pins',p);return i<0;};
M.pins=pins;

// ══ Alle Quartiere: Tabelle, Ranglisten, Vergleich ══
const D={sort:'s',dir:-1,q:'',wijk:'',only:false,tab:'list',cmp:[]};
const wijkOf=b=>{const X=NX();return (X.BU&&X.BU._wijk&&X.BU._wijk[b.wijk])||'';};
function cols(){const X=NX(),R=X.RISKS.filter(r=>r.pt);return [
  {k:'s',l:T('Note','Grade','Cijfer'),v:b=>X.score(b),f:v=>v==null?'—':`${gchip(v)} ${Math.round(v)}`,csv:v=>v==null?'':Math.round(v)},
  ...R.map(r=>({k:r.id,l:tn(r),v:r.v,f:v=>v==null?'—':r.f(v),bad:v=>v!=null&&r.over(v),inv:r.inv,csv:v=>v==null?'':v})),
  {k:'inw',l:T('Einwohner','Residents','Inwoners'),v:b=>b.v.inw,f:v=>v==null?'—':F(v),csv:v=>v==null?'':v},
  {k:'senioren',l:'65+',v:b=>b.v.senioren,f:v=>v==null?'—':N(v,0)+' %',csv:v=>v==null?'':v},
  {k:'niedrig',l:T('Niedriges Einkommen','Low income','Laag inkomen'),v:b=>b.v.niedrig,f:v=>v==null?'—':N(v,0)+' %',csv:v=>v==null?'':v},
  {k:'lbmk',l:T('Lebensqualität','Liveability','Leefbaarheid'),v:b=>b.v.lbmk,f:v=>v==null?'—':v+'/9',csv:v=>v==null?'':v}];}
function rowsOf(){const X=NX(),q=D.q.trim().toLowerCase(),p=pins(),c=cols().find(x=>x.k===D.sort)||cols()[0];
  return X.BU.filter(b=>(!q||b.name.toLowerCase().includes(q)||wijkOf(b).toLowerCase().includes(q))&&(!D.wijk||b.wijk===D.wijk)&&(!D.only||p.includes(b.code)))
    .sort((a,b)=>{const va=c.v(a),vb=c.v(b);if(va==null&&vb==null)return a.name.localeCompare(b.name);if(va==null)return 1;if(vb==null)return -1;return (va-vb)*D.dir||a.name.localeCompare(b.name);});}
M.dashboard=function(tab,pre){
  if(tab)D.tab=tab;if(pre){D.cmp=[pre,...D.cmp.filter(c=>c!==pre)].slice(0,3);}
  const b=sheet('dash',T('Alle Quartiere','All neighbourhoods','Alle buurten'),'<div id="nxDash"></div>',true);
  renderDash(b.querySelector('#nxDash'));
};
function kpis(){const X=NX(),cnt=[0,0,0,0,0],ppl=[0,0,0,0,0];X.BU.forEach(b=>{const g=X.grade(X.score(b));if(g!=null){cnt[g]++;ppl[g]+=b.v.inw||0;}});
  const S=X.BU.map(X.score).filter(v=>v!=null).sort((a,b)=>a-b);
  return `<div class="nxd-k"><div><b>${X.BU.length}</b><span>${T('Quartiere','neighbourhoods','buurten')}</span></div><div><b>${F(X.rnd(ppl[3]+ppl[4]))}</b><span>${T('Menschen in D und E','people in D and E','mensen in D en E')}</span></div><div><b>${S.length?Math.round(S[S.length>>1]):'—'}</b><span><span class="gl" data-gl="median">${T('Median','Median','Mediaan')}</span> ${T('Klimabelastung','climate burden','klimaatbelasting')}</span></div>
    <div class="nxd-dist" role="img" aria-label="${X.GR.map((g,i)=>g[1]+': '+cnt[i]).join(', ')}">${cnt.map((n,i)=>`<i style="flex:${Math.max(n,3)};background:${X.scol([7.5,22.5,37.5,52.5,67.5][i])}"><b class="${i>=3?'lt':''}">${X.GR[i][1]} ${n}</b></i>`).join('')}</div></div>`;}
function cmpFill(){const X=NX();if(D.cmp.length>=2)return;const s=X.BU.filter(b=>X.score(b)!=null).sort((a,b)=>X.score(b)-X.score(a));for(const b of [X.sel,...s]){if(D.cmp.length>=2)break;if(b&&!D.cmp.includes(b.code))D.cmp.push(b.code);}}
function renderDash(el){
  if(!el)return;const X=NX();if(D.tab==='cmp')cmpFill();
  const tabs=[['list',T('Tabelle','Table','Tabel')],['rank',T('Ranglisten','Rankings','Ranglijsten')],['cmp',T('Vergleich','Compare','Vergelijken')]];
  el.innerHTML=`${kpis()}<div class="nxd-tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" data-tab="${k}" aria-selected="${D.tab===k}" class="${D.tab===k?'on':''}">${l}${k==='cmp'&&D.cmp.length?` (${D.cmp.length})`:''}</button>`).join('')}</div><div class="nxd-body"></div>`;
  el.querySelectorAll('[data-tab]').forEach(t=>t.onclick=()=>{D.tab=t.dataset.tab;renderDash(el);});
  const body=el.querySelector('.nxd-body');
  if(D.tab==='rank')return rank(body);if(D.tab==='cmp')return cmp(body,el);
  const C=cols(),R=rowsOf(),p=pins(),wk=Object.entries(X.BU._wijk||{});
  body.innerHTML=`<div class="nxd-f"><label class="nxd-q">${IC.search}<input type="search" id="nxdQ" value="${esc(D.q)}" placeholder="${T('Quartier oder Stadtteil','Neighbourhood or district','Buurt of wijk')}" aria-label="${T('Quartiere filtern','Filter neighbourhoods','Buurten filteren')}"></label>
      <select id="nxdW" aria-label="${T('Stadtteil','District','Wijk')}"><option value="">${T('Alle Stadtteile','All districts','Alle wijken')}</option>${wk.map(([k,n])=>`<option value="${k}"${D.wijk===k?' selected':''}>${n}</option>`).join('')}</select>
      <button class="nxd-chip${D.only?' on':''}" id="nxdP" aria-pressed="${D.only}">${D.only?IC.starOn:IC.star}<span>${T('Gemerkt','Saved','Bewaard')} (${p.length})</span></button>
      <button class="nxd-chip" id="nxdCsv">${IC.dl}<span>CSV</span></button></div>
    <p class="nxd-n" role="status">${R.length} ${T('Quartiere','neighbourhoods','buurten')} · ${T('Zeile antippen öffnet das Quartier, Häkchen nimmt es in den Vergleich','tap a row to open the neighbourhood, tick it to compare','tik een rij om de buurt te openen, vink aan om te vergelijken')}</p>
    <div class="nxd-tw"><table class="nxd-t"><thead><tr><th class="nxd-c0" scope="col">${T('Quartier','Neighbourhood','Buurt')}</th>${C.map(c=>`<th scope="col" aria-sort="${D.sort===c.k?(D.dir<0?'descending':'ascending'):'none'}"><button data-sort="${c.k}">${c.l}${D.sort===c.k?(D.dir<0?' ↓':' ↑'):''}</button></th>`).join('')}</tr></thead>
    <tbody>${R.map(b=>`<tr data-code="${b.code}"><th class="nxd-c0" scope="row"><label class="nxd-ck" title="${T('Vergleichen','Compare','Vergelijken')}"><input type="checkbox" data-cmp="${b.code}"${D.cmp.includes(b.code)?' checked':''} aria-label="${esc(b.name)} ${T('vergleichen','compare','vergelijken')}"></label><button class="nxd-open" data-open="${b.code}"><span class="nxd-nm">${p.includes(b.code)?'<i class="nxd-pin" role="img" aria-label="'+T('gemerkt','saved','bewaard')+'"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg></i> ':''}${esc(b.name)}</span><small>${esc(wijkOf(b))}</small></button></th>${C.map(c=>{const v=c.v(b);return `<td class="${c.bad&&c.bad(v)?'bad':''}">${c.f(v)}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="note">${T('Rot markiert: über dem Richtwert. Werte und Jahre wie im Quartiersprofil; Quellen in der Methodik.','Marked red: above the guideline. Values and years as in the neighbourhood profile; sources in the methodology.','Rood gemarkeerd: boven de richtwaarde. Waarden en jaren zoals in het buurtprofiel; bronnen in de methodiek.')}</p>`;
  const q=body.querySelector('#nxdQ');q.oninput=()=>{D.q=q.value;const pos=q.selectionStart;renderDash(el);const q2=el.querySelector('#nxdQ');if(q2){q2.focus();try{q2.setSelectionRange(pos,pos);}catch(e){}}};
  body.querySelector('#nxdW').onchange=e=>{D.wijk=e.target.value;renderDash(el);};
  body.querySelector('#nxdP').onclick=()=>{D.only=!D.only;renderDash(el);};
  body.querySelector('#nxdCsv').onclick=()=>csv();
  body.querySelectorAll('[data-sort]').forEach(s=>s.onclick=()=>{const k=s.dataset.sort;if(D.sort===k)D.dir=-D.dir;else{D.sort=k;D.dir=k==='lbmk'?1:k==='inw'||k==='s'||k==='senioren'||k==='niedrig'||!(cols().find(c=>c.k===k)||{}).inv?-1:1;}renderDash(el);const f=el.querySelector(`[data-sort="${k}"]`);if(f)f.focus();});
  body.querySelectorAll('[data-open]').forEach(o=>o.onclick=()=>openB(o.dataset.open));
  body.querySelectorAll('[data-cmp]').forEach(c=>c.onchange=()=>{const k=c.dataset.cmp;if(c.checked){if(D.cmp.length>=3){c.checked=false;toast(T('Höchstens drei Quartiere vergleichen.','Compare at most three neighbourhoods.','Vergelijk hooguit drie buurten.'),3000);return;}D.cmp.push(k);}else D.cmp=D.cmp.filter(x=>x!==k);
    const t=el.querySelector('[data-tab="cmp"]');if(t)t.textContent=T('Vergleich','Compare','Vergelijken')+(D.cmp.length?` (${D.cmp.length})`:'');});
}
function openB(code){const X=NX(),b=X.BU.find(x=>x.code===code);if(!b)return;close(true);X.openBuurt(b);}
function rank(body){
  const X=NX(),S=b=>X.score(b),P=b=>b.v.inw||0;
  const lists=[
    [T('Höchste Klimabelastung','Highest climate burden','Hoogste klimaatbelasting'),X.BU.filter(b=>S(b)!=null).sort((a,b)=>S(b)-S(a)),b=>`${X.GR[X.grade(S(b))][1]} · ${Math.round(S(b))}<small>${F(P(b))} ${T('Einw.','res.','inw.')}</small>`],
    [T('Die meisten Menschen in D und E','Most people in D and E','Meeste mensen in D en E'),X.BU.filter(b=>S(b)!=null&&X.grade(S(b))>=3).sort((a,b)=>P(b)-P(a)),b=>`${F(P(b))} ${T('Menschen','people','mensen')}`],
    [T('Hitze trifft Ältere','Heat hits older people','Hitte treft ouderen'),X.BU.filter(b=>b.v.uhi!=null&&b.v.uhi>=1.5&&b.v.senioren!=null).sort((a,b)=>P(b)*b.v.senioren-P(a)*a.v.senioren),b=>`≈ ${F(X.rnd(P(b)*b.v.senioren/100))} ${T('über 65','over 65','boven 65')} · +${N(b.v.uhi,1)} °C`],
    [T('Am weitesten vom Kronendach-Ziel','Furthest from the canopy target','Verst van het kronendakdoel'),X.BU.filter(b=>P(b)>=500&&(b.v.blatt??b.v.krone)!=null).sort((a,b)=>(a.v.blatt??a.v.krone)-(b.v.blatt??b.v.krone)),b=>`${N(b.v.blatt??b.v.krone,0)} % ${T('statt 30 %','instead of 30 %','in plaats van 30 %')}`]];
  body.innerHTML=`<div class="nxd-rk">${lists.map(([h,l,f])=>`<section><h3>${h}</h3><ol>${l.slice(0,10).map(b=>`<li><button data-open="${b.code}"><span class="nxd-rn">${esc(b.name)}<small>${esc(wijkOf(b))}</small></span><b>${f(b)}</b></button></li>`).join('')}</ol></section>`).join('')}</div>
    <p class="note">${T('Ranglisten zeigen, wo Belastung und Betroffene zusammenkommen. Sie ersetzen keine Prüfung vor Ort.','Rankings show where burden and the people affected coincide. They do not replace an on-site check.','Ranglijsten tonen waar belasting en betrokkenen samenkomen. Ze vervangen geen controle ter plekke.')}</p>`;
  body.querySelectorAll('[data-open]').forEach(o=>o.onclick=()=>openB(o.dataset.open));
}
function cmp(body,el){
  const X=NX(),B=X.BU.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const sel=D.cmp.map(c=>X.BU.find(b=>b.code===c)).filter(Boolean);
  const R=X.RISKS,rows=[
    [T('Klimabelastung','Climate burden','Klimaatbelasting'),b=>X.score(b),v=>v==null?'—':`${gchip(v)} ${Math.round(v)}`,-1],
    ...R.map(r=>[tn(r),r.v,v=>v==null?'—':r.f(v),r.city?0:r.inv?1:-1,r]),
    [T('Einwohner','Residents','Inwoners'),b=>b.v.inw,v=>F(v),0],
    ['65+',b=>b.v.senioren,v=>v==null?'—':N(v,0)+' %',0],
    [T('Kinder','Children','Kinderen'),b=>b.v.kinder,v=>v==null?'—':N(v,0)+' %',0],
    [T('Niedriges Einkommen','Low income','Laag inkomen'),b=>b.v.niedrig,v=>v==null?'—':N(v,0)+' %',0],
    [T('Kühlt zu Hause gut ab','Can cool down at home','Kan thuis goed afkoelen'),b=>b.v.kuehlinnen,v=>v==null?'—':N(v,0)+' %',1],
    [T('Stark einsam','Severely lonely','Sterk eenzaam'),b=>b.v.einsam,v=>v==null?'—':N(v,0)+' %',-1],
    [T('Bänke je 1.000 Einw.','Benches per 1,000','Banken per 1.000'),b=>b.v.baenke1000,v=>v==null?'—':N(v,1),1],
    [T('Lebensqualität (Leefbaarometer)','Liveability (Leefbaarometer)','Leefbaarheid (Leefbaarometer)'),b=>b.v.lbmk,v=>v==null?'—':v+'/9',1]];
  const pick=(i)=>`<select data-ci="${i}" aria-label="${T('Quartier','Neighbourhood','Buurt')} ${i+1}"><option value="">${i>=2?T('— drittes Quartier —','— third neighbourhood —','— derde buurt —'):'—'}</option>${B.map(b=>`<option value="${b.code}"${D.cmp[i]===b.code?' selected':''}>${esc(b.name)}</option>`).join('')}</select>`;
  body.innerHTML=`<div class="nxd-cs">${[0,1,2].map(pick).join('')}</div>
    <div class="nxd-tw"><table class="nxd-t nxd-ct"><thead><tr><th class="nxd-c0"></th>${sel.map(b=>`<th scope="col"><button data-open="${b.code}">${esc(b.name)}<small>${esc(wijkOf(b))}</small></button></th>`).join('')}</tr></thead>
    <tbody>${rows.map(([l,fv,ff,dir,r])=>{const vs=sel.map(fv),ok=vs.filter(v=>v!=null);const best=dir&&ok.length>1?(dir<0?Math.min(...ok):Math.max(...ok)):null,worst=dir&&ok.length>1?(dir<0?Math.max(...ok):Math.min(...ok)):null;
      return `<tr><th class="nxd-c0" scope="row">${l}</th>${vs.map(v=>{const bad=r&&v!=null&&r.over&&r.over(v)&&!r.city;return `<td class="${best!=null&&v===best&&best!==worst&&!bad?'best':''}${bad?' bad':''}">${ff(v)}</td>`;}).join('')}</tr>`;}).join('')}</tbody></table></div>
    <p class="note">${T('Grün: günstigster Wert der Auswahl, rot markiert: über dem Richtwert. Menschen-Werte ohne Wertung.','Green: most favourable value in the selection; marked red: above the guideline. People values are not rated.','Groen: gunstigste waarde in de selectie; rood gemarkeerd: boven de richtwaarde. Mensenwaarden zonder oordeel.')}</p>`;
  body.querySelectorAll('[data-ci]').forEach(s=>s.onchange=()=>{const i=+s.dataset.ci,v=s.value;const a=D.cmp.slice();a[i]=v;D.cmp=[...new Set(a.filter(Boolean))].slice(0,3);renderDash(el);});
  body.querySelectorAll('[data-open]').forEach(o=>o.onclick=()=>openB(o.dataset.open));
}
function csv(){
  const X=NX(),C=cols(),q=s=>{s=String(s==null?'':s);return /[",;\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const head=['code','buurt','wijk','note',...C.map(c=>c.k)].join(',');
  const lines=rowsOf().map(b=>{const s=X.score(b);return [b.code,b.name,wijkOf(b),s==null?'':X.GR[X.grade(s)][1],...C.map(c=>c.csv(c.v(b)))].map(q).join(',');});
  const txt='﻿'+[head,...lines].join('\n'),blob=new Blob([txt],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`inspector-nice-quartiere-utrecht-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
  M._lastCsv=txt;
}

// ══ Quartiers-Bericht (PDF) ══
let jsLoad=null;
const jspdf=()=>window.jspdf?Promise.resolve(window.jspdf):(jsLoad=jsLoad||new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=()=>res(window.jspdf);s.onerror=()=>{jsLoad=null;rej();};document.head.appendChild(s);}));
const plain=s=>String(s==null?'':s).replace(/<sub>(.*?)<\/sub>/g,'_$1').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/[–—−]/g,'-').replace(/[„“”]/g,'"').replace(/≈/g,'ca.').replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/ /g,' ');
M.reportLines=function(b){
  const X=NX(),s=X.score(b),g=X.grade(s),P=X.people(b),pa=X.parts(b),um=X.umbau(b),v=b.v,KN=X.KN,out=[];
  const H=t=>out.push(['h',t]),P_=t=>out.push(['p',t]),K=(a,c)=>out.push(['k',a,c]);
  out.push(['t',b.name]);out.push(['s',`${wijkOf(b)?wijkOf(b)+' · ':''}Utrecht · ${T('Stand','As of','Peildatum')} ${new Date().toISOString().slice(0,10)} · ID UTR-BU-${b.code.replace(/^BU/,'')}`]);
  out.push(['big',s==null?T('Keine Note (zu wenige Werte)','No grade (too few values)','Geen cijfer (te weinig waarden)'):`${T('Klimabelastung','Climate burden','Klimaatbelasting')} ${X.GR[g][1]} · ${X.gname(g)} — ${Math.round(s)}/100`]);
  P_(`${F(P.inw)} ${T('Menschen leben hier.','people live here.','mensen wonen hier.')}`);
  if(s!=null){H(T('So setzt sich der Wert zusammen','How the value is made up','Zo is de waarde opgebouwd'));for(const x of pa)K(tn(x.r),`${x.v==null?'—':x.r.f(x.v)} (${T('Richtwert','guideline','richtwaarde')} ${x.r.lim}) → ${x.p==null?'—':Math.round(x.p)}/25`);}
  H(T('Risiken für die Menschen hier','Risks for the people here','Risico\'s voor de mensen hier'));
  for(const r of X.RISKS){const val=r.v(b);if(val==null)continue;K(tn(r),`${r.f(val)} · ${r.city?T('stadtweit','city-wide','stadsbreed'):r.over(val)?T('über Richtwert','above guideline','boven richtwaarde'):T('im Rahmen','within guideline','binnen richtwaarde')} · ${r.src}`);}
  const ppl=[P.ue65!=null?`ca. ${F(X.rnd(P.ue65))} ${T('Menschen über 65','people over 65','mensen boven 65')}`:null,P.kinder!=null?`ca. ${F(X.rnd(P.kinder))} ${T('Kinder','children','kinderen')}`:null,P.belaestigt!=null?`ca. ${F(X.rnd(P.belaestigt))} ${T('Erwachsene stark lärmbelästigt','adults severely annoyed by noise','volwassenen ernstig gehinderd door geluid')}`:null,P.schlaf!=null?`ca. ${F(X.rnd(P.schlaf))} ${T('schlafen schlecht','sleep badly','slapen slecht')}`:null,v.kuehlinnen!=null?`${N(v.kuehlinnen,0)} % ${T('können zu Hause gut abkühlen','can cool down well at home','kunnen thuis goed afkoelen')}`:null].filter(Boolean);
  if(ppl.length){H(T('Wer betroffen ist','Who is affected','Wie getroffen wordt'));ppl.forEach(P_);}
  if(KN&&KN.ind&&KN.ind.tropisch){const t=KN.ind.tropisch,r50=Object.values(t.y[2050]),r00=Object.values(t.y[2100]);H(T('Zukunft: Tropentage pro Jahr','Future: tropical days per year','Toekomst: tropische dagen per jaar'));
    K(T('heute','today','nu'),N(t.ref,0));K('2050',`${N(Math.min(...r50),0)}-${N(Math.max(...r50),0)}`);K('2100',`${N(Math.min(...r00),0)}-${N(Math.max(...r00),0)}`);P_(T("KNMI'23, De Bilt, alle sechs Szenarien; in der Stadt kommt die Wärmeinsel dazu.","KNMI'23, De Bilt, all six scenarios; the heat island adds to this in the city.","KNMI'23, De Bilt, alle zes scenario's; in de stad komt het hitte-eiland erbij."));}
  const facts=[v.niedrig!=null?[T('Haushalte mit niedrigem Einkommen','Low-income households','Huishoudens met laag inkomen'),N(v.niedrig,0)+' %']:null,v.vermoegen!=null?[T('Vermögen je Haushalt (Median)','Wealth per household (median)','Vermogen per huishouden (mediaan)'),F(v.vermoegen*1000)+' €']:null,v.einsam!=null?[T('Stark einsam','Severely lonely','Sterk eenzaam'),N(v.einsam,0)+' %']:null,v.sozialmiete!=null?[T('Sozialwohnungen','Social housing','Corporatiewoningen'),N(v.sozialmiete,0)+' %']:null].filter(Boolean);
  if(facts.length){H(T('Wer hier lebt','Who lives here','Wie hier woont'));facts.forEach(f=>K(f[0],f[1]));}
  if(um.length){H(T('Was hier hilft','What helps here','Wat hier helpt'));um.forEach(x=>{const L=L_();K(x.mu.n[L]||x.mu.n.de,x.why);if(x.mu.wirkung)P_(x.mu.wirkung[L]||x.mu.wirkung.de);});}
  if(b.bau){H(T('Hier wird schon gebaut (BAG)','Already being built here (BAG)','Hier wordt al gebouwd (BAG)'));K(T('im Bau','under construction','in aanbouw'),F(b.bau[1]));K(T('Baugenehmigungen','permits granted','vergunningen verleend'),F(b.bau[0]));}
  H(T('Methode','Method','Methode'));P_(T('Klimabelastung 0-100 aus Hitze, Verkehrslärm, Kronendach und Schatten auf Wegen, je bis 25 Punkte. Überflutung stadtweit, ohne Punkte. Personenzahlen sind gerundete Schätzungen (Anteil x Einwohner). Nur offene, amtliche Daten; Details in der Methodik auf der Website.','Climate burden 0-100 from heat, traffic noise, canopy and shade on paths, up to 25 points each. Flooding city-wide, without points. People counts are rounded estimates (share x residents). Open, official data only; details in the methodology on the website.','Klimaatbelasting 0-100 uit hitte, verkeerslawaai, kronendak en schaduw op routes, elk tot 25 punten. Overstroming stadsbreed, zonder punten. Aantallen mensen zijn afgeronde schattingen (aandeel x inwoners). Alleen open, officiële data; details in de methodiek op de website.'));
  P_(`inspectornice.nicehere.nl/next.html?b=${b.code}`);
  return out.map(x=>x.map((y,i)=>i?plain(y):y));
};
M.report=async function(b){
  let lib;try{lib=await jspdf();}catch(e){toast(T('PDF-Bibliothek gerade nicht erreichbar. Bitte später erneut versuchen.','PDF library currently unreachable. Please try again later.','PDF-bibliotheek nu niet bereikbaar. Probeer het later opnieuw.'));return;}
  const doc=new lib.jsPDF({unit:'mm',format:'a4'}),W=210,Mg=18;let y=22,pg=1;
  const foot=()=>{doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(124,119,134);doc.text(`Inspector Nice · ${T('offene Daten','open data','open data')} · ${T('Seite','page','pagina')} ${pg}`,Mg,290);};
  const need=h=>{if(y+h>280){foot();doc.addPage();pg++;y=20;}};
  const txt=(t,size,bold,col,x,wd)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...(col||[23,21,28]));const ls=doc.splitTextToSize(t,wd||W-2*Mg);for(const l of ls){need(size*.45);doc.text(l,x||Mg,y);y+=size*.45;}};
  doc.setFillColor(255,214,0);doc.rect(0,0,W,6,'F');
  txt('INSPECTOR NICE · '+T('QUARTIERSBERICHT','NEIGHBOURHOOD REPORT','BUURTRAPPORT'),9,true,[124,119,134]);y+=2;
  for(const l of M.reportLines(b)){
    if(l[0]==='t'){txt(l[1],22,true);y+=1;}
    else if(l[0]==='s'){txt(l[1],9.5,false,[90,86,99]);y+=4;}
    else if(l[0]==='big'){need(14);const s=NX().score(b),c=s==null?[200,200,200]:NX().scol(s).match(/\w\w/g).map(h=>parseInt(h,16));doc.setFillColor(...c);doc.rect(Mg,y-5,4,9,'F');txt(l[1],14,true,null,Mg+8);y+=3;}
    else if(l[0]==='h'){y+=3;need(12);txt(l[1].toUpperCase(),9,true,[124,119,134]);y+=1;}
    else if(l[0]==='k'){need(6);const y0=y;txt(l[1],10,true,null,Mg,62);const y1=y;y=y0;txt(l[2],10,false,[60,56,70],Mg+66,W-2*Mg-66);y=Math.max(y,y1)+1;}
    else{txt(l[1],10,false,[60,56,70]);y+=1;}
  }
  foot();
  doc.save(`inspector-nice-${b.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`);
};

// ══ Mitwirken: Meldungen (gleicher Speicher wie die klassische Ansicht) ══
const RT={bench:['#b45309','Sitzgelegenheit fehlt','Missing seating','Bankje ontbreekt'],heat:['#dc2626','Hitzepunkt','Heat spot','Hittepunt'],green:['#16a34a','Mehr Grün nötig','Needs greenery','Meer groen nodig'],
  trittpfad:['#c97b4f','Trittpfad — hier laufen alle','Desire path — people walk here','Olifantenpaadje'],unsafe:['#7c3aed','Unsicherer Ort','Feels unsafe','Onveilige plek'],barrier:['#ea580c','Barriere oder kaputt','Barrier or broken','Barrière of kapot'],litter:['#6b7280','Müll oder Verschmutzung','Litter','Afval']};
const RKEY='nh_reports_utr',SUPA='https://hhstfiwqkmmkcgmmcmhc.supabase.co',SKEY='sb_publishable_kOgZOeQ8bfRgVjPevPMzbA_qTkneP6Y';
const reps=()=>ST.get(RKEY,[]),repSave=a=>ST.set(RKEY,a);
const rtn=k=>{const r=RT[k]||RT.barrier;return T(r[1],r[2],r[3]);};
let repLayer=null;
function drawReps(){const X=NX();if(!X.map||!window.L)return;if(repLayer){X.map.removeLayer(repLayer);repLayer=null;}if(window.LAB&&LAB.on)return;repLayer=L.layerGroup();
  for(const r of reps()){const m=L.circleMarker([r.lat,r.lon],{radius:7,color:'#fff',weight:2,fillColor:(RT[r.type]||RT.barrier)[0],fillOpacity:.95});
    m.bindTooltip(`<b>${esc(rtn(r.type))}</b><br><small>${new Date(r.ts).toLocaleDateString(L_()==='en'?'en-GB':L_()==='nl'?'nl-NL':'de-DE')} · ${r.id!=null||r.sent?T('übertragen','sent','verzonden'):T('nur auf diesem Gerät','on this device only','alleen op dit apparaat')}</small>`);repLayer.addLayer(m);}
  repLayer.addTo(X.map);}
async function supaSend(rec){
  try{const r=await fetch(`${SUPA}/rest/v1/nh_reports`,{method:'POST',headers:{apikey:SKEY,Authorization:'Bearer '+SKEY,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({city:'utr',lat:rec.lat,lon:rec.lon,type:rec.type,ts:rec.ts})});
    if(!r.ok)return false;const j=await r.json().catch(()=>null);const a=reps(),x=a.find(q=>q.ts===rec.ts&&q.lat===rec.lat);if(x){const id=j&&j[0]&&j[0].id;if(id!=null)x.id=id;else x.sent=true;repSave(a);}return true;}catch(e){return false;}}
M.report_spot=function(){
  const X=NX();close(true);X.closePanel&&X.closePanel();if(window.LAB&&LAB.on)LAB.close();
  document.body.classList.add('nx-picking');
  let bar=document.getElementById('nxPick');if(!bar){bar=document.createElement('div');bar.id='nxPick';bar.className='nxpick';document.body.appendChild(bar);}
  bar.innerHTML=`${IC.flag}<span>${T('Tippe auf die Stelle, um die es geht. Die Karte lässt sich weiter verschieben.','Tap the spot you mean. You can still move the map.','Tik op de plek waar het om gaat. De kaart kun je nog verschuiven.')}</span><button>${T('Abbrechen','Cancel','Annuleren')}</button>`;
  const stop=()=>{document.body.classList.remove('nx-picking');bar.remove();X.map.off('click',on);document.removeEventListener('keydown',esc_,true);};
  const esc_=e=>{if(e.key==='Escape'){e.stopPropagation();stop();}};
  const on=e=>{stop();chooseType(e.latlng);};
  bar.querySelector('button').onclick=stop;X.map.on('click',on);document.addEventListener('keydown',esc_,true);
  M._pick={stop,on};
};
function chooseType(ll){
  const b=sheet('rep',T('Was ist hier?','What is here?','Wat is hier?'),`<p class="nxs-lead">${T('Deine Meldung zeigt der Gemeente und anderen, wo etwas fehlt. Sie enthält nur Ort, Art und Zeit — keinen Namen, keinen Text.','Your report shows the municipality and others where something is missing. It contains only place, type and time — no name, no text.','Je melding laat de gemeente en anderen zien waar iets ontbreekt. Alleen plek, soort en tijd — geen naam, geen tekst.')}</p>
    <div class="nxr">${Object.entries(RT).map(([k,r])=>`<button data-rt="${k}"><i style="background:${r[0]}"></i>${T(r[1],r[2],r[3])}</button>`).join('')}</div>`);
  b.querySelectorAll('[data-rt]').forEach(x=>x.onclick=async()=>{
    const rec={city:'utr',lat:+ll.lat.toFixed(5),lon:+ll.lng.toFixed(5),type:x.dataset.rt,ts:Date.now()};const a=reps();a.push(rec);repSave(a);close();drawReps();
    toast(`<b>${esc(rtn(rec.type))}</b> ${T('gespeichert.','saved.','opgeslagen.')} ${T('Wird übertragen …','Sending …','Wordt verzonden …')}`,4000);
    const okS=await supaSend(rec);
    toast(okS?`<b>${T('Danke!','Thank you!','Dank je!')}</b> ${T('Die Meldung ist übertragen und für alle sichtbar.','The report has been sent and is visible to everyone.','De melding is verzonden en voor iedereen zichtbaar.')}`
      :`<b>${T('Auf deinem Gerät gespeichert.','Saved on your device.','Op je apparaat opgeslagen.')}</b> ${T('Der Server für Meldungen ist gerade nicht erreichbar; sie wird nachgereicht, sobald er wieder läuft.','The reporting server is currently unreachable; it will be sent once it is back.','De server voor meldingen is nu niet bereikbaar; hij wordt later verzonden.')}`,8000);
    drawReps();});
}
M.reps=reps;M.RT=RT;

// ══ Hitze-Hinweis (Open-Meteo-Vorhersage; keine amtliche Warnung) ══
const HW={d:null};
const lvl=t=>t>=35?3:t>=30?2:t>=27?1:0;
M.heat=async function(stub){
  let j=stub;if(!j){try{const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.0907&longitude=5.1214&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FAmsterdam&forecast_days=7');if(!r.ok)return;j=await r.json();}catch(e){return;}}
  const d=j&&j.daily;if(!d||!d.temperature_2m_max)return;HW.d=d;
  const mx=d.temperature_2m_max,today=new Date().toISOString().slice(0,10),lv=Math.max(lvl(mx[0]),lvl(mx[1]||0));
  const btn=document.getElementById('nxHeat');if(btn)btn.remove();
  if(!lv||ST.get('nx_hw',null)===today)return;
  const tools=document.querySelector('.tools');if(!tools)return;
  const b=document.createElement('button');b.id='nxHeat';b.className='tbtn heatbtn l'+lv;b.setAttribute('aria-haspopup','true');b.setAttribute('aria-expanded','false');
  const t0=Math.round(Math.max(mx[0],mx[1]||0));b.innerHTML=`${IC.therm}<span>${t0}°</span>`;b.setAttribute('aria-label',T(`Hitze-Hinweis: bis ${t0} °C`,`Heat notice: up to ${t0} °C`,`Hittemelding: tot ${t0} °C`));
  tools.insertBefore(b,tools.firstChild);b.onclick=e=>{e.stopPropagation();heatPop(b);};
};
function heatPop(b){
  const old=document.getElementById('nxHeatPop');if(old){old.remove();b.setAttribute('aria-expanded','false');return;}
  const d=HW.d,mx=d.temperature_2m_max,mn=d.temperature_2m_min||[],days=d.time||[],lv=Math.max(lvl(mx[0]),lvl(mx[1]||0));
  let run=0,best=0,hot=0,bh=0;mx.forEach(t=>{if(t>=27){run++;if(t>=30)hot++;if(run>best){best=run;bh=hot;}}else{run=0;hot=0;}});
  const plan=best>=4&&bh>=3,dn=s=>new Date(s+'T12:00').toLocaleDateString(L_()==='en'?'en-GB':L_()==='nl'?'nl-NL':'de-DE',{weekday:'short'});
  const p=document.createElement('div');p.id='nxHeatPop';p.className='more nxhp';p.setAttribute('role','dialog');p.setAttribute('aria-label',T('Hitze-Hinweis','Heat notice','Hittemelding'));
  p.innerHTML=`<div class="more-h">${[T('Warm','Warm','Warm'),T('Warm','Warm','Warm'),T('Hitze','Heat','Hitte'),T('Extreme Hitze','Extreme heat','Extreme hitte')][lv]}</div>
    <div class="nxhp-d">${mx.map((t,i)=>`<div class="${lvl(t)?'l'+lvl(t):''}"><b>${Math.round(t)}°</b><i style="height:${Math.max(4,Math.min(40,(t-10)*1.6))}px"></i><span>${i?dn(days[i]):T('heute','today','vandaag')}</span>${mn[i]>=20?`<em title="${T('Tropennacht','Tropical night','Tropische nacht')}" aria-label="${T('Tropennacht','Tropical night','Tropische nacht')}"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg></em>`:''}</div>`).join('')}</div>
    ${plan?`<p class="nxhp-plan">${T('Vier warme Tage in Folge, drei davon über 30 °C: Das ist die Schwelle des Nationalen Hitzeplans.','Four warm days in a row, three of them above 30 °C: that is the threshold of the National Heat Plan.','Vier warme dagen op rij, waarvan drie boven 30 °C: dat is de drempel van het Nationaal Hitteplan.')}</p>`:''}
    <ul class="nxhp-tips"><li>${T('Bei Älteren, Kindern und Alleinlebenden nachfragen','Check on older people, children and people living alone','Kijk om naar ouderen, kinderen en alleenwonenden')}</li><li>${T('Genug trinken, mittags im Schatten bleiben','Drink enough, stay in the shade at midday','Drink genoeg, blijf \'s middags in de schaduw')}</li><li>${T('Morgens und nachts lüften, tagsüber abdunkeln','Air rooms in the morning and at night, keep them dark during the day','\'s Ochtends en \'s nachts luchten, overdag verduisteren')}</li></ul>
    <div class="nxhp-a"><button data-h="shade">${T('Wo es schattig ist','Where it is shady','Waar het schaduwrijk is')}</button><button data-h="hide">${T('Heute ausblenden','Hide for today','Vandaag verbergen')}</button></div>
    <p class="more-f">${T('Vorhersage von Open-Meteo, keine amtliche Warnung. Amtlich warnt das KNMI.','Forecast from Open-Meteo, not an official warning. Official warnings come from the KNMI.','Verwachting van Open-Meteo, geen officiële waarschuwing. Officieel waarschuwt het KNMI.')}</p>`;
  b.parentElement.appendChild(p);b.setAttribute('aria-expanded','true');
  p.querySelector('[data-h="hide"]').onclick=()=>{ST.set('nx_hw',new Date().toISOString().slice(0,10));p.remove();b.remove();};
  p.querySelector('[data-h="shade"]').onclick=()=>{p.remove();b.setAttribute('aria-expanded','false');NX().setTheme('schatten');};
  const off=e=>{if(!p.contains(e.target)&&e.target!==b&&!b.contains(e.target)){p.remove();b.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',off);}};setTimeout(()=>document.addEventListener('pointerdown',off),0);
  p.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();p.remove();b.setAttribute('aria-expanded','false');b.focus();}});
}

// ══ Utrecht jetzt — offene Live-Daten nach dem God's-Eye-Prinzip (ohne Kameras, ohne Personen) ══
const AIR=[['NL10636','Kardinaal de Jongweg'],['NL10639','Constant Erzeijstraat'],['NL10643','Griftpark']],WHO={NO2:25,PM25:15};
let airLayer=null,NOWD=null;
async function airStation(id){
  const base='https://api.luchtmeetnet.nl/open_api/stations/'+id,get=u=>fetch(u).then(r=>r.ok?r.json():null).catch(()=>null);
  const [st,no2,pm]=await Promise.all([get(base),get(base+'/measurements?page=1&order=timestamp_measured&order_direction=desc&formula=NO2'),get(base+'/measurements?page=1&order=timestamp_measured&order_direction=desc&formula=PM25')]);
  const v=j=>j&&j.data&&j.data[0]?{v:j.data[0].value,t:j.data[0].timestamp_measured}:null,c=st&&st.data&&st.data.geometry&&st.data.geometry.coordinates;
  return {id,lat:c?c[1]:null,lon:c?c[0]:null,type:st&&st.data&&st.data.type,no2:v(no2),pm:v(pm)};
}
M.now=async function(){
  const b=sheet('now',T('Utrecht jetzt','Utrecht now','Utrecht nu'),`<div id="nxNow"><p class="nxs-lead">${T('Live-Daten werden geladen …','Loading live data …','Live-data laden …')}</p></div>`);
  const el=b.querySelector('#nxNow');
  const [w,air]=await Promise.all([fetch('https://api.open-meteo.com/v1/forecast?latitude=52.0907&longitude=5.1214&current=temperature_2m,apparent_temperature,uv_index,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m&minutely_15=precipitation&forecast_minutely_15=8&timezone=Europe%2FAmsterdam&wind_speed_unit=ms').then(r=>r.ok?r.json():null).catch(()=>null),
    Promise.all(AIR.map(a=>airStation(a[0]).then(x=>({...x,name:a[1]}))))]);
  NOWD={w,air};if(!el.isConnected)return;
  const c=w&&w.current,m=w&&w.minutely_15,rain=m?m.precipitation.slice(0,8):[],tm=m?m.time.slice(0,8):[],first=rain.findIndex(v=>v>=.1);
  const dir=d=>{const D=L_()==='en'?['N','NE','E','SE','S','SW','W','NW']:L_()==='nl'?['N','NO','O','ZO','Z','ZW','W','NW']:['N','NO','O','SO','S','SW','W','NW'];return D[Math.round(((d%360)+360)%360/45)%8];};
  const hm=s2=>(s2||'').slice(11,16),chip=(v,lim)=>v==null?'':`<span class="chip2 ${v>lim?'bad':'ok'}">${v>lim?T('über WHO-Tageswert','above WHO daily value','boven WHO-dagwaarde'):T('unter WHO-Tageswert','below WHO daily value','onder WHO-dagwaarde')}</span>`;
  el.innerHTML=`${c?`<div class="now-t"><div><b>${N(c.temperature_2m,0)} °C</b><span>${T('gefühlt','feels like','gevoelstemperatuur')} ${N(c.apparent_temperature,0)} °C</span></div><div><b>${N(c.uv_index,0)}</b><span>${T('UV-Index','UV index','UV-index')}${c.uv_index>=6?' · '+T('hoch','high','hoog'):''}</span></div><div><b>${N(c.wind_speed_10m,1)} m/s</b><span>${T('Wind aus','wind from','wind uit')} ${dir(c.wind_direction_10m)}</span></div><div><b>${N(c.relative_humidity_2m,0)} %</b><span>${T('Luftfeuchte','humidity','luchtvochtigheid')}</span></div></div>`:`<p class="note">${T('Wetterdaten gerade nicht erreichbar.','Weather data currently unavailable.','Weerdata nu niet bereikbaar.')}</p>`}
    ${rain.length?`<h3>${T('Regen in den nächsten 2 Stunden','Rain in the next 2 hours','Regen in de komende 2 uur')}</h3><div class="now-r" role="img" aria-label="${rain.map((v,i)=>hm(tm[i])+' '+N(v,1)+' mm').join(', ')}">${rain.map((v,i)=>`<div><i style="height:${Math.max(3,Math.min(44,v*22))}px"></i><span>${i%2?'':hm(tm[i])}</span></div>`).join('')}</div><p class="note">${first<0?T('Trocken — kein Regen erwartet.','Dry — no rain expected.','Droog — geen regen verwacht.'):T(`Regen ab etwa ${hm(tm[first])} Uhr.`,`Rain from about ${hm(tm[first])}.`,`Regen vanaf ongeveer ${hm(tm[first])}.`)}</p>`:''}
    <h3>${T('Luft an den Messstationen','Air at the monitoring stations','Lucht bij de meetstations')}</h3>
    <div class="now-a">${air.map(a=>`<div><b>${esc(a.name)}</b><small>${a.type==='Traffic'?T('an einer Hauptstraße','next to a main road','langs een drukke weg'):T('im Wohngebiet','in a residential area','in een woonwijk')}${a.no2?' · '+hm(new Date(a.no2.t).toLocaleString('sv-SE',{timeZone:'Europe/Amsterdam'}).replace(' ','T'))+' '+T('Uhr','','uur'):''}</small>
      <p>NO₂ <b>${a.no2?N(a.no2.v,0):'—'}</b> µg/m³ ${chip(a.no2&&a.no2.v,WHO.NO2)}</p><p>PM2,5 <b>${a.pm?N(a.pm.v,0):'—'}</b> µg/m³ ${chip(a.pm&&a.pm.v,WHO.PM25)}</p></div>`).join('')}</div>
    <p class="note">${T('Stundenwerte des RIVM. Zum Vergleich die WHO-Richtwerte für 24 Stunden (NO₂ 25, PM2,5 15 µg/m³) — ein Stundenwert ist kein Tagesmittel.','Hourly values from RIVM. For comparison, the WHO 24-hour guidelines (NO₂ 25, PM2.5 15 µg/m³) — an hourly value is not a daily mean.','Uurwaarden van het RIVM. Ter vergelijking de WHO-richtwaarden voor 24 uur (NO₂ 25, PM2,5 15 µg/m³) — een uurwaarde is geen daggemiddelde.')}</p>
    <div class="nxhp-a"><button id="nowMap">${airLayer?T('Stationen ausblenden','Hide stations','Stations verbergen'):T('Stationen auf der Karte','Stations on the map','Stations op de kaart')}</button><button id="nowWind">${T('Wind in 3D','Wind in 3D','Wind in 3D')}</button></div>
    <p class="note">${T('Quellen: Open-Meteo (CC BY 4.0), Luchtmeetnet / RIVM. Bewusst nicht dabei: Kameras und Daten über einzelne Menschen.','Sources: Open-Meteo (CC BY 4.0), Luchtmeetnet / RIVM. Deliberately left out: cameras and data on individual people.','Bronnen: Open-Meteo (CC BY 4.0), Luchtmeetnet / RIVM. Bewust weggelaten: camera\'s en gegevens over individuele mensen.')}</p>`;
  el.querySelector('#nowMap').onclick=()=>{toggleAir(air);close();};
  el.querySelector('#nowWind').onclick=()=>{close();const X=NX();X.openLab(null,'sun');setTimeout(()=>{if(window.LAB&&LAB.v3d){LAB.v3d.mode='wind';LAB.v3d.open();}},400);};
};
function toggleAir(air){const X=NX();if(airLayer){X.map.removeLayer(airLayer);airLayer=null;return;}airLayer=L.layerGroup();
  for(const a of air){if(a.lat==null)continue;const bad=(a.no2&&a.no2.v>WHO.NO2)||(a.pm&&a.pm.v>WHO.PM25);
    L.circleMarker([a.lat,a.lon],{radius:9,color:'#fff',weight:2.5,fillColor:bad?'#d0583c':'#3f7f6a',fillOpacity:.95}).bindTooltip(`<b>${esc(a.name)}</b><br>NO₂ ${a.no2?N(a.no2.v,0):'—'} · PM2,5 ${a.pm?N(a.pm.v,0):'—'} µg/m³`,{permanent:true,direction:'right',offset:[10,0],className:'nx-air'}).addTo(airLayer);}
  airLayer.addTo(X.map);}
document.addEventListener('nx:view',e=>{if(airLayer&&e.detail==='street'){NX().map.removeLayer(airLayer);}else if(airLayer&&e.detail==='city')airLayer.addTo(NX().map);});

// ══ Befehle (⌘K / Strg K) ══
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function cmds(){
  const X=NX(),it=[],A=(t,s,k,f,ic)=>it.push({t,s,k:norm(t+' '+s+' '+(k||'')),f,ic});
  const lab=(id,t,k)=>A(t,T('Straßenlabor','Street lab','Straatlab'),k,()=>X.openLab(X.sel?X.center(X.sel):null,id),IC.tool);
  A(T('Alle Quartiere','All neighbourhoods','Alle buurten'),T('Tabelle, Ranglisten, Vergleich','Table, rankings, compare','Tabel, ranglijsten, vergelijken'),'dashboard tabelle liste ranking',()=>M.dashboard('list'),IC.grid);
  A(T('Quartiere vergleichen','Compare neighbourhoods','Buurten vergelijken'),T('Seite','Page','Pagina'),'vergleich compare versus',()=>M.dashboard('cmp',X.sel&&X.sel.code),IC.cmp);
  A(T('Ranglisten','Rankings','Ranglijsten'),T('Seite','Page','Pagina'),'top rang liste',()=>M.dashboard('rank'),IC.grid);
  A(T('Methodik und Quellen','Methodology and sources','Methodiek en bronnen'),T('Seite','Page','Pagina'),'methode quellen punkte noten',()=>M.methodik(),IC.book);
  A(T('Begriffe erklärt','Terms explained','Begrippen uitgelegd'),T('Seite','Page','Pagina'),'glossar glossary woorden',()=>M.methodik('begriffe'),IC.book);
  A(T('Utrecht jetzt','Utrecht now','Utrecht nu'),T('Wetter, Regen, Luft — live','Weather, rain, air — live','Weer, regen, lucht — live'),'live jetzt now wetter regen luft air',()=>M.now(),IC.therm);
  lab('route',T('Kühle Route','Cool route','Koele route'),'route weg schatten schattig kühl');
  A(T('Etwas melden','Flag a spot','Iets melden'),T('Mitwirken','Take part','Meedoen'),'melden report mitwirken bank schatten',()=>M.report_spot(),IC.flag);
  lab('sun',T('Sonne und Schatten','Sun and shade','Zon en schaduw'),'schatten shadow sonne');lab('surface',T('Hitze und Kühl-Lücken','Heat and cooling gaps','Hitte en koelkansen'),'hitze heat kühl gaps');
  lab('street',T('Straßenquerschnitt','Street cross-section','Straatprofiel'),'strasse street profil');lab('water',T('Starkregen und Überflutung','Heavy rain and flooding','Hevige regen en overstroming'),'wasser water regen');
  lab('wind',T('Wind','Wind','Wind'),'wind');lab('area',T('Fläche auswerten','Analyse an area','Gebied analyseren'),'fläche area');lab('studio',T('Studio und Laserschnitt','Studio and laser cut','Studio en lasersnijden'),'studio laser modell');
  if(window.LAB&&LAB.v3d)A(T('3D-Spielstadt','3D play city','3D-speelstad'),T('Straßenlabor','Street lab','Straatlab'),'3d drei stadt',()=>{X.openLab(X.sel?X.center(X.sel):null,'sun');setTimeout(()=>LAB.v3d.open(),400);},IC.tool);
  if(window.LAB&&LAB.standort!==undefined)lab('standort',T('Standort-Check','Location check','Locatiecheck'),'standort location büro');
  if(window.ACT)(ACT._t&&ACT._t.MISSIONS||[]).forEach(m=>A(m.n(),T('Handeln','Act','Aanpakken'),'mission '+m.id,()=>{ACT.m=m.id;ACT.toggle(true);},IC.flag));
  const ALL=X.ALL?X.ALL():X.RISKS;ALL.forEach(t=>A(tn(t),T('Karte','Map','Kaart'),'karte thema layer',()=>X.setTheme(t.id),IC.map));
  [['de','Deutsch'],['en','English'],['nl','Nederlands']].forEach(([l,n])=>A(n,T('Sprache','Language','Taal'),'sprache language taal '+l,()=>{const b=document.querySelector(`.lang [data-l="${l}"]`);b&&b.click();},IC.lang));
  A(T('Klassische Ansicht','Classic view','Klassieke weergave'),T('Seite','Page','Pagina'),'classic alt',()=>{location.href='index.html?classic';},IC.map);
  (X.BU||[]).forEach(b=>{const s=X.score(b);A(b.name,`${T('Quartier','Neighbourhood','Buurt')}${wijkOf(b)?' · '+wijkOf(b):''}${s!=null?' · '+X.GR[X.grade(s)][1]:''}`,'buurt quartier '+b.code,()=>X.openBuurt(b),IC.map);});
  return it;
}
let KP=null;
M.palette=function(q0){
  close(true);if(KP)KP();const prev=document.activeElement,items=cmds();let idx=0,shown=[];
  const ov=document.createElement('div');ov.className='nxs-ov nxk-ov';ov.id='nxK';
  ov.innerHTML=`<div class="nxk" role="dialog" aria-modal="true" aria-label="${T('Suchen und Befehle','Search and commands','Zoeken en opdrachten')}"><label class="nxk-q">${IC.search}<input id="nxkQ" type="search" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="nxkL" placeholder="${T('Quartier, Werkzeug, Seite …','Neighbourhood, tool, page …','Buurt, tool, pagina …')}" value="${esc(q0||'')}"></label><div class="nxk-l" id="nxkL" role="listbox"></div><p class="nxk-f">↑↓ ${T('wählen','select','kiezen')} · ↵ ${T('öffnen','open','openen')} · Esc ${T('schließen','close','sluiten')}</p></div>`;
  document.body.appendChild(ov);const inp=ov.querySelector('#nxkQ'),list=ov.querySelector('#nxkL');
  const shut=()=>{ov.remove();document.removeEventListener('keydown',kd,true);KP=null;};KP=shut;
  const done=()=>{shut();if(prev&&prev.focus)try{prev.focus();}catch(e){}};
  const run=i=>{const x=shown[i];if(!x)return;shut();x.f();};
  const draw=()=>{const q=norm(inp.value.trim()),ws=q.split(/\s+/).filter(Boolean);
    shown=(ws.length?items.filter(x=>ws.every(w=>x.k.includes(w))).sort((a,b)=>(norm(b.t).startsWith(ws[0])?1:0)-(norm(a.t).startsWith(ws[0])?1:0)):items.filter(x=>!/buurt quartier/.test(x.k))).slice(0,40);
    idx=Math.min(idx,Math.max(0,shown.length-1));
    list.innerHTML=shown.length?shown.map((x,i)=>`<button role="option" id="nxk${i}" aria-selected="${i===idx}" class="${i===idx?'on':''}" data-i="${i}">${x.ic||''}<span><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span></button>`).join(''):`<p class="nxk-e">${T('Nichts gefunden.','Nothing found.','Niets gevonden.')}</p>`;
    inp.setAttribute('aria-activedescendant',shown.length?'nxk'+idx:'');
    list.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>run(+b.dataset.i));
    const on=list.querySelector('.on');if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest'});};
  const kd=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done();}else if(e.key==='ArrowDown'){e.preventDefault();idx=Math.min(shown.length-1,idx+1);draw();}else if(e.key==='ArrowUp'){e.preventDefault();idx=Math.max(0,idx-1);draw();}else if(e.key==='Enter'&&document.activeElement===inp){e.preventDefault();run(idx);}};
  inp.oninput=()=>{idx=0;draw();};document.addEventListener('keydown',kd,true);ov.addEventListener('pointerdown',e=>{if(e.target===ov)done();});
  draw();setTimeout(()=>inp.focus(),0);M._k={items,run:i=>run(i),get shown(){return shown;},input:inp};
};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&!e.altKey&&(e.key==='k'||e.key==='K')){e.preventDefault();if(document.getElementById('nxK'))return;M.palette();}});

// ══ Einbindung: Mehr-Menü, Quartiers-Panel ══
function wire(){
  const mb=document.getElementById('moreMenu');
  const hook=(id,f)=>{const el=document.getElementById(id);if(el)el.onclick=e=>{e.preventDefault();const b=document.getElementById('moreBtn');if(b&&!mb.hidden)b.click();f();};};
  hook('methodBtn',()=>M.methodik());hook('nowBtn',()=>M.now());hook('dashBtn',()=>M.dashboard('list'));hook('cmdBtn',()=>M.palette());hook('repBtn',()=>M.report_spot());
  const k=document.getElementById('cmdKey');if(k)k.textContent=/Mac|iPhone|iPad/.test(navigator.platform||'')?'⌘K':'Strg K';
}
document.addEventListener('nx:panel',e=>{
  const b=e.detail,pb=document.getElementById('pBody');if(!b||!pb)return;const on=pins().includes(b.code);
  const d=document.createElement('div');d.className='pacts';
  d.innerHTML=`<button class="pact${on?' on':''}" data-a="pin" aria-pressed="${on}">${on?IC.starOn:IC.star}<span>${on?T('Gemerkt','Saved','Bewaard'):T('Merken','Save','Bewaren')}</span></button><button class="pact" data-a="cmp">${IC.cmp}<span>${T('Vergleichen','Compare','Vergelijken')}</span></button><button class="pact" data-a="pdf">${IC.doc}<span>PDF</span></button><button class="pact" data-a="rep">${IC.flag}<span>${T('Melden','Flag','Melden')}</span></button>`;
  const at=pb.querySelector('.pbl')||pb.querySelector('.vbox');if(at)at.after(d);else pb.prepend(d);
  d.querySelector('[data-a="pin"]').onclick=ev=>{const now=pinToggle(b.code),x=ev.currentTarget;x.classList.toggle('on',now);x.setAttribute('aria-pressed',now);x.innerHTML=`${now?IC.starOn:IC.star}<span>${now?T('Gemerkt','Saved','Bewaard'):T('Merken','Save','Bewaren')}</span>`;
    toast(now?T(`${b.name} gemerkt — unter „Alle Quartiere" wiederfinden.`,`${b.name} saved — find it again under "All neighbourhoods".`,`${b.name} bewaard — terug te vinden onder „Alle buurten".`):T('Nicht mehr gemerkt.','No longer saved.','Niet meer bewaard.'),3500);};
  d.querySelector('[data-a="cmp"]').onclick=()=>M.dashboard('cmp',b.code);
  d.querySelector('[data-a="pdf"]').onclick=()=>M.report(b);
  d.querySelector('[data-a="rep"]').onclick=()=>M.report_spot();
});
document.addEventListener('nx:view',drawReps);
wire();drawReps();
setTimeout(()=>M.heat(),1200);
M._t={toggleAir,airStation,D,cols,rowsOf,csv,lin,pinToggle,sheet,close,annotate,chooseType,supaSend,cmds,heatPop};
})();

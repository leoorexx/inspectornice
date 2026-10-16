// ══════════════════════════════════════════════════════════════
// Handeln — Missionen aus der klassischen Ansicht, neu und genauer:
//  Kühle Wege       Straßen unter 40 % Schatten auf Fuß- und Radwegen (Gemeente, Schaduw wegdelen)
//  Schulen          hitzesichere Schulen (Wärmeinsel, Einkommen, Kronen im Umkreis, Kinderanteil)
//  Starkregen       Klimaknelpunte der Gemeente (Straßen unpassierbar, Wasserschäden)
// Jeder Fall: ID, Begründung in Zahlen, Maßnahmen mit Kosten/Förderung/Regelwerk
// (data/rahmen_utr.json), Status, Straßenlabor, Entscheidungs-Brief (PDF).
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const NX=()=>window.__NX;if(!NX())return;
const T=(...a)=>NX().T(...a),L_=()=>NX().lang(),F=v=>NX().fmt(v),N=(v,d)=>NX().nf(v,d);
const cl01=x=>Math.max(0,Math.min(1,x));
const ACT={on:false,m:'wege',cases:{},rahmen:null,sel:null,layer:null,more:false,busy:false};
window.ACT=ACT;
const KEY='nh_act_utr';
const stAll=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch(e){return {};}};
const stGet=c=>stAll()[c.key]||{s:'offen',note:''};
const stSet=(c,v)=>{try{const a=stAll();a[c.key]={...stGet(c),...v,t:new Date().toISOString().slice(0,10)};localStorage.setItem(KEY,JSON.stringify(a));}catch(e){}};
const STATUS=[['offen',()=>T('offen','open','open')],['pruefung',()=>T('in Prüfung','under review','in onderzoek')],['geplant',()=>T('geplant','planned','gepland')],['umgesetzt',()=>T('umgesetzt','done','uitgevoerd')]];
const pct=(arr,v)=>{if(v==null||!arr.length)return null;let lo=0;for(const x of arr)if(x<v)lo++;return lo/Math.max(1,arr.length-1);};
const buurtVals=k=>(NX().BU||[]).map(b=>b.v[k]).filter(v=>v!=null).sort((a,b)=>a-b);
const ICON={flag:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V4h11l-1.5 4L15 12H4"/></svg>'};

// ── Missionen ──
const MISSIONS=[
  {id:'wege',pre:'WEG',col:'#c49a2b',n:()=>T('Kühle Wege','Cool routes','Koele routes'),
    sub:()=>T('Straßen mit weniger als 40 % Schatten auf Fuß- und Radwegen — Richtwert der Landelijke Maatlat','Streets with less than 40 % shade on footpaths and cycle paths — national Maatlat guideline','Straten met minder dan 40 % schaduw op loop- en fietspaden — richtwaarde Landelijke Maatlat'),
    measures:['trees','walktrees','schatten_segel','light','narrow'],tool:'street',load:loadWege},
  {id:'schulen',pre:'SCH',col:'#d0583c',n:()=>T('Hitzesichere Schulen','Heat-safe schools','Hittebestendige scholen'),
    sub:()=>T('Schulen und Kitas, an denen Hitze, wenig Kronendach und niedrige Einkommen zusammenkommen','Schools and nurseries where heat, little canopy and low incomes coincide','Scholen en kinderopvang waar hitte, weinig kronendak en lage inkomens samenkomen'),
    measures:['schulhof','trees','schatten_segel','trinkwasser'],tool:'studio',load:loadSchulen},
  {id:'wasser',pre:'WAT',col:'#2f6fa8',n:()=>T('Starkregen','Heavy rain','Hevige neerslag'),
    sub:()=>T('Klimaknelpunte der Gemeente: Straßen, die bei Starkregen unpassierbar werden, und Gebiete mit Wasserschäden an Gebäuden','Municipal climate hotspots: roads that become impassable in heavy rain and areas with water damage to buildings','Klimaatknelpunten van de gemeente: wegen die bij hevige neerslag onbegaanbaar worden en gebieden met waterschade aan panden'),
    measures:['wadi','afkoppelen','gruendach','gevel'],tool:'water',load:loadWasser}];
const mis=()=>MISSIONS.find(m=>m.id===ACT.m);

async function loadWege(){
  const j=await fetch('data/official/streets_utr.json').then(r=>r.json()),BU=NX().BU,by=new Map(BU.map(b=>[b.code,b])),dens=buurtVals('dichte'),areas=j.streets.map(s=>s.a).sort((a,b)=>a-b);
  const out=[];for(const s of j.streets){if(!(s.sh<40)||/tunnel/i.test(s.n))continue;const b=by.get(s.b);if(!b)continue;const v=b.v,heat=v.uhi!=null?cl01((v.uhi-.5)/2):.5,pp=pct(dens,v.dichte)??.5,def=(40-s.sh)/40,sz=pct(areas,s.a)??.5;   // Länge zählt: mehr Weg = mehr Menschen
    const why=[[N(s.sh,0)+' %',T('Schatten auf Fuß- und Radwegen — Richtwert 40 %','shade on footpaths and cycle paths — guideline 40 %','schaduw op loop- en fietspaden — richtwaarde 40 %')],[F(s.a)+' m²',T('Fuß- und Radweg in dieser Straße','footpath and cycle path in this street','loop- en fietspad in deze straat')]];
    if(v.uhi!=null)why.push(['+'+N(v.uhi,1)+' °C',T('Wärmeinsel im Quartier (Sommermittel)','heat island in the neighbourhood (summer average)','hitte-eiland in de buurt (zomergemiddelde)')]);
    if(v.dichte!=null)why.push([F(v.dichte),T('Einwohner je km² im Quartier','residents per km² in the neighbourhood','inwoners per km² in de buurt')]);
    if(s.y)why.push([String(s.y),T(`angelegt — ${new Date().getFullYear()-s.y>25?'reif für Erneuerung, dann Bäume gleich mitplanen':'noch jung'}`,`laid out — ${new Date().getFullYear()-s.y>25?'due for renewal; plan trees in at the same time':'still recent'}`,`aangelegd — ${new Date().getFullYear()-s.y>25?'toe aan vernieuwing; bomen meteen meenemen':'nog jong'}`)]);
    out.push({key:'wege:'+s.n+'|'+s.p,name:s.n+(s.p&&s.p!=='Utrecht'?' ('+s.p+')':''),lat:s.c[0],lon:s.c[1],b,raw:.35*def+.25*heat+.2*pp+.2*sz,why,src:'Gemeente Utrecht (Schaduw wegdelen 2023) · RIVM · CBS',main:s.sh});}
  return out;
}
async function loadSchulen(){
  const [pois,tr]=await Promise.all([fetch('data/layers/pois_utr.geojson').then(r=>r.json()),fetch('data/official/trees_utr.json').then(r=>r.json()).catch(()=>null)]);
  const Y=new Date().getFullYear(),cell=.0015,grid=new Map();
  if(tr)for(const t of tr.t){const k=Math.round(t[0]/cell)+'_'+Math.round(t[1]/cell);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(t);}
  const canopy=(lat,lon)=>{let a=0;const R=150,kx=Math.round(lat/cell),ky=Math.round(lon/cell);for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(const t of grid.get((kx+i)+'_'+(ky+j))||[]){const dx=(t[1]-lon)*68500,dy=(t[0]-lat)*111320;if(dx*dx+dy*dy>R*R)continue;const age=(t[2]>1800&&t[2]<=Y)?Y-t[2]:25,r=Math.min(6,(1+.35*age)/2);a+=Math.PI*r*r;}return Math.min(100,100*a/(Math.PI*R*R));};
  const low=buurtVals('niedrig'),kids=buurtVals('kinder'),out=[];
  for(const f of pois.features||[]){const p=f.properties||{};if(p.amenity!=='school'&&p.amenity!=='kindergarten')continue;const g=f.geometry;if(!g)continue;
    const c=g.type==='Point'?g.coordinates:(g.coordinates[0]&&g.coordinates[0][0]&&typeof g.coordinates[0][0][0]==='number'?g.coordinates[0][0]:null);if(!c)continue;
    const lat=c[1],lon=c[0],b=NX().buurtAt(lat,lon);if(!b)continue;const v=b.v,cn=canopy(lat,lon),heat=v.uhi!=null?cl01((v.uhi-.5)/2):.5,soc=pct(low,v.niedrig)??.5,kd=pct(kids,v.kinder)??.5;
    const why=[[N(cn,0)+' %',T('Kronendach im Umkreis von 150 m (Baumregister) — Ziel 30 %','canopy within 150 m (tree register) — target 30 %','kronendak binnen 150 m (bomenregister) — doel 30 %')]];
    if(v.uhi!=null)why.push(['+'+N(v.uhi,1)+' °C',T('Wärmeinsel im Quartier','heat island in the neighbourhood','hitte-eiland in de buurt')]);
    if(v.niedrig!=null)why.push([N(v.niedrig,0)+' %',T('Haushalte mit niedrigem Einkommen im Quartier','low-income households in the neighbourhood','huishoudens met laag inkomen in de buurt')]);
    if(v.kinder!=null)why.push([N(v.kinder,0)+' %',T('Kinder unter 15 im Quartier','children under 15 in the neighbourhood','kinderen onder 15 in de buurt')]);
    out.push({key:'schulen:'+(p.name||'')+'|'+lat.toFixed(4)+','+lon.toFixed(4),name:p.name||(p.amenity==='kindergarten'?T('Kita','Nursery','Kinderopvang'):T('Schule','School','School')),lat,lon,b,
      raw:.35*heat+.25*soc+.25*cl01((30-cn)/30)+.15*kd,why,src:'OpenStreetMap (Standorte) · Bomenkaart Gemeente Utrecht · RIVM · CBS',main:cn});}
  return out;
}
async function loadWasser(){
  const KP='https://services-eu1.arcgis.com/SMnoOtmU2UWf0vRp/arcgis/rest/services/Klimaatknelpuntenkaart_Utrecht_WFL1/FeatureServer/',dens=buurtVals('dichte'),out=[];
  for(const l of [0,2]){const j=await fetch(`${KP}${l}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`).then(r=>r.json());
    for(const f of j.features||[]){const pr=f.properties||{},g=f.geometry;if(!g)continue;const ring=(g.type==='Polygon'?g.coordinates[0]:g.coordinates[0][0]);let la=0,lo=0;ring.forEach(c=>{la+=c[1];lo+=c[0];});la/=ring.length;lo/=ring.length;
      const b=NX().buurtAt(la,lo),urg=pr.urg_amb?String(pr.urg_amb).toLowerCase()!=='ambitie':!/ambitie/i.test(String(pr.Opmerkingen||'')),pp=b?pct(dens,b.v.dichte)??.5:.5,name=String(pr.Opmerkingen||'').replace(/,\s*(urgentie|ambitie)$/i,'');
      const why=[[l===0?T('unpassierbar','impassable','onbegaanbaar'):T('Wasserschäden','water damage','waterschade'),l===0?T('Straße bei Starkregen — Klimaknelpunt der Gemeente','road in heavy rain — municipal climate hotspot','weg bij hevige neerslag — klimaatknelpunt gemeente'):T('an Gebäuden bei Starkregen — Klimaknelpunt der Gemeente','to buildings in heavy rain — municipal climate hotspot','aan panden bij hevige neerslag — klimaatknelpunt gemeente')],
        [urg?T('Urgenz','urgency','urgentie'):T('Ambition','ambition','ambitie'),urg?T('Einstufung der Gemeente: dringend','municipal rating: urgent','gemeentelijke inschatting: urgent'):T('Einstufung der Gemeente: Ziel für später','municipal rating: later ambition','gemeentelijke inschatting: ambitie')]];
      if(b&&b.v.dichte!=null)why.push([F(b.v.dichte),T(`Einwohner je km² in ${b.name}`,`residents per km² in ${b.name}`,`inwoners per km² in ${b.name}`)]);
      out.push({key:'wasser:'+l+':'+name,name,lat:la,lon:lo,b,raw:(urg?1:.6)*(.6+.4*pp)+(l===2?.05:0),why,src:'Gemeente Utrecht (Klimaatknelpuntenkaart) · CBS',ring,main:null});}}
  return out;
}

// ── Liste & Karte ──
async function ensure(m){
  if(ACT.cases[m.id])return ACT.cases[m.id];ACT.busy=true;render();
  try{const cs=await m.load();cs.sort((a,b)=>b.raw-a.raw);const mx=cs.length?cs[0].raw:1,mn=cs.length?cs[cs.length-1].raw:0;
    cs.forEach((c,i)=>{c.score=mx>mn?Math.round(100*(c.raw-mn)/(mx-mn)):100;c.id=`UTR-${m.pre}-${String(i+1).padStart(3,'0')}`;c.m=m.id;});ACT.cases[m.id]=cs;}
  catch(e){ACT.cases[m.id]={err:true};}
  ACT.busy=false;return ACT.cases[m.id];
}
function markers(){
  const map=NX().map;if(ACT.layer){map.removeLayer(ACT.layer);ACT.layer=null;}if(!ACT.on)return;const cs=ACT.cases[ACT.m];if(!cs||cs.err)return;const m=mis();
  ACT.layer=L.layerGroup();const top=cs.slice(0,ACT.more?cs.length:40);
  top.slice().reverse().forEach(c=>{const r=4+8*c.score/100,mk=L.circleMarker([c.lat,c.lon],{radius:r,color:'#17151c',weight:1.2,fillColor:m.col,fillOpacity:.35+.55*c.score/100});
    mk.bindTooltip(`<b>${c.id}</b> · ${c.name}`,{direction:'top',offset:[0,-r]});mk.on('click',()=>openCase(c));ACT.layer.addLayer(mk);});
  ACT.layer.addTo(map);
}
function render(){
  let el=document.getElementById('actDrawer');if(!ACT.on){if(el)el.remove();document.body.classList.remove('act-on');return;}
  if(!el){el=document.createElement('aside');el.id='actDrawer';el.className='act';el.setAttribute('aria-label',T('Handeln','Act','Aanpakken'));document.body.appendChild(el);}
  document.body.classList.add('act-on');const m=mis(),cs=ACT.cases[m.id],S=stAll();
  let list='';
  if(ACT.busy&&!cs)list=`<p class="act-hint"><span class="lab-spin" aria-hidden="true"></span> ${T('Fälle werden aus den Daten berechnet …','Computing cases from the data …','Gevallen worden berekend …')}</p>`;
  else if(cs&&cs.err)list=`<p class="act-hint">${T('Die Daten für diese Mission sind gerade nicht erreichbar.','The data for this mission is currently unreachable.','De data voor deze missie zijn nu niet bereikbaar.')}</p>`;
  else if(cs){const shown=cs.slice(0,ACT.more?cs.length:12),done=cs.filter(c=>S[c.key]&&S[c.key].s!=='offen').length;
    list=`<p class="act-sum"><b>${F(cs.length)}</b> ${m.id==='wege'?T('Straßen unter dem Richtwert','streets below the guideline','straten onder de richtwaarde'):m.id==='schulen'?T('Schulen und Kitas bewertet','schools and nurseries rated','scholen en kinderopvang beoordeeld'):T('Knelpunte der Gemeente','municipal hotspots','knelpunten van de gemeente')}${done?` · ${done} ${T('in Arbeit','in progress','in behandeling')}`:''}</p>
      <ol class="act-list">${shown.map(c=>{const st=S[c.key]&&S[c.key].s||'offen';return `<li><button data-c="${c.id}" class="${ACT.sel===c?'on':''}"><span class="act-id">${c.id}</span><b>${c.name}</b><small>${c.b?c.b.name:''}</small><i class="act-bar"><u style="width:${c.score}%;background:${m.col}"></u></i>${st!=='offen'?`<em class="act-st ${st}">${STATUS.find(x=>x[0]===st)[1]()}</em>`:''}</button></li>`;}).join('')}</ol>
      ${cs.length>12?`<button class="act-more" id="actMore">${ACT.more?T('Weniger zeigen','Show fewer','Minder tonen'):T(`Alle ${F(cs.length)} zeigen`,`Show all ${F(cs.length)}`,`Alle ${F(cs.length)} tonen`)}</button>`:''}`;}
  el.innerHTML=`<div class="act-h"><b>${T('Handeln — wo zuerst?','Act — where first?','Aanpakken — waar eerst?')}</b><button class="close" id="actX" aria-label="${T('Schließen','Close','Sluiten')}">×</button></div>
    <div class="act-tabs" role="tablist">${MISSIONS.map(x=>`<button role="tab" data-m="${x.id}" class="${x.id===m.id?'on':''}" aria-selected="${x.id===m.id}"><i style="background:${x.col}"></i>${x.n()}</button>`).join('')}</div>
    <p class="act-sub">${m.sub()}</p>${list}`;
  el.querySelector('#actX').onclick=()=>ACT.toggle(false);
  el.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ACT.m=b.dataset.m;ACT.more=false;show();});
  el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const c=(ACT.cases[ACT.m]||[]).find(x=>x.id===b.dataset.c);if(c)openCase(c);});
  const mo=el.querySelector('#actMore');if(mo)mo.onclick=()=>{ACT.more=!ACT.more;render();markers();};
}
async function show(){render();await ensure(mis());render();markers();}

// ── Fall ──
function rahmenHtml(m){
  const R=ACT.rahmen,Lg=L_();if(!R||!R.massnahmen)return `<p class="act-hint">${T('Kosten, Förderung und Regelwerk je Maßnahme werden gerade recherchiert und erscheinen hier, sobald sie geprüft sind.','Costs, funding and rules per measure are being researched and will appear here once verified.','Kosten, subsidies en regels per maatregel worden onderzocht en verschijnen hier zodra ze gecontroleerd zijn.')}</p>`;
  const tx=o=>o?(o[Lg]||o.de||o.en||''):'';
  return m.measures.map(id=>R.massnahmen.find(x=>x.id===id)).filter(Boolean).map(x=>{
    const k=x.kosten,norms=(x.normen||[]).map(n=>R.normen.find(y=>y.id===n)).filter(Boolean),fo=(x.foerder||[]).map(n=>R.foerder.find(y=>y.id===n)).filter(Boolean);
    return `<article class="act-ms"><b>${tx(x.titel)}</b>${k&&k.lo!=null?`<p class="act-cost">${F(k.lo)}–${F(k.hi)} € <small>${tx(k.einheit)}</small></p>`:''}
      ${x.wirkung&&x.wirkung.text?`<p>${tx(x.wirkung.text)}</p>`:''}
      ${fo.length?`<p class="act-tag">${T('Förderung','Funding','Subsidie')}: ${fo.map(f=>`<a href="${f.quelle}" target="_blank" rel="noopener">${tx(f.titel)}</a>${f.status&&f.status!=='laufend'&&f.status!=='offen'?` <small>(${f.status})</small>`:''}`).join(' · ')}</p>`:''}
      ${norms.length?`<p class="act-tag">${T('Regelwerk','Rules','Regelgeving')}: ${norms.map(n=>`<a href="${n.quelle}" target="_blank" rel="noopener">${tx(n.titel)}</a>${n.verbindlich==='ja'?` <small>(${T('verbindlich','binding','bindend')})</small>`:''}`).join(' · ')}</p>`:''}
      ${(x.anreize||[]).length?`<p class="act-pro">+ ${(x.anreize||[]).map(tx).join(' · ')}</p>`:''}
      ${(x.hemmnisse||[]).length?`<p class="act-con">− ${(x.hemmnisse||[]).map(tx).join(' · ')}</p>`:''}
      ${k&&k.quelle?`<small class="act-src">${T('Kosten','Costs','Kosten')}: <a href="${k.quelle}" target="_blank" rel="noopener">${T('Quelle','source','bron')}</a></small>`:''}</article>`;}).join('');
}
function openCase(c){
  ACT.sel=c;const m=MISSIONS.find(x=>x.id===c.m),P=document.getElementById('panel'),st=stGet(c),nx=NX();
  document.getElementById('pKick').textContent=`${c.id} · ${m.n()}`;
  document.getElementById('pTitle').textContent=c.name;
  document.getElementById('pType').innerHTML=`<i style="background:${m.col}"></i>${T('Dringlichkeit','Priority','Urgentie')} ${c.score}/100${c.b?' · '+c.b.name:''}`;
  document.getElementById('pBody').innerHTML=`
    <div class="act-why">${c.why.map(([v,l])=>`<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    <div class="h">${T('Was hier hilft','What helps here','Wat hier helpt')}</div>${rahmenHtml(m)}
    <div class="h">${T('Status','Status','Status')}</div>
    <div class="act-status" role="group">${STATUS.map(([k,l])=>`<button data-s="${k}" class="${st.s===k?'on':''}" aria-pressed="${st.s===k}">${l()}</button>`).join('')}</div>
    <textarea class="act-note" id="actNote" rows="2" placeholder="${T('Notiz zum Fall (bleibt auf diesem Gerät)','Note on this case (stays on this device)','Notitie bij dit geval (blijft op dit apparaat)')}">${(st.note||'').replace(/</g,'&lt;')}</textarea>
    <button class="cta" id="actLab">${nx.I.lab}${m.tool==='street'?T('Straße im Labor schneiden — Maßnahmen ansehen','Cut the street in the lab — see measures','Straat in het lab doorsnijden — maatregelen bekijken'):m.tool==='water'?T('Wasser im Labor ansehen','See water in the lab','Water bekijken in het lab'):T('Umfeld im Studio auswerten','Analyse surroundings in the studio','Omgeving analyseren in de studio')}</button>
    <button class="cta ghost" id="actPdf">${T('Entscheidungs-Brief (PDF)','Decision brief (PDF)','Beslisnotitie (PDF)')}</button>
    <p class="note">${T('Quellen','Sources','Bronnen')}: ${c.src}. ${T('Dringlichkeit relativ innerhalb dieser Mission (0–100).','Priority relative within this mission (0–100).','Urgentie relatief binnen deze missie (0–100).')}</p>`;
  P.classList.add('on');document.body.classList.add('panel-on');if(nx.MOBILE())nx.sheet('half');
  nx.map.flyTo([c.lat,c.lon],Math.max(nx.map.getZoom(),16),{duration:.8});
  P.querySelectorAll('.act-status [data-s]').forEach(b=>b.onclick=()=>{stSet(c,{s:b.dataset.s});openCase(c);render();});
  const no=P.querySelector('#actNote');no.onchange=()=>stSet(c,{note:no.value});
  P.querySelector('#actLab').onclick=()=>labFor(c,m);
  P.querySelector('#actPdf').onclick=()=>brief(c,m);
  render();
}
function labFor(c,m){
  const nx=NX();nx.openLab([c.lat,c.lon],m.tool==='studio'?'studio':m.tool==='water'?'water':'street');
  const LAB=window.LAB;if(!LAB)return;
  if(m.tool==='studio'&&LAB.area){LAB.area.AR.type='circle';LAB.area.AR.r=100;LAB.area.AR.center=L.latLng(c.lat,c.lon);}
  if(m.tool==='street')setTimeout(()=>{nx.map.fire('click',{latlng:L.latLng(c.lat,c.lon),containerPoint:nx.map.latLngToContainerPoint([c.lat,c.lon])});},1200);   // Schnitt am Fall
}

// ── Entscheidungs-Brief (PDF) ──
let jspdfLoad=null;
const jspdf=()=>window.jspdf?Promise.resolve(window.jspdf):(jspdfLoad=jspdfLoad||new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=()=>res(window.jspdf);s.onerror=rej;document.head.appendChild(s);}));
async function brief(c,m){
  let lib;try{lib=await jspdf();}catch(e){alert(T('PDF-Bibliothek gerade nicht erreichbar.','PDF library currently unreachable.','PDF-bibliotheek nu niet bereikbaar.'));return;}
  const doc=new lib.jsPDF({unit:'mm',format:'a4'}),W=210,M=18,Lg=L_(),tx=o=>o?(o[Lg]||o.de||''):'',st=stGet(c);let y=20;
  const line=(t,size,bold,col)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...(col||[23,21,28]));const ls=doc.splitTextToSize(String(t).replace(/[–—]/g,'-').replace(/[„“"]/g,'"'),W-2*M);for(const l of ls){if(y>282){doc.addPage();y=20;}doc.text(l,M,y);y+=size*.45;}y+=1.5;};
  doc.setFillColor(255,214,0);doc.rect(0,0,W,6,'F');
  line('INSPECTOR NICE · '+T('ENTSCHEIDUNGS-BRIEF','DECISION BRIEF','BESLISNOTITIE'),9,true,[124,119,134]);
  line(`${c.id} · ${m.n()}`,11,true);line(c.name,20,true);
  line(`${c.b?c.b.name+' · ':''}${T('Dringlichkeit','Priority','Urgentie')} ${c.score}/100 · Status: ${STATUS.find(x=>x[0]===st.s)[1]()} · ${new Date().toISOString().slice(0,10)}`,10,false,[70,66,79]);
  y+=3;line(T('Warum hier','Why here','Waarom hier'),13,true);for(const [v,l] of c.why)line(`${v} — ${l}`,10.5);
  y+=3;line(T('Was hier hilft','What helps here','Wat hier helpt'),13,true);
  const R=ACT.rahmen;if(R&&R.massnahmen){for(const id of m.measures){const x=R.massnahmen.find(q=>q.id===id);if(!x)continue;line(tx(x.titel),11.5,true);
      if(x.kosten&&x.kosten.lo!=null)line(`${T('Kosten','Costs','Kosten')}: ${F(x.kosten.lo)}-${F(x.kosten.hi)} EUR ${tx(x.kosten.einheit)}`,10);
      const fo=(x.foerder||[]).map(n=>R.foerder.find(q=>q.id===n)).filter(Boolean);if(fo.length)line(`${T('Förderung','Funding','Subsidie')}: ${fo.map(f=>tx(f.titel)).join('; ')}`,10);
      const no=(x.normen||[]).map(n=>R.normen.find(q=>q.id===n)).filter(Boolean);if(no.length)line(`${T('Regelwerk','Rules','Regelgeving')}: ${no.map(n=>tx(n.titel)).join('; ')}`,10);
      if((x.anreize||[]).length)line('+ '+x.anreize.map(tx).join('; '),9.5,false,[47,106,85]);if((x.hemmnisse||[]).length)line('- '+x.hemmnisse.map(tx).join('; '),9.5,false,[163,40,58]);y+=1;}}
  else line(T('Maßnahmen, Kosten und Förderung werden ergänzt.','Measures, costs and funding to follow.','Maatregelen, kosten en subsidies volgen.'),10);
  if(st.note){y+=3;line(T('Notiz','Note','Notitie'),13,true);line(st.note,10.5);}
  y+=4;line(`${T('Quellen','Sources','Bronnen')}: ${c.src}. ${T('Ort','Location','Locatie')}: ${c.lat.toFixed(5)}, ${c.lon.toFixed(5)} · inspectornice.nicehere.nl`,8.5,false,[124,119,134]);
  doc.save(`inspector-nice_${c.id}_${new Date().toISOString().slice(0,10)}.pdf`);
}

ACT.toggle=function(on){ACT.on=on==null?!ACT.on:on;const ch=document.getElementById('actChip');if(ch)ch.classList.toggle('on',ACT.on);
  if(ACT.on){if(window.LAB&&LAB.on)LAB.close();show();if(!ACT.rahmen)fetch('data/rahmen_utr.json').then(r=>r.ok?r.json():null).then(j=>{ACT.rahmen=j;}).catch(()=>{});}
  else{render();markers();}};
ACT._t={MISSIONS,ensure,openCase,stAll,stGet,stSet,loadWege,loadSchulen,loadWasser,brief};
try{if(new URLSearchParams(location.search).get('act')){const m=new URLSearchParams(location.search).get('act');if(MISSIONS.some(x=>x.id===m))ACT.m=m;setTimeout(()=>ACT.toggle(true),600);}}catch(e){}
})();

// ══════════════════════════════════════════════════════════════
// Straßenlabor · Werkzeuge „Fläche" (Steckbrief wie aino) und „Export"
// (wie CADMapper): Gebiet wählen → Kennzahlen aus 3D BAG, BGT und
// Baumregister; Export als DXF (2D + 3D), OBJ, GeoJSON und SVG in
// Rijksdriehoek-Metern (EPSG:28992) mit lokalem Ursprung.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n);
const AR={type:'circle',r:200,center:null,pts:[],done:false,stats:null,busy:false,flood:null};

// ── Gebiet als Ring (lat/lon) und in Weltpixeln ──
function ring(){
  if(AR.type==='view'){const b=A.map.getBounds().pad(-.08);return [[b.getSouth(),b.getWest()],[b.getSouth(),b.getEast()],[b.getNorth(),b.getEast()],[b.getNorth(),b.getWest()]];}
  if(AR.type==='draw')return AR.done&&AR.pts.length>=3?AR.pts.map(p=>[p.lat,p.lng]):null;
  const c=AR.center||A.map.getCenter(),out=[],dLat=AR.r/111320,dLon=AR.r/(111320*Math.cos(c.lat*A.SR));
  for(let i=0;i<64;i++){const a=i/64*2*Math.PI;out.push([c.lat+dLat*Math.sin(a),c.lng+dLon*Math.cos(a)]);}return out;
}
function zOf(r){const z=new Float64Array((r.length+1)*2);r.concat([r[0]]).forEach((p,i)=>{const q=A.w20(p[0],p[1]);z[2*i]=q[0];z[2*i+1]=q[1];});return z;}
function bbox(z){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<z.length;i+=2){x0=Math.min(x0,z[i]);x1=Math.max(x1,z[i]);y0=Math.min(y0,z[i+1]);y1=Math.max(y1,z[i+1]);}return [x0,y0,x1,y1];}
function centroid(z){let x=0,y=0;const n=z.length/2-1;for(let i=0;i<n;i++){x+=z[2*i];y+=z[2*i+1];}return [x/n,y/n];}
const area2=z=>Math.abs(A.signed(z))/2;

// ── Steckbrief ──
async function compute(){
  const r=ring();if(!r){AR.stats=null;return;}
  AR.busy=true;A.rerender();
  await Promise.all([A.ensure('b'),A.ensure('s'),A.ensureTrees().then(A.measureTrees)]);
  const z=zOf(r),m=A.m20(),m2=m*m,[x0,y0,x1,y1]=bbox(z),Am=area2(z)*m2;
  const blds=A.B.list.filter(b=>{const c=centroid(b.z);return c[0]>=x0&&c[0]<=x1&&c[1]>=y0&&c[1]<=y1&&A.inPoly(c[0],c[1],z);});
  let foot=0,vol=0,gfa=0,hsum=0,hmax=0,meas=0;
  for(const b of blds){const a=area2(b.z)*m2;foot+=a;if(b.h!=null){meas++;vol+=a*b.h;gfa+=a*Math.max(1,Math.round(b.h/3.2));hsum+=a*b.h;hmax=Math.max(hmax,b.h);}}
  // Flächenanteile per Rasterung (≤ 600 px Kante)
  const res=Math.max(.5,Math.max(x1-x0,y1-y0)*m/600),W=Math.max(8,Math.ceil((x1-x0)*m/res)),H=Math.max(8,Math.ceil((y1-y0)*m/res)),X={k:m/res,ox:x0*m/res,oy:y0*m/res,sc:1};
  const g=A.offscreen(W,H,true);
  const by={sealed:'#ff0000',unpaved:'#ffff00',green:'#00ff00',water:'#0000ff'},cls=['sealed','unpaved','green','water'];
  for(const k of cls)A.chunked(g,A.S.list.filter(o=>cls[o.c]===k),16,o=>A.poly(g,o.z,X),by[k]);
  A.chunked(g,A.B.list,16,b=>A.poly(g,b.z,X),'#ff00ff');
  const d1=g.getImageData(0,0,W,H).data;
  g.clearRect(0,0,W,H);g.fillStyle='#fff';g.beginPath();A.poly(g,z,X);g.fill();const mk=g.getImageData(0,0,W,H).data;
  g.clearRect(0,0,W,H);const trees=A.treesIn(.05,L.latLngBounds(r)).filter(t=>A.inPoly(t[4],t[5],z));
  A.chunked(g,trees,48,t=>{const x=t[4]*X.k-X.ox,y=t[5]*X.k-X.oy,rr=t[2]/res;g.moveTo(x+rr,y);g.arc(x,y,rr,0,2*Math.PI);},'#fff');const cr=g.getImageData(0,0,W,H).data;
  const cnt={bld:0,sealed:0,unpaved:0,green:0,water:0,none:0};let inside=0,canopy=0;
  for(let p=0;p<mk.length;p+=4){if(mk[p+3]<128)continue;inside++;if(cr[p+3]>127)canopy++;const R=d1[p]>127,G=d1[p+1]>127,Bl=d1[p+2]>127;
    cnt[R&&Bl?'bld':R&&G?'unpaved':R?'sealed':G?'green':Bl?'water':'none']++;}
  const sh=k=>inside?100*cnt[k]/inside:0;
  // Baumarten und Alter
  const gen={};let yrs=[];const Y=new Date().getFullYear();for(const t of trees){const n=A.GENERA[t[6]]||'?';gen[n]=(gen[n]||0)+1;if(t[7]>1800&&t[7]<=Y)yrs.push(t[7]);}
  yrs.sort((a,b)=>a-b);
  // Sonnenstunden, falls für diesen Ausschnitt berechnet
  let sun=null;if(A.SUNH&&A.SUNH.hrs){let s=0,n=0;for(let i=0;i<40;i++)for(let j=0;j<40;j++){const wx=x0+(x1-x0)*(i+.5)/40,wy=y0+(y1-y0)*(j+.5)/40;if(!A.inPoly(wx,wy,z)||A.hits(A.B,wx,wy).length)continue;const v=A.sunHoursAt(wx,wy);if(v){s+=v.h;n++;}}if(n)sun={h:s/n,max:A.SUNH.maxH,date:A.dayDate()};}
  AR.stats={Am,n:blds.length,meas,foot,vol,gfa,hmean:meas&&foot?hsum/blds.filter(b=>b.h!=null).reduce((p,b)=>p+area2(b.z)*m2,0):null,hmax,
    share:{bld:sh('bld'),sealed:sh('sealed'),unpaved:sh('unpaved'),green:sh('green'),water:sh('water'),none:sh('none')},canopy:inside?100*canopy/inside:0,
    trees:trees.length,gen:Object.entries(gen).sort((a,b)=>b[1]-a[1]).slice(0,3),age:yrs.length?Y-yrs[yrs.length>>1]:null,sun,z};
  AR.flood=null;AR.busy=false;A.rerender();A.req();
}
function insights(s){
  const out=[],sealedAll=s.share.bld+s.share.sealed;
  if(s.canopy<15)out.push(T(`Kronendach ${Math.round(s.canopy)} % — weit unter dem Ziel von 30 % (3-30-300-Regel). Bäume bringen hier am meisten Schatten.`,`Canopy ${Math.round(s.canopy)} % — far below the 30 % target (3-30-300 rule). Trees would add the most shade here.`,`Kronendak ${Math.round(s.canopy)} % — ver onder het doel van 30 % (3-30-300-regel). Bomen leveren hier de meeste schaduw.`));
  else if(s.canopy<30)out.push(T(`Kronendach ${Math.round(s.canopy)} % — unter dem Ziel von 30 %.`,`Canopy ${Math.round(s.canopy)} % — below the 30 % target.`,`Kronendak ${Math.round(s.canopy)} % — onder het doel van 30 %.`));
  else out.push(T(`Kronendach ${Math.round(s.canopy)} % — Ziel von 30 % erreicht.`,`Canopy ${Math.round(s.canopy)} % — 30 % target reached.`,`Kronendak ${Math.round(s.canopy)} % — doel van 30 % gehaald.`));
  if(sealedAll>70)out.push(T(`${Math.round(sealedAll)} % bebaut oder versiegelt — Regen fließt hier fast vollständig ab; Entsiegeln und Wasserspeicher (Wadi, Gründach) entlasten.`,`${Math.round(sealedAll)} % built or sealed — rain runs off almost entirely here; unsealing and water storage (swales, green roofs) help.`,`${Math.round(sealedAll)} % bebouwd of verhard — regen stroomt hier bijna volledig af; ontharden en waterberging (wadi, groen dak) helpen.`));
  if(s.sun&&s.sun.h>s.sun.max*.6)out.push(T(`Im Mittel ${A.nf(s.sun.h,1)} von ${A.nf(s.sun.max,1)} Stunden Sonne am Boden — Hitze-Schwerpunkt im Sommer.`,`On average ${A.nf(s.sun.h,1)} of ${A.nf(s.sun.max,1)} hours of sun at ground level — a summer heat hotspot.`,`Gemiddeld ${A.nf(s.sun.h,1)} van ${A.nf(s.sun.max,1)} uur zon op maaiveld — hittepunt in de zomer.`));
  return out;
}
function steckbrief(){
  const s=AR.stats,ha=s.Am/1e4,F=A.fmt,bar=[['bld','#ece6da'],['sealed','#8f8b97'],['unpaved','#cfc4ad'],['green','#7a8c3a'],['water','#5c88b2'],['none','#e4ded2']];
  const nm={bld:T('Gebäude','Buildings','Gebouwen'),sealed:T('versiegelt','sealed','verhard'),unpaved:T('teilbefestigt','semi-paved','halfverhard'),green:T('Grün','green','groen'),water:T('Wasser','water','water'),none:T('ohne Angabe','no data','geen gegevens')};
  return `<div class="ar-head"><b>${ha>=1?A.nf(ha,1)+' ha':F(s.Am)+' m²'}</b><span>${AR.type==='circle'?T('Kreis','circle','cirkel')+' r = '+AR.r+' m':AR.type==='view'?T('Kartenausschnitt','map view','kaartbeeld'):T('gezeichnete Fläche','drawn area','getekend gebied')}</span></div>
    <div class="ar-bar">${bar.map(([k,c])=>s.share[k]>.5?`<i style="flex:${s.share[k]};background:${c}" title="${nm[k]} ${Math.round(s.share[k])} %"></i>`:'').join('')}</div>
    <div class="ar-bl">${bar.filter(([k])=>s.share[k]>=1).map(([k,c])=>`<span><i style="background:${c}"></i>${nm[k]} ${Math.round(s.share[k])} %</span>`).join('')}</div>
    <div class="ar-grid">
      <div><b>${F(s.n)}</b><span>${T('Gebäude','buildings','gebouwen')}</span></div>
      <div><b>${s.hmean!=null?A.nf(s.hmean,1)+' m':'—'}</b><span>${T('Ø Höhe','avg. height','gem. hoogte')} · max ${A.nf(s.hmax,0)} m</span></div>
      <div><b>${F(s.gfa)} m²</b><span>${T('≈ Geschossfläche','≈ floor area','≈ vloeroppervlak')}</span></div>
      <div><b>${F(s.vol/1000)}k m³</b><span>${T('Bauvolumen','building volume','bouwvolume')}</span></div>
      <div><b>${F(s.trees)}</b><span>${T('Bäume im Register','register trees','bomen in register')}${s.age!=null?` · Ø ${s.age} ${T('J.','yrs','jr')}`:''}</span></div>
      <div><b>${Math.round(s.canopy)} %</b><span>${T('Kronendach (geschätzt)','canopy (estimated)','kronendak (geschat)')}</span></div>
      ${s.sun?`<div><b>${A.nf(s.sun.h,1)} h</b><span>${T('Ø Sonne am Boden','avg. sun at ground','gem. zon op maaiveld')}</span></div>`:''}
      ${AR.flood?`<div><b>${AR.flood.v==null?'—':AR.flood.v===0?T('trocken','dry','droog'):A.nf(AR.flood.v,1)+' m'}</b><span>${T('Wasser 1/1.000 J. (Mitte)','water 1/1,000 yr (centre)','water 1/1.000 jr (midden)')}</span></div>`:''}
    </div>
    ${s.gen.length?`<p class="ar-gen">${T('Häufigste Bäume','Most common trees','Meest voorkomende bomen')}: ${s.gen.map(([n,c])=>`${n} <em>${c}</em>`).join(' · ')}</p>`:''}
    <div class="ar-ins">${insights(s).map(t=>`<p>${t}</p>`).join('')}</div>
    <div class="ar-act">${s.sun?'':`<button class="cta ghost lab-mini" id="arSun">${A.IC.sun}${T('Sonnenstunden ergänzen','Add sun hours','Zonuren toevoegen')}</button>`}${AR.flood?'':`<button class="cta ghost lab-mini" id="arFlood">${T('Überflutungstiefe prüfen','Check flood depth','Overstromingsdiepte checken')}</button>`}<button class="cta ghost lab-mini" id="arExp">${T('Als CAD/GIS exportieren','Export as CAD/GIS','Exporteren als CAD/GIS')}</button></div>`;
}

LAB.addTool({id:'area',order:6,usesSurfaces:true,
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 7 12 3l8 5-2 11H7Z"/><circle cx="4" cy="7" r="1.6" fill="currentColor"/><circle cx="12" cy="3" r="1.6" fill="currentColor"/><circle cx="20" cy="8" r="1.6" fill="currentColor"/><circle cx="18" cy="19" r="1.6" fill="currentColor"/><circle cx="7" cy="19" r="1.6" fill="currentColor"/></svg>',
  label:()=>T('Fläche','Area','Gebied'),
  sub:()=>T('Gebiet wählen, Steckbrief erhalten','Pick an area, get a profile','Kies een gebied, krijg een profiel'),
  enter(){if(!AR.center)AR.center=A.PIN||A.map.getCenter();},
  render(){
    const modes=A.seg([['circle',T('Kreis','Circle','Cirkel')],['draw',T('Zeichnen','Draw','Tekenen')],['view',T('Ausschnitt','View','Beeld')]],AR.type);
    let ctl='';
    if(AR.type==='circle')ctl=`<div class="wt-chips">${[100,200,400].map(r=>`<button data-r="${r}" class="${AR.r===r?'on':''}">r = ${r} m</button>`).join('')}</div><p class="lab-hint">${T('Tippe auf die Karte, um den Kreis zu setzen.','Tap the map to place the circle.','Tik op de kaart om de cirkel te plaatsen.')}</p>`;
    if(AR.type==='draw')ctl=`<p class="lab-hint">${AR.done?T('Fläche fertig.','Area done.','Gebied klaar.'):T(`Tippe Eckpunkte auf die Karte (${AR.pts.length} gesetzt).`,`Tap corner points on the map (${AR.pts.length} placed).`,`Tik hoekpunten op de kaart (${AR.pts.length} geplaatst).`)}</p><div class="wt-chips"><button id="arDone" ${AR.pts.length<3||AR.done?'disabled':''}>${T('Fläche schließen','Close area','Gebied sluiten')}</button><button id="arNew">${T('Neu zeichnen','Redraw','Opnieuw tekenen')}</button></div>`;
    if(AR.type==='view')ctl=`<div class="wt-chips"><button id="arGo">${T('Ausschnitt auswerten','Analyse this view','Dit beeld analyseren')}</button></div>`;
    return modes+ctl+(AR.busy?`<p class="lab-hint"><span class="lab-spin" aria-hidden="true"></span> ${T('Steckbrief wird berechnet …','Computing profile …','Profiel wordt berekend …')}</p>`:AR.stats?steckbrief():'');
  },
  bind(root){
    root.querySelectorAll('[data-m]').forEach(el=>el.onclick=()=>{AR.type=el.dataset.m;AR.stats=null;if(AR.type==='draw'){AR.pts=[];AR.done=false;}A.rerender();A.req();if(AR.type==='circle')compute();});
    root.querySelectorAll('[data-r]').forEach(el=>el.onclick=()=>{AR.r=+el.dataset.r;fit();compute();});
    const dn=root.querySelector('#arDone');if(dn)dn.onclick=()=>{AR.done=true;compute();};
    const nw=root.querySelector('#arNew');if(nw)nw.onclick=()=>{AR.pts=[];AR.done=false;AR.stats=null;A.rerender();A.req();};
    const go=root.querySelector('#arGo');if(go)go.onclick=()=>compute();
    const su=root.querySelector('#arSun');if(su)su.onclick=async()=>{su.disabled=true;await A.computeSunHours();compute();};
    const fl=root.querySelector('#arFlood');if(fl)fl.onclick=async()=>{fl.disabled=true;const c=centroid(AR.stats.z),ll=A.map.unproject([c[0],c[1]],20),cp=A.map.latLngToContainerPoint(ll);
      const v=LAB.water?await LAB.water.depthAt(3,{containerPoint:cp}):null;AR.flood={v};A.rerender();};
    const ex=root.querySelector('#arExp');if(ex)ex.onclick=()=>A.setTool('export');
  },
  async load(){await Promise.all([A.ensure('b'),A.ensure('s'),A.ensureTrees()]);if(!AR.stats&&!AR.busy&&AR.type==='circle')compute();},
  moved(){if(AR.type==='view'&&AR.stats){AR.stats=null;A.rerender();}},
  draw(g,X){
    const dark=A.dark();A.drawBuildings(g,X,dark?'rgba(60,56,66,.6)':'rgba(251,249,244,.75)',dark?'rgba(255,255,255,.18)':'rgba(23,21,28,.3)');
    A.drawCrowns(g,X,'rgba(72,140,84,.25)',dark?'rgba(150,210,150,.35)':'rgba(31,90,43,.35)');
    outline(g,X,dark);
  },
  click(e){
    if(AR.type==='circle'){AR.center=e.latlng;compute();A.req();return null;}
    if(AR.type==='draw'&&!AR.done){AR.pts.push(e.latlng);A.rerender();A.req();return null;}
    return null;},
  note:()=>T('Gebäude mit Mittelpunkt in der Fläche (3D BAG, gemessene Höhen); Geschossfläche geschätzt mit 3,2 m je Geschoss. Flächenanteile per Rasterung der BGT (nur aktuell gültige Objekte) und der Gebäudegrundrisse. Kronendach aus dem Baumregister mit geschätzter Kronengröße; private Bäume fehlen. Sonnenstunden und Überflutungstiefe auf Wunsch aus den Werkzeugen Sonne und Wasser.','Buildings with their centre inside the area (3D BAG, measured heights); floor area estimated at 3.2 m per storey. Surface shares by rasterising the BGT (current objects only) and building footprints. Canopy from the tree register with estimated crown size; private trees are missing. Sun hours and flood depth on request from the Sun and Water tools.','Gebouwen met middelpunt in het gebied (3D BAG, gemeten hoogtes); vloeroppervlak geschat met 3,2 m per verdieping. Aandelen door rastering van de BGT (alleen actuele objecten) en gebouwcontouren. Kronendak uit het bomenregister met geschatte kroongrootte; particuliere bomen ontbreken. Zonuren en overstromingsdiepte op verzoek uit de gereedschappen Zon en Water.'),
  src:()=>`3D BAG (TU Delft / 3DGI, CC BY 4.0) · BGT (Kadaster / PDOK) · ${T('Baumregister Gemeente Utrecht','Tree register, Gemeente Utrecht','Bomenregister gemeente Utrecht')}`
});
function fit(){const r=ring();if(!r)return;const b=L.latLngBounds(r);if(!A.map.getBounds().contains(b)&&A.map.getSize().x)A.map.fitBounds(b.pad(.15),{maxZoom:18});}
function outline(g,X,dark){
  const r=ring(),ink=dark?'rgba(243,239,231,':'rgba(23,21,28,';
  if(AR.type==='draw'&&!AR.done){g.fillStyle='#FFD600';g.strokeStyle=ink+'.9)';g.lineWidth=2*X.sc;g.setLineDash([5*X.sc,4*X.sc]);g.beginPath();
    AR.pts.forEach((p,i)=>{const q=A.w20(p.lat,p.lng),x=q[0]*X.k-X.ox,y=q[1]*X.k-X.oy;i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();g.setLineDash([]);
    AR.pts.forEach(p=>{const q=A.w20(p.lat,p.lng);g.beginPath();g.arc(q[0]*X.k-X.ox,q[1]*X.k-X.oy,5*X.sc,0,2*Math.PI);g.fill();g.stroke();});return;}
  if(!r)return;const z=zOf(r);
  g.save();g.fillStyle=dark?'rgba(10,9,14,.45)':'rgba(241,237,229,.55)';g.beginPath();g.rect(0,0,g.canvas.width,g.canvas.height);A.poly(g,z,X);g.fill('evenodd');   // Spotlight
  g.strokeStyle=ink+'.9)';g.lineWidth=2*X.sc;g.setLineDash([7*X.sc,5*X.sc]);g.beginPath();A.poly(g,z,X);g.stroke();g.restore();
}

// ── Export ──
function exportSet(){
  const r=AR.type==='draw'&&!AR.done?null:ring()||null,z=r?zOf(r):null,[x0,y0,x1,y1]=z?bbox(z):(()=>{const b=A.map.getBounds(),a=A.w20(b.getNorth(),b.getWest()),c=A.w20(b.getSouth(),b.getEast());return [a[0],a[1],c[0],c[1]];})();
  const inB=(x,y)=>x>=x0&&x<=x1&&y>=y0&&y<=y1;
  const rd=(x,y)=>{const ll=A.map.unproject([x,y],20);return A.toRD(ll.lat,ll.lng);};
  const blds=A.B.list.filter(b=>{const c=centroid(b.z);return inB(c[0],c[1])&&(!z||A.inPoly(c[0],c[1],z));});
  const surfs=A.S.list.map(o=>({o,z:clip(o.z,x0,y0,x1,y1)})).filter(s=>s.z&&s.z.length>=6);
  const trees=(A.TREES||[]).filter(t=>inB(t[4],t[5])&&(!z||A.inPoly(t[4],t[5],z)));
  const all=[[x0,y0],[x1,y1]].map(([x,y])=>rd(x,y)),ox=Math.floor(Math.min(all[0][0],all[1][0])/10)*10,oy=Math.floor(Math.min(all[0][1],all[1][1])/10)*10;
  const gmin=Math.min(...blds.map(b=>b.g).filter(v=>v!=null),Infinity);
  const loc=(x,y)=>{const p=rd(x,y);return [p[0]-ox,p[1]-oy];};
  return {r,z,blds,surfs,trees,ox,oy,gmin:isFinite(gmin)?gmin:0,loc,rd,frame:[x0,y0,x1,y1],w:Math.abs(all[1][0]-all[0][0]),h:Math.abs(all[1][1]-all[0][1])};
}
// Sutherland–Hodgman am Rechteck
function clip(z,x0,y0,x1,y1){
  let pts=[];for(let i=0;i<z.length-2;i+=2)pts.push([z[i],z[i+1]]);
  const edges=[[p=>p[0]>=x0,(a,b)=>[x0,a[1]+(b[1]-a[1])*(x0-a[0])/(b[0]-a[0])]],[p=>p[0]<=x1,(a,b)=>[x1,a[1]+(b[1]-a[1])*(x1-a[0])/(b[0]-a[0])]],
    [p=>p[1]>=y0,(a,b)=>[a[0]+(b[0]-a[0])*(y0-a[1])/(b[1]-a[1]),y0]],[p=>p[1]<=y1,(a,b)=>[a[0]+(b[0]-a[0])*(y1-a[1])/(b[1]-a[1]),y1]]];
  for(const [ins,cut] of edges){const out=[];for(let i=0;i<pts.length;i++){const a=pts[(i+pts.length-1)%pts.length],b=pts[i];
      if(ins(b)){if(!ins(a))out.push(cut(a,b));out.push(b);}else if(ins(a))out.push(cut(a,b));}pts=out;if(!pts.length)return null;}
  const r=new Float64Array((pts.length+1)*2);pts.concat([pts[0]]).forEach((p,i)=>{r[2*i]=p[0];r[2*i+1]=p[1];});return r;
}
// Ohrenschneiden für Dachflächen (einfache Polygone)
function triangulate(P){
  const n=P.length;if(n<3)return [];let area=0;for(let i=0;i<n;i++){const a=P[i],b=P[(i+1)%n];area+=a[0]*b[1]-b[0]*a[1];}
  const idx=[...Array(n).keys()];if(area<0)idx.reverse();const tris=[];let guard=0;
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const inTri=(p,a,b,c)=>cross(a,b,p)>=0&&cross(b,c,p)>=0&&cross(c,a,p)>=0;
  while(idx.length>3&&guard++<5000){let cut=false;
    for(let i=0;i<idx.length;i++){const i0=idx[(i+idx.length-1)%idx.length],i1=idx[i],i2=idx[(i+1)%idx.length],a=P[i0],b=P[i1],c=P[i2];
      if(cross(a,b,c)<=1e-9)continue;if(idx.some(j=>j!==i0&&j!==i1&&j!==i2&&inTri(P[j],a,b,c)))continue;tris.push([i0,i1,i2]);idx.splice(i,1);cut=true;break;}
    if(!cut)break;}
  if(idx.length===3)tris.push(idx.slice());
  if(idx.length>3)for(let i=1;i<idx.length-1;i++)tris.push([idx[0],idx[i],idx[i+1]]);   // Rückfall: Fächer
  return tris;
}
const LAYER_OF=o=>{const t=LAB.street?LAB.street.typeOf(o):'';return {car:'FAHRBAHN',transit:'FAHRBAHN',bike:'RADWEG',walk:'GEHWEG',shared:'GEHWEG',park:'PARKEN',green:'GRUEN',verge:'GRUEN',water:'WASSER',island:'SONSTIGE',yard:'SONSTIGE',paved:'SONSTIGE',rail:'SONSTIGE'}[t]||(o.c===2?'GRUEN':o.c===3?'WASSER':'SONSTIGE');};
const ACI={RAHMEN:2,GEBAEUDE:7,GEBAEUDE_3D:8,FAHRBAHN:8,RADWEG:1,GEHWEG:9,PARKEN:251,GRUEN:3,WASSER:5,SONSTIGE:252,BAEUME:94};
const ringPts=(z,E)=>{const P=[];for(let i=0;i<z.length-2;i+=2)P.push(E.loc(z[i],z[i+1]));return P;};
const f3=v=>(Math.round(v*1000)/1000).toString();
function header(E,fmt){const d=new Date().toISOString().slice(0,10);
  return [`Inspector Nice · Straßenlabor · ${fmt}`,`Erzeugt ${d} · Koordinaten: Rijksdriehoek (EPSG:28992), Meter, lokaler Ursprung X=${E.ox} Y=${E.oy}`,
    `Höhen relativ zum niedrigsten Maaiveld im Gebiet (${A.nf(E.gmin,2)} m NAP)`,'Quellen: 3D BAG (TU Delft / 3DGI, CC BY 4.0) · BGT (Kadaster / PDOK) · Bomenkaart Gemeente Utrecht',
    'Gebäudehöhe = 70-%-Dachhöhe − Maaiveld (LoD 1.2); Baumkronen aus dem Pflanzjahr geschätzt'];}
function dxf(E,opts){
  const L=[],add=(...a)=>{for(const x of a)L.push(String(x));},layers=Object.keys(ACI);
  header(E,'DXF').forEach(h=>add(999,h));
  add(0,'SECTION',2,'HEADER',9,'$ACADVER',1,'AC1009',9,'$INSBASE',10,0,20,0,30,0,9,'$EXTMIN',10,0,20,0,30,0,9,'$EXTMAX',10,f3(E.w),20,f3(E.h),30,0,0,'ENDSEC');
  add(0,'SECTION',2,'TABLES',0,'TABLE',2,'LTYPE',70,1,0,'LTYPE',2,'CONTINUOUS',70,0,3,'Solid line',72,65,73,0,40,0,0,'ENDTAB');
  add(0,'TABLE',2,'LAYER',70,layers.length);for(const l of layers)add(0,'LAYER',2,l,70,0,62,ACI[l],6,'CONTINUOUS');add(0,'ENDTAB',0,'ENDSEC');
  add(0,'SECTION',2,'ENTITIES');
  const pl=(layer,P,z,thick)=>{add(0,'POLYLINE',8,layer,66,1,70,1);if(thick)add(39,f3(thick));add(10,0,20,0,30,f3(z||0));for(const p of P)add(0,'VERTEX',8,layer,10,f3(p[0]),20,f3(p[1]),30,f3(z||0));add(0,'SEQEND',8,layer);};
  const fr=[E.loc(E.frame[0],E.frame[1]),E.loc(E.frame[2],E.frame[1]),E.loc(E.frame[2],E.frame[3]),E.loc(E.frame[0],E.frame[3])];pl('RAHMEN',fr,0);
  if(opts.surf)for(const s of E.surfs)pl(LAYER_OF(s.o),ringPts(s.z,E),0);
  if(opts.bld)for(const b of E.blds){const P=ringPts(b.z,E),g0=b.g!=null?b.g-E.gmin:0,h=b.h||0;pl('GEBAEUDE',P,g0,h);
    if(h>0){const face=(a,b2,c,d)=>add(0,'3DFACE',8,'GEBAEUDE_3D',10,f3(a[0]),20,f3(a[1]),30,f3(a[2]),11,f3(b2[0]),21,f3(b2[1]),31,f3(b2[2]),12,f3(c[0]),22,f3(c[1]),32,f3(c[2]),13,f3(d[0]),23,f3(d[1]),33,f3(d[2]));
      for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];face([p[0],p[1],g0],[q[0],q[1],g0],[q[0],q[1],g0+h],[p[0],p[1],g0+h]);}
      for(const t of triangulate(P)){const [a,b2,c]=t.map(i=>[P[i][0],P[i][1],g0+h]);face(a,b2,c,c);}}}
  if(opts.trees)for(const t of E.trees){const p=E.loc(t[4],t[5]);add(0,'CIRCLE',8,'BAEUME',10,f3(p[0]),20,f3(p[1]),30,0,40,f3(t[2]));}
  add(0,'ENDSEC',0,'EOF');
  return L.join('\n');
}
function obj(E){
  const out=header(E,'OBJ (Y nach oben, −Z = Norden)').map(h=>'# '+h);let v=0;
  E.blds.forEach((b,k)=>{if(!(b.h>0))return;const P=ringPts(b.z,E),g0=b.g!=null?b.g-E.gmin:0,h=b.h,n=P.length;out.push(`o gebaeude_${k+1}_${A.nf(h,1).replace(',','_')}m`);
    for(const p of P)out.push(`v ${f3(p[0])} ${f3(g0)} ${f3(-p[1])}`);for(const p of P)out.push(`v ${f3(p[0])} ${f3(g0+h)} ${f3(-p[1])}`);
    for(let i=0;i<n;i++){const j=(i+1)%n;out.push(`f ${v+i+1} ${v+j+1} ${v+n+j+1} ${v+n+i+1}`);}
    for(const t of triangulate(P))out.push(`f ${t.map(i=>v+n+i+1).join(' ')}`);v+=2*n;});
  return out.join('\n');
}
function geojson(E,opts){
  const ll=(x,y)=>{const q=A.map.unproject([x,y],20);return [+q.lng.toFixed(7),+q.lat.toFixed(7)];},rg=z=>{const r=[];for(let i=0;i<z.length;i+=2)r.push(ll(z[i],z[i+1]));return r;};
  const F=[];
  if(opts.bld)E.blds.forEach(b=>F.push({type:'Feature',properties:{art:'gebaeude',hoehe_m:b.h!=null?+b.h.toFixed(2):null,maaiveld_nap_m:b.g!=null?+b.g.toFixed(2):null,quelle:'3D BAG'},geometry:{type:'Polygon',coordinates:[rg(b.z)]}}));
  if(opts.surf)E.surfs.forEach(s=>F.push({type:'Feature',properties:{art:'flaeche',bgt_objekt:s.o.k,funktion:s.o.f||null,material:s.o.m||null,albedo:s.o.a,quelle:'BGT'},geometry:{type:'Polygon',coordinates:[rg(s.z)]}}));
  if(opts.trees)E.trees.forEach(t=>F.push({type:'Feature',properties:{art:'baum',gattung:A.GENERA[t[6]]||null,pflanzjahr:t[7]||null,krone_radius_m_geschaetzt:+t[2].toFixed(1),hoehe_m:+t[3].toFixed(1),hoehe_gemessen_ahn:!!t[8],quelle:'Bomenkaart Gemeente Utrecht'},geometry:{type:'Point',coordinates:[+t[1].toFixed(7),+t[0].toFixed(7)]}}));
  return JSON.stringify({type:'FeatureCollection',metadata:{erzeugt:new Date().toISOString(),werkzeug:'Inspector Nice · Straßenlabor',quellen:header(E,'GeoJSON').slice(3)},features:F});
}
function svg(E,opts){
  const pad=40,Wm=Math.max(1,E.w),Hm=Math.max(1,E.h),W=1190,scl=(W-2*pad)/Wm,H=Math.round(Hm*scl+2*pad+70);
  const P=(x,y)=>{const p=E.loc(x,y);return [(pad+p[0]*scl).toFixed(1),(pad+(Hm-p[1])*scl).toFixed(1)];};
  const path=z=>{let s='';for(let i=0;i<z.length-2;i+=2){const [x,y]=P(z[i],z[i+1]);s+=(i?'L':'M')+x+' '+y;}return s+'Z';};
  const col=o=>{const t=LAB.street?LAB.street.typeOf(o):'';return (LAB.street&&LAB.street.TY[t]?LAB.street.TY[t].col:(o.c===2?'#7a8c3a':o.c===3?'#5c88b2':'#cfc6b6'));};
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Archivo, Helvetica, Arial, sans-serif"><!-- ${header(E,'SVG').join(' | ')} --><rect width="${W}" height="${H}" fill="#f1ede5"/>`;
  s+=`<defs><clipPath id="fr"><rect x="${pad}" y="${pad}" width="${(Wm*scl).toFixed(1)}" height="${(Hm*scl).toFixed(1)}"/></clipPath></defs><g clip-path="url(#fr)">`;
  if(opts.surf)s+=`<g id="flaechen">${E.surfs.map(x=>`<path d="${path(x.z)}" fill="${col(x.o)}"/>`).join('')}</g>`;
  if(opts.shadow){const sun=A.sunNow();if(sun.alt>0.02){const dx=Math.sin(sun.az),dy=Math.cos(sun.az),t=Math.tan(sun.alt),m=A.m20();let g='';
    for(const b of E.blds){if(!(b.h>=1))continue;const L=Math.min(600,b.h/t)/m,ox=dx*L,oy=-dy*L,z=b.z;for(let i=0;i<z.length-2;i+=2){const a=[z[i],z[i+1]],c=[z[i+2],z[i+3]];g+=`<path d="M${P(...a).join(' ')}L${P(...c).join(' ')}L${P(c[0]+ox,c[1]+oy).join(' ')}L${P(a[0]+ox,a[1]+oy).join(' ')}Z"/>`;}
      let tz='';for(let i=0;i<z.length-2;i+=2)tz+=(i?'L':'M')+P(z[i]+ox,z[i+1]+oy).join(' ');g+=`<path d="${tz}Z"/>`;}
    s+=`<g id="schatten" fill="#18162c" opacity=".32">${g}</g>`;}}
  if(opts.bld)s+=`<g id="gebaeude" fill="#fbf9f4" stroke="#17151c" stroke-width=".8">${E.blds.map(b=>`<path d="${path(b.z)}"><title>${b.h!=null?A.nf(b.h,1)+' m':''}</title></path>`).join('')}</g>`;
  if(opts.trees)s+=`<g id="baeume" fill="#4f7a3a" fill-opacity=".45" stroke="#2f4f22" stroke-width=".6">${E.trees.map(t=>{const [x,y]=P(t[4],t[5]);return `<circle cx="${x}" cy="${y}" r="${(t[2]*scl).toFixed(1)}"/>`;}).join('')}</g>`;
  s+=`</g><rect x="${pad}" y="${pad}" width="${(Wm*scl).toFixed(1)}" height="${(Hm*scl).toFixed(1)}" fill="none" stroke="#17151c" stroke-width="1.5"/>`;
  const sb=[10,20,50,100,200,500].find(v=>v*scl>90)||500,yb=H-38;
  s+=`<g transform="translate(${pad},${yb})"><rect width="${(sb*scl).toFixed(1)}" height="6" fill="#17151c"/><text y="22" font-size="13" fill="#17151c">${sb} m</text></g>`;
  s+=`<g transform="translate(${W-pad-18},${yb-6})"><path d="M0 -14 7 10 0 5 -7 10Z" fill="#17151c"/><text y="24" font-size="13" text-anchor="middle" fill="#17151c">N</text></g>`;
  s+=`<text x="${pad+sb*scl+24}" y="${yb+8}" font-size="12" fill="#46424f">Inspector Nice · ${T('Straßenlabor','Street lab','Straatlab')} · RD ${E.ox} / ${E.oy} · 3D BAG (CC BY 4.0) · BGT · Bomenkaart Utrecht${opts.shadow?' · '+T('Schatten','shadows','schaduw')+' '+A.hhmm(LAB.min):''}</text>`;
  return s+'</svg>';
}
function download(name,text,type){const b=new Blob([text],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);return b.size;}
const EXP={bld:true,surf:true,trees:true,shadow:false,last:null};
LAB.addTool({id:'export',order:7,usesSurfaces:true,
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>',
  label:()=>'Export',
  sub:()=>T('CAD- und GIS-Dateien in RD-Metern','CAD and GIS files in RD metres','CAD- en GIS-bestanden in RD-meters'),
  render(){
    const r=AR.type==='draw'&&!AR.done?null:ring(),what=r&&AR.stats?T('die gewählte Fläche','the selected area','het gekozen gebied'):r&&AR.type!=='view'?T('die Fläche aus dem Werkzeug „Fläche"','the area from the “Area” tool','het gebied uit het gereedschap „Gebied"'):T('den Kartenausschnitt','the map view','het kaartbeeld');
    const ck=(k,l)=>`<label class="ex-ck"><input type="checkbox" data-o="${k}" ${EXP[k]?'checked':''}><span>${l}</span></label>`;
    return `<p class="lab-hint">${T('Exportiert','Exports','Exporteert')} ${what}. ${T('Koordinaten in Rijksdriehoek (EPSG:28992), Meter, mit lokalem Ursprung — direkt für AutoCAD, Rhino, Vectorworks, SketchUp, Blender, QGIS.','Coordinates in Rijksdriehoek (EPSG:28992), metres, with a local origin — ready for AutoCAD, Rhino, Vectorworks, SketchUp, Blender, QGIS.','Coördinaten in Rijksdriehoek (EPSG:28992), meters, met lokale oorsprong — direct voor AutoCAD, Rhino, Vectorworks, SketchUp, Blender, QGIS.')}</p>
      <div class="ex-cks">${ck('bld',T('Gebäude mit Höhen','Buildings with heights','Gebouwen met hoogtes'))}${ck('surf',T('Straßen- und Grünflächen','Street and green areas','Straat- en groenvlakken'))}${ck('trees',T('Bäume','Trees','Bomen'))}${ck('shadow',T('Schatten jetzt (nur SVG)','Shadows now (SVG only)','Schaduw nu (alleen SVG)'))}</div>
      <div class="ex-fmt">
        <button data-f="dxf"><b>DXF</b><span>${T('2D-Pläne + 3D-Gebäude (3DFACE)','2D plans + 3D buildings (3DFACE)','2D-plannen + 3D-gebouwen (3DFACE)')}</span></button>
        <button data-f="obj"><b>OBJ</b><span>${T('3D-Modell der Gebäude','3D model of the buildings','3D-model van de gebouwen')}</span></button>
        <button data-f="geojson"><b>GeoJSON</b><span>${T('alle Objekte mit Attributen','all objects with attributes','alle objecten met attributen')}</span></button>
        <button data-f="svg"><b>SVG</b><span>${T('Schwarzplan zum Gestalten','figure-ground plan for design','zwartplan om te vormgeven')}</span></button>
      </div>${EXP.last?`<p class="ex-last">${EXP.last}</p>`:''}`;
  },
  bind(root){
    root.querySelectorAll('[data-o]').forEach(el=>el.onchange=()=>{EXP[el.dataset.o]=el.checked;});
    root.querySelectorAll('[data-f]').forEach(el=>el.onclick=async()=>{
      el.disabled=true;await Promise.all([A.ensure('b'),A.ensure('s'),A.ensureTrees()]);
      const E=exportSet(),stamp=new Date().toISOString().slice(0,10),base=`inspector-nice_${Math.round(E.ox)}_${Math.round(E.oy)}_${stamp}`,f=el.dataset.f;
      const [txt,type]=f==='dxf'?[dxf(E,EXP),'application/dxf']:f==='obj'?[obj(E),'text/plain']:f==='geojson'?[geojson(E,EXP),'application/geo+json']:[svg(E,EXP),'image/svg+xml'];
      const n=download(`${base}.${f}`,txt,type);
      EXP.last=`${base}.${f} · ${(n/1024).toFixed(0)} KB · ${A.fmt(E.blds.length)} ${T('Gebäude','buildings','gebouwen')}, ${A.fmt(E.surfs.length)} ${T('Flächen','areas','vlakken')}, ${A.fmt(E.trees.length)} ${T('Bäume','trees','bomen')}`;A.rerender();});
  },
  async load(){await Promise.all([A.ensure('b'),A.ensure('s'),A.ensureTrees()]);},
  draw(g,X){const dark=A.dark();A.drawSurfaces(g,X);A.drawBuildings(g,X,dark?'rgba(60,56,66,.9)':'#fbf9f4',dark?'rgba(255,255,255,.2)':'rgba(23,21,28,.45)');A.drawCrowns(g,X,'rgba(72,140,84,.3)','rgba(31,90,43,.4)');outline(g,X,dark);},
  note:()=>T('Gebäude: Grundriss mit gemessener Höhe (3D BAG, LoD 1.2: 70-%-Dachhöhe) als Polylinie mit Objekthöhe und als 3D-Flächen; Flächen aus der BGT nach Nutzung auf Ebenen verteilt und am Rahmen zugeschnitten; Bäume als Kreise mit geschätzter Krone. Höhen relativ zum niedrigsten Gelände im Gebiet; Ursprung und Quellen stehen im Dateikopf.','Buildings: footprint with measured height (3D BAG, LoD 1.2: 70 % roof height) as polyline with thickness and as 3D faces; BGT areas split into layers by use and clipped to the frame; trees as circles with estimated crowns. Heights relative to the lowest ground in the area; origin and sources are in the file header.','Gebouwen: contour met gemeten hoogte (3D BAG, LoD 1.2: 70%-dakhoogte) als polylijn met dikte en als 3D-vlakken; BGT-vlakken per gebruik op lagen en op het kader bijgesneden; bomen als cirkels met geschatte kroon. Hoogtes t.o.v. het laagste maaiveld in het gebied; oorsprong en bronnen staan in de bestandskop.'),
  src:()=>`3D BAG (TU Delft / 3DGI, CC BY 4.0) · BGT (Kadaster / PDOK) · ${T('Baumregister Gemeente Utrecht','Tree register, Gemeente Utrecht','Bomenregister gemeente Utrecht')}`
});
LAB.area={AR,ring,compute,exportSet,dxf,obj,geojson,svg,clip,triangulate};
})();

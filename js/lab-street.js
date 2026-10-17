// ══════════════════════════════════════════════════════════════
// Straßenlabor · Werkzeug „Straße" — echter Querschnitt Fassade zu Fassade
// (wie Streetmix, aber aus amtlichen Daten): BGT-Flächen mit Funktion
// (Fahrbahn, Radweg, Gehweg, Parken …), gemessene Fassadenhöhen (3D BAG),
// Bäume aus dem Register. Schatten im Schnitt, Umbau mit Vorher/Nachher.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n);
const TY={
  car:    {de:'Fahrbahn',en:'Carriageway',nl:'Rijbaan',col:'#5b5865',sealed:1,alb:.08,F:1},
  bike:   {de:'Radweg',en:'Cycle path',nl:'Fietspad',col:'#c0614f',sealed:1,alb:.12,F:1},
  walk:   {de:'Gehweg',en:'Footpath',nl:'Voetpad',col:'#d9cfbd',sealed:1,alb:.30,F:1},
  park:   {de:'Parken',en:'Parking',nl:'Parkeren',col:'#8f8b97',sealed:1,alb:.25,F:1},
  shared: {de:'Mischfläche',en:'Shared street',nl:'Woonerf',col:'#c8b89c',sealed:1,alb:.20,F:1},
  transit:{de:'Bus/Tram',en:'Transit lane',nl:'OV-baan',col:'#8a5a7c',sealed:1,alb:.08,F:1},
  island: {de:'Insel',en:'Island',nl:'Verkeerseiland',col:'#b3ab9c',sealed:1,alb:.20,F:1},
  verge:  {de:'Bankett',en:'Verge',nl:'Berm',col:'#a7b07f',sealed:.5,alb:.22,F:.7},
  green:  {de:'Grün',en:'Green',nl:'Groen',col:'#7a8c3a',sealed:0,alb:.23,F:.45},
  trees:  {de:'Baumstreifen',en:'Tree strip',nl:'Bomenstrook',col:'#4f6b2b',sealed:0,alb:.20,F:.45},
  water:  {de:'Wasser',en:'Water',nl:'Water',col:'#5c88b2',sealed:0,alb:.07,F:.15},
  yard:   {de:'Hof/Vorgarten',en:'Yard',nl:'Erf',col:'#cfc4ad',sealed:.7,alb:.20,F:.9},
  paved:  {de:'befestigt',en:'Paved',nl:'Verhard',col:'#bdb4a4',sealed:1,alb:.24,F:1},
  rail:   {de:'Gleis',en:'Rail',nl:'Spoor',col:'#6d6470',sealed:.6,alb:.15,F:1},
  none:   {de:'unbekannt',en:'unknown',nl:'onbekend',col:'#e4ded2',sealed:.5,alb:.15,F:1}
};
const EDITABLE=['walk','bike','car','park','transit','shared','green','trees'];
const tn=k=>{const t=TY[k]||TY.none;return A.lang()==='en'?t.en:A.lang()==='nl'?t.nl:t.de;};
const PRIO={wegdeel:5,ondersteunendwegdeel:4,waterdeel:3,begroeidterreindeel:2,onbegroeidterreindeel:1};
function typeOf(o){
  if(o.k==='waterdeel')return 'water';
  if(o.k==='begroeidterreindeel'||o.c===A.CLASS.green)return o.k==='ondersteunendwegdeel'?'verge':'green';
  if(o.k==='ondersteunendwegdeel')return o.f==='verkeerseiland'?'island':'verge';
  if(o.k==='onbegroeidterreindeel')return o.fy==='erf'?'yard':'paved';
  const f=o.f||'';
  if(/fietspad/.test(f))return 'bike';if(/voetpad|voetganger/.test(f))return 'walk';if(/parkeervlak/.test(f))return 'park';
  if(/woonerf/.test(f))return 'shared';if(/OV-baan/.test(f))return 'transit';if(/spoorbaan/.test(f))return 'rail';
  if(/rijbaan/.test(f))return 'car';return 'paved';
}
let SEC=null,EDIT=null,PICK=-1,busy=false;

// ── Querschnitt berechnen ──
async function section(ll){
  if(A.tooFar())return {err:T('Für den Querschnitt näher heranzoomen (ab Zoom 16).','Zoom in further for the cross-section (level 16+).','Zoom verder in voor het dwarsprofiel (vanaf niveau 16).')};
  await Promise.all([A.ensure('b'),A.ensure('s'),A.ensureTrees().then(A.measureTrees)]);
  if(!A.B.list.length&&!A.S.list.length)return {err:T('Hier sind gerade keine Gebäude- und Flächendaten geladen — kurz warten und erneut tippen.','No building or surface data loaded here yet — wait a moment and tap again.','Hier zijn nog geen gebouw- en vlakdata geladen — even wachten en opnieuw tikken.')};
  const m=A.m20(),[px,py]=A.w20(ll.lat,ll.lng);
  if(A.hits(A.B,px,py).length)return {err:T('Das ist ein Gebäude — bitte auf eine Straße tippen.','That is a building — please tap a street.','Dat is een gebouw — tik op een straat.')};
  const at=(ux,uy,d)=>[px+ux*d/m,py+uy*d/m];
  const bld=(x,y)=>A.hits(A.B,x,y)[0];
  const reach=(ang,sg,cap,fine)=>{const ux=Math.cos(ang)*sg,uy=Math.sin(ang)*sg;for(let d=.5;d<=cap;d+=.5){const [x,y]=at(ux,uy,d);if(bld(x,y)){
      if(!fine)return d;let lo=d-.5,hi=d;while(hi-lo>.02){const mid=(lo+hi)/2,[mx,my]=at(ux,uy,mid);if(bld(mx,my))hi=mid;else lo=mid;}return lo;}}return cap;};   // Fassade auf 2 cm genau
  let best=null;
  for(let a=0;a<180;a+=5){const r=a*A.SR,w=reach(r,1,45)+reach(r,-1,45);if(!best||w<best.w)best={a:r,w};}
  // Feinsuche ±4° in 1°-Schritten
  for(let a=best.a/A.SR-4;a<=best.a/A.SR+4;a+=1){const r=a*A.SR,w=reach(r,1,45)+reach(r,-1,45);if(w<best.w)best={a:r,w};}
  let ux=Math.cos(best.a),uy=Math.sin(best.a);if(ux<-.2||(Math.abs(ux)<=.2&&uy>0)){ux=-ux;uy=-uy;}   // links = West bzw. Nord
  const L1=reach(Math.atan2(uy,ux),-1,45,true),L2=reach(Math.atan2(uy,ux),1,45,true),STEP=.1,STUB=3;
  const cls=[];
  for(let d=-L1+STEP/2;d<L2;d+=STEP){const [x,y]=at(ux,uy,d);
    const os=A.hits(A.S,x,y).sort((p,q)=>(PRIO[q.k]||0)-(PRIO[p.k]||0)),o=os[0];cls.push(o?{t:typeOf(o),o}:{t:'none',o:null});}
  let segs=[];for(const c of cls){const s=segs[segs.length-1];if(s&&s.t===c.t&&s.o===c.o)s.n++;else segs.push({t:c.t,o:c.o,n:1});}
  segs.forEach(s=>s.w=s.n*STEP);if(segs.length){const k=(L1+L2)/segs.reduce((p,s)=>p+s.w,0);segs.forEach(s=>s.w*=k);}   // Summe = Fassadenabstand
  for(let pass=0;pass<3;pass++){                                             // Splitter (< 0,6 m) an den breiteren Nachbarn
    for(let i=0;i<segs.length;i++){const s=segs[i];if(s.w>=.6||segs.length<2)continue;const l=segs[i-1],r=segs[i+1],tgt=!l?r:!r?l:(l.w>=r.w?l:r);tgt.w+=s.w;segs.splice(i,1);i--;}
    const out=[];for(const s of segs){const p=out[out.length-1];if(p&&p.t===s.t){p.w+=s.w;if(!p.o&&s.o)p.o=s.o;}else out.push({...s});}segs=out;}
  let x=-L1;segs.forEach(s=>{s.x0=x;x+=s.w;s.x1=x;s.a=s.o?s.o.a:TY[s.t].alb;s.F=s.o?[1,.8,.45,.15][s.o.c]:TY[s.t].F;});
  const lb=L1<45?bld(...at(ux,uy,-L1-.1)):null,rb=L2<45?bld(...at(ux,uy,L2+.1)):null;
  const trees=A.treesIn(.15).map(t=>{const dx=(t[4]-px)*m,dy=(t[5]-py)*m,s=dx*ux+dy*uy,d=Math.abs(dx*uy-dy*ux);return {s,d,r:t[2],H:t[3],g:A.GENERA[t[6]]||'',m:!!t[8]};}).filter(t=>t.d<=5&&t.s>=-L1&&t.s<=L2);
  const P=(d)=>{const [x2,y2]=at(ux,uy,d);const q=A.map.unproject([x2,y2],20);return [q.lat,q.lng];};
  const sec={ll,ux,uy,L1,L2,STUB,segs,trees,hl:lb&&lb.h,hr:rb&&rb.h,open:[L1>=45,L2>=45],ends:[P(-L1),P(L2)],name:null,px,py};
  sec.name=await streetName(ll,ux,uy).catch(()=>null);
  return sec;
}
// Straßenname: amtliches Wegenetz (NWB) — die Mittellinie, die dem Punkt am nächsten liegt und quer zur Schnittlinie verläuft;
// Rückfall: nächstes Namensschild der BGT (kann zur Nachbarstraße gehören)
async function streetName(ll,ux,uy){
  try{const d=.0005,[px,py]=A.toRD(ll.lat,ll.lng);
    const j=await fetch(`https://api.pdok.nl/rws/nationaal-wegenbestand-wegen/ogc/v1/collections/wegvakken/items?bbox=${ll.lng-d*1.6},${ll.lat-d},${ll.lng+d*1.6},${ll.lat+d}&limit=200&f=json`).then(r=>{if(!r.ok)throw 0;return r.json();});
    let best=null,bs=Infinity;const sx=ux!=null?ux:0,sy=uy!=null?-uy:0;   // Schnittrichtung in RD (Nord oben)
    for(const f of j.features||[]){const n=f.properties&&f.properties.stt_naam;if(!n||!f.geometry)continue;
      const ls=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
      for(const l of ls)for(let i=1;i<l.length;i++){const a=A.toRD(l[i-1][1],l[i-1][0]),b=A.toRD(l[i][1],l[i][0]),dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;if(!L2)continue;
        const t=Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/L2)),dist=Math.hypot(a[0]+t*dx-px,a[1]+t*dy-py),par=ux!=null?Math.abs((dx*sx+dy*sy)/Math.sqrt(L2)):0;
        const sc=dist+18*par;if(sc<bs&&dist<45){bs=sc;best=n;}}}   // parallel zur Schnittlinie = Querstraße → Strafpunkte
    if(best)return best;}catch(e){}
  const d=.0006,best={d:1e9,n:null};
  await A.bgtItems('openbareruimtelabel',ll.lng-d,ll.lat-d,ll.lng+d,ll.lat+d,f=>{const c=f.geometry&&f.geometry.coordinates,p=f.properties;if(!c||!p.openbareruimtenaam)return;
    const dd=(c[1]-ll.lat)**2+((c[0]-ll.lng)*.62)**2;if(dd<best.d){best.d=dd;best.n=p.openbareruimtenaam;}});
  return best.n;
}

// ── Kennzahlen (vorher / nachher) ──
function metrics(types){
  const segs=SEC.segs,W=segs.reduce((p,s)=>p+s.w,0)||1;let sealed=0,green=0,heat=0;
  segs.forEach((s,i)=>{const t=types?types[i]:s.t,ty=TY[t]||TY.none,ed=types&&t!==s.t;
    const a=ed?ty.alb:s.a,F=ed?ty.F:s.F;sealed+=s.w*(ed?ty.sealed:(TY[s.t]||TY.none).sealed);if(t==='green'||t==='trees'||t==='verge')green+=s.w*(t==='verge'?.6:1);heat+=s.w*(1-a)*F;});
  // Kronendach: vorhandene Kronen + neue Baumstreifen (Krone 7 m)
  const iv=SEC.trees.map(t=>[t.s-t.r,t.s+t.r]);
  if(types)segs.forEach((s,i)=>{if(types[i]==='trees'&&s.t!=='trees'){const c=(s.x0+s.x1)/2;iv.push([c-3.5,c+3.5]);}});
  iv.sort((p,q)=>p[0]-q[0]);let cov=0,cur=null;for(const [a,b] of iv.map(([a,b])=>[Math.max(a,-SEC.L1),Math.min(b,SEC.L2)]).filter(([a,b])=>b>a)){if(!cur||a>cur[1]){if(cur)cov+=cur[1]-cur[0];cur=[a,b];}else cur[1]=Math.max(cur[1],b);}if(cur)cov+=cur[1]-cur[0];
  const newTrees=types?segs.reduce((n,s,i)=>n+(types[i]==='trees'&&s.t!=='trees'?Math.round(100/8):0),0):0;
  const pc=v=>Math.max(0,Math.min(100,100*v/W));
  return {W,sealed:pc(sealed),green:pc(green),heat:Math.round(100*Math.min(1,heat/W/.92)),canopy:pc(cov),newTrees};
}
// Schatten im Schnitt zur gewählten Zeit (lange, gerade Straße: nur die Querkomponente der Sonne zählt)
function shadeNow(){
  const s=A.sunAt(SEC.ll);if(s.alt<=0)return {night:true};
  const b=s.az+Math.PI,c=Math.sin(b)*SEC.ux+Math.cos(b)*(-SEC.uy),t=Math.tan(s.alt),out={s,c,parts:[]};
  if(c<-.02&&SEC.hl)out.parts.push({side:'l',a:-SEC.L1,b:Math.min(SEC.L2,-SEC.L1+SEC.hl*(-c)/t),H:SEC.hl});
  if(c>.02&&SEC.hr)out.parts.push({side:'r',a:Math.max(-SEC.L1,SEC.L2-SEC.hr*c/t),b:SEC.L2,H:SEC.hr});
  out.shaded=out.parts.reduce((v,p)=>v+(p.b-p.a),0);return out;
}
function sunAlong(){                                           // echte Sonnenstunden aus dem 2D-Schattenmodell entlang der Schnittlinie
  const sh=A.SUNH;if(!sh||!sh.hrs)return null;const m=A.m20(),vals=[];
  for(let d=-SEC.L1;d<=SEC.L2;d+=.5){const x=SEC.px+SEC.ux*d/m,y=SEC.py+SEC.uy*d/m,v=A.sunHoursAt(x,y);if(!v)return null;vals.push(v.h);}
  return {vals,max:sh.maxH};
}

// ── Darstellung des Profils (SVG, maßstäblich: gleiche Skala waagerecht und senkrecht) ──
function profile(){
  const S=SEC,W=344,span=S.L1+S.L2+2*S.STUB,hmax=Math.max(6,S.hl||0,S.hr||0,...S.trees.map(t=>t.H+t.r*.3));
  const H=Math.round(Math.min(380,Math.max(228,hmax*(W-16)/span+76))),yg=H-50;           // schmale, hohe Straßenschluchten dürfen höher werden
  const sc=Math.min((W-16)/span,(yg-26)/hmax),ox=(W-span*sc)/2,X=m=>ox+(m+S.L1+S.STUB)*sc,Y=h=>yg-h*sc;
  const ink='var(--ink)',types=EDIT||S.segs.map(s=>s.t),sh=shadeNow();let g='';
  g+=`<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="var(--line2)" stroke-width="1.4"/></pattern></defs>`;
  // Schatten jetzt
  if(sh.night)g+=`<rect x="${X(-S.L1)}" y="${Y(hmax)}" width="${(S.L1+S.L2)*sc}" height="${hmax*sc}" fill="rgba(24,22,44,.08)"/>`;
  else for(const p of sh.parts){const top=p.side==='l'?[X(-S.L1),Y(p.H)]:[X(S.L2),Y(p.H)],end=p.side==='l'?X(p.b):X(p.a);
    g+=`<path d="M${top[0]} ${top[1]}L${end} ${yg}L${p.side==='l'?X(-S.L1):X(S.L2)} ${yg}Z" fill="rgba(24,22,44,.16)"/><line x1="${top[0]}" y1="${top[1]}" x2="${end}" y2="${yg}" stroke="#e9a23b" stroke-width="1.4" stroke-dasharray="3 3"/>`;}
  // Gebäude
  const bldg=(x0,x1,h,lbl)=>h?`<rect x="${x0}" y="${Y(h)}" width="${x1-x0}" height="${h*sc}" fill="url(#hatch)" stroke="${ink}" stroke-width="1.2"/><rect x="${x0}" y="${Y(h)}" width="${x1-x0}" height="${h*sc}" fill="var(--card)" opacity=".55"/><text x="${(x0+x1)/2}" y="${Y(h)-5}" text-anchor="middle" class="sx-h">${lbl}</text>`:'';
  g+=bldg(X(-S.L1-S.STUB),X(-S.L1),S.hl,S.hl?A.nf(S.hl,1)+' m':'');g+=bldg(X(S.L2),X(S.L2+S.STUB),S.hr,S.hr?A.nf(S.hr,1)+' m':'');
  // Flächen
  S.segs.forEach((s,i)=>{const t=types[i],c=(TY[t]||TY.none).col,x0=X(s.x0),w=Math.max(.5,s.w*sc);
    g+=`<rect x="${x0}" y="${yg}" width="${w}" height="9" fill="${c}"${t!==s.t?' stroke="#FFD600" stroke-width="2"':''}/>`;
    g+=picto(t,(s.x0+s.x1)/2,s.w,X,Y,sc);
    if(s.w*sc>30)g+=`<text x="${x0+w/2}" y="${yg+22}" text-anchor="middle" class="sx-w">${A.nf(s.w,1)}</text>`;
    g+=`<rect class="sx-hit${PICK===i?' on':''}" data-i="${i}" x="${x0}" y="${Y(Math.min(hmax,4))}" width="${w}" height="${yg+24-Y(Math.min(hmax,4))}"><title>${tn(t)} · ${A.nf(s.w,1)} m</title></rect>`;});
  // Bäume (Register) + neue Baumstreifen
  const tree=(s,r,Hh,col,op)=>`<line x1="${X(s)}" y1="${yg}" x2="${X(s)}" y2="${Y(Hh*.55)}" stroke="#6b5a3e" stroke-width="${Math.max(1.2,.35*sc)}"/><circle cx="${X(s)}" cy="${Y(Hh*.65)}" r="${Math.max(3,r*sc)}" fill="${col}" fill-opacity="${op}" stroke="#3f5a25" stroke-opacity=".5"/>`;
  S.trees.forEach(t=>g+=tree(t.s,t.r,t.H,'#6f9a4c',.55));
  S.segs.forEach((s,i)=>{if(types[i]==='trees'&&s.t!=='trees')g+=tree((s.x0+s.x1)/2,3.5,9,'#9cc46a',.6);});
  // Sonnenstunden entlang des Schnitts
  const sa=sunAlong();
  if(sa){const cw=.5*sc;sa.vals.forEach((v,k)=>{const col=A.ramp([[0,[44,38,92]],[0.25,[108,70,150]],[0.5,[206,96,74]],[0.75,[236,168,58]],[1,[255,236,150]]],v/Math.max(1,sa.max));g+=`<rect x="${X(-S.L1+k*.5)}" y="${yg+27}" width="${cw+.3}" height="7" fill="rgb(${col.join(',')})"/>`;});}
  // Boden, Maßlinie, Himmelsrichtungen
  g+=`<line x1="${X(-S.L1-S.STUB)}" y1="${yg}" x2="${X(S.L2+S.STUB)}" y2="${yg}" stroke="${ink}" stroke-width="1.5"/>`;
  const dir=(ux,uy)=>A.dirName((Math.atan2(ux,-uy)/A.SR+360)%360);
  g+=`<text x="${X(-S.L1-S.STUB)}" y="${yg+44}" class="sx-c">${dir(-S.ux,-S.uy)}</text><text x="${X(S.L2+S.STUB)}" y="${yg+44}" text-anchor="end" class="sx-c">${dir(S.ux,S.uy)}</text>`;
  g+=`<text x="${(X(-S.L1)+X(S.L2))/2}" y="${yg+44}" text-anchor="middle" class="sx-tot">${S.open[0]||S.open[1]?T('ab Schnitt','from cut','vanaf snede')+' ':''}${A.nf(S.L1+S.L2,1)} m ${S.open[0]||S.open[1]?'':T('Fassade–Fassade','façade to façade','gevel tot gevel')}</text>`;
  return `<svg class="sx" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${T('Straßenquerschnitt','Street cross-section','Straatprofiel')}">${g}</svg>`;
}
function picto(t,c,w,X,Y,sc){
  const ink='var(--ink)',op='.62';let s='';
  const car=x=>`<path d="M${X(x-.9)} ${Y(.35)}v${-.55*sc}q0 ${-.5*sc} ${.4*sc} ${-.55*sc}h${1*sc}q${.4*sc} 0 ${.4*sc} ${.55*sc}v${.55*sc}z" fill="none" stroke="${ink}" stroke-opacity="${op}" stroke-width="1.1"/><line x1="${X(x-.95)}" y1="${Y(.35)}" x2="${X(x+.95)}" y2="${Y(.35)}" stroke="${ink}" stroke-opacity="${op}"/><circle cx="${X(x-.6)}" cy="${Y(.3)}" r="${Math.max(1,.3*sc)}" fill="${ink}" fill-opacity="${op}"/><circle cx="${X(x+.6)}" cy="${Y(.3)}" r="${Math.max(1,.3*sc)}" fill="${ink}" fill-opacity="${op}"/>`;
  const person=x=>`<circle cx="${X(x)}" cy="${Y(1.62)}" r="${Math.max(1.4,.13*sc)}" fill="${ink}" fill-opacity="${op}"/><line x1="${X(x)}" y1="${Y(1.45)}" x2="${X(x)}" y2="${Y(.85)}" stroke="${ink}" stroke-opacity="${op}" stroke-width="${Math.max(1.2,.18*sc)}" stroke-linecap="round"/><path d="M${X(x-.18)} ${Y(0)}L${X(x)} ${Y(.85)}L${X(x+.18)} ${Y(0)}" fill="none" stroke="${ink}" stroke-opacity="${op}" stroke-width="1.2"/>`;
  if(sc<5)return '';
  if(t==='car'||t==='transit'){const n=Math.max(1,Math.floor(w/3.1));for(let k=0;k<n;k++)s+=car(c-w/2+(k+.5)*w/n);}
  else if(t==='park'&&w>=1.9)s+=car(c);
  else if(t==='bike'&&w>=.9)s+=`<circle cx="${X(c)}" cy="${Y(.36)}" r="${Math.max(1.6,.34*sc)}" fill="none" stroke="${ink}" stroke-opacity="${op}"/><circle cx="${X(c)}" cy="${Y(1.85)}" r="${Math.max(1.4,.13*sc)}" fill="${ink}" fill-opacity="${op}"/><line x1="${X(c)}" y1="${Y(1.7)}" x2="${X(c)}" y2="${Y(.72)}" stroke="${ink}" stroke-opacity="${op}" stroke-width="${Math.max(1.2,.18*sc)}" stroke-linecap="round"/>`;
  else if((t==='walk'||t==='shared'||t==='paved')&&w>=.8)s+=person(c);
  return s;
}
function canyon(hw){return hw==null?'':hw<.5?T('offener Straßenraum','open street space','open straatruimte'):hw<1?T('mittlere Straßenschlucht','moderate street canyon','matige straatkloof'):T('tiefe Straßenschlucht: viel Schatten am Tag, Wärmestau in der Nacht','deep street canyon: lots of shade by day, trapped heat at night','diepe straatkloof: veel schaduw overdag, warmte blijft hangen in de nacht');}

// ── Werkzeug ──
LAB.addTool({id:'street',order:3,grp:'make',
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 20V9l4-2v13M21 20V9l-4-2v13M3 20h18"/><path d="M12 12v2M12 16.5v2" stroke-width="1.6"/></svg>',
  label:()=>T('Straße','Street','Straat'),
  sub:()=>T('Querschnitt Fassade zu Fassade','Cross-section façade to façade','Dwarsprofiel gevel tot gevel'),
  usesSurfaces:true,
  enter(){if(LAB.mode!=='shadow'&&LAB.mode!=='sunhours')LAB.mode='shadow';},
  leave(){PICK=-1;},
  async load(){await Promise.all([A.ensure('b'),A.ensure('s'),A.ensureTrees()]);},
  render(){
    if(busy)return `<p class="lab-hint"><span class="lab-spin" aria-hidden="true"></span> ${T('Querschnitt wird aus BGT und 3D BAG geschnitten …','Cutting the cross-section from BGT and 3D BAG …','Dwarsprofiel wordt uit BGT en 3D BAG gesneden …')}</p>`;
    if(!SEC)return `<div class="sx-empty"><svg viewBox="0 0 120 54" width="120" height="54" aria-hidden="true"><rect x="2" y="10" width="16" height="34" fill="var(--soft2)" stroke="var(--ink)"/><rect x="102" y="4" width="16" height="40" fill="var(--soft2)" stroke="var(--ink)"/><rect x="18" y="44" width="10" height="5" fill="#d9cfbd"/><rect x="28" y="44" width="8" height="5" fill="#c0614f"/><rect x="36" y="44" width="48" height="5" fill="#5b5865"/><rect x="84" y="44" width="8" height="5" fill="#7a8c3a"/><rect x="92" y="44" width="10" height="5" fill="#d9cfbd"/><circle cx="88" cy="26" r="7" fill="#6f9a4c" fill-opacity=".6"/></svg><p>${T('Tippe auf eine Straße. Das Labor schneidet sie quer — Fassade zu Fassade, mit echten Breiten aus der BGT und gemessenen Höhen aus 3D BAG.','Tap a street. The lab cuts across it — façade to façade, with real widths from the BGT and measured heights from 3D BAG.','Tik op een straat. Het lab snijdt haar dwars door — gevel tot gevel, met echte breedtes uit de BGT en gemeten hoogtes uit 3D BAG.')}</p></div>`;
    if(SEC.err)return `<p class="lab-hint">${SEC.err}</p>`;
    const S=SEC,mb=metrics(null),ma=EDIT?metrics(EDIT):null,hw=S.hl&&S.hr&&!S.open[0]&&!S.open[1]?((S.hl+S.hr)/2)/(S.L1+S.L2):null,sh=shadeNow(),sa=sunAlong();
    const meanSun=sa?sa.vals.reduce((p,v)=>p+v,0)/sa.vals.length:null;
    const row=(k,b,a,u,better)=>`<tr><th>${k}</th><td>${b}${u}</td>${ma?`<td class="${a===b?'':(better(a,b)?'up':'down')}">${a}${u}</td>`:''}</tr>`;
    const R=v=>Math.round(v);
    return `<div class="sx-head"><b>${S.name||T('Straße ohne Namen','Unnamed street','Straat zonder naam')}</b><span>${hw!=null?`H/B ${A.nf(hw,2)} · ${canyon(hw)}`:T('eine Seite ohne Gebäude im Umkreis von 45 m','one side without buildings within 45 m','één kant zonder gebouwen binnen 45 m')}</span></div>
      ${profile()}
      <div class="sx-sun">${sh.night?T('Sonne unter dem Horizont','Sun below the horizon','Zon onder de horizon'):`${T('Schatten jetzt','Shade now','Schaduw nu')} <b>${R(100*sh.shaded/(S.L1+S.L2))} %</b> ${T('des Querschnitts','of the cross-section','van het profiel')} · ${A.hhmm(LAB.min)}`}${meanSun!=null?` · ${T('Ø Sonne','avg. sun','gem. zon')} <b>${A.nf(meanSun,1)} h</b>`:''}</div>
      ${A.dates()}${A.timeRow()}
      ${sa?'':`<button class="cta ghost lab-mini" id="sxSun">${A.IC.sun}${T('Sonnenstunden entlang des Schnitts berechnen','Compute sun hours along the cut','Zonuren langs de snede berekenen')}</button>`}
      <div class="sx-legend">${S.segs.map((s,i)=>{const t=(EDIT||[])[i]||s.t;return `<button class="sx-seg${PICK===i?' on':''}${EDIT&&t!==s.t?' ed':''}" data-i="${i}"><i style="background:${(TY[t]||TY.none).col}"></i><span>${tn(t)}</span><em>${A.nf(s.w,1)} m</em></button>`;}).join('')}</div>
      ${PICK>=0&&EDIT?`<div class="sx-pal" role="group" aria-label="${T('Neue Nutzung','New use','Nieuw gebruik')}">${EDITABLE.map(k=>`<button data-ty="${k}" class="${EDIT[PICK]===k?'on':''}"><i style="background:${TY[k].col}"></i>${tn(k)}</button>`).join('')}</div>`:''}
      <table class="sx-tab"><thead><tr><th></th><th>${T('heute','today','nu')}</th>${ma?`<th>${T('Umbau','redesign','herinrichting')}</th>`:''}</tr></thead><tbody>
        ${row(T('versiegelt','sealed','verhard'),R(mb.sealed),ma&&R(ma.sealed),' %',(a,b)=>a<b)}
        ${row(T('Grün','green','groen'),R(mb.green),ma&&R(ma.green),' %',(a,b)=>a>b)}
        ${row(T('Kronendach im Schnitt','canopy across the cut','kronendak in profiel'),R(mb.canopy),ma&&R(ma.canopy),' %',(a,b)=>a>b)}
        ${row(T('Aufheizung der Beläge','surface heating','opwarming verharding'),mb.heat,ma&&ma.heat,' / 100',(a,b)=>a<b)}
        ${ma&&ma.newTrees?`<tr><th>${T('neue Bäume je 100 m','new trees per 100 m','nieuwe bomen per 100 m')}</th><td>—</td><td class="up">+${ma.newTrees}</td></tr>`:''}
      </tbody></table>
      <div class="sx-act"><button class="cta ghost lab-mini" id="sxEdit">${EDIT?T('Umbau zurücksetzen','Reset redesign','Herinrichting terugzetten'):T('Umbauen — Flächen antippen und neu nutzen','Redesign — tap areas to change their use','Herinrichten — tik vlakken aan en geef ze een nieuw gebruik')}</button></div>
      ${LAB.measures?LAB.measures.html():''}`;
  },
  bind(root){
    A.bindTime(root,()=>{const sv=root.querySelector('.sx');if(sv&&SEC&&!SEC.err)sv.outerHTML=profile();bindHits(root);const su=root.querySelector('.sx-sun');if(su)su.outerHTML=sunLine();});
    const b=root.querySelector('#sxEdit');if(b)b.onclick=()=>{if(EDIT){EDIT=null;PICK=-1;}else{EDIT=SEC.segs.map(s=>s.t);PICK=SEC.segs.findIndex(s=>s.t==='park');if(PICK<0)PICK=SEC.segs.findIndex(s=>s.t==='car');}A.rerender();A.req();};
    const su=root.querySelector('#sxSun');if(su)su.onclick=async()=>{su.disabled=true;await A.computeSunHours();A.rerender();};
    root.querySelectorAll('.sx-seg').forEach(el=>el.onclick=()=>pick(+el.dataset.i));
    root.querySelectorAll('.sx-pal [data-ty]').forEach(el=>el.onclick=()=>{EDIT[PICK]=el.dataset.ty;A.rerender();A.req();});
    bindHits(root);
    if(LAB.measures)LAB.measures.bind(root);
  },
  draw(g,X){
    const dark=A.dark();
    A.drawBuildings(g,X,dark?'rgba(60,56,66,.55)':'rgba(251,249,244,.7)',dark?'rgba(255,255,255,.18)':'rgba(23,21,28,.3)');
    A.drawCrowns(g,X,'rgba(72,140,84,.22)',dark?'rgba(150,210,150,.35)':'rgba(31,90,43,.35)');
    if(!SEC||SEC.err)return;
    const m=A.m20(),pt=d=>[(SEC.px+SEC.ux*d/m)*X.k-X.ox,(SEC.py+SEC.uy*d/m)*X.k-X.oy],types=EDIT||SEC.segs.map(s=>s.t);
    g.lineCap='butt';
    SEC.segs.forEach((s,i)=>{const a=pt(s.x0),b=pt(s.x1);g.strokeStyle=(TY[types[i]]||TY.none).col;g.lineWidth=10*X.sc;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();});
    const a=pt(-SEC.L1),b=pt(SEC.L2),nx=-SEC.uy*7*X.sc,ny=SEC.ux*7*X.sc;
    g.strokeStyle=dark?'#f3efe7':'#17151c';g.lineWidth=1.6*X.sc;g.beginPath();
    for(const p of [a,b]){g.moveTo(p[0]-nx,p[1]-ny);g.lineTo(p[0]+nx,p[1]+ny);}g.stroke();
    if(PICK>=0){const s=SEC.segs[PICK],p=pt(s.x0),q=pt(s.x1);g.strokeStyle='#FFD600';g.lineWidth=4*X.sc;g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(q[0],q[1]);g.stroke();}
  },
  click(e){
    busy=true;EDIT=null;PICK=-1;A.rerender();
    return section(e.latlng).then(s=>{SEC=s;busy=false;A.rerender();A.req();if(LAB.measures&&!s.err)LAB.measures.context(s).then(()=>A.rerender());return null;}).catch(()=>{busy=false;SEC={err:T('Querschnitt nicht möglich — Daten fehlen hier.','Cross-section not possible — data missing here.','Dwarsprofiel niet mogelijk — data ontbreken hier.')};A.rerender();return null;});
  },
  moved(){if(SEC&&!SEC.err){const c=A.map.latLngToContainerPoint(SEC.ll),sz=A.map.getSize();if(c.x<-200||c.y<-200||c.x>sz.x+200||c.y>sz.y+200){SEC=null;EDIT=null;PICK=-1;A.rerender();}}},
  note:()=>T('Querschnitt entlang der kürzesten Linie von Fassade zu Fassade durch den angetippten Punkt. Flächen und ihre Nutzung aus der BGT (nur aktuell gültige Objekte), Fassadenhöhen gemessen (3D BAG, 70-%-Dachhöhe), Bäume aus dem Register (Größe aus dem Pflanzjahr geschätzt). „Schatten jetzt" nimmt eine lange, gerade Straße an. Sonnenstunden entlang des Schnitts kommen aus dem 2D-Schattenmodell mit allen Gebäuden und Bäumen ringsum. Umbau-Werte: Literatur-Albedo der neuen Beläge, neue Baumstreifen mit 7 m Krone und 8 m Abstand.','Cross-section along the shortest line from façade to façade through the tapped point. Areas and their use from the BGT (current objects only), façade heights measured (3D BAG, 70 % roof height), trees from the register (size estimated from planting year). "Shade now" assumes a long, straight street. Sun hours along the cut come from the 2D shadow model with all surrounding buildings and trees. Redesign values: literature albedo of new surfaces, new tree strips with 7 m crowns spaced 8 m apart.','Dwarsprofiel langs de kortste lijn van gevel tot gevel door het aangetikte punt. Vlakken en gebruik uit de BGT (alleen actuele objecten), gevelhoogtes gemeten (3D BAG, 70%-dakhoogte), bomen uit het register (grootte geschat uit plantjaar). "Schaduw nu" neemt een lange, rechte straat aan. Zonuren langs de snede komen uit het 2D-schaduwmodel met alle gebouwen en bomen eromheen. Herinrichting: literatuur-albedo van nieuwe verharding, nieuwe bomenstroken met 7 m kroon en 8 m afstand.'),
  src:()=>`BGT (Kadaster / PDOK) · 3D BAG (TU Delft / 3DGI, CC BY 4.0) · ${T('Baumregister Gemeente Utrecht','Tree register, Gemeente Utrecht','Bomenregister gemeente Utrecht')}`
});
function sunLine(){const S=SEC,sh=shadeNow(),sa=sunAlong(),meanSun=sa?sa.vals.reduce((p,v)=>p+v,0)/sa.vals.length:null;
  return `<div class="sx-sun">${sh.night?T('Sonne unter dem Horizont','Sun below the horizon','Zon onder de horizon'):`${T('Schatten jetzt','Shade now','Schaduw nu')} <b>${Math.round(100*sh.shaded/(S.L1+S.L2))} %</b> ${T('des Querschnitts','of the cross-section','van het profiel')} · ${A.hhmm(LAB.min)}`}${meanSun!=null?` · ${T('Ø Sonne','avg. sun','gem. zon')} <b>${A.nf(meanSun,1)} h</b>`:''}</div>`;}
function pick(i){if(!EDIT)EDIT=SEC.segs.map(s=>s.t);PICK=PICK===i?-1:i;A.rerender();A.req();}
function bindHits(root){root.querySelectorAll('.sx-hit').forEach(el=>el.onclick=()=>pick(+el.dataset.i));}
LAB.street={get SEC(){return SEC},set SEC(v){SEC=v},get EDIT(){return EDIT},set EDIT(v){EDIT=v;PICK=-1;},section,metrics,shadeNow,typeOf,TY,tn};
})();

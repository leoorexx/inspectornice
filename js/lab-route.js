// ══════════════════════════════════════════════════════════════
// Straßenlabor · Werkzeug „Kühle Route" — schattigster statt kürzester Fußweg.
// Wegenetz: Nationaal Wegenbestand (NWB, Rijkswaterstaat/PDOK), Fuß- und Radwege, Fahrbahnen mit Gehweg.
// Schatten je Straße: Gemeente Utrecht „Schaduw wegdelen" (Fuß- und Radwege, Stand 2023) als Mittel je Straßenname.
// Bänke unterwegs: Straatmeubilair der Gemeente. Kein Navi — ein Vergleich zweier Wege.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n);
const R={a:null,b:null,res:null,busy:false,err:null,job:0};
const WALK=new Set(['','RB','FP','VP','VZ']),UNKNOWN=.25,ALPHA=1.4,KMH=4.8;
let SHADE=null,BENCH=null;
const shadeLoad=()=>SHADE||(SHADE=fetch('data/official/streets_utr.json').then(r=>r.ok?r.json():null).then(j=>{const m=new Map();for(const s of (j&&j.streets)||[]){const k=s.n.toLowerCase(),o=m.get(k);if(!o||s.a>o.a)m.set(k,{sh:s.sh/100,a:s.a});}return m;}).catch(()=>new Map()));
const benchLoad=()=>BENCH||(BENCH=fetch('data/official/furniture_utr.json').then(r=>r.ok?r.json():null).then(j=>(j&&j.bank)||[]).catch(()=>[]));
const dist=(la1,lo1,la2,lo2)=>{const x=(lo2-lo1)*111320*Math.cos(la1*Math.PI/180),y=(la2-la1)*110574;return Math.hypot(x,y);};
async function nwb(bb){
  let url=`https://api.pdok.nl/rws/nationaal-wegenbestand-wegen/ogc/v1/collections/wegvakken/items?bbox=${bb.join(',')}&limit=1000&f=json`;const out=[];
  for(let k=0;k<12&&url;k++){const j=await fetch(url).then(r=>{if(!r.ok)throw 0;return r.json();});out.push(...(j.features||[]));const nx=(j.links||[]).find(l=>l.rel==='next');url=nx?nx.href:null;}
  return out;
}
function graph(feats,SH){
  const nodes=new Map(),edges=[];
  for(const f of feats){const p=f.properties||{},g=f.geometry;if(!g||!WALK.has(p.bst_code||''))continue;const a=p.jte_id_beg,b=p.jte_id_end;if(a==null||b==null)continue;
    const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
    for(const ln of lines){if(ln.length<2)continue;let len=0;for(let i=1;i<ln.length;i++)len+=dist(ln[i-1][1],ln[i-1][0],ln[i][1],ln[i][0]);if(len<.5)continue;
      const nm=(p.stt_naam||'').trim(),s=nm&&SH.get(nm.toLowerCase());
      const e={a,b,pts:ln.map(c=>[c[1],c[0]]),len,sh:s?s.sh:UNKNOWN,known:!!s,nm};edges.push(e);
      for(const [id,c] of [[a,ln[0]],[b,ln[ln.length-1]]]){if(!nodes.has(id))nodes.set(id,{lat:c[1],lon:c[0],e:[]});nodes.get(id).e.push(edges.length-1);}}}
  return {nodes,edges};
}
function nearest(G,ll){let best=null,bd=Infinity;for(const [id,n] of G.nodes){const d=dist(ll.lat,ll.lng,n.lat,n.lon);if(d<bd){bd=d;best=id;}}return bd<200?best:null;}
function dijkstra(G,s,t,cost){
  const D=new Map([[s,0]]),P=new Map(),done=new Set(),H=[[0,s]];
  const push=(d,v)=>{H.push([d,v]);let i=H.length-1;while(i>0){const q=(i-1)>>1;if(H[q][0]<=H[i][0])break;[H[q],H[i]]=[H[i],H[q]];i=q;}};
  const pop=()=>{const top=H[0],last=H.pop();if(H.length){H[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<H.length&&H[l][0]<H[m][0])m=l;if(r<H.length&&H[r][0]<H[m][0])m=r;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];i=m;}}return top;};
  while(H.length){const [d,v]=pop();if(done.has(v))continue;done.add(v);if(v===t)break;
    for(const ei of G.nodes.get(v).e){const e=G.edges[ei],w=e.a===v?e.b:e.a,nd=d+cost(e);if(nd<(D.has(w)?D.get(w):Infinity)){D.set(w,nd);P.set(w,[v,ei]);push(nd,w);}}}
  if(!D.has(t))return null;const path=[];let v=t;while(v!==s){const [u,ei]=P.get(v);path.push({ei,fwd:G.edges[ei].a===u});v=u;}path.reverse();
  const segs=path.map(({ei,fwd})=>{const e=G.edges[ei];return {...e,pts:fwd?e.pts:e.pts.slice().reverse()};});
  const len=segs.reduce((x,e)=>x+e.len,0),shm=segs.reduce((x,e)=>x+e.len*e.sh,0)/Math.max(1,len),unk=segs.filter(e=>!e.known).reduce((x,e)=>x+e.len,0)/Math.max(1,len);
  return {segs,len,sh:shm,unk};
}
async function compute(){
  const job=++R.job;R.res=null;R.err=null;R.busy=true;A.rerender();A.req();
  const a=R.a,b=R.b,d=dist(a.lat,a.lng,b.lat,b.lng);
  if(d>2600){R.busy=false;R.err=T('Bitte Start und Ziel näher zusammen wählen (höchstens etwa 2,5 km Luftlinie).','Please choose start and destination closer together (at most about 2.5 km).','Kies begin en eind dichter bij elkaar (hooguit ongeveer 2,5 km).');A.rerender();return;}
  A.status(T('Wegenetz und Schatten werden geladen (NWB, Gemeente) …','Loading network and shade (NWB, municipality) …','Wegennet en schaduw laden (NWB, gemeente) …'),true);
  const pad=.0022,bb=[Math.min(a.lng,b.lng)-pad*1.6,Math.min(a.lat,b.lat)-pad,Math.max(a.lng,b.lng)+pad*1.6,Math.max(a.lat,b.lat)+pad];
  try{
    const [feats,SH,BK]=await Promise.all([nwb(bb),shadeLoad(),benchLoad()]);if(job!==R.job)return;
    const G=graph(feats,SH),s=nearest(G,a),t=nearest(G,b);
    if(!s||!t)throw new Error('snap');
    const fast=dijkstra(G,s,t,e=>e.len),cool=dijkstra(G,s,t,e=>e.len*(1+ALPHA*(1-e.sh)));
    if(!fast||!cool)throw new Error('route');
    const benches=r=>{const P=r.segs.flatMap(e=>e.pts);let n=0;for(const [la,lo] of BK){if(la<bb[1]||la>bb[3]||lo<bb[0]||lo>bb[2])continue;for(let i=0;i<P.length;i+=1){if(Math.abs(P[i][0]-la)<.0003&&Math.abs(P[i][1]-lo)<.0005&&dist(la,lo,P[i][0],P[i][1])<25){n++;break;}}}return n;};
    fast.bench=benches(fast);cool.bench=benches(cool);
    R.res={fast,cool,same:Math.abs(fast.len-cool.len)<5};
  }catch(e){R.err=T('Für diese Punkte ließ sich kein Fußweg finden — näher an eine Straße tippen.','No walking route found for these points — tap closer to a street.','Geen looproute gevonden voor deze punten — tik dichter bij een straat.');}
  if(job!==R.job)return;R.busy=false;A.status('');A.rerender();A.req();
}
const min=m=>Math.round(m/(KMH*1000/60));
function body(){
  if(!R.a)return `<div class="sx-empty"><svg viewBox="0 0 120 54" width="120" height="54" aria-hidden="true"><path d="M14 40 C40 40 40 14 64 14 S100 22 106 12" fill="none" stroke="#3f7f6a" stroke-width="4" stroke-linecap="round"/><path d="M14 40 L106 12" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="4 5"/><circle cx="14" cy="40" r="5" fill="var(--ink)"/><circle cx="106" cy="12" r="5" fill="#FFD600" stroke="var(--ink)"/></svg><p>${T('Tippe auf den Start, dann auf das Ziel. Das Labor vergleicht den kürzesten mit dem schattigsten Fußweg.','Tap the start, then the destination. The lab compares the shortest with the shadiest walking route.','Tik op het begin, dan op het eind. Het lab vergelijkt de kortste met de schaduwrijkste looproute.')}</p></div>`;
  if(!R.b)return `<p class="lab-mute">${T('Start gesetzt — jetzt auf das Ziel tippen.','Start set — now tap the destination.','Begin gezet — tik nu op het eind.')}</p>`;
  if(R.busy)return `<p class="lab-mute">${T('Wege werden verglichen …','Comparing routes …','Routes worden vergeleken …')}</p>`;
  if(R.err||!R.res)return `<p class="v3-err">${R.err||''}</p>`;
  const {fast,cool,same}=R.res,row=(r,lbl,cls)=>`<div class="rt-row ${cls}"><i></i><div><b>${lbl}</b><small>${A.fmt(Math.round(r.len/10)*10)} m · ${min(r.len)} min · ${r.bench} ${T('Bänke','benches','bankjes')}</small></div><em>${Math.round(100*r.sh)} %<small>${T('Schatten','shade','schaduw')}</small></em></div>`;
  return `${row(cool,T('Schattigster Weg','Shadiest route','Schaduwrijkste route'),'cool')}${same?'':row(fast,T('Kürzester Weg','Shortest route','Kortste route'),'fast')}
    <p class="rt-sum">${same?T('Hier ist der kürzeste Weg auch der schattigste.','Here the shortest route is also the shadiest.','Hier is de kortste route ook de schaduwrijkste.'):T(`<b>+${Math.max(0,min(cool.len)-min(fast.len))} min</b> Umweg für <b>${Math.round(100*(cool.sh-fast.sh))} Prozentpunkte</b> mehr Schatten.`,`<b>+${Math.max(0,min(cool.len)-min(fast.len))} min</b> detour for <b>${Math.round(100*(cool.sh-fast.sh))} percentage points</b> more shade.`,`<b>+${Math.max(0,min(cool.len)-min(fast.len))} min</b> omweg voor <b>${Math.round(100*(cool.sh-fast.sh))} procentpunten</b> meer schaduw.`)}</p>
    <div class="lab-leg"><span><i style="background:#2f8a6a"></i>${T('schattig','shady','schaduwrijk')}</span><span><i style="background:#e8964a"></i>${T('sonnig','sunny','zonnig')}</span><span><i style="background:var(--ink)"></i>${T('kürzester Weg','shortest','kortste')}</span></div>
    ${cool.unk>.3?`<p class="lab-mute">${T(`${Math.round(100*cool.unk)} % des Weges ohne Straßennamen — dort ist der Schatten mit 25 % angenommen.`,`${Math.round(100*cool.unk)} % of the route has no street name — shade assumed at 25 % there.`,`${Math.round(100*cool.unk)} % van de route zonder straatnaam — daar is 25 % schaduw aangenomen.`)}</p>`:''}
    <button class="cta ghost lab-mini" id="rtNew">${T('Neue Route','New route','Nieuwe route')}</button>`;
}
LAB.addTool({id:'route',order:5.7,grp:'see',gate:false,keepStatus:true,
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8 18.5c6 0 2-7 8-7 3 0 2-4 0-4.5"/></svg>',
  label:()=>T('Route','Route','Route'),
  sub:()=>T('Schattigster statt kürzester Fußweg','Shadiest instead of shortest walk','Schaduwrijkste in plaats van kortste looproute'),
  render:body,
  bind(root){const b=root.querySelector('#rtNew');if(b)b.onclick=()=>{R.a=R.b=R.res=null;R.err=null;A.rerender();A.req();};},
  draw(g,X){
    const dark=A.dark();if(!A.tooFar()&&A.B.list.length)A.drawBuildings(g,X,dark?'rgba(60,56,66,.3)':'rgba(251,249,244,.4)',dark?'rgba(255,255,255,.12)':'rgba(23,21,28,.16)');
    const P=(la,lo)=>{const [x,y]=A.w20(la,lo);return [x*X.k-X.ox,y*X.k-X.oy];};
    const line=(segs,col,w,dash)=>{g.save();g.lineCap=g.lineJoin='round';g.setLineDash(dash?dash.map(v=>v*X.sc):[]);
      for(const e of segs){g.strokeStyle=typeof col==='function'?col(e):col;g.lineWidth=w*X.sc;g.beginPath();e.pts.forEach((p,i)=>{const q=P(p[0],p[1]);i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);});g.stroke();}g.restore();};
    if(R.res){const {fast,cool,same}=R.res;
      if(!same)line(fast.segs,dark?'rgba(243,239,231,.85)':'rgba(23,21,28,.8)',3,[6,6]);
      line(cool.segs,dark?'rgba(0,0,0,.55)':'rgba(255,255,255,.95)',9);
      line(cool.segs,e=>{const t=Math.max(0,Math.min(1,e.sh/.6));return `rgb(${Math.round(232+(47-232)*t)},${Math.round(150+(138-150)*t)},${Math.round(74+(106-74)*t)})`;},5.5);}
    for(const [p,c] of [[R.a,dark?'#f3efe7':'#17151c'],[R.b,'#FFD600']]){if(!p)continue;const q=P(p.lat,p.lng);g.fillStyle=c;g.strokeStyle=dark?'#17151c':'#fff';g.lineWidth=2.5*X.sc;g.beginPath();g.arc(q[0],q[1],8*X.sc,0,2*Math.PI);g.fill();g.stroke();}},
  click(e){if(!R.a||R.b){R.a=e.latlng;R.b=null;R.res=null;R.err=null;A.rerender();A.req();}else{R.b=e.latlng;compute();}return null;},
  note:()=>T('Wegenetz aus dem Nationalen Wegebestand (Fahrbahnen mit Gehweg, Fuß- und Radwege, Fußgängerzonen). Schatten je Straße aus „Schaduw wegdelen" der Gemeente (Stand 2023, Berechnungszeitpunkt nicht angegeben) — ein Mittel je Straßenname, nicht je Meter. Der schattigste Weg darf bis zu 2,4-mal so lang sein wie ein voll besonnter. Bänke innerhalb von 25 m aus dem Straatmeubilair der Gemeente. Gehtempo 4,8 km/h.','Network from the national road database (carriageways with pavement, foot and cycle paths, pedestrian zones). Shade per street from the municipality\'s "Schaduw wegdelen" (2023, calculation time not stated) — one average per street name, not per metre. The shadiest route may be up to 2.4 times as long as a fully sunny one. Benches within 25 m from the municipal street furniture register. Walking speed 4.8 km/h.','Wegennet uit het Nationaal Wegenbestand (rijbanen met stoep, voet- en fietspaden, voetgangersgebieden). Schaduw per straat uit „Schaduw wegdelen" van de gemeente (2023, rekentijdstip niet vermeld) — één gemiddelde per straatnaam, niet per meter. De schaduwrijkste route mag tot 2,4 keer zo lang zijn als een volledig zonnige. Bankjes binnen 25 m uit het straatmeubilair van de gemeente. Looptempo 4,8 km/u.'),
  src:()=>'NWB (Rijkswaterstaat / PDOK) · Gemeente Utrecht: Schaduw wegdelen, Straatmeubilair'
});
LAB.route={R,graph,dijkstra,compute,shadeLoad};
})();

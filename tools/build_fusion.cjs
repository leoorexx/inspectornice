// Stadt-Signatur („AlphaEarth-Prinzip" mit offenen Daten): jede 200-m-Zelle bekommt einen
// Fingerabdruck aus Klima-, Umwelt- und Sozialmerkmalen. Daraus: Gesamtlast (Umwelt × Sozial),
// Stadttypen (k-means) und Ähnlichkeitssuche im Frontend.
//   node tools/build_fusion.cjs utr   →  public/data/layers/fusion_utr.json
const fs=require('fs'),path=require('path');
const city=process.argv[2]||'utr';
if(city!=='utr'){console.error('Bisher nur Utrecht (BAG + diag-Bundle vorhanden).');process.exit(1);}
const L=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','public/data/layers',f),'utf8'));

const CELL=200, LAT0=52.09, mLat=111320, mLon=111320*Math.cos(LAT0*Math.PI/180);
const dLat=CELL/mLat, dLon=CELL/mLon;
const S=52.035,W=5.035,N=52.145,E=5.205;               // Utrechter Analyse-Box (wie BAG-Abruf)
const rows=Math.ceil((N-S)/dLat), cols=Math.ceil((E-W)/dLon);
const key=(lat,lon)=>{const r=Math.floor((lat-S)/dLat),c=Math.floor((lon-W)/dLon);return(r>=0&&r<rows&&c>=0&&c<cols)?r*cols+c:-1;};
const center=k=>[S+(Math.floor(k/cols)+.5)*dLat, W+(k%cols+.5)*dLon];
const dist=(a,b)=>Math.hypot((a[0]-b[0])*mLat,(a[1]-b[1])*mLon);

// ── Gebäude (PDOK BAG, 109k) ──
const bag=L(`bag_${city}.json`);
const ringArea=g=>{let a=0;for(let i=0;i<g.length-1;i++){const x1=g[i][0]*mLon,y1=g[i][1]*mLat,x2=g[i+1][0]*mLon,y2=g[i+1][1]*mLat;a+=x1*y2-x2*y1;}return Math.abs(a/2);};
const cells=new Map();
const cellOf=k=>{let c=cells.get(k);if(!c){c={k,n:0,area:0,lstA:0,co2A:0,flood:0,res:0,trees:0};cells.set(k,c);}return c;};
for(const b of bag){
  let la=0,lo=0;for(const p of b.g){lo+=p[0];la+=p[1];}la/=b.g.length;lo/=b.g.length;
  const k=key(la,lo);if(k<0)continue;
  const c=cellOf(k),a=ringArea(b.g)||1;
  c.n++;c.area+=a;c.lstA+=(b.lst||0)*a;c.co2A+=(b.co2||0)*a;
  if(b.flood==='high'||b.flood==='critical')c.flood++; if(b.u==='res')c.res++;
}
// nur bebaute Zellen (≥ 3 Gebäude) — Signatur ohne Bebauung wäre bedeutungslos
for(const [k,c] of cells) if(c.n<3) cells.delete(k);
const C=[...cells.values()];

// ── Grün, Bäume, Versorgung (diag-Bundle aus OSM) ──
const dg=L(`diag_${city}.json`);
for(const t of dg.trees){const k=key(t[0],t[1]);const c=cells.get(k);if(c)c.trees++;}
const polyArea=p=>{let a=0;for(let i=0;i<p.length;i++){const j=(i+1)%p.length;a+=p[i][1]*mLon*p[j][0]*mLat-p[j][1]*mLon*p[i][0]*mLat;}return Math.abs(a/2);};
const greens=dg.green.filter(p=>p.length>2&&polyArea(p)>=5000)   // WHO: zugängliche Grünfläche ≥ 0,5 ha
  .map(p=>[p.reduce((s,x)=>s+x[0],0)/p.length,p.reduce((s,x)=>s+x[1],0)/p.length]);
const nearest=(pt,arr)=>{let m=1e9;for(const q of arr){const d=dist(pt,q);if(d<m)m=d;}return m;};

// ── Hauptstraßen als Lärmquelle ──
const W8={trunk:4,trunk_link:3,primary:3,primary_link:2,secondary:2,secondary_link:1};
const roads=[];for(const f of L(`noise_roads_${city}.geojson`).features){
  const w=W8[f.properties.highway];if(!w)continue;const g=f.geometry||{};
  const cs=g.type==='LineString'?g.coordinates:g.type==='Polygon'?g.coordinates[0]:[];
  cs.forEach((p,i)=>{if(i%3===0)roads.push([p[1],p[0],w]);});
}

// ── Sozialdaten je Wijk (CBS Kerncijfers 2023, aus der App-Konfiguration) ──
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const ublk=html.slice(html.indexOf('  utr:{'));const dstart=ublk.indexOf('data:{');
let depth=0,i=dstart+5,end=i;for(;i<ublk.length;i++){if(ublk[i]==='{')depth++;else if(ublk[i]==='}'){depth--;if(depth===0){end=i+1;break;}}}
const WD=eval('('+ublk.slice(dstart+5,end)+')');
const wijken=L('wijken_utrecht.geojson').features.map(f=>({name:f.properties.wijknaam.replace(/^Wijk \d+ /,''),geom:f.geometry}));
const pip=(pt,ring)=>{let ins=false;for(let a=0,b=ring.length-1;a<ring.length;b=a++){const[xi,yi]=ring[a],[xj,yj]=ring[b];if(((yi>pt[1])!==(yj>pt[1]))&&(pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi))ins=!ins;}return ins;};
const inGeom=(pt,g)=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).some(poly=>pip(pt,poly[0]));
const wijkOf=(lat,lon)=>{const w=wijken.find(w=>inGeom([lon,lat],w.geom));return w?w.name:null;};

// ── Rohwerte je Zelle ──
for(const c of C){
  const ct=center(c.k);c.ct=ct;c.wijk=wijkOf(ct[0],ct[1]);
  c.heat=c.lstA/c.area;
  c.dens=Math.min(1,c.area/(CELL*CELL));                          // überbaute Fläche = Versiegelungs-Näherung
  c.greenD=nearest(ct,greens);
  c.treeHa=c.trees/(CELL*CELL/10000);
  let nz=0;for(const r of roads){const d=dist(ct,r);if(d<300)nz+=r[2]*(1-d/300);}c.noise=nz;
  c.access=(nearest(ct,dg.shops)+nearest(ct,dg.schools)+nearest(ct,dg.health))/3;
  c.co2=c.co2A/c.area;
  c.water=c.flood/c.n;
  const d=c.wijk&&WD[c.wijk];c.socRaw=d?[d.sgb2,d.kinderarmut,100-d.wb]:null;
}
const keep=C.filter(c=>c.wijk&&c.socRaw);
// Perzentil-Rang innerhalb der Stadt (0–1) — macht Merkmale vergleichbar und robust gegen Ausreißer
// Mittelrang bei Gleichständen: viele identische Werte (z. B. 0 Gewässernähe, 10 Wijk-Werte) sonst künstlich extrem
const pct=(arr,get)=>{const v=arr.map(get),s=[...v].sort((a,b)=>a-b),n=s.length;
  const lb=x=>{let lo=0,hi=n;while(lo<hi){const m=(lo+hi)>>1;if(s[m]<x)lo=m+1;else hi=m;}return lo;};
  const ub=x=>{let lo=0,hi=n;while(lo<hi){const m=(lo+hi)>>1;if(s[m]<=x)lo=m+1;else hi=m;}return lo;};
  return v.map(x=>((lb(x)+ub(x)-1)/2)/(n-1||1));};
const P={heat:pct(keep,c=>c.heat),greenD:pct(keep,c=>c.greenD),tree:pct(keep,c=>c.treeHa),dens:pct(keep,c=>c.dens),
  noise:pct(keep,c=>c.noise),access:pct(keep,c=>c.access),co2:pct(keep,c=>c.co2),water:pct(keep,c=>c.water)};
const wn=Object.keys(WD).filter(n=>WD[n].sgb2!=null),wp={};
const wP=[0,1,2].map(j=>pct(wn,n=>[WD[n].sgb2,WD[n].kinderarmut,100-WD[n].wb][j]));
wn.forEach((n,i)=>wp[n]=(wP[0][i]+wP[1][i]+wP[2][i])/3);
const DIMS=['heat','green','dens','noise','access','co2','social','water'];
keep.forEach((c,i)=>{c.v=[P.heat[i],(P.greenD[i]+(1-P.tree[i]))/2,P.dens[i],P.noise[i],P.access[i],P.co2[i],wp[c.wijk],P.water[i]];});

// ── Gesamtlast: Umwelt/Klima × Sozial → 3×3-Klassen (Terzile) ──
const envRaw=keep.map(c=>(c.v[0]+c.v[1]+c.v[2]+c.v[3])/4), envP=pct(envRaw.map((x,i)=>({x})),o=>o.x);
const ter=x=>x<1/3?0:x<2/3?1:2;
keep.forEach((c,i)=>{c.env=envP[i];c.biv=ter(envP[i])*3+ter(c.v[6]);});

// ── Stadttypen: k-means (k=6, k-means++, fester Seed → reproduzierbar) ──
let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
const X=keep.map(c=>c.v), K=6, d2=(a,b)=>a.reduce((s,x,j)=>s+(x-b[j])**2,0);
const cent=[X[Math.floor(rnd()*X.length)].slice()];
while(cent.length<K){const ds=X.map(x=>Math.min(...cent.map(c=>d2(x,c))));const tot=ds.reduce((a,b)=>a+b,0);let r=rnd()*tot,j=0;for(;j<ds.length;j++){r-=ds[j];if(r<=0)break;}cent.push(X[Math.min(j,X.length-1)].slice());}
let lab=new Array(X.length).fill(0);
for(let it=0;it<60;it++){
  let moved=0;X.forEach((x,i)=>{let b=0,bd=1e9;cent.forEach((c,j)=>{const d=d2(x,c);if(d<bd){bd=d;b=j;}});if(b!==lab[i]){lab[i]=b;moved++;}});
  for(let j=0;j<K;j++){const m=X.filter((_,i)=>lab[i]===j);if(m.length)cent[j]=m[0].map((_,d)=>m.reduce((s,x)=>s+x[d],0)/m.length);}
  if(!moved&&it>0)break;
}
// Benennung aus den drei markantesten Merkmalen (Abweichung vom Stadtmittel)
const VOC={heat:[['heiß','hot','heet'],['kühl','cool','koel']],green:[['grünarm','low on green','groenarm'],['grün','green','groen']],
  dens:[['dicht bebaut','dense','dicht bebouwd'],['offen bebaut','open','open bebouwd']],noise:[['laut','noisy','lawaaiig'],['ruhig','quiet','rustig']],
  access:[['weite Wege','far from amenities','ver van voorzieningen'],['kurze Wege','close to amenities','dicht bij voorzieningen']],
  co2:[['energieintensiv','energy-intensive','energie-intensief'],['energieeffizient','energy-efficient','energiezuinig']],
  social:[['sozial belastet','socially strained','sociaal kwetsbaar'],['sozial stabil','socially stable','sociaal stabiel']],
  water:[['am Wasser','by the water','aan het water'],['wasserfern','away from water','ver van water']]};
const clusters=cent.map((c,j)=>{
  // „wasserfern" ist kein Charakterzug; „am Wasser" nur, wenn deutlich ausgeprägt (Gewässernähe ist eine Näherung)
  const dev=c.map((x,d)=>({d,s:x-0.5})).filter(o=>DIMS[o.d]!=='water'||o.s>0.2).sort((a,b)=>Math.abs(b.s)-Math.abs(a.s)).slice(0,3);
  const nm=[0,1,2].map(l=>dev.map(o=>VOC[DIMS[o.d]][o.s>0?0:1][l]).join(' · '));
  return {id:j,n:lab.filter(x=>x===j).length,c:c.map(x=>Math.round(x*100)),name:{de:nm[0],en:nm[1],nl:nm[2]},burden:Math.round((c[0]+c[1]+c[2]+c[3]+c[6])/5*100)};
}).sort((a,b)=>b.burden-a.burden);
const remap={};clusters.forEach((c,i)=>{remap[c.id]=i;c.id=i;});

const out={city,cell:CELL,dLat:+dLat.toFixed(7),dLon:+dLon.toFixed(7),dims:DIMS,
  source:'PDOK BAG (Gebäude, LST, CO₂, Gewässernähe) · OpenStreetMap (Grün, Bäume, Versorgung, Hauptstraßen) · CBS Kerncijfers 2023 (Wijk-Ebene)',
  built:new Date().toISOString().slice(0,10),
  clusters,
  cells:keep.map((c,i)=>({c:[+c.ct[0].toFixed(5),+c.ct[1].toFixed(5)],v:c.v.map(x=>Math.round(x*100)),e:Math.round(c.env*100),b:c.biv,t:remap[lab[i]],w:c.wijk,n:c.n}))};
const dst=path.join(__dirname,'..','public/data/layers',`fusion_${city}.json`);
fs.writeFileSync(dst,JSON.stringify(out));
console.log(`${out.cells.length} Zellen à ${CELL} m · ${K} Stadttypen · ${(fs.statSync(dst).size/1024).toFixed(0)} KB → ${path.relative(process.cwd(),dst)}`);
clusters.forEach(c=>console.log(`  Typ ${c.id}: ${c.name.de.padEnd(48)} ${String(c.n).padStart(4)} Zellen · Last ${c.burden}`));

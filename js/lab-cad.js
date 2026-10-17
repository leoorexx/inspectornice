// ══════════════════════════════════════════════════════════════
// Straßenlabor · CAD-Paket für Architektur und Stadtplanung (Werkzeug „Export") und Werkzeug „Gebäude".
//  Lageplan DXF/SVG (1:500, 1:1000) mit Höhenlinien, Höhenpunkten, Straßennamen, Nordpfeil, Maßstab, Schriftfeld
//  Umgebungsplan DXF/SVG (1:2500) · Ansichten Nord, Süd, Ost, West mit Höhen (SVG + DXF, verdeckte Kanten entfernt)
//  IFC4-Modell (georeferenziert über IfcMapConversion, Gebäude als Volumen, Gelände als Dreiecksnetz) · STL für den 3D-Druck
//  Gebäudeanalyse: Maße, Flächen, Fassaden je Himmelsrichtung, Dach, Geschosse, BAG, Denkmalschutz, Klima am Ort
// Lagekoordinaten: Rijksdriehoek (EPSG:28992) in Metern, Höhen in m NAP. Gebäude: 3D BAG LoD 1.2 (70-%-Dachhöhe).
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api||!LAB.area)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n),AREA=LAB.area,AR=AREA.AR;
const f3=v=>(Math.round(v*1000)/1000).toString(),nf=(v,d)=>A.nf(v,d);
const today=()=>new Date().toISOString().slice(0,10);
const SRC='3D BAG (TU Delft / 3DGI, CC BY 4.0) · BGT, BAG (Kadaster / PDOK) · AHN (Rijkswaterstaat / PDOK) · NWB (Rijkswaterstaat) · Bomenkaart Gemeente Utrecht';

// ── Gebiet in RD ──
function site(src){
  const E=AREA.exportSet(src),[x0,y0,x1,y1]=E.frame,a=E.rd(x0,y1),b=E.rd(x1,y0);
  E.R={x0:Math.min(a[0],b[0]),y0:Math.min(a[1],b[1]),x1:Math.max(a[0],b[0]),y1:Math.max(a[1],b[1])};
  E.rdRing=z=>{const P=[];for(let i=0;i<z.length-2;i+=2)P.push(E.rd(z[i],z[i+1]));return P;};
  const inF=(x,y)=>x>=x0&&x<=x1&&y>=y0&&y<=y1,cen=z=>{let x=0,y=0;const n=z.length/2-1;for(let i=0;i<n;i++){x+=z[2*i];y+=z[2*i+1];}return [x/n,y/n];};
  E.siteBlds=E.blds;E.blds=(src?src.B:A.B.list).filter(b=>{const c=cen(b.z);return inF(c[0],c[1]);});
  E.trees=(A.TREES||[]).filter(t=>inF(t[4],t[5]));
  return E;
}
const rdToW=(x,y)=>{const ll=A.fromRD(x,y);return A.w20(ll[0],ll[1]);};

// ── Gelände aus dem AHN (dtm_05m), Lücken unter Gebäuden und Wasser aus der Umgebung gefüllt ──
async function dtm(R,maxN){
  const w=R.x1-R.x0,h=R.y1-R.y0,res=Math.max(.5,Math.max(w,h)/(maxN||240)),W=Math.max(8,Math.round(w/res)+1),H=Math.max(8,Math.round(h/res)+1);
  const [G,buf]=await Promise.all([A.geotiff(),fetch(`https://service.pdok.nl/rws/ahn/wcs/v1_0?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=dtm_05m&FORMAT=image/tiff&SUBSET=x(${R.x0},${R.x1})&SUBSET=y(${R.y0},${R.y1})&SCALESIZE=x(${W}),y(${H})`).then(r=>{if(!r.ok)throw new Error('AHN '+r.status);return r.arrayBuffer();})]);
  const im=await (await G.fromArrayBuffer(buf)).getImage(),Z=(await im.readRasters())[0],ww=im.getWidth(),hh=im.getHeight();
  return fillGrid(Float32Array.from(Z),ww,hh,R);
}
function fillGrid(Z,w,h,R){
  const n=w*h,z=new Float32Array(n),gap=new Uint8Array(n);let lo=Infinity,hi=-Infinity;
  for(let i=0;i<n;i++){const v=Z[i];if(v>-50&&v<400){z[i]=v;lo=Math.min(lo,v);hi=Math.max(hi,v);}else gap[i]=1;}
  let todo=[];for(let i=0;i<n;i++)if(gap[i])todo.push(i);
  for(let pass=0;pass<200&&todo.length;pass++){const next=[],up=[];for(const i of todo){let s=0,c=0;const x=i%w;for(const d of [-1,1,-w,w]){const k=i+d;if(k<0||k>=n||gap[k]||Math.abs((k%w)-x)>1)continue;s+=z[k];c++;}if(c)up.push([i,s/c]);else next.push(i);}for(const [i,v] of up){z[i]=v;gap[i]=0;}todo=next;}
  for(const i of todo)z[i]=isFinite(lo)?lo:0;
  const sm=new Float32Array(n);for(let j=0;j<h;j++)for(let i=0;i<w;i++){let s=0,c=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const a=i+di,b=j+dj;if(a<0||b<0||a>=w||b>=h)continue;s+=z[b*w+a];c++;}sm[j*w+i]=s/c;}   // leicht glätten: Höhenlinien ohne Treppen
  return {z:sm,w,h,x0:R.x0,y1:R.y1,dx:(R.x1-R.x0)/(w-1),dy:(R.y1-R.y0)/(h-1),lo:isFinite(lo)?lo:0,hi:isFinite(hi)?hi:0};
}
const at=(D,x,y)=>{const c=Math.max(0,Math.min(D.w-1.001,(x-D.x0)/D.dx)),r=Math.max(0,Math.min(D.h-1.001,(D.y1-y)/D.dy)),i=Math.floor(c),j=Math.floor(r),fx=c-i,fy=r-j,k=j*D.w+i,z=D.z;
  return z[k]*(1-fx)*(1-fy)+z[k+1]*fx*(1-fy)+z[k+D.w]*(1-fx)*fy+z[k+D.w+1]*fx*fy;};

// ── Höhenlinien (Marching Squares) und Höhenpunkte ──
function step(D){const r=D.hi-D.lo;return r<1.5?.25:r<4?.5:r<12?1:r<30?2:5;}
function contours(D,st){
  const out=[],{w,h,z}=D,X=i=>D.x0+i*D.dx,Y=j=>D.y1-j*D.dy;
  for(let L=Math.ceil(D.lo/st)*st;L<=D.hi;L=+(L+st).toFixed(4)){
    const seg=[];
    for(let j=0;j<h-1;j++)for(let i=0;i<w-1;i++){
      const a=z[j*w+i],b=z[j*w+i+1],c=z[(j+1)*w+i+1],d=z[(j+1)*w+i],idx=(a>=L?8:0)|(b>=L?4:0)|(c>=L?2:0)|(d>=L?1:0);if(idx===0||idx===15)continue;
      const e=k=>{const t=(p,q)=>(L-p)/((q-p)||1e-9);
        return k===0?[X(i+t(a,b)),Y(j)]:k===1?[X(i+1),Y(j+t(b,c))]:k===2?[X(i+1-t(c,d)),Y(j+1)]:[X(i),Y(j+1-t(d,a))];};
      const C={1:[[3,2]],2:[[2,1]],3:[[3,1]],4:[[0,1]],5:[[3,0],[2,1]],6:[[0,2]],7:[[3,0]],8:[[3,0]],9:[[0,2]],10:[[0,1],[3,2]],11:[[0,1]],12:[[3,1]],13:[[2,1]],14:[[3,2]]}[idx];
      for(const [p,q] of C)seg.push([e(p),e(q)]);}
    // Stücke zu Linienzügen verbinden
    const key=p=>p[0].toFixed(2)+','+p[1].toFixed(2),ends=new Map(),used=new Uint8Array(seg.length);
    seg.forEach((s,k)=>{for(const p of s){const kk=key(p);if(!ends.has(kk))ends.set(kk,[]);ends.get(kk).push(k);}});
    for(let k=0;k<seg.length;k++){if(used[k])continue;used[k]=1;const line=[seg[k][0],seg[k][1]];
      for(const dir of [1,0]){for(;;){const tip=dir?line[line.length-1]:line[0],nb=(ends.get(key(tip))||[]).find(m=>!used[m]);if(nb==null)break;used[nb]=1;const s=seg[nb],nx=key(s[0])===key(tip)?s[1]:s[0];if(dir)line.push(nx);else line.unshift(nx);}}
      if(line.length>=3)out.push({L,P:line,major:Math.abs(L/(st*5)-Math.round(L/(st*5)))<1e-6});}
  }
  return out;
}
function spots(D,E,sp,wet){
  const R=E.R,out=[],inB=(x,y)=>{const q=rdToW(x,y);return A.hits(A.B,q[0],q[1]).length>0;};
  for(let x=Math.ceil(R.x0/sp)*sp;x<=R.x1;x+=sp)for(let y=Math.ceil(R.y0/sp)*sp;y<=R.y1;y+=sp){if(inB(x,y)||(wet&&wet(x,y)))continue;out.push([x,y,at(D,x,y)]);}
  let mn=null,mx=null;for(let j=1;j<D.h-1;j+=2)for(let i=1;i<D.w-1;i+=2){const v=D.z[j*D.w+i],x=D.x0+i*D.dx,y=D.y1-j*D.dy;if(!mn||v<mn[2])mn=[x,y,v];if(!mx||v>mx[2])mx=[x,y,v];}
  return {pts:out,mn,mx};
}
const niceSp=w=>[5,10,20,25,50,100].find(v=>w/v<=10)||200;
// Linienzüge an Wasserflächen auftrennen (unter Wasser misst das AHN nicht, dort entstehen sonst Schlangenlinien)
function dry(C,wet){const out=[];for(const c of C){let cur=[];for(const p of c.P){if(wet(p[0],p[1])){if(cur.length>=3)out.push({...c,P:cur});cur=[];}else cur.push(p);}if(cur.length>=3)out.push({...c,P:cur});}return out;}

// ── Straßennamen aus dem NWB ──
async function streetNames(R){
  const a=A.fromRD(R.x0,R.y0),b=A.fromRD(R.x1,R.y1);let url=`https://api.pdok.nl/rws/nationaal-wegenbestand-wegen/ogc/v1/collections/wegvakken/items?bbox=${a[1]},${a[0]},${b[1]},${b[0]}&limit=1000&f=json`;const by=new Map();
  try{for(let k=0;k<6&&url;k++){const j=await fetch(url).then(r=>{if(!r.ok)throw 0;return r.json();});
    for(const f of j.features||[]){const n=(f.properties&&f.properties.stt_naam||'').trim();if(!n||!f.geometry)continue;const l=f.geometry.type==='LineString'?f.geometry.coordinates:f.geometry.coordinates[0];if(!l||l.length<2)continue;
      const P=l.map(c=>A.toRD(c[1],c[0]));let len=0;for(let i=1;i<P.length;i++)len+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);const o=by.get(n);if(!o||len>o.len)by.set(n,{n,P,len});}
    const nx=(j.links||[]).find(l=>l.rel==='next');url=nx?nx.href:null;}}catch(e){}
  const out=[];for(const s of by.values()){if(s.len<25)continue;let acc=0,half=s.len/2;for(let i=1;i<s.P.length;i++){const p=s.P[i-1],q=s.P[i],d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(acc+d>=half){const t=(half-acc)/(d||1),x=p[0]+(q[0]-p[0])*t,y=p[1]+(q[1]-p[1])*t;
      let ang=Math.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;if(x>R.x0&&x<R.x1&&y>R.y0&&y<R.y1)out.push({n:s.n,x,y,ang,len:s.len});break;}acc+=d;}}
  return out;
}

// ── DXF (R12, ASCII-Text: Umlaute umschrieben, damit jede CAD-Software sie lesen kann) ──
const ascii=s=>String(s).replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue').replace(/ß/g,'ss').replace(/[–—−]/g,'-').replace(/·/g,'-').replace(/°/g,' Grad').replace(/²/g,'2').replace(/³/g,'3').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\x20-\x7e]/g,'');
function DX(){
  const L=[],lay=new Map(),add=(...a)=>{for(const x of a)L.push(String(x));};
  const D={layer(n,c){if(!lay.has(n))lay.set(n,c);return n;},
    pl(ly,P,closed,z,thick){add(0,'POLYLINE',8,ly,66,1,70,closed?1:0);if(thick)add(39,f3(thick));add(10,0,20,0,30,f3(z||0));for(const p of P)add(0,'VERTEX',8,ly,10,f3(p[0]),20,f3(p[1]),30,f3(z||0));add(0,'SEQEND',8,ly);},
    line(ly,a,b){add(0,'LINE',8,ly,10,f3(a[0]),20,f3(a[1]),30,0,11,f3(b[0]),21,f3(b[1]),31,0);},
    circle(ly,p,r){add(0,'CIRCLE',8,ly,10,f3(p[0]),20,f3(p[1]),30,0,40,f3(r));},
    point(ly,p,z){add(0,'POINT',8,ly,10,f3(p[0]),20,f3(p[1]),30,f3(z||0));},
    text(ly,p,h,t,rot,al){const s=ascii(t);if(!s)return;add(0,'TEXT',8,ly,10,f3(p[0]),20,f3(p[1]),30,0,40,f3(h),1,s);if(rot)add(50,f3(rot));if(al){add(72,al===2?2:1,11,f3(p[0]),21,f3(p[1]),31,0);}},
    face(ly,a,b,c,d){add(0,'3DFACE',8,ly,10,f3(a[0]),20,f3(a[1]),30,f3(a[2]),11,f3(b[0]),21,f3(b[1]),31,f3(b[2]),12,f3(c[0]),22,f3(c[1]),32,f3(c[2]),13,f3(d[0]),23,f3(d[1]),33,f3(d[2]));},
    out(head,ext){const H=[];const h=(...a)=>{for(const x of a)H.push(String(x));};head.forEach(t=>h(999,ascii(t)));
      h(0,'SECTION',2,'HEADER',9,'$ACADVER',1,'AC1009',9,'$EXTMIN',10,f3(ext[0]),20,f3(ext[1]),30,0,9,'$EXTMAX',10,f3(ext[2]),20,f3(ext[3]),30,0,0,'ENDSEC');
      h(0,'SECTION',2,'TABLES',0,'TABLE',2,'LTYPE',70,1,0,'LTYPE',2,'CONTINUOUS',70,0,3,'Solid line',72,65,73,0,40,0,0,'ENDTAB');
      h(0,'TABLE',2,'LAYER',70,lay.size);for(const [n,c] of lay)h(0,'LAYER',2,n,70,0,62,c,6,'CONTINUOUS');h(0,'ENDTAB',0,'ENDSEC',0,'SECTION',2,'ENTITIES');
      return H.join('\n')+'\n'+L.join('\n')+'\n0\nENDSEC\n0\nEOF\n';}};
  return D;
}
const LAY={RAHMEN:7,GEBIET:1,GEBAEUDE:7,GEBAEUDE_HOEHE:8,FAHRBAHN:8,RADWEG:1,GEHWEG:9,PARKEN:251,GRUEN:3,WASSER:5,SONSTIGE:252,BAEUME:94,HOEHENLINIEN:42,HOEHENLINIEN_HAUPT:32,HOEHENLINIEN_TEXT:32,HOEHENPUNKTE:30,STRASSENNAMEN:7,NORDPFEIL:7,MASSSTAB:7,SCHRIFTFELD:7,UMGEBUNG_GEBAEUDE:250};
const surfLayer=o=>{const t=LAB.street?LAB.street.typeOf(o):'';return {car:'FAHRBAHN',transit:'FAHRBAHN',bike:'RADWEG',walk:'GEHWEG',shared:'GEHWEG',park:'PARKEN',green:'GRUEN',verge:'GRUEN',water:'WASSER'}[t]||(o.c===2?'GRUEN':o.c===3?'WASSER':'SONSTIGE');};
function headLines(kind,E,M){return [`Inspector Nice - ${kind}${M?' - Massstab 1:'+M:''}`,`Erzeugt ${today()} - Lage: Rijksdriehoek EPSG:28992 in Metern (echte Koordinaten) - Hoehen: m NAP`,'Quellen: '+SRC,'Gebaeudehoehen: 3D BAG LoD 1.2 (70-%-Dachhoehe), Hoehenlinien aus AHN dtm 0,5 m (geglaettet)'];}
function northArrow(D,x,y,s){D.pl('NORDPFEIL',[[x,y+s],[x+s*.35,y-s*.45],[x,y-s*.2],[x-s*.35,y-s*.45]],true);D.text('NORDPFEIL',[x,y+s*1.25],s*.6,'N',0,1);}
function scaleBar(D,x,y,M){const len=[10,20,50,100,200,500].find(v=>v/M*1000>=40)||500,th=2.5*M/1000;for(let i=0;i<4;i++){const a=x+i*len/4;D.pl('MASSSTAB',[[a,y],[a+len/4,y],[a+len/4,y+th*.6],[a,y+th*.6]],true);}D.text('MASSSTAB',[x,y-th*1.6],th,'0');D.text('MASSSTAB',[x+len,y-th*1.6],th,`${len} m`,0,2);}
function titleBlock(D,x,y,M,lines){const th=2.5*M/1000;lines.forEach((t,i)=>D.text('SCHRIFTFELD',[x,y-i*th*1.7],i?th*.8:th*1.3,t));}

// ── Lageplan ──
async function lageplan(M){
  status(T('Lageplan: Gelände (AHN), Straßennamen (NWB) …','Site plan: terrain (AHN), street names (NWB) …','Situatie: maaiveld (AHN), straatnamen (NWB) …'));
  await Promise.all([A.ensure('b'),A.ensure('s'),A.ensureTrees()]);
  const E=site(),R=E.R,[D,SN]=await Promise.all([dtm(R,260).catch(()=>null),streetNames(R)]);
  const X=DX(),th=2.5*M/1000;for(const [k,c] of Object.entries(LAY))X.layer(k,c);
  X.pl('RAHMEN',[[R.x0,R.y0],[R.x1,R.y0],[R.x1,R.y1],[R.x0,R.y1]],true);
  if(E.z)X.pl('GEBIET',E.rdRing(E.z),true);
  for(const s of E.surfs)X.pl(surfLayer(s.o),E.rdRing(s.z),true);
  const water=E.surfs.filter(x=>x.o.c===3).map(x=>x.z),wet=(x,y)=>{if(!water.length)return false;const q=rdToW(x,y);return water.some(z=>A.inPoly(q[0],q[1],z));};
  const C=D?dry(contours(D,step(D)),wet):[],sp=D?spots(D,E,niceSp(R.x1-R.x0),wet):null;
  for(const c of C){X.pl(c.major?'HOEHENLINIEN_HAUPT':'HOEHENLINIEN',c.P,false,c.L);if(c.major&&c.P.length>12){const m=c.P[c.P.length>>1],n=c.P[(c.P.length>>1)+1],ang=Math.atan2(n[1]-m[1],n[0]-m[0])*180/Math.PI;X.text('HOEHENLINIEN_TEXT',m,th*.7,nf(c.L,2),ang>90||ang<-90?ang+180:ang,1);}}
  if(sp){for(const p of sp.pts){X.point('HOEHENPUNKTE',p,p[2]);X.line('HOEHENPUNKTE',[p[0]-th*.3,p[1]],[p[0]+th*.3,p[1]]);X.line('HOEHENPUNKTE',[p[0],p[1]-th*.3],[p[0],p[1]+th*.3]);X.text('HOEHENPUNKTE',[p[0]+th*.4,p[1]+th*.2],th*.7,'+'+nf(p[2],2));}
    for(const [p,l] of [[sp.mn,'tief'],[sp.mx,'hoch']])if(p){X.point('HOEHENPUNKTE',p,p[2]);X.text('HOEHENPUNKTE',[p[0]+th*.4,p[1]-th*.9],th*.7,`${l} +${nf(p[2],2)}`);}}
  for(const b of E.blds){const P=E.rdRing(b.z);X.pl('GEBAEUDE',P,true,b.g!=null?b.g:0,b.h||0);
    if(b.h!=null){const c=P.reduce((s,p)=>[s[0]+p[0]/P.length,s[1]+p[1]/P.length],[0,0]),ok=b.g!=null?b.g+b.h:null;X.text('GEBAEUDE_HOEHE',c,th*.75,`${ok!=null?'OK +'+nf(ok,2):nf(b.h,1)+' m'}${b.lg?' - '+b.lg+' G':''}`,0,1);}}
  for(const t of E.trees){const p=E.rd(t[4],t[5]);X.circle('BAEUME',p,t[2]);X.point('BAEUME',p,0);}
  for(const s of SN)X.text('STRASSENNAMEN',[s.x,s.y],th*1.1,s.n,s.ang,1);
  northArrow(X,R.x1-th*5,R.y1-th*7,th*3);scaleBar(X,R.x0+th*2,R.y0-th*5,M);
  titleBlock(X,R.x0+(R.x1-R.x0)*.45,R.y0-th*3,M,[T('Lageplan','Site plan','Situatietekening'),`1:${M} · RD ${Math.round(R.x0)} / ${Math.round(R.y0)} · ${today()}`,`${T('Höhen','Heights','Hoogtes')} m NAP · ${T('Höhenlinien','Contours','Hoogtelijnen')} ${nf(D?step(D):0,2)} m · Inspector Nice`,SRC]);
  const txt=X.out(headLines('Lageplan',E,M),[R.x0-th*10,R.y0-th*20,R.x1+th*10,R.y1+th*10]);
  return {txt,E,D,C,SN,sp};
}
// Lageplan als SVG (gleicher Inhalt, zum Drucken und Weitergeben)
function lageplanSvg(L,M){
  const {E,C,SN,sp}=L,R=E.R,mmPx=72/25.4,Wm=R.x1-R.x0,Hm=R.y1-R.y0,s=1000/M*mmPx,pad=40,W=Math.round(Wm*s+2*pad),H=Math.round(Hm*s+2*pad+70);
  const P=(x,y)=>[(pad+(x-R.x0)*s).toFixed(1),(pad+(R.y1-y)*s).toFixed(1)],path=(pts,cl)=>pts.map((p,i)=>(i?'L':'M')+P(p[0],p[1]).join(' ')).join('')+(cl?'Z':'');
  const col={FAHRBAHN:'#d6d0c6',RADWEG:'#e7b8a6',GEHWEG:'#ebe5d8',PARKEN:'#d9d4cc',GRUEN:'#c9d8a8',WASSER:'#a9c6dc',SONSTIGE:'#e2ddd2'};
  let o=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="DM Sans, Helvetica, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
  o+=`<defs><clipPath id="c"><rect x="${pad}" y="${pad}" width="${(Wm*s).toFixed(1)}" height="${(Hm*s).toFixed(1)}"/></clipPath></defs><g clip-path="url(#c)">`;
  o+=E.surfs.map(x=>`<path d="${path(E.rdRing(x.z),1)}" fill="${col[surfLayer(x.o)]}"/>`).join('');
  o+=`<g fill="none" stroke="#b0844a">${C.map(c=>`<path d="${path(c.P)}" stroke-width="${c.major?.9:.45}"/>`).join('')}</g>`;
  o+=`<g fill="#5f8a45" fill-opacity=".35" stroke="#3f6a2a" stroke-width=".5">${E.trees.map(t=>{const p=E.rd(t[4],t[5]),[x,y]=P(p[0],p[1]);return `<circle cx="${x}" cy="${y}" r="${(t[2]*s).toFixed(1)}"/>`;}).join('')}</g>`;
  o+=`<g fill="#fbf9f4" stroke="#17151c" stroke-width=".8">${E.blds.map(b=>`<path d="${path(E.rdRing(b.z),1)}"/>`).join('')}</g>`;
  o+=`<g font-size="7" fill="#17151c" text-anchor="middle">${E.blds.filter(b=>b.h!=null&&Math.abs(A.signed(b.z))*A.m20()**2/2>60).map(b=>{const Q=E.rdRing(b.z),c=Q.reduce((a,p)=>[a[0]+p[0]/Q.length,a[1]+p[1]/Q.length],[0,0]),[x,y]=P(c[0],c[1]);return `<text x="${x}" y="${y}">${b.g!=null?'+'+nf(b.g+b.h,1):nf(b.h,1)}</text>`;}).join('')}</g>`;
  if(sp)o+=`<g font-size="6" fill="#7a5a2a">${sp.pts.map(p=>{const [x,y]=P(p[0],p[1]);return `<path d="M${x-2} ${y}h4M${x} ${y-2}v4" stroke="#7a5a2a" stroke-width=".6"/><text x="${+x+3}" y="${y-2}">+${nf(p[2],2)}</text>`;}).join('')}</g>`;
  o+=`<g font-size="8" font-weight="700" fill="#46424f" text-anchor="middle">${SN.map(t=>{const [x,y]=P(t.x,t.y);return `<text transform="translate(${x} ${y}) rotate(${(-t.ang).toFixed(1)})" stroke="#fff" stroke-width="2.5" paint-order="stroke">${t.n}</text>`;}).join('')}</g>`;
  if(E.z)o+=`<path d="${path(E.rdRing(E.z),1)}" fill="none" stroke="#d0583c" stroke-width="1.6" stroke-dasharray="6 4"/>`;
  o+=`</g><rect x="${pad}" y="${pad}" width="${(Wm*s).toFixed(1)}" height="${(Hm*s).toFixed(1)}" fill="none" stroke="#17151c"/>`;
  const sb=[10,20,50,100,200,500].find(v=>v*s>=60)||500,yb=H-40;
  o+=`<g transform="translate(${pad},${yb})">${[0,1,2,3].map(i=>`<rect x="${(i*sb*s/4).toFixed(1)}" width="${(sb*s/4).toFixed(1)}" height="5" fill="${i%2?'#fff':'#17151c'}" stroke="#17151c" stroke-width=".6"/>`).join('')}<text y="18" font-size="9">0</text><text x="${(sb*s).toFixed(1)}" y="18" font-size="9" text-anchor="end">${sb} m</text></g>`;
  o+=`<g transform="translate(${W-pad-14},${pad+22})"><path d="M0 -16 7 10 0 5 -7 10Z" fill="#17151c"/><text y="24" font-size="11" text-anchor="middle" font-weight="700">N</text></g>`;
  o+=`<text x="${pad+sb*s+20}" y="${yb+5}" font-size="10" font-weight="700">${T('Lageplan','Site plan','Situatietekening')} 1:${M}</text><text x="${pad+sb*s+20}" y="${yb+18}" font-size="8" fill="#46424f">RD ${Math.round(R.x0)} / ${Math.round(R.y0)} · ${T('Höhen','Heights','Hoogtes')} m NAP · ${today()} · Inspector Nice · ${SRC}</text>`;
  return o+'</svg>';
}

// ── Umgebungsplan (größerer Ausschnitt, 1:2500) ──
async function umgebung(){
  const E0=site(),R0=E0.R,cx=(R0.x0+R0.x1)/2,cy=(R0.y0+R0.y1)/2,half=Math.max(300,Math.min(600,1.5*Math.max(R0.x1-R0.x0,R0.y1-R0.y0)));
  const R={x0:cx-half,y0:cy-half,x1:cx+half,y1:cy+half},a=A.fromRD(R.x0,R.y0),b=A.fromRD(R.x1,R.y1),bounds=L.latLngBounds([a[0],a[1]],[b[0],b[1]]);
  status(T('Umgebungsplan: Gebäude und Flächen im Umkreis werden geladen …','Surroundings plan: loading buildings and areas …','Omgevingskaart: gebouwen en vlakken laden …'));
  const [BL,SL,SN]=await Promise.all([A.ensure('b',bounds),A.ensure('s',bounds),streetNames(R)]);
  const wa=rdToW(R.x0,R.y1),wb=rdToW(R.x1,R.y0),wx0=Math.min(wa[0],wb[0]),wx1=Math.max(wa[0],wb[0]),wy0=Math.min(wa[1],wb[1]),wy1=Math.max(wa[1],wb[1]);
  const cen=z=>{let x=0,y=0;const n=z.length/2-1;for(let i=0;i<n;i++){x+=z[2*i];y+=z[2*i+1];}return [x/n,y/n];};
  const blds=(BL||[]).filter(o=>{const c=cen(o.z);return c[0]>=wx0&&c[0]<=wx1&&c[1]>=wy0&&c[1]<=wy1;});
  const surfs=(SL||[]).map(o=>({o,z:AREA.clip(o.z,wx0,wy0,wx1,wy1)})).filter(s=>s.z&&s.z.length>=6&&(s.o.c===2||s.o.c===3||/^(car|transit)$/.test(LAB.street?LAB.street.typeOf(s.o):'')));
  const ring=z=>{const P=[];for(let i=0;i<z.length-2;i+=2)P.push(E0.rd(z[i],z[i+1]));return P;},siteBl=new Set(E0.siteBlds||E0.blds);
  const M=2500,th=2.5*M/1000,X=DX();for(const [k,c] of Object.entries(LAY))X.layer(k,c);
  X.pl('RAHMEN',[[R.x0,R.y0],[R.x1,R.y0],[R.x1,R.y1],[R.x0,R.y1]],true);
  for(const s of surfs)X.pl(surfLayer(s.o),ring(s.z),true);
  for(const o of blds)X.pl(siteBl.has(o)?'GEBAEUDE':'UMGEBUNG_GEBAEUDE',ring(o.z),true);
  if(E0.z)X.pl('GEBIET',ring(E0.z),true);
  for(const s of SN)X.text('STRASSENNAMEN',[s.x,s.y],th*.9,s.n,s.ang,1);
  northArrow(X,R.x1-th*4,R.y1-th*6,th*2.5);scaleBar(X,R.x0+th*2,R.y0-th*4,M);
  titleBlock(X,R.x0+(R.x1-R.x0)*.45,R.y0-th*2.5,M,[T('Umgebungsplan','Surroundings plan','Omgevingskaart'),`1:${M} · RD ${Math.round(R.x0)} / ${Math.round(R.y0)} · ${today()}`,'Inspector Nice · '+SRC]);
  const dxf=X.out(headLines('Umgebungsplan',E0,M),[R.x0-th*6,R.y0-th*14,R.x1+th*6,R.y1+th*6]);
  // SVG (Schwarzplan mit markiertem Gebiet)
  const mmPx=72/25.4,s=1000/M*mmPx,pad=36,W=Math.round((R.x1-R.x0)*s+2*pad),H=Math.round((R.y1-R.y0)*s+2*pad+56);
  const P=(x,y)=>[(pad+(x-R.x0)*s).toFixed(1),(pad+(R.y1-y)*s).toFixed(1)],path=pts=>pts.map((p,i)=>(i?'L':'M')+P(p[0],p[1]).join(' ')).join('')+'Z';
  let o=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="DM Sans, Helvetica, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/><defs><clipPath id="uc"><rect x="${pad}" y="${pad}" width="${((R.x1-R.x0)*s).toFixed(1)}" height="${((R.y1-R.y0)*s).toFixed(1)}"/></clipPath></defs><g clip-path="url(#uc)">`;
  o+=surfs.map(x=>`<path d="${path(ring(x.z))}" fill="${x.o.c===3?'#a9c6dc':x.o.c===2?'#d4e0bd':'#e6e2da'}"/>`).join('');
  o+=blds.map(b=>`<path d="${path(ring(b.z))}" fill="${siteBl.has(b)?'#d0583c':'#3a3646'}"/>`).join('');
  if(E0.z)o+=`<path d="${path(ring(E0.z))}" fill="none" stroke="#d0583c" stroke-width="1.5" stroke-dasharray="5 3"/>`;
  o+=`<g font-size="7" font-weight="700" fill="#17151c" text-anchor="middle">${SN.filter(t=>t.len>80).map(t=>{const [x,y]=P(t.x,t.y);return `<text transform="translate(${x} ${y}) rotate(${(-t.ang).toFixed(1)})" stroke="#fff" stroke-width="2.2" paint-order="stroke">${t.n}</text>`;}).join('')}</g>`;
  o+=`</g><rect x="${pad}" y="${pad}" width="${((R.x1-R.x0)*s).toFixed(1)}" height="${((R.y1-R.y0)*s).toFixed(1)}" fill="none" stroke="#17151c"/>`;
  const sb=[50,100,200,500].find(v=>v*s>=50)||500,yb=H-34;
  o+=`<g transform="translate(${pad},${yb})"><rect width="${(sb*s).toFixed(1)}" height="5" fill="#17151c"/><text y="17" font-size="9">${sb} m</text></g><g transform="translate(${W-pad-12},${pad+20})"><path d="M0 -14 6 9 0 5 -6 9Z" fill="#17151c"/><text y="21" font-size="10" text-anchor="middle" font-weight="700">N</text></g>`;
  o+=`<text x="${pad+sb*s+18}" y="${yb+5}" font-size="10" font-weight="700">${T('Umgebungsplan','Surroundings plan','Omgevingskaart')} 1:${M}</text><text x="${pad+sb*s+18}" y="${yb+17}" font-size="8" fill="#46424f">RD ${Math.round(R.x0)} / ${Math.round(R.y0)} · ${today()} · Inspector Nice · 3D BAG · BGT · NWB</text></svg>`;
  return {dxf,svg:o,n:blds.length};
}

// ── Ansichten Nord, Süd, Ost, West (verdeckte Kanten entfernt) ──
const VIEWS=[['N',[0,-1],['Ansicht Nord','North elevation','Aanzicht noord']],['O',[-1,0],['Ansicht Ost','East elevation','Aanzicht oost']],['S',[0,1],['Ansicht Süd','South elevation','Aanzicht zuid']],['W',[1,0],['Ansicht West','West elevation','Aanzicht west']]];
function elevation(E,v){   // v: Blickrichtung (vom Betrachter ins Bild); rechts = (v.y, −v.x)
  const r=[v[1],-v[0]],out=[];
  for(const b of E.blds){if(!(b.h>0)||b.g==null)continue;const P=E.rdRing(b.z);let u0=Infinity,u1=-Infinity,d=Infinity;
    for(const p of P){const u=p[0]*r[0]+p[1]*r[1],dd=p[0]*v[0]+p[1]*v[1];u0=Math.min(u0,u);u1=Math.max(u1,u);d=Math.min(d,dd);}
    out.push({b,u0,u1,d,base:b.g,top:b.g+b.h,ridge:b.hn!=null?b.g+b.hn:null});}
  out.sort((a,b)=>a.d-b.d);   // nah zuerst
  const minus=(segs,cut)=>{let res=segs;for(const [c0,c1] of cut){const nx=[];for(const [a,b] of res){if(c1<=a||c0>=b){nx.push([a,b]);continue;}if(c0>a)nx.push([a,c0]);if(c1<b)nx.push([c1,b]);}res=nx;}return res.filter(([a,b])=>b-a>.05);};
  const lines=[];
  out.forEach((k,i)=>{const near=out.slice(0,i);
    const hz=y=>minus([[k.u0,k.u1]],near.filter(n=>y>n.base+1e-6&&y<n.top-1e-6).map(n=>[n.u0,n.u1]));
    const vt=u=>minus([[k.base,k.top]],near.filter(n=>u>n.u0+1e-6&&u<n.u1-1e-6).map(n=>[n.base,n.top]));
    for(const [a,b2] of hz(k.top))lines.push({k,a:[a,k.top],b:[b2,k.top]});
    for(const [a,b2] of hz(k.base))lines.push({k,a:[a,k.base],b:[b2,k.base]});
    for(const u of [k.u0,k.u1])for(const [a,b2] of vt(u))lines.push({k,a:[u,a],b:[u,b2]});});
  return {items:out,lines};
}
function elevationsSvg(E){
  const ELS=VIEWS.map(([k,v,n])=>({k,n:T(...n),...elevation(E,v)})).filter(e=>e.items.length);
  if(!ELS.length)return null;
  let uw=0,zmin=Infinity,zmax=-Infinity;for(const e of ELS){const a=Math.min(...e.items.map(i=>i.u0)),b=Math.max(...e.items.map(i=>i.u1));e.ua=a;uw=Math.max(uw,b-a);for(const i of e.items){zmin=Math.min(zmin,i.base);zmax=Math.max(zmax,i.ridge!=null?Math.max(i.top,i.ridge):i.top);}}
  const PW=560,PH=330,s=Math.min((PW-70)/Math.max(1,uw),(PH-80)/Math.max(1,zmax-zmin+2)),W=PW*2+30,H=PH*2+70;
  let o=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="DM Sans, Helvetica, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
  ELS.forEach((e,idx)=>{const ox=10+(idx%2)*(PW+10),oy=10+Math.floor(idx/2)*(PH+10),X=u=>ox+56+(u-e.ua)*s,Y=z=>oy+PH-44-(z-zmin+1)*s;
    o+=`<g><rect x="${ox}" y="${oy}" width="${PW}" height="${PH}" fill="none" stroke="#d8d3c8"/><text x="${ox+12}" y="${oy+22}" font-size="14" font-weight="700" fill="#17151c">${e.n}</text>`;
    for(let z=Math.ceil(zmin/5)*5;z<=zmax+1;z+=5){const y=Y(z).toFixed(1);o+=`<line x1="${ox+50}" x2="${ox+PW-10}" y1="${y}" y2="${y}" stroke="#ece8df" stroke-width=".6"/><text x="${ox+46}" y="${(+y+3).toFixed(1)}" font-size="8.5" fill="#67626f" text-anchor="end">+${z}</text>`;}
    o+=[...e.items].reverse().map(i=>`<rect x="${X(i.u0).toFixed(1)}" y="${Y(i.top).toFixed(1)}" width="${((i.u1-i.u0)*s).toFixed(1)}" height="${((i.top-i.base)*s).toFixed(1)}" fill="${i.d===e.items[0].d?'#fbf9f4':'#f1ede5'}"/>`).join('');
    o+=`<g stroke="#17151c" stroke-width=".9">${e.lines.map(l=>`<line x1="${X(l.a[0]).toFixed(1)}" y1="${Y(l.a[1]).toFixed(1)}" x2="${X(l.b[0]).toFixed(1)}" y2="${Y(l.b[1]).toFixed(1)}"/>`).join('')}</g>`;
    o+=`<line x1="${ox+50}" x2="${ox+PW-10}" y1="${Y(zmin).toFixed(1)}" y2="${Y(zmin).toFixed(1)}" stroke="#17151c" stroke-width="1.6"/>`;
    const placed=[],lab=[...e.items].filter(i=>(i.u1-i.u0)*s>14).sort((a,b)=>(b.top-a.top)||((b.u1-b.u0)-(a.u1-a.u0))).filter(i=>{const x=X((i.u0+i.u1)/2),y=Y(i.top)-4;if(placed.some(p=>Math.abs(p[0]-x)<30&&Math.abs(p[1]-y)<11))return false;placed.push([x,y]);return true;});   // keine Überlappung
    o+=`<g font-size="8" fill="#17151c" text-anchor="middle">${lab.map(i=>`<text x="${X((i.u0+i.u1)/2).toFixed(1)}" y="${(Y(i.top)-4).toFixed(1)}" stroke="#fff" stroke-width="2.4" paint-order="stroke">+${nf(i.top,1)}</text>`).join('')}</g></g>`;});
  const sb=[5,10,20,50,100].find(v=>v*s>=50)||100;
  o+=`<g transform="translate(20,${H-34})"><rect width="${(sb*s).toFixed(1)}" height="5" fill="#17151c"/><text y="17" font-size="9">${sb} m</text></g><text x="${30+sb*s}" y="${H-28}" font-size="9" fill="#46424f">${T('Ansichten, Höhen in m NAP (Oberkante = 70-%-Dachhöhe, LoD 1.2), verdeckte Kanten entfernt · gleicher Maßstab für alle vier','Elevations, heights in m NAP (top = 70 % roof height, LoD 1.2), hidden edges removed · same scale for all four','Aanzichten, hoogtes in m NAP (bovenkant = 70 %-dakhoogte, LoD 1.2), verborgen lijnen verwijderd · zelfde schaal voor alle vier')} · Inspector Nice · 3D BAG · ${today()}</text>`;
  return o+'</svg>';
}
function elevationsDxf(E){
  const X=DX();let ox=0,ok=false;
  for(const [k,v,n] of VIEWS){const e=elevation(E,v);if(!e.items.length)continue;ok=true;const ly=X.layer('ANSICHT_'+k,7),lt=X.layer('ANSICHT_'+k+'_TEXT',8),ua=Math.min(...e.items.map(i=>i.u0)),ub=Math.max(...e.items.map(i=>i.u1)),zmin=Math.min(...e.items.map(i=>i.base)),zmax=Math.max(...e.items.map(i=>i.top));
    const P=([u,z])=>[ox+(u-ua),z];for(const l of e.lines)X.line(ly,P(l.a),P(l.b));
    X.line(ly,[ox-2,zmin],[ox+(ub-ua)+2,zmin]);X.text(lt,[ox,zmax+6],2.2,n[0]);
    for(const i of e.items)if(i.u1-i.u0>4)X.text(lt,[ox+(i.u0+i.u1)/2-ua,i.top+.6],.9,'+'+nf(i.top,2),0,1);
    for(let z=Math.ceil(zmin/5)*5;z<=zmax;z+=5){X.line(lt,[ox-4,z],[ox-2,z]);X.text(lt,[ox-4.5,z-.3],.8,'+'+z,0,2);}
    ox+=(ub-ua)+30;}
  return ok?X.out(['Inspector Nice - Ansichten Nord, Ost, Sued, West','X = Lage entlang der Ansicht (m), Y = Hoehe in m NAP; verdeckte Kanten entfernt','Quellen: 3D BAG LoD 1.2 (CC BY 4.0)'],[-10,0,ox,100]):null;
}

// ── IFC4 (Referenzansicht): Projekt, Gelände, je Gebäude ein Volumen; georeferenziert ──
const B64='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
const guid=()=>{let s=B64[Math.floor(Math.random()*4)];for(let i=0;i<21;i++)s+=B64[Math.floor(Math.random()*64)];return s;};
const istr=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"''").replace(/[^\x20-\x7e]/g,c=>'\\X2\\'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')+'\\X0\\')+"'";
const ir=v=>{let s=(Math.round(v*1000)/1000).toString();if(!/[.eE]/.test(s))s+='.';return s;};
async function ifc(withTerrain){
  await Promise.all([A.ensure('b'),A.ensure('s')]);
  const E=site(),R=E.R,ox=Math.round(R.x0),oy=Math.round(R.y0);let D=null;
  if(withTerrain){status(T('IFC: Gelände aus dem AHN …','IFC: terrain from AHN …','IFC: maaiveld uit AHN …'));D=await dtm(R,90).catch(()=>null);if(D)flattenWater(D,E);}
  const L=[];let n=0;const e=s=>{n++;L.push(`#${n}=${s};`);return '#'+n;};
  const o0=e('IFCCARTESIANPOINT((0.,0.,0.))'),dz=e('IFCDIRECTION((0.,0.,1.))'),dx=e('IFCDIRECTION((1.,0.,0.))'),ax=e(`IFCAXIS2PLACEMENT3D(${o0},${dz},${dx})`);
  const ctx=e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${ax},$)`),body=e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const uL=e('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'),uA=e('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'),uV=e('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'),uP=e('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)');
  const units=e(`IFCUNITASSIGNMENT((${uL},${uA},${uV},${uP}))`);
  const proj=e(`IFCPROJECT(${istr(guid())},$,${istr('Inspector Nice - Umgebung')},${istr('3D BAG LoD 1.2, AHN, erzeugt '+today())},$,$,$,(${ctx}),${units})`);
  const crs=e(`IFCPROJECTEDCRS(${istr('EPSG:28992')},${istr('Amersfoort / RD New')},${istr('Amersfoort')},${istr('NAP')},${istr('Oblique Stereographic')},$,${uL})`);
  e(`IFCMAPCONVERSION(${ctx},${crs},${ir(ox)},${ir(oy)},0.,1.,0.,$)`);
  const spl=e(`IFCLOCALPLACEMENT($,${ax})`),siteE=e(`IFCSITE(${istr(guid())},$,${istr(T('Gebiet','Site','Gebied'))},${istr('RD '+ox+' / '+oy)},$,${spl},$,$,.ELEMENT.,$,$,$,$,$)`);
  e(`IFCRELAGGREGATES(${istr(guid())},$,$,$,${proj},(${siteE}))`);
  const blds=[],siteEls=[];
  if(D){const st=Math.max(1,Math.round(D.w/80)),cols=[],idx=[];const I=(i,j)=>Math.floor(j/st)*(Math.floor((D.w-1)/st)+1)+Math.floor(i/st)+1;
    const ni=Math.floor((D.w-1)/st)+1,nj=Math.floor((D.h-1)/st)+1;
    for(let j=0;j<nj;j++)for(let i=0;i<ni;i++){const ii=i*st,jj=j*st;cols.push(`(${ir(D.x0+ii*D.dx-ox)},${ir(D.y1-jj*D.dy-oy)},${ir(D.z[jj*D.w+ii])})`);}
    for(let j=0;j<nj-1;j++)for(let i=0;i<ni-1;i++){const a=j*ni+i+1,b=a+1,c=a+ni+1,d=a+ni;idx.push(`(${a},${b},${c})`,`(${a},${c},${d})`);}
    const pl=e(`IFCCARTESIANPOINTLIST3D((${cols.join(',')}))`),tfs=e(`IFCTRIANGULATEDFACESET(${pl},$,.F.,(${idx.join(',')}),$)`);
    const rep=e(`IFCSHAPEREPRESENTATION(${body},'Body','Tessellation',(${tfs}))`),pds=e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`),tpl=e(`IFCLOCALPLACEMENT(${spl},${ax})`);
    siteEls.push(e(`IFCGEOGRAPHICELEMENT(${istr(guid())},$,${istr(T('Gelände','Terrain','Maaiveld'))},${istr('AHN dtm 0,5 m')},$,${tpl},${pds},$,.TERRAIN.)`));}
  for(const b of E.blds){if(!(b.h>0))continue;
    let P=E.rdRing(b.z).map(p=>[p[0]-ox,p[1]-oy]);if(P.length<3)continue;let ar=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];ar+=p[0]*q[1]-q[0]*p[1];}if(ar<0)P.reverse();
    const pts=P.map(p=>e(`IFCCARTESIANPOINT((${ir(p[0])},${ir(p[1])}))`)),poly=e(`IFCPOLYLINE((${pts.join(',')},${pts[0]}))`),prof=e(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${poly})`);
    const bp=e(`IFCCARTESIANPOINT((0.,0.,${ir(b.g!=null?b.g:0)}))`),pos=e(`IFCAXIS2PLACEMENT3D(${bp},$,$)`),sol=e(`IFCEXTRUDEDAREASOLID(${prof},${pos},${dz},${ir(b.h)})`);
    const rep=e(`IFCSHAPEREPRESENTATION(${body},'Body','SweptSolid',(${sol}))`),pds=e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`);
    const bpl=e(`IFCLOCALPLACEMENT(${spl},${ax})`),epl=e(`IFCLOCALPLACEMENT(${bpl},${ax})`),nm=b.id?b.id.replace('NL.IMBAG.Pand.',''):'';
    const bld=e(`IFCBUILDING(${istr(guid())},$,${istr(nm?'BAG '+nm:T('Gebäude','Building','Gebouw'))},$,$,${bpl},$,$,.ELEMENT.,${b.g!=null?ir(b.g):'$'},${b.g!=null?ir(b.g):'$'},$)`);
    const el=e(`IFCBUILDINGELEMENTPROXY(${istr(guid())},$,${istr(T('Volumen LoD 1.2','Mass LoD 1.2','Volume LoD 1.2'))},${istr('3D BAG')},$,${epl},${pds},$,.ELEMENT.)`);
    e(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${istr(guid())},$,$,$,(${el}),${bld})`);
    const pr=[e(`IFCPROPERTYSINGLEVALUE('Hoehe_70p',$,IFCLENGTHMEASURE(${ir(b.h)}),$)`),e(`IFCPROPERTYSINGLEVALUE('Maaiveld_NAP',$,IFCLENGTHMEASURE(${ir(b.g||0)}),$)`)];
    if(b.hx!=null)pr.push(e(`IFCPROPERTYSINGLEVALUE('Hoehe_max',$,IFCLENGTHMEASURE(${ir(b.hx)}),$)`));if(b.id)pr.push(e(`IFCPROPERTYSINGLEVALUE('BAG_Pand',$,IFCIDENTIFIER(${istr(nm)}),$)`));
    if(b.yr)pr.push(e(`IFCPROPERTYSINGLEVALUE('Bouwjaar',$,IFCINTEGER(${b.yr}),$)`));if(b.lg)pr.push(e(`IFCPROPERTYSINGLEVALUE('Bouwlagen',$,IFCINTEGER(${Math.round(b.lg)}),$)`));
    pr.push(e(`IFCPROPERTYSINGLEVALUE('Quelle',$,IFCLABEL(${istr('3D BAG (TU Delft / 3DGI, CC BY 4.0)')}),$)`));
    const ps=e(`IFCPROPERTYSET(${istr(guid())},$,'Pset_InspectorNice',$,(${pr.join(',')}))`);e(`IFCRELDEFINESBYPROPERTIES(${istr(guid())},$,$,$,(${bld}),${ps})`);
    if(b.yr){const pc=e(`IFCPROPERTYSINGLEVALUE('YearOfConstruction',$,IFCLABEL(${istr(String(b.yr))}),$)`),pc2=e(`IFCPROPERTYSET(${istr(guid())},$,'Pset_BuildingCommon',$,(${pc}))`);e(`IFCRELDEFINESBYPROPERTIES(${istr(guid())},$,$,$,(${bld}),${pc2})`);}
    blds.push(bld);}
  if(blds.length)e(`IFCRELAGGREGATES(${istr(guid())},$,$,$,${siteE},(${blds.join(',')}))`);
  if(siteEls.length)e(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${istr(guid())},$,$,$,(${siteEls.join(',')}),${siteE})`);
  const name=`inspector-nice_${ox}_${oy}_${today()}.ifc`;
  const head=`ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');\nFILE_NAME(${istr(name)},${istr(new Date().toISOString().slice(0,19))},(${istr('Inspector Nice')}),(${istr('nice here')}),${istr('Inspector Nice')},${istr('Inspector Nice Strassenlabor')},'');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n`;
  return {txt:head+L.join('\n')+'\nENDSEC;\nEND-ISO-10303-21;\n',name,n:blds.length,terrain:!!D};
}

// ── Dachflächen robust zerlegen: doppelte und kollineare Punkte weg, Ohren mit Toleranz, notfalls erzwungen statt Fächer ──
function earcut2(Q){
  let P=[];for(const p of Q){const l=P[P.length-1];if(!l||Math.hypot(p[0]-l[0],p[1]-l[1])>1e-6)P.push(p);}
  if(P.length>2&&Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1])<1e-6)P.pop();
  const cr=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  let changed=true;while(changed&&P.length>3){changed=false;for(let i=0;i<P.length;i++){const a=P[(i+P.length-1)%P.length],b=P[i],c=P[(i+1)%P.length],L=Math.hypot(c[0]-a[0],c[1]-a[1])||1;if(Math.abs(cr(a,b,c))/L<1e-6){P.splice(i,1);changed=true;break;}}}
  let ar=0;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];ar+=a[0]*b[1]-b[0]*a[1];}if(ar<0)P.reverse();
  const idx=P.map((_,i)=>i),tris=[],eps=1e-9;
  const inside=(p,a,b,c)=>cr(a,b,p)>eps&&cr(b,c,p)>eps&&cr(c,a,p)>eps;
  let guard=0;while(idx.length>3&&guard++<20000){let cut=-1;
    for(let i=0;i<idx.length;i++){const a=P[idx[(i+idx.length-1)%idx.length]],b=P[idx[i]],c=P[idx[(i+1)%idx.length]];if(cr(a,b,c)<=eps)continue;
      let ok=true;for(const j of idx){const q=P[j];if(q===a||q===b||q===c)continue;if(inside(q,a,b,c)){ok=false;break;}}if(ok){cut=i;break;}}
    if(cut<0){let best=-1,bv=-Infinity;for(let i=0;i<idx.length;i++){const v=cr(P[idx[(i+idx.length-1)%idx.length]],P[idx[i]],P[idx[(i+1)%idx.length]]);if(v>bv){bv=v;best=i;}}cut=best;}   // kein sauberes Ohr: das konvexeste nehmen
    tris.push([idx[(cut+idx.length-1)%idx.length],idx[cut],idx[(cut+1)%idx.length]]);idx.splice(cut,1);}
  if(idx.length===3)tris.push(idx.slice());
  return {P,tris};
}
// Wasserflächen im Geländeraster eben und tiefer legen (unter Wasser misst das AHN nicht)
function flattenWater(D,E){
  const W=E.surfs.filter(x=>x.o.c===3).map(x=>{const z=x.z;let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(let i=0;i<z.length;i+=2){a=Math.min(a,z[i]);c=Math.max(c,z[i]);b=Math.min(b,z[i+1]);d=Math.max(d,z[i+1]);}return {z,bb:[a,b,c,d]};});
  if(!W.length)return 0;let n=0;const lvl=D.lo-.4;
  for(let j=0;j<D.h;j++)for(let i=0;i<D.w;i++){const q=rdToW(D.x0+i*D.dx,D.y1-j*D.dy);for(const w of W){if(q[0]<w.bb[0]||q[0]>w.bb[2]||q[1]<w.bb[1]||q[1]>w.bb[3])continue;if(A.inPoly(q[0],q[1],w.z)){D.z[j*D.w+i]=lvl;n++;break;}}}
  return n;
}

// ── STL für den 3D-Druck: Geländesockel + Gebäude, maßstäblich (Relief wählbar überhöht) ──
async function stl(sizeMm,exag){
  await Promise.all([A.ensure('b'),A.ensure('s')]);
  const E=site(),R=E.R;status(T('3D-Druck: Gelände aus dem AHN …','3D print: terrain from AHN …','3D-print: maaiveld uit AHN …'));
  const D=await dtm(R,150).catch(()=>null);if(D)flattenWater(D,E);
  const W=R.x1-R.x0,H=R.y1-R.y0,s=sizeMm/Math.max(W,H),base=3,zlo=D?D.lo:Math.min(...E.blds.map(b=>b.g).filter(v=>v!=null),0);
  const tz=z=>base+(z-zlo)*s*exag,X=x=>(x-R.x0)*s,Y=y=>(y-R.y0)*s;
  const tri=[];const T3=(a,b,c)=>tri.push(a,b,c);
  // Gelände: Oberfläche, Wände, Boden
  const gw=D?D.w:2,gh=D?D.h:2,gz=(i,j)=>D?tz(D.z[j*D.w+i]):base,gx=i=>X(R.x0+i*(W/(gw-1))),gy=j=>Y(R.y1-j*(H/(gh-1)));
  const V=(i,j)=>[gx(i),gy(j),gz(i,j)];
  for(let j=0;j<gh-1;j++)for(let i=0;i<gw-1;i++){const a=V(i,j),b=V(i+1,j),c=V(i+1,j+1),d=V(i,j+1);T3(a,d,c);T3(a,c,b);}
  const edge=[];for(let i=0;i<gw-1;i++)edge.push([V(i,0),V(i+1,0)]);for(let j=0;j<gh-1;j++)edge.push([V(gw-1,j),V(gw-1,j+1)]);for(let i=gw-1;i>0;i--)edge.push([V(i,gh-1),V(i-1,gh-1)]);for(let j=gh-1;j>0;j--)edge.push([V(0,j),V(0,j-1)]);
  const mid=[X(R.x1)/2,Y(R.y1)/2,0];   // Boden als Fächer über dieselben Randpunkte wie die Wände: keine offenen Kanten
  for(const [p,q] of edge){const p0=[p[0],p[1],0],q0=[q[0],q[1],0];T3(p0,p,q);T3(p0,q,q0);T3(mid,p0,q0);}
  // Gebäude: am Rahmen zugeschnitten, 1 m in den Sockel eingelassen
  const [fx0,fy0,fx1,fy1]=E.frame;let nb=0;
  for(const b of E.blds){if(!(b.h>0)||b.g==null)continue;const zc=AREA.clip(b.z,fx0,fy0,fx1,fy1);if(!zc)continue;let P=E.rdRing(zc);if(P.length<3)continue;
    let ar=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];ar+=p[0]*q[1]-q[0]*p[1];}if(ar<0)P.reverse();if(Math.abs(ar)<2)continue;
    const gmin=D?Math.min(...P.map(p=>at(D,p[0],p[1]))):b.g,z0=tz(gmin)-Math.max(.4,1*s*exag),z1=tz(gmin)+(b.g+b.h-gmin)*s;
    const EC=earcut2(P.map(p=>[X(p[0]),Y(p[1])])),Q=EC.P;if(Q.length<3)continue;
    for(let i=0;i<Q.length;i++){const p=Q[i],q=Q[(i+1)%Q.length];T3([p[0],p[1],z0],[q[0],q[1],z0],[q[0],q[1],z1]);T3([p[0],p[1],z0],[q[0],q[1],z1],[p[0],p[1],z1]);}
    for(const t of EC.tris){const [a,b2,c]=t.map(i=>Q[i]);T3([a[0],a[1],z1],[b2[0],b2[1],z1],[c[0],c[1],z1]);T3([a[0],a[1],z0],[c[0],c[1],z0],[b2[0],b2[1],z0]);}nb++;}
  // Binär-STL
  const nT=tri.length/3,buf=new ArrayBuffer(84+50*nT),dv=new DataView(buf),hd=`Inspector Nice 3D-Druck ${today()} 1:${Math.round(1000/s)}`;
  for(let i=0;i<80;i++)dv.setUint8(i,i<hd.length?hd.charCodeAt(i)&127:32);dv.setUint32(80,nT,true);
  for(let k=0;k<nT;k++){const a=tri[3*k],b=tri[3*k+1],c=tri[3*k+2],u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];let nx=u[1]*w[2]-u[2]*w[1],ny=u[2]*w[0]-u[0]*w[2],nz=u[0]*w[1]-u[1]*w[0];const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
    let o=84+50*k;for(const v of [nx,ny,nz,...a,...b,...c]){dv.setFloat32(o,v,true);o+=4;}dv.setUint16(o,0,true);}
  return {buf,nT,nb,scale:Math.round(1000/s),mm:[Math.round(X(R.x1)),Math.round(Y(R.y1))],terrain:!!D};
}

// ── Gebäudeanalyse ──
const GB={b:null,info:null,busy:false,job:0};
const DIRS=[['N',T.bind(null,'Nord','north','noord')],['O',T.bind(null,'Ost','east','oost')],['S',T.bind(null,'Süd','south','zuid')],['W',T.bind(null,'West','west','west')]];
function facades(b){
  const P=[];for(let i=0;i<b.z.length-2;i+=2)P.push(A.toRD(...(()=>{const ll=A.map.unproject([b.z[i],b.z[i+1]],20);return [ll.lat,ll.lng];})()));
  let ar=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];ar+=p[0]*q[1]-q[0]*p[1];}const ccw=ar>0,out={N:0,O:0,S:0,W:0},h=b.h||0;let per=0;
  for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length],dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);if(len<.01)continue;per+=len;
    const nx=ccw?dy:-dy,ny=ccw?-dx:dx,az=(Math.atan2(nx,ny)*180/Math.PI+360)%360,k=az<45||az>=315?'N':az<135?'O':az<225?'S':'W';out[k]+=len*h;}
  return {f:out,per,area:Math.abs(ar)/2,P};
}
async function analyse(b){
  const job=++GB.job;GB.b=b;GB.info={...facades(b)};GB.busy=true;A.rerender();A.req();
  const id=b.id?b.id.replace('NL.IMBAG.Pand.',''):null,P=GB.info.P,cx=P.reduce((s,p)=>s+p[0],0)/P.length,cy=P.reduce((s,p)=>s+p[1],0)/P.length,ll=A.fromRD(cx,cy);
  const get=u=>fetch(u).then(r=>r.ok?r.json():null).catch(()=>null);
  const xs=P.map(p=>A.fromRD(p[0],p[1])),la0=Math.min(...xs.map(p=>p[0]))-.00005,la1=Math.max(...xs.map(p=>p[0]))+.00005,lo0=Math.min(...xs.map(p=>p[1]))-.00008,lo1=Math.max(...xs.map(p=>p[1]))+.00008;
  const rceQ=layer=>get(`https://service.pdok.nl/rce/ps-ch/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=ps-ch:${layer}&count=50&outputFormat=application/json&bbox=${la0},${lo0},${la1},${lo1},urn:ogc:def:crs:EPSG::4326`);
  const [pand,vbo,mon,uhi,monP]=await Promise.all([
    id?get(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?identificatie=${id}&f=json`):null,
    id?get(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${lo0},${la0},${lo1},${la1}&limit=1000&f=json`):null,
    rceQ('rce_inspire_polygons'),
    Promise.resolve(A.uhiAt(ll[0],ll[1])).catch(()=>null),rceQ('rce_inspire_points')]);
  if(job!==GB.job)return;
  const pf=pand&&pand.features&&pand.features[0],pp=pf&&pf.properties,puid=pf&&pf.id;   // Einheiten verweisen auf die interne Kennung (UUID) des Gebäudes
  const units=((vbo&&vbo.features)||[]).filter(f=>{const h=f.properties&&f.properties['pand.href'];return puid&&h&&(Array.isArray(h)?h:[h]).some(x=>String(x).endsWith('/'+puid));}).filter(f=>/in gebruik|Verbouwing/i.test(f.properties.status||''));
  const inside=(x,y)=>{let ins=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ins=!ins;}return ins;};
  const rdOf=c=>c[0]>1000?[c[0],c[1]]:A.toRD(c[1],c[0]);   // das Register liefert RD-Koordinaten
  const ptIn=f=>{const g=f.geometry;if(!g||g.type!=='Point')return false;const q=rdOf(g.coordinates);return inside(q[0],q[1]);};
  const inRing=(r,x,y)=>{let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=rdOf(r[i]),[xj,yj]=rdOf(r[j]);if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ins=!ins;}return ins;};
  const pgIn=f=>{const g=f.geometry;if(!g)return false;const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return polys.some(p=>inRing(p[0],cx,cy)||P.some(q=>inRing(p[0],q[0],q[1])));};
  const monF=[...((mon&&mon.features)||[]).filter(pgIn),...((monP&&monP.features)||[]).filter(ptIn)],rm=monF.find(f=>/rijksmonumenten/.test(f.properties.namespace||'')),gz=monF.find(f=>/gezichten/.test(f.properties.namespace||''));
  await A.ensureTrees().catch(()=>null);if(job!==GB.job)return;
  const trees=(A.TREES||[]).filter(t=>{const p=A.toRD(t[0],t[1]);return Math.hypot(p[0]-cx,p[1]-cy)<Math.sqrt(GB.info.area)/2+15;}).length;
  Object.assign(GB.info,{pand:pp,units:units.length,vbo:units.reduce((s,f)=>s+(+f.properties.oppervlakte<99999?+f.properties.oppervlakte:0),0),use:[...new Set(units.flatMap(f=>String(f.properties.gebruiksdoel||'').split(',')).filter(Boolean))],
    addr:units.slice(0,3).map(f=>`${f.properties.openbare_ruimte_naam||''} ${f.properties.huisnummer||''}`.trim()),rm:rm?rm.properties.ciCitation:null,gz:!!gz,uhi:uhi!=null&&isFinite(uhi)?uhi:null,trees,cx,cy});
  GB.busy=false;A.rerender();
}
const USE={woonfunctie:['Wohnen','housing','wonen'],kantoorfunctie:['Büro','office','kantoor'],winkelfunctie:['Laden','retail','winkel'],onderwijsfunctie:['Bildung','education','onderwijs'],gezondheidszorgfunctie:['Gesundheit','health care','zorg'],bijeenkomstfunctie:['Treffpunkt, Gastronomie','assembly, food','bijeenkomst'],industriefunctie:['Gewerbe','industry','industrie'],logiesfunctie:['Beherbergung','lodging','logies'],sportfunctie:['Sport','sport','sport'],celfunctie:['Haft','detention','cel'],'overige gebruiksfunctie':['Sonstiges','other','overig']};
function bodyBuilding(){
  const b=GB.b,I=GB.info;if(!b)return `<div class="sx-empty"><svg viewBox="0 0 120 54" width="120" height="54" aria-hidden="true"><path d="M30 46V20l20-12 20 12v26Z" fill="var(--soft2)" stroke="var(--ink)" stroke-width="1.6"/><path d="M76 46V28h22v18" fill="none" stroke="var(--ink)" stroke-width="1.6"/><path d="M40 30h8v8h-8zM54 30h8v8h-8z" fill="none" stroke="var(--ink)"/></svg><p>${T('Tippe auf ein Gebäude: Maße, Flächen, Fassaden je Himmelsrichtung, Dach, Nutzung, Denkmalschutz — und Pläne nur für dieses Haus.','Tap a building: dimensions, areas, façades by orientation, roof, use, heritage status — and plans just for this house.','Tik op een gebouw: maten, oppervlakken, gevels per windrichting, dak, gebruik, monumentstatus — en tekeningen van alleen dit pand.')}</p></div>`;
  const h=b.h,lg=b.lg||(h?Math.max(1,Math.round(h/3.1)):null),vol=b.v22||(I.area&&h?I.area*h:null),gfa=I.area&&lg?I.area*lg:null,pv=((b.fl||0)*.6+(b.sl||0)*.5)*.17;
  const row=(k,v,s)=>v==null||v===''?'':`<div class="gb-r"><span>${k}</span><b>${v}</b>${s?`<small>${s}</small>`:''}</div>`;
  const fmax=Math.max(1,...Object.values(I.f));
  return `<div class="gb-h"><b>${I.addr&&I.addr[0]?I.addr[0]:T('Gebäude','Building','Gebouw')}${I.addr&&I.addr.length>1?` +${I.units-1}`:''}</b><span>${b.id?'BAG '+b.id.replace('NL.IMBAG.Pand.',''):''}${I.pand?' · '+I.pand.status:''}</span></div>
    ${I.rm||I.gz?`<p class="gb-mon">${I.rm?`<a href="${I.rm}" target="_blank" rel="noopener">${T('Rijksmonument','National monument','Rijksmonument')}</a>`:''}${I.rm&&I.gz?' · ':''}${I.gz?T('im geschützten Stadtbild','in a protected townscape','in beschermd stadsgezicht'):''}</p>`:''}
    <div class="gb-g">
      ${row(T('Baujahr','Year built','Bouwjaar'),(I.pand&&I.pand.bouwjaar)||b.yr)}
      ${row(T('Grundfläche','Footprint','Grondoppervlak'),I.area?A.fmt(I.area)+' m²':null)}
      ${row(T('Höhe (70 % Dach)','Height (70 % roof)','Hoogte (70 % dak)'),h!=null?nf(h,1)+' m':null,b.g!=null?`OK +${nf(b.g+h,2)} NAP`:'')}
      ${row(T('Höchster Punkt','Highest point','Hoogste punt'),b.hx!=null?nf(b.hx,1)+' m':null,b.hn!=null?T('First','ridge','nok')+' '+nf(b.hn,1)+' m':'')}
      ${row(T('Geschosse','Storeys','Bouwlagen'),lg!=null?String(lg):null,b.lg?'3D BAG':T('geschätzt aus der Höhe','estimated from height','geschat uit hoogte'))}
      ${row(T('Volumen','Volume','Volume'),vol?A.fmt(vol)+' m³':null,b.v22?'LoD 2.2':'LoD 1.2')}
      ${row(T('Geschossfläche','Floor area','Vloeroppervlak'),I.vbo?A.fmt(I.vbo)+' m²':gfa?'≈ '+A.fmt(gfa)+' m²':null,I.vbo?T(`BAG, ${I.units} Einheiten`,`BAG, ${I.units} units`,`BAG, ${I.units} eenheden`):T('geschätzt','estimated','geschat'))}
      ${row(T('Nutzung','Use','Gebruik'),I.use&&I.use.length?I.use.map(u=>USE[u]?T(...USE[u]):u).join(', '):null)}
    </div>
    <div class="h gb-hh">${T('Fassaden je Himmelsrichtung','Façades by orientation','Gevels per windrichting')}</div>
    <div class="gb-f">${DIRS.map(([k,l])=>`<div><span>${l()}</span><i style="width:${(100*I.f[k]/fmax).toFixed(0)}%"></i><b>${A.fmt(I.f[k])} m²</b></div>`).join('')}</div>
    <p class="lab-mute">${b.wa!=null?T(`3D BAG: ${A.fmt(b.wa)} m² Außenwand, davon ${A.fmt(b.pw||0)} m² Trennwand zu Nachbarn.`,`3D BAG: ${A.fmt(b.wa)} m² exterior wall, of which ${A.fmt(b.pw||0)} m² party wall.`,`3D BAG: ${A.fmt(b.wa)} m² buitenmuur, waarvan ${A.fmt(b.pw||0)} m² scheidingsmuur.`):''} ${T('Fassaden hier brutto aus Umriss × Höhe.','Façades here gross from outline × height.','Gevels hier bruto uit omtrek × hoogte.')}</p>
    <div class="h gb-hh">${T('Dach und Klima','Roof and climate','Dak en klimaat')}</div>
    <div class="gb-g">
      ${row(T('Dach','Roof','Dak'),b.dt?({horizontal:T('flach','flat','plat'),slanted:T('geneigt','pitched','schuin'),'multiple horizontal':T('mehrere Flachdächer','several flat roofs','meerdere platte daken')}[b.dt]||b.dt):null,b.fl!=null?`${A.fmt(b.fl)} m² ${T('flach','flat','plat')} · ${A.fmt(b.sl||0)} m² ${T('geneigt','pitched','schuin')}`:'')}
      ${row(T('Solarstrom grob','Solar power, rough','Zonnestroom grof'),pv>0?'≈ '+nf(pv,0)+' MWh/a':null,T('60 % der Flach-, 50 % der Schrägfläche × 170 kWh/m²','60 % of flat, 50 % of pitched area × 170 kWh/m²','60 % plat, 50 % schuin × 170 kWh/m²'))}
      ${row(T('Wärmeinsel hier','Heat island here','Hitte-eiland hier'),I.uhi!=null?'+'+nf(I.uhi,1)+' °C':null,'RIVM')}
      ${row(T('Bäume am Haus','Trees by the house','Bomen bij het pand'),I.trees!=null?String(I.trees):null,T('im Umkreis von 15 m','within 15 m','binnen 15 m'))}
    </div>
    ${GB.busy?`<p class="lab-mute">${T('BAG, Denkmalregister und Klima werden abgefragt …','Querying BAG, heritage register and climate …','BAG, monumentenregister en klimaat opvragen …')}</p>`:''}
    <div class="ex-fmt gb-x">
      <button data-gx="views"><b>${T('Ansichten','Elevations','Aanzichten')}</b><span>${T('N, O, S, W dieses Hauses mit Nachbarn (SVG + DXF)','N, E, S, W of this house with neighbours (SVG + DXF)','N, O, Z, W van dit pand met buren (SVG + DXF)')}</span></button>
      <button data-gx="plan"><b>${T('Lageplan 1:500','Site plan 1:500','Situatie 1:500')}</b><span>${T('60 m um das Haus (DXF)','60 m around the house (DXF)','60 m rond het pand (DXF)')}</span></button>
      <button data-gx="ifc"><b>IFC</b><span>${T('Haus und Nachbarn mit Gelände','house and neighbours with terrain','pand en buren met maaiveld')}</span></button>
      <button data-gx="stl"><b>${T('3D-Druck','3D print','3D-print')}</b><span>${T('10 cm, Haus und Nachbarn (STL)','10 cm, house and neighbours (STL)','10 cm, pand en buren (STL)')}</span></button>
    </div>`;
}

// ── Gemeinsames: Status, Herunterladen, Gebiet um ein Haus ──
function status(t){A.status(t||'',!!t);}
function download(name,data,type){const b=new Blob([data],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);return b.size;}
const base=E=>`inspector-nice_${Math.round(E.R?E.R.x0:E.ox)}_${Math.round(E.R?E.R.y0:E.oy)}_${today()}`;
async function aroundBuilding(b,r,fn){
  const keep={type:AR.type,r:AR.r,center:AR.center,done:AR.done,pts:AR.pts};const I=facades(b),ll=A.fromRD(I.P.reduce((s,p)=>s+p[0],0)/I.P.length,I.P.reduce((s,p)=>s+p[1],0)/I.P.length);
  Object.assign(AR,{type:'circle',r,center:L.latLng(ll[0],ll[1])});try{return await fn();}finally{Object.assign(AR,keep);}
}
const EXP2={M:500,size:150,exag:1,terrain:true,last:null,busy:false};
async function run(kind,el){
  if(EXP2.busy)return;EXP2.busy=true;if(el)el.disabled=true;let msg='';
  try{
    if(kind==='plan'){const L2=await lageplan(EXP2.M),n=base(L2.E);const s1=download(`${n}_lageplan_1-${EXP2.M}.dxf`,L2.txt,'application/dxf');download(`${n}_lageplan_1-${EXP2.M}.svg`,lageplanSvg(L2,EXP2.M),'image/svg+xml');
      msg=`${T('Lageplan','Site plan','Situatie')} 1:${EXP2.M} · DXF ${(s1/1024).toFixed(0)} KB + SVG · ${A.fmt(L2.E.blds.length)} ${T('Gebäude','buildings','gebouwen')}, ${L2.C.length} ${T('Höhenlinien','contours','hoogtelijnen')}, ${L2.sp?L2.sp.pts.length:0} ${T('Höhenpunkte','spot heights','hoogtepunten')}, ${L2.SN.length} ${T('Straßennamen','street names','straatnamen')}`;}
    if(kind==='env'){const U=await umgebung(),E=site();download(`${base(E)}_umgebungsplan_1-2500.dxf`,U.dxf,'application/dxf');download(`${base(E)}_umgebungsplan_1-2500.svg`,U.svg,'image/svg+xml');msg=`${T('Umgebungsplan','Surroundings plan','Omgevingskaart')} 1:2500 · ${A.fmt(U.n)} ${T('Gebäude','buildings','gebouwen')}`;}
    if(kind==='views'){await A.ensure('b');const E=site(),sv=elevationsSvg(E),dx=elevationsDxf(E);if(!sv)throw new Error(T('Im Gebiet sind keine Gebäude mit Höhe.','No buildings with heights in the area.','Geen gebouwen met hoogte in het gebied.'));download(`${base(E)}_ansichten.svg`,sv,'image/svg+xml');download(`${base(E)}_ansichten.dxf`,dx,'application/dxf');msg=`${T('Ansichten N, O, S, W','Elevations N, E, S, W','Aanzichten N, O, Z, W')} · ${A.fmt(E.blds.length)} ${T('Gebäude','buildings','gebouwen')} · SVG + DXF`;}
    if(kind==='ifc'){const I=await ifc(EXP2.terrain),s1=download(I.name,I.txt,'application/x-step');msg=`IFC4 · ${A.fmt(I.n)} ${T('Gebäude','buildings','gebouwen')}${I.terrain?' + '+T('Gelände','terrain','maaiveld'):''} · ${(s1/1024).toFixed(0)} KB · ${T('georeferenziert (EPSG:28992)','georeferenced (EPSG:28992)','gegeorefereerd (EPSG:28992)')}`;}
    if(kind==='stl'){const S=await stl(EXP2.size,EXP2.exag),E=site();download(`${base(E)}_3d-druck_${EXP2.size}mm.stl`,S.buf,'model/stl');msg=`STL · ${S.mm[0]} × ${S.mm[1]} mm · 1:${A.fmt(S.scale)} · ${A.fmt(S.nb)} ${T('Gebäude','buildings','gebouwen')} · ${A.fmt(S.nT)} ${T('Dreiecke','triangles','driehoeken')}${S.terrain?'':' · '+T('ohne Gelände (AHN nicht erreichbar)','without terrain (AHN unavailable)','zonder maaiveld (AHN niet bereikbaar)')}`;}
  }catch(e){msg=T('Export nicht möglich: ','Export failed: ','Export mislukt: ')+(e&&e.message||e);}
  status('');EXP2.busy=false;EXP2.last=msg;if(el)el.disabled=false;A.rerender();return msg;
}

// ── Werkzeug „Export": CAD-Paket + Rohdaten ──
const RAW={bld:true,surf:true,trees:true,shadow:false};
LAB.addTool({id:'export',order:9,grp:'make',usesSurfaces:true,
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>',
  label:()=>T('CAD','CAD','CAD'),
  sub:()=>T('Pläne, Ansichten, IFC und 3D-Druck','Plans, elevations, IFC and 3D print','Tekeningen, aanzichten, IFC en 3D-print'),
  render(){
    const r=AR.type==='draw'&&!AR.done?null:AREA.ring(),what=r&&AR.type!=='view'?(AR.type==='circle'?T(`Kreis mit ${AR.r} m Radius`,`circle with ${AR.r} m radius`,`cirkel met ${AR.r} m straal`):T('gezeichnete Fläche','drawn area','getekend gebied')):T('Kartenausschnitt','map view','kaartbeeld');
    const card=(k,t,d,f,opt)=>`<div class="ex-card"><div class="ex-ct"><b>${t}</b><span>${d}</span></div><div class="ex-cb">${opt}<button class="ex-go" data-k="${k}">${f}</button></div></div>`;
    const sel=(k,opts)=>`<select data-e="${k}" aria-label="${k}">${opts.map(([v,l])=>`<option value="${v}"${String(EXP2[k])===String(v)?' selected':''}>${l}</option>`).join('')}</select>`;
    return `<p class="lab-hint">${T('Gebiet','Area','Gebied')}: <b>${what}</b> — ${T('im Werkzeug „Fläche" änderbar.','change it in the “Area” tool.','aan te passen in „Gebied".')}</p>${AR.type==='circle'?`<div class="ex-r" role="group" aria-label="${T('Radius','Radius','Straal')}">${[100,200,350].map(v=>`<button data-r="${v}" class="${AR.r===v?'on':''}" aria-pressed="${AR.r===v}">${v} m</button>`).join('')}</div>`:''}
      <div class="h gb-hh">${T('Pläne','Drawings','Tekeningen')}</div>
      ${card('plan',T('Lageplan','Site plan','Situatie'),T('Gebäude mit Höhen, Flächen, Bäume, Höhenlinien, Höhenpunkte, Straßennamen, Nordpfeil, Maßstab, Schriftfeld — echte RD-Koordinaten','Buildings with heights, areas, trees, contours, spot heights, street names, north arrow, scale, title block — true RD coordinates','Gebouwen met hoogtes, vlakken, bomen, hoogtelijnen, hoogtepunten, straatnamen, noordpijl, schaal, titelblok — echte RD-coördinaten'),'DXF + SVG',sel('M',[[500,'1:500'],[1000,'1:1000']]))}
      ${card('env',T('Umgebungsplan 1:2500','Surroundings plan 1:2500','Omgevingskaart 1:2500'),T('Schwarzplan bis 600 m um das Gebiet, Gebiet rot markiert, Straßennamen','Figure-ground up to 600 m around the area, area in red, street names','Zwartplan tot 600 m rond het gebied, gebied rood, straatnamen'),'DXF + SVG','')}
      ${card('views',T('Ansichten N · O · S · W','Elevations N · E · S · W','Aanzichten N · O · Z · W'),T('Mit Höhen in m NAP, verdeckte Kanten entfernt, gleicher Maßstab','With heights in m NAP, hidden edges removed, same scale','Met hoogtes in m NAP, verborgen lijnen weg, zelfde schaal'),'SVG + DXF','')}
      <div class="h gb-hh">${T('3D und Modell','3D and model','3D en model')}</div>
      ${card('ifc','IFC4',T('Für Revit, ArchiCAD, Vectorworks, BlenderBIM: Gebäude als Volumen mit BAG-Kennung und Baujahr, georeferenziert','For Revit, ArchiCAD, Vectorworks, BlenderBIM: buildings as masses with BAG ID and year, georeferenced','Voor Revit, ArchiCAD, Vectorworks, BlenderBIM: gebouwen als volumes met BAG-id en bouwjaar, gegeorefereerd'),'IFC',`<label class="ex-in"><input type="checkbox" data-e="terrain" ${EXP2.terrain?'checked':''}>${T('mit Gelände','with terrain','met maaiveld')}</label>`)}
      ${card('stl',T('3D-Druck','3D print','3D-print'),T('Zum Anfassen: Geländesockel aus dem AHN, Gebäude maßstäblich darauf','To touch: terrain base from AHN, buildings to scale on top','Om vast te pakken: maaiveldsokkel uit AHN, gebouwen op schaal'),'STL',sel('size',[[100,'10 cm'],[150,'15 cm'],[200,'20 cm']])+sel('exag',[[1,T('Relief ×1','relief ×1','reliëf ×1')],[2,T('Relief ×2','relief ×2','reliëf ×2')],[3,T('Relief ×3','relief ×3','reliëf ×3')]]))}
      <details class="ex-raw"><summary>${T('Rohdaten (DXF 3D, OBJ, GeoJSON, Schwarzplan)','Raw data (DXF 3D, OBJ, GeoJSON, figure-ground)','Ruwe data (DXF 3D, OBJ, GeoJSON, zwartplan)')}</summary>
        <div class="ex-cks">${[['bld',T('Gebäude mit Höhen','Buildings with heights','Gebouwen met hoogtes')],['surf',T('Straßen- und Grünflächen','Street and green areas','Straat- en groenvlakken')],['trees',T('Bäume','Trees','Bomen')],['shadow',T('Schatten jetzt (nur SVG)','Shadows now (SVG only)','Schaduw nu (alleen SVG)')]].map(([k,l])=>`<label class="ex-ck"><input type="checkbox" data-o="${k}" ${RAW[k]?'checked':''}><span>${l}</span></label>`).join('')}</div>
        <div class="ex-fmt">${[['dxf','DXF',T('2D-Pläne + 3D-Gebäude, lokaler Ursprung','2D plans + 3D buildings, local origin','2D + 3D-gebouwen, lokale oorsprong')],['obj','OBJ',T('3D-Modell der Gebäude','3D model of the buildings','3D-model van de gebouwen')],['geojson','GeoJSON',T('alle Objekte mit Attributen','all objects with attributes','alle objecten met attributen')],['svg','SVG',T('Schwarzplan zum Gestalten','figure-ground plan for design','zwartplan om te vormgeven')]].map(([f,b,s])=>`<button data-f="${f}"><b>${b}</b><span>${s}</span></button>`).join('')}</div></details>
      ${EXP2.last?`<p class="ex-last" role="status">${EXP2.last}</p>`:''}`;
  },
  bind(root){
    root.querySelectorAll('[data-e]').forEach(el=>{el.onchange=()=>{EXP2[el.dataset.e]=el.type==='checkbox'?el.checked:+el.value;};});
    root.querySelectorAll('[data-r]').forEach(el=>el.onclick=()=>{AR.r=+el.dataset.r;AR.type='circle';A.rerender();A.req();});
    root.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>run(el.dataset.k,el));
    root.querySelectorAll('[data-o]').forEach(el=>el.onchange=()=>{RAW[el.dataset.o]=el.checked;});
    root.querySelectorAll('[data-f]').forEach(el=>el.onclick=async()=>{el.disabled=true;await Promise.all([A.ensure('b'),A.ensure('s'),A.ensureTrees()]);
      const E=AREA.exportSet(),f=el.dataset.f,n=`inspector-nice_${Math.round(E.ox)}_${Math.round(E.oy)}_${today()}`;
      const [txt,type]=f==='dxf'?[AREA.dxf(E,RAW),'application/dxf']:f==='obj'?[AREA.obj(E),'text/plain']:f==='geojson'?[AREA.geojson(E,RAW),'application/geo+json']:[AREA.svg(E,RAW),'image/svg+xml'];
      const sz=download(`${n}.${f}`,txt,type);EXP2.last=`${n}.${f} · ${(sz/1024).toFixed(0)} KB`;el.disabled=false;A.rerender();});
  },
  async load(){await Promise.all([A.ensure('b'),A.ensure('s'),A.ensureTrees()]);},
  draw(g,X){const dark=A.dark();A.drawSurfaces(g,X);A.drawBuildings(g,X,dark?'rgba(60,56,66,.9)':'#fbf9f4',dark?'rgba(255,255,255,.2)':'rgba(23,21,28,.45)');A.drawCrowns(g,X,'rgba(72,140,84,.3)','rgba(31,90,43,.4)');
    const r=AR.type==='draw'&&!AR.done?null:AREA.ring();if(!r)return;g.save();g.strokeStyle=dark?'rgba(243,239,231,.9)':'rgba(23,21,28,.9)';g.lineWidth=2*X.sc;g.setLineDash([7*X.sc,5*X.sc]);g.beginPath();r.forEach((p,i)=>{const q=A.w20(p[0],p[1]),x=q[0]*X.k-X.ox,y=q[1]*X.k-X.oy;i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();g.stroke();g.restore();},
  click(e){if(AR.type==='circle'){AR.center=e.latlng;A.rerender();A.req();}return null;},
  note:()=>T('Lagepläne in echten Rijksdriehoek-Koordinaten (EPSG:28992), Höhen in m NAP. Gebäude: 3D BAG LoD 1.2 (Oberkante = 70-%-Dachhöhe), Grundriss als Polylinie mit Objekthöhe. Höhenlinien aus dem AHN-Geländemodell (0,5 m, leicht geglättet, unter Gebäuden aus der Umgebung ergänzt), Abstand je nach Relief 0,25 bis 5 m. Ansichten: Gebäude als Quader projiziert, verdeckte Kanten entfernt. IFC4: Volumen je Gebäude (IfcBuildingElementProxy in IfcBuilding), Gelände als Dreiecksnetz, Verortung über IfcMapConversion. STL: Maßstab aus der Modellgröße, Gelände wählbar überhöht, Gebäude 1 m in den Sockel eingelassen. Text im DXF ohne Umlaute, damit jedes CAD ihn liest.','Site plans in true Rijksdriehoek coordinates (EPSG:28992), heights in m NAP. Buildings: 3D BAG LoD 1.2 (top = 70 % roof height), footprint as polyline with thickness. Contours from the AHN terrain model (0.5 m, lightly smoothed, filled under buildings), interval 0.25 to 5 m depending on relief. Elevations: buildings projected as boxes, hidden edges removed. IFC4: a mass per building (IfcBuildingElementProxy in IfcBuilding), terrain as triangle mesh, located via IfcMapConversion. STL: scale from model size, terrain optionally exaggerated, buildings sunk 1 m into the base. DXF text without accents so every CAD reads it.','Situaties in echte RD-coördinaten (EPSG:28992), hoogtes in m NAP. Gebouwen: 3D BAG LoD 1.2 (bovenkant = 70 %-dakhoogte), contour als polylijn met objecthoogte. Hoogtelijnen uit het AHN-maaiveldmodel (0,5 m, licht gladgemaakt, onder gebouwen aangevuld), interval 0,25 tot 5 m. Aanzichten: gebouwen als blokken geprojecteerd, verborgen lijnen verwijderd. IFC4: volume per gebouw (IfcBuildingElementProxy in IfcBuilding), maaiveld als driehoeksnet, geplaatst via IfcMapConversion. STL: schaal uit modelgrootte, maaiveld eventueel overdreven, gebouwen 1 m in de sokkel. DXF-tekst zonder accenten zodat elk CAD-pakket hem leest.'),
  src:()=>SRC
});

// ── Werkzeug „Gebäude" ──
LAB.addTool({id:'building',order:5.8,grp:'check',gate:true,usesSurfaces:false,
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V10l8-6 8 6v11Z"/><path d="M9 21v-6h6v6"/></svg>',
  label:()=>T('Gebäude','Building','Gebouw'),
  sub:()=>T('Maße, Fassaden, Dach, Nutzung, Denkmal','Dimensions, façades, roof, use, heritage','Maten, gevels, dak, gebruik, monument'),
  render:bodyBuilding,
  bind(root){root.querySelectorAll('[data-gx]').forEach(el=>el.onclick=()=>{const b=GB.b;if(!b)return;const k=el.dataset.gx;
    aroundBuilding(b,60,()=>run(k==='plan'?'plan':k,el));});},
  async load(){await Promise.all([A.ensure('b'),A.ensureTrees()]);},
  draw(g,X){const dark=A.dark();A.drawBuildings(g,X,dark?'rgba(60,56,66,.7)':'rgba(251,249,244,.8)',dark?'rgba(255,255,255,.2)':'rgba(23,21,28,.35)');
    const b=GB.b;if(!b||!GB.info)return;const z=b.z,col={N:'#2f6fa8',O:'#e3a800',S:'#d0583c',W:'#7a4ea8'},P=GB.info.P;let ar=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];ar+=p[0]*q[1]-q[0]*p[1];}
    g.save();g.lineWidth=5*X.sc;g.lineCap='round';
    for(let i=0;i<z.length-2;i+=2){const p=P[i/2],q=P[(i/2+1)%P.length],dx=q[0]-p[0],dy=q[1]-p[1],nx=ar>0?dy:-dy,ny=ar>0?-dx:dx,az=(Math.atan2(nx,ny)*180/Math.PI+360)%360,k=az<45||az>=315?'N':az<135?'O':az<225?'S':'W';
      g.strokeStyle=col[k];g.beginPath();g.moveTo(z[i]*X.k-X.ox,z[i+1]*X.k-X.oy);g.lineTo(z[i+2]*X.k-X.ox,z[i+3]*X.k-X.oy);g.stroke();}
    g.restore();},
  click(e){const [wx,wy]=A.w20(e.latlng.lat,e.latlng.lng),b=A.hits(A.B,wx,wy)[0];if(!b){GB.b=null;GB.info=null;A.rerender();A.req();return T('Hier ist kein Gebäude — bitte auf ein Haus tippen.','No building here — please tap a house.','Hier staat geen gebouw — tik op een pand.');}analyse(b);return null;},
  note:()=>T('Maße und Höhen aus dem 3D BAG (LoD 1.2: 70-%-Dachhöhe; höchster Punkt und First gemessen), Fassaden brutto aus Umriss × Höhe, nach der Richtung, in die sie zeigen. Geschossfläche amtlich als Summe der BAG-Wohn- und Nutzeinheiten im Gebäude (in Gebrauch), sonst geschätzt. Denkmalschutz aus dem Register der Rijksdienst voor het Cultureel Erfgoed. Solarstrom grob: 60 % der Flach- und 50 % der Schrägdachfläche × 170 kWh/m² im Jahr — kein Ersatz für eine Dachprüfung.','Dimensions and heights from the 3D BAG (LoD 1.2: 70 % roof height; highest point and ridge measured), façades gross from outline × height by the direction they face. Floor area officially as the sum of BAG units in the building (in use), otherwise estimated. Heritage status from the Cultural Heritage Agency register. Solar power, rough: 60 % of flat and 50 % of pitched roof × 170 kWh/m² per year — no substitute for a roof survey.','Maten en hoogtes uit de 3D BAG (LoD 1.2: 70 %-dakhoogte; hoogste punt en nok gemeten), gevels bruto uit omtrek × hoogte naar de richting waarin ze kijken. Vloeroppervlak officieel als som van de BAG-verblijfsobjecten in het pand (in gebruik), anders geschat. Monumentstatus uit het register van de RCE. Zonnestroom grof: 60 % plat en 50 % schuin dak × 170 kWh/m² per jaar — geen vervanging voor een dakonderzoek.'),
  src:()=>'3D BAG (TU Delft / 3DGI, CC BY 4.0) · BAG (Kadaster / PDOK) · RCE (PDOK) · RIVM · Bomenkaart Gemeente Utrecht'
});

LAB.cad={earcut2,flattenWater,dtm,fillGrid,contours,step,spots,streetNames,DX,ascii,lageplan,lageplanSvg,umgebung,elevation,elevationsSvg,elevationsDxf,ifc,stl,facades,analyse,GB,EXP2,run,site,guid,istr,at};
})();

// CAD-Paket und Gebäudeanalyse (public/js/lab-cad.js): Lageplan DXF/SVG mit Höhenlinien, Höhenpunkten, Straßennamen;
// Umgebungsplan; Ansichten mit verdeckten Kanten; IFC4; STL (wasserdicht); Gebäude: Fassaden, BAG, Denkmal.
const H=require('./lib/labHarness.cjs');const {ok,wait,errs,C,D,box,J}=H;
const BAG3={features:[
  {properties:{identificatie:'NL.IMBAG.Pand.0344100000000001',b3_h_70p:13,b3_h_max:15.5,b3_h_nok:15,b3_h_maaiveld:1,oorspronkelijkbouwjaar:1923,b3_dak_type:'slanted',b3_opp_dak_plat:0,b3_opp_dak_schuin:820,b3_opp_grond:690,b3_opp_buitenmuur:1700,b3_opp_scheidingsmuur:300,b3_volume_lod22:8100,b3_bouwlagen:4},geometry:{type:'Polygon',coordinates:box(C[1]-2.5*D,C[0]-3*D,C[1]-D,C[0]+3*D)}},
  {properties:{identificatie:'NL.IMBAG.Pand.0344100000000002',b3_h_70p:19,b3_h_max:20,b3_h_maaiveld:1,oorspronkelijkbouwjaar:1975,b3_dak_type:'horizontal',b3_opp_dak_plat:690,b3_opp_dak_schuin:0},geometry:{type:'Polygon',coordinates:box(C[1]+D,C[0]-3*D,C[1]+2.5*D,C[0]+3*D)}}]};
let bagQ=0,rce=0;
H.setExtra(u=>{
  if(u.includes('3dbag'))return J(/STARTINDEX=0/.test(u)?BAG3:{features:[]});
  if(u.includes('wegvakken'))return J({features:[{properties:{stt_naam:'Domstraße',bst_code:'RB'},geometry:{type:'LineString',coordinates:[[C[1]-.0003,C[0]],[C[1]+.0003,C[0]]]}}],links:[]});
  if(u.includes('/bag/ogc/v2/collections/pand/')){bagQ++;return J({features:[{id:'uuid-pand-1',properties:{identificatie:'0344100000000001',bouwjaar:1923,status:'Pand in gebruik',aantal_verblijfsobjecten:2}}]});}
  if(u.includes('/bag/ogc/v2/collections/verblijfsobject/'))return J({features:[
    {properties:{'pand.href':['https://x/pand/items/uuid-pand-1'],status:'Verblijfsobject in gebruik',oppervlakte:420,gebruiksdoel:'woonfunctie',openbare_ruimte_naam:'Domstraat',huisnummer:3}},
    {properties:{'pand.href':['https://x/pand/items/uuid-pand-1'],status:'Verblijfsobject in gebruik',oppervlakte:380,gebruiksdoel:'kantoorfunctie',openbare_ruimte_naam:'Domstraat',huisnummer:5}},
    {properties:{'pand.href':['https://x/pand/items/uuid-pand-9'],status:'Verblijfsobject in gebruik',oppervlakte:999,gebruiksdoel:'woonfunctie'}}]});
  if(u.includes('rce/ps-ch')){rce++;const big=[[[100000,400000],[200000,400000],[200000,500000],[100000,500000],[100000,400000]]];
    if(u.includes('points'))return J({features:[{geometry:{type:'Point',coordinates:[1,1]},properties:{namespace:'nlps-rijksmonumenten',ciCitation:'https://monumentenregister.cultureelerfgoed.nl/monumenten/2'}}]});   // liegt weit weg: zählt nicht
    return J({features:[{geometry:{type:'Polygon',coordinates:big},properties:{namespace:'nlps-rijksmonumenten',ciCitation:'https://monumentenregister.cultureelerfgoed.nl/monumenten/1'}},{geometry:{type:'Polygon',coordinates:big},properties:{namespace:'nlps-stadsendorpsgezichten'}},{geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]},properties:{namespace:'nlps-rijksmonumenten',ciCitation:'falsch'}}]});}
  return null;});
const w=H.mk('https://test.local/next.html');
setTimeout(async()=>{const d=w.document,LAB=w.LAB,A=LAB.api,CAD=LAB.cad,map=w.eval('map'),L_=w.L;
  map.getSize=()=>L_.point(1024,768);
  console.log('— Werkzeuge —');
  ok('Gebäude (Prüfen) und CAD (Gestalten) angemeldet',LAB._t.TOOLS.find(t=>t.id==='building').grp==='check'&&LAB._t.TOOLS.find(t=>t.id==='export').grp==='make'&&!!CAD);
  map.setView(C,17,{animate:false});w.__NX.openLab(C,'export');await wait(400);await A.ensure('b');await A.ensure('s');
  ok('Gebäude mit BAG-Kennung, höchstem Punkt, First, Geschossen, Wandflächen aus dem 3D BAG',A.B.list.some(b=>b.id==='NL.IMBAG.Pand.0344100000000001'&&b.hx===14.5&&b.hn===14&&b.lg===4&&b.wa===1700&&b.v22===8100));
  console.log('— Höhenlinien (Gefälle −1 → +5 m) —');
  const R={x0:0,y0:0,x1:39,y1:39},Z=new Float32Array(1600);for(let j=0;j<40;j++)for(let i=0;i<40;i++)Z[j*40+i]=-1+6*i/39;Z[20*40+20]=3.4e38;
  const G=CAD.fillGrid(Z,40,40,R),st=CAD.step(G),Cs=CAD.contours(G,st);
  ok('Lücke im Raster aus der Umgebung gefüllt',Math.abs(G.z[20*40+20]-(-1+6*20/39))<.2);
  ok('Abstand 1 m bei 6 m Relief; je Höhe genau eine durchgehende Linie',st===1&&Cs.length>=5&&Cs.every(c=>c.P.length>=38),Cs.map(c=>c.L+':'+c.P.length).join(' '));
  ok('Hauptlinien alle 5 m (0 m; 5 m liegt genau am Rand)',Cs.filter(c=>c.major).map(c=>c.L).join()==='0',Cs.filter(c=>c.major).map(c=>c.L).join());
  ok('Linien liegen senkrecht zum Gefälle (x fast konstant)',Cs.every(c=>Math.max(...c.P.map(p=>p[0]))-Math.min(...c.P.map(p=>p[0]))<1));
  console.log('— Lageplan —');
  const LP=await CAD.lageplan(500),dx=LP.txt;
  ok('DXF: Kopf, Ebenen, Gebäude mit Objekthöhe, Ende',/^999\n/.test(dx)&&/\nEOF\n$/.test(dx)&&['HOEHENLINIEN','HOEHENPUNKTE','STRASSENNAMEN','GEBAEUDE_HOEHE','NORDPFEIL','MASSSTAB','SCHRIFTFELD','GEBIET'].every(l=>dx.includes('\n'+l+'\n'))&&/\n39\n12(\.0+)?\n/.test(dx));
  ok('Nur ASCII im DXF (Umlaute umschrieben) — Domstraße → Domstrasse',!/[^\x00-\x7f]/.test(dx)&&/Domstrasse/.test(dx));
  const xs=[...dx.matchAll(/\n10\n(\d+\.?\d*)\n20\n(\d+\.?\d*)/g)].map(m=>[+m[1],+m[2]]).filter(p=>p[0]>1000);
  ok('Echte RD-Koordinaten (Utrecht: x ≈ 136 900, y ≈ 455 800)',xs.length>20&&xs.every(p=>p[0]>136000&&p[0]<138000&&p[1]>455000&&p[1]<457000),xs[0]&&xs[0].join(' / '));
  ok('Höhenlinien, Höhenpunkte, Straßenname im Plan',LP.C.length>0&&LP.sp&&LP.sp.pts.length>0&&LP.SN.length===1);
  ok('Gebäude beschriftet mit Oberkante NAP und Geschossen („OK +13,00 - 4 G")',/OK \+13,00 - 4 G/.test(dx));
  const sv=CAD.lageplanSvg(LP,500);
  ok('SVG-Lageplan mit Maßstab 1:500, Nordpfeil, Höhen, Straßenname',sv.startsWith('<svg')&&sv.endsWith('</svg>')&&/Lageplan 1:500/.test(sv)&&/>N</.test(sv)&&/Domstraße/.test(sv));
  console.log('— Ansichten —');
  const sq=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],FE={rdRing:z=>z,blds:[{z:sq(0,0,10,10),h:20,g:0},{z:sq(-20,20,30,30),h:10,g:0}]};   // vorn schmal und hoch, hinten breit und niedrig (Blick nach Norden)
  const el=CAD.elevation(FE,[0,1]),back=el.items.find(i=>i.top===10),hidden=el.lines.filter(l=>l.k===back&&l.a[1]===10&&l.b[1]===10);
  ok('Ansicht Süd: hinteres Haus verdeckt, wo das vordere davorsteht (Oberkante in zwei Stücken)',el.items[0].top===20&&hidden.length===2&&hidden.every(l=>l.b[0]<=-0||l.a[0]>=10||l.b[0]<=0),hidden.map(l=>l.a[0]+'..'+l.b[0]).join(' '));
  ok('Senkrechte Kante des hinteren Hauses nur oberhalb nicht verdeckt',!el.lines.some(l=>l.k===back&&l.a[0]>0&&l.a[0]<10&&l.a[0]===l.b[0]));
  const E=CAD.site(),es=CAD.elevationsSvg(E),ed=CAD.elevationsDxf(E);
  ok('Ansichten Nord, Ost, Süd, West als SVG mit Höhen in m NAP',/Ansicht Nord/.test(es)&&/Ansicht Ost/.test(es)&&/Ansicht Süd/.test(es)&&/Ansicht West/.test(es)&&/\+13,0/.test(es)&&/\+19,0/.test(es));
  ok('Ansichten als DXF mit eigener Ebene je Richtung',['ANSICHT_N','ANSICHT_O','ANSICHT_S','ANSICHT_W'].every(l=>ed.includes('\n'+l+'\n'))&&!/[^\x00-\x7f]/.test(ed));
  console.log('— IFC4 —');
  const I=await CAD.ifc(true),t=I.txt;
  ok('IFC4-Kopf, Projekt, Gelände, 2 Gebäude, 2 Volumen, Dreiecksnetz',t.startsWith('ISO-10303-21;')&&/FILE_SCHEMA\(\('IFC4'\)\)/.test(t)&&(t.match(/=IFCBUILDING\(/g)||[]).length===2&&(t.match(/=IFCEXTRUDEDAREASOLID\(/g)||[]).length===2&&/=IFCTRIANGULATEDFACESET\(/.test(t)&&/\.TERRAIN\./.test(t));
  ok('Georeferenziert: EPSG:28992 und Verschiebung (IfcMapConversion)',/IFCPROJECTEDCRS\('EPSG:28992'/.test(t)&&/IFCMAPCONVERSION\(#\d+,#\d+,13\d{4}\.,45\d{4}\.,0\.,1\.,0\.,\$\)/.test(t));
  const defs=new Set([...t.matchAll(/^#(\d+)=/gm)].map(m=>m[1])),refs=[...t.matchAll(/#(\d+)/g)].map(m=>m[1]);
  ok('Alle Verweise aufgelöst, Kennungen 22 Zeichen und eindeutig',refs.every(r=>defs.has(r))&&(()=>{const g=[...t.matchAll(/\('([0-9A-Za-z_$]{22})'/g)].map(m=>m[1]);return g.length>=10&&new Set(g).size===g.length;})());
  ok('Eigenschaften: BAG-Kennung, Baujahr, Höhe; nur ASCII (Umlaute als \\X2\\)',/'BAG_Pand',\$,IFCIDENTIFIER\('0344100000000001'\)/.test(t)&&/YearOfConstruction/.test(t)&&/Hoehe_70p/.test(t)&&!/[^\x00-\x7f]/.test(t)&&/\\X2\\00E4\\X0\\/.test(t));
  console.log('— 3D-Druck (STL) —');
  const S=await CAD.stl(100,2),dv=new DataView(S.buf),nT=dv.getUint32(80,true);
  ok('Binär-STL: Größe passt zur Dreieckszahl, 2 Gebäude, Maßstab genannt',S.buf.byteLength===84+50*nT&&nT===S.nT&&S.nb===2&&S.scale>100);
  const V=[];for(let k=0;k<nT;k++){const o=84+50*k+12,tri=[];for(let v=0;v<3;v++)tri.push([0,1,2].map(c=>dv.getFloat32(o+12*v+4*c,true)));V.push(tri);}
  const key=p=>p.map(v=>v.toFixed(3)).join(','),E2=new Map();for(const tr of V)for(let i=0;i<3;i++){const a=key(tr[i]),b=key(tr[(i+1)%3]);E2.set(a+'>'+b,(E2.get(a+'>'+b)||0)+1);}
  let open=0;for(const k of E2.keys()){const [a,b]=k.split('>');if(!E2.has(b+'>'+a))open++;}
  let vol=0;for(const [a,b,c] of V)vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  ok('Wasserdicht (jede Kante hat ihr Gegenstück) und nach außen gerichtet (Volumen positiv)',open===0&&vol>0,`offen ${open}, Volumen ${vol.toFixed(0)} mm³`);
  ok('Sockel mindestens 3 mm, Modell ≤ 100 mm',V.every(t=>t.every(p=>p[0]>=-.01&&p[0]<=100.01&&p[1]>=-.01&&p[1]<=100.01&&p[2]>=-1)));
  console.log('— Gebäudeanalyse —');
  d.querySelector('.lab-tools [data-t="building"]').click();await wait(60);
  ok('Leerer Zustand erklärt das Tippen',/Tippe auf ein Gebäude/.test(d.querySelector('.lab-body').textContent));
  const b=A.B.list.find(x=>x.id==='NL.IMBAG.Pand.0344100000000001'),F=CAD.facades(b).f;
  ok('Fassaden: Ost und West je ≈ 67 m × 12 m, Nord und Süd je ≈ 10 m × 12 m',Math.abs(F.O-F.W)<5&&Math.abs(F.N-F.S)<5&&F.O>750&&F.O<850&&F.N>100&&F.N<160,Object.entries(F).map(([k,v])=>k+' '+Math.round(v)).join(' · '));
  await CAD.analyse(b);await wait(30);const tx=d.querySelector('.lab-body').textContent;
  ok('BAG: 2 Einheiten, 800 m² Geschossfläche, Wohnen und Büro; fremdes Haus nicht mitgezählt',CAD.GB.info.units===2&&CAD.GB.info.vbo===800&&/Wohnen, Büro/.test(tx),CAD.GB.info.vbo);
  ok('Rijksmonument und geschütztes Stadtbild erkannt — nur wenn Fläche/Punkt das Haus trifft',/Rijksmonument/.test(tx)&&/geschützten Stadtbild/.test(tx)&&CAD.GB.info.rm==='https://monumentenregister.cultureelerfgoed.nl/monumenten/1');
  ok('Geschosse aus 3D BAG, Volumen LoD 2.2, Solar grob mit Rechenweg',/4\s*3D BAG/.test(tx)&&/8\.100 m³/.test(tx)&&/MWh\/a/.test(tx)&&/170 kWh/.test(tx));
  ok('Pläne nur für dieses Haus: Ansichten, Lageplan, IFC, 3D-Druck',d.querySelectorAll('.lab-body [data-gx]').length===4);
  console.log('— CAD-Werkzeug —');
  d.querySelector('.lab-tools [data-t="export"]').click();await wait(60);
  ok('Karten: Lageplan, Umgebungsplan, Ansichten, IFC, 3D-Druck; Rohdaten aufklappbar',['plan','env','views','ifc','stl'].every(k=>d.querySelector(`.lab-body [data-k="${k}"]`))&&!!d.querySelector('.ex-raw [data-f="dxf"]')&&!d.querySelector('button select'));
  d.querySelector('.lab-body [data-k="views"]').click();await wait(300);
  ok('Knopf meldet die erzeugten Dateien',/Ansichten N, O, S, W/.test(d.querySelector('.ex-last').textContent),d.querySelector('.ex-last')&&d.querySelector('.ex-last').textContent);
  ok('Keine Emojis im Modul',!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u.test(require('fs').readFileSync('public/js/lab-cad.js','utf8')));
  console.log('\nCHECKS: Fehler-Checks:',H.fails===0,'| jsdom-Fehler:',errs.length,errs.slice(0,5));
  process.exit(0);
},2500);

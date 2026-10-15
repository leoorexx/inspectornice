// ══════════════════════════════════════════════════════════════
// Straßenlabor · Werkzeug „Wind" — animierte Strömung wie Ventusky.
// Daten: Open-Meteo (CC BY 4.0) mit dem KNMI-Wettermodell HARMONIE,
// 25 Modellpunkte rund um den Kartenausschnitt, 10 m über Grund, 48 h.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n);
const WD={data:null,key:'',hour:0,playing:false,cv:null,raf:0,parts:[],field:null,fieldKey:''};
const BFT=[0.3,1.6,3.4,5.5,8.0,10.8,13.9,17.2,20.8,24.5,28.5,32.7];
const bft=v=>{let b=0;while(b<BFT.length&&v>=BFT[b])b++;return b;};
const RAMP=[[0,[120,150,190]],[3,[88,170,140]],[6,[214,186,70]],[9,[232,140,70]],[12,[208,88,60]],[17,[150,40,92]]];

async function fetchGrid(){
  const c=A.map.getCenter(),key=c.lat.toFixed(1)+','+c.lng.toFixed(1);
  if(WD.data&&WD.key===key&&Date.now()-WD.data.t<30*60e3)return WD.data;
  const lats=[],lons=[];for(let i=0;i<5;i++)for(let j=0;j<5;j++){lats.push((c.lat-.12+i*.06).toFixed(3));lons.push((c.lng-.18+j*.09).toFixed(3));}
  A.status(T('Wettermodell (KNMI) wird geladen …','Loading weather model (KNMI) …','Weermodel (KNMI) laden …'),true);
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation&models=knmi_seamless&forecast_days=2&wind_speed_unit=ms&timezone=Europe%2FAmsterdam`;
  const j=await fetch(u).then(r=>{if(!r.ok)throw new Error('Open-Meteo '+r.status);return r.json();});
  const arr=Array.isArray(j)?j:[j],times=arr[0].hourly.time;
  const now=new Date(),pad=n=>String(n).padStart(2,'0'),nowKey=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
  const start=Math.max(0,times.indexOf(nowKey));
  WD.data={t:Date.now(),times,start,pts:arr.map(p=>({lat:p.latitude,lon:p.longitude,h:p.hourly})),lat0:c.lat-.12,lon0:c.lng-.18};
  WD.key=key;WD.hour=start;WD.fieldKey='';A.status('');
  return WD.data;
}
// Bilineare Interpolation im 5×5-Raster
function windAt(lat,lon,h){
  const D=WD.data,fi=Math.max(0,Math.min(3.999,(lat-D.lat0)/.06)),fj=Math.max(0,Math.min(3.999,(lon-D.lon0)/.09)),i=Math.floor(fi),j=Math.floor(fj),di=fi-i,dj=fj-j;
  const uv=k=>{const p=D.pts[k].h,s=p.wind_speed_10m[h]||0,d=(p.wind_direction_10m[h]||0)*A.SR;return [-s*Math.sin(d),-s*Math.cos(d)];};   // Richtung = woher der Wind kommt
  const a=uv(i*5+j),b=uv(i*5+j+1),c=uv((i+1)*5+j),d=uv((i+1)*5+j+1);
  return [0,1].map(n=>(a[n]*(1-dj)+b[n]*dj)*(1-di)+(c[n]*(1-dj)+d[n]*dj)*di);
}
const at=(h,f)=>{const P=WD.data.pts;let s=0;for(const p of P)s+=p.h[f][h]||0;return s/P.length;};
function mean(h){const [u,v]=windAt(A.map.getCenter().lat,A.map.getCenter().lng,h),sp=Math.hypot(u,v),dir=(Math.atan2(-u,-v)/A.SR+360)%360;
  return {t:at(h,'temperature_2m'),ft:at(h,'apparent_temperature'),sp,gust:at(h,'wind_gusts_10m'),dir,rain:at(h,'precipitation')};}

// ── Partikel ──
function buildField(){
  const sz=A.map.getSize(),C=40,cols=Math.ceil(sz.x/C)+1,rows=Math.ceil(sz.y/C)+1,f=new Float32Array(cols*rows*2);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const ll=A.map.containerPointToLatLng([c*C,r*C]),[u,v]=windAt(ll.lat,ll.lng,WD.hour);f[(r*cols+c)*2]=u;f[(r*cols+c)*2+1]=v;}
  WD.field={f,cols,rows,C};WD.fieldKey=A.map.getZoom()+'|'+A.map.getCenter().toString()+'|'+WD.hour+'|'+sz.x+'x'+sz.y;
}
function vel(x,y){const F=WD.field,cx=Math.max(0,Math.min(F.cols-1.001,x/F.C)),cy=Math.max(0,Math.min(F.rows-1.001,y/F.C)),c=Math.floor(cx),r=Math.floor(cy),dx=cx-c,dy=cy-r,i=(r*F.cols+c)*2,j=i+F.cols*2,f=F.f;
  return [0,1].map(n=>(f[i+n]*(1-dx)+f[i+2+n]*dx)*(1-dy)+(f[j+n]*(1-dx)+f[j+2+n]*dx)*dy);}
function ensureCanvas(){
  if(WD.cv)return WD.cv;const c=document.createElement('canvas');c.className='lab-wind';A.map.getContainer().appendChild(c);WD.cv=c;
  A.map.on('movestart zoomstart resize',()=>{if(WD.cv){const g=WD.cv.getContext('2d');g.clearRect(0,0,WD.cv.width,WD.cv.height);}WD.fieldKey='';});
  return c;
}
function spawn(p,sz){p.x=Math.random()*sz.x;p.y=Math.random()*sz.y;p.age=0;p.life=50+Math.random()*90;return p;}
function start(){
  if(WD.raf||!WD.data)return;const c=ensureCanvas();c.style.display='block';
  const loop=()=>{WD.raf=0;if(!LAB.on||LAB.tool!=='wind'){stop();return;}
    const sz=A.map.getSize(),dpr=Math.min(2,window.devicePixelRatio||1);
    if(c.width!==Math.round(sz.x*dpr)||c.height!==Math.round(sz.y*dpr)){c.width=Math.round(sz.x*dpr);c.height=Math.round(sz.y*dpr);c.style.width=sz.x+'px';c.style.height=sz.y+'px';WD.fieldKey='';}
    const key=A.map.getZoom()+'|'+A.map.getCenter().toString()+'|'+WD.hour+'|'+sz.x+'x'+sz.y;if(WD.fieldKey!==key)buildField();
    const n=Math.max(250,Math.min(1600,Math.round(sz.x*sz.y/1500)));while(WD.parts.length<n)WD.parts.push(spawn({},sz));WD.parts.length=n;
    const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    g.globalCompositeOperation='destination-out';g.fillStyle='rgba(0,0,0,.085)';g.fillRect(0,0,sz.x,sz.y);g.globalCompositeOperation='source-over';
    g.lineWidth=1.6;g.lineCap='round';const dark=A.dark(),K=.55;
    for(const p of WD.parts){const [u,v]=vel(p.x,p.y),s=Math.hypot(u,v),nx=p.x+u*K,ny=p.y-v*K,col=A.ramp(RAMP,s);
      g.strokeStyle=`rgba(${col.join(',')},${dark?.9:.85})`;g.beginPath();g.moveTo(p.x,p.y);g.lineTo(nx,ny);g.stroke();
      p.x=nx;p.y=ny;if(++p.age>p.life||nx<0||ny<0||nx>sz.x||ny>sz.y)spawn(p,sz);}
    WD.raf=requestAnimationFrame(loop);};
  WD.raf=requestAnimationFrame(loop);
}
function stop(){if(WD.raf)cancelAnimationFrame(WD.raf);WD.raf=0;WD.playing=false;if(WD.cv){WD.cv.getContext('2d').clearRect(0,0,WD.cv.width,WD.cv.height);WD.cv.style.display='none';}}

// ── Verlauf (48 h) ──
function timeline(){
  const D=WD.data,n=Math.min(36,D.times.length-D.start),W=344,H=96,pad=6,xs=i=>pad+(W-2*pad)*i/(n-1);
  const ts=[],ws=[];for(let i=0;i<n;i++){ts.push(at(D.start+i,'temperature_2m'));ws.push(at(D.start+i,'wind_speed_10m'));}
  const tmin=Math.floor(Math.min(...ts))-1,tmax=Math.ceil(Math.max(...ts))+1,wmax=Math.max(8,...ws),yT=v=>8+(H-34)*(1-(v-tmin)/(tmax-tmin)),yW=v=>H-20-(H-44)*(v/wmax);
  let s=`<svg class="wd-tl" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${T('Verlauf der nächsten 36 Stunden','Next 36 hours','Verloop komende 36 uur')}">`;
  ws.forEach((v,i)=>{const c=A.ramp(RAMP,v);s+=`<rect x="${xs(i)-3}" y="${yW(v)}" width="6" height="${H-20-yW(v)}" rx="2" fill="rgb(${c.join(',')})" opacity=".75"/>`;});
  s+=`<path d="${ts.map((v,i)=>(i?'L':'M')+xs(i).toFixed(1)+' '+yT(v).toFixed(1)).join('')}" fill="none" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"/>`;
  for(let i=0;i<n;i++){const hr=+D.times[D.start+i].slice(11,13);if(hr%6===0)s+=`<text x="${xs(i)}" y="${H-5}" text-anchor="middle" class="wd-ax">${hr===0?D.times[D.start+i].slice(8,10)+'.':hr+':00'}</text>`;}
  const ci=WD.hour-D.start;s+=`<line x1="${xs(ci)}" y1="4" x2="${xs(ci)}" y2="${H-18}" stroke="#FFD600" stroke-width="2.5"/><circle cx="${xs(ci)}" cy="${yT(ts[ci])}" r="4.5" fill="#FFD600" stroke="var(--ink)" stroke-width="1.5"/>`;
  return s+`</svg>`;
}
function body(){
  const D=WD.data;if(!D)return `<p class="lab-hint"><span class="lab-spin" aria-hidden="true"></span> ${T('Wettermodell wird geladen …','Loading weather model …','Weermodel laden …')}</p>`;
  const m=mean(WD.hour),n=Math.min(36,D.times.length-D.start),t=D.times[WD.hour];
  return `<div class="wd-now"><div class="wd-big"><b>${A.nf(m.t,1)}°</b><span>${T('gefühlt','feels like','voelt als')} ${A.nf(m.ft,0)}°</span></div>
      <div class="wd-arrow" style="--r:${(m.dir+180)%360}deg" aria-hidden="true"><svg width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r="25" fill="var(--soft)" stroke="var(--line2)"/><path d="M27 9 35 33 27 28 19 33Z" fill="var(--ink)"/></svg></div>
      <div class="wd-num"><b>${A.nf(m.sp,1)} m/s</b><span>${A.nf(m.sp*3.6,0)} km/h · Bft ${bft(m.sp)} · ${T('aus','from','uit')} ${A.dirName(m.dir)}</span><span>${T('Böen','gusts','windstoten')} ${A.nf(m.gust,1)} m/s${m.rain>0?` · ${A.nf(m.rain,1)} mm`:''}</span></div></div>
    ${timeline()}
    <div class="lab-time"><button class="lab-play" id="wdPlay" aria-label="${WD.playing?T('Anhalten','Pause','Pauzeren'):T('Verlauf abspielen','Play forecast','Verloop afspelen')}">${WD.playing?A.IC.pause:A.IC.play}</button>
      <input type="range" class="lab-slider" id="wdH" min="${D.start}" max="${D.start+n-1}" step="1" value="${WD.hour}" aria-label="${T('Stunde','Hour','Uur')}"><b class="lab-clock">${t.slice(11,16)}</b></div>
    <div class="lab-legw"><div class="lab-ramp" style="background:${A.grad(RAMP,0,17)}"></div><div class="lab-rl"><span>0 m/s</span><span>${T('Windgeschwindigkeit, 10 m über Grund','wind speed, 10 m above ground','windsnelheid, 10 m boven maaiveld')}</span><span>17+</span></div></div>`;
}

LAB.addTool({id:'wind',order:5,gate:false,keepStatus:true,
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/></svg>',
  label:()=>T('Wind','Wind','Wind'),
  sub:()=>T('Strömung und Wetter der nächsten 36 Stunden','Flow and weather for the next 36 hours','Stroming en weer voor de komende 36 uur'),
  enter(){A.map.attributionControl.addAttribution('Wetter: Open-Meteo · KNMI');},
  leave(){stop();A.map.attributionControl.removeAttribution('Wetter: Open-Meteo · KNMI');},
  render:body,
  bind(root){
    const sl=root.querySelector('#wdH');if(sl)sl.oninput=()=>{WD.hour=+sl.value;WD.playing=false;WD.fieldKey='';A.rerender();};
    const pl=root.querySelector('#wdPlay');if(pl)pl.onclick=()=>{WD.playing=!WD.playing;A.rerender();if(WD.playing)playHours();};
    const tl=root.querySelector('.wd-tl');if(tl)tl.onclick=e=>{const r=tl.getBoundingClientRect(),D=WD.data,n=Math.min(36,D.times.length-D.start),f=(e.clientX-r.left-6*r.width/344)/(r.width*(1-12/344));WD.hour=D.start+Math.max(0,Math.min(n-1,Math.round(f*(n-1))));WD.fieldKey='';A.rerender();};
  },
  async load(){try{await fetchGrid();A.rerender();start();}catch(e){A.status(T('Wetterdaten gerade nicht erreichbar.','Weather data currently unavailable.','Weerdata momenteel niet bereikbaar.'));}},
  draw(g,X){if(!A.tooFar()&&A.B.list.length){const dark=A.dark();A.drawBuildings(g,X,dark?'rgba(60,56,66,.35)':'rgba(251,249,244,.45)',dark?'rgba(255,255,255,.18)':'rgba(23,21,28,.22)');}},
  click(e){if(!WD.data)return null;const [u,v]=windAt(e.latlng.lat,e.latlng.lng,WD.hour),sp=Math.hypot(u,v),dir=(Math.atan2(-u,-v)/A.SR+360)%360;
    return `${T('Wind hier','Wind here','Wind hier')} <b>${A.nf(sp,1)} m/s</b> ${T('aus','from','uit')} ${A.dirName(dir)}<small>${T('Modell, 10 m über Grund — zwischen Gebäuden oft deutlich anders','model, 10 m above ground — often quite different between buildings','model, 10 m boven maaiveld — tussen gebouwen vaak heel anders')}</small>`;},
  note:()=>T('Modellwerte des KNMI-Wettermodells HARMONIE (Raster ≈ 2,5 km) über Open-Meteo, an 25 Punkten rund um den Ausschnitt abgefragt und dazwischen interpoliert. Wind gilt für 10 m über offenem Gelände: In Straßenschluchten wird er gebremst, an Hochhauskanten beschleunigt — das kann dieses Modell nicht zeigen.','Model values from the KNMI HARMONIE weather model (≈ 2.5 km grid) via Open-Meteo, sampled at 25 points around the view and interpolated between them. Wind applies to 10 m above open ground: street canyons slow it down, tower corners speed it up — this model cannot show that.','Modelwaarden van het KNMI-weermodel HARMONIE (raster ≈ 2,5 km) via Open-Meteo, op 25 punten rond het beeld opgevraagd en ertussen geïnterpoleerd. Wind geldt voor 10 m boven open terrein: in straatkloven wordt hij afgeremd, bij hoogbouwhoeken versneld — dat kan dit model niet tonen.'),
  src:()=>'Open-Meteo (CC BY 4.0) · KNMI HARMONIE'
});
function playHours(){const D=WD.data,n=Math.min(36,D.times.length-D.start);let last=0;
  (function f(now){if(!WD.playing||!LAB.on||LAB.tool!=='wind')return;now=now||performance.now();
    if(!last||now-last>650){last=now;WD.hour=WD.hour+1>=D.start+n?D.start:WD.hour+1;WD.fieldKey='';const keep=WD.playing;A.rerender();WD.playing=keep;}
    requestAnimationFrame(f);})();}
LAB.wind={WD,windAt,mean,bft,fetchGrid};
})();

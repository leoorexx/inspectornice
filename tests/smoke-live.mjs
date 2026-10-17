// Live-Durchlauf der neuen Ansicht im echten Browser (echte Daten, kein Netz-Ersatz).
// Spielt jede Funktion wie ein Mensch durch und sammelt Auffälligkeiten.
// Start im Dev-Server (http://localhost:5199/next.html), in der Browser-Konsole:
//   const m=await import('/tests/smoke-live.mjs?'+Date.now()); m.start({lang:'de'});   // läuft im Hintergrund
//   window.__smoke   // Fortschritt und Ergebnis
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=25000,step=250){const t0=Date.now();while(Date.now()-t0<ms){try{const v=fn();if(v)return v;}catch(e){}await wait(step);}return null;}
const BAD=/\bundefined\b|\bNaN\b|\[object |Infinity|\{\{|\$\{/;
const DE_WORDS=/\b(und|nicht|Straße|Quartiere?|Menschen|Gebäude|Schatten|zwischen|werden|Werkzeug|Fläche)\b/;
const NL_DE=/[äüß]|\b(und|nicht|Straße|Quartiere?|Menschen|Gebäude|zwischen|werden|Werkzeug|Fläche)\b/;
export function start(opts){window.__smoke={running:true,step:'start',issues:[],timings:{},errors:[],opts};run(opts).then(r=>{Object.assign(window.__smoke,r,{running:false,step:'fertig'});}).catch(e=>{window.__smoke.running=false;window.__smoke.crash=String(e&&e.stack||e).slice(0,600);});return window.__smoke;}
const A2B=()=>window.LAB.api.B.list;
export async function run({lang='de',spots=[[52.0907,5.1214],[52.0775,5.1045],[52.1105,5.1135]],parts=['city','menu','act','lab','3d']}={}){
  const S=window.__smoke||{issues:[],timings:{},errors:[]},NX=window.__NX,M=window.NXM,LAB=window.LAB;
  const issue=(area,msg)=>S.issues.push({area,msg:String(msg).slice(0,260)});
  const step=s=>{S.step=s;};
  const timed=async(name,fn)=>{const t0=performance.now();try{await fn();}catch(e){issue(name,'Absturz: '+(e&&e.message||e));}S.timings[name]=Math.round(performance.now()-t0);};
  const onErr=e=>S.errors.push(String(e.message||e).slice(0,200)),onRej=e=>S.errors.push('Promise: '+String(e.reason&&e.reason.message||e.reason).slice(0,200));
  addEventListener('error',onErr);addEventListener('unhandledrejection',onRej);
  const check=(el,area)=>{if(!el)return;const t=(el.innerText||el.textContent||'');const m=t.match(BAD);if(m){const i=t.indexOf(m[0]);issue(area,`Text „${m[0]}": …${t.slice(Math.max(0,i-50),i+40).replace(/\s+/g,' ')}…`);}
    const words=lang==='en'?t.match(DE_WORDS):lang==='nl'?t.match(NL_DE):null;if(words){const i=t.indexOf(words[0]);issue(area,`Sprache (${lang}): „${words[0]}" in …${t.slice(Math.max(0,i-40),i+40).replace(/\s+/g,' ')}…`);}};
  const labStatus=area=>{const s=document.querySelector('.lab-status');const t=s&&s.textContent.trim();if(t&&/nicht erreichbar|not reachable|unavailable|niet bereikbaar|Fehler|error|fout|konnte nicht|could not|kon niet/i.test(t))issue(area,'Statuszeile: '+t);};
  const lb=document.querySelector(`.lang [data-l="${lang}"]`);if(lb)lb.click();await wait(150);
  document.getElementById('hint')&&document.getElementById('hintOk')&&document.getElementById('hintOk').click();
  if(LAB.on)LAB.close();NX.closePanel();
  // ── Stadtkarte ──
  if(parts.includes('city'))await timed('Stadt: Themen',async()=>{step('Themen');
    for(const t of ['alle',...NX.ALL().map(x=>x.id)]){NX.setTheme(t);await wait(40);check(document.getElementById('legend'),'Legende '+t);
      const lg=document.getElementById('legend');if(!lg||lg.textContent.trim().length<30)issue('Legende '+t,'leer oder zu kurz');}
    NX.setTheme('alle');});
  if(parts.includes('city'))await timed('Stadt: Quartiere',async()=>{step('Quartiere');
    const B=NX.BU.filter(b=>NX.score(b)!=null).sort((a,b)=>NX.score(b)-NX.score(a)),pick=[B[0],B[B.length>>1],B[B.length-1],NX.BU.find(b=>NX.score(b)==null)].filter(Boolean);
    for(const b of pick){NX.openBuurt(b,false);await wait(120);const pb=document.getElementById('pBody');check(pb,'Profil '+b.name);check(document.getElementById('ph'),'Kopf '+b.name);
      if(!document.querySelector('.pacts .pact'))issue('Profil '+b.name,'Aktionsleiste fehlt');
      const rl=M.reportLines(b).map(l=>l.slice(1).join(' ')).join('\n');if(BAD.test(rl))issue('Bericht '+b.name,'Berichtstext enthält '+rl.match(BAD)[0]);
      const g=pb.querySelector('.gl');if(g){g.click();await wait(30);const p=document.querySelector('.glpop');if(!p)issue('Begriffe','Erklärung öffnet nicht');else{check(p,'Begriff '+g.dataset.gl);document.body.click();}}}
    NX.closePanel();});
  // ── Mehr-Menü ──
  if(parts.includes('menu'))await timed('Menü',async()=>{step('Menü');
    const mb=document.getElementById('moreBtn');mb.click();await wait(40);check(document.getElementById('moreMenu'),'Mehr-Menü');mb.click();
    M.dashboard('list');await wait(60);const sh=()=>document.getElementById('nxSheet');check(sh(),'Alle Quartiere: Tabelle');
    for(const s of [...sh().querySelectorAll('[data-sort]')].map(b=>b.dataset.sort)){const b=sh().querySelector(`[data-sort="${s}"]`);b&&b.click();await wait(20);}
    if(sh().querySelectorAll('.nxd-t tbody tr').length!==NX.BU.length)issue('Alle Quartiere','Zeilenzahl stimmt nicht');
    sh().querySelector('[data-tab="rank"]').click();await wait(40);check(sh(),'Ranglisten');
    sh().querySelector('[data-tab="cmp"]').click();await wait(40);check(sh(),'Vergleich');M._t.close();
    M.methodik();await wait(40);check(sh(),'Methodik');M._t.close();
    await M.now();await wait(50);check(sh(),'Utrecht jetzt');const nw=sh()&&sh().textContent;if(nw&&/nicht erreichbar|unavailable|niet bereikbaar/.test(nw))issue('Utrecht jetzt','Live-Daten nicht erreichbar');M._t.close();
    const rq={de:'ranglisten',en:'rankings',nl:'ranglijsten'}[lang];M.palette(rq);await wait(30);if(!M._k.shown.length)issue('Befehle','keine Treffer für „'+rq+'"');M._k.run(0);await wait(60);if(!document.querySelector('.nxd-rk'))issue('Befehle','Ausführen öffnet nichts');M._t.close();
    const before=M.reps().length;M.report_spot();{const m=NX.map,p=L.latLng(52.09,5.12);m.fire('click',{latlng:p,layerPoint:m.latLngToLayerPoint(p),containerPoint:m.latLngToContainerPoint(p)});}await wait(40);const rb=document.querySelector('.nxr [data-rt="green"]');if(!rb)issue('Melden','Auswahl fehlt');else{rb.click();await wait(1500);}
    const after=M.reps();if(after.length!==before+1)issue('Melden','nicht gespeichert');else{after.pop();localStorage.setItem('nh_reports_utr',JSON.stringify(after));}   // Testmeldung wieder entfernen
  });
  // ── Handeln ──
  if(parts.includes('act')&&window.ACT)await timed('Handeln',async()=>{step('Handeln');const A2=window.ACT;
    for(const m of A2._t.MISSIONS){A2.m=m.id;A2.toggle(true);const ok=await until(()=>A2.cases[m.id]&&(A2.cases[m.id].length||A2.cases[m.id].err),30000);
      if(!ok)issue('Mission '+m.id,'Fälle laden nicht');else if(A2.cases[m.id].err)issue('Mission '+m.id,'Fehler beim Laden');else{check(document.querySelector('.act'),'Mission '+m.id);A2._t.openCase(A2.cases[m.id][0]);await wait(150);check(document.querySelector('.act'),'Fall '+m.id);}
      A2.toggle(false);await wait(50);}
    if(LAB.on)LAB.close();});
  // ── Straßenlabor ──
  if(parts.includes('lab'))for(const [si,sp] of spots.entries())await timed('Labor '+(si+1),async()=>{
    const ll=L.latLng(sp[0],sp[1]);NX.openLab(sp,'sun');await wait(300);NX.map.stop();NX.map.setView(sp,17,{animate:false});await wait(400);   // Kamerafahrten anhalten (im verdeckten Fenster laufen sie nicht weiter)
    const click=async(p)=>{const m=NX.map;m.fire('click',{latlng:p,layerPoint:m.latLngToLayerPoint(p),containerPoint:m.latLngToContainerPoint(p),originalEvent:new MouseEvent('click')});await wait(80);};   // wie ein echter Klick
    const tool=async(id)=>{const b=document.querySelector(`.lab-tools [data-t="${id}"]`);if(!b){issue('Labor','Werkzeug fehlt: '+id);return false;}b.click();await wait(200);return true;};
    const mode=async(m)=>{const b=document.querySelector(`.lab-body [data-m="${m}"]`);if(b){b.click();await wait(150);}return !!b;};
    const tag=x=>`Labor ${si+1} ${x}`;
    step(tag('Sonne'));await tool('sun');for(const m of ['shadow','sunhours']){await mode(m);await until(()=>!document.querySelector('.lab-status .lab-spin'),30000);labStatus(tag('Sonne '+m));}
    await click(ll);check(document.querySelector('.lab-dock'),tag('Sonne'));
    step(tag('Hitze'));await tool('surface');for(const m of ['albedo','heat','gaps']){await mode(m);const t0=performance.now();await until(()=>!document.querySelector('.lab-status .lab-spin')&&(m!=='gaps'||(LAB._t.SUNH&&LAB._t.SUNH.gap)),45000);S.timings[tag('Hitze '+m)]=Math.round(performance.now()-t0);labStatus(tag('Hitze '+m));}
    check(document.querySelector('.lab-dock'),tag('Hitze'));
    step(tag('Wasser'));await tool('water');for(const m of ['rain','flood','chance','terrain']){await mode(m);await until(()=>!document.querySelector('.lab-status .lab-spin'),40000);labStatus(tag('Wasser '+m));}
    await click(ll);check(document.querySelector('.lab-dock'),tag('Wasser'));
    step(tag('Wind'));await tool('wind');await until(()=>LAB.wind.WD.data,20000)||issue(tag('Wind'),'keine Winddaten');check(document.querySelector('.lab-dock'),tag('Wind'));
    step(tag('Standort'));await tool('standort');LAB.standort.SC.res=null;await click(ll);const t1=performance.now();await until(()=>LAB.standort.SC.res,30000);S.timings[tag('Standort amtlich')]=Math.round(performance.now()-t1);await until(()=>LAB.standort.SC.res&&!LAB.standort.SC.res.some(c=>c.wait),30000)||issue(tag('Standort'),'Ergebnis unvollständig');
    if(LAB.standort.SC.res&&LAB.standort.SC.res.filter(c=>c.fail).length)issue(tag('Standort'),'ausgefallen: '+LAB.standort.SC.res.filter(c=>c.fail).map(c=>c.k).join(','));check(document.querySelector('.lab-dock'),tag('Standort'));
    step(tag('Route'));await tool('route');LAB.route.R.res=null;LAB.route.R.err=null;await click(ll);await click(L.latLng(sp[0]+.004,sp[1]+.007));await until(()=>LAB.route.R.res||LAB.route.R.err,40000);if(LAB.route.R.err)issue(tag('Route'),LAB.route.R.err);check(document.querySelector('.lab-dock'),tag('Route'));
    step(tag('Straße'));await tool('street');let SEC=null;for(const [dy,dx] of [[0,0],[.0003,0],[-.0003,0],[0,.0005],[0,-.0005],[.0006,.0006]]){LAB.street.SEC=null;await click(L.latLng(sp[0]+dy,sp[1]+dx));await until(()=>LAB.street.SEC&&!document.querySelector('.lab-status .lab-spin'),30000);SEC=LAB.street.SEC;if(SEC&&!SEC.err)break;}if(!SEC||SEC.err)issue(tag('Straße'),'kein Querschnitt'+(SEC&&SEC.err?': '+SEC.err:''));else if(!document.querySelector('.sx'))issue(tag('Straße'),'Profil-SVG fehlt');check(document.querySelector('.lab-dock'),tag('Straße'));
    step(tag('Fläche'));await tool('area');await mode('circle');await click(ll);await until(()=>LAB.area.AR.stats&&!LAB.area.AR.busy,40000)||issue(tag('Fläche'),'keine Auswertung');check(document.querySelector('.lab-dock'),tag('Fläche'));
    step(tag('Studio'));await tool('studio');await until(()=>!document.querySelector('.lab-status .lab-spin'),40000);labStatus(tag('Studio'));const ds=[...document.querySelectorAll('.lab-body [data-d]')].slice(0,4);for(const d of ds){d.click();await wait(250);}check(document.querySelector('.lab-dock'),tag('Studio'));
    step(tag('Gebäude'));await tool('building');const bb=A2B().find(b=>b.id&&b.h>6);if(bb){LAB.cad.GB.b=null;await LAB.cad.analyse(bb);await until(()=>!LAB.cad.GB.busy,20000);check(document.querySelector('.lab-dock'),tag('Gebäude'));if(!LAB.cad.GB.info||!LAB.cad.GB.info.pand)issue(tag('Gebäude'),'BAG-Daten fehlen');}else issue(tag('Gebäude'),'kein Gebäude mit Höhe');
    step(tag('CAD'));await tool('export');await wait(300);check(document.querySelector('.lab-dock'),tag('CAD'));
    const AR=LAB.area.AR,keep={type:AR.type,r:AR.r,center:AR.center};Object.assign(AR,{type:'circle',r:120,center:ll});
    try{const t1=performance.now(),LP=await LAB.cad.lageplan(500);if(!LP.C.length)issue(tag('CAD'),'Lageplan ohne Höhenlinien');if(/[^\x00-\x7f]/.test(LP.txt))issue(tag('CAD'),'DXF nicht ASCII');
      const E=LAB.cad.site();if(!LAB.cad.elevationsSvg(E))issue(tag('CAD'),'keine Ansichten');const I=await LAB.cad.ifc(true);if(!I.terrain||!I.n)issue(tag('CAD'),'IFC unvollständig');
      const ST=await LAB.cad.stl(100,1);if(!ST.terrain||!ST.nb)issue(tag('CAD'),'STL unvollständig');S.timings[tag('CAD alles')]=Math.round(performance.now()-t1);}
    catch(e){issue(tag('CAD'),'Absturz: '+e.message);}finally{Object.assign(AR,keep);}
  });
  // ── 3D ──
  if(parts.includes('3d')&&LAB.v3d)await timed('3D',async()=>{step('3D');const V=LAB.v3d;NX.openLab(spots[0],'sun');await wait(300);NX.map.stop();NX.map.setView(spots[0],17,{animate:false});await wait(300);
    V.open();await until(()=>V.on&&!V.busy,60000);if(V.err)issue('3D',V.err);
    for(const m of ['licht','wasser','wind','rad','wachstum']){const b=document.querySelector(`.v3-modes [data-md="${m}"]`);b&&b.click();await wait(150);
      if(m==='wind'){const w=document.querySelector('.v3-pane [data-a="wind"]');w&&w.click();await until(()=>V.wind.on||V.wind.err,20000);}
      if(m==='rad'){const w=document.querySelector('.v3-pane [data-a="walk"]');w&&w.click();await until(()=>V.walk.on,20000)||issue('3D Unterwegs','Fußgänger starten nicht');}
      if(m==='wachstum')await until(()=>V.fut.loaded,30000)||issue('3D Zeitreise','Planungen laden nicht');
      let t=performance.now();for(let k=0;k<8;k++){t+=33;V._t.frame(t);}check(document.querySelector('.v3-pane'),'3D '+m);}
    V.close();LAB.close();});
  removeEventListener('error',onErr);removeEventListener('unhandledrejection',onRej);
  return {issues:S.issues,timings:S.timings,errors:S.errors};
}

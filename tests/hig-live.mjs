// Apple-Regel-Check (Human Interface Guidelines) im echten Browser: jede Oberfläche in Hell UND Dunkel.
// Misst, was jsdom nicht kann: Kontrast nach Überblendung, gerenderte Schriftgröße, Tippflächen,
// Browser-Standardknöpfe ohne eigene Gestaltung, fehlende Namen für Bildschirmleser, Querscrollen,
// Escape bei Fenstern.
// Start im Dev-Server (http://localhost:5199/next.html), in der Browser-Konsole:
//   const m=await import('/tests/hig-live.mjs?'+Date.now()); m.start();            // Desktop
//   (für Handy vorher das Fenster auf 375 px stellen und neu laden)
//   window.__hig   // Fortschritt und Ergebnis
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=20000,step=250){const t0=Date.now();while(Date.now()-t0<ms){try{const v=fn();if(v)return v;}catch(e){}await wait(step);}return null;}

const parse=c=>{const m=String(c).match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return [p[0],p[1],p[2],p.length>3?p[3]:1];};
const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
const blend=(t,b)=>{const a=t[3];return [t[0]*a+b[0]*(1-a),t[1]*a+b[1]*(1-a),t[2]*a+b[2]*(1-a),1];};
const vis=el=>{const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;if(r.bottom<0||r.right<0||r.top>innerHeight||r.left>innerWidth)return false;
  for(let x=el;x&&x.nodeType===1;x=x.parentElement){const s=getComputedStyle(x);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false;}return true;};
// Hintergrund hinter einem Element: alle Ebenen bis zur ersten deckenden überblenden. Über der Karte unbekannt → null (nicht messen).
const bgOf=el=>{const st=[];for(let x=el;x&&x.nodeType===1;x=x.parentElement){const s=getComputedStyle(x);if(s.backgroundImage&&s.backgroundImage!=='none'&&!/gradient/.test(s.backgroundImage))return null;
    const c=parse(s.backgroundColor);if(c&&c[3]>0)st.push(c);if(c&&c[3]>=.95)break;if(x.id==='map'||x.classList.contains('leaflet-container'))return null;}
  let b=parse(getComputedStyle(document.body).backgroundColor)||[255,255,255,1];for(let i=st.length-1;i>=0;i--)b=blend(st[i],b);return b;};
const ratio=(a,b)=>{const L1=lum(a),L2=lum(b);return (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);};
const nameOf=el=>(el.getAttribute('aria-label')||'').trim()||(el.getAttribute('aria-labelledby')&&[...el.getAttribute('aria-labelledby').split(/\s+/)].map(i=>{const e=document.getElementById(i);return e?e.textContent:'';}).join(' ').trim())||(el.textContent||'').trim()||(el.getAttribute('title')||'').trim()||(el.querySelector&&el.querySelector('img[alt]')&&el.querySelector('img[alt]').alt)||'';
const desc=el=>(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'')+(el.dataset&&el.dataset.t?'[data-t='+el.dataset.t+']':'')+' „'+(nameOf(el)||'').replace(/\s+/g,' ').slice(0,28)+'"';
const INTER='button,a[href],[role="button"],[role="tab"],[role="switch"],input:not([type="hidden"]),select,textarea,summary';

export function audit(root,area,{mobile=innerWidth<768}={}){
  const out=[],seen=new Set(),push=(k,msg)=>{const key=area+'|'+k+'|'+msg;if(seen.has(key))return;seen.add(key);out.push({area,k,msg});};
  if(!root)return out;
  // Text: Kontrast ≥ 4,5:1 (große Schrift 3:1), Größe ≥ 11 px
  root.querySelectorAll('*').forEach(el=>{if(el.closest('svg,canvas,.leaflet-tile-pane,.leaflet-overlay-pane'))return;
    const txt=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();if(!txt||!vis(el))return;
    const s=getComputedStyle(el),fs=parseFloat(s.fontSize);if(fs<11)push('schrift',`${fs.toFixed(1)} px: „${txt.slice(0,30)}" (${desc(el)})`);
    const bg=bgOf(el);if(!bg)return;let op=1;for(let x=el;x&&x.nodeType===1;x=x.parentElement)op*=+getComputedStyle(x).opacity;
    const c=parse(s.color);if(!c)return;const fg=blend([c[0],c[1],c[2],c[3]*op],bg),cr=ratio(fg,bg),bold=+s.fontWeight>=700,need=(fs>=24||(fs>=18.66&&bold))?3:4.5;
    if(el.closest('[disabled],[aria-disabled="true"]'))return;
    if(cr<need)push('kontrast',`${cr.toFixed(2)}:1 statt ${need}: „${txt.slice(0,30)}" (${desc(el)})`);});
  // Bedienelemente
  root.querySelectorAll(INTER).forEach(el=>{if(!vis(el))return;const s=getComputedStyle(el),lb=el.tagName==='INPUT'&&el.closest('label'),r=(lb||el).getBoundingClientRect();   // Häkchen im <label>: das Label ist die Tippfläche
    const inline=s.display==='inline'&&el.parentElement&&/^(P|SPAN|SMALL|LI|TD|DIV)$/.test(el.parentElement.tagName)&&(el.parentElement.textContent||'').trim().length>(el.textContent||'').trim().length+8;
    const tiny=el.closest('.leaflet-control-attribution');
    const min=mobile?44:24;
    const af=getComputedStyle(el,'::after');let w=r.width,h=r.height;   // unsichtbar vergrößerte Tippfläche (::after mit negativem Abstand) zählt mit
    if(af.content&&af.content!=='none'&&af.position==='absolute'){const n=v=>Math.min(0,parseFloat(v)||0);h-=n(af.top)+n(af.bottom);w-=n(af.left)+n(af.right);}
    if(!inline&&!tiny&&el.type!=='range'&&(w<min-.5||h<min-.5))push('tippflaeche',`${Math.round(w)}×${Math.round(h)} px < ${min}: ${desc(el)}`);
    if(el.type==='range'&&r.height<(mobile?44:24)-.5)push('tippflaeche',`Regler nur ${Math.round(r.height)} px hoch: ${desc(el)}`);
    if(el.tagName==='BUTTON'&&(/outset/.test(s.borderStyle)||/^rgb\((239, 239, 239|107, 107, 107|240, 240, 240|221, 221, 221)\)$/.test(s.backgroundColor)))push('standardknopf',`Browser-Standardknopf ohne eigene Gestaltung: ${desc(el)}`);
    if(!nameOf(el)&&!(el.labels&&el.labels.length)&&!el.getAttribute('placeholder'))push('name',`ohne Namen für Bildschirmleser: ${el.outerHTML.slice(0,90)}`);});
  root.querySelectorAll('img').forEach(im=>{if(vis(im)&&!im.hasAttribute('alt'))push('name','Bild ohne alt: '+(im.src||'').slice(-50));});
  // Nichts ragt aus dem Fenster
  const r=root.getBoundingClientRect&&root.getBoundingClientRect();if(r&&root!==document.body&&vis(root)&&(r.left<-1||r.right>innerWidth+1))push('ueberstand',`ragt seitlich aus dem Fenster (${Math.round(r.left)}…${Math.round(r.right)} bei ${innerWidth} px)`);
  return out;
}

export function start(opts={}){window.__hig={running:true,step:'start',issues:[],opts};run(opts).then(r=>Object.assign(window.__hig,r,{running:false,step:'fertig'})).catch(e=>{window.__hig.running=false;window.__hig.crash=String(e&&e.stack||e).slice(0,600);});return window.__hig;}

export async function run({modes=['light','dark'],spot=[52.0907,5.1214],lab=true}={}){
  const H=window.__hig||{issues:[]},NX=window.__NX,M=window.NXM,LAB=window.LAB,ACT=window.ACT;
  const add=a=>H.issues.push(...a),step=s=>{H.step=s;},mobile=innerWidth<768;
  const esc=()=>document.activeElement&&document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  const sheet=()=>document.getElementById('nxSheet');
  const lookBtn=t=>document.querySelector(`.thm [data-t="${t}"]`);
  document.getElementById('hintOk')&&document.getElementById('hintOk').click();
  const still=document.createElement('style');still.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.appendChild(still);   // gemessen wird der Endzustand, nicht ein Übergang
  for(const mode of modes){const tag=x=>`${mode==='dark'?'Dunkel':'Hell'}${mobile?' Handy':''} · ${x}`;
    lookBtn(mode).click();await wait(300);if(LAB.on)LAB.close();NX.closePanel();await wait(200);
    step(tag('Stadt'));add(audit(document.body,tag('Stadt')));
    if(document.documentElement.scrollWidth>innerWidth+1)add([{area:tag('Stadt'),k:'ueberstand',msg:`Seite scrollt quer (${document.documentElement.scrollWidth} > ${innerWidth})`}]);
    step(tag('Menü'));const mb=document.getElementById('moreBtn');mb.click();await wait(350);add(audit(document.getElementById('moreMenu'),tag('Mehr-Menü')));
    esc();await wait(80);if(!document.getElementById('moreMenu').hidden){add([{area:tag('Mehr-Menü'),k:'escape',msg:'schließt nicht mit Escape'}]);mb.click();}
    step(tag('Quartier'));const B=NX.BU.filter(b=>NX.score(b)!=null).sort((a,b)=>NX.score(b)-NX.score(a))[0];NX.openBuurt(B,false);await wait(500);await until(()=>document.querySelector('#pBody .nxl'),8000);{const nl=document.querySelector('#pBody .nxl');if(nl)nl.open=true;}await wait(100);
    add(audit(document.getElementById('panel')||document.querySelector('.panel'),tag('Quartiersprofil')));
    const g=document.querySelector('#pBody .gl');if(g){g.click();await wait(120);add(audit(document.querySelector('.glpop'),tag('Begriff')));document.body.click();}
    NX.closePanel();await wait(200);
    step(tag('Fenster'));
    for(const [nm,open,sub] of [['Alle Quartiere',()=>M.dashboard('list'),['rank','cmp']],['Methodik',()=>M.methodik()],['Regeln',()=>M.normen()],['Utrecht jetzt',()=>M.now()],['Befehle',()=>M.palette('')]]){
      await open();await wait(450);const sh=sheet()||document.querySelector('.nxk,.nx-pal,[role="dialog"]');add(audit(sh,tag(nm)));
      if(sh&&!sh.matches('[role="dialog"],[role="listbox"]')&&!sh.querySelector('[role="dialog"]'))add([{area:tag(nm),k:'name',msg:'Fenster ohne role="dialog"'}]);
      for(const t of sub||[]){const b=sh&&sh.querySelector(`[data-tab="${t}"]`);if(b){b.click();await wait(250);add(audit(sheet(),tag(nm+' '+t)));}}
      esc();await wait(250);if(sheet()&&vis(sheet())){add([{area:tag(nm),k:'escape',msg:'schließt nicht mit Escape'}]);M._t.close();await wait(200);}}
    if(ACT){step(tag('Handeln'));const m0=ACT._t.MISSIONS[0];ACT.m=m0.id;ACT.toggle(true);await until(()=>ACT.cases[m0.id]&&(ACT.cases[m0.id].length||ACT.cases[m0.id].err),30000);await wait(300);
      add(audit(document.querySelector('.act'),tag('Handeln')));const c=ACT.cases[m0.id];if(c&&c.length){ACT._t.openCase(c[0]);await wait(400);add(audit(document.querySelector('.act'),tag('Fall')));}
      ACT.toggle(false);await wait(200);if(LAB.on)LAB.close();}
    if(lab){step(tag('Labor'));NX.openLab(spot,'sun');await wait(400);NX.map.stop();NX.map.setView(spot,17,{animate:false});await wait(600);
      const ll=L.latLng(spot[0],spot[1]),click=async p=>{const m=NX.map;m.fire('click',{latlng:p,layerPoint:m.latLngToLayerPoint(p),containerPoint:m.latLngToContainerPoint(p),originalEvent:new MouseEvent('click')});await wait(150);};
      for(const b of [...document.querySelectorAll('.lab-tools [data-t]')].map(b=>b.dataset.t)){step(tag('Labor '+b));document.querySelector(`.lab-tools [data-t="${b}"]`).click();await wait(400);
        if(['sun','standort','building','area','street'].includes(b))await click(ll);
        await until(()=>!document.querySelector('.lab-status .lab-spin'),b==='building'||b==='standort'?25000:12000);await wait(300);
        add(audit(document.querySelector('.lab-dock'),tag('Labor '+b)));
        const ms=[...document.querySelectorAll('.lab-body [data-m]')].slice(1,4);for(const x of ms){x.click();await wait(500);await until(()=>!document.querySelector('.lab-status .lab-spin'),8000);add(audit(document.querySelector('.lab-dock'),tag('Labor '+b+' '+x.dataset.m)));}}
      if(LAB.v3d){step(tag('3D'));const V=LAB.v3d;V.open();await until(()=>V.on&&!V.busy,60000);await wait(400);add(audit(document.querySelector('.v3-pane')||document.body,tag('3D')));
        for(const m of ['wasser','wind','rad','wachstum']){const b=document.querySelector(`.v3-modes [data-md="${m}"]`);if(b){b.click();await wait(300);add(audit(document.querySelector('.v3-pane'),tag('3D '+m)));}}V.close();}
      LAB.close();await wait(200);}
  }
  lookBtn('auto').click();await wait(200);still.remove();
  const by={};H.issues.forEach(i=>{by[i.k]=(by[i.k]||0)+1;});
  return {issues:H.issues,count:by};
}

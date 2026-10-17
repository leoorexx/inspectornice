const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('public/dashboard.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,140));});
function sf(u){u=String(u);let f=null;if(u.includes('/_d/data/'))f='public/data/'+u.split('/_d/data/')[1].split('?')[0];else if(!u.includes('/_d/')&&u.includes('/data/'))f='public/data/'+u.split('/data/')[1].split('?')[0];if(f&&fs.existsSync(f)){const d=fs.readFileSync(f,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(d)),text:()=>Promise.resolve(d)});}return Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});}
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/_d/dashboard.html',virtualConsole:vc,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=u=>sf(u);w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(()=>{const w=window,d=w.document;
  function audit(label){
    const cands=w.pfCandidates();
    const B=10e6;
    ['sA','sB','sC'].forEach(k=>{
      const capF=k==='sA'?(c=>w.isVuln(c.d)?7:2):k==='sB'?(c=>w.pfClim(c.d)>=0.4?7:2):(c=>4);const {pick,sum}=w.pfGreedy(cands,k,B,capF);
      const vulnCost=pick.filter(c=>w.isVuln(c.d)).reduce((s,c)=>s+c.cost,0);
      console.log(`  ${label} ${k}: ${pick.length} Projekte · ${(sum/1e6).toFixed(1)}/10 Mio (${Math.round(sum/B*100)}% gebunden) · ${sum?Math.round(vulnCost/sum*100):0}% in vulnerable Wijken`);
    });
  }
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  console.log('— Utrecht —');audit('UTR');
  try{w.setCity('ffm');}catch(e){}
  setTimeout(()=>{
    console.log('— Frankfurt —');audit('FFM');
    // Flut-KPI neutral bei 0?
    const k=d.getElementById('kpiRow').innerHTML;
    console.log('\nFlut-KPI zeigt €0M rot:',/€0M/.test(k)?'❌ NOCH DA':'✓ behoben');
    console.log('Titel:',d.title);
    console.log('Fehler:',errs.filter(e=>!/getContext/.test(e)).length);
    process.exit(0);
  },1200);
},2500);

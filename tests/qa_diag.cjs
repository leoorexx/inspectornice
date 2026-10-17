const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/getContext|Not implemented|Could not load|parse CSS|fetch/.test(m))errs.push(m.slice(0,120));});
const ctx=new Proxy({},{get:()=>(()=>{}),set:()=>true});
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc,
  beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.fetch=()=>Promise.resolve({ok:false,status:404,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;
setTimeout(()=>{
  console.log('INIT:',errs.filter(e=>!/getContext/.test(e)).slice(0,3));
  // Synthetische Daten: ein Park + Bäume an FESTEN Orten
  window.eval(`
    window.__els={trees:[[52.0900,5.1200],[52.0902,5.1203],[52.0888,5.1188]],benches:[[52.0895,5.1198]],shops:[[52.0905,5.1205],[52.0906,5.1206],[52.0907,5.1207]],water:[],green:[[[52.0920,5.1220],[52.0920,5.1235],[52.0935,5.1235],[52.0935,5.1220],[52.0920,5.1220]]]};
    window.__mkB=(s,w,n,e)=>({getSouth:()=>s,getWest:()=>w,getNorth:()=>n,getEast:()=>e});
    window.__find=(d,lat,lon)=>{const r=Math.floor((lat-d.s)/d.cellH),c=Math.floor((lon-d.w)/d.cellW);return (r>=0&&r<d.rows&&c>=0&&c<d.cols)?d.grid[r][c]:null;};
    // Zwei überlappende, verschobene Ausschnitte
    window.__A=diagBuildGrid(window.__mkB(52.083,5.110,52.097,5.132),window.__els);
    window.__B=diagBuildGrid(window.__mkB(52.086,5.114,52.100,5.136),window.__els);
  `);
  const locs=[[52.0900,5.1200],[52.0895,5.1198],[52.0906,5.1206],[52.0888,5.1188],[52.0910,5.1215]];
  let stable=0,unstable=0;
  for(const [la,lo] of locs){
    const a=window.eval(`(function(){const g=window.__find(window.__A,${la},${lo});return g?[Math.round(g.greenDistM),diagScore(g),g.nTrees,g.nShop]:null})()`);
    const b=window.eval(`(function(){const g=window.__find(window.__B,${la},${lo});return g?[Math.round(g.greenDistM),diagScore(g),g.nTrees,g.nShop]:null})()`);
    const same=a&&b&&JSON.stringify(a)===JSON.stringify(b);
    console.log(`  ${la},${lo}: A=${JSON.stringify(a)} B=${JSON.stringify(b)} ${same?'STABIL':'>>> WACKELT'}`);
    if(same)stable++;else unstable++;
  }
  console.log(`\nStabil: ${stable}/${locs.length} (greenDistM, Score, nTrees, nShop identisch über verschobene Ausschnitte)`);
  process.exit(0);
},3000);

const {JSDOM}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('index.html','utf8').replace(/\/urbanlens\//g,'/_d/');
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'https://test.local/',beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>(()=>{}),set:()=>true});w.fetch=()=>Promise.resolve({ok:false,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')});w.scrollTo=()=>{};w.requestAnimationFrame=c=>setTimeout(c,0);}});
const {window}=dom;
setTimeout(()=>{
  window.eval(`
    window.__mkB=(s,w,n,e)=>({getSouth:()=>s,getWest:()=>w,getNorth:()=>n,getEast:()=>e});
    window.__roads=[{hw:'primary',geo:[[52.0900,5.1180],[52.0900,5.1300]]}];
    // Diag-Daten: Park + Bäume/Shops fest
    window.__els={trees:[[52.0915,5.1205],[52.0916,5.1208]],benches:[[52.0914,5.1203]],shops:[[52.0918,5.1210],[52.0919,5.1211],[52.0920,5.1212]],water:[],green:[[[52.0930,5.1220],[52.0930,5.1235],[52.0945,5.1235],[52.0945,5.1220],[52.0930,5.1220]]]};
    const C={la:52.0915,lo:5.1210};
    // RAUMKLANG: zwei Zoomstufen (klein/groß), gleiche Mitte, mit Puffer
    function raum(half){const view={s:C.la-half,w:C.lo-half,n:C.la+half,e:C.lo+half};
      const bb=window.__mkB(view.s-0.0035,view.w-0.005,view.n+0.0035,view.e+0.005);
      const d=raumGrid(bb,JSON.parse(JSON.stringify(window.__roads)),view);
      const cell=d.cells.find(c=>Math.abs(c.la-C.la)<0.0004&&Math.abs(c.lo-C.lo)<0.0006);
      return cell?cell.db:null;}
    window.__rA=raum(0.0030);  // ~zoom 16
    window.__rB=raum(0.0120);  // ~zoom 14
    // DIAG: zwei Zoomstufen mit Puffer
    function diag(half){const view={s:C.la-half,w:C.lo-half,n:C.la+half,e:C.lo+half};
      const bb=window.__mkB(view.s-0.006,view.w-0.009,view.n+0.006,view.e+0.009);
      const d=diagBuildGrid(bb,window.__els);
      const r=Math.floor((C.la-d.s)/d.cellH),c=Math.floor((C.lo-d.w)/d.cellW);const g=d.grid[r][c];
      return [Math.round(g.greenDistM),diagScore(g),g.nTrees,g.nShop];}
    window.__dA=JSON.stringify(diag(0.0030));
    window.__dB=JSON.stringify(diag(0.0120));
  `);
  const rA=window.eval('window.__rA'),rB=window.eval('window.__rB');
  const dA=window.eval('window.__dA'),dB=window.eval('window.__dB');
  console.log('RAUMKLANG dB  zoom16='+rA+'  zoom14='+rB+'  →  '+(rA===rB?'STABIL ✓':'WACKELT ✗'));
  console.log('DIAGNOSE [grünDist,score,trees,shops]  zoom16='+dA+'  zoom14='+dB+'  →  '+(dA===dB?'STABIL ✓':'WACKELT ✗'));
  process.exit(0);
},2600);

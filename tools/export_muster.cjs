// Muster-Katalog (M1–M7) aus index.html als gemeinsame Datei für die neue Oberfläche exportieren.
//   node tools/export_muster.cjs  →  public/data/muster.json
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const grab=(start,open,close)=>{const i=html.indexOf(start);if(i<0)throw new Error('nicht gefunden: '+start);
  let j=html.indexOf(open,i),d=0,k=j;for(;k<html.length;k++){if(html[k]===open)d++;else if(html[k]===close){d--;if(!d)break;}}
  return eval('('+html.slice(j,k+1)+')');};
const MU_SVG=grab('const MU_SVG=','{','}');
const MUSTER=grab('const MUSTER=','[',']');
const out=MUSTER.map(m=>({...m,svg:MU_SVG[m.key]||''}));
const dst=path.join(__dirname,'..','public/data/muster.json');
fs.writeFileSync(dst,JSON.stringify(out));
console.log(out.length+' Muster →',path.relative(process.cwd(),dst),(fs.statSync(dst).size/1024).toFixed(0)+' KB');

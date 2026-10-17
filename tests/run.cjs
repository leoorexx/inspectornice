// Alle jsdom-Prüfungen auf einmal (ohne Netz: jede Prüfung ersetzt fetch durch lokale Daten).
// Aufruf aus dem Projektordner:  npm test            alle
//                                npm test -- next lab nur Prüfungen, deren Name „next" oder „lab" enthält
// Live-Prüfung der Datenquellen getrennt:  npm run check:live
const {spawn}=require('child_process'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),filt=process.argv.slice(2);
const files=fs.readdirSync(__dirname).filter(f=>/^qa_.*\.cjs$/.test(f)&&(!filt.length||filt.some(x=>f.includes(x)))).sort();
const LIMIT=Math.max(1,Math.min(6,require('os').cpus().length-1)),T0=Date.now(),res=[];
// Zwei Ausgabeformate: neue Prüfungen „✓/✗ Satz", ältere „CHECKS: a: true | b: false … Fehler: N"
function score(out){let ok=(out.match(/^\s*✓/gm)||[]).length,bad=(out.match(/^\s*✗/gm)||[]).length;
  for(const l of out.split('\n')){
    if(/^\s*CHECKS:/.test(l)){ok+=(l.match(/:\s*true\b/g)||[]).length;bad+=(l.match(/:\s*false\b/g)||[]).length;}
    for(const m of l.matchAll(/(?:Gesamt-Fehler|Fehler gesamt|jsdom-Fehler|Fehler)\s*:\s*(\d+)/g))if(+m[1]>0)bad++;
    if(/\bINSTABIL\b/.test(l))bad++;}
  return {ok,bad};}
function one(f){return new Promise(done=>{const t0=Date.now();let out='';
  const p=spawn(process.execPath,[path.join(__dirname,f)],{cwd:ROOT,env:process.env});
  const kill=setTimeout(()=>{p.kill('SIGKILL');out+='\n✗ Zeitüberschreitung (300 s)';},300000);
  p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);
  p.on('close',code=>{clearTimeout(kill);const {ok,bad}=score(out),crash=/^(TypeError|ReferenceError|SyntaxError|Error):/m.test(out)||(code!==0&&!bad);
    res.push({f,ok,bad,crash,ms:Date.now()-t0,out});const st=bad||crash?'✗':'✓';console.log(`${st} ${f.padEnd(26)} ${String(ok).padStart(3)} ok${bad?`, ${bad} fehlgeschlagen`:''}${crash?', abgestürzt':''} · ${((Date.now()-t0)/1000).toFixed(1)} s`);done();});});}
(async()=>{
  console.log(`${files.length} Prüfungen, ${LIMIT} parallel\n`);
  const q=files.slice();await Promise.all(Array.from({length:LIMIT},async()=>{while(q.length)await one(q.shift());}));
  const fail=res.filter(r=>r.bad||r.crash);
  for(const r of fail){console.log(`\n── ${r.f} ──`);console.log(r.out.split('\n').filter(l=>/✗|Error|at /.test(l)).slice(0,15).join('\n'));}
  const sum=res.reduce((s,r)=>s+r.ok,0);
  console.log(`\n${sum} Einzelprüfungen bestanden · ${fail.length} von ${res.length} Dateien mit Fehlern · ${((Date.now()-T0)/1000).toFixed(0)} s`);
  process.exit(fail.length?1:0);
})();

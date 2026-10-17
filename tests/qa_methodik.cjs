const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('public/methodik.html','utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=((e&&(e.message||e.detail))||e)+'';if(!/Could not load|parse CSS/.test(m))errs.push(m.slice(0,120));});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://test.local/methodik.html',virtualConsole:vc});
const {window}=dom;window.onerror=m=>errs.push('e:'+String(m).slice(0,120));
setTimeout(()=>{const d=window.document;
  const rows=id=>(d.getElementById(id).innerHTML.match(/<tr>/g)||[]).length;
  console.log('Default lang:',window.eval('lang'),'(jsdom=en-US → erwartet en)');
  console.log('Titel:',d.title);
  console.log('H1:',d.getElementById('t_h1').textContent);
  console.log('DIMS-Zeilen:',rows('dimBody'),'| ENV-Zeilen:',rows('envBody'));
  const en=d.querySelector('.page').textContent+d.querySelector('.nav').textContent;
  console.log('EN sauber: "Measured" da:',/Measured/.test(en),'| kein "Gemessen":',!/Gemessen/.test(en),'| kein "Wahlbeteiligung":',!/Wahlbeteiligung/.test(en),'| Inspector Nice:',/Inspector Nice/.test(en));
  // Umschalten DE
  window.setLang('de');
  const de=d.querySelector('.page').textContent;
  console.log('DE: "Gemessen":',/Gemessen/.test(de),'| H1 deutsch:',/Methodik/.test(d.getElementById('t_h1').textContent));
  // NL
  window.setLang('nl');
  const nl=d.querySelector('.page').textContent;
  console.log('NL: "Gemeten":',/Gemeten/.test(nl),'| "Betrouwbaarheid":',/Betrouwbaarheid/.test(nl));
  console.log('Stadt-Badge:',d.getElementById('mCityBadge').textContent);
  console.log('Fehler:',errs.length,errs.slice(0,2));
  process.exit(0);
},800);

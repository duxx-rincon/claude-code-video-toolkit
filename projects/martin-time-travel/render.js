// node render.js <outDir> <f0> <f1> [step]   or   node render.js <outDir> list 30,300,...
const {chromium}=require('playwright');const serve=require('./server');const fs=require('fs');
(async()=>{
  const [outDir,a,b,step='1']=process.argv.slice(2);
  const frames=a==='list'?b.split(',').map(Number):[];
  if(a!=='list') for(let f=+a;f<=+b;f+=+step) frames.push(f);
  fs.mkdirSync(outDir,{recursive:true});
  const port=8800+Math.floor(Math.random()*900);
  const s=await serve(__dirname,port);
  const br=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await br.newPage({viewport:{width:1080,height:1920}});
  p.on('console',m=>{const t=m.text(); if(!/GPU stall|GL Driver/.test(t)) console.log('[page]',t);});
  p.on('pageerror',e=>console.log('[pageerror]',e.message));
  await p.goto(`http://localhost:${port}/src/index.html`);await p.waitForFunction('window.ready');
  if(process.env.CAM) await p.evaluate(c=>window.CAM=JSON.parse(c),process.env.CAM);
  const t0=Date.now(); const total=await p.evaluate('setupScene()'); console.log('setup',(Date.now()-t0)/1000,'s, frames',total);
  for(const f of frames){ if(f>=total) continue; const t=Date.now(); const d=await p.evaluate(f=>renderFrame(f),f);
    fs.writeFileSync(`${outDir}/${String(f).padStart(5,'0')}.jpg`,Buffer.from(d.split(',')[1],'base64'));
    if(frames.length<60||f%30===0) console.log('frame',f,((Date.now()-t)/1000).toFixed(2)+'s'); }
  await br.close(); s.close();
})().catch(e=>{console.error(e);process.exit(1);});

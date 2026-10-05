import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MOMO_PLAYWRIGHT_PACKAGE || 'playwright');
const meta=JSON.parse(readFileSync(resolve(root,'design/momo-motion/manifest.json'),'utf8'));
const dest=resolve(root,'design/momo-motion/verification');mkdirSync(dest,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.MOMO_CHROMIUM_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('file://'+resolve(root,'design/momo-motion/preview.html'));
await page.waitForFunction(()=>window.__motionReady);
await page.screenshot({path:resolve(dest,'gallery.png'),fullPage:true});
const results=[];
for(const a of meta.animations){
  const start=Date.now();
  await page.evaluate(id=>window.__selectMotion(id),a.id);
  await page.waitForFunction(()=>window.__motionReady);
  const visibleFrame=a.id.startsWith('confetti-')?24:a.loop?30:a.stillFrame;
  await page.evaluate(t=>window.__seekFrame(t),visibleFrame);
  if(a.category==='mascot') assert.ok(await page.locator('#player svg image').count()>0,a.id+' intact original image');
  else assert.ok(await page.locator('#player svg path').count()>0,a.id+' rendered SVG paths');
  const art=page.locator('#player');
  const still=await art.screenshot({path:resolve(dest,a.id+'.png')});
  await page.evaluate(t=>window.__seekFrame(t),Math.max(1,visibleFrame===30?65:10));
  const moved=await art.screenshot();
  const shouldMove=true;
  if(shouldMove) assert.ok(!still.equals(moved),a.id+' changes between frames');
  else assert.ok(still.equals(moved),a.id+' body stays stationary');
  if(a.category==='mascot'||a.id==='heart-refill') {
    for(const frame of (a.id==='heart-refill'?[0,12,24,40]:[0,12,24,72])) {
      await page.evaluate(t=>window.__seekFrame(t),frame);
      await art.screenshot({path:resolve(dest,`${a.id}-frame${frame}.png`)});
    }
  }
  if(a.category==='mascot') {
    await page.evaluate(async id=>{
      const baseline=JSON.parse(JSON.stringify(await window.__motionData(id)));
      baseline.layers=[baseline.layers.at(-1)];
      delete baseline.layers[0].masksProperties;baseline.layers[0].hasMask=false;
      document.getElementById('player').replaceChildren();
      const original=lottie.loadAnimation({container:document.getElementById('player'),renderer:'svg',autoplay:false,loop:false,animationData:baseline});
      await new Promise(done=>original.addEventListener('DOMLoaded',done));
      await Promise.all([...document.querySelectorAll('#player image')].map(el=>new Promise(done=>{const image=new Image();image.onload=done;image.onerror=done;image.src=el.getAttribute('href')||el.getAttribute('xlink:href')})));
    },a.id);
    await art.screenshot({path:resolve(dest,`${a.id}-source-baseline.png`)});
  }
  // The out point is exclusive: seeking to op renders no layers. Endpoint
  // equality is checked on the actual Bezier keyframe data in verify.py.
  results.push({id:a.id,rendered:true,moves:shouldMove,loadAndCaptureMs:Date.now()-start});
  console.log(a.id+' ✓');
}
await page.evaluate(()=>window.__selectMotion('momo-cheer'));await page.waitForFunction(()=>window.__motionReady);
await page.locator('#reduced').check();assert.equal(await page.evaluate(()=>document.getElementById('play').disabled),true);
await page.evaluate(()=>window.__selectMotion('confetti-burst'));await page.waitForFunction(()=>window.__motionReady);
assert.equal(await page.locator('#player').evaluate(el=>getComputedStyle(el).visibility),'hidden');
await page.locator('#reduced').uncheck();
await page.evaluate(()=>window.__selectMotion('confetti-burst'));await page.waitForFunction(()=>window.__motionReady);
await page.waitForFunction(()=>document.getElementById('play').textContent==='Play',null,{timeout:12000});
assert.equal(errors.length,0,errors.join('\n'));
writeFileSync(resolve(dest,'render-report.json'),JSON.stringify({renderer:'lottie-web 5.13.0 / Chromium',
  animations:results,reducedMotion:true,confettiSingleShot:true,errors},null,2)+'\n');
await browser.close();

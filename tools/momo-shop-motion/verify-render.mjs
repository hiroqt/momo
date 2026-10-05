import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(),require=createRequire(import.meta.url);
const {chromium}=require(process.env.MOMO_PLAYWRIGHT_PACKAGE);
const meta=JSON.parse(readFileSync('design/momo-shop-motion/manifest.json'));
const dest=resolve('design/momo-shop-motion/verification');mkdirSync(dest,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.MOMO_CHROMIUM_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('file://'+resolve('design/momo-shop-motion/preview.html'));await page.waitForFunction(()=>window.__motionReady);
for(const a of meta.animations){
 await page.evaluate(id=>window.__selectMotion(id),a.id);await page.waitForFunction(()=>window.__motionReady);
 await page.evaluate(()=>window.__seekFrame(0));const first=await page.locator('#player').screenshot();
 await page.evaluate(()=>window.__seekFrame(24));const middle=await page.locator('#player').screenshot();
 assert.ok(!first.equals(middle),a.id+' animates');assert.ok(await page.locator('#player svg path').count()>0);
 for(const f of [0,12,24,40,59]){await page.evaluate(f=>window.__seekFrame(f),f);await page.locator('#player').screenshot({path:resolve(dest,`${a.id}-frame${f}.png`)});}
 results.push({id:a.id,rendered:true,animated:true});console.log(a.id+' ✓');
}
await page.locator('#reduced').check();assert.ok(await page.locator('#play').isDisabled());
assert.equal(errors.length,0,errors.join('\n'));
writeFileSync(resolve(dest,'render-report.json'),JSON.stringify({renderer:'lottie-web / Chromium',animations:results,reducedMotion:true,errors},null,2)+'\n');await page.locator('#reduced').uncheck();
await page.evaluate(async ids=>{
 const data=await Promise.all(ids.map(id=>window.__motionData(id)));
 document.body.innerHTML='<main id="gallery"><h1>Momo · Shop Studio</h1><p>Purposeful motion. A little detail in every tool.</p><section></section></main>';
 const style=document.createElement('style');style.textContent='body{margin:0;background:#FBF8F1;font-family:Arial;color:#312B49}main{padding:30px;width:960px}h1{font-size:30px}section{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:#FFFDF8;border:1px solid #E7DED4;border-radius:20px;padding:8px}.art{width:218px;height:218px}.label{font-size:14px;font-weight:bold;margin:6px 8px 12px}';document.head.append(style);
 window.galleryPlayers=[];
 await Promise.all(data.map(a=>new Promise(done=>{const card=document.createElement('div');card.className='card';const art=document.createElement('div');art.className='art';card.append(art);const label=document.createElement('div');label.className='label';label.textContent=a.nm;card.append(label);document.querySelector('section').append(card);const player=lottie.loadAnimation({container:art,renderer:'svg',autoplay:false,loop:false,animationData:a});window.galleryPlayers.push(player);player.addEventListener('DOMLoaded',done);})))
},meta.animations.map(a=>a.id));
await page.setViewportSize({width:1020,height:1010});
for(let frame=0;frame<24;frame++){await page.evaluate(f=>window.galleryPlayers.forEach(a=>a.goToAndStop(f,true)),frame*2.5);await page.locator('#gallery').screenshot({path:resolve(dest,`gallery-${String(frame).padStart(2,'0')}.png`)});}
await browser.close();

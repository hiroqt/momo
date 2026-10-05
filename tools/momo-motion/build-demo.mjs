import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MOMO_PLAYWRIGHT_PACKAGE||'playwright');
const out=process.env.MOMO_DEMO_FRAMES||'/tmp/momo-motion-demo';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.MOMO_CHROMIUM_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1000,height:1220}});
await page.goto('file://'+resolve(root,'design/momo-motion/preview.html'));
await page.waitForFunction(()=>window.__motionReady);
await page.evaluate(async()=>{
  const choices=[['momo-wave','Wave · hand'],['momo-welcome','Welcome · hand'],['momo-ready','Ready · thumbs-up'],['momo-reading','Reading · hand'],['momo-bow','Bow · head'],['momo-cheer','Cheer · fists'],['momo-listen','Listen · hand'],['momo-point','Point · hand'],['momo-present','Present · book grips'],['momo-proud','Proud · book grips'],['momo-rest','Rest · tail tip'],['momo-thinking','Thinking · hand'],['momo-hero','Hero · hand'],['streak-fire','Fire · anchored flame'],['coin-reward','Coin · turn'],['heart-refill','Heart · rising color']];
  const payload=await Promise.all(choices.map(([id])=>window.__motionData(id)));
  lottie.destroy();document.body.replaceChildren();
  const title=document.createElement('div');title.style='padding:22px 28px 5px;font-size:21px;font-weight:700;color:#28223d';title.textContent='Momo, brought to life.';document.body.append(title);
  const row=document.createElement('div');row.style='display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:12px 24px';document.body.append(row);window.__demo=[];
  for(let i=0;i<choices.length;i++){
    const tile=document.createElement('div');tile.style='border-radius:20px;background:#fffdf8;border:1px solid #ece3d8;overflow:hidden';
    const stage=document.createElement('div');stage.style='height:245px;width:100%';const label=document.createElement('div');label.style='text-align:center;padding:7px 0 12px;font-weight:600;font-size:13px';label.textContent=choices[i][1];tile.append(stage,label);row.append(tile);
    const player=lottie.loadAnimation({container:stage,renderer:'svg',loop:false,autoplay:false,animationData:payload[i]});
    await new Promise(done=>player.addEventListener('DOMLoaded',done));window.__demo.push(player);
  }
  await Promise.all([...document.images].filter(im=>!im.complete).map(im=>new Promise(done=>{im.onload=done;im.onerror=done;})));
});
for(let i=0;i<48;i++){
  await page.evaluate(i=>window.__demo.forEach((p,index)=>p.goToAndStop(index>=14?Math.min(p.totalFrames-1,i*2.5):i*2.5%p.totalFrames,true)),i);
  await page.screenshot({path:resolve(out,`${String(i).padStart(3,'0')}.png`)});
}
await browser.close();console.log('Captured 48 demo frames.');

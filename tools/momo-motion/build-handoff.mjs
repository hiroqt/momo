import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createRequire} from 'node:module';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const design=resolve(root,'design/momo-motion');
const require=createRequire(import.meta.url);
// Set MOMO_LOTTIE_PACKAGE to a temporary dependency directory, or install the
// pinned lottie-web version next to this script. No mobile dependencies change.
const lib=process.env.MOMO_LOTTIE_PACKAGE
  ? resolve(process.env.MOMO_LOTTIE_PACKAGE,'build/player/lottie.min.js')
  : require.resolve('lottie-web/build/player/lottie.min.js');
const runtime=readFileSync(lib,'utf8');
const meta=JSON.parse(readFileSync(resolve(design,'manifest.json'),'utf8'));
const pack={},bundle=[];
for(const m of meta.animations){
  const data=readFileSync(resolve(root,m.json));
  const svg=readFileSync(resolve(design,'svg',m.id+'.svg'),'utf8');
  pack[m.id]={gzip:gzipSync(data).toString('base64'),
    dotLottie:readFileSync(resolve(root,m.dotLottie)).toString('base64'),
    svg:Buffer.from(svg).toString('base64')};
  bundle.push({meta:m,svg});
}
const safe=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const template=readFileSync(resolve(root,'tools/momo-motion/preview-template.html'),'utf8');
function html(plugin){return template.replace('/* LOTTIE_RUNTIME */',()=>runtime)
  .replace('/* MOTION_PAYLOAD */',()=>`const __FIGMA_MODE__=${plugin};const META=${safe(meta)};const PACK=${safe(pack)};`)}
writeFileSync(resolve(design,'preview.html'),html(false));
writeFileSync(resolve(design,'figma/ui.html'),html(true));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const txt=(value,x,y,size=16,weight=400,color='#28223D')=>`<text x="${x}" y="${y}" font-family="Inter, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(value)}</text>`;
const mascots=bundle.filter(a=>a.meta.category==='mascot');
const effects=bundle.filter(a=>a.meta.category==='app');
const appTop=424+Math.ceil(mascots.length/4)*390+52;
const foot=appTop+90+Math.ceil(effects.length/5)*326+30;
let board=`<svg xmlns="http://www.w3.org/2000/svg" width="1520" height="${foot+154}" viewBox="0 0 1520 ${foot+154}"><rect width="1520" height="${foot+154}" fill="#FBF8F1"/>`;
board+=txt('MOMO / MOTION SYSTEM 01',56,61,13,700,'#7052BF')+txt('A little movement.',56,133,52,700)+txt('A lot of personality.',56,195,52,700);
board+=txt('An encouraging study buddy. Original artwork, expressive gestures and purposeful app moments.',58,245,17);
board+=txt('28 animations  /  SVG masters  /  transparent Lottie  /  30 fps  /  reduced-motion stills',58,281,14,400,'#827B91');
board+=txt('01  Meet Momo',56,365,29,700)+txt('Original full-body artwork, preserved intact in image-backed Lottie animations.',58,397,15,400,'#827B91');
function card(a,i,top,cols,w,h){
 const x=56+(i%cols)*(w+20),y=top+Math.floor(i/cols)*(h+20),aw=w-36;
 const paths=a.svg.replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 board+=`<g id="${a.meta.id}" transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="18" fill="#FFFDF8" stroke="#E9E0D7"/><g id="${a.meta.id}-editable-SVG" transform="translate(18 10) scale(${aw/512})">${paths}</g>`;
 board+=txt(a.meta.title,18,h-47,16,700)+txt(`${a.meta.duration}s  /  ${a.meta.loop?'Seamless loop':'Plays once'}`,18,h-23,12,400,'#827B91')+'</g>';
}
mascots.forEach((a,i)=>card(a,i,424,4,337,370));
board+=txt('02  The little wins',56,appTop+29,29,700)+txt('Streaks, study progress, rewards and celebrations. Every moment has a job.',58,appTop+61,15,400,'#827B91');
effects.forEach((a,i)=>card(a,i,appTop+90,5,266,306));
board+=txt('MOTION PRINCIPLES',56,foot+13,13,700,'#7052BF')+txt('Anticipation → action → settle. Quiet loops. Celebrations play once. Pause when hidden.',56,foot+47,17);
board+=txt('Reduced Motion: still illustrations, static fire, no confetti. No screen-wide decorative loops.',56,foot+77,15,400,'#827B91');
board+=txt('Preview and export prepared Lottie in the Momo Motion Studio plugin. Canvas edits remain separate.',56,foot+106,14,400,'#827B91')+'</svg>';
writeFileSync(resolve(design,'momo-motion-board.svg'),board);
writeFileSync(resolve(design,'figma/code.js'),`const BOARD_SVG=${JSON.stringify(board)};\n`+
  readFileSync(resolve(root,'tools/momo-motion/figma-plugin.js'),'utf8'));
writeFileSync(resolve(design,'figma/manifest.json'),JSON.stringify({name:'Momo Motion Studio',
  api:'1.0.0',main:'code.js',ui:'ui.html',editorType:['figma'],documentAccess:'dynamic-page',
  networkAccess:{allowedDomains:['none']}},null,2)+'\n');
mkdirSync(resolve(design,'licenses'),{recursive:true});
writeFileSync(resolve(design,'licenses/lottie-web.txt'),readFileSync(resolve(dirname(lib),'../../LICENSE.md'),'utf8'));
const registryDir=resolve(root,'mobile/lib/animations');mkdirSync(registryDir,{recursive:true});
const entries=meta.animations.map(a=>`  '${a.id}': {\n    source: () => require('@/assets/animations/momo-motion/${a.id}.json') as AnimationObject,\n    loop: ${a.loop}, frames: ${a.duration*a.fps}, stillFrame: ${a.stillFrame},\n    label: ${JSON.stringify(a.title)}, decorativeBurst: ${a.id.startsWith('confetti-')},\n  },`).join('\n');
writeFileSync(resolve(registryDir,'momoMotion.ts'),`// Generated by tools/momo-motion/build-handoff.mjs. Source JSON loads on demand.\nimport type { AnimationObject } from 'lottie-react-native';\n\nexport const MOMO_MOTION = {\n${entries}\n} as const;\n\nexport type MomoMotionName = keyof typeof MOMO_MOTION;\n\nexport type MotionPlayback = 'hidden' | 'still' | 'paused' | 'playing';\n\nexport function motionPlayback({ reducedMotion, active, focused, completed, decorativeBurst }: {\n  reducedMotion: boolean; active: boolean; focused: boolean; completed: boolean; decorativeBurst: boolean;\n}): MotionPlayback {\n  if (reducedMotion) return decorativeBurst ? 'hidden' : 'still';\n  if (!active || !focused) return 'paused';\n  return completed ? 'still' : 'playing';\n}\n`);
console.log('Built standalone preview and offline Figma desktop plugin.');

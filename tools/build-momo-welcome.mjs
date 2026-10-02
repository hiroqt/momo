import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = resolve(root, 'mobile/assets/onboarding');
const atlas = resolve(assets, 'momo-wave-atlas.png');
const frames = resolve(assets, 'frames');
mkdirSync(frames, { recursive: true });

const info = JSON.parse(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', atlas,
], { encoding: 'utf8' })).streams[0];
if (info.width !== info.height || info.width % 3) {
  throw new Error('The wave atlas must be a square, equal-cell 3×3 grid.');
}
// The generated atlas has optical gutters rather than mechanically equal
// columns. These inspected boundaries preserve each tail and waving hand.
const ratio = info.width / 1254;
const columns = [0, 450, 815, 1254].map((value) => Math.round(value * ratio));
const rows = [0, 418, 836, 1254].map((value) => Math.round(value * ratio));
const anchors = [278, 640, 995].map((value) => Math.round(value * ratio));
const baselines = [400, 814, 1226].map((value) => Math.round(value * ratio));
const frameSize = 500;
for (let index = 0; index < 9; index++) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'lavfi', '-i', `color=c=black@0:s=${frameSize}x${frameSize},format=rgba`,
    '-i', atlas,
    '-filter_complex',
    `[1:v]crop=${columns[column + 1] - columns[column]}:${rows[row + 1] - rows[row]}:` +
      `${columns[column]}:${rows[row]}[pose];` +
      `[0:v][pose]overlay=${250 - anchors[column] + columns[column]}:` +
      `${475 - baselines[row] + rows[row]}:format=auto,format=rgba[out]`,
    '-map', '[out]',
    '-frames:v', '1', resolve(frames, `frame-${String(index + 1).padStart(2, '0')}.png`),
  ]);
}

// Composite alpha onto the exact theme canvas before H.264 encoding. Optical
// flow interpolates the keyframes; start/end holds avoid a clipped first wave.
const evenSize = frameSize;
execFileSync('ffmpeg', [
  '-y', '-v', 'error',
  '-f', 'lavfi', '-i', `color=c=0xFFFEFC:s=${evenSize}x${evenSize}:r=5:d=1.8`,
  '-framerate', '5', '-start_number', '1', '-i', resolve(frames, 'frame-%02d.png'),
  '-filter_complex',
  '[0:v][1:v]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p,' +
    'minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,' +
    'tpad=start_duration=0.25:stop_duration=0.6:start_mode=clone:stop_mode=clone[v]',
  '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', '19', '-preset', 'slow',
  '-movflags', '+faststart', resolve(assets, 'momo-welcome.mp4'),
]);
console.log('Built nine transparent PNG frames and a silent 60 fps welcome video.');

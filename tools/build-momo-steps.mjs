import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = resolve(root, 'mobile/assets/onboarding');
const output = resolve(assets, 'steps');
mkdirSync(output, { recursive: true });
// Inspected 1774×887 transparent atlas: all hands, feet and tails are inside
// these cell boundaries. Keep the common canvas; never enlarge source pixels.
const columns = [0, 443, 887, 1330, 1774];
const rows = [0, 443, 887];
const names = ['bow', 'listen', 'point', 'thinking', 'present', 'rest', 'proud', 'cheer'];
for (let index = 0; index < names.length; index++) {
  const column = index % 4, row = Math.floor(index / 4);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', resolve(assets, 'momo-step-atlas.png'),
    '-vf', `crop=${columns[column + 1] - columns[column]}:${rows[row + 1] - rows[row]}:${columns[column]}:${rows[row]},pad=448:448:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba`,
    '-frames:v', '1', resolve(output, `momo-${names[index]}.png`)]);
}
console.log('Extracted eight transparent step poses without upscaling.');

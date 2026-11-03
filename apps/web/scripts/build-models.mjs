// Downloads the CC0 Quaternius models (via poly.pizza's static CDN), strips unused animations, dedups,
// quantizes and meshopt-compresses them into public/models/. Re-run after changing the lists below.
//   pnpm --filter @es/web build:models
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const here = path.dirname(fileURLToPath(import.meta.url));
const cache = path.resolve(here, '../node_modules/.cache/es-models');
const out = path.resolve(here, '../public/models');
mkdirSync(cache, { recursive: true });

/** name → { url, polyPizza, title, dir, keepClips } — all CC0 1.0 by Quaternius (https://poly.pizza/u/Quaternius). */
const HUMAN_CLIPS = ['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Wave', 'Interact'];
const ANIMAL_CLIPS = ['Idle', 'Idle_2', 'Idle_2_HeadLow', 'Walk', 'Gallop', 'Eating', 'Idle_Eating', 'Run'];
const MODELS = {
  'business': { url: null, polyPizza: 'JFrLIKqvCH', title: 'Business Man', dir: 'characters', keep: HUMAN_CLIPS },
  'casual': { url: null, polyPizza: 'kZ3DmIoGip', title: 'Casual Character', dir: 'characters', keep: HUMAN_CLIPS },
  'hoodie': { url: null, polyPizza: 'gKLBoRsyKe', title: 'Hoodie Character', dir: 'characters', keep: HUMAN_CLIPS },
  'worker': { url: null, polyPizza: 'Yg2bQZO6Hj', title: 'Worker', dir: 'characters', keep: HUMAN_CLIPS },
  'farmer': { url: null, polyPizza: '7pn3R6hPvE', title: 'Farmer', dir: 'characters', keep: HUMAN_CLIPS },
  'woman-casual': { url: null, polyPizza: 'qJ2gsTUBHL', title: 'Animated Woman (casual)', dir: 'characters', keep: HUMAN_CLIPS },
  'woman-formal': { url: null, polyPizza: 'nIItLV9nxS', title: 'Animated Woman (formal)', dir: 'characters', keep: HUMAN_CLIPS },
  'cat': { url: null, polyPizza: 'qKICY6xla2', title: 'Cat', dir: 'critters', keep: ANIMAL_CLIPS },
  'shiba': { url: null, polyPizza: 'y4wdQpg767', title: 'Shiba Inu', dir: 'critters', keep: ANIMAL_CLIPS },
  'husky': { url: null, polyPizza: 'wcWiuEqwzq', title: 'Husky', dir: 'critters', keep: ANIMAL_CLIPS },
  'flowers': { url: null, polyPizza: 'NBUxHir6FJ', title: 'Flowers', dir: 'flora', keep: [] },
  'grass': { url: null, polyPizza: 'UGTOzcO3P2', title: 'Grass', dir: 'flora', keep: [] },
};

const UA = { 'user-agent': 'english-street build-models' };
async function source(name, m) {
  const file = path.join(cache, `${name}.glb`);
  if (existsSync(file)) return file;
  // Resolve the static GLB URL from the poly.pizza model page (the page embeds it).
  const page = await (await fetch(`https://poly.pizza/m/${m.polyPizza}`, { headers: UA })).text();
  const url = m.url ?? page.match(/https:\/\/static\.poly\.pizza\/[0-9a-f-]+\.glb/)?.[0];
  if (!url) throw new Error(`no glb url for ${name}`);
  const lic = page.match(/"Licence":"([^"]*)"/)?.[1];
  if (lic !== 'CC0 1.0') throw new Error(`${name}: unexpected licence ${lic}`);
  const buf = Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer());
  writeFileSync(file, buf);
  console.log(`downloaded ${name} (${Math.round(buf.length / 1024)} KB) from ${url}`);
  return file;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptEncoder.ready;
const credits = [];
for (const [name, m] of Object.entries(MODELS)) {
  const src = await source(name, m);
  const doc = await io.read(src);
  const root = doc.getRoot();
  // Keep only the clips the game uses; strip armature prefixes ("CharacterArmature|Walk" → "Walk").
  for (const a of root.listAnimations()) {
    const short = a.getName().replace(/^.*\|/, '');
    if (m.keep.length && !m.keep.includes(short)) a.dispose();
    else a.setName(short);
  }
  // Duplicate clips (the dogs ship each clip twice) → keep the first.
  const seen = new Set();
  for (const a of root.listAnimations()) {
    if (seen.has(a.getName())) a.dispose();
    seen.add(a.getName());
  }
  await doc.transform(dedup(), prune(), resample(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  mkdirSync(path.join(out, m.dir), { recursive: true });
  const dest = path.join(out, m.dir, `${name}.glb`);
  await io.write(dest, doc);
  console.log(`${m.dir}/${name}.glb  ${Math.round(statSync(src).size / 1024)} KB → ${Math.round(statSync(dest).size / 1024)} KB  clips: ${root.listAnimations().map((a) => a.getName()).join(', ')}`);
  credits.push(`| \`${m.dir}/${name}.glb\` | Quaternius — [${m.title}](https://poly.pizza/m/${m.polyPizza}) via poly.pizza | CC0 1.0 |`);
}
const creditsFile = path.join(out, 'CREDITS.md');
const base = readFileSync(creditsFile, 'utf8').split('\n<!-- build-models -->')[0];
writeFileSync(creditsFile, `${base}\n<!-- build-models -->\n\nGenerated by \`scripts/build-models.mjs\` (clips pruned, meshopt-compressed):\n\n| File | Source | License |\n|---|---|---|\n${credits.join('\n')}\n`);
console.log('credits updated');

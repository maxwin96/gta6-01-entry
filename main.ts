// Sunset Bay — packs the gta6-01 entry for the judge.
// Plain Node, no dependencies: this script gathers the static game folder
// and the screenshots next to it, drops them into the grading folder,
// and asks the vendored make.fun helper to write dossier.json there.
// The grader folder defaults to /output; set MAKEFUN_OUTPUT_DIR to aim
// somewhere else while testing locally, e.g.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Running it twice gives byte-identical output, so a second run is a
// free sanity check rather than a new submission.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const dest = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(dest, { recursive: true });
cpSync(join(here, 'game'), join(dest, 'game'), { recursive: true });
mkdirSync(join(dest, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(dest, 'screenshots'), { recursive: true });
}

// These caps mirror the scorer's own gates, so anything this script
// accepts is something the scorer would accept too: at most 4 shots,
// none over 256 KiB, at most 993 files under game/, game/ under 48 MiB,
// and no game path longer than 1000 bytes.
writeFileSync(
  join(dest, 'dossier.json'),
  buildDossier(dest, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

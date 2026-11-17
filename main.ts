// Sunset Bay — the submission script for the gta6-01 "Make GTA 6" bounty.
// Node 22, standard library only. The game itself is the static files under
// game/ (index.html plus ES modules, three.js vendored locally, no network
// requests at all). This program stages a submission: it copies game/ and
// screenshots/ next to this file into the output directory and writes
// dossier.json there, the summary the judge reads, using the vendored
// make.fun library. The destination defaults to /output (the grader's
// folder); outside that container MAKEFUN_OUTPUT_DIR can point elsewhere:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Run it twice and the bytes come out identical — the copy and the dossier
// are deterministic, so a re-run is a clean check, not a new submission.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Caps the scorer enforces (from its reference/gate.json): text_max_bytes is
// the only one that shapes the dossier's bytes; the rest reject an entry the
// scorer would reject anyway — more than 4 screenshots, any screenshot over
// 256 KiB, more than 993 files under game/, game/ over 48 MiB in total, or
// any path under game/ longer than 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

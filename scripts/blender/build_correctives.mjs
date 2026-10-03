import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const blender = process.argv[2] ?? process.env.BLENDER_BIN;
if (!blender) throw new Error('Provide the Blender executable path as the first argument or BLENDER_BIN.');
const run = (program, args) => {
  const result = spawnSync(program, args, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`Pipeline stopped: ${result.error?.message ?? `exit ${result.status}`}`);
};
run(process.execPath, ['scripts/blender/prepare_skinning.mjs']);
run(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', 'scripts/blender/inspect_skinning.py', '--', 'dev/models/human-anatomy-v2.glb', 'docs/audit/volume-correctives/skin-report.json']);
run(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', 'scripts/blender/volume_correctives.py', '--', 'dev/blender']);
run(process.execPath, ['scripts/blender/export_correctives.mjs']);

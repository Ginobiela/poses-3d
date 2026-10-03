import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const blender = process.argv[2] ?? process.env.BLENDER_BIN;
if (!blender) throw new Error('Provide the Blender executable path or BLENDER_BIN.');
const cwd = fileURLToPath(new URL('../../', import.meta.url));
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} failed (${result.status}); export stopped.`);
};
run(process.execPath, ['scripts/blender/shoulder_weights.mjs', '3']);
run(process.execPath, ['scripts/blender/prepare_shoulders.mjs']);
run(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', 'scripts/blender/shoulder_correctives.py', '--', 'dev/blender']);
run(process.execPath, ['scripts/blender/export_shoulders.mjs']);

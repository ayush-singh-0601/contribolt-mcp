import { spawnSync } from 'node:child_process';

const python = process.platform === 'win32' ? 'python' : 'python3';
const result = spawnSync(python, ['scripts/check-docs.py'], { stdio: 'inherit' });
if (result.error) console.error('Documentation checks require Python 3: ' + result.error.message);
process.exit(result.status ?? 1);

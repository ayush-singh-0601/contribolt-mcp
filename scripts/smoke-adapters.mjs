/** Run detected native commands against an actual failing regression and its focused fix. */
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { builtinRegistry } from '../dist/languages/registry.js';
import { runProcess } from '../dist/execution/runner.js';

const fixtures = JSON.parse(
  await readFile(new URL('./native-adapter-fixtures.json', import.meta.url), 'utf8'),
);
const requested = process.argv[2];
const example = fixtures.find((fixture) => fixture.id === requested);
if (!example)
  throw new Error(
    'Specify one native adapter: ' + fixtures.map((fixture) => fixture.id).join(', '),
  );
const root = await mkdtemp(join(tmpdir(), 'mergepilot-adapter-'));
const records = [];
async function run(command, expected = 'PASS') {
  const result = await runProcess(command);
  const status =
    result.unavailable || (command.kind === 'test' && !result.output.trim())
      ? 'UNAVAILABLE'
      : result.cancelled
        ? 'SKIPPED'
        : result.exitCode === 0 && !(command.executable === 'gofmt' && result.output.trim())
          ? 'PASS'
          : 'FAIL';
  records.push({
    command: { ...command, cwd: '<fixture>' },
    expected,
    status,
    ...result,
    output: result.output.replaceAll(root, '<fixture>'),
  });
  if (status !== expected)
    throw new Error(
      `${command.executable} ${command.args.join(' ')}: expected ${expected}, observed ${status}\n${result.output}`,
    );
}
try {
  for (const [file, content] of Object.entries(example.files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), content);
  }
  const context = { root, scope: '', files: Object.keys(example.files), content: example.files };
  const adapter = builtinRegistry()
    .detect(context)
    .find((adapter) => adapter.id === requested);
  if (!adapter) throw new Error('Fixture did not detect its native adapter');
  for (const [executable, args] of example.prepare ?? [])
    await run({
      id: 'fixture-prepare',
      name: 'Fixture setup',
      kind: 'bootstrap',
      executable,
      args,
      cwd: root,
      required: true,
      network: true,
      timeoutMs: 600000,
      source: 'qualification fixture',
    });
  for (const command of adapter.planEnvironment(context).bootstrap) await run(command);
  const commands = adapter.commands(context);
  const test = commands.find((command) => command.kind === 'test');
  if (!test) throw new Error('Adapter did not produce a regression command');
  await run(test, 'FAIL');
  for (const [file, content] of Object.entries(example.fix))
    await writeFile(join(root, file), content);
  for (const command of commands) await run(command);
  const target = resolve(process.env.MERGEPILOT_NATIVE_EVIDENCE_DIR ?? 'qualification/native');
  await mkdir(target, { recursive: true });
  await writeFile(
    join(target, requested + '.json'),
    JSON.stringify(
      {
        status: 'PASS',
        adapter: requested,
        checkedAt: new Date().toISOString(),
        platform: process.platform,
        node: process.versions.node,
        checks: records,
        publicWrites: 0,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `${requested}: native failing baseline, passing correction and ${commands.length} adapter checks; zero public writes`,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

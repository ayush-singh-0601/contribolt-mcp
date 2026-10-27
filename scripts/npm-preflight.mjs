import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (
  pkg.publishConfig?.registry !== 'https://registry.npmjs.org/' ||
  pkg.publishConfig?.access !== 'public'
)
  throw new Error('Release must target the public npm registry');
const response = await fetch('https://registry.npmjs.org/' + encodeURIComponent(pkg.name), {
  signal: AbortSignal.timeout(30000),
});
if (response.status === 404) {
  console.log(
    JSON.stringify({
      package: pkg.name,
      version: pkg.version,
      registryStatus: 'not registered',
      checkedAt: new Date().toISOString(),
    }),
  );
} else {
  if (!response.ok) throw new Error('npm registry check failed: HTTP ' + response.status);
  const metadata = await response.json();
  if (metadata.versions?.[pkg.version])
    throw new Error(
      `${pkg.name}@${pkg.version} already exists; npm versions cannot be overwritten`,
    );
  console.log(
    JSON.stringify({
      package: pkg.name,
      version: pkg.version,
      registryStatus: 'existing package; publishing rights required',
      maintainers: (metadata.maintainers ?? []).map((m) => m.name),
      checkedAt: new Date().toISOString(),
    }),
  );
}

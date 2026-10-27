import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const readme = await readFile(new URL('README.md', root), 'utf8');
const urls = [
  ...new Set(readme.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/contribolt-mcp@[^"\s<]+/g)),
];
if (urls.length !== 3 || urls.some((url) => !url.includes(`@${pkg.version}/docs/assets/`)))
  throw new Error('README must reference the three bundled images from this exact release');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const deadline = Date.now() + 10 * 60 * 1000;
while (true) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${pkg.name}`, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`npm metadata HTTP ${response.status}`);
    const metadata = await response.json();
    const version = metadata.versions?.[pkg.version];
    if (metadata['dist-tags']?.latest !== pkg.version || !version)
      throw new Error('npm latest version is still processing');
    for (const field of ['description', 'homepage', 'bugs', 'bin', 'engines', 'keywords'])
      if (JSON.stringify(version[field]) !== JSON.stringify(pkg[field]))
        throw new Error(`Public npm metadata differs: ${field}`);
    const publishedReadme = metadata.readme ?? version.readme ?? '';
    if (!urls.every((url) => publishedReadme.includes(url)))
      throw new Error('npm README is still processing');
    const assets = [];
    for (const url of urls) {
      const image = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(15000),
      });
      if (!image.ok) throw new Error(`Image HTTP ${image.status}: ${url}`);
      if (!image.headers.get('content-type')?.includes('image/svg+xml'))
        throw new Error(`Unexpected image response: ${url}`);
      const name = new URL(url).pathname.split('/').at(-1);
      const expected = await readFile(new URL(`docs/assets/${name}`, root));
      if (hash(new Uint8Array(await image.arrayBuffer())) !== hash(expected))
        throw new Error(`Published image differs: ${name}`);
      assets.push(name);
    }
    console.log(
      JSON.stringify({
        status: 'PASS',
        package: `${pkg.name}@${pkg.version}`,
        metadata: 'matches source',
        readme: 'release images present',
        cdnAssets: assets,
        contentHashesMatch: true,
      }),
    );
    break;
  } catch (error) {
    if (Date.now() >= deadline) throw error;
    console.log(`Waiting for public npm/CDN presentation: ${error.message}`);
    await delay(15000);
  }
}

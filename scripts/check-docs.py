"""Validate local documentation targets, anchors, SVG safety, demo evidence and package identity."""
from collections import Counter
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import struct
import unicodedata
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
files = [*root.glob("*.md"), *root.glob("docs/**/*.md"), *root.glob("examples/*.md"),
         *root.glob(".github/*.md")]
errors = []
checked = 0
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
cdn = f"https://cdn.jsdelivr.net/npm/contribolt-mcp@{version}/"


def without_code(text):
    return re.sub(r"^(`{3,}|~{3,}).*?^\1[^\n]*$", "", text, flags=re.M | re.S)


def anchors(text):
    counts = Counter()
    result = set(re.findall(r'\bid=["\']([^"\']+)["\']', text))
    for match in re.finditer(r"^#{1,6}\s+(.+?)\s*#*\s*$", without_code(text), re.M):
        heading = re.sub(r"<[^>]+>|[`*_]", "", match[1]).lower()
        slug = ''.join(c for c in heading if c in ' -_' or unicodedata.category(c)[0] in 'LN').replace(' ', '-')
        number = counts[slug]
        counts[slug] += 1
        result.add(slug + (f"-{number}" if number else ""))
    return result


def check(path, target):
    global checked
    target = target.replace('&amp;', '&')
    if target.startswith(cdn):
        local = root / target[len(cdn):]
        if not local.is_file(): errors.append(f"{path.relative_to(root)}: missing bundled CDN asset {target}")
        checked += 1
        return
    parsed = urlsplit(target)
    if parsed.scheme or parsed.netloc: return
    destination = (path.parent / unquote(parsed.path)).resolve() if parsed.path else path
    if not destination.exists():
        errors.append(f"{path.relative_to(root)}: missing {target}")
    elif parsed.fragment and destination.suffix == '.md' and unquote(parsed.fragment) not in anchors(destination.read_text(encoding='utf-8')):
        errors.append(f"{path.relative_to(root)}: missing anchor {target}")
    checked += 1


class Links(HTMLParser):
    def __init__(self, path):
        super().__init__(); self.path = path

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name in ['href', 'src']:
            if name in attrs: check(self.path, attrs[name])
        if tag == 'img' and not attrs.get('alt'): errors.append(f'{self.path}: image needs alt text')


for path in files:
    # Preserve the original product specification's illustrative links verbatim.
    if path.name == 'PRD.md': continue
    text = without_code(path.read_text(encoding='utf-8'))
    for match in re.finditer(r'!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)', text): check(path, match[1])
    Links(path).feed(text)

for path in (root / 'docs/assets').glob('*.svg'):
    tree = ET.parse(path).getroot()
    assert tree.tag.endswith('svg') and tree.get('viewBox'), str(path)
    assert tree.find('{http://www.w3.org/2000/svg}title') is not None
    assert tree.find('{http://www.w3.org/2000/svg}desc') is not None
    for element in tree.iter():
        assert not element.tag.endswith(('script', 'foreignObject')), str(path)
        for name, value in element.attrib.items():
            assert not name.lower().startswith('on'), str(path)
            if name.endswith('href'): assert value.startswith('#'), str(path)
    assert path.stat().st_size < 30000, str(path)

png = (root / 'docs/assets/social-preview.png').read_bytes()
assert png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', png[16:24]) == (1280, 640)
assert len(png) < 1000000
evidence = json.loads((root / 'docs/assets/demo-evidence.json').read_text(encoding='utf-8'))
assert evidence['publicWrites'] == 0
for stage, status in [('baseline', 'FAIL'), ('fixed', 'PASS')]:
    assert evidence[stage]['status'] == status
    assert hashlib.sha256(evidence[stage]['output'].encode()).hexdigest() == evidence[stage]['normalizedOutputHash']
pkg = json.loads((root / 'package.json').read_text(encoding='utf-8'))
lock = json.loads((root / 'package-lock.json').read_text(encoding='utf-8'))
assert pkg['name'] == lock['name'] == 'contribolt-mcp'
assert pkg['version'] == lock['version'] == lock['packages']['']['version']
assert re.search(r"export const VERSION = '([^']+)'", (root / 'src/index.ts').read_text())[1] == pkg['version']
assert pkg['bin'] == {'contribolt': 'dist/cli.js'}
assert pkg['engines'] == lock['packages']['']['engines'] == {'node': '^22.13.0 || >=24.0.0'}
assert pkg['license'] == 'MIT' and not pkg.get('main') and not pkg.get('exports')
if errors: raise SystemExit('\n'.join(errors))
print(json.dumps({'status': 'PASS', 'markdownFiles': len(files), 'localTargetsAndAnchors': checked,
                  'svgAssets': len(list((root/'docs/assets').glob('*.svg'))),
                  'socialPreview': '1280x640, below 1 MB', 'demoEvidence': 'hashes verified; zero public writes',
                  'packageIdentity': 'unchanged',
                  'externalScope': 'Bundled versioned CDN targets checked; the publication workflow verifies public delivery.'}, indent=2))

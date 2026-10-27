"""Generate portable ContriBolt SVG assets from vector geometry and recorded demo evidence."""
import argparse
from html import escape
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--png", action="store_true", help="Also render the social PNG with ImageMagick/librsvg")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = root / "docs/assets"
out.mkdir(exist_ok=True)
ink, panel, mint, lime, paper, muted = "#102B35", "#173A43", "#5CE0AB", "#D5F57A", "#F5FAF7", "#ADC7C8"
font = 'font-family="DejaVu Sans,Arial,sans-serif"'
mono = 'font-family="DejaVu Sans Mono,monospace"'


def svg(name, width, height, title, desc, body):
    text = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">'
            f'<title id="title">{escape(title)}</title><desc id="desc">{escape(desc)}</desc>{body}</svg>\n')
    (out / name).write_text(text, encoding="utf-8")


def mark(x=0, y=0, scale=1):
    return (f'<g transform="translate({x} {y}) scale({scale})">'
            f'<rect width="80" height="80" rx="23" fill="{mint}"/>'
            f'<path d="M22 23v34M22 43h16c13 0 18-7 18-20" fill="none" stroke="{ink}" '
            'stroke-width="5" stroke-linecap="round"/>'
            f'<g fill="{mint}" stroke="{ink}" stroke-width="4.5">'
            '<circle cx="22" cy="19" r="6"/><circle cx="22" cy="61" r="6"/>'
            '<circle cx="56" cy="19" r="6"/></g>'
            f'<path d="m46 29-15 19h11l-4 17 18-24H45l5-12Z" fill="{ink}" stroke="{mint}" stroke-width="2"/>'
            '</g>')


svg("mark.svg", 80, 80, "ContriBolt mark", "A contribution branch joined to a lightning bolt.", mark())
svg("logo.svg", 420, 100, "ContriBolt MCP", "ContriBolt MCP: a branch and bolt, in mint and deep ink.",
    f'<rect width="420" height="100" rx="25" fill="{ink}"/>{mark(12, 12, .95)}'
    f'<text x="106" y="64" {font} font-size="38" font-weight="700" letter-spacing="-1.6" fill="{paper}">ContriBolt</text>'
    f'<rect x="332" y="36" width="67" height="30" rx="9" fill="{panel}"/>'
    f'<text x="365" y="56" {mono} font-size="16" text-anchor="middle" fill="{mint}">MCP</text>')

grid = ''.join(f'<path d="M{x} 0v640"/>' for x in range(720, 1281, 64))
grid += ''.join(f'<path d="M704 {y}h576"/>' for y in range(0, 641, 64))
social = (f'<rect width="1280" height="640" fill="{ink}"/>'
          f'<g stroke="{mint}" stroke-opacity=".07">{grid}</g>'
          f'<rect x="0" y="0" width="12" height="640" fill="{mint}"/>'
          f'{mark(64, 56, .9)}<text x="156" y="103" {font} font-size="34" font-weight="700" fill="{paper}">ContriBolt</text>'
          f'<text x="159" y="130" {mono} font-size="14" letter-spacing="3" fill="{mint}">MCP CONTRIBUTION ASSISTANT</text>'
          f'<text x="64" y="257" {font} font-size="64" font-weight="700" letter-spacing="-2" fill="{paper}">From open issue</text>'
          f'<text x="64" y="337" {font} font-size="64" font-weight="700" letter-spacing="-2" fill="{paper}">to pull request.</text>'
          f'<text x="68" y="398" {font} font-size="23" fill="{muted}">Your AI-powered open-source contribution agent.</text>'
          f'<path d="M938 215v200c0 50 38 76 85 76h57M938 322h90c54 0 92-33 92-83v-24" fill="none" stroke="{mint}" stroke-width="12" stroke-linecap="round"/>'
          f'<g fill="{ink}" stroke="{mint}" stroke-width="10"><circle cx="938" cy="198" r="24"/>'
          '<circle cx="1120" cy="198" r="24"/><circle cx="1100" cy="491" r="24"/></g>'
          f'<path d="m1054 307-74 97h53l-21 87 94-126h-57l28-58Z" fill="{lime}" stroke="{ink}" stroke-width="10"/>'
          f'<rect x="64" y="491" width="670" height="62" rx="14" fill="{panel}"/>'
          f'<text x="86" y="531" {mono} font-size="22" fill="{mint}">npx --yes contribolt-mcp configure codex</text>'
          f'<text x="68" y="598" {font} font-size="17" fill="{muted}">Find an eligible issue. Make a focused fix. Approve the PR.</text>')
svg("social-preview.svg", 1280, 640, "ContriBolt — From open issue to pull request.",
    "An MCP contribution assistant for your coding agent. Discovery, focused fixes and developer-approved pull requests.", social)

steps = [
    ("01", "Discover an eligible issue", "ContriBolt · remote reads + local records"),
    ("02", "Inspect policy and code", "ContriBolt + host · local clone"),
    ("03", "Implement a focused fix", "Host coding agent · workspace edits"),
    ("04", "Validate with evidence", "Host-approved commands · captured results"),
    ("05", "Review the PR preview", "You + host · no public contribution write"),
    ("06", "Approve publication", "Your terminal approval · then fresh recheck"),
]
workflow = f'<rect width="500" height="638" rx="24" fill="{paper}"/>'
workflow += f'<text x="30" y="37" {mono} font-size="12" letter-spacing="2" fill="#237A57">THE CONTRIBUTION WORKFLOW</text>'
for index, (number, title, subtitle) in enumerate(steps):
    y = 56 + index * 94
    if index < 5:
        workflow += f'<path d="M52 {y+62}v38" stroke="#B5CEBF" stroke-width="2"/>'
    stroke = '#237A57' if index == 5 else '#D5E3DB'
    workflow += (f'<rect x="26" y="{y}" width="448" height="78" rx="14" fill="white" stroke="{stroke}"/>'
                 f'<rect x="40" y="{y+19}" width="38" height="38" rx="12" fill="{ink}"/>'
                 f'<text x="59" y="{y+44}" {mono} font-size="14" text-anchor="middle" fill="{mint}">{number}</text>'
                 f'<text x="93" y="{y+33}" {font} font-size="20" font-weight="700" fill="{ink}">{escape(title)}</text>'
                 f'<text x="93" y="{y+57}" {font} font-size="12.5" fill="#526876">{escape(subtitle)}</text>')
workflow += f'<text x="30" y="626" {font} font-size="12" fill="#526876">Default: dry run. The host supplies the execution sandbox.</text>'
svg("workflow.svg", 500, 638, "From verified issue to approved pull request", "Six stages, with the owner of each step and an explicit human approval before public writes.", workflow)

evidence = json.loads((out / "demo-evidence.json").read_text(encoding="utf-8"))
assert evidence["baseline"]["status"] == "FAIL" and evidence["fixed"]["status"] == "PASS"
assert evidence["publicWrites"] == 0
demo = (f'<rect width="720" height="350" rx="20" fill="{ink}"/>'
        f'<path d="M0 51h720" stroke="{panel}"/>'
        '<g fill="#6E9393"><circle cx="25" cy="26" r="4"/><circle cx="41" cy="26" r="4"/><circle cx="57" cy="26" r="4"/></g>'
        f'<text x="88" y="31" {mono} font-size="13" fill="{muted}">ContriBolt / controlled Python fixture</text>'
        f'<text x="30" y="88" {mono} font-size="15" fill="{mint}">$ sh test.sh</text>'
        f'<text x="30" y="121" {mono} font-size="16" fill="#FFB8A7">FAIL  baseline</text>'
        f'<text x="30" y="150" {mono} font-size="15" fill="{muted}">assert increment(1) == 2</text>'
        f'<text x="30" y="176" {mono} font-size="15" fill="{muted}">AssertionError</text>'
        f'<text x="30" y="221" {mono} font-size="16" fill="{mint}">PASS  after the focused fix</text>'
        f'<text x="30" y="250" {mono} font-size="15" fill="{paper}">{escape(evidence["fixed"]["output"].strip())}</text>'
        f'<rect x="22" y="280" width="676" height="48" rx="12" fill="{panel}"/>'
        f'<text x="38" y="310" {mono} font-size="14" fill="{lime}">PR dry-run preview · 0 public writes · fixture API data</text>')
svg("demo.svg", 720, 350, "Recorded controlled Python contribution example", "A designed rendering of real fixture evidence, not a live product screenshot. Baseline fails, two regression checks pass after the fix, and the PR remains a dry-run preview.", demo)

if args.png:
    subprocess.run(["magick", "-background", ink, str(out / "social-preview.svg"),
                    "-strip", str(out / "social-preview.png")], check=True)
print("Generated logo, mark, workflow, recorded demo and 1280×640 social preview.")

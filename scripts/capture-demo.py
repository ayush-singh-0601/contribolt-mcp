"""Capture the real controlled Python contribution test. No live forge calls or public writes."""
import json
import os
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
private = root / ".contribolt/qualification/showcase"
private.mkdir(parents=True, exist_ok=True)
environment = dict(os.environ, CONTRIBOLT_EVIDENCE_DIR=str(private / "native"), NO_COLOR="1")
command = ["node", "node_modules/vitest/vitest.mjs", "run", "tests/multilanguage-e2e.test.ts",
           "-t", "native Python contribution dry run", "--reporter=verbose"]
result = subprocess.run(command, cwd=root, env=environment, capture_output=True,
                        text=True, encoding="utf-8", timeout=120)
raw = result.stdout + result.stderr
(private / "python-demo.log").write_text(raw, encoding="utf-8")
result.check_returncode()
data = json.loads((private / "native/python.json").read_text(encoding="utf-8"))
assert data["baseline"]["status"] == "FAIL" and data["fixed"]["status"] == "PASS"
assert data["publicWrites"] == 0
assets = root / "docs/assets"
assets.mkdir(exist_ok=True)
(assets / "demo-evidence.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
normalized = re.sub(r"\x1b\[[0-9;]*m", "", raw).replace(str(root), "<project>")
(assets / "demo-transcript.txt").write_text(
    "Controlled fixture capture. Real native checks; mocked forge responses; no live public PR.\n"
    "ANSI color removed; project path normalized to <project>.\n\n$ " + " ".join(command) + "\n\n" + normalized.rstrip() + "\n",
    encoding="utf-8")
print("Captured failing baseline, passing Python checks and zero-write PR preview.")

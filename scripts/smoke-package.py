"""Install the actual release archive into an empty directory and verify its executable."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
package = json.loads((root / "package.json").read_text())
archive = root / (package["name"] + "-" + package["version"] + ".tgz")
assert archive.is_file(), "Run npm pack first"
npm = shutil.which("npm")
assert npm, "npm is required"
with tempfile.TemporaryDirectory(prefix="contribolt-package-") as directory:
    install = Path(directory)
    (install / "package.json").write_text('{"name":"package-qualification","private":true}')
    subprocess.run([npm, "install", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund",
                    "--package-lock=false", str(archive)], cwd=install, check=True,
                   timeout=180, shell=os.name == "nt")
    cli = install / "node_modules" / package["name"] / "dist" / "cli.js"
    subprocess.run(["node", str(cli), "--version"], check=True, timeout=15)
    subprocess.run(["node", str(cli), "--help"], check=True, timeout=15,
                   stdout=subprocess.DEVNULL)
    diagnostic = subprocess.run(["node", str(cli), "doctor", "--json"], check=True,
                                timeout=30, capture_output=True, text=True,
                                env=dict(os.environ, CONTRIBOLT_DATA_DIR=str(install / "private-state")))
    assert json.loads(diagnostic.stdout)["canStartLocal"], "Installed runtime is not usable"
    subprocess.run([shutil.which("python") or "python3", str(root / "scripts/smoke-stdio.py"),
                    str(cli)], check=True, timeout=90)
    print(json.dumps({"status": "PASS", "installedArchive": archive.name,
                      "checks": ["empty-directory install", "version", "help", "runtime diagnostics", "installed STDIO"]}))

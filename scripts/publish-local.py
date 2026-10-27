"""Publish the audited ContriBolt archive locally, verify it, then mark the previous package as renamed."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
package = json.loads((root / "package.json").read_text(encoding="utf-8"))
archive = root / (package["name"] + "-" + package["version"] + ".tgz")
manifest = json.loads((root / "release-manifest.json").read_text(encoding="utf-8"))
assert package["name"] == "contribolt-mcp", "Unexpected npm package name"
assert archive.is_file(), "Build and audit the release archive first"
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest["sha256"], "Archive differs from the audited candidate"
npm = shutil.which("npm")
assert npm, "npm is required"
version = subprocess.run(["node", str(root / "dist/cli.js"), "--version"], check=True,
                         capture_output=True, text=True, encoding="utf-8").stdout
assert version.strip() == package["version"], "Build this release before publishing with a supported Node runtime"
identity = subprocess.run([npm, "whoami", "--registry=https://registry.npmjs.org/"], check=True,
                          capture_output=True, text=True, encoding="utf-8", timeout=30, shell=os.name == "nt")
assert identity.stdout.strip() == "neaoooo", "Log in with npm login using the publishing account neaoooo"
subprocess.run([npm, "publish", str(archive), "--ignore-scripts", "--access", "public", "--provenance=false",
                "--registry=https://registry.npmjs.org/"],
               cwd=root, check=True, shell=os.name == "nt")
subprocess.run([sys.executable, str(root / "scripts/smoke-registry.py")], cwd=root, check=True)
# Published npm package names are immutable; retain existing installations with a migration notice.
subprocess.run([npm, "deprecate", "mergepilot-mcp@*",
                "Renamed to contribolt-mcp. Install contribolt-mcp instead.", "--registry=https://registry.npmjs.org/"],
               check=True, shell=os.name == "nt")
print("Published and verified contribolt-mcp; the previous npm package has a migration notice.")

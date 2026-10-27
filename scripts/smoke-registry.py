"""Install the public npm release and validate its real MCP behavior and archive integrity."""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from registry_install import install_public

root = Path(__file__).resolve().parents[1]
package = json.loads((root / "package.json").read_text(encoding="utf-8"))
spec = package["name"] + "@" + package["version"]
archive = root / (package["name"] + "-" + package["version"] + ".tgz")
expected = "sha512-" + base64.b64encode(hashlib.sha512(archive.read_bytes()).digest()).decode("ascii")
npm = shutil.which("npm")
assert npm, "npm is required"
metadata_url = "https://registry.npmjs.org/" + quote(package["name"], safe="") + "/" + package["version"]
deadline = time.monotonic() + 600
while True:
    try:
        with urlopen(Request(metadata_url, headers={"Cache-Control": "no-cache"}), timeout=15) as response:
            metadata = json.load(response)
        break
    except (HTTPError, URLError, TimeoutError) as error:
        if isinstance(error, HTTPError) and error.code not in (404, 429, 500, 502, 503, 504):
            raise
        if time.monotonic() >= deadline:
            raise
        print("Waiting for npm to finish processing " + spec, flush=True)
        time.sleep(10)
assert metadata["dist"]["integrity"] == expected, "Published archive differs from the validated release candidate"
with tempfile.TemporaryDirectory(prefix="contribolt-registry-") as directory:
    install = Path(directory)
    (install / "package.json").write_text('{"name":"registry-qualification","private":true}', encoding="utf-8")
    config = install / "public-registry.npmrc"
    config.write_text("registry=https://registry.npmjs.org/\n", encoding="utf-8")
    environment = dict(os.environ)
    for name in ("NODE_AUTH_TOKEN", "NPM_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"):
        environment.pop(name, None)
    install_command = [npm, "install", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund",
                       "--prefer-online", "--cache=" + str(install / "npm-cache"),
                       "--userconfig=" + str(config), "--registry=https://registry.npmjs.org/", spec]
    # Windows uses npm.cmd; the public verification workflow runs on Linux.
    if os.name == "nt":
        install_command = ["cmd.exe", "/d", "/s", "/c", subprocess.list2cmdline(install_command)]
    install_public(install_command, cwd=install, env=environment, deadline=deadline)
    cli = install / "node_modules" / package["name"] / "dist" / "cli.js"
    version = subprocess.run(["node", str(cli), "--version"], check=True, capture_output=True,
                             text=True, encoding="utf-8", timeout=15)
    assert version.stdout.strip() == package["version"]
    subprocess.run([sys.executable, str(root / "scripts/smoke-stdio.py"), str(cli), "--require-sdk"], check=True, timeout=90)
    subprocess.run([sys.executable, str(root / "scripts/smoke-stdio.py"), str(cli), "--require-sdk", "--modern"], check=True, timeout=90)
    print(json.dumps({"status": "PASS", "installedFrom": "https://registry.npmjs.org/", "package": spec,
                      "integrityMatchesValidatedArchive": True, "modelTurns": 0, "publicContributionWrites": 0}))

"""Check release contents, requirement traceability, source links and native evidence."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import tarfile
from urllib.parse import unquote

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("tarball", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
with tarfile.open(args.tarball) as archive:
    members = archive.getmembers()
    names = {member.name for member in members}
    for member in members:
        name = member.name
        assert member.isfile(), f"Unexpected non-file archive entry: {name}"
        assert name.startswith("package/") and ".." not in Path(name).parts
        assert not re.search(r"(?:^|/)(?:node_modules|\.git|\.env|\.mergepilot)(?:/|$)|\.sqlite", name), name
        assert name in {"package/package.json", "package/README.md", "package/LICENSE", "package/CHANGELOG.md"} or any(
            name.startswith("package/" + directory + "/") for directory in ["dist", "docs", "examples"]
        ), name
    assert {"package/dist/cli.js", "package/dist/dashboard/index.html", "package/LICENSE", "package/README.md"}.issubset(names)
    assert archive.extractfile("package/dist/cli.js").read().startswith(b"#!/usr/bin/env node\n")

requirements = json.loads((root / "docs/requirements.json").read_text(encoding="utf-8"))
assert len(requirements) == 236
assert len({row["id"] for row in requirements}) == 236
for row in requirements:
    assert row["status"] not in {"pending", "complete"}
    assert row["notes"] and row["evidence"]
    for evidence in row["evidence"]:
        assert (root / evidence).exists(), evidence

native = list((root / "docs/evidence/native").glob("*.json"))
assert len(native) == 6
for path in native:
    evidence = json.loads(path.read_text(encoding="utf-8"))
    assert evidence["baseline"]["status"] == "FAIL"
    assert evidence["fixed"]["status"] == "PASS"
    assert evidence["publicWrites"] == 0
    for stage in ["baseline", "fixed"]:
        assert hashlib.sha256(evidence[stage]["output"].encode()).hexdigest() == evidence[stage]["normalizedOutputHash"]

broken = []
for path in [root / "README.md", *root.glob("docs/*.md"), *root.glob("examples/*.md")]:
    if path.name == "PRD.md":
        continue
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", path.read_text(encoding="utf-8")):
        if re.match(r"https?://|mailto:|#", target):
            continue
        destination = unquote(target.split("#")[0].split(" \"")[0])
        if destination and not (path.parent / destination).exists():
            broken.append(f"{path.relative_to(root)} -> {target}")
assert not broken, "Broken documentation links: " + repr(broken)

original = root.parent / "MergePilot_MCP_PRD.md"
if original.exists():
    assert original.read_bytes() == (root / "docs/PRD.md").read_bytes()
print(json.dumps({"files": len(members), "bytes": args.tarball.stat().st_size,
                  "sha256": hashlib.sha256(args.tarball.read_bytes()).hexdigest(),
                  "requirementsAudited": len(requirements), "nativeEcosystems": len(native),
                  "archiveAndDocumentationChecks": "PASS"}, indent=2))

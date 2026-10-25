"""Check a real Claude Code MCP handshake without login, model turns or public actions."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--claude", default="claude")
parser.add_argument("--node", default="node")
parser.add_argument("--cli", default="dist/cli.js", type=Path)
args = parser.parse_args()
with tempfile.TemporaryDirectory(prefix="mergepilot-claude-") as directory:
    project = Path(directory)
    subprocess.run([args.node, str(args.cli.resolve()), "configure", "claude", "--local",
                    "--project", str(project)], check=True, capture_output=True,
                   text=True, timeout=20)
    result = subprocess.run([args.claude, "--mcp-config", str(project / ".mcp.json"),
                             "--strict-mcp-config", "--settings",
                             '{"enableAllProjectMcpServers":true}', "mcp", "list"],
                            cwd=project, env=dict(os.environ, CLAUDE_CONFIG_DIR=str(project / "client-state")),
                            capture_output=True, text=True, timeout=90)
    text = re.sub(r"\x1b\[[0-9;]*m", "", result.stdout + result.stderr)
    if result.returncode or not any("mergepilot" in line and "Connected" in line
                                   for line in text.splitlines()):
        # A disposable config has no account credentials; redact known token patterns anyway.
        detail = re.sub(r"(?:Bearer\s+\S+|gh[pousr]_\w+|github_pat_\w+)", "[REDACTED]", text[-6000:])
        raise RuntimeError("Claude Code did not confirm an MCP connection: " + detail)
    print(json.dumps({"status": "PASS", "client": "Claude Code", "modelTurns": 0,
                      "publicWrites": 0, "checked": ["real MCP initialization", "approved disposable config"]}))

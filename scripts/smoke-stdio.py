"""Exercise the installed CLI over real STDIO without a forge credential or socket."""
import json
import os
import subprocess
import sys
import tempfile

cli = sys.argv[1] if len(sys.argv) > 1 else "dist/cli.js"
with tempfile.TemporaryDirectory(prefix="mergepilot-smoke-") as state:
    env = dict(os.environ, MERGEPILOT_DATA_DIR=state)
    for name in ("MERGEPILOT_GITHUB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"):
        env.pop(name, None)
    requests = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-06-18", "capabilities": {},
            "clientInfo": {"name": "mergepilot-smoke", "version": "1.0"}}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        {"jsonrpc": "2.0", "id": 3, "method": "prompts/list"},
    ]
    payload = "".join(json.dumps(request) + "\n" for request in requests)
    completed = subprocess.run(["node", cli, "mcp"], input=payload, text=True,
                               capture_output=True, timeout=20, env=env)
    if completed.returncode:
        raise RuntimeError(completed.stderr)
    replies = {reply["id"]: reply for line in completed.stdout.splitlines()
               if "id" in (reply := json.loads(line))}
    assert replies[1]["result"]["serverInfo"]["name"] == "mergepilot"
    assert len(replies[2]["result"]["tools"]) == 21
    assert len(replies[3]["result"]["prompts"]) == 6
    print("PASS: real STDIO initialization, 21 tools, six prompts; " +
          ("compatibility transport" if "compatibility transport" in completed.stderr else "SDK transport"))

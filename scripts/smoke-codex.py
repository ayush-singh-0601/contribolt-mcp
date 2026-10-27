"""Verify the real Codex MCP connection without starting a model turn or public action."""
import argparse
import json
from pathlib import Path
import queue
import re
import sys
import subprocess
import tempfile
import threading
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--node", default="node")
parser.add_argument("--codex", default="codex")
parser.add_argument("--cli", default="dist/cli.js", type=Path)
args = parser.parse_args()
cli = args.cli.resolve()

with tempfile.TemporaryDirectory(prefix="contribolt-codex-") as directory:
    project = Path(directory)
    configured = subprocess.run([args.node, str(cli), "configure", "codex", "--local",
                                 "--project", str(project)], capture_output=True, text=True,
                                timeout=20, check=True)
    definition = json.loads(configured.stdout)["definition"]
    overrides = []
    overrides.extend(["-c", "projects={" + json.dumps(str(project)) + '={trust_level="trusted"}}'])
    for key, value in definition.items():
        toml = ("{" + ",".join(json.dumps(k) + "=" + json.dumps(v)
                                for k, v in value.items()) + "}") if isinstance(value, dict) else json.dumps(value)
        overrides.extend(["-c", "mcp_servers.contribolt." + key + "=" + toml])
    overrides.extend(["-c", "mcp_servers.contribolt.required=true"])
    process = subprocess.Popen([args.codex, *overrides, "app-server", "--stdio"],
                               cwd=project, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, bufsize=1)
    replies = queue.Queue()
    diagnostics = []

    def collect(stream):
        for line in stream:
            try:
                replies.put(json.loads(line))
            except json.JSONDecodeError:
                diagnostics.append("Non-JSON app-server output")
        replies.put(None)

    def drain_errors():
        # Do not persist host logs, which can contain unrelated account metadata.
        for line in process.stderr:
            if len(diagnostics) < 15 and re.search(r"error|failed|permission|read.only", line, re.I):
                diagnostics.append(re.sub(r"(?:Bearer\s+\S+|gh[pousr]_\w+|github_pat_\w+)", "[REDACTED]",line.strip()))

    threading.Thread(target=collect, args=(process.stdout,), daemon=True).start()
    threading.Thread(target=drain_errors, daemon=True).start()

    def send(payload):
        process.stdin.write(json.dumps(payload) + "\n")
        process.stdin.flush()

    def rpc(method, params):
        nonlocal_id = rpc.counter = getattr(rpc, "counter", 0) + 1
        send({"id": nonlocal_id, "method": method, "params": params})
        deadline = time.monotonic() + 30
        while True:
            item = replies.get(timeout=max(0.01, deadline - time.monotonic()))
            if item is None:
                raise RuntimeError("Codex app-server exited before replying")
            if item.get("id") == nonlocal_id and "method" not in item:
                if "error" in item:
                    raise RuntimeError(method + ": " + json.dumps(item["error"]))
                return item["result"]
            if "method" in item and "id" in item:
                send({"id": item["id"], "error": {"code": -32000,
                     "message": "Qualification does not approve host/public actions"}})
            if time.monotonic() >= deadline:
                raise TimeoutError(method + " did not complete")

    try:
        rpc("initialize", {"clientInfo": {"name": "contribolt_qualification", "version": "0.1.0"},
                           "capabilities": {"experimentalApi": True}})
        send({"method": "initialized", "params": {}})
        inventory = rpc("mcpServerStatus/list", {"serverName": "contribolt", "detail": "full"})
        servers = inventory.get("data", [])
        server = next(item for item in servers if item["name"] == "contribolt")
        assert len(server["tools"]) == 21, "Codex did not discover all 21 tools"
        thread = rpc("thread/start", {"cwd": str(project), "ephemeral": True,
                                       "approvalPolicy": "never"})["thread"]["id"]

        def call(tool, arguments):
            result = rpc("mcpServer/tool/call", {"threadId": thread, "server": "contribolt",
                                                "tool": tool, "arguments": arguments})
            result = result.get("result", result)
            if result.get("isError"):
                raise RuntimeError("MCP tool rejected " + tool)
            if "structuredContent" in result:
                return result["structuredContent"]
            return json.loads(next(item["text"] for item in result["content"] if item["type"] == "text"))

        started = call("start_contribution", {"dryRun": True})
        session = started["sessionId"]
        assert len(started["onboarding"]["questions"]) == 3
        call("set_preferences", {"sessionId": session, "preferences": {
             "languages": ["Python"], "difficulty": "small"}})
        status = call("get_status", {"sessionId": session})
        assert status["session"]["preferences"]["repositoryPreference"] == "any"
        call("control_session", {"sessionId": session, "action": "stop"})
        assert call("get_status", {"sessionId": session})["session"]["stopped"]
        call("resume_session", {"sessionId": session})
        assert not call("get_status", {"sessionId": session})["session"]["stopped"]
        print(json.dumps({"status": "PASS", "client": "Codex app-server", "tools": 21,
                          "checked": ["actual host MCP discovery", "three-question onboarding",
                                      "two-answer defaults", "status", "stop", "resume"],
                          "modelTurns": 0, "publicWrites": 0}))
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        if process.returncode and diagnostics:
            print("Codex diagnostic: " + "\n".join(diagnostics),file=sys.stderr)

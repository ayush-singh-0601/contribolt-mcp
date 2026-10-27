"""Retry a public npm install while new-release registry views converge."""
import re
import subprocess
import sys
import time


def install_public(command, *, cwd, env, deadline, run=subprocess.run,
                   now=time.monotonic, sleep=time.sleep):
    while True:
        remaining = deadline - now()
        if remaining <= 0:
            raise TimeoutError("Public npm installation did not become available before the deadline")
        result = run(command, cwd=cwd, env=env, check=False, capture_output=True,
                     text=True, encoding="utf-8", timeout=min(180, remaining))
        if result.returncode == 0:
            print(result.stdout, end="", flush=True)
            return
        diagnostic = result.stdout + result.stderr
        transient = re.search(r"\b(?:ETARGET|E404|E429|EAI_AGAIN|ECONNRESET|ETIMEDOUT|E502|E503|E504)\b", diagnostic)
        remaining = deadline - now()
        if not transient or remaining <= 0:
            print(diagnostic, file=sys.stderr, flush=True)
            raise subprocess.CalledProcessError(result.returncode, command,
                                                output=result.stdout, stderr=result.stderr)
        print("Waiting for npm's public installer to observe the published version", flush=True)
        sleep(min(10, remaining))

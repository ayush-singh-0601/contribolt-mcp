"""Exercise real MCP replies and local tool behavior without forge credentials or sockets."""
import argparse
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('cli', nargs='?', default='dist/cli.js', type=Path)
parser.add_argument('--node', default='node')
parser.add_argument('--require-sdk', action='store_true')
parser.add_argument('--modern', action='store_true')
args = parser.parse_args()
if args.modern and not args.require_sdk:
    parser.error('--modern requires --require-sdk; the fallback advertises only its legacy protocol')

with tempfile.TemporaryDirectory(prefix='mergepilot-smoke-') as state:
    env = dict(os.environ, MERGEPILOT_DATA_DIR=state)
    for name in ('MERGEPILOT_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN', 'MERGEPILOT_APP_ID',
                 'MERGEPILOT_APP_KEY', 'MERGEPILOT_INSTALLATION_ID'):
        env.pop(name, None)
    if args.require_sdk:
        env['MERGEPILOT_REQUIRE_SDK'] = '1'
    process = subprocess.Popen([args.node, str(args.cli.resolve()), 'mcp'], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8',
                               bufsize=1, env=env)
    messages = queue.Queue()
    stderr = []
    meta = {'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientInfo': {'name': 'mergepilot-smoke', 'version': '0.1.0'},
            'io.modelcontextprotocol/clientCapabilities': {}}

    def read_output():
        for line in process.stdout:
            try:
                messages.put(json.loads(line))
            except json.JSONDecodeError:
                messages.put({'invalidOutput': True})
        messages.put(None)

    def drain_errors():
        for line in process.stderr:
            if sum(map(len, stderr)) < 16000:
                stderr.append(line)

    threading.Thread(target=read_output, daemon=True).start()
    threading.Thread(target=drain_errors, daemon=True).start()

    def send(payload):
        process.stdin.write(json.dumps(payload) + '\n')
        process.stdin.flush()

    def rpc(method, params=None):
        request_id = rpc.counter = getattr(rpc, 'counter', 0) + 1
        params = dict(params or {})
        if args.modern:
            params['_meta'] = meta
        send({'jsonrpc': '2.0', 'id': request_id, 'method': method, 'params': params})
        deadline = time.monotonic() + 15
        while True:
            reply = messages.get(timeout=max(.01, deadline - time.monotonic()))
            if reply is None:
                raise RuntimeError('MCP process closed without a complete reply; exit=' + str(process.poll()))
            if reply.get('invalidOutput'):
                raise RuntimeError('Server wrote non-JSON data to its MCP stdout')
            if reply.get('id') == request_id:
                if 'error' in reply:
                    raise RuntimeError(method + ' returned JSON-RPC error ' + str(reply['error'].get('code')))
                return reply['result']
            if 'method' in reply and 'id' in reply:
                send({'jsonrpc': '2.0', 'id': reply['id'], 'error': {
                    'code': -32601, 'message': 'Qualification client has no side-effect capabilities'}})
            if time.monotonic() >= deadline:
                raise TimeoutError('MCP reply timed out: ' + method)

    def call(name, arguments):
        result = rpc('tools/call', {'name': name, 'arguments': arguments})
        assert not result.get('isError'), name + ' failed'
        return result.get('structuredContent') or json.loads(next(
            block['text'] for block in result['content'] if block['type'] == 'text'))

    try:
        if args.modern:
            rpc('server/discover')
        else:
            initialized = rpc('initialize', {'protocolVersion': '2025-06-18', 'capabilities': {},
                              'clientInfo': {'name': 'mergepilot-smoke', 'version': '0.1.0'}})
            assert initialized['serverInfo']['name'] == 'mergepilot'
            send({'jsonrpc': '2.0', 'method': 'notifications/initialized'})
        assert len(rpc('tools/list')['tools']) == 21
        assert len(rpc('prompts/list')['prompts']) == 6
        assert rpc('prompts/get', {'name': 'contribution'})['messages']
        started = call('start_contribution', {'dryRun': True})
        session = started['sessionId']
        assert len(started['onboarding']['questions']) == 3
        call('set_preferences', {'sessionId': session, 'preferences': {
            'languages': ['Python'], 'difficulty': 'small'}})
        assert call('get_status', {'sessionId': session})['session']['preferences']['repositoryPreference'] == 'any'
        resources = rpc('resources/list')['resources']
        uri = 'mergepilot://session/' + session
        assert any(resource['uri'] == uri for resource in resources)
        assert json.loads(rpc('resources/read', {'uri': uri})['contents'][0]['text'])['session']['id'] == session
        denied = rpc('tools/call', {'name': 'publish_pull_request', 'arguments': {'sessionId': session}})
        assert denied.get('isError'), 'Unprepared publication must be refused'
        call('control_session', {'sessionId': session, 'action': 'stop'})
        assert call('get_status', {'sessionId': session})['session']['stopped']
        call('resume_session', {'sessionId': session})
        assert not call('get_status', {'sessionId': session})['session']['stopped']
        assert not call('get_status', {'sessionId': session})['session']['publishApproved']
        process.stdin.close()
        process.wait(timeout=10)
        assert process.returncode == 0, 'MCP process exited unsuccessfully'
        if args.require_sdk:
            assert 'compatibility transport' not in ''.join(stderr)
        print(json.dumps({'status': 'PASS', 'transport': 'official-sdk' if args.require_sdk else
              ('compatibility' if 'compatibility transport' in ''.join(stderr) else 'official-sdk'),
              'protocol': '2026-07-28' if args.modern else 'legacy-handshake', 'tools': 21,
              'prompts': 6, 'checks': ['initialization', 'tools', 'prompts', 'resources',
              'onboarding', 'two-answer defaults', 'approval denial', 'stop', 'resume'], 'publicWrites': 0}))
    finally:
        if not process.stdin.closed:
            process.stdin.close()
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        if process.returncode and stderr:
            print('MCP diagnostic: ' + ''.join(stderr), file=sys.stderr)

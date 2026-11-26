"""Synthetic binary admission test. Run only inside an isolated Linux network namespace."""
import base64
import hashlib
import http.client
import http.server
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time

PLUGIN = "ace-bifrost-context"
RPC_PATH = "/internal/ace-context/v3/project"
INGRESS = "/chatgpt_passthrough/backend-api/codex/responses"
TOKEN = "synthetic-local-connector-test"
MODEL = "gpt-5.6-sol"
BODY = json.dumps({"model": MODEL, "store": False, "stream": False,
                   "input": [{"role": "user", "content": "find fixture function"}]}).encode()
observed = []


class Projector(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        raw = self.rfile.read(int(self.headers["Content-Length"]))
        request = json.loads(raw)
        observed.append((self.path, self.headers.get("Authorization"), request))
        body = base64.b64decode(request["bodyBase64"], validate=True)
        result = json.dumps({"kind": "BLOCK", "baseBodySha256": hashlib.sha256(body).hexdigest(),
                             "reasonCode": "SYNTHETIC_ADMISSION_DENIAL"}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(result)))
        self.end_headers()
        self.wfile.write(result)

    def log_message(self, *_args):
        pass


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def request(port, method, path, body=None, extra_headers=None):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
    try:
        connection.request(method, path, body=body, headers={
            "Content-Type": "application/json", "session-id": "ace-binary-smoke",
            "Authorization": "Bearer synthetic-not-a-real-subscription", **(extra_headers or {})})
        response = connection.getresponse()
        return response.status, response.read()
    finally:
        connection.close()


def main():
    # Namespace must contain loopback only. Never run this against a real account.
    assert {name for _, name in socket.if_nameindex()} == {"lo"}, "isolated network required"
    binary, plugin, catalog = (Path(arg).resolve(strict=True) for arg in sys.argv[1:])
    pricing = (catalog / "pricing.json").resolve(strict=True)
    parameters = (catalog / "model-parameters.json").resolve(strict=True)
    rpc = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Projector)
    thread = threading.Thread(target=rpc.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix="ace-binary-admission-") as temporary:
            for scenario in ("missing", "disabled", "init-error", "valid"):
                root = Path(temporary) / scenario
                root.mkdir()
                config = {
                    "$schema": "https://www.getbifrost.ai/schema",
                    "version": 2,
                    "source_of_truth": "config.json",
                    "framework": {"pricing": {
                        "pricing_url": pricing.as_uri(),
                        "model_parameters_url": parameters.as_uri(),
                        "live_models_sync_interval": 0,
                    }},
                    "providers": {},
                    "client": {"enable_logging": False, "disable_content_logging": True,
                               "enforce_auth_on_inference": False},
                    "plugins": [] if scenario == "missing" else [
                        {"name": PLUGIN, "path": str(plugin), "enabled": scenario != "disabled",
                         "placement": "post_builtin", "order": 0}],
                }
                (root / "config.json").write_text(json.dumps(config))
                # No inherited provider or proxy credentials.
                env = {"PATH": os.environ["PATH"], "HOME": str(root),
                       "BIFROST_REQUIRED_PHYSICAL_SEND_PLUGIN": PLUGIN,
                       "BIFROST_CHATGPT_PASSTHROUGH_SUBSCRIPTION_ONLY": "true",
                       "ACE_CONTEXT_RPC_URL": f"http://127.0.0.1:{rpc.server_port}{RPC_PATH}",
                       "ACE_BIFROST_TENANCY_MODE": "single-workspace",
                       "ACE_BIFROST_WORKSPACE_ID": "fixture",
                       "ACE_CONTEXT_RPC_TOKEN": "" if scenario == "init-error" else TOKEN}
                port = free_port()
                with (root / "server.log").open("w+b") as logs:
                    process = subprocess.Popen([binary, "-host", "127.0.0.1", "-port", str(port),
                                                "-app-dir", str(root)], env=env, stdout=logs, stderr=logs)
                    try:
                        deadline = time.monotonic() + 60
                        ready = False
                        while time.monotonic() < deadline and process.poll() is None:
                            try:
                                ready = request(port, "GET", "/health")[0] == 200
                                if ready:
                                    break
                            except (OSError, http.client.HTTPException):
                                pass
                            time.sleep(0.1)
                        if scenario != "valid":
                            assert not ready and process.poll() is not None, f"{scenario} did not fail startup"
                            assert process.returncode != 0, f"{scenario} exited successfully"
                            logs.seek(0)
                            assert b"required physical-send plugin" in logs.read(), f"{scenario} failed for another reason"
                            continue
                        assert ready, "valid server did not start"
                        status, body = request(port, "POST", INGRESS, BODY)
                        assert status == 409 and b"SYNTHETIC_ADMISSION_DENIAL" in body, (status, body[:250])
                        assert len(observed) == 1, "actual post-auth projection not observed exactly once"
                        path, token, projection = observed[0]
                        assert path == RPC_PATH and token == "Bearer " + TOKEN
                        assert projection["provider"] == "openai" and projection["model"] == MODEL
                        assert json.loads(base64.b64decode(projection["bodyBase64"])) == json.loads(BODY)
                        status, _ = request(port, "POST", "/v1/chat/completions", BODY)
                        assert status == 404 and len(observed) == 1, "unsupported generation route was not denied"
                        status, body = request(port, "GET", "/chatgpt_passthrough/backend-api/codex/models")
                        assert status == 401 and b"stored-key fallback is disabled" in body, "non-subscriber must not select a stored key"
                        assert len(observed) == 1, "model catalog request must not fabricate projection evidence"
                        status, _ = request(port, "GET", INGRESS, extra_headers={
                            "Upgrade": "websocket", "Connection": "Upgrade",
                            "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": base64.b64encode(os.urandom(16)).decode("ascii")})
                        assert status in (403, 405, 503) and len(observed) == 1, "unguarded Codex upgrade was not denied"
                    except BaseException:
                        # The fixture contains no real credentials or private content.
                        # Distinguish startup/config/ABI errors from expected denial.
                        logs.seek(0)
                        print(logs.read().decode(errors="replace")[-10000:], file=sys.stderr)
                        raise
                    finally:
                        if process.poll() is None:
                            process.terminate()
                            try:
                                process.wait(timeout=5)
                            except subprocess.TimeoutExpired:
                                process.kill()
                                process.wait(timeout=5)
    finally:
        rpc.shutdown()
        rpc.server_close()
        thread.join(timeout=5)
    print(json.dumps({"status": "binary-admission-pass", "providerWireCertified": False}))


if __name__ == "__main__":
    main()

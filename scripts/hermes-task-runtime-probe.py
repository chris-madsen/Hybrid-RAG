"""Probe the installed Hermes native Responses transport, never the live provider.

The host must run this in a network-isolated disposable task container.
No credentials or workspace data are mounted. MockTransport is the terminal
SDK boundary, not a new gateway or an assertion of provider-wire acceptance.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile

HERMES_COMMIT = "5b147ab036d6d19131bff8d20701b5001eab844a"
HERMES_VERSION = "v0.22.3"
SDK_VERSION = "2.24.0"
NATIVE_PATH = "/chatgpt_passthrough/backend-api/codex/responses"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def check(condition, code):
    if not condition:
        raise RuntimeError(code)


def output(*args, cwd=None, env=None):
    return subprocess.check_output(args, cwd=cwd, env=env, stderr=subprocess.DEVNULL,
                                   timeout=45, text=True).strip()


def run_transport(root, endpoint_digest, model):
    # Import the pinned Hermes implementation, not a substitute transport.
    sys.path.insert(0, str(root))
    from agent.transports.codex import ResponsesApiTransport
    from hermes_cli.auth_codex import _codex_base_url
    import httpx
    import openai

    check(Path(sys.modules[ResponsesApiTransport.__module__].__file__).resolve()
          == root / "agent/transports/codex.py", "HERMES_TRANSPORT_ORIGIN_MISMATCH")
    check(openai.__version__ == SDK_VERSION, "HERMES_SDK_VERSION_MISMATCH")
    endpoint = _codex_base_url()
    check(sha(endpoint.encode()) == endpoint_digest, "HERMES_ENDPOINT_DIGEST_MISMATCH")
    from urllib.parse import urlsplit
    parsed = urlsplit(endpoint)
    check(parsed.scheme in ("http", "https") and parsed.hostname and not parsed.username
          and not parsed.password and not parsed.query and not parsed.fragment
          and parsed.path == NATIVE_PATH.removesuffix("/responses"), "HERMES_ENDPOINT_ROUTE_MISMATCH")
    # A synthetic question only. A success response is deliberately impossible.
    adapter = ResponsesApiTransport()
    kwargs = adapter.build_kwargs(model=model, messages=[{"role": "user", "content": "fixture query"}],
                                  provider="openai-codex", base_url=endpoint,
                                  is_codex_backend=True, session_id="ace-offline-probe",
                                  reasoning_config={"enabled": True, "effort": "low"})
    seen = []
    def observe(request):
        body = json.loads(request.content)
        seen.append((request.method, request.url.path, body))
        return httpx.Response(400, json={"error": {"message": "synthetic terminal denial"}})
    with httpx.Client(transport=httpx.MockTransport(observe), trust_env=False) as terminal:
        with openai.OpenAI(base_url=endpoint, api_key="synthetic-offline-probe",
                           max_retries=0, http_client=terminal) as client:
            try:
                client.responses.create(**kwargs)
            except openai.BadRequestError:
                pass
            else:
                raise RuntimeError("HERMES_SYNTHETIC_DENIAL_MISSING")
    check(len(seen) == 1, "HERMES_NATIVE_REQUEST_COUNT_MISMATCH")
    method, path, body = seen[0]
    check(method == "POST" and path == NATIVE_PATH and body.get("store") is False
          and body.get("model") == model and "previous_response_id" not in body
          and "conversation" not in body, "HERMES_NATIVE_REQUEST_MISMATCH")
    return {"hermesTransportSha256": sha((root / "agent/transports/codex.py").read_bytes()),
            "hermesSdkVersion": openai.__version__, "endpointSha256": endpoint_digest,
            "modelSha256": sha(model.encode()), "nativeResponsesObserved": True,
            "providerWireCertified": False}


def main():
    check({name for _, name in socket.if_nameindex()} == {"lo"}, "TASK_NETWORK_NOT_ISOLATED")
    if len(sys.argv) == 5 and sys.argv[1] == "--transport":
        print(json.dumps(run_transport(Path(sys.argv[2]), sys.argv[3], sys.argv[4])))
        return
    check(len(sys.argv) == 3, "TASK_PROBE_ARGUMENTS_INVALID")
    expected, model = sys.argv[1:]
    check(re.fullmatch(r"[a-f0-9]{64}", expected) is not None, "HERMES_ENDPOINT_PIN_MISSING")
    check(bool(model) and len(model) <= 256, "HERMES_MODEL_INVALID")
    launcher = shutil.which("hermes", path=str(Path.home() / ".local/bin") + os.pathsep + os.environ["PATH"])
    check(launcher is not None, "HERMES_EXECUTABLE_MISSING")
    with tempfile.TemporaryDirectory(prefix="ace-hermes-probe-") as home:
        # Preserve the installation's actual owning HOME/PM store. Isolate all
        # per-session configuration and auth in an empty temporary profile.
        env = {"PATH": os.environ["PATH"], "HOME": str(Path.home()), "HERMES_HOME": home,
               "HERMES_CODEX_BASE_URL": os.environ.get("HERMES_CODEX_BASE_URL", ""),
               "PYTHONDONTWRITEBYTECODE": "1", "GIT_OPTIONAL_LOCKS": "0"}
        version = output(launcher, "--version", env=env)
        match = re.search(r"^Install directory: (.+)$", version, re.MULTILINE)
        check(match is not None, "HERMES_INSTALL_ROOT_MISSING")
        root = Path(match.group(1)).resolve(strict=True)
        check(output("git", "-C", str(root), "rev-parse", "HEAD", env=env) == HERMES_COMMIT,
              "HERMES_SOURCE_COMMIT_MISMATCH")
        check(not output("git", "-C", str(root), "status", "--porcelain=v1",
                         "--untracked-files=all", env=env), "HERMES_SOURCE_DIRTY")
        # Resolve the installed dependency environment using Hermes's own PM
        # selection, not a guessed venv location or the system OpenAI SDK.
        sys.path.insert(0, str(root))
        from pm.environments import selected_venv, venv_command
        command = venv_command(root, selected_venv(root), ["-I", "-B"])
        result = output(*command, str(Path(__file__).resolve()), "--transport", str(root),
                        expected, model, cwd=root, env=env)
        observation = json.loads(result.splitlines()[-1])
        check(observation.get("nativeResponsesObserved") is True
              and observation.get("providerWireCertified") is False, "HERMES_TRANSPORT_EVIDENCE_MISSING")
        check(not output("git", "-C", str(root), "status", "--porcelain=v1",
                         "--untracked-files=all", env=env), "HERMES_SOURCE_DIRTY")
        print(json.dumps({"schemaVersion": 1, "status": "READY", "hermesCommit": HERMES_COMMIT,
                          "hermesVersion": HERMES_VERSION, "hermesExecutableSha256": sha(Path(launcher).read_bytes()),
                          **observation}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        code = str(error)
        if not re.fullmatch(r"[A-Z][A-Z_]{3,100}", code):
            code = "HERMES_RUNTIME_PROBE_FAILED"
        print(json.dumps({"schemaVersion": 1, "status": "BLOCKED", "reasonCode": code,
                          "providerWireCertified": False}))
        raise SystemExit(2) from None

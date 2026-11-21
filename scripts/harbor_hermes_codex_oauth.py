"""Harbor Hermes adapter using ChatGPT/Codex subscription OAuth.

Harbor 0.24.0's built-in Hermes adapter is incompatible with the mandated\nsubscription-only Gateway route. This custom class must be selected by\nimport_path; it never uses the built-in provider fallback. It preserves Harbor's Hermes runtime and
session/ATIF behavior while selecting Hermes's native openai-codex provider and
staging a dedicated host Hermes auth store into the ephemeral task container.
Hermes owns the refresh-token chain; Codex CLI / VS Code credentials are never
borrowed. Credential bytes are never written to Harbor logs or artifacts.
"""

from __future__ import annotations

import json
import hashlib
import os
import re
import shlex
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Literal, override
from urllib.parse import urlsplit

import yaml
from pydantic import Field

from harbor.agents.installed.base import NonZeroAgentExitCodeError, with_prompt_template
from harbor.agents.installed.hermes import Hermes, HermesOptions
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


class HermesCodexOAuthOptions(HermesOptions):
    reasoning_effort: Literal["low", "medium", "high", "xhigh"] = Field(
        default="high",
        description="Reasoning effort forwarded to Hermes openai-codex.",
    )
    ace_context_enabled: bool = Field(
        default=False,
        description="Retired ACE native context mode (always rejected); configure Bifrost Gateway instead.",
    )
    bifrost_endpoint_sha256: str = Field(
        default="",
        description="SHA-256 identity of the explicitly configured Bifrost Responses endpoint.",
    )
    ace_workspace_root: str = Field(default="/workspace")
    ace_allowed_roots: str = Field(default="/workspace")
    ace_evidence_source_commit: str = ""
    ace_evidence_source_manifest_sha256: str = ""
    ace_context_bridge_sha256: str = ""
    context_plugin_sha256: str = ""


class HermesCodexOAuth(Hermes):
    options_model = HermesCodexOAuthOptions
    options: HermesCodexOAuthOptions

    def __init__(self, *args: Any, version: str | None = None, **kwargs: Any) -> None:
        super().__init__(*args, version=version, **kwargs)
        if version is not None:
            self._version = version
            self._version_was_pinned = True

    def get_version_command(self) -> str | None:
        return 'export PATH="$HOME/.local/bin:$PATH"; hermes --version'

    @staticmethod
    def _validate_bifrost_endpoint(endpoint: str | None, expected_sha256: str | None,
                                   allowed_hosts: str = "") -> str:
        if not endpoint or not expected_sha256 or not re.fullmatch(r"[a-f0-9]{64}", expected_sha256):
            raise ValueError("Hermes Bifrost endpoint and pinned SHA-256 identity are required")
        normalized = endpoint.strip().rstrip("/")
        try:
            parsed = urlsplit(normalized)
            hostname = (parsed.hostname or "").lower().rstrip(".")
            if (parsed.scheme not in ("http", "https") or not hostname
                    or parsed.username is not None or parsed.password is not None
                    or parsed.query or parsed.fragment):
                raise ValueError("unsafe endpoint")
        except ValueError as exc:
            raise ValueError("Hermes Bifrost endpoint is not a safe HTTP(S) URL") from exc
        # Hermes Codex appends /backend-api/codex/responses to this prefix.
        # /v1 would bypass the subscribed route, even on the same local host.
        if parsed.path != "/chatgpt_passthrough":
            raise ValueError("Hermes openai-codex requires Bifrost /chatgpt_passthrough base path")
        if (hostname == "openai.com" or hostname.endswith(".openai.com")
                or hostname == "chatgpt.com" or hostname.endswith(".chatgpt.com")):
            raise ValueError("direct OpenAI/Codex endpoints bypass Bifrost and are prohibited")
        # A matching hash of an attacker-supplied URL is only a configuration
        # fingerprint; it does NOT prove Bifrost. Refuse arbitrary public hosts
        # unless the deployment owner explicitly allowlists that exact host.
        local_hosts = {"localhost", "127.0.0.1", "::1", "host.docker.internal",
                       "bifrost", "bifrost-gateway"}
        extra_hosts = {entry.strip().lower().rstrip(".") for entry in allowed_hosts.split(",")
                       if entry.strip()}
        if hostname not in local_hosts and hostname not in extra_hosts:
            raise ValueError("Bifrost endpoint host is not explicitly permitted")
        actual_sha256 = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        if actual_sha256 != expected_sha256:
            raise ValueError("Hermes Bifrost endpoint does not match the pinned experiment identity")
        return normalized

    async def install(self, environment: BaseEnvironment) -> None:
        """Reuse Harbor's supported installer, then verify the *real* Hermes CLI.

        Harbor 0.24.0 ends its upstream installer with `hermes version`,
        which is not supported by the pinned Hermes CLI. The upstream
        installer may already have completed before that final probe exits.
        Do not run `hermes pm repair` as a substitute for installation and
        never ignore genuine installer failures.
        """
        check = 'export PATH="$HOME/.local/bin:$PATH"; hermes --version'
        try:
            await self.exec_as_agent(environment, command=check, timeout_sec=30)
            return
        except NonZeroAgentExitCodeError:
            pass

        try:
            await super().install(environment)
        except NonZeroAgentExitCodeError:
            # The only recoverable upstream failure is the invalid *final*
            # version command. A fresh --version probe must succeed now;
            # otherwise the installation failure is propagated.
            await self.exec_as_agent(environment, command=check, timeout_sec=30)
        else:
            await self.exec_as_agent(environment, command=check, timeout_sec=30)

    @staticmethod
    def _default_auth_path() -> Path:
        configured = os.environ.get("HERMES_AUTH_JSON_PATH")
        if configured:
            return Path(configured).expanduser()
        hermes_home = os.environ.get("HERMES_HOME")
        return (Path(hermes_home).expanduser() if hermes_home else Path.home() / ".hermes") / "auth.json"

    @classmethod
    @override
    def preflight(cls, kwargs: dict[str, Any] | None = None, env: Mapping[str, str] | None = None) -> None:
        super().preflight(kwargs, env)
        options = kwargs or {}
        bifrost_endpoint = (env or {}).get("HERMES_CODEX_BASE_URL") or os.environ.get("HERMES_CODEX_BASE_URL")
        endpoint_sha256 = options.get("bifrost_endpoint_sha256")
        cls._validate_bifrost_endpoint(
            bifrost_endpoint, endpoint_sha256,
            (env or {}).get("ACE_HERMES_ALLOWED_BIFROST_HOSTS")
            or os.environ.get("ACE_HERMES_ALLOWED_BIFROST_HOSTS", ""),
        )
        configured = (env or {}).get("HERMES_AUTH_JSON_PATH") or os.environ.get("HERMES_AUTH_JSON_PATH")
        auth_path = Path(configured).expanduser() if configured else cls._default_auth_path()
        if not auth_path.is_file():
            raise ValueError(
                f"Hermes openai-codex requires a dedicated Hermes OAuth store: {auth_path}. "
                "Run hermes auth add openai-codex; do not share ~/.codex/auth.json."
            )

    def _host_auth_path(self) -> Path:
        configured = self._extra_env.get("HERMES_AUTH_JSON_PATH") or os.environ.get("HERMES_AUTH_JSON_PATH")
        return Path(configured).expanduser() if configured else self._default_auth_path()

    @staticmethod
    def _validate_auth_store(path: Path) -> None:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            providers = value.get("providers") if isinstance(value, dict) else None
            legacy = providers.get("openai-codex") if isinstance(providers, dict) else None
            tokens = legacy.get("tokens") if isinstance(legacy, dict) else None
            pool = value.get("credential_pool") if isinstance(value, dict) else None
            entries = pool.get("openai-codex") if isinstance(pool, dict) else None
            current = entries[0] if isinstance(entries, list) and entries and isinstance(entries[0], dict) else None
            legacy_valid = isinstance(legacy, dict) and legacy.get("auth_mode") == "chatgpt" \
                and isinstance(tokens, dict) and tokens.get("access_token") and tokens.get("refresh_token")
            current_valid = isinstance(current, dict) and current.get("auth_type") == "oauth" \
                and current.get("access_token") and current.get("refresh_token")
            if not (legacy_valid or current_valid):
                raise ValueError("missing openai-codex ChatGPT OAuth state")
        except Exception as exc:
            raise RuntimeError(f"Hermes OAuth store is malformed: {path}") from exc

    async def _stage_hermes_auth(self, environment: BaseEnvironment) -> None:
        source = self._host_auth_path()
        if not source.is_file():
            raise RuntimeError(f"Hermes openai-codex auth file is unavailable: {source}")
        self._validate_auth_store(source)
        await self.exec_as_agent(environment, command="mkdir -p /tmp/hermes", timeout_sec=10)
        await self._upload_agent_owned_file(environment, source, "/tmp/hermes/auth.json")
        await self.exec_as_agent(environment, command="chmod 600 /tmp/hermes/auth.json", timeout_sec=10)

    async def _sync_hermes_auth(self, environment: BaseEnvironment) -> None:
        source = self._host_auth_path()
        source.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix=".auth.", suffix=".json", dir=source.parent)
        os.close(fd)
        temp_path = Path(temp_name)
        try:
            await environment.download_file("/tmp/hermes/auth.json", temp_path)
            self._validate_auth_store(temp_path)
            temp_path.chmod(0o600)
            os.replace(temp_path, source)
        finally:
            if temp_path.exists():
                temp_path.unlink()

    @staticmethod
    def _provider_config(base_yaml: str, reasoning_effort: str, ace_context_enabled: bool) -> str:
        config = yaml.safe_load(base_yaml)
        if not isinstance(config, dict):
            raise RuntimeError("Hermes generated an invalid base config")
        config["provider"] = "openai-codex"
        agent = config.get("agent")
        if not isinstance(agent, dict):
            agent = {}
        agent["reasoning_effort"] = reasoning_effort
        config["agent"] = agent
        # Do not override context_length here. The pinned Hermes release owns
        # provider/model-specific context resolution (including Codex OAuth live
        # metadata and its own fallback/opt-in aliases). Both paired arms pass
        # through the same base model config, so parity does not require a local
        # context-window guess.
        # Both arms use the same built-in Hermes compaction policy. ACE
        # subclasses ContextCompressor, so selecting the plugin must never
        # silently disable native summaries or tool-result pruning.
        config["compression"] = {
            "enabled": True,
            "threshold": 0.50,
            "threshold_tokens": None,
            "codex_gpt55_autoraise": False,
            "protect_first_n": 3,
            "protect_last_n": 20,
            "target_ratio": 0.20,
            "micro_compact": False,
            "proactive_prune_tokens": 0,
            "idle_compact_after_seconds": 0,
            "codex_responses_native": False,
            "codex_app_server_auto": "off",
        }
        if ace_context_enabled:
            raise ValueError("Retired direct ACE context injection is prohibited; configure the Bifrost LLM Gateway")
        return yaml.dump(config, default_flow_style=False)

    @with_prompt_template
    @override
    async def run(self, instruction: str, environment: BaseEnvironment, context: AgentContext) -> None:
        self._last_run_was_resume = self._resume
        if not self.model_name or not self.model_name.startswith("openai-codex/"):
            raise ValueError("Hermes feedback runs require model_name=openai-codex/<model>")
        model = self.model_name.split("/", 1)[1]
        if not model:
            raise ValueError("Hermes openai-codex model name is empty")

        if self.options.ace_context_enabled:
            raise ValueError("Native ACE ContextEngine injection is retired; route the agent through Bifrost")
        bifrost_endpoint = self._validate_bifrost_endpoint(
            self._extra_env.get("HERMES_CODEX_BASE_URL") or os.environ.get("HERMES_CODEX_BASE_URL"),
            self.options.bifrost_endpoint_sha256,
            self._extra_env.get("ACE_HERMES_ALLOWED_BIFROST_HOSTS")
            or os.environ.get("ACE_HERMES_ALLOWED_BIFROST_HOSTS", ""),
        )
        await self._stage_hermes_auth(environment)
        env = {
            "HERMES_HOME": "/tmp/hermes",
            "HERMES_CODEX_BASE_URL": bifrost_endpoint,
            "TERMINAL_ENV": "local",
            "HARBOR_INSTRUCTION": instruction,
        }
        evidence_options = {
            "ACE_EVIDENCE_SOURCE_COMMIT": self.options.ace_evidence_source_commit,
            "ACE_EVIDENCE_SOURCE_MANIFEST_SHA256": self.options.ace_evidence_source_manifest_sha256,
        }
        for name, option_value in evidence_options.items():
            value = option_value or self._extra_env.get(name) or os.environ.get(name)
            if value:
                env[name] = value
        config_yaml = self._provider_config(
            self._build_config_yaml(model, self.options.max_turns),
            self.options.reasoning_effort,
            self.options.ace_context_enabled,
        )
        await self.exec_as_agent(
            environment,
            command=("mkdir -p /tmp/hermes && " + f"cat > /tmp/hermes/config.yaml << 'EOF'\n{config_yaml}EOF"),
            env=env,
            timeout_sec=10,
        )
        skills_command = self._build_register_skills_command()
        if skills_command:
            await self.exec_as_agent(environment, command=skills_command, env=env, timeout_sec=10)

        cli_parts = ['export PATH="$HOME/.local/bin:$PATH"', "hermes --yolo chat"]
        if self._resume:
            native_session_id = getattr(self, "_native_session_id", None)
            if native_session_id is None and self._version_was_pinned:
                raise RuntimeError("Cannot resume pinned Hermes because the previous run exported no native session ID.")
            cli_parts.extend(["--resume", shlex.quote(native_session_id or "latest")])
        cli_parts.extend(['-q "$HARBOR_INSTRUCTION"', "-Q", f"--model {shlex.quote(model)}", "--provider openai-codex"])
        if self.options.toolsets:
            cli_parts.append(f"--toolsets {shlex.quote(str(self.options.toolsets))}")
        # Do not pipe Hermes directly into tee: without a guaranteed pipefail
        # shell, tee can turn a blocked/non-zero Hermes exit into apparent success.
        # Capture the agent status first, replay the log, then return that exact code.
        run_cmd = (
            f"{cli_parts[0]} && {' '.join(cli_parts[1:])} > /logs/agent/hermes.txt 2>&1; "
            'status=$?; cat /logs/agent/hermes.txt; exit "$status"'
        )

        try:
            await self.exec_as_agent(environment, command=run_cmd, env=env)
        finally:
            try:
                export_result = await self.exec_as_agent(
                    environment,
                    command=(
                        'export PATH="$HOME/.local/bin:$PATH" && '
                        "(hermes sessions export /logs/agent/hermes-session.jsonl --source oneshot 2>/dev/null; "
                        "[ -s /logs/agent/hermes-session.jsonl ] || "
                        "hermes sessions export /logs/agent/hermes-session.jsonl --source cli 2>/dev/null) && "
                        "head -n 1 /logs/agent/hermes-session.jsonl || true"
                    ),
                    env={"HERMES_HOME": "/tmp/hermes"},
                    timeout_sec=30,
                )
                native_session_id = self._extract_native_session_id(export_result.stdout)
                if native_session_id:
                    self._native_session_id = native_session_id
            finally:
                try:
                    await self._sync_hermes_auth(environment)
                finally:
                    await self.exec_as_agent(
                        environment,
                        command="rm -f /tmp/hermes/auth.json",
                        timeout_sec=10,
                    )

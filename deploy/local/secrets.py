#!/usr/bin/env python3
"""Create/refresh summit-api-env and summit-orchestrator-env from apps/backend/.env.

Run with:  uv run --no-project deploy/local/secrets.py

- Never prints secret values (only key names).
- GITHUB_APP_PRIVATE_KEY may be a quoted, \\n-escaped multi-line PEM; it is
  decoded and validated with `openssl pkey` before it is stored.
- WORKER_JWT_SECRET (shared API <-> orchestrator HMAC key) is reused if either
  secret already has one, otherwise a random 48-byte value is generated.
- No backup/restore of previous values: secrets are simply replaced in place.
"""

from __future__ import annotations

import base64
import json
import os
import secrets
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / "apps" / "backend" / ".env"
NS = os.environ.get("SUMMIT_NAMESPACE", "summit-system")
REQUIRED = ("DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "GITHUB_APP_ID", "GITHUB_APP_SLUG", "GITHUB_APP_PRIVATE_KEY")


def die(msg: str) -> None:
    print(f"secrets: {msg}", file=sys.stderr)
    sys.exit(1)


def kubectl(*args: str, stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["kubectl", *args], input=stdin, text=True, capture_output=True, check=False)


def read_secret(name: str) -> dict[str, bytes]:
    proc = kubectl("get", "secret", name, "-n", NS, "-o", "json")
    if proc.returncode != 0:
        return {}
    data = json.loads(proc.stdout).get("data") or {}
    return {k: base64.b64decode(v) for k, v in data.items()}


def apply_secret(name: str, data: dict[str, bytes]) -> None:
    obj = {
        "apiVersion": "v1",
        "kind": "Secret",
        "metadata": {"name": name, "namespace": NS, "labels": {"app.kubernetes.io/part-of": "summit"}},
        "type": "Opaque",
        "data": {k: base64.b64encode(v).decode("ascii") for k, v in data.items()},
    }
    # Full replace (not merge) so removed keys disappear; stdin keeps values off argv.
    proc = kubectl("apply", "-f", "-", stdin=json.dumps(obj))
    if proc.returncode != 0:
        die(f"failed to apply secret {name} (kubectl exit {proc.returncode})")
    print(f"{name}: keys={','.join(sorted(data))}")


def parse_env(path: Path) -> dict[str, str]:
    if not path.exists():
        die(f"{path} not found")
    vals: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        vals[key.strip()] = value.strip()
    return vals


def unquote(raw: str) -> str:
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
        return raw[1:-1]
    return raw


def decode_pem(raw: str) -> bytes:
    pem = unquote(raw).replace("\\n", "\n")
    if not pem.endswith("\n"):
        pem += "\n"
    with tempfile.TemporaryDirectory(prefix="summit-pem-") as tmp:
        path = Path(tmp) / "key.pem"
        path.write_text(pem)
        path.chmod(0o600)
        ok = subprocess.run(["openssl", "pkey", "-in", str(path), "-noout"], capture_output=True, check=False)
    if ok.returncode != 0:
        die("GITHUB_APP_PRIVATE_KEY is not a valid PEM private key")
    return pem.encode()


def main() -> None:
    vals = parse_env(ENV_PATH)
    missing = [k for k in REQUIRED if not vals.get(k)]
    if missing:
        die("missing keys in apps/backend/.env: " + ",".join(missing))

    api_prev, orc_prev = read_secret("summit-api-env"), read_secret("summit-orchestrator-env")
    worker = orc_prev.get("WORKER_JWT_SECRET") or api_prev.get("WORKER_JWT_SECRET") or secrets.token_urlsafe(48).encode()

    db = unquote(vals["DATABASE_URL"]).encode()
    supabase = unquote(vals["NEXT_PUBLIC_SUPABASE_URL"]).encode()

    apply_secret(
        "summit-api-env",
        {
            "DATABASE_URL": db,
            "SUPABASE_URL": supabase,
            "NEXT_PUBLIC_SUPABASE_URL": supabase,
            "GITHUB_APP_ID": unquote(vals["GITHUB_APP_ID"]).encode(),
            "GITHUB_APP_SLUG": unquote(vals["GITHUB_APP_SLUG"]).encode(),
            "GITHUB_APP_PRIVATE_KEY": decode_pem(vals["GITHUB_APP_PRIVATE_KEY"]),
            "WORKER_JWT_SECRET": worker,
        },
    )
    apply_secret("summit-orchestrator-env", {"DATABASE_URL": db, "WORKER_JWT_SECRET": worker})


if __name__ == "__main__":
    main()

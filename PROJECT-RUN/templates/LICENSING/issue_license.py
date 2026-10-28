# -*- coding: utf-8 -*-
"""服务端：授权码签发与 token 签名（骨架，按需接入你的框架/DB）。

设计要点（详见 PROJECT-RUN/LICENSING.md）：
- 私钥只存在于服务端，通过环境变量给路径，不写进代码或 env 内容
- 授权码为分组随机串，字符集去掉 O/0/I/1/L
- token = base64(payload) + "." + signature(payload)

依赖：pip install cryptography
"""
from __future__ import annotations

import base64
import json
import os
import secrets
import time
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 去 O/0/I/1/L
PRIVATE_KEY_PATH = os.environ.get("LICENSE_PRIVATE_KEY_PATH", "license_private.pem")


# ── 授权码 ────────────────────────────────────────────────────────────
def gen_code(groups: int = 5, size: int = 4) -> str:
    """生成 XXXX-XXXX-XXXX-XXXX-XXXX 形式的授权码。"""
    raw = "".join(secrets.choice(ALPHABET) for _ in range(groups * size))
    return "-".join(raw[i:i + size] for i in range(0, len(raw), size))


# ── 密钥 ──────────────────────────────────────────────────────────────
def load_private_key() -> Ed25519PrivateKey:
    data = Path(PRIVATE_KEY_PATH).read_bytes()
    return serialization.load_pem_private_key(data, password=None)  # type: ignore[return-value]


def export_public_key(private_key: Ed25519PrivateKey, out: str = "license_public.pem") -> None:
    """导出公钥，随客户端发布。公钥不是秘密。"""
    pub = private_key.public_key()
    Path(out).write_bytes(pub.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ))


def init_keys(force: bool = False) -> None:
    """首次部署用：生成密钥对（私钥权限 600）。已存在则拒绝覆盖。"""
    p = Path(PRIVATE_KEY_PATH)
    if p.exists() and not force:
        raise SystemExit(f"{p} 已存在，拒绝覆盖（防止密钥丢失导致全体授权失效）")
    key = Ed25519PrivateKey.generate()
    p.write_bytes(key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ))
    try:
        os.chmod(p, 0o600)
    except OSError:
        pass  # Windows 无 POSIX 权限，忽略
    export_public_key(key)
    print(f"已生成私钥 {p}（权限 600）与公钥 license_public.pem")


# ── Token ─────────────────────────────────────────────────────────────
def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def sign_token(code: str, machine_id: str, days: int = 14,
               max_users: int = 1) -> str:
    """签发 token。machine_id 必须参与签名，否则 token 可被拷到任意机器。"""
    payload = {
        "code": code,
        "machine_id": machine_id,
        "max_users": max_users,
        "iat": int(time.time()),
        "exp": int(time.time()) + days * 86400,
    }
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = load_private_key().sign(body)
    return f"{_b64(body)}.{_b64(sig)}"


def verify_token(token: str, public_key: Ed25519PublicKey) -> dict | None:
    """服务端自检用（客户端侧实现见 client_verify.py）。"""
    try:
        b64_body, b64_sig = token.split(".")
        body = base64.urlsafe_b64decode(b64_body + "=" * (-len(b64_body) % 4))
        sig = base64.urlsafe_b64decode(b64_sig + "=" * (-len(b64_sig) % 4))
        public_key.verify(sig, body)
        payload = json.loads(body)
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "init":
        init_keys()
    elif len(sys.argv) > 3 and sys.argv[1] == "sign":
        print(sign_token(sys.argv[2], sys.argv[3]))
    else:
        print("用法：\n  python issue_license.py init            # 首次生成密钥对\n"
              "  python issue_license.py sign <code> <machine_id>  # 签发 token")

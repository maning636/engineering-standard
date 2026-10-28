# -*- coding: utf-8 -*-
"""客户端：token 校验与降级策略（骨架）。

原则（详见 PROJECT-RUN/LICENSING.md）：
- 客户端只嵌公钥，永远不接触私钥
- token 里的 machine_id 必须匹配本机，否则拒绝
- 校验失败不立刻锁死：累计失败超过宽限期才降级只读
- 本文件不联网；续期请求由调用方实现（POST /refresh）

依赖：pip install cryptography
"""
from __future__ import annotations

import base64
import json
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

PUBLIC_KEY_PATH = Path("license_public.pem")
TOKEN_FILE = Path.home() / ".your_app" / "license.token"
STATE_FILE = Path.home() / ".your_app" / "license.state.json"

GRACE_DAYS = 10          # 连续续期失败多少天后降级
REFRESH_AT_RATIO = 0.75  # 已过期比例超过该值时尝试续期


# ── 机器码 ────────────────────────────────────────────────────────────
def machine_id() -> str:
    """随机 UUID 持久化（隐私友好）。重装系统会变，需换绑流程兜底。

    若需更强防拷，可用硬件指纹哈希，但必须在隐私条款中说明采集范围。
    """
    path = Path.home() / ".your_app" / "machine.id"
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file():
        return path.read_text(encoding="utf-8").strip()
    mid = uuid.uuid4().hex
    path.write_text(mid, encoding="utf-8")
    return mid


# ── 验签 ──────────────────────────────────────────────────────────────
def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verify(token: str, expect_machine: str | None = None) -> tuple[bool, dict | None, str]:
    """返回 (是否有效, payload, 原因)。"""
    try:
        b64_body, b64_sig = token.split(".")
        body = _b64d(b64_body)
        sig = _b64d(b64_sig)
        pub: Ed25519PublicKey = serialization.load_pem_public_key(PUBLIC_KEY_PATH.read_bytes())  # type: ignore[assignment]
        pub.verify(sig, body)
    except FileNotFoundError:
        return False, None, "缺少 public key（打包不完整）"
    except Exception:
        return False, None, "签名校验失败（token 被篡改或版本不匹配）"

    payload = json.loads(body)
    if int(payload.get("exp", 0)) < int(time.time()):
        return False, payload, "token 已过期"
    if expect_machine and payload.get("machine_id") != expect_machine:
        return False, payload, "机器码不匹配（token 可能来自其他机器）"
    return True, payload, "ok"


# ── 状态与降级 ────────────────────────────────────────────────────────
@dataclass
class LicenseState:
    status: str          # active | readonly | invalid
    reason: str
    expires_at: int = 0
    code: str = ""


def _load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"fail_since": 0}


def _save_state(st: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(st), encoding="utf-8")


def check_license() -> LicenseState:
    """启动时调用。校验本地 token；失败时按宽限期判断是否降级。"""
    if not TOKEN_FILE.is_file():
        return LicenseState("invalid", "未激活：请到授权页输入授权码")

    token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    ok, payload, reason = verify(token, expect_machine=machine_id())
    now = int(time.time())

    if ok and payload:
        # 到期前 25% 起提示续期（是否真正发起由调用方决定）
        exp, iat = int(payload.get("exp", 0)), int(payload.get("iat", 0))
        if exp - iat > 0 and now > iat + int((exp - iat) * REFRESH_AT_RATIO):
            return LicenseState("active", "需要续期", exp, payload.get("code", ""))
        _save_state({"fail_since": 0})
        return LicenseState("active", "ok", exp, payload.get("code", ""))

    # 校验失败：更新失败起始时间，按宽限期降级
    st = _load_state()
    if not st.get("fail_since"):
        st["fail_since"] = now
        _save_state(st)
    elapsed_days = (now - int(st["fail_since"])) / 86400
    if elapsed_days < GRACE_DAYS:
        return LicenseState("active", f"离线宽限中（{reason}），剩余 {GRACE_DAYS - elapsed_days:.1f} 天",
                            int((payload or {}).get("exp", 0)), (payload or {}).get("code", ""))
    return LicenseState("readonly", f"授权校验失败超过 {GRACE_DAYS} 天：{reason}")


def save_token(token: str) -> None:
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(token, encoding="utf-8")
    _save_state({"fail_since": 0})


if __name__ == "__main__":
    st = check_license()
    print(f"status={st.status} reason={st.reason} code={st.code}")

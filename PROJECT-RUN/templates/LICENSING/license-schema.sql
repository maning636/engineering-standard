-- 授权服务表结构（SQLite 版；MySQL/PG 需把 AUTOINCREMENT 换成 AUTO_INCREMENT/SERIAL）
-- 用法：直接执行；字段含义见 PROJECT-RUN/LICENSING.md §2

CREATE TABLE IF NOT EXISTS licenses (
  code             TEXT PRIMARY KEY,            -- 授权码，格式 XXXX-XXXX-XXXX-XXXX-XXXX
  customer         TEXT NOT NULL,               -- 客户标识（对账用）
  status           TEXT NOT NULL DEFAULT 'inactive',  -- inactive|active|disabled|expired
  expires_at       TIMESTAMP NOT NULL,          -- 授权到期时间
  machine_id       TEXT,                        -- 首次激活绑定的机器码
  activated_at     TIMESTAMP,
  last_seen_at     TIMESTAMP,                   -- 最近一次心跳/刷新
  max_users        INTEGER NOT NULL DEFAULT 1,  -- 允许的账号数（企业版 >1）
  user_ids         TEXT,                        -- JSON 数组：已绑定用户 id
  assigned_user_id TEXT,                        -- 单人版直接绑定的用户 id
  assigned_at      TIMESTAMP,
  note             TEXT                         -- 备注：渠道/合同号
);

CREATE INDEX IF NOT EXISTS idx_licenses_status      ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_customer    ON licenses(customer);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at  ON licenses(expires_at);
CREATE INDEX IF NOT EXISTS idx_licenses_machine_id  ON licenses(machine_id);

-- 审计表：只追加，不更新不删除
CREATE TABLE IF NOT EXISTS license_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  action     TEXT NOT NULL,        -- create|activate|refresh|disable|enable|rebind
  code       TEXT NOT NULL,
  actor      TEXT,                 -- 操作人（管理员用户名或 client）
  detail     TEXT,                 -- JSON：machine_id / 原因 / 原值 等
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_code ON license_audit(code);
CREATE INDEX IF NOT EXISTS idx_audit_time ON license_audit(created_at);

-- 常用查询
-- 即将到期的授权（30 天内）：
--   SELECT code, customer, expires_at FROM licenses
--   WHERE status='active' AND expires_at BETWEEN datetime('now') AND datetime('now','+30 days');
-- 某客户的全部授权：
--   SELECT code, status, expires_at, machine_id FROM licenses WHERE customer LIKE :prefix || '%';
-- 长期未心跳的客户端（可能已弃用）：
--   SELECT code, last_seen_at FROM licenses
--   WHERE status='active' AND last_seen_at < datetime('now','-30 days');

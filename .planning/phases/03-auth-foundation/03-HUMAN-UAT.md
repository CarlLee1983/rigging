---
status: complete
phase: 03-auth-foundation
source: [03-VERIFICATION.md]
started: 2026-04-19T00:00:00.000Z
updated: 2026-04-19T12:45:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 完整 API 流程 — Register → Verify → Login → Logout

expected: 每步均回預期 HTTP status；session 在 logout 後失效。

**測試步驟（使用 curl 或 HTTP 工具）：**
```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.com","password":"password123456","name":"Test"}'
# Expected: 200, user object returned

# 2. 讀 stdout 中的 📧 CLICK THIS 驗證連結，訪問該 URL
# Expected: log line contains "📧 CLICK THIS: http://localhost:3000/api/auth/verify-email?token=..."

# 3. Sign in → get session cookie
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.com","password":"password123456"}'
# Expected: 200, Set-Cookie header present

# 4. Use cookie to call /me
curl http://localhost:3000/me -H 'cookie: <session-cookie>'
# Expected: 200, { userId, identityKind: "human", scopes, sessionId }

# 5. Sign out
curl -X POST http://localhost:3000/api/auth/sign-out \
  -H 'cookie: <session-cookie>'
# Expected: 200

# 6. /me with stale cookie → 401
curl http://localhost:3000/me -H 'cookie: <session-cookie>'
# Expected: 401, { error: { code: "UNAUTHENTICATED" } }
```

result: passed

### 2. 密碼重設 + 其他 session 全部失效

expected: 兩個舊 session 均失效；新密碼可登入。

**測試步驟：**
```bash
# 1. Login twice (two sessions)
# Session A
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.com","password":"password123456"}'

# Session B
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.com","password":"password123456"}'

# 2. Request password reset
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.com","redirectTo":"http://localhost:3000/reset"}'
# Expected: log shows reset URL with token

# 3. Use reset token
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H 'content-type: application/json' \
  -d '{"token":"<token-from-log>","newPassword":"newPassword456"}'
# Expected: 200

# 4. Session A → 401 (purged by Scenario B wrap)
curl http://localhost:3000/me -H 'cookie: <session-a-cookie>'
# Expected: 401

# 5. Session B → 401
curl http://localhost:3000/me -H 'cookie: <session-b-cookie>'
# Expected: 401

# 6. New password works
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.com","password":"newPassword456"}'
# Expected: 200, new session cookie
```

result: passed

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

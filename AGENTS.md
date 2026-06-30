# AGENTS.md

## Fixed Local Ports

Use the fixed Codex startup command for this project:

- Ludora public UI: `npm run dev:codex`
- Fixed URL: `http://127.0.0.1:5175`
- If the public API is needed, use `VITE_LUDORA_API_URL=http://127.0.0.1:4000`

Do not choose another port automatically. If port `5175` is busy, report the owning process and ask before stopping it or using a different port.

Do not run DDL or DML SQL commands without user confirmation.

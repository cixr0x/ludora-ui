# AGENTS.md

## Fixed Local Ports

Use the fixed Codex startup command for this project:

- Ludora public UI: `npm run dev:codex`
- Fixed URL: `http://127.0.0.1:5175`
- If the public API is needed, use `VITE_LUDORA_API_URL=http://127.0.0.1:4000`

Do not choose another port automatically. If port `5175` is busy, report the owning process and ask before stopping it or using a different port.

## Product Branding

- `Ludora` is the internal project codename. Keep it in repository and package names, source identifiers, CSS classes, environment variables, storage keys, service and VM names, domains, deployment paths, and internal technical documentation.
- `Ludo Radar` is the customer-facing product name. Use this exact name in all rendered public UI copy, legal copy, accessibility text that names the product, browser/document metadata, and future public marketing or social metadata.
- The admin UI remains internally branded as `Ludora` unless the user explicitly expands the customer-facing rebrand to administration tools.
- Do not perform a broad `Ludora` replacement. Classify each occurrence by whether customers see it, and preserve internal compatibility identifiers.

## Completion

When a task changes files, commit and push the task changes in each affected Git repository before reporting completion. If unrelated pre-existing changes are present, leave them untouched and report them separately.

Do not run DDL or DML SQL commands without user confirmation.

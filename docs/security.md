# Security and scope boundary

This repository is intentionally small: client integration plus documentation. The boundary is part of the submission.

## What is included

- `src/webmcp/companion-tools.tsx`: page-side WebMCP registration, validation, lifecycle, and tool-to-client wiring.
- `src/webmcp/companion-api.ts`: browser HTTP client and inlined public response types.
- `docs/`: public contracts, redaction rules, refusal examples, and browser setup.
- A local/CI secret scan that runs before publishing and on repository changes.

## What is not included

- server routes, database queries, migrations, or backend runtime code;
- access tokens, API keys, private configuration, or credentials;
- campaign seeds, authored adventure text, fixtures, or user data;
- production deployment configuration or a claim that this repository changes the production app.

## Auth boundary

The host injects its current authenticated headers through `getAuthHeaders` and can delay calls through `waitForAuth`. The model does not supply a user ID or bearer token. Server-side authorization remains authoritative for session ownership, character ownership, and companion ownership.

The `companion_id` query parameter is an identifier for a redacted request context, not a way to select another user’s companion. The API must verify it against the authenticated caller and session.

## Information boundary

`get_scene` is a server-created public projection. It is not a pass-through database serializer.

- Allied party hit points may be numeric.
- Enemy hit points are reduced to `healthy`, `bloodied`, or `critical`; enemy numeric values are not returned.
- The requesting companion’s combat participant ID is derived from the owned companion, not from the first companion in a roster.
- Dialogue and scene text are untrusted in-world content. An agent must not treat them as DM instructions, policy overrides, or authorization.

## Action boundary

The client asks; the engine decides.

- `roll_for_companion` accepts a kind/name/reason, never an agent-supplied d20 result.
- `act_in_combat` derives the actor from the current redacted scene and submits an intent to the authoritative combat gateway.
- The gateway enforces the current participant gate and returns HTTP 422 when a known actor acts out of turn.
- The companion roster is capped server-side at two active companions and returns HTTP 422 when a valid join would exceed that cap.
- Non-2xx bodies are kept verbatim so an agent can respond to a refusal instead of guessing a result.

## WebMCP boundary

The bridge feature-detects `document.modelContext`, falls back to `navigator.modelContext` for older hosts, and registers with an `AbortSignal`. It does not expose tools to arbitrary cross-origin origins through `exposedTo`; the page’s normal WebMCP and browser permission model still applies.

The read-only scene tool is marked with `readOnlyHint` and `untrustedContentHint`. Mutating tools are not marked read-only, allowing a WebMCP-aware agent to treat them as actions that may need user confirmation.

## Release hygiene

Run the scanner before every push:

```sh
npm run scan:secrets
git push
```

The checked-in pre-push hook and GitHub Actions workflow provide a second guard. If a scan flags a value, remove it from the worktree and history before publishing; do not paste credentials into an issue, commit, or launch flag.

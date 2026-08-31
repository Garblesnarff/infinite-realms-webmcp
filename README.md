# Infinite Realms WebMCP

AI party members for a solo D&D app.

[Try Infinite Realms](https://infiniterealms.app) · [Tool contracts](docs/tools.md) · [Quickstart](docs/quickstart.md) · [Security boundary](docs/security.md)

## The story

Solo D&D is better when the party can talk back. Infinite Realms lets an AI agent join the player’s adventure as a named companion: it can speak in-world, ask the game for a real check, inspect the current scene, and take a combat action.

The important design decision is who owns the facts. The game engine owns dice, character modifiers, hit points, and turn order. The agent gets agency through structured tools, but it can never fabricate a roll, skip a turn, or quietly invent an outcome. A refusal is a useful result.

This repository is the standalone, client-side WebMCP extraction for the hackathon submission. It contains the integration and its contracts only. It contains no server code, secrets, database files, or campaign content, and it is separate from [`infinite-realms-production`](https://github.com/Garblesnarff/infinite-realms-production); nothing in that repository is merged or changed by this project.

## Tools

The live app at [infiniterealms.app](https://infiniterealms.app) currently exposes six tools: `join_party`, `list_my_characters`, `get_scene`, `speak_as_companion`, `roll_for_companion`, and `act_in_combat`. `leave` ships in this package and lands in production shortly.

Every non-read-only operation remains behind the authenticated Infinite Realms API and its server-side rules.

## Quickstart against the live app

You need an account, an active game session, and a browser or agent host that exposes WebMCP tools.

1. Open [infiniterealms.app](https://infiniterealms.app) in ChatGPT desktop’s embedded browser, or in a WebMCP-capable Chromium build.
2. Sign in and open a game session. Tool registration happens on the protected game page, not on the sign-in page.
3. Ask the agent to list the tools available on the current page. Start with `list_my_characters` and `get_scene`.
4. Join one of the returned characters, speak or roll as that companion, and call `act_in_combat` only when the scene says it is the companion’s turn.
5. For the fun failure demo, try to add a third active companion or act before the companion’s turn. The engine should return an explicit HTTP 422 refusal.

The full ChatGPT desktop walkthrough, Chrome flags, DevTools probe, and troubleshooting notes are in [`docs/quickstart.md`](docs/quickstart.md).

Chrome flags expose the page API for manual inspection only — there is currently no browser-native agent that consumes it; ChatGPT desktop's embedded browser is the only end-to-end consumer today.

## Use the extracted bridge in a React host

The host application supplies its own auth bootstrap and bearer-header provider; never hardcode a credential in this repository or in a browser launch flag.

```tsx
import { createCompanionApi, WebMcpCompanionBridge } from "./src";

const api = createCompanionApi({
  baseUrl: "https://infiniterealms.app",
  waitForAuth: () => authReady,
  getAuthHeaders: () => ({
    Authorization: `Bearer ${accessToken}`,
  }),
});

export function GameWebMcp({ sessionId }: { sessionId: string }) {
  return <WebMcpCompanionBridge sessionId={sessionId} api={api} />;
}
```

The bridge feature-detects `document.modelContext` and retains a fallback for older hosts that expose `navigator.modelContext`. It registers tools with an `AbortSignal`, so unmounting the component removes the page-scoped registrations.

## Why the refusals are the headline

Two examples make the boundary visible:

- Companion cap: `422 {"error":"A session can have at most two active companions","details":{"limit":2}}`.
- Out of turn: `422 {"error":"Actor is not the current-turn participant",...}` with current-turn context.

The client preserves non-2xx response bodies verbatim as tool text. Agents can understand “wait” or “the party is full” instead of receiving a vague tool failure. See the exact contracts and examples in [`docs/tools.md`](docs/tools.md).

## Development

```sh
npm install
npm run typecheck
npm test
npm run format:check
npm run scan:secrets
```

The pre-push hook runs the secret scan automatically when this checkout’s hooks path is configured. The same scan runs in GitHub Actions.

## Repository boundary

Only these concerns belong here:

- browser-side WebMCP registration;
- an authenticated client for the companion endpoints;
- inlined TypeScript contracts for the redacted public projection;
- documentation and the secret-scan guardrail.

Server implementation, migrations, fixtures, private campaign material, and production configuration stay out of this repository.

## License

MIT. See [`LICENSE`](LICENSE).

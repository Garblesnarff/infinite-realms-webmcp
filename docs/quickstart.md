# Quickstart: try the live WebMCP surface

This is a browser-side integration. You do not run a local MCP server for the live demo.

## 1. Open a real game page

1. Open [https://infiniterealms.app](https://infiniterealms.app).
2. Sign in.
3. Open an active game session. WebMCP registration is mounted from the protected game page, so a sign-in page or a public landing page will not expose the companion tools.
4. Keep the page authenticated while testing. If you hard-refresh after signing in, wait for the game session to finish loading before asking the agent to inspect tools.

## 2. ChatGPT desktop embedded-browser walkthrough

Use the embedded Browser panel/tab in ChatGPT desktop, not an unrelated external tab:

1. Open the embedded browser and navigate to `https://infiniterealms.app`.
2. Complete sign-in in that embedded page.
3. Navigate to an active game session and wait until the game UI is present.
4. Ask ChatGPT: “What WebMCP tools are available on the current page?”
5. Start with the read-only calls: list the authenticated characters and read the current scene.
6. Ask to join one selected character, then ask that companion to speak in-world or request a check.
7. During combat, ask for `get_scene` before `act_in_combat`. The tool is intentionally refused when the companion is not the current-turn participant.
8. To demonstrate the other guard, join two active companions and attempt a third. A `422` companion-cap response is a successful policy boundary, not a broken tool.

The live deployment and the desktop build may expose different tool inventories. If the agent cannot see tools, do not infer that the page is unauthenticated from the ordinary UI alone; verify that the active game page is loaded and that the browser runtime exposes WebMCP.

## 3. Chrome / Chromium testing

WebMCP is an evolving browser API. Use a build that supports the testing surface, then:

1. Open `chrome://flags/#enable-webmcp-testing`.
2. Set the WebMCP testing flag to **Enabled**.
3. Relaunch Chrome.
4. Reopen the authenticated game page after relaunch.

For development or Canary builds that use feature flags instead of the flag UI, the build-specific feature switches commonly used for the current experimental implementation are:

```text
--enable-features=WebMCP
--enable-blink-features=ModelContextAPI,ModelContextExecutorAPI
```

Do not copy credentials into a launch command. Use a separate browser profile if you want an isolated test session.

In DevTools on the game page, feature-detect the current API:

```js
typeof document.modelContext;
await document.modelContext?.getTools();
```

The bridge prefers `document.modelContext` and keeps `navigator.modelContext` as a compatibility fallback. Current Chrome guidance identifies `navigator.modelContext` as deprecated in favor of `document.modelContext`.

WebMCP requires a secure context. The live site is HTTPS; an HTTP local page will not be an equivalent test.

## 4. Use the extracted code in a host app

Install the dependencies, then pass the host’s auth callbacks to the client:

```sh
npm install
```

```tsx
import {
  createCompanionApi,
  WebMcpCompanionBridge,
} from "infinite-realms-webmcp";

const companionApi = createCompanionApi({
  baseUrl: "https://infiniterealms.app",
  waitForAuth: () => authReady,
  getAuthHeaders: () => ({
    Authorization: `Bearer ${accessToken}`,
  }),
});

<WebMcpCompanionBridge sessionId={sessionId} api={companionApi} />;
```

The host remains responsible for token refresh, session selection, and its own UI/cache invalidation. This package only registers tools and calls the existing client-facing API.

## Troubleshooting

### No tools appear

Check that the browser runtime supports WebMCP, the testing flag was enabled before relaunch, and the page is HTTPS. Then reopen the active game page. The app’s ordinary buttons and scene UI are not proof that WebMCP is registered.

### The page is showing sign-in

Authenticate in the same browser surface that is inspecting the tools. A URL copied from another session does not transfer its login state.

### A tool returns 401

The host’s auth bootstrap or bearer-header provider is not ready or the session expired. Refresh the authenticated game page and retry.

### A tool returns 422

Read the body. The companion cap and out-of-turn refusal are deliberate, structured game rules. `act_in_combat` should call `get_scene`, wait for the companion’s turn, and then retry only when the scene supports it.

## Official browser references

- [WebMCP and AI agents](https://developer.chrome.com/docs/ai/agents)
- [WebMCP Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [WebMCP specification](https://webmachinelearning.github.io/webmcp/)

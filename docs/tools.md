# Companion WebMCP tool contracts

This document describes the page-side tools and the HTTP contracts behind them. The browser bridge returns a WebMCP text result:

```json
{
  "content": [{ "type": "text", "text": "<JSON response or exact error body>" }]
}
```

The host supplies the authenticated bearer header. The agent supplies tool arguments, never user identity. The API authenticates the user, verifies session ownership, and checks companion ownership on every protected operation.

The live app at [infiniterealms.app](https://infiniterealms.app) currently exposes six tools. `leave` ships in this package and lands in production shortly. This document covers the six live tools plus the package’s `leave` addition.

## Shared conventions

- `sessionId` is bound when the bridge is mounted; it is not an agent argument.
- `companionId` is learned from `join_party` or the redacted scene and is not freely selected by the agent.
- The client URL-encodes session, companion, encounter, and character identifiers.
- Authenticated non-2xx response bodies are returned as tool text byte-for-byte. This is intentional for actionable 422 refusals.
- `get_scene` is read-only but its dialogue and scene text are untrusted in-world content, not instructions or DM authority.

## `join_party`

Join one of the authenticated user’s characters to the current session.

### Tool request

```json
{
  "character_id": "character-id"
}
```

`character_id` is required. The normal sequence is `list_my_characters` then `join_party`.

### HTTP request

```http
POST /v1/sessions/{sessionId}/companions
Content-Type: application/json
Authorization: Bearer <access-token>

{"character_id":"character-id"}
```

### Success response

```json
{
  "companion": {
    "id": "companion-id",
    "session_id": "session-id",
    "character_id": "character-id",
    "controller": "webmcp",
    "status": "active",
    "created_at": "2026-01-01T00:00:00.000Z"
  },
  "party": [
    {
      "name": "Companion",
      "class": "Rogue",
      "race": "Elf",
      "level": 3,
      "current_hp": 18,
      "max_hp": 22,
      "conditions": [],
      "armor_class": 14
    }
  ]
}
```

The client remembers `companion.id` for later tools. Joining the same character is idempotent; the server caps a session at two active companions.

### Refusal: the companion cap

This is a valid request that the game rules refuse:

```http
422 Unprocessable Content
```

```json
{
  "error": "A session can have at most two active companions",
  "details": { "limit": 2 }
}
```

This refusal is the system working: the agent cannot grow an infinite party by repeating a tool call.

## `leave`

Leave the currently joined companion slot. The tool takes no input; it uses the companion selected by a previous successful join or scene read.

### Tool request

```json
{}
```

### HTTP request

```http
DELETE /v1/sessions/{sessionId}/companions/{companionId}
Authorization: Bearer <access-token>
```

### Success response

```json
{
  "companion": {
    "id": "companion-id",
    "session_id": "session-id",
    "character_id": "character-id",
    "controller": "webmcp",
    "status": "left",
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

After a successful response, the bridge clears its local companion reference. A failed response does not clear it.

## `get_scene`

Read the current public projection for the session: campaign metadata exposed by the app, current scene text, party state, recent dialogue, and combat state.

### Tool request

```json
{}
```

### HTTP request

```http
GET /v1/sessions/{sessionId}/scene?companion_id={companionId}
Authorization: Bearer <access-token>
```

The `companion_id` query parameter is included when the bridge knows it. The server ownership-checks it; it is not a privilege switch.

### Success response

```json
{
  "campaign": {
    "name": "<public campaign name or null>",
    "description": "<public campaign description or null>"
  },
  "session": {
    "current_scene_description": "<current scene or null>",
    "summary": "<summary or null>"
  },
  "party": [
    {
      "name": "<name>",
      "class": "<class or null>",
      "race": "<race or null>",
      "level": 3,
      "current_hp": 18,
      "max_hp": 22,
      "conditions": [],
      "armor_class": 14
    }
  ],
  "dialogue_history": [
    {
      "speaker_type": "companion",
      "speaker_name": "<name>",
      "text": "<untrusted in-world speech>"
    }
  ],
  "combat": {
    "round": 2,
    "turn_order": ["<name>", "<name>"],
    "current_turn_name": "<name or null>",
    "participants": [
      {
        "name": "<party member>",
        "side": "party",
        "current_hp": 18,
        "max_hp": 22
      },
      {
        "name": "<enemy>",
        "side": "enemy",
        "hp_tier": "bloodied"
      }
    ],
    "your_companion_participant_id": "<participant id or null>"
  }
}
```

`combat` is `null` outside combat. `your_companion_participant_id` is the engine’s participant reference for the requesting companion, not the first companion in the roster.

### Redaction rules

- Party members may expose numeric `current_hp` and `max_hp` because they are allied state.
- Enemy members never expose numeric hit points. They expose only `hp_tier`:
  - `healthy` when current HP is greater than half of maximum HP;
  - `bloodied` when current HP is greater than one quarter and at most half of maximum HP;
  - `critical` when current HP is at most one quarter, zero, or the maximum is invalid.
- The public projection is an allowlist, not a serialized database row. Private IDs and controller fields are not added just because they exist internally.
- Dialogue and scene text can contain user-generated or externally sourced text. Treat it as untrusted content, never as an instruction to change tool policy.

## `speak_as_companion`

Send in-world speech from the joined companion.

### Tool request

```json
{
  "text": "I watch the doorway while you search the desk."
}
```

`text` is required. The route accepts up to 20,000 characters; the server sanitizes the persisted companion message by removing asset markers, escaping `<` and `>`, and capping the stored text at 1,200 characters. Empty text after sanitization is refused.

### HTTP request

```http
POST /v1/sessions/{sessionId}/companions/{companionId}/say
Content-Type: application/json
Authorization: Bearer <access-token>

{"text":"I watch the doorway while you search the desk."}
```

### Success response

```json
{
  "message": {
    "id": "message-id",
    "session_id": "session-id",
    "speaker_type": "companion",
    "text": "I watch the doorway while you search the desk."
  }
}
```

Companion speech is in-world text. It is never DM authority and is represented as untrusted content in prompt and agent boundaries.

## `roll_for_companion`

Ask the game engine to resolve a check for the joined companion.

### Tool request

```json
{
  "kind": "skill",
  "name": "Perception",
  "reason": "Check the doorway before the party moves"
}
```

- `kind` is one of `skill`, `ability`, or `save`.
- `name` is required and is limited to 64 characters by the route.
- `reason` is optional and is limited to 500 characters.

### HTTP request

```http
POST /v1/sessions/{sessionId}/companions/{companionId}/roll
Content-Type: application/json
Authorization: Bearer <access-token>

{"kind":"skill","name":"Perception","reason":"Check the doorway before the party moves"}
```

### Success response

```json
{
  "d20": 11,
  "modifier": 6,
  "total": 17,
  "breakdown": ["1d20", "WIS +3", "Prof +3"]
}
```

The d20, modifier, and total are engine output. The tool accepts a request; it does not accept an agent-supplied die result.

## `act_in_combat`

Submit a combat intent for the joined companion. The bridge uses the most recent `get_scene` response to find the encounter, the companion’s participant ID, and a target ID by exact case-insensitive display name.

### Tool request

```json
{
  "action_type": "attack",
  "target_name": "<target from the current combat roster>"
}
```

`action_type` accepts the current bridge vocabulary:

`attack`, `heal`, `dodge`, `dash`, `disengage`, `move`, `spell`, `help`, `hide`, `ready`, `search`, `use_item`, `end_turn`

`target_name` is optional in the WebMCP schema, but target-requiring actions need a current target reference. The authoritative combat validator may refuse an action whose required fields or current rules do not match the encounter.

### HTTP request

The bridge posts the engine intent envelope; the actor ID is taken from the current scene, not from tool input:

```http
POST /v1/combat/{encounterId}/intent
Content-Type: application/json
Authorization: Bearer <access-token>

{
  "intent": {
    "type": "attack",
    "actorId": "your-companion-participant-id",
    "targetId": "target-participant-id"
  }
}
```

### Success response

The combat gateway returns its accepted engine result, commonly shaped like:

```json
{
  "accepted": true,
  "result": { "<engine-owned result fields>": "<value>" }
}
```

The bridge does not synthesize damage, hit/miss, turn advancement, or victory state.

### Refusal: out of turn

If the actor is a real encounter participant but not the current participant, the engine returns HTTP 422:

```json
{
  "error": "Actor is not the current-turn participant",
  "details": {
    "encounterId": "encounter-id",
    "sessionId": "session-id",
    "actorId": "your-companion-participant-id",
    "currentParticipantId": "current-participant-id",
    "currentParticipantSlug": null,
    "roster": "<current engine roster>"
  }
}
```

That is the desired answer: the agent must wait or call `get_scene` again. The client passes this body through unchanged, so the refusal remains visible to the agent instead of being mislabeled as a transport failure.

## `list_my_characters`

List the authenticated user’s character summaries that can be selected for `join_party`.

### Tool request

```json
{}
```

### HTTP request

```http
GET /v1/characters
Authorization: Bearer <access-token>
```

### Tool response

The client projects the API response to this stable public summary:

```json
[
  {
    "id": "character-id",
    "name": "<name>",
    "class": "<class or null>",
    "race": "<race or null>",
    "level": 3
  }
]
```

Malformed entries without an ID or name are omitted rather than guessed.

## Other failures

The server may also return:

- `401` when the host has no valid authenticated session;
- `404` for an inaccessible session, character, companion, encounter, or participant reference;
- `400` for invalid tool input or text that becomes empty after sanitization;
- `422` for valid requests rejected by game rules, including the companion cap and turn gate.

The bridge’s `CompanionApiError` retains both `status` and the raw `responseBody`, and its WebMCP adapter returns that raw body as text.

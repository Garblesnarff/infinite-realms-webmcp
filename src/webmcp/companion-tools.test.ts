import { describe, expect, it, vi } from "vitest";

import { CompanionApiError, getActiveCompanions } from "./companion-api";

import type { CompanionApi, CompanionSceneResponse } from "./companion-api";
import { createCompanionTools } from "./companion-tools";

const toolByName = (name: string, api: CompanionApi, options = {}) => {
  const tool = createCompanionTools({
    sessionId: "session-1",
    api,
    ...options,
  }).find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Tool ${name} was not registered`);
  return tool;
};

const makeApi = (overrides: Partial<CompanionApi> = {}): CompanionApi => ({
  listMyCharacters: vi.fn().mockResolvedValue([]),
  joinParty: vi.fn().mockResolvedValue({ companion: { id: "companion-1" } }),
  leaveParty: vi
    .fn()
    .mockResolvedValue({ companion: { id: "companion-1", status: "left" } }),
  getCompanionScene: vi.fn().mockResolvedValue({ combat: null }),
  speakAsCompanion: vi.fn().mockResolvedValue({}),
  rollForCompanion: vi
    .fn()
    .mockResolvedValue({ d20: 10, modifier: 2, total: 12, breakdown: [] }),
  submitCombatIntent: vi.fn().mockResolvedValue({ accepted: true }),
  ...overrides,
});

describe("standalone WebMCP companion tools", () => {
  it("registers the seven explicitly named tools", () => {
    const names = createCompanionTools({
      sessionId: "session-1",
      api: makeApi(),
    }).map((tool) => tool.name);

    expect(names).toEqual([
      "join_party",
      "leave",
      "list_my_characters",
      "get_scene",
      "speak_as_companion",
      "roll_for_companion",
      "act_in_combat",
    ]);
  });

  it("tracks a joined companion and clears it after leave", async () => {
    const api = makeApi();
    const companionIdRef = { current: null as string | null };
    const join = toolByName("join_party", api, { companionIdRef });
    const leave = toolByName("leave", api, { companionIdRef });

    await join.execute({ character_id: "character-1" });
    expect(companionIdRef.current).toBe("companion-1");

    await leave.execute({});
    expect(api.leaveParty).toHaveBeenCalledWith(
      "session-1",
      "companion-1",
      undefined,
    );
    expect(companionIdRef.current).toBeNull();
  });

  it("returns an engine 422 body verbatim to the agent", async () => {
    const lastSceneRef = {
      current: {
        combat: {
          encounter_id: "encounter-1",
          your_companion_participant_id: "participant-1",
          participants: [],
        },
      } satisfies CompanionSceneResponse,
    };
    const api = makeApi({
      submitCombatIntent: vi
        .fn()
        .mockRejectedValue(
          new CompanionApiError(
            422,
            '{"error":"Actor is not the current-turn participant"}',
          ),
        ),
    });

    const result = await toolByName("act_in_combat", api, {
      lastSceneRef,
      logger: { warn: vi.fn() },
    }).execute({ action_type: "dodge" });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: '{"error":"Actor is not the current-turn participant"}',
        },
      ],
    });
  });

  it("recognizes the public main-character-then-companion roster shape", () => {
    const companion = { name: "Companion", class: "Rogue" };
    expect(
      getActiveCompanions({ party: [{ name: "Player" }, companion] }),
    ).toEqual([companion]);
  });
});

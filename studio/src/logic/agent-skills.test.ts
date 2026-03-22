import { describe, expect, it, vi } from "vitest";

import {
  DefaultAgentSkillsLogic,
  filterAgentSkillEntries,
  getSkillEntryDescription,
  getSkillEntryName,
  mapAvailableSkillEntries
} from "./agent-skills";

describe("DefaultAgentSkillsLogic", () => {
  it("listEnabledSkills returns only globally enabled skills", async () => {
    const logic = new DefaultAgentSkillsLogic(
      {
        listAvailableSkills: vi.fn(),
        getAgentSkills: vi.fn(),
        updateAgentSkills: vi.fn()
      },
      {
        listAgents: vi.fn(),
        createAgent: vi.fn(),
        deleteAgent: vi.fn(),
        getAgentFile: vi.fn(),
        setAgentFile: vi.fn(),
        getConfig: vi.fn(),
        patchConfig: vi.fn(),
        getSkillStatuses: vi.fn().mockResolvedValue([
          { skillKey: "planner", description: "plan tasks", enabled: true },
          { skillKey: "writer", enabled: false },
          { skillKey: "coder", description: "write code", enabled: true }
        ])
      } as never
    );

    await expect(logic.listEnabledSkills()).resolves.toEqual([
      { name: "planner", description: "plan tasks" },
      { name: "coder", description: "write code" }
    ]);
  });

  it("listDigitalHumanSkills filters available skills by agent config", async () => {
    const getSkillStatuses = vi.fn().mockResolvedValue([
      { skillKey: "planner", description: "plan tasks", enabled: true },
      { skillKey: "writer", description: "write docs", enabled: undefined },
      { skillKey: "coder", description: "write code", enabled: false }
    ]);
    const getAgentSkills = vi.fn().mockResolvedValue({
      agentId: "agent-1",
      skills: ["writer", "coder"]
    });
    const logic = new DefaultAgentSkillsLogic(
      {
        listAvailableSkills: vi.fn(),
        getAgentSkills,
        updateAgentSkills: vi.fn()
      },
      {
        listAgents: vi.fn(),
        createAgent: vi.fn(),
        deleteAgent: vi.fn(),
        getAgentFile: vi.fn(),
        setAgentFile: vi.fn(),
        getConfig: vi.fn(),
        patchConfig: vi.fn(),
        getSkillStatuses
      } as never
    );

    await expect(logic.listDigitalHumanSkills("agent-1")).resolves.toEqual([
      {
        name: "writer",
        description: "write docs"
      }
    ]);
    expect(getSkillStatuses).toHaveBeenCalledOnce();
    expect(getAgentSkills).toHaveBeenCalledWith("agent-1");
  });

  it("delegates listAvailableSkills to the client", async () => {
    const logic = new DefaultAgentSkillsLogic({
      listAvailableSkills: vi.fn().mockResolvedValue({
        skills: ["weather", "search"]
      }),
      getAgentSkills: vi.fn(),
      updateAgentSkills: vi.fn()
    });

    await expect(logic.listAvailableSkills()).resolves.toEqual({
      skills: ["weather", "search"]
    });
  });

  it("delegates getAgentSkills to the client", async () => {
    const logic = new DefaultAgentSkillsLogic({
      listAvailableSkills: vi.fn(),
      getAgentSkills: vi.fn().mockResolvedValue({
        agentId: "agent-1",
        skills: ["weather"]
      }),
      updateAgentSkills: vi.fn()
    });

    await expect(logic.getAgentSkills("agent-1")).resolves.toEqual({
      agentId: "agent-1",
      skills: ["weather"]
    });
  });

  it("delegates updateAgentSkills to the client", async () => {
    const logic = new DefaultAgentSkillsLogic({
      listAvailableSkills: vi.fn(),
      getAgentSkills: vi.fn(),
      updateAgentSkills: vi.fn().mockResolvedValue({
        success: true,
        agentId: "agent-1",
        skills: ["weather", "search"]
      })
    });

    await expect(
      logic.updateAgentSkills("agent-1", ["weather", "search"])
    ).resolves.toEqual({
      success: true,
      agentId: "agent-1",
      skills: ["weather", "search"]
    });
  });

  it("getSkillEntryName prefers name and trims whitespace", () => {
    expect(getSkillEntryName({ skillKey: "planner", name: " planner " })).toBe("planner");
    expect(getSkillEntryName({ skillKey: "writer" })).toBe("writer");
  });

  it("getSkillEntryDescription trims whitespace", () => {
    expect(
      getSkillEntryDescription({
        skillKey: "planner",
        description: " plan tasks "
      })
    ).toBe("plan tasks");
  });

  it("mapAvailableSkillEntries keeps non-disabled skills in order", () => {
    expect(
      mapAvailableSkillEntries([
        { skillKey: "planner", enabled: true },
        { skillKey: "planner", enabled: undefined },
        { skillKey: "writer", enabled: undefined },
        { skillKey: "coder", enabled: false },
        { skillKey: "coder", name: " coder ", enabled: true }
      ])
    ).toEqual([
      { skillKey: "planner", enabled: true },
      { skillKey: "writer", enabled: undefined },
      { skillKey: "coder", name: " coder ", enabled: true }
    ]);
  });

  it("filterAgentSkillEntries keeps only configured available skills", () => {
    expect(
      filterAgentSkillEntries(
        [
          { skillKey: "planner", description: "plan tasks", enabled: true },
          { skillKey: "writer", description: "write docs", enabled: undefined },
          { skillKey: "coder", description: "write code", enabled: true }
        ],
        ["writer", "coder", "missing"]
      )
    ).toEqual([
      {
        name: "writer",
        description: "write docs"
      },
      {
        name: "coder",
        description: "write code"
      }
    ]);
  });
});

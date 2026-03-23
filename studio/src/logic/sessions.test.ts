import { describe, expect, it, vi } from "vitest";

import {
  buildSessionLookupParams,
  DefaultSessionsLogic,
  findSessionByKey,
  withDerivedTitles
} from "./sessions";

describe("DefaultSessionsLogic", () => {
  it("delegates listSessions to the adapter", async () => {
    const listSessions = vi.fn().mockResolvedValue({
      sessions: []
    });
    const logic = new DefaultSessionsLogic({
      listSessions,
      getSession: vi.fn(),
      previewSessions: vi.fn(),
    });

    await expect(
      logic.listSessions({
        limit: 20,
        includeDerivedTitles: true,
        includeLastMessage: true
      })
    ).resolves.toEqual({
      sessions: []
    });
    expect(listSessions).toHaveBeenCalledWith({
      limit: 20,
      includeLastMessage: true,
      includeDerivedTitles: true
    });
  });

  it("delegates getSession to the adapter", async () => {
    const logic = new DefaultSessionsLogic({
      listSessions: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        key: "key1",
        messages: []
      }),
      previewSessions: vi.fn()
    });

    await expect(
      logic.getSession({
        key: "key1",
        limit: 100
      })
    ).resolves.toEqual({
      key: "key1",
      messages: []
    });
  });

  it("looks up one session summary by key through listSessions", async () => {
    const listSessions = vi.fn().mockResolvedValue({
      sessions: [
        {
          key: "agent:de_finance:user:user-1:direct:chat-1",
          kind: "user-direct",
          updatedAt: 1,
          sessionId: "runtime-1"
        }
      ]
    });
    const logic = new DefaultSessionsLogic({
      listSessions,
      getSession: vi.fn(),
      previewSessions: vi.fn()
    });

    await expect(
      logic.getSessionSummary("agent:de_finance:user:user-1:direct:chat-1")
    ).resolves.toMatchObject({
      key: "agent:de_finance:user:user-1:direct:chat-1"
    });
    expect(listSessions).toHaveBeenCalledWith({
      agentId: "de_finance",
      includeDerivedTitles: true
    });
  });

  it("delegates previewSessions to the adapter", async () => {
    const logic = new DefaultSessionsLogic({
      listSessions: vi.fn(),
      getSession: vi.fn(),
      previewSessions: vi.fn().mockResolvedValue({
        items: []
      })
    });

    await expect(
      logic.previewSessions({
        keys: ["key1", "key2"],
        limit: 5
      })
    ).resolves.toEqual({
      items: []
    });
  });
});

describe("sessions logic helpers", () => {
  it("always enables derived titles for sessions queries", () => {
    expect(
      withDerivedTitles({
        search: "hello",
        includeDerivedTitles: false
      })
    ).toEqual({
      search: "hello",
      includeDerivedTitles: true
    });
  });

  it("builds lookup params from session key", () => {
    expect(
      buildSessionLookupParams("agent:de_finance:user:user-1:direct:session-1")
    ).toEqual({
      agentId: "de_finance"
    });
    expect(buildSessionLookupParams("session-1")).toEqual({});
  });

  it("finds session by exact key", () => {
    expect(
      findSessionByKey(
        [
          {
            key: "session-1",
            kind: "direct",
            updatedAt: 1,
            sessionId: "runtime-1"
          }
        ],
        "session-1"
      )
    ).toMatchObject({
      key: "session-1"
    });

    expect(() => findSessionByKey([], "missing")).toThrow("Session not found");
  });
});

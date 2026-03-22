import type {
  NextFunction,
  Request,
  Response,
  Router
} from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

/**
 * Creates a minimal response double with chainable methods.
 *
 * @returns The mocked response object.
 */
function createResponseDouble(): Response {
  const response = {
    status: vi.fn(),
    json: vi.fn()
  } as unknown as Response;

  vi.mocked(response.status).mockReturnValue(response);

  return response;
}

/**
 * Locates an Express route handler by path and HTTP method.
 *
 * @param router The Express router.
 * @param method HTTP method.
 * @param path Route path string.
 * @returns The handler function, if any.
 */
function findHandler(
  router: Router,
  method: "get",
  path: string
):
  | ((
      request: Request,
      response: Response,
      next: NextFunction
    ) => Promise<void>)
  | undefined {
  const layer = router.stack.find((l) => {
    const r = l.route;
    if (!r || r.path !== path) {
      return false;
    }
    return Boolean((r.methods as Record<string, boolean>)[method]);
  });
  return layer?.route?.stack[0]?.handle;
}

/**
 * Loads the router module with a mocked agent skills logic.
 *
 * @param logic Mocked logic implementation.
 * @returns The imported router factory.
 */
async function importRouterWithLogicMock(
  logic: {
    listEnabledSkills: () => Promise<unknown>;
    listDigitalHumanSkills?: (id: string) => Promise<unknown>;
  }
): Promise<typeof import("./skills")> {
  vi.doMock("../logic/agent-skills", () => ({
    DefaultAgentSkillsLogic: vi.fn().mockImplementation(() => ({
      listEnabledSkills: logic.listEnabledSkills,
      listDigitalHumanSkills:
        logic.listDigitalHumanSkills ?? vi.fn().mockResolvedValue([]),
      listAvailableSkills: vi.fn().mockResolvedValue({ skills: [] }),
      getAgentSkills: vi.fn().mockResolvedValue({ agentId: "a1", skills: [] }),
      updateAgentSkills: vi.fn()
    }))
  }));

  return import("./skills");
}

describe("createSkillsRouter", () => {
  const skillsPath = "/api/dip-studio/v1/skills";
  const digitalHumanSkillsPath = "/api/dip-studio/v1/digital-human/:id/skills";

  it("registers GET /api/dip-studio/v1/skills", async () => {
    const { createSkillsRouter } = await importRouterWithLogicMock({
      listEnabledSkills: async () => []
    });
    const router = createSkillsRouter() as Router;

    expect(findHandler(router, "get", skillsPath)).toBeDefined();
  });

  it("returns available skills on success", async () => {
    const { createSkillsRouter } = await importRouterWithLogicMock({
      listEnabledSkills: async () => [
        { name: "planner", description: "plan tasks" },
        { name: "writer", description: "write docs" }
      ]
    });
    const router = createSkillsRouter() as Router;
    const handler = findHandler(router, "get", skillsPath);
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await handler?.({} as Request, response, next);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith([
      { name: "planner", description: "plan tasks" },
      { name: "writer", description: "write docs" }
    ]);
    expect(next).not.toHaveBeenCalled();
  });

  it("registers GET /api/dip-studio/v1/digital-human/:id/skills", async () => {
    const { createSkillsRouter } = await importRouterWithLogicMock({
      listEnabledSkills: async () => []
    });
    const router = createSkillsRouter() as Router;

    expect(findHandler(router, "get", digitalHumanSkillsPath)).toBeDefined();
  });

  it("returns configured digital human skills on success", async () => {
    const { createSkillsRouter } = await importRouterWithLogicMock({
      listEnabledSkills: async () => [],
      listDigitalHumanSkills: async (id) => [
        { name: `${id}-planner`, description: "plan tasks" }
      ]
    });
    const router = createSkillsRouter() as Router;
    const handler = findHandler(router, "get", digitalHumanSkillsPath);
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await handler?.(
      { params: { id: "a1" } } as unknown as Request,
      response,
      next
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith([
      { name: "a1-planner", description: "plan tasks" }
    ]);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects empty digital human id", async () => {
    const { createSkillsRouter } = await importRouterWithLogicMock({
      listEnabledSkills: async () => []
    });
    const router = createSkillsRouter() as Router;
    const handler = findHandler(router, "get", digitalHumanSkillsPath);
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await handler?.(
      { params: { id: " " } } as unknown as Request,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: "id path parameter is required"
      })
    );
  });

  it("wraps unexpected errors", async () => {
    const { createSkillsRouter } = await importRouterWithLogicMock({
      listEnabledSkills: async () => {
        throw new Error("boom");
      }
    });
    const router = createSkillsRouter() as Router;
    const handler = findHandler(router, "get", skillsPath);
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await handler?.({} as Request, response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 502,
        message: "Failed to query enabled skills"
      })
    );
  });

  it("wraps unexpected digital human skills errors", async () => {
    const { createSkillsRouter } = await importRouterWithLogicMock({
      listEnabledSkills: async () => [],
      listDigitalHumanSkills: async () => {
        throw new Error("boom");
      }
    });
    const router = createSkillsRouter() as Router;
    const handler = findHandler(router, "get", digitalHumanSkillsPath);
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    await handler?.(
      { params: { id: "a1" } } as unknown as Request,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 502,
        message: "Failed to query digital human skills"
      })
    );
  });
});

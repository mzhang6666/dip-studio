import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import {
  buildOpenClawSessionKey,
  createSessionKeyRouter,
  readRequiredUserIdHeader
} from "./session-key";

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

describe("readRequiredUserIdHeader", () => {
  it("returns the normalized user id and rejects missing values", () => {
    expect(readRequiredUserIdHeader(" user-1 ")).toBe("user-1");
    expect(readRequiredUserIdHeader(["user-2", "user-3"])).toBe("user-2");
    expect(() => readRequiredUserIdHeader(undefined)).toThrow(
      "x-user-id header is required"
    );
  });
});

describe("buildOpenClawSessionKey", () => {
  it("builds the expected user session key", () => {
    expect(buildOpenClawSessionKey("user-1", "chat-1")).toBe(
      "user:user-1:direct:chat-1"
    );
  });
});

describe("createSessionKeyRouter", () => {
  it("registers POST /api/dip-studio/v1/chat/session", () => {
    const router = createSessionKeyRouter() as {
      stack: Array<{
        route?: {
          path: string;
        };
      }>;
    };

    const layer = router.stack.find(
      (entry) => entry.route?.path === "/api/dip-studio/v1/chat/session"
    );

    expect(layer).toBeDefined();
  });

  it("returns one new session key", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("chat-1");

    const router = createSessionKeyRouter() as {
      stack: Array<{
        route?: {
          path: string;
          stack: Array<{
            handle: (
              request: Request,
              response: Response,
              next: NextFunction
            ) => void;
          }>;
        };
      }>;
    };
    const layer = router.stack.find(
      (entry) => entry.route?.path === "/api/dip-studio/v1/chat/session"
    );
    const handler = layer?.route?.stack[0]?.handle;
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    handler?.(
      {
        headers: {
          "x-user-id": "user-1"
        }
      } as unknown as Request,
      response,
      next
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      sessionKey: "user:user-1:direct:chat-1"
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards header validation failures to middleware", () => {
    const router = createSessionKeyRouter() as {
      stack: Array<{
        route?: {
          path: string;
          stack: Array<{
            handle: (
              request: Request,
              response: Response,
              next: NextFunction
            ) => void;
          }>;
        };
      }>;
    };
    const layer = router.stack.find(
      (entry) => entry.route?.path === "/api/dip-studio/v1/chat/session"
    );
    const handler = layer?.route?.stack[0]?.handle;
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();

    handler?.(
      {
        headers: {}
      } as unknown as Request,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "x-user-id header is required"
      })
    );
  });
});

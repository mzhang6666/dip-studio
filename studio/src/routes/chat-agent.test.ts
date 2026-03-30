import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import {
  createChatAgentRouter,
  isChatAgentMessageInputItem,
  readChatAgentItemText,
  readChatAgentMessage,
  readChatAgentRequestBody
} from "./chat-agent";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();

  return {
    ...actual,
    randomUUID: vi.fn(() => "generated-idempotency-key")
  };
});

/**
 * Creates a minimal response double with writable stream hooks.
 *
 * @returns The mocked response object.
 */
function createResponseDouble(): Response {
  const response = {
    status: vi.fn(),
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    flushHeaders: vi.fn(),
    destroyed: false,
    headersSent: false,
    writableEnded: false
  } as unknown as Response;

  vi.mocked(response.status).mockReturnValue(response);
  vi.mocked(response.flushHeaders).mockImplementation(() => {
    (response as Response & { headersSent: boolean }).headersSent = true;
  });
  vi.mocked(response.end).mockImplementation(() => {
    (response as Response & { writableEnded: boolean }).writableEnded = true;
  });

  return response;
}

describe("readChatAgentItemText", () => {
  it("extracts text from string and part arrays", () => {
    expect(readChatAgentItemText(" hello ")).toBe("hello");
    expect(
      readChatAgentItemText([
        {
          type: "input_text",
          text: "Hel"
        },
        {
          type: "text",
          text: "lo"
        }
      ])
    ).toBe("Hello");
  });
});

describe("isChatAgentMessageInputItem", () => {
  it("recognizes supported message item shapes", () => {
    expect(
      isChatAgentMessageInputItem({
        type: "message",
        role: "user",
        content: "hello"
      })
    ).toBe(true);
    expect(
      isChatAgentMessageInputItem({
        type: "function_call",
        role: "user",
        content: "hello"
      })
    ).toBe(false);
  });
});

describe("readChatAgentMessage", () => {
  it("accepts direct string input", () => {
    expect(readChatAgentMessage("hello")).toBe("hello");
  });

  it("extracts the latest user message from OpenResponse-style items", () => {
    expect(
      readChatAgentMessage([
        {
          type: "message",
          role: "developer",
          content: "rules"
        },
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "latest "
            },
            {
              type: "input_text",
              text: "question"
            }
          ]
        }
      ])
    ).toBe("latest question");
  });

  it("rejects unsupported input shapes", () => {
    expect(() => readChatAgentMessage(undefined)).toThrow(
      "Chat agent input must be a non-empty string or a message item array"
    );
    expect(() => readChatAgentMessage([])).toThrow(
      "Chat agent input must include a user message"
    );
  });
});

describe("readChatAgentRequestBody", () => {
  it("normalizes the request body", () => {
    expect(
      readChatAgentRequestBody({
        input: "hello"
      })
    ).toEqual({
      message: "hello"
    });
  });

  it("rejects invalid request bodies", () => {
    expect(() => readChatAgentRequestBody(undefined)).toThrow(
      "Chat agent request body must be a JSON object"
    );
  });
});

describe("createChatAgentRouter", () => {
  it("proxies the OpenClaw chat agent as SSE", async () => {
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();
    const createResponseStream = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({
        "content-type": "text/event-stream"
      }),
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              "event: response.created\ndata: {\"type\":\"response.created\"}\n\n"
            )
          );
          controller.close();
        }
      })
    });
    const router = createChatAgentRouter({
      createResponseStream
    }) as {
      stack: Array<{
        route?: {
          path: string;
          stack: Array<{
            handle: (
              request: Request,
              response: Response,
              next: NextFunction
            ) => Promise<void>;
          }>;
        };
      }>;
    };
    const layer = router.stack.find(
      (entry) => entry.route?.path === "/api/dip-studio/v1/chat/agent"
    );
    const handler = layer?.route?.stack[0]?.handle;
    const request = {
      body: {
        input: [
          {
            type: "message",
            role: "user",
            content: "hello"
          }
        ],
      },
      headers: {
        "x-openclaw-session-key": "agent:agent-1:user:user-1:direct:chat-1"
      },
      on: vi.fn()
    } as unknown as Request;

    await handler?.(request, response, next);

    expect(createResponseStream).toHaveBeenCalledWith(
      {
        sessionKey: "agent:agent-1:user:user-1:direct:chat-1",
        message: "hello",
        idempotencyKey: "generated-idempotency-key"
      },
      "agent-1",
      expect.any(AbortSignal)
    );
    expect(response.write).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards validation failures to middleware", async () => {
    const response = createResponseDouble();
    const next = vi.fn<NextFunction>();
    const router = createChatAgentRouter({
      createResponseStream: vi.fn()
    }) as {
      stack: Array<{
        route?: {
          path: string;
          stack: Array<{
            handle: (
              request: Request,
              response: Response,
              next: NextFunction
            ) => Promise<void>;
          }>;
        };
      }>;
    };
    const layer = router.stack.find(
      (entry) => entry.route?.path === "/api/dip-studio/v1/chat/agent"
    );
    const handler = layer?.route?.stack[0]?.handle;

    await handler?.(
      {
        body: {
          input: []
        },
        headers: {
          "x-openclaw-session-key": "agent:agent-1:user:user-1:direct:chat-1"
        },
        on: vi.fn()
      } as unknown as Request,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: "Chat agent input must include a user message"
      })
    );
  });
});

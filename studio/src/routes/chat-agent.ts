import { Router, type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

import { HttpError } from "../errors/http-error";
import {
  DefaultOpenClawChatAgentClient,
  type OpenClawChatAgentClient
} from "../infra/openclaw-chat-agent-client";
import {
  attachDownstreamAbortHandlers,
  pipeEventStream,
  readAgentIdFromSessionKey,
  readRequiredSessionKeyHeader,
  writeEventStreamHeaders
} from "./digital-human-response";
import { getEnv } from "../utils/env";
import type {
  ChatAgentInputItem,
  ChatAgentInputTextContentPart,
  ChatAgentRequest,
  NormalizedChatAgentRequest
} from "../types/chat-agent";

const env = getEnv();
const openClawChatAgentClient = new DefaultOpenClawChatAgentClient({
  url: env.openClawGatewayUrl,
  token: env.openClawGatewayToken,
  timeoutMs: env.openClawGatewayTimeoutMs
});

/**
 * Builds the dedicated chat agent router.
 *
 * @param chatAgentClient Optional OpenClaw chat agent client.
 * @returns The router exposing the chat flow endpoint.
 */
export function createChatAgentRouter(
  chatAgentClient: OpenClawChatAgentClient = openClawChatAgentClient
): Router {
  const router = Router();

  router.post(
    "/api/dip-studio/v1/chat/agent",
    async (
      request: Request<Record<string, never>, unknown, ChatAgentRequest>,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      const abortController = new AbortController();

      attachDownstreamAbortHandlers(request, response, abortController);

      try {
        const requestBody = readChatAgentRequestBody(request.body);
        const sessionKey = readRequiredSessionKeyHeader(request.headers);
        const agentId = readAgentIdFromSessionKey(sessionKey);
        const upstreamResponse = await chatAgentClient.createResponseStream(
          {
            sessionKey,
            message: requestBody.message,
            idempotencyKey: randomUUID()
          },
          agentId,
          abortController.signal
        );

        writeEventStreamHeaders(response, upstreamResponse.status, upstreamResponse.headers);
        await pipeEventStream(upstreamResponse.body, response);
      } catch (error) {
        if (abortController.signal.aborted || response.destroyed) {
          return;
        }

        if (response.headersSent) {
          response.end();
          return;
        }

        next(
          error instanceof HttpError
            ? error
            : new HttpError(502, "Failed to proxy digital human chat agent")
        );
      }
    }
  );

  return router;
}

/**
 * Validates and normalizes the chat agent request body.
 *
 * @param requestBody The raw request body parsed by Express.
 * @returns The normalized request body.
 */
export function readChatAgentRequestBody(
  requestBody: unknown
): NormalizedChatAgentRequest {
  if (typeof requestBody !== "object" || requestBody === null || Array.isArray(requestBody)) {
    throw new HttpError(400, "Chat agent request body must be a JSON object");
  }

  const { input } = requestBody as Partial<ChatAgentRequest>;
  const message = readChatAgentMessage(input);

  return {
    message
  };
}

/**
 * Extracts one user message from an OpenResponse-style agent input field.
 *
 * @param input The raw `input` value from the request body.
 * @returns The normalized user message text.
 */
export function readChatAgentMessage(input: unknown): string {
  if (typeof input === "string" && input.trim() !== "") {
    return input.trim();
  }

  if (!Array.isArray(input)) {
    throw new HttpError(
      400,
      "Chat agent input must be a non-empty string or a message item array"
    );
  }

  for (let index = input.length - 1; index >= 0; index -= 1) {
    const item = input[index];

    if (!isChatAgentMessageInputItem(item) || item.role !== "user") {
      continue;
    }

    const text = readChatAgentItemText(item.content);

    if (text !== "") {
      return text;
    }
  }

  throw new HttpError(400, "Chat agent input must include a user message");
}

/**
 * Extracts text from one OpenResponse-style message content field.
 *
 * @param content The raw message content.
 * @returns The normalized text value.
 */
export function readChatAgentItemText(
  content: string | ChatAgentInputTextContentPart[]
): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (
        typeof part !== "object" ||
        part === null ||
        typeof part.text !== "string" ||
        (part.type !== "input_text" && part.type !== "text")
      ) {
        return "";
      }

      return part.text;
    })
    .join("")
    .trim();
}

/**
 * Checks whether one input item is a supported OpenResponse-style agent message item.
 *
 * @param value The raw input item.
 * @returns Whether the value matches the supported shape.
 */
export function isChatAgentMessageInputItem(
  value: unknown
): value is ChatAgentInputItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.type === "message" &&
    typeof record.role === "string" &&
    (typeof record.content === "string" || Array.isArray(record.content))
  );
}

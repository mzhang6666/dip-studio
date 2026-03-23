import { Router, type NextFunction, type Request, type Response } from "express";

import { HttpError } from "../errors/http-error";
import type { CreateSessionKeyResponse } from "../types/session-key";

/**
 * Builds the session key router.
 *
 * @returns The router exposing session key endpoints.
 */
export function createSessionKeyRouter(): Router {
  const router = Router();

  router.post(
    "/api/dip-studio/v1/chat/session",
    (
      request: Request,
      response: Response<CreateSessionKeyResponse>,
      next: NextFunction
    ): void => {
      try {
        const userId = readRequiredUserIdHeader(request.headers["x-user-id"]);

        response.status(200).json({
          sessionKey: buildOpenClawSessionKey(userId)
        });
      } catch (error) {
        next(
          error instanceof HttpError
            ? error
            : new HttpError(502, "Failed to create session key")
        );
      }
    }
  );

  return router;
}

/**
 * Reads the authenticated user id injected by the auth middleware.
 *
 * @param userIdHeader The raw `x-user-id` header value.
 * @returns The normalized authenticated user id.
 * @throws {HttpError} Thrown when the user id is missing.
 */
export function readRequiredUserIdHeader(
  userIdHeader: string | string[] | undefined
): string {
  const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;

  if (typeof userId !== "string" || userId.trim() === "") {
    throw new HttpError(401, "x-user-id header is required");
  }

  return userId.trim();
}

/**
 * Builds the OpenClaw session key for a new user chat session.
 *
 * @param userId The authenticated user id.
 * @param chatId Optional deterministic chat id used by tests.
 * @returns The normalized OpenClaw session key.
 */
export function buildOpenClawSessionKey(
  userId: string,
  chatId: string = globalThis.crypto.randomUUID()
): string {
  return `user:${userId}:direct:${chatId}`;
}

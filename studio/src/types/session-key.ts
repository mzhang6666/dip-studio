/**
 * Response payload returned by the session key creation endpoint.
 */
export interface CreateSessionKeyResponse {
  /**
   * Newly generated OpenClaw session key.
   */
  sessionKey: string;
}

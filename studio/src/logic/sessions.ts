import type { OpenClawSessionsAdapter } from "../adapters/openclaw-sessions-adapter";
import { HttpError } from "../errors/http-error";
import { parseSession } from "../utils/session";
import type {
  OpenClawSessionGetParams,
  OpenClawSessionGetResult,
  OpenClawSessionSummary,
  OpenClawSessionsListParams,
  OpenClawSessionsListResult,
  OpenClawSessionsPreviewParams,
  OpenClawSessionsPreviewResult
} from "../types/sessions";

/**
 * Application logic used to fetch sessions and message previews.
 */
export interface SessionsLogic {
  /**
   * Fetches sessions list.
   *
   * @param params Query parameters forwarded to OpenClaw.
   * @returns The OpenClaw sessions list payload.
   */
  listSessions(params: OpenClawSessionsListParams): Promise<OpenClawSessionsListResult>;

  /**
   * Fetches one session detail.
   *
   * @param params Query parameters forwarded to OpenClaw.
   * @returns The OpenClaw session detail payload.
   */
  getSession(params: OpenClawSessionGetParams): Promise<OpenClawSessionGetResult>;

  /**
   * Fetches one session summary by exact key match.
   *
   * @param key The target session key.
   * @returns The matched session summary.
   */
  getSessionSummary(key: string): Promise<OpenClawSessionSummary>;

  /**
   * Fetches previews for multiple sessions.
   *
   * @param params Query parameters forwarded to OpenClaw.
   * @returns The OpenClaw sessions preview payload.
   */
  previewSessions(
    params: OpenClawSessionsPreviewParams
  ): Promise<OpenClawSessionsPreviewResult>;
}

/**
 * Logic implementation backed by OpenClaw sessions APIs.
 */
export class DefaultSessionsLogic implements SessionsLogic {
  /**
   * Creates the sessions logic.
   *
   * @param openClawSessionsAdapter The adapter used to fetch OpenClaw sessions data.
   */
  public constructor(
    private readonly openClawSessionsAdapter: OpenClawSessionsAdapter
  ) {}

  /**
   * Fetches sessions list from OpenClaw.
   *
   * @param params Query parameters forwarded to OpenClaw.
   * @returns The OpenClaw sessions list payload.
   */
  public async listSessions(
    params: OpenClawSessionsListParams
  ): Promise<OpenClawSessionsListResult> {
    return this.openClawSessionsAdapter.listSessions(
      withDerivedTitles(params)
    );
  }

  /**
   * Fetches session detail from OpenClaw.
   *
   * @param params Query parameters forwarded to OpenClaw.
   * @returns The OpenClaw session detail payload.
   */
  public async getSession(
    params: OpenClawSessionGetParams
  ): Promise<OpenClawSessionGetResult> {
    return this.openClawSessionsAdapter.getSession(params);
  }

  /**
   * Fetches one session summary by exact key match.
   *
   * @param key The target session key.
   * @returns The matched session summary.
   */
  public async getSessionSummary(key: string): Promise<OpenClawSessionSummary> {
    const sessionsList = await this.openClawSessionsAdapter.listSessions(
      withDerivedTitles(buildSessionLookupParams(key))
    );

    return findSessionByKey(sessionsList.sessions, key);
  }

  /**
   * Fetches sessions preview from OpenClaw.
   *
   * @param params Query parameters forwarded to OpenClaw.
   * @returns The OpenClaw sessions preview payload.
   */
  public async previewSessions(
    params: OpenClawSessionsPreviewParams
  ): Promise<OpenClawSessionsPreviewResult> {
    return this.openClawSessionsAdapter.previewSessions(params);
  }
}

/**
 * Forces sessions queries to include derived titles in responses.
 *
 * @param params Raw sessions list parameters.
 * @returns Sessions list parameters with derived titles always enabled.
 */
export function withDerivedTitles(
  params: OpenClawSessionsListParams
): OpenClawSessionsListParams {
  return {
    ...params,
    includeDerivedTitles: true
  };
}

/**
 * Builds one `sessions.list` query for looking up a specific session by key.
 *
 * @param key Parsed non-empty session key.
 * @returns Parsed `sessions.list` parameters narrowed by agent when available.
 */
export function buildSessionLookupParams(key: string): OpenClawSessionsListParams {
  try {
    const parsedSession = parseSession(key);

    return {
      agentId: parsedSession.agent
    };
  } catch {
    return {};
  }
}

/**
 * Finds one session summary by exact key match.
 *
 * @param sessions Session summary list.
 * @param key Requested session key.
 * @returns The matching session summary.
 */
export function findSessionByKey(
  sessions: OpenClawSessionSummary[],
  key: string
): OpenClawSessionSummary {
  const matchedSession = sessions.find((session) => session.key === key);

  if (matchedSession === undefined) {
    throw new HttpError(404, "Session not found");
  }

  return matchedSession;
}

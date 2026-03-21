import type {
  OpenClawAgentsCreateParams,
  OpenClawAgentsCreateResult,
  OpenClawAgentsDeleteParams,
  OpenClawAgentsDeleteResult,
  OpenClawAgentsFilesGetParams,
  OpenClawAgentsFilesGetResult,
  OpenClawAgentsFilesSetParams,
  OpenClawAgentsFilesSetResult,
  OpenClawAgentsListResult,
  OpenClawConfigGetResult,
  OpenClawConfigPatchParams,
  OpenClawConfigPatchResult,
  OpenClawGatewayPort,
  OpenClawRequestFrame
} from "../types/openclaw";

/**
 * Outbound adapter used to manage OpenClaw agents through the gateway port.
 */
export interface OpenClawAgentsAdapter {
  /**
   * Fetches the current OpenClaw agent list.
   *
   * @returns The OpenClaw `AgentsListResult` payload.
   */
  listAgents(): Promise<OpenClawAgentsListResult>;

  /**
   * Creates a new OpenClaw agent.
   *
   * @param params The agent creation parameters.
   * @returns The OpenClaw `AgentsCreateResult` payload.
   */
  createAgent(params: OpenClawAgentsCreateParams): Promise<OpenClawAgentsCreateResult>;

  /**
   * Deletes an existing OpenClaw agent.
   *
   * @param params The agent deletion parameters.
   * @returns The OpenClaw `AgentsDeleteResult` payload.
   */
  deleteAgent(params: OpenClawAgentsDeleteParams): Promise<OpenClawAgentsDeleteResult>;

  /**
   * Reads a workspace file from an OpenClaw agent.
   *
   * @param params The file retrieval parameters.
   * @returns The file metadata and content.
   */
  getAgentFile(params: OpenClawAgentsFilesGetParams): Promise<OpenClawAgentsFilesGetResult>;

  /**
   * Writes (overwrites) a workspace file for an OpenClaw agent.
   *
   * @param params The file write parameters.
   * @returns The written file metadata.
   */
  setAgentFile(params: OpenClawAgentsFilesSetParams): Promise<OpenClawAgentsFilesSetResult>;

  /**
   * Reads the current OpenClaw configuration.
   *
   * @returns The serialized config and its content hash.
   */
  getConfig(): Promise<OpenClawConfigGetResult>;

  /**
   * Applies a partial configuration patch to OpenClaw.
   *
   * @param params The patch payload and base hash for optimistic locking.
   * @returns The patch result.
   */
  patchConfig(params: OpenClawConfigPatchParams): Promise<OpenClawConfigPatchResult>;
}

/**
 * Creates the OpenClaw `agents.list` request.
 *
 * @param requestId The frame correlation id.
 * @returns A serialized OpenClaw request frame.
 */
export function createAgentsListRequest(
  requestId: string
): OpenClawRequestFrame {
  return {
    type: "req",
    id: requestId,
    method: "agents.list",
    params: {}
  };
}

/**
 * Creates the OpenClaw `agents.create` request.
 *
 * @param requestId The frame correlation id.
 * @param params The agent creation parameters.
 * @returns A serialized OpenClaw request frame.
 */
export function createAgentsCreateRequest(
  requestId: string,
  params: OpenClawAgentsCreateParams
): OpenClawRequestFrame {
  return {
    type: "req",
    id: requestId,
    method: "agents.create",
    params
  };
}

/**
 * Creates the OpenClaw `agents.delete` request.
 *
 * @param requestId The frame correlation id.
 * @param params The agent deletion parameters.
 * @returns A serialized OpenClaw request frame.
 */
export function createAgentsDeleteRequest(
  requestId: string,
  params: OpenClawAgentsDeleteParams
): OpenClawRequestFrame {
  return {
    type: "req",
    id: requestId,
    method: "agents.delete",
    params
  };
}

/**
 * Creates the OpenClaw `agents.files.get` request.
 *
 * @param requestId The frame correlation id.
 * @param params The file retrieval parameters.
 * @returns A serialized OpenClaw request frame.
 */
export function createAgentsFilesGetRequest(
  requestId: string,
  params: OpenClawAgentsFilesGetParams
): OpenClawRequestFrame {
  return {
    type: "req",
    id: requestId,
    method: "agents.files.get",
    params
  };
}

/**
 * Creates the OpenClaw `agents.files.set` request.
 *
 * @param requestId The frame correlation id.
 * @param params The file write parameters.
 * @returns A serialized OpenClaw request frame.
 */
export function createAgentsFilesSetRequest(
  requestId: string,
  params: OpenClawAgentsFilesSetParams
): OpenClawRequestFrame {
  return {
    type: "req",
    id: requestId,
    method: "agents.files.set",
    params
  };
}

/**
 * Creates the OpenClaw `config.get` request.
 *
 * @param requestId The frame correlation id.
 * @returns A serialized OpenClaw request frame.
 */
export function createConfigGetRequest(
  requestId: string
): OpenClawRequestFrame {
  return {
    type: "req",
    id: requestId,
    method: "config.get",
    params: {}
  };
}

/**
 * Creates the OpenClaw `config.patch` request.
 *
 * @param requestId The frame correlation id.
 * @param params The config patch parameters.
 * @returns A serialized OpenClaw request frame.
 */
export function createConfigPatchRequest(
  requestId: string,
  params: OpenClawConfigPatchParams
): OpenClawRequestFrame {
  return {
    type: "req",
    id: requestId,
    method: "config.patch",
    params
  };
}

/**
 * Adapter that translates agent operations to OpenClaw Gateway JSON RPC.
 */
export class OpenClawAgentsGatewayAdapter implements OpenClawAgentsAdapter {
  /**
   * Creates the adapter.
   *
   * @param gatewayPort The OpenClaw Gateway RPC port.
   */
  public constructor(private readonly gatewayPort: OpenClawGatewayPort) {}

  /**
   * Queries `agents.list` over the gateway RPC port.
   *
   * @returns The OpenClaw `AgentsListResult` payload.
   */
  public async listAgents(): Promise<OpenClawAgentsListResult> {
    return this.gatewayPort.invoke<OpenClawAgentsListResult>(
      createAgentsListRequest("agents.list")
    );
  }

  /**
   * Invokes `agents.create` over the gateway RPC port.
   *
   * @param params The agent creation parameters.
   * @returns The OpenClaw `AgentsCreateResult` payload.
   */
  public async createAgent(
    params: OpenClawAgentsCreateParams
  ): Promise<OpenClawAgentsCreateResult> {
    return this.gatewayPort.invoke<OpenClawAgentsCreateResult>(
      createAgentsCreateRequest("agents.create", params)
    );
  }

  /**
   * Invokes `agents.delete` over the gateway RPC port.
   *
   * @param params The agent deletion parameters.
   * @returns The OpenClaw `AgentsDeleteResult` payload.
   */
  public async deleteAgent(
    params: OpenClawAgentsDeleteParams
  ): Promise<OpenClawAgentsDeleteResult> {
    return this.gatewayPort.invoke<OpenClawAgentsDeleteResult>(
      createAgentsDeleteRequest("agents.delete", params)
    );
  }

  /**
   * Invokes `agents.files.get` over the gateway RPC port.
   *
   * @param params The file retrieval parameters.
   * @returns The file metadata and content.
   */
  public async getAgentFile(
    params: OpenClawAgentsFilesGetParams
  ): Promise<OpenClawAgentsFilesGetResult> {
    return this.gatewayPort.invoke<OpenClawAgentsFilesGetResult>(
      createAgentsFilesGetRequest("agents.files.get", params)
    );
  }

  /**
   * Invokes `agents.files.set` over the gateway RPC port.
   *
   * @param params The file write parameters.
   * @returns The written file metadata.
   */
  public async setAgentFile(
    params: OpenClawAgentsFilesSetParams
  ): Promise<OpenClawAgentsFilesSetResult> {
    return this.gatewayPort.invoke<OpenClawAgentsFilesSetResult>(
      createAgentsFilesSetRequest("agents.files.set", params)
    );
  }

  /**
   * Invokes `config.get` over the gateway RPC port.
   *
   * @returns The serialized config and its content hash.
   */
  public async getConfig(): Promise<OpenClawConfigGetResult> {
    return this.gatewayPort.invoke<OpenClawConfigGetResult>(
      createConfigGetRequest("config.get")
    );
  }

  /**
   * Invokes `config.patch` over the gateway RPC port.
   *
   * @param params The patch payload and base hash.
   * @returns The patch result.
   */
  public async patchConfig(
    params: OpenClawConfigPatchParams
  ): Promise<OpenClawConfigPatchResult> {
    return this.gatewayPort.invoke<OpenClawConfigPatchResult>(
      createConfigPatchRequest("config.patch", params)
    );
  }
}

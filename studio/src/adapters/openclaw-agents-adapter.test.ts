import { describe, expect, it, vi } from "vitest";

import {
  createAgentsCreateRequest,
  createAgentsDeleteRequest,
  createAgentsFilesGetRequest,
  createAgentsFilesSetRequest,
  createConfigGetRequest,
  createConfigPatchRequest,
  OpenClawAgentsGatewayAdapter,
  createAgentsListRequest
} from "./openclaw-agents-adapter";

describe("createAgentsListRequest", () => {
  it("builds the agents.list JSON RPC frame", () => {
    expect(createAgentsListRequest("req-2")).toEqual({
      type: "req",
      id: "req-2",
      method: "agents.list",
      params: {}
    });
  });
});

describe("createAgentsCreateRequest", () => {
  it("builds the agents.create JSON RPC frame", () => {
    expect(
      createAgentsCreateRequest("req-4", {
        name: "Main Agent",
        workspace: "/path/to/main"
      })
    ).toEqual({
      type: "req",
      id: "req-4",
      method: "agents.create",
      params: {
        name: "Main Agent",
        workspace: "/path/to/main"
      }
    });
  });
});

describe("OpenClawAgentsGatewayAdapter", () => {
  it("delegates agents.list to the gateway port", async () => {
    const gatewayPort = {
      invoke: vi.fn().mockResolvedValue({
        defaultId: "main",
        mainKey: "sender",
        scope: "per-sender",
        agents: [
          {
            id: "main",
            name: "Main Agent",
            identity: {
              avatarUrl: "https://example.com/main.png"
            }
          }
        ]
      })
    };
    const adapter = new OpenClawAgentsGatewayAdapter(gatewayPort);

    await expect(adapter.listAgents()).resolves.toEqual({
      defaultId: "main",
      mainKey: "sender",
      scope: "per-sender",
      agents: [
        {
          id: "main",
          name: "Main Agent",
          identity: {
            avatarUrl: "https://example.com/main.png"
          }
        }
      ]
    });
    expect(gatewayPort.invoke).toHaveBeenCalledOnce();
  });

  it("delegates agents.create to the gateway port", async () => {
    const gatewayPort = {
      invoke: vi.fn().mockResolvedValue({
        ok: true,
        agentId: "main",
        name: "Main Agent",
        workspace: "/path/to/main"
      })
    };
    const adapter = new OpenClawAgentsGatewayAdapter(gatewayPort);

    await expect(
      adapter.createAgent({
        name: "Main Agent",
        workspace: "/path/to/main"
      })
    ).resolves.toEqual({
      ok: true,
      agentId: "main",
      name: "Main Agent",
      workspace: "/path/to/main"
    });

    expect(gatewayPort.invoke).toHaveBeenNthCalledWith(
      1,
      createAgentsCreateRequest("agents.create", {
        name: "Main Agent",
        workspace: "/path/to/main"
      })
    );
  });

  it("delegates agents.delete to the gateway port", async () => {
    const gatewayPort = {
      invoke: vi.fn().mockResolvedValue({ ok: true })
    };
    const adapter = new OpenClawAgentsGatewayAdapter(gatewayPort);

    await adapter.deleteAgent({ agentId: "x", deleteFiles: true });

    expect(gatewayPort.invoke).toHaveBeenCalledWith(
      createAgentsDeleteRequest("agents.delete", {
        agentId: "x",
        deleteFiles: true
      })
    );
  });

  it("delegates agents.files.get to the gateway port", async () => {
    const gatewayPort = {
      invoke: vi.fn().mockResolvedValue({
        file: { name: "IDENTITY.md", content: "x" }
      })
    };
    const adapter = new OpenClawAgentsGatewayAdapter(gatewayPort);

    await adapter.getAgentFile({ agentId: "a", name: "IDENTITY.md" });

    expect(gatewayPort.invoke).toHaveBeenCalledWith(
      createAgentsFilesGetRequest("agents.files.get", {
        agentId: "a",
        name: "IDENTITY.md"
      })
    );
  });

  it("delegates agents.files.set to the gateway port", async () => {
    const gatewayPort = {
      invoke: vi.fn().mockResolvedValue({ file: { name: "SOUL.md" } })
    };
    const adapter = new OpenClawAgentsGatewayAdapter(gatewayPort);

    await adapter.setAgentFile({
      agentId: "a",
      name: "SOUL.md",
      content: "body"
    });

    expect(gatewayPort.invoke).toHaveBeenCalledWith(
      createAgentsFilesSetRequest("agents.files.set", {
        agentId: "a",
        name: "SOUL.md",
        content: "body"
      })
    );
  });

  it("delegates config.get to the gateway port", async () => {
    const gatewayPort = {
      invoke: vi.fn().mockResolvedValue({ config: {}, hash: "h" })
    };
    const adapter = new OpenClawAgentsGatewayAdapter(gatewayPort);

    await adapter.getConfig();

    expect(gatewayPort.invoke).toHaveBeenCalledWith(
      createConfigGetRequest("config.get")
    );
  });

  it("delegates config.patch to the gateway port", async () => {
    const gatewayPort = {
      invoke: vi.fn().mockResolvedValue({ ok: true })
    };
    const adapter = new OpenClawAgentsGatewayAdapter(gatewayPort);

    await adapter.patchConfig({ raw: "{}", baseHash: "h" });

    expect(gatewayPort.invoke).toHaveBeenCalledWith(
      createConfigPatchRequest("config.patch", {
        raw: "{}",
        baseHash: "h"
      })
    );
  });
});

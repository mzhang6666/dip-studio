import { mkdtempSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  linkSkillsToWorkspace,
  listLinkedSkillNames,
  syncSkillsToWorkspace
} from "./skill-linker";

describe("skill-linker", () => {
  it("linkSkillsToWorkspace creates symlinks for each skill", async () => {
    const root = mkdtempSync(join(tmpdir(), "dip-sl-"));
    const store = join(root, "store");
    const workspace = join(root, "ws");
    await mkdir(join(store, "s1"), { recursive: true });
    await mkdir(join(store, "s2"), { recursive: true });

    await linkSkillsToWorkspace(workspace, ["s1", "s2"], store);

    const names = await listLinkedSkillNames(workspace);
    expect(names.sort()).toEqual(["s1", "s2"]);
  });

  it("linkSkillsToWorkspace is a no-op for empty list", async () => {
    const root = mkdtempSync(join(tmpdir(), "dip-sl2-"));
    await linkSkillsToWorkspace(join(root, "ws"), [], join(root, "store"));
  });

  it("listLinkedSkillNames returns empty when skills dir missing", async () => {
    const root = mkdtempSync(join(tmpdir(), "dip-sl3-"));
    await expect(listLinkedSkillNames(join(root, "missing"))).resolves.toEqual([]);
  });

  it("syncSkillsToWorkspace removes stale links and adds new", async () => {
    const root = mkdtempSync(join(tmpdir(), "dip-sl4-"));
    const store = join(root, "store");
    const workspace = join(root, "ws");
    await mkdir(join(store, "keep"), { recursive: true });
    await mkdir(join(store, "gone"), { recursive: true });
    await mkdir(join(store, "newskill"), { recursive: true });
    await syncSkillsToWorkspace(workspace, ["keep", "gone"], store);
    await syncSkillsToWorkspace(workspace, ["keep", "newskill"], store);

    const names = (await listLinkedSkillNames(workspace)).sort();
    expect(names).toEqual(["keep", "newskill"]);
  });

  it("linkSkillsToWorkspace throws when skill source missing", async () => {
    const root = mkdtempSync(join(tmpdir(), "dip-sl5-"));
    await expect(
      linkSkillsToWorkspace(join(root, "ws"), ["nope"], join(root, "store"))
    ).rejects.toThrow(/not found/);
  });

  it("assertDirectoryExists throws for file not dir", async () => {
    const root = mkdtempSync(join(tmpdir(), "dip-sl6-"));
    const storePath = join(root, "store", "bad");
    await mkdir(join(root, "store"), { recursive: true });
    writeFileSync(storePath, "x");
    await expect(
      linkSkillsToWorkspace(join(root, "ws"), ["bad"], join(root, "store"))
    ).rejects.toThrow(/not a directory/);
  });
});

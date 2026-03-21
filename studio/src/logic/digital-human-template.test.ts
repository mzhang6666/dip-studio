import { describe, expect, it } from "vitest";

import {
  buildTemplate,
  mergeFilesToTemplate,
  mergeTemplatePatch,
  parseIdentityMarkdown,
  renderIdentityMarkdown,
  renderSoulMarkdown
} from "./digital-human-template";

describe("buildTemplate", () => {
  it("builds a template from a create request", () => {
    expect(
      buildTemplate({
        name: "A",
        creature: "B",
        soul: "C",
        bkn: [{ name: "n", url: "u" }]
      })
    ).toEqual({
      identity: { name: "A", creature: "B" },
      soul: "C",
      bkn: [{ name: "n", url: "u" }]
    });
  });

  it("defaults soul to empty string", () => {
    expect(buildTemplate({ name: "Only" }).soul).toBe("");
  });
});

describe("mergeTemplatePatch", () => {
  const base = {
    identity: { name: "N", creature: "C" },
    soul: "s",
    bkn: [{ name: "x", url: "y" }]
  };

  it("merges only provided keys", () => {
    expect(mergeTemplatePatch(base, { name: "New" })).toEqual({
      identity: { name: "New", creature: "C" },
      soul: "s",
      bkn: [{ name: "x", url: "y" }]
    });
  });

  it("clears creature when patch includes creature key as undefined", () => {
    const r = mergeTemplatePatch(base, { creature: undefined });
    expect(r.identity.creature).toBeUndefined();
  });

  it("replaces soul when provided", () => {
    expect(mergeTemplatePatch(base, { soul: "new" }).soul).toBe("new");
  });

  it("replaces bkn when provided", () => {
    expect(mergeTemplatePatch(base, { bkn: [] }).bkn).toEqual([]);
  });

  it("keeps creature when patch omits creature key", () => {
    const merged = mergeTemplatePatch(base, { name: "OnlyName" });
    expect(merged.identity.creature).toBe("C");
  });
});

describe("parseIdentityMarkdown", () => {
  it("parses name and creature lines", () => {
    expect(
      parseIdentityMarkdown(
        "# IDENTITY.md\n\n- Name: Alice\n- Creature: Dev\n"
      )
    ).toEqual({ name: "Alice", creature: "Dev" });
  });

  it("skips lines without values", () => {
    expect(parseIdentityMarkdown("- Name:\n- Name: Z\n")).toEqual({ name: "Z" });
  });
});

describe("mergeFilesToTemplate", () => {
  it("merges identity and soul without BKN", () => {
    const t = mergeFilesToTemplate(
      "- Name: Bob\n",
      "Hello soul"
    );
    expect(t.identity.name).toBe("Bob");
    expect(t.soul).toBe("Hello soul");
    expect(t.bkn).toBeUndefined();
  });

  it("parses BKN table from soul", () => {
    const soul = `Text\n\n## 业务知识网络\n\n| 名称 | 地址 |\n|------|------|\n| Doc | https://x |\n`;
    const t = mergeFilesToTemplate("- Name: C\n", soul);
    expect(t.bkn).toEqual([{ name: "Doc", url: "https://x" }]);
  });
});

describe("renderIdentityMarkdown / renderSoulMarkdown", () => {
  it("renders identity with optional creature", () => {
    const md = renderIdentityMarkdown({
      identity: { name: "X", creature: "Y" },
      soul: ""
    });
    expect(md).toContain("- Name: X");
    expect(md).toContain("- Creature: Y");
  });

  it("renders soul and BKN table", () => {
    const md = renderSoulMarkdown({
      identity: { name: "X" },
      soul: "body",
      bkn: [{ name: "a", url: "b" }]
    });
    expect(md).toContain("body");
    expect(md).toContain("## 业务知识网络");
    expect(md).toContain("| a | b |");
  });
});

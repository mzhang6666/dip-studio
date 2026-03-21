import type {
  BknEntry,
  CreateDigitalHumanRequest,
  DigitalHumanTemplate,
  UpdateDigitalHumanRequest
} from "../types/digital-human";

// ---------------------------------------------------------------------------
// Write-direction: request -> template -> markdown
// ---------------------------------------------------------------------------

/**
 * Builds a {@link DigitalHumanTemplate} from the incoming API request.
 *
 * @param request The creation request payload.
 * @returns A fully populated template ready for markdown rendering.
 */
export function buildTemplate(
  request: CreateDigitalHumanRequest
): DigitalHumanTemplate {
  return {
    identity: {
      name: request.name,
      creature: request.creature
    },
    soul: request.soul ?? "",
    bkn: request.bkn
  };
}

/**
 * Applies a partial update onto an existing template.
 *
 * Only keys present on `patch` (own properties) overwrite; omitted keys
 * keep their current values. This allows PUT bodies that only set e.g.
 * `channel` without clearing other fields.
 */
export function mergeTemplatePatch(
  current: DigitalHumanTemplate,
  patch: UpdateDigitalHumanRequest
): DigitalHumanTemplate {
  const p = patch as Record<string, unknown>;
  const has = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(p, key);

  return {
    identity: {
      name: has("name") ? (patch.name as string) : current.identity.name,
      creature: has("creature") ? patch.creature : current.identity.creature
    },
    soul: has("soul") ? (patch.soul ?? "") : current.soul,
    bkn: has("bkn") ? patch.bkn : current.bkn
  };
}

/**
 * Renders the IDENTITY.md content from a template.
 *
 * Follows the OpenClaw `- Key: Value` convention so that the built-in
 * identity parser in OpenClaw can parse it back.
 *
 * @param template The digital human template.
 * @returns The IDENTITY.md markdown string.
 */
export function renderIdentityMarkdown(
  template: DigitalHumanTemplate
): string {
  const { identity } = template;
  const lines: string[] = ["# IDENTITY.md", ""];

  lines.push(`- Name: ${identity.name}`);

  if (identity.creature) {
    lines.push(`- Creature: ${identity.creature}`);
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Renders the SOUL.md content from a template.
 *
 * The soul field is a raw markdown string provided by the client.
 * We write it as-is to preserve the user's formatting.
 *
 * @param template The digital human template.
 * @returns The SOUL.md markdown string.
 */
export function renderSoulMarkdown(
  template: DigitalHumanTemplate
): string {
  const parts: string[] = [];

  if (template.soul) {
    parts.push(template.soul);
  }

  if (template.bkn && template.bkn.length > 0) {
    parts.push(renderBknTable(template.bkn));
  }

  return parts.join("\n\n");
}

const BKN_HEADING = "## 业务知识网络";

function renderBknTable(entries: BknEntry[]): string {
  const lines: string[] = [
    BKN_HEADING,
    "",
    "| 名称 | 地址 |",
    "|------|------|"
  ];

  for (const entry of entries) {
    lines.push(`| ${entry.name} | ${entry.url} |`);
  }

  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Read-direction: markdown -> template
// ---------------------------------------------------------------------------

/**
 * Parses IDENTITY.md content into structured identity fields.
 *
 * Mirrors the `parseIdentityMarkdown` logic in OpenClaw
 * (`src/agents/identity-file.ts`).
 *
 * @param content The raw IDENTITY.md content.
 * @returns Parsed identity fields.
 */
export function parseIdentityMarkdown(
  content: string
): DigitalHumanTemplate["identity"] {
  const identity: DigitalHumanTemplate["identity"] = { name: "" };
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const cleaned = line.trim().replace(/^\s*-\s*/, "");
    const colonIndex = cleaned.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const label = cleaned
      .slice(0, colonIndex)
      .replace(/[*_]/g, "")
      .trim()
      .toLowerCase();
    const value = cleaned
      .slice(colonIndex + 1)
      .replace(/^[*_]+|[*_]+$/g, "")
      .trim();

    if (!value) {
      continue;
    }

    switch (label) {
      case "name":
        identity.name = value;
        break;
      case "creature":
        identity.creature = value;
        break;
    }
  }

  return identity;
}

/**
 * Convenience function that parses both workspace files and merges them
 * into a complete {@link DigitalHumanTemplate}.
 *
 * @param identityContent Raw IDENTITY.md content.
 * @param soulContent Raw SOUL.md content.
 * @returns A merged template.
 */
export function mergeFilesToTemplate(
  identityContent: string,
  soulContent: string
): DigitalHumanTemplate {
  const identity = parseIdentityMarkdown(identityContent);
  const { soul, bkn } = parseSoulMarkdown(soulContent);

  return { identity, soul, ...(bkn.length > 0 ? { bkn } : {}) };
}

/**
 * Splits raw SOUL.md content into the free-form soul text
 * and structured BKN entries (if a BKN table is present).
 */
function parseSoulMarkdown(
  content: string
): { soul: string; bkn: BknEntry[] } {
  const headingIdx = content.indexOf(BKN_HEADING);

  if (headingIdx === -1) {
    return { soul: content, bkn: [] };
  }

  const soul = content.slice(0, headingIdx).trimEnd();
  const tableSection = content.slice(headingIdx);
  const bkn = parseBknTable(tableSection);

  return { soul, bkn };
}

function parseBknTable(section: string): BknEntry[] {
  const entries: BknEntry[] = [];
  const lines = section.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;

    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());

    if (cells.length < 2) continue;
    if (cells[0] === "名称" || /^-+$/.test(cells[0])) continue;

    entries.push({ name: cells[0], url: cells[1] });
  }

  return entries;
}

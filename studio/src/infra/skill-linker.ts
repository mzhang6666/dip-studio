import { mkdir, readdir, readlink, symlink, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

/**
 * Links one or more skills from a central skill store into an agent workspace.
 *
 * For each skill name a directory symlink is created at
 * `<workspaceDir>/skills/<name>` pointing to `<skillStorePath>/<name>/`.
 *
 * @param workspaceDir  Absolute path to the agent workspace directory.
 * @param skillNames    Skill directory names to link.
 * @param skillStorePath Absolute path to the central skill store.
 * @throws {Error} If a source skill directory does not exist.
 */
export async function linkSkillsToWorkspace(
  workspaceDir: string,
  skillNames: string[],
  skillStorePath: string
): Promise<void> {
  if (skillNames.length === 0) {
    return;
  }

  const skillsDir = join(workspaceDir, "skills");
  await mkdir(skillsDir, { recursive: true });

  for (const name of skillNames) {
    const source = join(skillStorePath, name);
    const target = join(skillsDir, name);

    await assertDirectoryExists(source, name);
    await ensureSymlink(source, target);
  }
}

/**
 * Verifies that the source directory exists and is a directory.
 *
 * @param dirPath  The path to check.
 * @param skillName The skill name for error reporting.
 * @throws {Error} When the path does not exist or is not a directory.
 */
async function assertDirectoryExists(
  dirPath: string,
  skillName: string
): Promise<void> {
  try {
    const st = await stat(dirPath);
    if (!st.isDirectory()) {
      throw new Error(`Skill source "${skillName}" is not a directory: ${dirPath}`);
    }
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Skill source "${skillName}" not found: ${dirPath}`);
    }
    throw error;
  }
}

/**
 * Creates a directory symlink, replacing an existing symlink when
 * it points to a different target. Non-symlink entries are left
 * untouched to avoid accidental data loss.
 *
 * @param source The symlink target (the skill store directory).
 * @param target The symlink path inside the workspace.
 */
async function ensureSymlink(
  source: string,
  target: string
): Promise<void> {
  try {
    const existing = await readlink(target);
    if (existing === source) {
      return;
    }
    await unlink(target);
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT")) {
      throw error;
    }
  }

  await symlink(source, target, "dir");
}

/**
 * Lists skill names currently present under `<workspaceDir>/skills/`.
 *
 * @param workspaceDir Absolute path to the agent workspace.
 * @returns Directory entry names (symlinks or folders).
 */
export async function listLinkedSkillNames(
  workspaceDir: string
): Promise<string[]> {
  const skillsDir = join(workspaceDir, "skills");
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    return entries.map((e) => e.name);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }
}

/**
 * Replaces the workspace skills directory so it matches `skillNames`
 * (removes links not in the list, adds missing ones).
 *
 * @param workspaceDir Absolute path to the agent workspace.
 * @param skillNames Desired skill directory names (may be empty).
 * @param skillStorePath Absolute path to the central skill store.
 */
export async function syncSkillsToWorkspace(
  workspaceDir: string,
  skillNames: string[],
  skillStorePath: string
): Promise<void> {
  const skillsDir = join(workspaceDir, "skills");
  await mkdir(skillsDir, { recursive: true });

  const existing = await listLinkedSkillNames(workspaceDir);
  const desired = new Set(skillNames);

  for (const name of existing) {
    if (!desired.has(name)) {
      await unlink(join(skillsDir, name)).catch(() => {
        /* ignore */
      });
    }
  }

  if (skillNames.length === 0) {
    return;
  }

  await linkSkillsToWorkspace(workspaceDir, skillNames, skillStorePath);
}

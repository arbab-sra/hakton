import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { GitHubRepositoryError, parseGitHubRepositoryUrl } from "./github";

const execFileAsync = promisify(execFile);
const gitBranch = /^(?!-)(?!.*\.\.)(?!.*\/$)[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/;

export interface CloneRepositoryInput {
  cloneUrl: string;
  branch: string;
  scanId: string;
  workdir: string;
}

export interface CloneRepositoryResult {
  clonePath: string;
  commit: string;
}

function getScanWorkspace(workdir: string, scanId: string) {
  const baseDirectory = resolve(workdir, "scans");
  const scanDirectory = resolve(baseDirectory, scanId);
  const pathFromBase = relative(baseDirectory, scanDirectory);

  if (!pathFromBase || pathFromBase.startsWith("..") || basename(scanDirectory) !== scanId) {
    throw new Error("Invalid scan workspace path.");
  }

  return { baseDirectory, scanDirectory };
}

export async function cloneGitHubRepository({
  cloneUrl,
  branch,
  scanId,
  workdir
}: CloneRepositoryInput): Promise<CloneRepositoryResult> {
  parseGitHubRepositoryUrl(cloneUrl);

  if (!gitBranch.test(branch)) {
    throw new GitHubRepositoryError("GitHub returned an invalid default branch name.");
  }

  const { baseDirectory, scanDirectory } = getScanWorkspace(workdir, scanId);
  await mkdir(baseDirectory, { recursive: true });
  await rm(scanDirectory, { recursive: true, force: true });

  try {
    await execFileAsync(
      "git",
      ["clone", "--depth", "1", "--single-branch", "--branch", branch, cloneUrl, scanDirectory],
      { timeout: 120_000, maxBuffer: 1024 * 1024 }
    );
    const { stdout } = await execFileAsync("git", ["-C", scanDirectory, "rev-parse", "HEAD"], {
      timeout: 10_000
    });

    return { clonePath: scanDirectory, commit: stdout.trim() };
  } catch {
    await rm(scanDirectory, { recursive: true, force: true });
    throw new Error("Git clone failed. Confirm that the repository and branch are accessible.");
  }
}

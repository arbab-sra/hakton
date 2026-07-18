import { z } from "zod";

const githubSegment = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

const githubRepositoryResponseSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  name: z.string().min(1),
  full_name: z.string().min(3),
  html_url: z.string().url(),
  clone_url: z.string().url(),
  default_branch: z.string().min(1),
  private: z.boolean(),
  visibility: z.string().optional(),
  owner: z.object({ login: z.string().min(1) })
});

export interface GitHubRepositoryReference {
  owner: string;
  name: string;
  canonicalUrl: string;
}

export interface GitHubRepositoryMetadata extends GitHubRepositoryReference {
  id: string;
  cloneUrl: string;
  defaultBranch: string;
  visibility: string;
}

export class GitHubRepositoryError extends Error {}

export function parseGitHubRepositoryUrl(value: string): GitHubRepositoryReference {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new GitHubRepositoryError("Enter a valid GitHub repository URL.");
  }

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    throw new GitHubRepositoryError("Only HTTPS URLs from github.com can be imported.");
  }

  if (url.search || url.hash) {
    throw new GitHubRepositoryError("Repository URLs cannot include a query string or fragment.");
  }

  const path = url.pathname.replace(/^\/+|\/+$/g, "");
  const [owner, repository, ...remaining] = path.split("/");
  const name = repository?.replace(/\.git$/i, "");

  if (
    !owner ||
    !name ||
    remaining.length > 0 ||
    !githubSegment.test(owner) ||
    !githubSegment.test(name)
  ) {
    throw new GitHubRepositoryError(
      "Use a repository URL in the form https://github.com/owner/repository."
    );
  }

  return { owner, name, canonicalUrl: `https://github.com/${owner}/${name}` };
}

export async function getGitHubRepositoryMetadata(
  repositoryUrl: string,
  githubToken?: string
): Promise<GitHubRepositoryMetadata> {
  const reference = parseGitHubRepositoryUrl(repositoryUrl);
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "CodeMRI"
  });

  if (githubToken) {
    headers.set("Authorization", `Bearer ${githubToken}`);
  }

  let response: Response;
  try {
    response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.name)}`,
      { headers, signal: AbortSignal.timeout(10_000) }
    );
  } catch {
    throw new GitHubRepositoryError("GitHub could not be reached. Try again shortly.");
  }

  if (response.status === 404) {
    throw new GitHubRepositoryError(
      "Repository not found or not accessible to the configured GitHub token."
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new GitHubRepositoryError(
      "GitHub rejected the request. Check the configured token permissions."
    );
  }

  if (!response.ok) {
    throw new GitHubRepositoryError("GitHub could not validate this repository right now.");
  }

  const parsed = githubRepositoryResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new GitHubRepositoryError("GitHub returned an unexpected repository response.");
  }

  const repository = parsed.data;
  const cloneReference = parseGitHubRepositoryUrl(repository.clone_url);

  return {
    id: repository.id,
    owner: repository.owner.login,
    name: repository.name,
    canonicalUrl: repository.html_url,
    cloneUrl: cloneReference.canonicalUrl.endsWith(`/${repository.name}`)
      ? repository.clone_url
      : `${reference.canonicalUrl}.git`,
    defaultBranch: repository.default_branch,
    visibility: repository.visibility ?? (repository.private ? "private" : "public")
  };
}

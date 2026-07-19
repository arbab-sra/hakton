"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input
} from "@codemri/ui/components";

interface ScanSummary {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  currentStage: string;
  progress: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  repositoryId: string;
  repositoryName: string;
  repositoryUrl: string;
  repositoryStatus: "pending" | "cloning" | "ready" | "failed";
  branch: string;
}

interface ApiError {
  error?: unknown;
}

const groqModels = [
  {
    value: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "Fast structured analysis"
  },
  {
    value: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    description: "Higher-capacity structured analysis"
  },
  {
    value: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    description: "General-purpose analysis"
  }
] as const;

type GroqModel = (typeof groqModels)[number]["value"];

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" && !data.error.startsWith("[")
        ? data.error
        : "The request could not be completed."
    );
  }

  return data;
}

async function getScans() {
  const response = await fetch("/api/repositories", { cache: "no-store" });
  return readJson<{ scans: ScanSummary[] }>(response);
}

async function startImport(input: { repositoryUrl: string; branch?: string }) {
  const response = await fetch("/api/repositories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  return readJson<{ scan: Pick<ScanSummary, "id" | "status" | "currentStage" | "progress"> }>(
    response
  );
}

async function validateGroqConfiguration({ apiKey, model }: { apiKey: string; model: GroqModel }) {
  const response = await fetch("/api/ai/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "groq", model, apiKey })
  });
  return readJson<{ valid: true }>(response);
}

function statusLabel(status: ScanSummary["status"]) {
  return status === "completed" ? "Clone complete" : status;
}

export function RepositoryImportPanel() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [formError, setFormError] = useState<string>();
  const [isProviderDialogOpen, setProviderDialogOpen] = useState(false);
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState<GroqModel>("openai/gpt-oss-20b");
  const [apiKey, setApiKey] = useState("");
  const [providerError, setProviderError] = useState<string>();
  const [isValidatingProvider, setValidatingProvider] = useState(false);
  const [hasServerApiKey, setHasServerApiKey] = useState(false);

  useEffect(() => {
    fetch("/api/ai/config")
      .then((res) => res.json())
      .then((data) => setHasServerApiKey(!!data.hasApiKey))
      .catch((err) => console.error("Failed to fetch AI configuration", err));
  }, []);

  const scansQuery = useQuery({
    queryKey: ["repository-scans"],
    queryFn: getScans,
    enabled: sessionStatus === "authenticated",
    refetchInterval: (query) =>
      query.state.data?.scans.some((scan) => scan.status === "queued" || scan.status === "running")
        ? 2_000
        : false
  });

  const importMutation = useMutation({
    mutationFn: startImport,
    onSuccess: async (result) => {
      setRepositoryUrl("");
      setBranch("");
      setApiKey("");
      setFormError(undefined);
      await queryClient.invalidateQueries({ queryKey: ["repository-scans"] });
      router.push(`/scans/${result.scan.id}`);
    },
    onError: (error: Error) => setFormError(error.message)
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setProviderError(undefined);

    if (hasServerApiKey) {
      importMutation.mutate({ repositoryUrl, ...(branch ? { branch } : {}) });
    } else {
      setProviderDialogOpen(true);
    }
  }

  async function handleProviderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProviderError(undefined);
    if (!apiKey.trim()) {
      setProviderError("Paste a Groq API key to continue.");
      return;
    }

    setValidatingProvider(true);
    try {
      await validateGroqConfiguration({ apiKey: apiKey.trim(), model });
      setProviderDialogOpen(false);
      importMutation.mutate({ repositoryUrl, ...(branch ? { branch } : {}) });
    } catch (error) {
      setProviderError(
        error instanceof Error ? error.message : "Unable to validate the selected Groq model."
      );
    } finally {
      setValidatingProvider(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Import a GitHub repository</CardTitle>
          <CardDescription>
            CodeMRI validates the repository, records a scan, and queues an isolated shallow clone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionStatus === "unauthenticated" ? (
            <p className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
              Sign in with GitHub before importing a repository.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-medium" htmlFor="repository-url">
                GitHub repository URL
                <Input
                  id="repository-url"
                  name="repositoryUrl"
                  placeholder="https://github.com/vercel/next.js"
                  type="url"
                  value={repositoryUrl}
                  onChange={(event) => setRepositoryUrl(event.target.value)}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium" htmlFor="branch">
                Branch <span className="text-muted-foreground font-normal">(optional)</span>
                <Input
                  id="branch"
                  name="branch"
                  placeholder="Uses the repository default"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                />
              </label>
              {formError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
              ) : null}
              <Button
                className="w-full"
                disabled={importMutation.isPending || sessionStatus !== "authenticated"}
                type="submit"
              >
                {importMutation.isPending ? "Queueing clone…" : "Choose AI provider"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import progress</CardTitle>
          <CardDescription>
            Progress is stored in PostgreSQL and remains available after refresh.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scansQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading imports…</p>
          ) : null}
          {scansQuery.isError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{scansQuery.error.message}</p>
          ) : null}
          {scansQuery.data?.scans.length === 0 ? (
            <p className="text-muted-foreground text-sm">No repository imports yet.</p>
          ) : null}
          {scansQuery.data?.scans.map((scan) => (
            <article className="border-border space-y-2 rounded-lg border p-4" key={scan.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    className="font-medium hover:text-teal-200 hover:underline"
                    href={`/scans/${scan.id}`}
                  >
                    {scan.repositoryName}
                  </Link>
                  <p className="text-muted-foreground text-sm">{scan.branch}</p>
                </div>
                <span className="bg-muted rounded-full px-2 py-1 text-xs font-medium capitalize">
                  {statusLabel(scan.status)}
                </span>
              </div>
              <div
                aria-label={`${scan.progress}% complete`}
                className="bg-muted h-2 overflow-hidden rounded-full"
                role="progressbar"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={scan.progress}
              >
                <div
                  className="bg-primary h-full transition-[width]"
                  style={{ width: `${scan.progress}%` }}
                />
              </div>
              <p className="text-muted-foreground text-sm">
                {scan.status === "completed"
                  ? "Metrics are ready. Open the repository report."
                  : `${scan.currentStage} · ${scan.progress}%`}
              </p>
              {scan.errorMessage ? (
                <p className="text-sm text-red-600 dark:text-red-400">{scan.errorMessage}</p>
              ) : null}
            </article>
          ))}
        </CardContent>
      </Card>

      {isProviderDialogOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-labelledby="provider-dialog-title"
        >
          <form
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8"
            onSubmit={handleProviderSubmit}
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-200">
                  Bring your own key
                </p>
                <h2 id="provider-dialog-title" className="mt-2 text-2xl font-semibold text-white">
                  Configure AI analysis
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Select the provider and model that will power this repository&apos;s AI analysis.
                </p>
              </div>
              <button
                aria-label="Close provider selection"
                className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                onClick={() => setProviderDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-7 space-y-5">
              <label
                className="grid gap-2 text-sm font-medium text-slate-200"
                htmlFor="llm-provider"
              >
                Model provider
                <select
                  id="llm-provider"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                >
                  <option value="groq">Groq</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-200" htmlFor="llm-model">
                LLM model
                <select
                  id="llm-model"
                  value={model}
                  onChange={(event) => setModel(event.target.value as GroqModel)}
                  className="h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                >
                  {groqModels.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.description}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="grid gap-2 text-sm font-medium text-slate-200"
                htmlFor="groq-api-key"
              >
                Groq API key
                <Input
                  id="groq-api-key"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="gsk_…"
                  type="password"
                  autoComplete="off"
                  className="border-white/10 bg-slate-950 text-white placeholder:text-slate-600 focus-visible:ring-teal-300"
                />
              </label>
              <p className="rounded-xl border border-teal-300/15 bg-teal-300/10 p-3 text-xs leading-5 text-teal-100">
                Your key is used only to validate this model and is never saved in CodeMRI. You will
                provide it again when you run an AI analysis, so all model usage is billed to your
                Groq account.
              </p>
              {providerError ? <p className="text-sm text-rose-300">{providerError}</p> : null}
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => setProviderDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isValidatingProvider || importMutation.isPending || provider !== "groq"}
                className="bg-teal-300 font-semibold text-slate-950 hover:bg-teal-200"
              >
                {isValidatingProvider ? "Validating key…" : "Validate and import"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

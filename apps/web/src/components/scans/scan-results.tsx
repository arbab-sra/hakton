"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Scan {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  currentStage: string;
  progress: number;
  errorMessage: string | null;
  repositoryName: string;
  branch: string;
  events: Array<{ id: string; message: string; progress: number; createdAt: string }>;
}

interface Metric {
  metric: string;
  score: number;
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
  evidence: Array<{ code: string; message: string; filePath?: string }>;
  confidence: number;
  recommendedActions: string[];
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Unable to load this scan.");
  }
  return body;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toneForScore(score: number) {
  if (score < 40) return "#fb7185"; // rose-400
  if (score < 60) return "#fb923c"; // orange-400
  if (score < 80) return "#fbbf24"; // amber-400
  return "#2dd4bf"; // teal-400
}

function severityClass(severity: Metric["severity"]) {
  return {
    low: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
    medium: "border-amber-500/20 bg-amber-500/5 text-amber-300",
    high: "border-orange-500/20 bg-orange-500/5 text-orange-300",
    critical: "border-rose-500/20 bg-rose-500/5 text-rose-300"
  }[severity];
}

function getMetricIcon(metricKey: string) {
  const css = "size-5 shrink-0";
  switch (metricKey) {
    case "overall_health":
      return (
        <svg
          className={`${css} text-teal-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "maintainability":
      return (
        <svg
          className={`${css} text-emerald-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
      );
    case "architecture_integrity":
    case "architecture":
      return (
        <svg
          className={`${css} text-sky-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "technical_debt":
      return (
        <svg
          className={`${css} text-amber-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case "performance_risk":
      return (
        <svg
          className={`${css} text-cyan-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case "security_exposure":
      return (
        <svg
          className={`${css} text-rose-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "code_complexity":
      return (
        <svg
          className={`${css} text-indigo-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 17L10 11L4 5" />
          <path d="M12 19H20" />
        </svg>
      );
    case "test_confidence":
      return (
        <svg
          className={`${css} text-violet-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="m9 15 2 2 4-4" />
        </svg>
      );
    case "dependency_health":
      return (
        <svg
          className={`${css} text-fuchsia-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
      );
    case "production_readiness":
      return (
        <svg
          className={`${css} text-teal-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 16.5c-1.5 1.25-2.5 3-2.5 5h20c0-2-1-3.75-2.5-5M12 2C7.5 2 4 5.5 4 10c0 4.5 3.5 8 8 8s8-3.5 8-8c0-4.5-3.5-8-8-8z" />
        </svg>
      );
    default:
      return (
        <svg
          className={`${css} text-slate-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

function ScoreRing({
  score,
  animate,
  size = "large"
}: {
  score: number;
  animate: boolean;
  size?: "large" | "small";
}) {
  const radius = size === "large" ? 48 : 30;
  const ring = 2 * Math.PI * radius;
  const renderedScore = animate ? score : 0;
  const tone = toneForScore(score);

  const gradId = `scan-ring-${size}-${score}`;

  return (
    <div
      className={
        size === "large"
          ? "relative flex h-36 w-36 shrink-0 items-center justify-center"
          : "relative flex h-20 w-20 shrink-0 items-center justify-center"
      }
    >
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tone} />
            <stop offset="100%" stopColor={score >= 80 ? "#3b82f6" : `${tone}80`} />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={size === "large" ? "8" : "6"}
          className="text-slate-800/80"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={size === "large" ? "8" : "6"}
          strokeLinecap="round"
          strokeDasharray={ring}
          strokeDashoffset={ring - (ring * renderedScore) / 100}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: size === "large" ? `drop-shadow(0 0 6px ${tone}40)` : "none"
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div>
          <p
            className={
              size === "small"
                ? "text-2xl font-bold tracking-tight text-white"
                : "text-4xl font-extrabold leading-none tracking-tight text-white"
            }
          >
            {score}
          </p>
          {size === "large" && (
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Health
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricBar({ metric, animate }: { metric: Metric; animate: boolean }) {
  const tone = toneForScore(metric.score);
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="font-medium text-slate-300">{titleCase(metric.metric)}</span>
        <span className="font-bold tabular-nums text-slate-100">{metric.score}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full border border-white/5 bg-slate-800/80">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${animate ? metric.score : 0}%`,
            backgroundColor: tone,
            boxShadow: `0 0 8px ${tone}60`
          }}
        />
      </div>
    </div>
  );
}

function SummaryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-slate-950/40 p-5 transition duration-300 hover:border-white/10 hover:bg-slate-950/60">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-3xl font-extrabold tabular-nums text-transparent">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-400">{detail}</p>
    </div>
  );
}

export function ScanResults({ scanId }: { scanId: string }) {
  const [animate, setAnimate] = useState(false);
  const scanQuery = useQuery({
    queryKey: ["scan", scanId],
    queryFn: async () => readJson<{ scan: Scan }>(await fetch(`/api/scans/${scanId}`)),
    refetchInterval: (query) =>
      query.state.data?.scan.status === "queued" || query.state.data?.scan.status === "running"
        ? 1_500
        : false
  });
  const metricsQuery = useQuery({
    queryKey: ["scan-metrics", scanId],
    queryFn: async () =>
      readJson<{ metrics: Metric[] }>(await fetch(`/api/scans/${scanId}/metrics`)),
    enabled: scanQuery.data?.scan.status === "completed"
  });
  const scan = scanQuery.data?.scan;
  const metrics = metricsQuery.data?.metrics ?? [];
  const overview = metrics.find((metric) => metric.metric === "overall_health");
  const dimensions = metrics.filter((metric) => metric.metric !== "overall_health");
  const sortedByRisk = useMemo(
    () => [...dimensions].sort((left, right) => left.score - right.score),
    [dimensions]
  );
  const lowestMetric = sortedByRisk[0];
  const averageConfidence = dimensions.length
    ? Math.round(
        dimensions.reduce((total, metric) => total + metric.confidence, 0) / dimensions.length
      )
    : 0;
  const evidenceCount = dimensions.reduce((total, metric) => total + metric.evidence.length, 0);

  useEffect(() => {
    if (metrics.length > 0) {
      const timer = window.setTimeout(() => setAnimate(true), 80);
      return () => window.clearTimeout(timer);
    }
  }, [metrics.length, scanId]);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#050816] px-5 py-8 text-slate-100 selection:bg-teal-500/30 selection:text-teal-200 sm:px-8 sm:py-12"
      style={{ "--border": "rgba(255, 255, 255, 0.15)" } as React.CSSProperties}
    >
      {/* Background Decor System */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-[-5%] top-[-10%] h-[600px] w-[600px] rounded-full bg-teal-500/5 blur-[120px]" />
        <div className="absolute right-[-10%] top-[35%] h-[700px] w-[700px] rounded-full bg-blue-500/5 blur-[140px]" />
        <div className="absolute bottom-[5%] left-[10%] h-[600px] w-[600px] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] opacity-10 [background-size:32px_32px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <Link
          className="inline-flex items-center gap-2 rounded-lg border border-teal-500/20 bg-teal-500/5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-teal-300 backdrop-blur transition-all hover:text-white"
          href="/dashboard"
        >
          <svg
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Import another repository
        </Link>

        {scanQuery.isLoading ? (
          <div className="mt-12 flex items-center gap-3 font-medium text-slate-400">
            <svg
              className="size-5 animate-spin text-teal-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading scan results…
          </div>
        ) : null}

        {scanQuery.isError ? (
          <div className="mt-12 flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm font-medium text-rose-300">
            <svg
              className="size-5 shrink-0 text-rose-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {scanQuery.error.message}
          </div>
        ) : null}

        {scan ? (
          <>
            <header className="mt-10 flex flex-wrap items-center justify-between gap-6 border-b border-white/5 pb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-300">
                  Repository intelligence
                </p>
                <h1 className="mt-2 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-4xl font-extrabold leading-none tracking-tight text-transparent sm:text-5xl">
                  {scan.repositoryName}
                </h1>
                <p className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                  <span className="font-mono text-teal-400">{scan.branch}</span>
                  <span className="text-slate-600">•</span>
                  <span>{titleCase(scan.currentStage)}</span>
                  <span className="text-slate-600">•</span>
                  <span>Static AST Analysis</span>
                </p>
              </div>

              {/* Status Badge styling */}
              {(() => {
                const statusColors = {
                  completed: "border-teal-500/30 bg-teal-500/10 text-teal-300 shadow-teal-500/5",
                  running: "border-blue-500/30 bg-blue-500/10 text-blue-300 shadow-blue-500/5",
                  queued: "border-amber-500/30 bg-amber-500/10 text-amber-300 shadow-amber-500/5",
                  failed: "border-rose-500/30 bg-rose-500/10 text-rose-300 shadow-rose-500/5",
                  cancelled: "border-slate-500/30 bg-slate-500/10 text-slate-300 shadow-slate-500/5"
                }[scan.status];

                const pulseColor = {
                  completed: "bg-teal-400",
                  running: "bg-blue-400",
                  queued: "bg-amber-400",
                  failed: "bg-rose-400",
                  cancelled: "bg-slate-400"
                }[scan.status];

                return (
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${statusColors} shadow-sm backdrop-blur`}
                  >
                    <span className="relative flex h-2 w-2">
                      {scan.status === "running" && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                      )}
                      <span
                        className={`relative inline-flex h-2 w-2 rounded-full ${pulseColor}`}
                      ></span>
                    </span>
                    {scan.status}
                  </span>
                );
              })()}
            </header>

            {/* Analysis in Progress Card / Terminal stream */}
            {scan.status !== "completed" && (
              <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-xl">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                    {scan.status === "running" && (
                      <svg
                        className="size-4 animate-spin text-teal-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    )}
                    {scan.status === "failed"
                      ? "Analysis failed"
                      : scan.status === "queued"
                        ? "Analysis queued"
                        : "Analysis in progress"}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-400">
                    {scan.events[0]?.message ?? "Preparing repository analysis."}
                  </p>
                </div>

                <div className="mt-6 space-y-2">
                  <div className="relative h-2 overflow-hidden rounded-full border border-white/5 bg-slate-950">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(45,212,191,0.5)] transition-all duration-700"
                      style={{ width: `${scan.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <span>Analyzer Progress</span>
                    <span className="font-bold text-teal-400">{scan.progress}% complete</span>
                  </div>
                </div>

                {scan.errorMessage ? (
                  <div className="mt-6 whitespace-pre-wrap rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 font-mono text-xs leading-relaxed text-rose-300">
                    Error trace: {scan.errorMessage}
                  </div>
                ) : null}

                {/* Monospace Output Stream */}
                <div className="mt-6 rounded-2xl border border-white/5 bg-black/60 p-5 shadow-inner">
                  <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="size-2 animate-pulse rounded-full bg-teal-400" />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Analysis Output stream
                      </span>
                    </div>
                    <span className="font-mono text-[9px] font-semibold uppercase text-slate-500">
                      Stage: {scan.currentStage}
                    </span>
                  </div>
                  <div className="scrollbar-thin max-h-[300px] space-y-2.5 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-400">
                    {scan.events.length === 0 ? (
                      <p className="italic text-slate-600">
                        Initializing workers... queue connected.
                      </p>
                    ) : (
                      [...scan.events].reverse().map((event) => {
                        const timeString = new Date(event.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit"
                        });
                        return (
                          <div
                            key={event.id}
                            className="flex items-start gap-3 rounded px-1.5 py-0.5 transition hover:bg-white/[0.02]"
                          >
                            <span className="shrink-0 select-none text-slate-600">
                              [{timeString}]
                            </span>
                            <span className="shrink-0 font-bold text-teal-400">❯</span>
                            <p className="flex-1 whitespace-pre-wrap text-slate-300">
                              {event.message}
                            </p>
                            <span className="shrink-0 font-semibold tabular-nums text-slate-500">
                              {event.progress}%
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {scan.status === "completed" ? (
              <section className="mt-10 space-y-6">
                {metricsQuery.isLoading ? (
                  <p className="font-medium text-slate-400">
                    Extracting static metrics scoreboard…
                  </p>
                ) : null}

                {metricsQuery.isError ? (
                  <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm font-medium text-rose-300">
                    <svg
                      className="size-5 shrink-0 text-rose-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {metricsQuery.error.message}
                  </div>
                ) : null}

                {overview ? (
                  <div className="grid gap-6 xl:grid-cols-[1.1fr_1.45fr]">
                    {/* Overall Health Card */}
                    <div className="group relative overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 via-slate-900/90 to-slate-950 p-6 shadow-2xl backdrop-blur-md">
                      <div className="pointer-events-none absolute -inset-px -z-10 bg-gradient-to-r from-teal-500/10 to-blue-500/10 opacity-0 blur-xl transition duration-700 group-hover:opacity-100" />

                      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                        <ScoreRing animate={animate} score={overview.score} />
                        <div className="max-w-sm space-y-2">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">
                            Overall health
                          </p>
                          <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-white">
                            {overview.severity === "low"
                              ? "Stable repository foundation"
                              : "Priority attention recommended"}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-400">
                            {overview.explanation}
                          </p>
                          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-xs font-semibold text-rose-300">
                            <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-rose-400" />
                            Focus first:{" "}
                            <span className="ml-1 font-bold text-white">
                              {lowestMetric ? titleCase(lowestMetric.metric) : "loading metrics"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Health Distribution (Score breakdown) */}
                    <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-xl">
                      <div className="mb-5 border-b border-white/5 pb-3">
                        <h3 className="text-lg font-bold text-white">Scoreboard Distribution</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          Reflects static AST coupling, complexity indicators, and confidence
                          thresholds.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {sortedByRisk.map((metric) => (
                          <MetricBar animate={animate} key={metric.metric} metric={metric} />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Scoreboard Bento summary */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <SummaryStat
                    label="Dimensions Analyzed"
                    value={`${dimensions.length}/9`}
                    detail="system checkpoints evaluated"
                  />
                  <SummaryStat
                    label="Analysis Confidence"
                    value={`${averageConfidence}%`}
                    detail="grounded in repository evidence"
                  />
                  <SummaryStat
                    label="Telemetry Signals"
                    value={evidenceCount.toString()}
                    detail="violations and code indicators mapped"
                  />
                </div>

                {/* Metric Matrix Header */}
                <div className="mt-10 flex flex-wrap items-end justify-between gap-4 border-t border-white/5 pt-6">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                      Metric Matrix Detail
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Granular breakdown across all engineering dimensions.
                    </p>
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    Bars animate relative to the evidence confidence.
                  </p>
                </div>

                {/* Metric Grid Cards */}
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {dimensions.map((metric, index) => (
                    <div
                      key={metric.metric}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-slate-900/30 p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/25 hover:bg-slate-900/60 hover:shadow-teal-500/5"
                    >
                      {/* Floating large index watermark */}
                      <span className="absolute right-6 top-4 select-none bg-gradient-to-br from-teal-500/5 to-blue-500/5 bg-clip-text text-6xl font-black text-transparent transition-colors group-hover:from-teal-500/10 group-hover:to-blue-500/10">
                        0{index + 1}
                      </span>

                      <div>
                        {/* Title & Severity */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-2">
                            {getMetricIcon(metric.metric)}
                            <h3 className="text-base font-bold leading-none tracking-tight text-white">
                              {titleCase(metric.metric)}
                            </h3>
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityClass(metric.severity)}`}
                          >
                            {metric.severity}
                          </span>
                        </div>

                        {/* Ring & Description */}
                        <div className="mt-6 flex items-center gap-4">
                          <ScoreRing animate={animate} score={metric.score} size="small" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <p className="text-xs font-medium leading-relaxed text-slate-400">
                              {metric.explanation}
                            </p>
                            <div className="space-y-1">
                              <div className="relative h-1.5 overflow-hidden rounded-full border border-white/5 bg-slate-950">
                                <div
                                  className="h-full rounded-full transition-all duration-1000 ease-out"
                                  style={{
                                    width: `${animate ? metric.confidence : 0}%`,
                                    backgroundColor: toneForScore(metric.score)
                                  }}
                                />
                              </div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Confidence: {metric.confidence}%
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Evidence block */}
                        {metric.evidence[0] ? (
                          <div className="mt-6 space-y-2 rounded-xl border border-white/5 bg-slate-950/40 p-4 font-sans text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                Evidence Signal
                              </span>
                              {metric.evidence[0].filePath && (
                                <span
                                  className="max-w-[150px] truncate font-mono text-teal-400"
                                  title={metric.evidence[0].filePath}
                                >
                                  {metric.evidence[0].filePath.split("/").pop()}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
                              {metric.evidence[0].message}
                            </p>
                            {metric.evidence[0].code && (
                              <pre className="scrollbar-thin mt-3 overflow-x-auto whitespace-pre rounded-lg border border-white/5 bg-slate-950/80 p-3 font-mono text-[10px] leading-relaxed text-teal-300/80">
                                <code>{metric.evidence[0].code}</code>
                              </pre>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {/* Recommended Actions list */}
                      {metric.recommendedActions.length > 0 && (
                        <div className="mt-5 shrink-0 space-y-2 border-t border-white/5 pt-4">
                          {metric.recommendedActions.slice(0, 2).map((action, actionIdx) => (
                            <div
                              key={actionIdx}
                              className="flex items-start gap-2 rounded-xl border border-teal-500/10 bg-teal-500/5 p-3 text-[11px] text-teal-200"
                            >
                              <svg
                                className="mt-0.5 size-3.5 shrink-0 text-teal-400"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <div>
                                <span className="mb-0.5 block text-[8px] font-bold uppercase tracking-wider text-teal-400">
                                  Recommended Next Action
                                </span>
                                <p className="font-medium leading-relaxed text-slate-300">
                                  {action}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

import Link from "next/link";

import { auth } from "@codemri/auth";
import { Button } from "@codemri/ui/components";

const signals = [
  ["Maintainability", "Know where change becomes expensive."],
  ["Architecture", "See dependency pressure and coupling."],
  ["Delivery risk", "Prioritize the work that protects production."]
];

const steps = [
  ["01", "Connect", "Sign in with GitHub and select a repository."],
  ["02", "Map", "CodeMRI extracts structure, dependencies, routes, and data access."],
  ["03", "Decide", "Review grounded metrics, risks, and recommended next actions."]
];

export default async function HomePage() {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user?.email);
  const primaryHref = isAuthenticated ? "/dashboard" : "/sign-in";

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-slate-950 font-sans text-slate-100 selection:bg-teal-500/30 selection:text-teal-200"
      style={{ "--border": "rgba(255, 255, 255, 0.15)" } as React.CSSProperties}
    >
      {/* Background Decor System */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* Glow Blobs */}
        <div className="bg-teal-500/8 absolute left-[-5%] top-[-10%] h-[600px] w-[600px] rounded-full blur-[120px]" />
        <div className="bg-blue-500/8 absolute right-[-10%] top-[25%] h-[700px] w-[700px] rounded-full blur-[140px]" />
        <div className="bg-indigo-500/8 absolute bottom-[10%] left-[15%] h-[650px] w-[650px] rounded-full blur-[130px]" />

        {/* Linear Dotted Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] opacity-15 [background-size:32px_32px]" />

        {/* Subtle Horizontal Divider Glows */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />
      </div>

      {/* Floating Glassmorphic Header */}
      <header className="pointer-events-none sticky top-4 z-50 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="pointer-events-auto flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-6 py-3 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300">
          <Link
            href="/"
            className="group flex items-center gap-3 text-base font-semibold tracking-tight transition-colors hover:text-teal-200"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-teal-300 to-emerald-400 text-lg font-black text-slate-950 shadow-md shadow-teal-500/20 transition-transform group-hover:scale-105">
              M
            </span>
            <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent transition-all group-hover:from-teal-200 group-hover:to-white">
              CodeMRI
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              className="rounded-xl text-slate-300 transition-all hover:bg-white/5 hover:text-white"
            >
              <Link href={primaryHref}>{isAuthenticated ? "Dashboard" : "Sign in"}</Link>
            </Button>
            <Button
              asChild
              className="relative overflow-hidden rounded-xl bg-teal-300 font-semibold text-slate-950 shadow-lg shadow-teal-400/10 transition-all hover:-translate-y-0.5 hover:bg-teal-200 hover:shadow-teal-400/20"
            >
              <Link href={primaryHref}>
                {isAuthenticated ? "Open workspace" : "Start analyzing"}
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto grid max-w-7xl gap-16 px-6 pb-28 pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pt-28">
        <div className="flex max-w-3xl flex-col justify-center space-y-8">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-teal-500/20 bg-teal-500/5 px-4 py-1.5 text-sm font-medium text-teal-300 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500"></span>
            </span>
            Evidence-backed repository intelligence
          </div>

          <h1 className="text-wrap text-balance bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-5xl font-extrabold leading-[1.05] tracking-tight text-transparent sm:text-6xl lg:text-7xl">
            Turn any GitHub repository into an interactive engineering report
          </h1>

          <p className="max-w-2xl text-wrap text-lg leading-relaxed text-slate-400">
            CodeMRI maps your system&apos;s structural DNA. Visually inspect connection bottlenecks,
            track file fragility, and prioritize refactors where they actually protect production.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-13 rounded-xl bg-teal-300 px-8 font-semibold text-slate-950 shadow-lg shadow-teal-400/15 transition-all hover:-translate-y-0.5 hover:bg-teal-200 hover:shadow-teal-400/25"
            >
              <Link href={primaryHref} className="flex items-center gap-2">
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                {isAuthenticated ? "Analyze a GitHub repository" : "Analyze with GitHub"}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-13 rounded-xl border-white/10 bg-white/5 px-8 text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
            >
              <Link href="/dashboard" className="flex items-center gap-2">
                <svg
                  className="size-5 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
                View workspace
              </Link>
            </Button>
          </div>

          <p className="text-sm font-medium text-slate-500">
            {isAuthenticated
              ? "⚡ Connection active. Your repository workspace is ready to query."
              : "🛡️ Zero configuration setup. Sign in securely using OAuth."}
          </p>
        </div>

        {/* Interactive Engineering Report Mockup Card */}
        <div className="group relative mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all duration-500 hover:border-teal-500/20 hover:shadow-teal-500/5">
          {/* Card glow overlay */}
          <div className="pointer-events-none absolute -inset-px -z-10 rounded-3xl bg-gradient-to-r from-teal-500/10 to-blue-500/10 opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100" />

          {/* Card Header */}
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 shadow-inner">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-sm font-semibold tracking-tight text-slate-200">
                acme / payment-service
              </span>
            </div>
            <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-300 shadow-sm shadow-teal-500/5">
              Scan complete
            </span>
          </div>

          {/* Metric Grid */}
          <div className="mt-5 grid gap-5 sm:grid-cols-[1.1fr_1.4fr]">
            {/* Health Score Circular Gauge */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                System health
              </span>

              <div className="relative mt-4 flex size-32 items-center justify-center">
                <svg className="absolute inset-0 size-full -rotate-90">
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2dd4bf" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  {/* Background Track */}
                  <circle
                    cx="64"
                    cy="64"
                    r="48"
                    className="stroke-slate-800"
                    strokeWidth="7"
                    fill="transparent"
                  />
                  {/* Glowing Gauge Stroke */}
                  <circle
                    cx="64"
                    cy="64"
                    r="48"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="7"
                    fill="transparent"
                    strokeDasharray="301.6"
                    strokeDashoffset={301.6 * (1 - 82 / 100)}
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_8px_rgba(45,212,191,0.4)]"
                  />
                </svg>
                <div className="z-10 text-center">
                  <span className="text-4xl font-extrabold tracking-tight text-white">82</span>
                  <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-teal-400">
                    Score
                  </span>
                </div>
              </div>

              <p className="mt-4 text-center text-xs font-medium text-slate-400">
                Stable, with two focus areas.
              </p>
            </div>

            {/* Action Items List */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Priority actions
                </p>
                <span className="rounded-md border border-teal-500/10 bg-teal-400/5 px-2 py-0.5 text-[10px] font-medium text-teal-400">
                  code evidence
                </span>
              </div>
              <div className="mt-3 space-y-3">
                <div className="group/action rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 transition-all hover:bg-amber-500/10">
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="size-4 shrink-0 text-amber-400"
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
                    <p className="text-xs font-semibold text-amber-200">Reduce checkout coupling</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    8 modules share a tightly connected flow.
                  </p>
                </div>

                <div className="group/action rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 transition-all hover:bg-sky-500/10">
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="size-4 shrink-0 text-sky-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <p className="text-xs font-semibold text-sky-200">Add route-level tests</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    Critical API paths have limited test evidence.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Signals Grid (Bento cards) */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {signals.map(([name, description], index) => {
              // Custom inline SVGs for signals to enhance visualization
              const icons = [
                // Maintainability Icon (File outline)
                <svg
                  key="0"
                  className="size-4 shrink-0 text-emerald-400"
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
                </svg>,
                // Architecture Icon (Box)
                <svg
                  key="1"
                  className="size-4 shrink-0 text-sky-400"
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
                </svg>,
                // Delivery Risk Icon (Shield warning)
                <svg
                  key="2"
                  className="size-4 shrink-0 text-rose-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ];
              return (
                <div
                  key={name}
                  className="flex flex-col justify-between rounded-xl border border-white/5 bg-slate-950/40 p-4 font-sans transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-slate-950/60"
                >
                  <div className="flex items-center gap-2">
                    {icons[index]}
                    <p className="text-xs font-bold uppercase tracking-wide text-white">{name}</p>
                  </div>
                  <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">
                    {description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Steps Pipeline Section */}
      <section className="relative z-10 overflow-hidden border-y border-white/10 bg-slate-950/20 py-20 backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-400">
              Analysis sequence
            </p>
            <h2 className="mt-3 text-wrap text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Three Steps to Repository Blueprinting
            </h2>
          </div>

          <div className="relative grid gap-8 sm:grid-cols-3">
            {/* Timeline connector line on desktop */}
            <div className="absolute left-[10%] right-[10%] top-[5.2rem] -z-10 hidden h-px border-t border-dashed border-white/10 bg-gradient-to-r from-teal-500/0 via-teal-500/25 to-teal-500/0 lg:block" />

            {steps.map(([number, title, description], index) => {
              const stepIcons = [
                // Step 1: Connect / Lock & Key
                <svg
                  key="0"
                  className="size-6 text-teal-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>,
                // Step 2: AST Structure
                <svg
                  key="1"
                  className="size-6 text-teal-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="5" r="3" />
                  <circle cx="6" cy="19" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M12 8v8" />
                  <path d="M12 12H6" />
                  <path d="M12 12h6" />
                </svg>,
                // Step 3: Decisions
                <svg
                  key="2"
                  className="size-6 text-teal-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              ];

              return (
                <div
                  key={number}
                  className="group relative rounded-2xl border border-white/5 bg-slate-900/30 p-8 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/20 hover:bg-slate-900/50"
                >
                  {/* Huge translucent watermark number */}
                  <span className="absolute bottom-4 right-6 select-none bg-gradient-to-br from-teal-500/5 to-blue-500/5 bg-clip-text text-7xl font-black text-transparent transition-colors group-hover:from-teal-500/10 group-hover:to-blue-500/10">
                    {number}
                  </span>

                  <div className="flex size-12 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/10 shadow-inner transition-transform duration-300 group-hover:scale-110">
                    {stepIcons[index]}
                  </div>

                  <h3 className="mt-8 text-xl font-bold tracking-tight text-white">{title}</h3>
                  <p className="mt-3 text-wrap text-sm leading-relaxed text-slate-400">
                    {description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-24 sm:py-28 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950 px-8 py-16 shadow-2xl sm:px-16 sm:py-20">
          {/* Radial gradient background layout inside the CTA block */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute -top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-teal-500/10 blur-[100px]" />
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] opacity-10 [background-size:24px_24px]" />
          </div>

          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center space-y-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-400">
              Start with context
            </p>

            <h2 className="text-wrap text-balance text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
              Bring clarity to the code you already own.
            </h2>

            <p className="text-wrap text-base leading-relaxed text-slate-400">
              Connect CodeMRI to your codebase in seconds. Securely audit system complexity and
              extract actionable engineering wisdom immediately.
            </p>

            <div className="pt-4">
              <Button
                asChild
                size="lg"
                className="h-13 rounded-xl bg-teal-300 px-8 font-semibold text-slate-950 shadow-xl shadow-teal-400/10 transition-all hover:-translate-y-0.5 hover:bg-teal-200 hover:shadow-teal-400/25"
              >
                <Link href={primaryHref}>
                  {isAuthenticated ? "Open workspace" : "Connect GitHub"}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

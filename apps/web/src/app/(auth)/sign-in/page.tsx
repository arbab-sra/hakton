import Link from "next/link";

import { isGitHubConfigured } from "@codemri/auth";
import { Button } from "@codemri/ui/components";

import { signInWithGitHub } from "./actions";

export const dynamic = "force-dynamic";

const authErrors: Record<string, string> = {
  AccessDenied: "GitHub did not grant CodeMRI access. You can try again when ready.",
  Callback: "GitHub could not complete the sign-in callback. Check the callback URL configuration.",
  Configuration: "GitHub sign-in is not configured correctly yet."
};

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const githubIsConfigured = isGitHubConfigured();
  const errorMessage = error ? (authErrors[error] ?? "Unable to sign in with GitHub.") : undefined;

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-slate-950 px-6 py-10 text-slate-100 lg:grid-cols-2 lg:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_22%,rgba(45,212,191,0.16),transparent_28%),radial-gradient(circle_at_85%_75%,rgba(96,165,250,0.17),transparent_32%)]" />
      <section className="relative hidden flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.035] p-10 lg:flex">
        <Link
          href="/"
          className="flex w-fit items-center gap-3 text-base font-semibold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-teal-300 text-lg font-black text-slate-950">
            M
          </span>
          CodeMRI
        </Link>
        <div className="max-w-lg space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">
            Engineering clarity
          </p>
          <h1 className="text-balance text-5xl font-semibold tracking-[-0.045em]">
            See the shape of your codebase before you change it.
          </h1>
          <p className="max-w-md text-lg leading-8 text-slate-300">
            Connect a GitHub repository to turn code structure, dependencies, and risks into an
            evidence-backed engineering plan.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-2xl font-semibold text-white">10</p>
            <p className="mt-1">health signals</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-2xl font-semibold text-white">AST</p>
            <p className="mt-1">code context</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-2xl font-semibold text-white">AI</p>
            <p className="mt-1">cited guidance</p>
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center lg:p-10">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-7 shadow-2xl shadow-black/30 backdrop-blur sm:p-9">
          <Link
            href="/"
            className="mb-12 flex w-fit items-center gap-3 text-base font-semibold lg:hidden"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-teal-300 text-lg font-black text-slate-950">
              M
            </span>
            CodeMRI
          </Link>
          <div className="space-y-3">
            <p className="text-sm font-medium text-teal-200">Welcome to CodeMRI</p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Start with your GitHub account
            </h2>
            <p className="leading-6 text-slate-400">
              Sign in securely with GitHub. No additional password to manage.
            </p>
          </div>

          {errorMessage ? (
            <p className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm leading-6 text-rose-100">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-8 space-y-4">
            {githubIsConfigured ? (
              <form action={signInWithGitHub}>
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full bg-white font-semibold text-slate-950 hover:bg-slate-100"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.49.5.092.683-.217.683-.482 0-.237-.009-1.021-.013-1.853-2.782.604-3.369-1.18-3.369-1.18-.455-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.004.07 1.532 1.03 1.532 1.03.892 1.529 2.341 1.087 2.91.831.091-.646.349-1.087.635-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.092.39-1.984 1.029-2.684-.103-.253-.446-1.271.098-2.65 0 0 .84-.269 2.75 1.025A9.57 9.57 0 0 1 12 6.756a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.379.203 2.397.1 2.65.64.7 1.028 1.592 1.028 2.684 0 3.842-2.339 4.687-4.566 4.935.359.31.678.92.678 1.855 0 1.34-.012 2.421-.012 2.75 0 .268.18.579.688.481A10.002 10.002 0 0 0 22 12c0-5.523-4.477-10-10-10Z" />
                  </svg>
                  Continue with GitHub
                </Button>
              </form>
            ) : (
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                GitHub OAuth is not configured on this server. Add the GitHub client ID and secret,
                then restart the web server.
              </div>
            )}
            <p className="text-center text-xs leading-5 text-slate-500">
              By continuing, you allow CodeMRI to authenticate your GitHub identity.
            </p>
          </div>
          <Link
            href="/"
            className="mt-9 block text-center text-sm font-medium text-slate-400 transition hover:text-white"
          >
            ← Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}

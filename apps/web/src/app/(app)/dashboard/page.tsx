import { RepositoryImportPanel } from "@/components/repositories/repository-import-panel";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-200">
            Workspace
          </p>
          <h1 className="text-4xl font-semibold tracking-[-0.04em]">
            Bring a repository into focus.
          </h1>
          <p className="text-lg leading-7 text-slate-400">
            Import a GitHub repository to create a tracked scan. CodeMRI preserves its progress so
            you can return when the repository is ready for analysis.
          </p>
        </div>
        <RepositoryImportPanel />
      </div>
    </main>
  );
}

export default function ReportsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Reports
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Cross-dataset checks
          </h1>
          <p className="text-base text-zinc-600">
            Run missing-related-data and other relational reports, then export
            results to Excel.
          </p>
        </header>
        <section className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-sm text-zinc-500">
          Report builder UI coming next.
        </section>
      </main>
    </div>
  );
}

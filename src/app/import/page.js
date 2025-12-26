export default function ImportPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Import Runs
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Upload Excel files
          </h1>
          <p className="text-base text-zinc-600">
            This area will host the Excel upload flow, parsing summary, and
            error review experience.
          </p>
        </header>
        <section className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-sm text-zinc-500">
          Import workflow UI coming next.
        </section>
      </main>
    </div>
  );
}

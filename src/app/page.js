export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            XLSX → Postgres Pipeline
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Import Excel files and run custom SQL queries.
          </h1>
          <p className="max-w-2xl text-base text-zinc-600">
            A flexible tool to import Excel data into PostgreSQL tables and execute raw queries for analysis and export.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {[
            {
              title: "Import",
              description:
                "Upload Excel files directly into flexible table locations.",
              href: "/import",
            },
            {
              title: "Query",
              description:
                "Execute raw SQL queries against multiple tables and export results.",
              href: "/query",
            },
          ].map((card) => (
            <a
              key={card.title}
              href={card.href}
              className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="text-sm text-zinc-600">{card.description}</p>
              <span className="text-sm font-semibold text-zinc-900">
                Open {card.title}
              </span>
            </a>
          ))}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          <p>
            Use the <strong>Import</strong> tool to populate your database tables from Excel sheets. Use the <strong>Query</strong> tool to analyze that data and export reports.
          </p>
        </section>
      </main>
    </div>
  );
}

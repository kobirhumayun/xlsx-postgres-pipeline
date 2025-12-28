export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            XLSX → Postgres Pipeline
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Configure datasets, ingest Excel, and run relational reports.
          </h1>
          <p className="max-w-2xl text-base text-zinc-600">
            This single-developer tool captures raw Excel data, normalizes it
            into curated tables, and surfaces missing related data across
            datasets.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Datasets",
              description:
                "Define schema expectations, primary keys, and column mappings.",
              href: "/datasets",
            },
            {
              title: "Imports",
              description:
                "Upload Excel files, parse rows, and track import runs.",
              href: "/import",
            },
            {
              title: "Reports",
              description:
                "Run missing-related-data checks and export results to Excel.",
              href: "/reports",
            },
            {
              title: "Relationships",
              description:
                "Define how datasets join together for relational reports.",
              href: "/relationships",
            },
            {
              title: "Custom Queries",
              description:
                "Execute raw SQL queries and export results to Excel.",
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
            Start by defining your dataset registry. Each dataset stores its
            expected sheet name, primary keys, and mapping rules that drive
            parsing and reporting.
          </p>
        </section>
      </main>
    </div>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { TABLE_LABELS } from "@/lib/fields";

const LABEL_COLUMNS: Record<string, string[]> = {
  products: ["name_en", "name_ar"],
  materials: ["name_en", "name_ar"],
  machines: ["name_en", "name_ar"],
  processes: ["name_en", "name_ar"],
  suppliers: ["name_en", "name_ar"],
  cultural_references: ["topic_en", "topic_ar"],
  projects: ["title"],
};

const HIDDEN = new Set(["id", "created_at", "updated_at"]);

function display(v: unknown) {
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

async function Records({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; q?: string }>;
}) {
  await connection();
  const { t, q } = await searchParams;
  const table = t && TABLE_LABELS[t] ? t : "products";
  const query = (q ?? "").trim();

  const supabase = await createClient();
  const { data: role } = await supabase.rpc("user_role");

  let request = supabase.from(table).select("*").order("created_at", { ascending: false }).limit(200);
  if (query) {
    const safe = query.replace(/[%_,()\\]/g, " ").trim();
    if (safe) {
      request = request.or(LABEL_COLUMNS[table].map((c) => `${c}.ilike.%${safe}%`).join(","));
    }
  }
  const { data: rows } = await request;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Browse</h1>
        <AppNav role={role} />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(TABLE_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={`/browse?t=${key}`}
            className={
              "rounded-md border px-3 py-1 " +
              (key === table
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/20 dark:border-white/20")
            }
          >
            {label}
          </Link>
        ))}
      </div>

      <form className="flex gap-2">
        <input type="hidden" name="t" value={table} />
        <input
          name="q"
          defaultValue={query}
          placeholder="Filter by name"
          className="w-full rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        />
        <button className="rounded-md border border-black/20 px-3 py-2 text-sm dark:border-white/20">
          Filter
        </button>
      </form>

      {!rows?.length ? (
        <p className="text-sm opacity-70">
          Nothing here yet. Approved records show up on this page.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const rec = row as Record<string, unknown>;
            const title = LABEL_COLUMNS[table].map((c) => rec[c]).find(Boolean);
            return (
              <li
                key={String(rec.id)}
                className="space-y-2 rounded-xl border border-black/10 p-4 dark:border-white/15"
              >
                <p className="font-medium">{display(title ?? "(no name)")}</p>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                  {Object.entries(rec)
                    .filter(
                      ([k, v]) =>
                        !HIDDEN.has(k) &&
                        !LABEL_COLUMNS[table].includes(k) &&
                        !k.endsWith("_id") &&
                        v !== null &&
                        v !== "" &&
                        !(typeof v === "object" && Object.keys(v as object).length === 0),
                    )
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="opacity-70">{k}</dt>
                        <dd className="break-words">{display(v)}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; q?: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <Suspense fallback={<p>Loading...</p>}>
        <Records searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

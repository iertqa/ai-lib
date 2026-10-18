import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { FIELDS } from "@/lib/fields";
import { approveRecord, rejectRecord, updateRecord } from "../actions";

function display(v: unknown) {
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

async function Queue() {
  await connection();
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("user_role");
  const nav = <AppNav role={role} />;

  if (role !== "admin" && role !== "manager") {
    return (
      <>
        {nav}
        <p>Only managers and admins can review extracted records.</p>
      </>
    );
  }

  const { data: records } = await supabase
    .from("extracted_records")
    .select(
      "id, target_table, data, note, created_at, duplicate_kind, duplicate_name, duplicate_score, document_versions(documents(title))",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <>
      {nav}
      <h1 className="text-lg font-semibold">Review extracted records</h1>
      {!records?.length ? (
        <p className="text-sm opacity-70">Nothing waiting for review.</p>
      ) : (
        <ul className="space-y-4">
          {records.map((r) => {
            const title = (
              r.document_versions as unknown as { documents: { title: string } | null } | null
            )?.documents?.title;
            const data = r.data as Record<string, unknown>;
            return (
              <li
                key={r.id}
                className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
              >
                <div className="flex items-center justify-between text-xs opacity-70">
                  <span className="font-medium uppercase">{r.target_table}</span>
                  <span>from {title ?? "document"}</span>
                </div>
                {r.duplicate_kind && (
                  <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                    Possible duplicate of{" "}
                    {r.duplicate_kind === "existing"
                      ? "an existing record"
                      : "another record waiting for review"}
                    : &ldquo;{r.duplicate_name}&rdquo; (
                    {Math.round((r.duplicate_score ?? 0) * 100)}% match). Reject this
                    one if it is the same item.
                  </p>
                )}
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                  {Object.entries(data).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="opacity-70">{k}</dt>
                      <dd className="break-words">{display(v)}</dd>
                    </div>
                  ))}
                </dl>
                {r.note && <p className="text-xs opacity-70">Note: {r.note}</p>}

                <details className="text-sm">
                  <summary className="cursor-pointer underline">Edit</summary>
                  <form action={updateRecord} className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={r.id} />
                    {(FIELDS[r.target_table] ?? []).map((f) => (
                      <label key={f.key} className="block">
                        <span className="text-xs opacity-70">{f.label}</span>
                        {f.long ? (
                          <textarea
                            name={"f_" + f.key}
                            defaultValue={data[f.key] === undefined ? "" : display(data[f.key])}
                            rows={3}
                            className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/20"
                          />
                        ) : (
                          <input
                            name={"f_" + f.key}
                            defaultValue={data[f.key] === undefined ? "" : display(data[f.key])}
                            className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/20"
                          />
                        )}
                      </label>
                    ))}
                    <button className="rounded-md border border-black/20 px-3 py-1 dark:border-white/20">
                      Save changes
                    </button>
                  </form>
                </details>

                <div className="flex gap-2">
                  <form action={approveRecord}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-md bg-black px-3 py-1 text-sm text-white dark:bg-white dark:text-black">
                      Approve
                    </button>
                  </form>
                  <form action={rejectRecord}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-md border border-black/20 px-3 py-1 text-sm dark:border-white/20">
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function ReviewPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <Suspense fallback={<p>Loading...</p>}>
        <Queue />
      </Suspense>
    </main>
  );
}

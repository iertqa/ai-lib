import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { TABLE_LABELS } from "@/lib/fields";

type Answer = {
  answer?: string;
  sources?: { n: number; source: string; id: string; label: string }[];
  terms?: string[];
  error?: string;
};

async function Result({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await connection();
  const { q } = await searchParams;
  const question = (q ?? "").trim();

  const supabase = await createClient();
  const { data: role } = await supabase.rpc("user_role");

  let result: Answer | null = null;
  if (question) {
    const { data, error } = await supabase.functions.invoke("ask-library", {
      body: { question },
    });
    result = error ? { error: error.message } : (data as Answer);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Ask the library</h1>
        <AppNav role={role} />
      </div>

      <form className="space-y-2">
        <textarea
          name="q"
          defaultValue={question}
          rows={3}
          placeholder="Ask in English or Arabic, for example: which projects used glass?"
          className="w-full rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        />
        <button className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">
          Ask
        </button>
      </form>

      {result?.error && <p className="text-sm text-red-600">Something went wrong: {result.error}</p>}

      {result?.answer && (
        <section className="space-y-4 rounded-xl border border-black/10 p-4 dark:border-white/15">
          <p className="whitespace-pre-wrap">{result.answer}</p>
          {!!result.sources?.length && (
            <div className="text-sm">
              <p className="mb-1 opacity-70">Sources</p>
              <ul className="space-y-1">
                {result.sources.map((s) => (
                  <li key={s.n}>
                    [{s.n}] {s.label}{" "}
                    <span className="opacity-70">({TABLE_LABELS[s.source] ?? s.source})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <Suspense fallback={<p>Loading...</p>}>
        <Result searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

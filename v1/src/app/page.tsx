import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";
import { AppNav } from "@/components/AppNav";
import { extractDocument } from "./actions";
import { UploadForm } from "@/components/UploadForm";

const WRITERS = ["admin", "manager", "staff"];

async function Library() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .single();

  const role = profile?.role ?? "pending";

  const header = (
    <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/15">
      <h1 className="text-lg font-semibold">ERTQA Knowledge Library</h1>
      <AppNav role={role} />
      <form action={signOut} className="flex items-center gap-3 text-sm">
        <span>
          {profile?.full_name ?? user!.email} ({role})
        </span>
        <button className="rounded-md border border-black/20 px-3 py-1 dark:border-white/20">
          Sign out
        </button>
      </form>
    </header>
  );

  if (role === "pending") {
    return (
      <>
        {header}
        <main className="p-6">
          <p>Your account is waiting for approval. Ask an administrator to give you access.</p>
        </main>
      </>
    );
  }

  const { data: documents } = await supabase
    .from("documents")
    .select(
      "id, title, doc_type, access_level, created_at, ingest_status, ingest_error, document_versions(id, version, size_bytes)",
    )
    .order("created_at", { ascending: false });

  return (
    <>
      {header}
      <main className="mx-auto w-full max-w-4xl space-y-8 p-6">
        {WRITERS.includes(role) && <UploadForm />}

        <section>
          <h2 className="mb-3 font-medium">Documents</h2>
          {!documents?.length ? (
            <p className="text-sm opacity-70">No documents yet.</p>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/15">
              {documents.map((d) => {
                const latest = [...d.document_versions].sort(
                  (a, b) => b.version - a.version,
                )[0];
                return (
                  <li key={d.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs opacity-70">
                        {d.doc_type ?? "file"} · {d.access_level} ·{" "}
                        {new Date(d.created_at).toLocaleDateString("en-GB")} ·{" "}
                        extraction: {d.ingest_status.replace("_", " ")}
                      </p>
                      {d.ingest_status === "failed" && d.ingest_error && (
                        <p className="text-xs text-red-600">{d.ingest_error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {latest && WRITERS.includes(role) && (
                        <form action={extractDocument}>
                          <input type="hidden" name="version_id" value={latest.id} />
                          <button className="text-sm underline">Extract</button>
                        </form>
                      )}
                      {latest && (
                        <a href={`/files/${latest.id}`} className="text-sm underline">
                          Download
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<p className="p-6">Loading...</p>}>
      <Library />
    </Suspense>
  );
}

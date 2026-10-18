import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { changePassword } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/20";

async function Profile({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await connection();
  const { error, ok } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: role } = await supabase.rpc("user_role");

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Profile</h1>
        <AppNav role={role} />
      </div>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="opacity-70">Email</dt>
        <dd>{user?.email}</dd>
        <dt className="opacity-70">Role</dt>
        <dd>{role ?? "pending"}</dd>
      </dl>

      <form
        action={changePassword}
        className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
      >
        <h2 className="font-medium">Change password</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-green-600">{ok}</p>}
        <label className="block text-sm">
          Current password
          <input name="current" type="password" required autoComplete="current-password" className={inputClass} />
        </label>
        <label className="block text-sm">
          New password (at least 8 characters)
          <input name="next" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </label>
        <label className="block text-sm">
          Confirm new password
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </label>
        <button className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">
          Change password
        </button>
      </form>
    </>
  );
}

export default function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-md space-y-6 p-6">
      <Suspense fallback={<p>Loading...</p>}>
        <Profile searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

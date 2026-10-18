import { Suspense } from "react";
import { signIn } from "./actions";

async function LoginError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return error ? <p className="text-sm text-red-600">{error}</p> : null;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        action={signIn}
        className="w-full max-w-sm space-y-4 rounded-xl border border-black/10 p-6 shadow-sm dark:border-white/15"
      >
        <h1 className="text-xl font-semibold">ERTQA Knowledge Library</h1>
        <Suspense>
          <LoginError searchParams={searchParams} />
        </Suspense>
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/20"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/20"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-black px-3 py-2 text-white dark:bg-white dark:text-black"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}

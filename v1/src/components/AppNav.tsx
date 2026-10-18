import Link from "next/link";

export function AppNav({ role }: { role: string | null }) {
  const canReview = role === "admin" || role === "manager";
  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/" className="underline">
        Library
      </Link>
      <Link href="/browse" className="underline">
        Browse
      </Link>
      <Link href="/ask" className="underline">
        Ask
      </Link>
      {canReview && (
        <Link href="/review" className="underline">
          Review
        </Link>
      )}
      <Link href="/profile" className="underline">
        Profile
      </Link>
    </nav>
  );
}

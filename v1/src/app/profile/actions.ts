"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function back(kind: "error" | "ok", message: string): never {
  redirect(`/profile?${kind}=${encodeURIComponent(message)}`);
}

export async function changePassword(formData: FormData) {
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current || !next) back("error", "Fill in all the fields.");
  if (next.length < 8) back("error", "The new password must be at least 8 characters.");
  if (next !== confirm) back("error", "The new passwords do not match.");
  if (next === current) back("error", "The new password must be different from the current one.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (verifyError) back("error", "The current password is wrong.");

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) back("error", error.message);

  back("ok", "Password changed.");
}

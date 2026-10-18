import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  ctx: RouteContext<"/files/[versionId]">,
) {
  const { versionId } = await ctx.params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("document_versions")
    .select("storage_path")
    .eq("id", versionId)
    .single();
  if (!version) return new NextResponse("Not found", { status: 404 });

  const { data } = await supabase.storage
    .from("library-files")
    .createSignedUrl(version.storage_path, 60);
  if (!data) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}

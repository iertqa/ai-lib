"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FIELDS, REQUIRED_FIELD } from "@/lib/fields";

export async function updateRecord(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: record } = await supabase
    .from("extracted_records")
    .select("target_table, data")
    .eq("id", id)
    .eq("status", "pending")
    .single();
  if (!record) return;

  const fields = FIELDS[record.target_table];
  if (!fields) return;

  const data: Record<string, unknown> = { ...(record.data as Record<string, unknown>) };
  for (const f of fields) {
    const raw = formData.get("f_" + f.key);
    if (raw === null) continue;
    const text = String(raw).trim();
    if (!text) {
      delete data[f.key];
    } else if (f.json) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") data[f.key] = parsed;
      } catch {
        // keep the previous value when the JSON is invalid
      }
    } else {
      data[f.key] = text;
    }
  }

  if (!data[REQUIRED_FIELD[record.target_table]]) return;

  await supabase.from("extracted_records").update({ data }).eq("id", id).eq("status", "pending");
  revalidatePath("/review");
}

export async function extractDocument(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "");
  if (!versionId) return;

  const supabase = await createClient();
  await supabase.functions.invoke("ingest-document", {
    body: { document_version_id: versionId },
  });
  revalidatePath("/");
  revalidatePath("/review");
}

export async function approveRecord(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.rpc("approve_extracted_record", { record_id: id });
  revalidatePath("/review");
}

export async function rejectRecord(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from("extracted_records")
    .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  revalidatePath("/review");
}

export type UploadResult =
  | { ok: true; versionId: string; title: string }
  | { ok: false; error: string };

export async function extractVersion(
  versionId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!versionId) return { ok: false, error: "Missing file" };
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("ingest-document", {
    body: { document_version_id: versionId },
  });
  if (error) return { ok: false, error: "Extraction failed" };
  revalidatePath("/");
  revalidatePath("/review");
  return { ok: true, count: (data as { count?: number })?.count ?? 0 };
}

const STORAGE_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]{1,10})?$/;
const PREVIEW_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-preview\.jpg$/;

export async function registerDocument(input: {
  storagePath: string;
  previewPath?: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  accessLevel: string;
  title?: string;
}): Promise<UploadResult> {
  if (!STORAGE_PATH.test(input.storagePath)) return { ok: false, error: "Invalid file path" };
  if (input.previewPath && !PREVIEW_PATH.test(input.previewPath)) {
    return { ok: false, error: "Invalid preview path" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const ext = input.storagePath.includes(".") ? input.storagePath.split(".").pop()! : "";
  const accessLevel = input.accessLevel === "general" ? "general" : "restricted";
  const title = (input.title ?? "").trim() || input.originalName;

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      title,
      doc_type: ext || null,
      access_level: accessLevel,
      metadata: { original_name: input.originalName },
      created_by: user.id,
    })
    .select("id")
    .single();

  if (docError || !doc) return { ok: false, error: "Could not save the document record" };

  const { data: version, error: versionError } = await supabase
    .from("document_versions")
    .insert({
      document_id: doc.id,
      version: 1,
      storage_path: input.storagePath,
      preview_path: input.previewPath ?? null,
      mime_type: input.mimeType || null,
      size_bytes: input.sizeBytes,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (versionError || !version) {
    await supabase.from("documents").delete().eq("id", doc.id);
    return { ok: false, error: "Could not save the file version" };
  }

  revalidatePath("/");
  return { ok: true, versionId: version.id, title };
}

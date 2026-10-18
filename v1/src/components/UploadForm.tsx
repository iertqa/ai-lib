"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerDocument, extractVersion } from "@/app/actions";

type Item = { name: string; status: string; message?: string };

const MAX_BYTES = 100 * 1024 * 1024;
const PREVIEW_ABOVE = 4.5 * 1024 * 1024;
const MAX_SIDE = 2400;
const CONCURRENCY = 2;
const BUCKET = "library-files";
const READABLE_IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function toJpegName(name: string) {
  return name.replace(/\.[^.]+$/, "") + ".jpg";
}

function isHeic(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

async function drawToJpeg(source: Blob, maxSide: number | null): Promise<Blob | null> {
  const bitmap = await createImageBitmap(source);
  const scale = maxSide ? Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height)) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
}

// Photos Claude and browsers cannot read directly (iPhone HEIC, TIFF, BMP...) become JPEG.
async function normalizeImage(file: File): Promise<File> {
  if (isHeic(file)) {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const blob = Array.isArray(out) ? out[0] : out;
    return new File([blob], toJpegName(file.name), { type: "image/jpeg" });
  }
  if (file.type.startsWith("image/") && !READABLE_IMAGES.includes(file.type)) {
    const blob = await drawToJpeg(file, null);
    if (!blob) throw new Error("convert");
    return new File([blob], toJpegName(file.name), { type: "image/jpeg" });
  }
  return file;
}

async function makePreview(file: File): Promise<Blob | null> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size <= PREVIEW_ABOVE) {
    return null;
  }
  try {
    return await drawToJpeg(file, MAX_SIDE);
  } catch {
    return null;
  }
}

export function UploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const files = Array.from(form.querySelector<HTMLInputElement>('input[type="file"]')?.files ?? []);
    if (!files.length) return;

    const accessLevel = String(data.get("access_level") ?? "restricted");
    const autoExtract = data.get("auto_extract") === "on";
    const singleTitle = String(data.get("title") ?? "").trim();

    setBusy(true);
    setItems(files.map((f) => ({ name: f.name, status: "waiting" })));

    const supabase = createClient();
    let next = 0;

    async function worker() {
      while (next < files.length) {
        const i = next++;
        const original = files[i];
        const uploaded: string[] = [];

        const discard = async () => {
          if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
        };

        try {
          if (original.size > MAX_BYTES) {
            setItem(i, { status: "failed", message: "Over 100 MB" });
            continue;
          }

          let file = original;
          if (original.type.startsWith("image/") || isHeic(original)) {
            setItem(i, { status: "converting" });
            try {
              file = await normalizeImage(original);
            } catch {
              setItem(i, { status: "failed", message: "Could not convert this photo to JPEG" });
              continue;
            }
          }

          setItem(i, { status: "uploading" });
          const id = crypto.randomUUID();
          const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
          const storagePath = ext && file.name.includes(".") ? `${id}.${ext}` : id;

          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, file, { contentType: file.type || undefined });
          if (upErr) {
            setItem(i, { status: "failed", message: "Could not store the file" });
            continue;
          }
          uploaded.push(storagePath);

          let previewPath: string | null = null;
          const preview = await makePreview(file);
          if (preview) {
            const p = `${id}-preview.jpg`;
            const { error: pErr } = await supabase.storage
              .from(BUCKET)
              .upload(p, preview, { contentType: "image/jpeg" });
            if (!pErr) {
              previewPath = p;
              uploaded.push(p);
            }
          }

          const reg = await registerDocument({
            storagePath,
            previewPath,
            originalName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            accessLevel,
            title: files.length === 1 ? singleTitle : "",
          });
          if (!reg.ok) {
            await discard();
            setItem(i, { status: "failed", message: reg.error + " (upload removed)" });
            continue;
          }

          if (!autoExtract) {
            setItem(i, { status: "done", message: "Uploaded" });
            continue;
          }
          setItem(i, { status: "extracting" });
          const ex = await extractVersion(reg.versionId);
          setItem(
            i,
            ex.ok
              ? { status: "done", message: `Uploaded, ${ex.count} record(s) to review` }
              : { status: "failed", message: "Uploaded, but extraction failed. Use Extract to retry." },
          );
        } catch {
          await discard();
          setItem(i, { status: "failed", message: "Unexpected error (upload removed)" });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

    setBusy(false);
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="font-medium">Upload documents</h2>
      <input
        name="file"
        type="file"
        multiple
        required
        accept="image/*,.heic,.heif,application/pdf,text/*,.csv"
        className="block text-sm"
      />
      <p className="text-xs opacity-70">
        Select many files at once (Ctrl+A in the file window selects a whole folder). iPhone HEIC
        and other unusual photo types are converted to JPEG automatically. Originals are kept at
        full quality, up to 100 MB each. Photos over 4.5 MB also get a smaller copy that Claude
        reads for extraction. If an upload fails, nothing is left behind.
      </p>
      <input
        name="title"
        placeholder="Title (only used when uploading a single file)"
        className="w-full rounded-md border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20"
      />
      <select
        name="access_level"
        defaultValue="restricted"
        className="rounded-md border border-black/20 bg-white px-3 py-2 text-sm text-black dark:border-white/20 dark:bg-zinc-900 dark:text-white"
      >
        <option value="restricted">Restricted (managers and admins)</option>
        <option value="general">General (all staff)</option>
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input name="auto_extract" type="checkbox" defaultChecked />
        Extract records automatically after upload
      </label>
      <button
        disabled={busy}
        className="block rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {busy ? "Working..." : "Upload"}
      </button>

      {items.length > 0 && (
        <ul className="space-y-1 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span className="truncate">{it.name}</span>
              <span
                className={
                  it.status === "failed"
                    ? "shrink-0 text-red-600"
                    : it.status === "done"
                      ? "shrink-0 text-green-600"
                      : "shrink-0 opacity-70"
                }
              >
                {it.message ?? it.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

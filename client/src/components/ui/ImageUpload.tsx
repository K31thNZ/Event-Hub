// client/src/components/ui/ImageUpload.tsx
// Reusable image input: paste a URL OR upload a file via Cloudinary.
// Shows a live preview. Clear button removes the image.
//
// Env vars required for file upload:
//   VITE_CLOUDINARY_CLOUD_NAME    — your cloud name (e.g. "mycloud")
//   VITE_CLOUDINARY_UPLOAD_PRESET — an UNSIGNED upload preset name
//
// Setup: cloudinary.com → Settings → Upload → Upload presets → Add → Signing mode: Unsigned

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

const CLOUDINARY_CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME   ?? "";
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "";

async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
    throw new Error("Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_PRESET);
  form.append("folder", folder);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: form }
  );
  if (!res.ok) throw new Error("Upload failed — please try again");
  return ((await res.json()) as any).secure_url as string;
}

interface ImageUploadProps {
  value?:       string | null;
  onChange:     (url: string | null) => void;
  label?:       string;
  hint?:        string;
  folder?:      string;
  aspectRatio?: "wide" | "square";
}

export function ImageUpload({
  value,
  onChange,
  label       = "Image",
  hint,
  folder      = "expatevents",
  aspectRatio = "wide",
}: ImageUploadProps) {
  const fileRef              = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [urlInput,  setUrlInput]  = useState(value ?? "");

  const previewClass = aspectRatio === "square"
    ? "h-40 w-40 rounded-xl"
    : "h-40 w-full rounded-xl";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("File must be under 5 MB"); return; }
    setError(null);
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, folder);
      setUrlInput(url);
      onChange(url);
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
    onChange(e.target.value || null);
    setError(null);
  };

  const handleClear = () => {
    setUrlInput("");
    onChange(null);
    setError(null);
  };

  const canUpload = !!CLOUDINARY_CLOUD && !!CLOUDINARY_PRESET;

  return (
    <div className="space-y-3">
      {label && (
        <Label className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4" /> {label}
        </Label>
      )}

      {urlInput && (
        <div className={`relative overflow-hidden bg-muted ${previewClass}`}>
          <img
            src={urlInput}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.15"; }}
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={urlInput}
          onChange={handleUrlChange}
          className="h-11 rounded-xl flex-1"
          placeholder="https://images.unsplash.com/…"
        />
        {canUpload && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-11 px-4 rounded-xl border border-border bg-muted hover:bg-muted/80 transition-colors flex items-center gap-2 text-sm font-medium shrink-0 disabled:opacity-60"
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              : <><Upload className="w-4 h-4" /> Upload</>
            }
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {hint  && <p className="text-xs text-muted-foreground">{hint}</p>}
      {!canUpload && (
        <p className="text-xs text-muted-foreground">
          Add <code>VITE_CLOUDINARY_CLOUD_NAME</code> + <code>VITE_CLOUDINARY_UPLOAD_PRESET</code> to enable file uploads.
        </p>
      )}
    </div>
  );
}

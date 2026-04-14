// client/src/components/ui/ImageUpload.tsx
// Reusable image input: paste a URL OR upload a file via Cloudinary.
// Shows a live preview. Clear button removes the image.
//
// Env vars required:
// VITE_CLOUDINARY_CLOUD_NAME=dydaxi392
// VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset_name
//
// Setup: Cloudinary → Settings → Upload → Upload presets → Create Unsigned preset

import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
//import { VisuallyHidden } from "@/components/ui/visually-hidden";

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "";
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "";

// Compress image before upload (fixes most ERR_CONNECTION_CLOSED errors)
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const MAX_WIDTH = 1200;

        if (width > MAX_WIDTH) {
          height = Math.round((MAX_WIDTH / width) * height);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressed);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.82
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
    throw new Error("Cloudinary is not configured. Check your VITE_ environment variables.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_PRESET);
  form.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: form }
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error("Cloudinary upload failed:", res.status, errorText);
    throw new Error(`Upload failed (${res.status}). Try a smaller image.`);
  }

  const data = await res.json();
  return data.secure_url as string;
}

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  hint?: string;
  folder?: string;
  aspectRatio?: "wide" | "square";
}

export function ImageUpload({
  value,
  onChange,
  label = "Cover Image",
  hint = "Upload a photo or use the default for your chosen category. Max ~8 MB after compression.",
  folder = "expatevents",
  aspectRatio = "wide",
}: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(value ?? "");

  // Sync when parent passes new value (e.g. default category image)
  useEffect(() => {
    setUrlInput(value ?? "");
  }, [value]);

  const previewClass = aspectRatio === "square"
    ? "h-40 w-40 rounded-xl"
    : "h-40 w-full rounded-xl";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10 MB");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const compressedFile = await compressImage(file);
      const url = await uploadToCloudinary(compressedFile, folder);

      setUrlInput(url);
      onChange(url);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message ?? "Upload failed. Please try again with a smaller photo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value.trim();
    setUrlInput(newUrl);
    onChange(newUrl || null);
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
            alt="Event cover preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
            }}
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
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
            className="h-11 px-5 rounded-xl border border-border bg-muted hover:bg-muted/80 transition-colors flex items-center gap-2 text-sm font-medium shrink-0 disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload
              </>
            )}
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

      {/* Accessibility fix for Radix Dialog / Sheet */}
      <VisuallyHidden>
        <div aria-label="Image upload dialog" />
      </VisuallyHidden>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {!canUpload && (
        <p className="text-xs text-muted-foreground">
          File upload is disabled. Add <code>VITE_CLOUDINARY_CLOUD_NAME</code> and{" "}
          <code>VITE_CLOUDINARY_UPLOAD_PRESET</code> to your environment variables.
        </p>
      )}
    </div>
  );
}

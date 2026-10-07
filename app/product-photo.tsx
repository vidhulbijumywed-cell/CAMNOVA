"use client";
import { useEffect, useRef, useState } from "react";

export function productPhotoUrl(id: string, updatedAt: string) {
  return `/api/product-photo/${encodeURIComponent(id)}?v=${encodeURIComponent(updatedAt)}`;
}

async function preparePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose an image smaller than 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare this photo.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL("image/jpeg", 0.8);
    if (photo.length > 22 + 4 * Math.ceil((1024 * 1024) / 3))
      throw new Error("This photo is too large. Choose a smaller image.");
    return photo;
  } finally {
    bitmap.close();
  }
}

export default function ProductPhotoEditor({
  existingUrl,
  disabled,
  onChange,
  onPreparing,
}: {
  existingUrl?: string;
  disabled: boolean;
  onChange: (photo: string | null | undefined) => void;
  onPreparing: (preparing: boolean) => void;
}) {
  const [preview, setPreview] = useState(existingUrl);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  return (
    <div className="product-photo-editor">
      <label htmlFor="product-photo-input">Product photo</label>
      {preview && (
        <img
          className="product-photo-preview"
          src={preview}
          alt="Product photo preview"
        />
      )}
      <input
        ref={input}
        id="product-photo-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || preparing}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const current = ++generation.current;
          setError("");
          setPreparing(true);
          onPreparing(true);
          try {
            const photo = await preparePhoto(file);
            if (current !== generation.current) return;
            setPreview(photo);
            onChange(photo);
          } catch (error) {
            if (current === generation.current) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Unable to read this image.",
              );
              if (input.current) input.current.value = "";
            }
          } finally {
            if (current === generation.current) {
              setPreparing(false);
              onPreparing(false);
            }
          }
        }}
      />
      <small>
        JPG, PNG or WebP, up to 10 MB. Photos are resized when you save.
      </small>
      {preparing && <p role="status">Preparing photo…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <button
          type="button"
          className="secondary"
          disabled={disabled || preparing}
          onClick={() => {
            generation.current++;
            setPreview(undefined);
            setError("");
            if (input.current) input.current.value = "";
            onChange(null);
          }}
        >
          Remove photo
        </button>
      )}
    </div>
  );
}

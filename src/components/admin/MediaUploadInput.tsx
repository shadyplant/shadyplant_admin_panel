"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminActionButton } from "@/components/admin/AdminUi";
import { inputClassName } from "@/components/admin/Forms";
import {
  type AdminMediaUploadSessionResponse,
  type ApiResponse,
} from "@/lib/admin-api";

type MediaUploadPurpose =
  | "product-image"
  | "product-gallery-image"
  | "product-uses-view-image"
  | "home-category-image"
  | "home-slider-desktop-image"
  | "home-slider-mobile-image"
  | "service-image";

type MediaUploadInputProps = {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  entityType: string;
  entityId: string;
  slotKey?: string;
  purpose: MediaUploadPurpose;
  placeholder?: string;
  allowEdits?: boolean;
  hint?: string;
  compact?: boolean;
  dropzone?: boolean;
  buttonLabel?: string;
};

function getUploadErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function MediaUploadInput({
  label,
  value,
  onChange,
  entityType,
  entityId,
  slotKey = "",
  purpose,
  placeholder = "https://...",
  allowEdits = true,
  hint,
  compact = false,
  dropzone = false,
  buttonLabel = "Upload from device",
}: MediaUploadInputProps) {
  const { authorizedRequest } = useAdminAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function completeUploadSession(
    uploadId: string,
    publicUrl: string,
  ) {
    await authorizedRequest<ApiResponse<{ session: unknown }>>(
      `/admin/media/uploads/${uploadId}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ publicUrl }),
      },
    );
  }

  async function uploadSelectedFile(file: File) {
    setIsUploading(true);
    setUploadPercent(0);
    setStatusMessage("Requesting upload URL...");

    try {
      const sessionResponse = await authorizedRequest<
        ApiResponse<AdminMediaUploadSessionResponse>
      >("/admin/media/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          purpose,
          entityType,
          entityId,
          slotKey,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          byteSize: file.size,
        }),
      });

      const session = sessionResponse.data.session;
      const upload = sessionResponse.data;

      setStatusMessage("Uploading image...");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open(upload.method, upload.signedUrl, true);
        Object.entries(upload.headers || {}).forEach(([header, headerValue]) => {
          xhr.setRequestHeader(header, headerValue);
        });

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) {
            return;
          }

          setUploadPercent(Math.round((event.loaded / event.total) * 100));
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
            return;
          }

          reject(
            new Error(
              `Upload failed with status ${xhr.status}. Please try again.`,
            ),
          );
        };

        xhr.onerror = () => {
          reject(new Error("Unable to upload image to S3."));
        };

        xhr.send(file);
      });

      setUploadPercent(100);
      setStatusMessage("Finalizing upload...");
      await completeUploadSession(session.id, upload.publicUrl);
      onChange(upload.publicUrl);
      setStatusMessage("Upload completed successfully.");
    } catch (error) {
      setStatusMessage(
        getUploadErrorMessage(error, "Unable to upload image right now."),
      );
    } finally {
      setIsUploading(false);
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }

      resetTimerRef.current = window.setTimeout(() => {
        setUploadPercent(null);
      }, 1200);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!dropzone || !allowEdits || isUploading) {
      return;
    }

    event.preventDefault();
    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    void uploadSelectedFile(file);
  }

  return (
    <div className="space-y-2">
      <div
        className={
          dropzone
            ? "rounded-[1rem] border border-dashed border-[var(--admin-line-strong)] bg-[var(--admin-chip)] p-3"
            : compact
              ? "flex items-center gap-2"
              : "grid gap-3"
        }
        onDragOver={dropzone ? (event) => event.preventDefault() : undefined}
        onDrop={dropzone ? handleDrop : undefined}
      >
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={!allowEdits || isUploading}
          aria-readonly={!allowEdits || isUploading}
          className={inputClassName()}
          placeholder={placeholder}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";

            if (!file) {
              return;
            }

            void uploadSelectedFile(file);
          }}
        />
        <AdminActionButton
          type="button"
          tone="primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={!allowEdits || isUploading}
          className={
            dropzone
              ? "mt-3 w-full"
              : compact
                ? "shrink-0 whitespace-nowrap px-3 py-2.5"
                : "min-h-11 w-full"
          }
          aria-label={`Upload ${label}`}
        >
          <Upload size={16} className="mr-2" />
          {isUploading ? "Uploading..." : buttonLabel}
        </AdminActionButton>
      </div>

      {hint && !compact ? <p className="text-xs leading-5 text-[var(--admin-muted)]">{hint}</p> : null}
      {dropzone ? (
        <p className="text-xs leading-5 text-[var(--admin-muted)]">
          Drag and drop an image here, paste a URL, or upload from your device.
        </p>
      ) : null}

      {uploadPercent !== null ? (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-[#e8efe3]">
            <div
              className="h-full rounded-full bg-[var(--admin-accent)] transition-all duration-200"
              style={{ width: `${uploadPercent}%` }}
            />
          </div>
          <p className="text-xs font-semibold text-[#214f14]">
            {statusMessage} {uploadPercent}%
          </p>
        </div>
      ) : statusMessage && !compact ? (
        <p className="text-xs font-medium text-[#58724f]">{statusMessage}</p>
      ) : null}
    </div>
  );
}

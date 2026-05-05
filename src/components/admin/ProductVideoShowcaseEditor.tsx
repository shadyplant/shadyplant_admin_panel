"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AdminActionButton } from "@/components/admin/AdminUi";
import { FormField, inputClassName } from "@/components/admin/Forms";

export type ProductVideoClipFormState = {
  id: string;
  title: string;
  poster: string;
  src: string;
  views: string;
  products: string;
  isVideo: boolean;
};

type ProductVideoShowcaseEditorProps = {
  clips: ProductVideoClipFormState[];
  primaryImage: string;
  allowEdits?: boolean;
  onChange: (clips: ProductVideoClipFormState[]) => void;
};

export function emptyProductVideoClip(): ProductVideoClipFormState {
  return {
    id: "",
    title: "",
    poster: "",
    src: "",
    views: "",
    products: "1",
    isVideo: true,
  };
}

export default function ProductVideoShowcaseEditor({
  clips,
  primaryImage,
  allowEdits = true,
  onChange,
}: ProductVideoShowcaseEditorProps) {
  const [localPreviewUrls, setLocalPreviewUrls] = useState<Array<string | null>>(
    () => clips.map(() => null),
  );
  const localPreviewUrlsRef = useRef<Array<string | null>>([]);
  const uploadInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    localPreviewUrlsRef.current = localPreviewUrls;
  }, [localPreviewUrls]);

  useEffect(() => {
    setLocalPreviewUrls((current) => {
      const next = clips.map((_, index) => current[index] || null);
      current.slice(clips.length).forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
      localPreviewUrlsRef.current = next;
      return next;
    });
  }, [clips]);

  useEffect(
    () => () => {
      localPreviewUrlsRef.current.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    },
    [],
  );

  function updateClip(
    clipIndex: number,
    updates: Partial<ProductVideoClipFormState>,
  ) {
    onChange(
      clips.map((clip, index) =>
        index === clipIndex ? { ...clip, ...updates } : clip,
      ),
    );
  }

  function addClip() {
    onChange([...clips, emptyProductVideoClip()]);
  }

  function removeClip(clipIndex: number) {
    setLocalPreviewUrls((current) => {
      const next = current.filter((_, index) => index !== clipIndex);
      const removedUrl = current[clipIndex];

      if (removedUrl) {
        URL.revokeObjectURL(removedUrl);
      }

      localPreviewUrlsRef.current = next;
      return next;
    });
    onChange(clips.filter((_, index) => index !== clipIndex));
  }

  function handleLocalClipPreview(clipIndex: number, file?: File | null) {
    if (!file) {
      return;
    }

    setLocalPreviewUrls((current) => {
      const next = [...current];

      if (next[clipIndex]) {
        URL.revokeObjectURL(next[clipIndex] as string);
      }

      next[clipIndex] = URL.createObjectURL(file);
      localPreviewUrlsRef.current = next;
      return next;
    });
  }

  return (
    <div className="rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-bold text-[var(--admin-ink)]">
            See In Action video showcase
          </p>
          <p className="mt-1 max-w-3xl text-sm text-[var(--admin-muted)]">
            Manage the product detail page video cards here. Save hosted video
            URLs for production, or upload a local clip to preview it inside the
            admin editor before publishing the final URL.
          </p>
        </div>
        <AdminActionButton
          type="button"
          tone="secondary"
          onClick={addClip}
          disabled={!allowEdits}
        >
          Add video clip
        </AdminActionButton>
      </div>

      {clips.length ? (
        <div className="mt-5 space-y-5">
          {clips.map((clip, clipIndex) => {
            const previewVideoUrl = localPreviewUrls[clipIndex] || clip.src.trim();
            const previewPoster = clip.poster.trim() || primaryImage.trim();
            const previewTitle =
              clip.title.trim() || `Video clip ${clipIndex + 1}`;

            return (
              <div
                key={`video-clip-${clipIndex}-${clip.id || "new"}`}
                className="rounded-[1.1rem] border border-[var(--admin-line)] bg-white p-4"
              >
                <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="relative aspect-[9/14] overflow-hidden rounded-[1rem] border border-[var(--admin-line)] bg-[#0a1208]">
                      {previewVideoUrl ? (
                        <video
                          src={previewVideoUrl}
                          poster={previewPoster || undefined}
                          className="h-full w-full object-cover"
                          controls
                          playsInline
                          muted
                          preload="metadata"
                        />
                      ) : previewPoster ? (
                        <Image
                          src={previewPoster}
                          alt={previewTitle}
                          fill
                          className="object-cover"
                          sizes="220px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-5 text-center text-sm text-white/70">
                          Add a poster or a hosted video URL to preview this
                          storefront clip.
                        </div>
                      )}
                    </div>

                    <input
                      ref={(node) => {
                        uploadInputRefs.current[clipIndex] = node;
                      }}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(event) =>
                        handleLocalClipPreview(
                          clipIndex,
                          event.target.files?.[0] || null,
                        )
                      }
                    />

                    <div className="flex flex-wrap gap-2">
                      <AdminActionButton
                        type="button"
                        tone="secondary"
                        onClick={() => uploadInputRefs.current[clipIndex]?.click()}
                        disabled={!allowEdits}
                      >
                        Upload local clip
                      </AdminActionButton>
                      <AdminActionButton
                        type="button"
                        tone="danger"
                        onClick={() => removeClip(clipIndex)}
                        disabled={!allowEdits}
                      >
                        Remove clip
                      </AdminActionButton>
                    </div>

                    <p className="text-xs leading-5 text-[var(--admin-muted)]">
                      Local upload is preview-only right now. The hosted video
                      URL below is the production value that gets saved and shown
                      on the ecommerce product page.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <FormField label="Clip title">
                      <input
                        value={clip.title}
                        onChange={(event) =>
                          updateClip(clipIndex, { title: event.target.value })
                        }
                        className={inputClassName()}
                        placeholder="Real balcony setup view"
                      />
                    </FormField>

                    <FormField label="Clip id">
                      <input
                        value={clip.id}
                        onChange={(event) =>
                          updateClip(clipIndex, { id: event.target.value })
                        }
                        className={inputClassName()}
                        placeholder="balcony-setup-view"
                      />
                    </FormField>

                    <FormField label="Views label">
                      <input
                        value={clip.views}
                        onChange={(event) =>
                          updateClip(clipIndex, { views: event.target.value })
                        }
                        className={inputClassName()}
                        placeholder="12.4K"
                      />
                    </FormField>

                    <FormField label="Hosted video URL">
                      <input
                        value={clip.src}
                        onChange={(event) =>
                          updateClip(clipIndex, { src: event.target.value })
                        }
                        className={inputClassName()}
                        placeholder="https://cdn.example.com/video.mp4"
                      />
                    </FormField>

                    <FormField label="Poster image URL">
                      <input
                        value={clip.poster}
                        onChange={(event) =>
                          updateClip(clipIndex, { poster: event.target.value })
                        }
                        className={inputClassName()}
                        placeholder="https://cdn.example.com/poster.jpg"
                      />
                    </FormField>

                    <FormField label="Products count">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={clip.products}
                        onChange={(event) =>
                          updateClip(clipIndex, { products: event.target.value })
                        }
                        className={inputClassName()}
                        placeholder="1"
                      />
                    </FormField>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm font-medium text-[var(--admin-ink)]">
                        <input
                          type="checkbox"
                          checked={clip.isVideo}
                          onChange={(event) =>
                            updateClip(clipIndex, {
                              isVideo: event.target.checked,
                            })
                          }
                        />
                        Render as video clip
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 text-sm text-[var(--admin-muted)]">
          No showcase clips added yet. Add a few hosted reels or installation
          videos to feed the product detail page carousel.
        </p>
      )}
    </div>
  );
}

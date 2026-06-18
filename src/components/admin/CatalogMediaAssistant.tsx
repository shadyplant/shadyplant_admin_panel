"use client";

import Image from "next/image";
import { Expand, ImagePlus, Minimize2, PencilLine, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AdminActionButton } from "@/components/admin/AdminUi";

type CatalogMediaAssistantProps = {
  primaryImage: string;
  galleryImages: string[];
  entityLabel: string;
  allowEdits?: boolean;
  onPrimaryImageChange?: (url: string) => void;
  onGalleryImagesChange?: (images: string[]) => void;
};

type StoredPreviewSlot = {
  kind: "primary" | "gallery";
  index: number;
  title: string;
  image: string;
};

type EditorTarget = StoredPreviewSlot | { kind: "gallery"; index: number; title: string; image: "" };

function buildDisplayLabel(slot: EditorTarget) {
  return slot.kind === "primary"
    ? "Primary image"
    : slot.image
      ? `Gallery image ${slot.index + 1}`
      : "New gallery image";
}

export default function CatalogMediaAssistant({
  primaryImage,
  galleryImages,
  entityLabel,
  allowEdits = true,
  onPrimaryImageChange,
  onGalleryImagesChange,
}: CatalogMediaAssistantProps) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [editorMode, setEditorMode] = useState<"url" | "local">("url");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftLocalPreviewUrl, setDraftLocalPreviewUrl] = useState<string | null>(null);
  const [fullscreenSlot, setFullscreenSlot] = useState<StoredPreviewSlot | null>(null);
  const localPreviewInputRef = useRef<HTMLInputElement | null>(null);
  const modalLocalInputRef = useRef<HTMLInputElement | null>(null);
  const canUsePortal = typeof window !== "undefined";

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }

      if (draftLocalPreviewUrl) {
        URL.revokeObjectURL(draftLocalPreviewUrl);
      }
    };
  }, [draftLocalPreviewUrl, localPreviewUrl]);

  const storedPreviewSlots = useMemo<StoredPreviewSlot[]>(() => {
    const normalizedPrimary = primaryImage.trim();
    const normalizedGallery = galleryImages.map((image) => image.trim()).filter(Boolean);

    return [
      ...(normalizedPrimary
        ? [
            {
              kind: "primary" as const,
              index: 0,
              title: "Primary",
              image: normalizedPrimary,
            },
          ]
        : []),
      ...normalizedGallery.map((image, index) => ({
        kind: "gallery" as const,
        index,
        title: `Gallery ${index + 1}`,
        image,
      })),
    ];
  }, [galleryImages, primaryImage]);

  function openEditor(target: EditorTarget) {
    setEditorTarget(target);
    setEditorMode("url");
    setDraftUrl(target.image);

    if (draftLocalPreviewUrl) {
      URL.revokeObjectURL(draftLocalPreviewUrl);
    }

    setDraftLocalPreviewUrl(null);
  }

  function closeEditor() {
    setEditorTarget(null);
    setEditorMode("url");
    setDraftUrl("");

    if (draftLocalPreviewUrl) {
      URL.revokeObjectURL(draftLocalPreviewUrl);
    }

    setDraftLocalPreviewUrl(null);
  }

  function applyUrlUpdate() {
    if (!editorTarget) {
      return;
    }

    const nextUrl = draftUrl.trim();

    if (editorTarget.kind === "primary") {
      onPrimaryImageChange?.(nextUrl);
      closeEditor();
      return;
    }

    const nextGalleryImages = [...galleryImages];

    if (editorTarget.index < nextGalleryImages.length) {
      if (nextUrl) {
        nextGalleryImages[editorTarget.index] = nextUrl;
      } else {
        nextGalleryImages.splice(editorTarget.index, 1);
      }
    } else if (nextUrl) {
      nextGalleryImages.push(nextUrl);
    }

    onGalleryImagesChange?.(nextGalleryImages);
    closeEditor();
  }

  function handleStandaloneLocalPreview(file?: File | null) {
    if (!file) {
      return;
    }

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    setLocalPreviewUrl(URL.createObjectURL(file));
  }

  function handleModalLocalPreview(file?: File | null) {
    if (!file) {
      return;
    }

    if (draftLocalPreviewUrl) {
      URL.revokeObjectURL(draftLocalPreviewUrl);
    }

    setDraftLocalPreviewUrl(URL.createObjectURL(file));
  }
  function openFullscreen(slot: StoredPreviewSlot) {
    setFullscreenSlot(slot);
  }

  function closeFullscreen() {
    setFullscreenSlot(null);
  }

  return (
    <>
      <div className="rounded-[1.5rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-lg font-black tracking-[-0.04em] text-[var(--admin-ink)]">
              Media Workspace
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
              Keep the {entityLabel} gallery compact here, hover a card to replace the image URL or inspect it fullscreen, and use the editor actions below when you want to upload or verify a file before publishing it.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={localPreviewInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleStandaloneLocalPreview(event.target.files?.[0] || null)}
            />
            <AdminActionButton
              type="button"
              tone="secondary"
              onClick={() => localPreviewInputRef.current?.click()}
            >
              <Upload size={16} className="mr-2" />
              Preview Local File
            </AdminActionButton>
            {allowEdits ? (
              <AdminActionButton
                type="button"
                tone="secondary"
                onClick={() =>
                  openEditor({
                    kind: "gallery",
                    index: galleryImages.length,
                    title: "New gallery image",
                    image: "",
                  })
                }
              >
                <ImagePlus size={16} className="mr-2" />
                Add Gallery Image
              </AdminActionButton>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
              Local preview only
            </p>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] border border-[var(--admin-line)] bg-white">
              {localPreviewUrl ? (
                <Image
                  src={localPreviewUrl}
                  alt="Local asset preview"
                  fill
                  className="object-cover"
                  sizes="220px"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--admin-muted)]">
                  Pick a local file if you want to visually verify it before publishing the hosted URL.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                Stored URL previews
              </p>
              <p className="text-xs text-[var(--admin-muted)]">
                Hover a tile to edit or expand
              </p>
            </div>

            {storedPreviewSlots.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {storedPreviewSlots.map((slot) => (
                  <div
                    key={`${slot.kind}-${slot.index}-${slot.image}`}
                    className="group overflow-hidden rounded-[1.15rem] border border-[var(--admin-line)] bg-white"
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#f5f8f1]">
                      <Image
                        src={slot.image}
                        alt={`${entityLabel} preview ${slot.index + 1}`}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-[1.04]"
                        sizes="240px"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,28,14,0.04),rgba(15,28,14,0.72))] opacity-0 transition group-hover:opacity-100" />
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 opacity-0 transition group-hover:opacity-100">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                            {slot.title}
                          </p>
                          <p className="mt-1 line-clamp-1 text-sm font-semibold text-white">
                            {slot.kind === "primary" ? "Primary image" : `Gallery image ${slot.index + 1}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openFullscreen(slot)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-[var(--admin-ink)] shadow-sm transition hover:bg-white"
                            aria-label={`Expand ${slot.title}`}
                          >
                            <Expand size={15} />
                          </button>
                          {allowEdits ? (
                            <button
                              type="button"
                              onClick={() => openEditor(slot)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--admin-accent)] text-white shadow-sm transition hover:brightness-95"
                              aria-label={`Edit ${slot.title}`}
                            >
                              <PencilLine size={15} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                        {slot.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--admin-muted)]">
                        {slot.image}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-[1.2rem] border border-dashed border-[var(--admin-line-strong)] bg-white px-5 py-8 text-sm text-[var(--admin-muted)]">
                Add a primary image or gallery URL to preview the saved storefront assets here.
              </div>
            )}
          </div>
        </div>
      </div>

      {canUsePortal && editorTarget
        ? createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0b1609]/70 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={closeEditor}
            aria-label="Close media editor"
          />
          <div className="relative z-[91] w-full max-w-3xl rounded-[1.6rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_28px_80px_rgba(15,28,14,0.28)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                  Edit Media Slot
                </p>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  {buildDisplayLabel(editorTarget)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--admin-line-strong)] bg-white text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
                aria-label="Close media editor"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <AdminActionButton
                type="button"
                tone={editorMode === "url" ? "primary" : "secondary"}
                onClick={() => setEditorMode("url")}
              >
                Use hosted URL
              </AdminActionButton>
              <AdminActionButton
                type="button"
                tone={editorMode === "local" ? "primary" : "secondary"}
                onClick={() => setEditorMode("local")}
              >
                Preview local file
              </AdminActionButton>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div className="relative aspect-square overflow-hidden rounded-[1.25rem] border border-[var(--admin-line)] bg-[var(--admin-chip)]">
                {editorMode === "local" && draftLocalPreviewUrl ? (
                  <Image
                    src={draftLocalPreviewUrl}
                    alt="Local draft preview"
                    fill
                    className="object-cover"
                    sizes="300px"
                  />
                ) : editorTarget.image ? (
                  <Image
                    src={editorTarget.image}
                    alt={buildDisplayLabel(editorTarget)}
                    fill
                    className="object-cover"
                    sizes="300px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--admin-muted)]">
                    This slot is empty right now.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {editorMode === "url" ? (
                  <>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                        Hosted image URL
                      </label>
                      <textarea
                        value={draftUrl}
                        onChange={(event) => setDraftUrl(event.target.value)}
                        className="mt-2 min-h-[120px] w-full rounded-[1rem] border border-[var(--admin-line-strong)] bg-white px-4 py-3 text-sm text-[var(--admin-ink)] outline-none placeholder:text-[#8a9b88] focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)]"
                        placeholder="https://cdn.example.com/product-image.jpg"
                      />
                    </div>
                    <p className="text-sm leading-6 text-[var(--admin-muted)]">
                      Save a public CDN or storage URL here. Clear the field and apply to remove this slot from the gallery.
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      ref={modalLocalInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleModalLocalPreview(event.target.files?.[0] || null)}
                    />
                    <div className="rounded-[1.1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] p-4">
                      <p className="text-sm font-semibold text-[var(--admin-ink)]">
                        Local preview mode
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                        You can preview a local file here while the upload field handles the hosted S3 URL that gets saved into the catalog record.
                      </p>
                      <AdminActionButton
                        type="button"
                        tone="secondary"
                        className="mt-4"
                        onClick={() => modalLocalInputRef.current?.click()}
                      >
                        <Upload size={16} className="mr-2" />
                        Choose Local File
                      </AdminActionButton>
                    </div>
                    {draftLocalPreviewUrl ? (
                      <p className="text-sm text-[var(--admin-muted)]">
                        Local preview loaded. Switch back to URL mode or use the upload field to save the final image link.
                      </p>
                    ) : null}
                  </>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {editorMode === "url" ? (
                    <AdminActionButton
                      type="button"
                      tone="primary"
                      onClick={applyUrlUpdate}
                      disabled={!allowEdits}
                    >
                      Apply URL
                    </AdminActionButton>
                  ) : null}
                  <AdminActionButton type="button" tone="secondary" onClick={closeEditor}>
                    Close
                  </AdminActionButton>
                </div>
              </div>
            </div>
          </div>
        </div>
        ,
        document.body,
      )
        : null}

      {canUsePortal && fullscreenSlot
        ? createPortal(
        <div
          className="fixed inset-0 z-[999] h-screen w-screen bg-[#091107]"
        >
          <button
            type="button"
            className="absolute inset-0 z-[95] cursor-default"
            onClick={closeFullscreen}
            aria-label="Close image viewer"
          />
          <div className="absolute inset-x-0 top-0 z-[96] flex items-center justify-between gap-3 bg-[linear-gradient(180deg,rgba(0,0,0,0.75),rgba(0,0,0,0.08))] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Image Viewer
              </p>
              <p className="mt-1 text-base font-semibold text-white">
                {fullscreenSlot.kind === "primary" ? "Primary image" : `Gallery image ${fullscreenSlot.index + 1}`}
              </p>
            </div>
            <button
              type="button"
              onClick={closeFullscreen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/16"
              aria-label="Minimize fullscreen view"
            >
              <Minimize2 size={18} />
            </button>
          </div>
          <div className="relative h-full w-full">
            <Image
              src={fullscreenSlot.image}
              alt={`${entityLabel} fullscreen preview`}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>
        </div>
        ,
        document.body,
      )
        : null}
    </>
  );
}

"use client";

export type AdminSnackbarTone = "success" | "error" | "warning" | "info";

export type AdminSnackbarState = {
  title: string;
  body: string;
  tone?: AdminSnackbarTone;
  href?: string;
  actionLabel?: string;
};

export const ADMIN_SNACKBAR_EVENT = "ggn-admin-snackbar";

export function showAdminSnackbar(snackbar: AdminSnackbarState) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AdminSnackbarState>(ADMIN_SNACKBAR_EVENT, {
      detail: snackbar,
    }),
  );
}

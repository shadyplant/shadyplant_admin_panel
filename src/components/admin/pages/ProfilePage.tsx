"use client";

import { useEffect } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  AdminErrorCard,
  AdminLoadingCard,
} from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminInfoList, AdminPanel } from "@/components/admin/AdminUi";

function formatRole(value: string | null | undefined) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "Not available";
  }

  return normalized.replaceAll("_", " ");
}

function formatStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "Not available";
  }

  return normalized.replaceAll("_", " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return "Not available";
  }

  return timestamp.toLocaleString();
}

export default function ProfilePage() {
  const { hydrated, isAuthenticated, staff, refreshStaff } = useAdminAuth();

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      void refreshStaff();
    }
  }, [hydrated, isAuthenticated, refreshStaff]);

  if (!hydrated) {
    return <AdminLoadingCard label="Loading profile..." />;
  }

  if (!staff) {
    return (
      <AdminErrorCard
        message="Profile data is unavailable right now."
        onRetry={() => void refreshStaff()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Account"
        title="Profile"
        description="Your admin account details."
      />

      <AdminPanel>
        <AdminInfoList
          items={[
            { label: "Full name", value: staff.fullName || "Not available" },
            { label: "Email", value: staff.email || "Not available" },
            { label: "Role", value: formatRole(staff.role) },
            { label: "Status", value: formatStatus(staff.status) },
            {
              label: "Organization",
              value:
                staff.organization?.name || staff.organizationId || "Not available",
            },
            {
              label: "Last login",
              value: formatDate(staff.lastLoginAt),
            },
            {
              label: "Created",
              value: formatDate(staff.createdAt),
            },
            {
              label: "Updated",
              value: formatDate(staff.updatedAt),
            },
          ]}
        />
      </AdminPanel>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminSelect,
} from "@/components/admin/AdminUi";
import { FormField, FormGrid, inputClassName } from "@/components/admin/Forms";
import type { AdminStaff, ApiResponse } from "@/lib/admin-api";
import { canManageTeam } from "@/lib/admin-permissions";

type TeamEditorPageProps = {
  staffId?: string;
};

type TeamFormState = {
  fullName: string;
  email: string;
  role: string;
  status: string;
  password: string;
};

const emptyForm: TeamFormState = {
  fullName: "",
  email: "",
  role: "support",
  status: "active",
  password: "",
};

const roleOptions = ["owner", "admin", "manager", "catalog", "operations", "support"];

function mapStaffToForm(staff: AdminStaff): TeamFormState {
  return {
    fullName: staff.fullName || "",
    email: staff.email || "",
    role: staff.role || "support",
    status: staff.status || "active",
    password: "",
  };
}

function buildPayload(form: TeamFormState, isCreate: boolean) {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    role: form.role.trim(),
    status: form.status.trim(),
    ...(form.password.trim() || isCreate ? { password: form.password } : {}),
  };
}

export default function TeamEditorPage({ staffId }: TeamEditorPageProps) {
  const router = useRouter();
  const { authorizedRequest, staff: activeStaff } = useAdminAuth();
  const [staffAccount, setStaffAccount] = useState<AdminStaff | null>(null);
  const [form, setForm] = useState<TeamFormState>(emptyForm);
  const [loading, setLoading] = useState(Boolean(staffId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const allowTeamManagement = canManageTeam(activeStaff?.role);

  async function loadStaffAccount() {
    if (!staffId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authorizedRequest<ApiResponse<{ staff: AdminStaff[] }>>(
        "/admin/staff",
      );
      const nextStaffAccount =
        response.data.staff.find((member) => member.id === staffId) || null;

      if (!nextStaffAccount) {
        throw new Error("Staff account not found.");
      }

      setStaffAccount(nextStaffAccount);
      setForm(mapStaffToForm(nextStaffAccount));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load staff account.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!staffId) {
      return;
    }

    let cancelled = false;

    async function syncStaffAccount() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ staff: AdminStaff[] }>>(
            "/admin/staff",
          );
        const nextStaffAccount =
          response.data.staff.find((member) => member.id === staffId) || null;

        if (cancelled) {
          return;
        }

        if (!nextStaffAccount) {
          throw new Error("Staff account not found.");
        }

        setStaffAccount(nextStaffAccount);
        setForm(mapStaffToForm(nextStaffAccount));
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load staff account.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncStaffAccount();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest, staffId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ staff: AdminStaff }>>(
          staffId ? `/admin/staff/${staffId}` : "/admin/staff",
          {
            method: staffId ? "PATCH" : "POST",
            body: JSON.stringify(buildPayload(form, !staffId)),
          },
        );

      setStaffAccount(response.data.staff);
      setForm(mapStaffToForm(response.data.staff));
      setSuccessMessage(
        staffId
          ? "Staff account updated successfully."
          : "Staff account created successfully.",
      );

      if (!staffId) {
        router.replace(`/team/${response.data.staff.id}`);
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save staff account.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!staffId) {
      return;
    }

    const shouldDelete = window.confirm("Delete this staff account?");

    if (!shouldDelete) {
      return;
    }

    setDeleting(true);

    try {
      await authorizedRequest(`/admin/staff/${staffId}`, {
        method: "DELETE",
      });
      router.replace("/team");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete staff account.",
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return <AdminLoadingCard label="Loading staff editor..." />;
  }

  if (error && staffId && !staffAccount) {
    return <AdminErrorCard message={error} onRetry={loadStaffAccount} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Staff Access"
        title={staffId ? "Manage Staff Account" : "Invite Staff Member"}
        description="Staff users live separately from customers, allowing cleaner permission boundaries and organization-scale administration."
      />

      <form className="space-y-6" onSubmit={handleSubmit}>
        <AdminPanel>
          <FormGrid>
            <FormField label="Full name">
              <input
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                className={inputClassName()}
                placeholder="Aarav Sharma"
                required
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={inputClassName()}
                placeholder="ops@grassgreen.in"
                required
              />
            </FormField>
            <FormField label="Role">
              <AdminSelect
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </AdminSelect>
            </FormField>
            <FormField label="Status">
              <AdminSelect
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                disabled={!staffId}
              >
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </AdminSelect>
            </FormField>
            <FormField
              label={staffId ? "Reset password" : "Temporary password"}
              hint="At least 8 characters with upper, lower, number, and symbol."
            >
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                className={inputClassName()}
                placeholder={staffId ? "Leave blank to keep current password" : "Create a strong password"}
                required={!staffId}
              />
            </FormField>
          </FormGrid>

          {(error || successMessage) && (
            <div
              className={`mt-5 rounded-[1rem] px-4 py-3 text-sm font-medium ${
                error
                  ? "border border-[#f1c7c3] bg-[#fff6f4] text-[#a73d31]"
                  : "border border-[#cfe2c8] bg-[#f4fbf1] text-[#256233]"
              }`}
            >
              {error || successMessage}
            </div>
          )}
          {!allowTeamManagement ? (
            <div className="mt-5 rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-muted)]">
              Staff account management is limited to manager, admin, and owner roles.
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AdminActionButton
              type="submit"
              tone="primary"
              disabled={saving || !allowTeamManagement}
            >
              {saving ? "Saving..." : staffId ? "Save staff account" : "Create staff account"}
            </AdminActionButton>
            <Link
              href="/team"
              className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
            >
              Back to team
            </Link>
            {staffId && activeStaff?.id !== staffId ? (
              <AdminActionButton
                type="button"
                tone="danger"
                onClick={handleDelete}
                disabled={deleting || !allowTeamManagement}
              >
                {deleting ? "Deleting..." : "Delete staff account"}
              </AdminActionButton>
            ) : null}
          </div>
        </AdminPanel>
      </form>
    </div>
  );
}

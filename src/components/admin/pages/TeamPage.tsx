"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  AdminEmptyCard,
  AdminErrorCard,
  AdminLoadingCard,
} from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminSelect,
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type { AdminStaff, ApiResponse } from "@/lib/admin-api";
import { formatCompactDate } from "@/lib/admin-utils";
import { canManageTeam, getStaffRoleRank } from "@/lib/admin-permissions";

export default function TeamPage() {
  const { authorizedRequest, staff: currentStaff } = useAdminAuth();
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadStaff() {
    setLoading(true);
    setError(null);

    try {
      const response = await authorizedRequest<ApiResponse<{ staff: AdminStaff[] }>>(
        "/admin/staff",
      );
      setStaff(response.data.staff);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load team accounts.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncStaff() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ staff: AdminStaff[] }>>(
            "/admin/staff",
          );

        if (!cancelled) {
          setStaff(response.data.staff);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load team accounts.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncStaff();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  async function handleDelete(member: AdminStaff) {
    const shouldDelete = window.confirm(
      `Delete ${member.fullName} from the staff organization?`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingId(member.id);

    try {
      await authorizedRequest(`/admin/staff/${member.id}`, {
        method: "DELETE",
      });
      setStaff((currentMembers) =>
        currentMembers.filter((entry) => entry.id !== member.id),
      );
    } catch (nextError) {
      window.alert(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete staff account.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const roleOptions = [...new Set(staff.map((member) => member.role).filter(Boolean))];
  const filteredStaff = staff.filter((member) => {
    const matchesQuery = [member.fullName, member.email, member.role, member.status]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesRole = roleFilter === "all" || member.role === roleFilter;

    return matchesQuery && matchesRole;
  });
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedStaff = filteredStaff.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const allowTeamManagement = canManageTeam(currentStaff?.role);
  const currentStaffRoleRank = getStaffRoleRank(currentStaff?.role);

  if (loading) {
    return <AdminLoadingCard label="Loading team accounts..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadStaff} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Organization Staff"
        title="Team"
        description="Manage staff members separately from customer accounts, with role-based access designed for scalable ecommerce operations."
        actionLabel={allowTeamManagement ? "Invite Staff" : undefined}
        actionHref={allowTeamManagement ? "/team/new" : undefined}
      />

      <AdminPanel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <AdminTextInput
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by staff name, email, role, or status"
              className="max-w-xl"
            />
            <AdminSelect
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="md:w-[220px]"
            >
              <option value="all">All roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </AdminSelect>
          </div>
          <p className="text-sm font-semibold text-[var(--admin-muted)]">
            {staff.length} staff accounts
          </p>
        </div>
      </AdminPanel>

      {!filteredStaff.length ? (
        <AdminEmptyCard
          title="No staff accounts found"
          description="Invite team members when you are ready to expand the admin workspace."
        />
      ) : (
        <div className="space-y-4">
          {paginatedStaff.map((member) => (
            <AdminPanel key={member.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                      {member.fullName}
                    </h2>
                    <AdminStatusPill status={member.status} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--admin-muted)]">
                    {member.email} | {member.role} | Added{" "}
                    {formatCompactDate(member.createdAt)}
                  </p>
                </div>

                {(() => {
                  const canManageMember =
                    allowTeamManagement &&
                    currentStaff?.id !== member.id &&
                    currentStaffRoleRank > getStaffRoleRank(member.role);

                  return (
                    <div className="flex flex-wrap items-center gap-3">
                      {canManageMember ? (
                        <Link
                          href={`/team/${member.id}`}
                          className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                        >
                          Manage account
                        </Link>
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                          {currentStaff?.id === member.id
                            ? "Your account"
                            : "Higher access role"}
                        </span>
                      )}
                      {canManageMember ? (
                    <AdminActionButton
                      tone="danger"
                      onClick={() => handleDelete(member)}
                      disabled={deletingId === member.id}
                    >
                      {deletingId === member.id ? "Deleting..." : "Delete"}
                    </AdminActionButton>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            </AdminPanel>
          ))}
          <AdminPagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredStaff.length}
            pageSize={pageSize}
            label="staff accounts"
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}

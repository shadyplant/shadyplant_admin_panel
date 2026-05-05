const STAFF_ROLE_RANK: Record<string, number> = {
  support: 1,
  operations: 2,
  catalog: 3,
  manager: 4,
  admin: 5,
  owner: 6,
};

export function getStaffRoleRank(role: string | null | undefined) {
  return STAFF_ROLE_RANK[String(role || "").trim().toLowerCase()] || 0;
}

export function hasMinimumStaffRole(
  role: string | null | undefined,
  minimumRole: keyof typeof STAFF_ROLE_RANK,
) {
  return getStaffRoleRank(role) >= STAFF_ROLE_RANK[minimumRole];
}

export function canViewCatalog(role: string | null | undefined) {
  return hasMinimumStaffRole(role, "catalog");
}

export function canViewOrders(role: string | null | undefined) {
  return hasMinimumStaffRole(role, "operations");
}

export function canViewTransactions(role: string | null | undefined) {
  return hasMinimumStaffRole(role, "operations");
}

export function canViewCustomers(role: string | null | undefined) {
  return hasMinimumStaffRole(role, "support");
}

export function canViewReviews(role: string | null | undefined) {
  return hasMinimumStaffRole(role, "support");
}

export function canViewTeam(role: string | null | undefined) {
  return hasMinimumStaffRole(role, "manager");
}

export function canManageCatalog(role: string | null | undefined) {
  return hasMinimumStaffRole(role, "catalog");
}

export function canManageOrders(role: string | null | undefined) {
  return hasMinimumStaffRole(role, "operations");
}

export function canManageTeam(role: string | null | undefined) {
  return hasMinimumStaffRole(role, "manager");
}

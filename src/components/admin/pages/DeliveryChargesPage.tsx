"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CopyPlus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { showAdminSnackbar } from "@/components/admin/AdminSnackbar";
import {
  AdminActionButton,
  AdminInfoList,
  AdminPanel,
  AdminPill,
  AdminSectionTitle,
  AdminSelect,
  AdminStatusPill,
  AdminTextarea,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type {
  AdminDeliveryChargeProfile,
  AdminDeliveryChargeSlab,
  AdminDeliveryChargeSlabCalculationMode,
  ApiResponse,
} from "@/lib/admin-api";

type ProfileDraft = {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: string;
  statesText: string;
};

type SlabDraft = {
  id: string | null;
  profileCode: string;
  ruleKey: string;
  name: string;
  description: string;
  notes: string;
  isActive: boolean;
  sortOrder: string;
  calculationMode: AdminDeliveryChargeSlabCalculationMode;
  rate: string;
  weightUnitKg: string;
  minWeightKg: string;
  minWeightInclusive: boolean;
  maxWeightKg: string;
  maxWeightInclusive: boolean;
  minDistanceKm: string;
  minDistanceInclusive: boolean;
  maxDistanceKm: string;
  maxDistanceInclusive: boolean;
};

const DEFAULT_PROFILE_DRAFT: ProfileDraft = {
  code: "",
  name: "",
  description: "",
  isActive: true,
  sortOrder: "100",
  statesText: "",
};

const DEFAULT_SLAB_DRAFT: SlabDraft = {
  id: null,
  profileCode: "",
  ruleKey: "",
  name: "",
  description: "",
  notes: "",
  isActive: true,
  sortOrder: "100",
  calculationMode: "per_distance",
  rate: "0",
  weightUnitKg: "20",
  minWeightKg: "",
  minWeightInclusive: true,
  maxWeightKg: "",
  maxWeightInclusive: true,
  minDistanceKm: "",
  minDistanceInclusive: true,
  maxDistanceKm: "",
  maxDistanceInclusive: true,
};

const CALCULATION_MODE_LABELS: Record<AdminDeliveryChargeSlabCalculationMode, string> = {
  flat: "Flat",
  per_distance: "Per distance",
  per_weight_unit: "Per weight unit",
};

function cloneProfileDraft(draft: ProfileDraft): ProfileDraft {
  return { ...draft };
}

function cloneSlabDraft(draft: SlabDraft): SlabDraft {
  return { ...draft };
}

function normalizeCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatCommaList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(", ");
  }

  return "";
}

function parseNumberOrNull(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSlabSummary(slab: AdminDeliveryChargeSlab) {
  const weightRange =
    slab.minWeightKg === null && slab.maxWeightKg === null
      ? "Any weight"
      : [
          slab.minWeightKg !== null
            ? `${slab.minWeightInclusive ? ">= " : "> "}${slab.minWeightKg} kg`
            : null,
          slab.maxWeightKg !== null
            ? `${slab.maxWeightInclusive ? "<= " : "< "}${slab.maxWeightKg} kg`
            : null,
        ]
          .filter(Boolean)
          .join(" and ");

  const distanceRange =
    slab.minDistanceKm === null && slab.maxDistanceKm === null
      ? "Any distance"
      : [
          slab.minDistanceKm !== null
            ? `${slab.minDistanceInclusive ? ">= " : "> "}${slab.minDistanceKm} km`
            : null,
          slab.maxDistanceKm !== null
            ? `${slab.maxDistanceInclusive ? "<= " : "< "}${slab.maxDistanceKm} km`
            : null,
        ]
          .filter(Boolean)
          .join(" and ");

  if (slab.calculationMode === "per_weight_unit") {
    return `${weightRange}, ${distanceRange}, Rs. ${slab.rate} per ${slab.weightUnitKg} kg unit`;
  }

  if (slab.calculationMode === "flat") {
    return `${weightRange}, ${distanceRange}, flat Rs. ${slab.rate}`;
  }

  return `${weightRange}, ${distanceRange}, Rs. ${slab.rate} per km`;
}

export default function DeliveryChargesPage() {
  const { authorizedRequest } = useAdminAuth();
  const [profiles, setProfiles] = useState<AdminDeliveryChargeProfile[]>([]);
  const [slabs, setSlabs] = useState<AdminDeliveryChargeSlab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedProfileCode, setSelectedProfileCode] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSlab, setSavingSlab] = useState(false);
  const [deletingSlabId, setDeletingSlabId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(cloneProfileDraft(DEFAULT_PROFILE_DRAFT));
  const [slabDraft, setSlabDraft] = useState<SlabDraft>(cloneSlabDraft(DEFAULT_SLAB_DRAFT));
  const hasLoadedRef = useRef(false);
  const profilesRef = useRef<AdminDeliveryChargeProfile[]>([]);
  const selectedProfileCodeRef = useRef("");
  const selectedSlabIdRef = useRef<string | null>(null);
  const selectedSlabsRef = useRef<AdminDeliveryChargeSlab[]>([]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.code === selectedProfileCode) || null,
    [profiles, selectedProfileCode],
  );

  const selectedSlabs = useMemo(
    () =>
      slabs
        .filter((slab) => slab.profileCode === selectedProfileCode)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [slabs, selectedProfileCode],
  );

  const profileStats = useMemo(
    () => ({
      totalProfiles: profiles.length,
      activeProfiles: profiles.filter((profile) => profile.isActive).length,
      totalSlabs: slabs.length,
      activeSlabs: slabs.filter((slab) => slab.isActive).length,
    }),
    [profiles, slabs],
  );

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    selectedProfileCodeRef.current = selectedProfileCode;
  }, [selectedProfileCode]);

  useEffect(() => {
    selectedSlabIdRef.current = slabDraft.id;
  }, [slabDraft.id]);

  useEffect(() => {
    selectedSlabsRef.current = selectedSlabs;
  }, [selectedSlabs]);

  const syncProfileDraft = useCallback(
    (profile: AdminDeliveryChargeProfile | null) => {
      if (!profile) {
        setProfileDraft(cloneProfileDraft(DEFAULT_PROFILE_DRAFT));
        return;
      }

      setProfileDraft({
        code: profile.code,
        name: profile.name,
        description: profile.description || "",
        isActive: profile.isActive,
        sortOrder: String(profile.sortOrder ?? 100),
        statesText: formatCommaList(profile.metadata?.states),
      });
    },
    [],
  );

  const syncSlabDraft = useCallback(
    (slab: AdminDeliveryChargeSlab | null) => {
      if (!slab) {
        setSlabDraft({
          ...cloneSlabDraft(DEFAULT_SLAB_DRAFT),
          profileCode: selectedProfileCodeRef.current || profilesRef.current[0]?.code || "",
          sortOrder: String((selectedSlabsRef.current[selectedSlabsRef.current.length - 1]?.sortOrder || 0) + 10),
        });
        return;
      }

      setSlabDraft({
        id: slab.id,
        profileCode: slab.profileCode,
        ruleKey: slab.ruleKey,
        name: slab.name,
        description: slab.description || "",
        notes: slab.notes || "",
        isActive: slab.isActive,
        sortOrder: String(slab.sortOrder ?? 100),
        calculationMode: slab.calculationMode,
        rate: String(slab.rate ?? 0),
        weightUnitKg: String(slab.weightUnitKg ?? 20),
        minWeightKg: slab.minWeightKg === null ? "" : String(slab.minWeightKg),
        minWeightInclusive: slab.minWeightInclusive,
        maxWeightKg: slab.maxWeightKg === null ? "" : String(slab.maxWeightKg),
        maxWeightInclusive: slab.maxWeightInclusive,
        minDistanceKm: slab.minDistanceKm === null ? "" : String(slab.minDistanceKm),
        minDistanceInclusive: slab.minDistanceInclusive,
        maxDistanceKm: slab.maxDistanceKm === null ? "" : String(slab.maxDistanceKm),
        maxDistanceInclusive: slab.maxDistanceInclusive,
      });
    },
    [],
  );

  const loadData = useCallback(async () => {
    const showInitialLoader = !hasLoadedRef.current;

    if (showInitialLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const [profilesResponse, slabsResponse] = await Promise.all([
        authorizedRequest<ApiResponse<{ profiles: AdminDeliveryChargeProfile[] }>>(
          "/admin/delivery-charge/profiles",
        ),
        authorizedRequest<ApiResponse<{ slabs: AdminDeliveryChargeSlab[] }>>(
          "/admin/delivery-charge/slabs?includeInactive=true",
        ),
      ]);

      const nextProfiles = profilesResponse.data.profiles;
      const nextSlabs = slabsResponse.data.slabs;
      setProfiles(nextProfiles);
      setSlabs(nextSlabs);

      const nextSelectedProfile =
        nextProfiles.find((profile) => profile.code === selectedProfileCodeRef.current) ||
        nextProfiles[0] ||
        null;

      setSelectedProfileCode(nextSelectedProfile?.code || "");
      syncProfileDraft(nextSelectedProfile);
      syncSlabDraft(
        nextSlabs.find(
          (slab) =>
            slab.profileCode === (nextSelectedProfile?.code || "") &&
            slab.id === selectedSlabIdRef.current,
        ) ||
          null,
      );

      hasLoadedRef.current = true;
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load delivery charge settings.",
      );
    } finally {
      if (showInitialLoader) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, [authorizedRequest, syncProfileDraft, syncSlabDraft]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void loadData();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [loadData]);

  useEffect(() => {
    syncProfileDraft(selectedProfile);
  }, [selectedProfile, syncProfileDraft]);

  useEffect(() => {
    if (!slabDraft.id) {
      syncSlabDraft(null);
    }
  }, [selectedProfileCode, slabDraft.id, syncSlabDraft]);

  function startNewSlab() {
    selectedSlabIdRef.current = null;
    syncSlabDraft(null);
    setMessage("");
  }

  function selectSlab(slab: AdminDeliveryChargeSlab) {
    setSelectedProfileCode(slab.profileCode);
    selectedProfileCodeRef.current = slab.profileCode;
    selectedSlabIdRef.current = slab.id;
    setMessage("");
    syncSlabDraft(slab);
  }

  async function saveProfile() {
    if (!selectedProfile) {
      window.alert("Select a delivery charge profile first.");
      return;
    }

    if (!profileDraft.name.trim()) {
      window.alert("Profile name is required.");
      return;
    }

    setSavingProfile(true);
    setError("");
    setMessage("");

    try {
      await authorizedRequest(`/admin/delivery-charge/profiles/${selectedProfile.code}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: profileDraft.name.trim(),
          description: profileDraft.description.trim(),
          isActive: profileDraft.isActive,
          sortOrder: Number(profileDraft.sortOrder || 100),
          metadata: {
            states: normalizeCommaList(profileDraft.statesText),
          },
        }),
      });

      showAdminSnackbar({
        tone: "success",
        title: "Profile updated",
        body: `${selectedProfile.name} was saved successfully.`,
      });
      await loadData();
    } catch (nextError) {
      showAdminSnackbar({
        tone: "error",
        title: "Profile update failed",
        body: nextError instanceof Error ? nextError.message : "Unable to update profile.",
      });
      setError(nextError instanceof Error ? nextError.message : "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveSlab() {
    if (!slabDraft.profileCode) {
      window.alert("Choose a delivery profile first.");
      return;
    }

    if (!slabDraft.ruleKey.trim() || !slabDraft.name.trim()) {
      window.alert("Rule key and slab name are required.");
      return;
    }

    setSavingSlab(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        profileCode: slabDraft.profileCode,
        ruleKey: slabDraft.ruleKey.trim(),
        name: slabDraft.name.trim(),
        description: slabDraft.description.trim(),
        notes: slabDraft.notes.trim(),
        isActive: slabDraft.isActive,
        sortOrder: Number(slabDraft.sortOrder || 100),
        calculationMode: slabDraft.calculationMode,
        rate: Number(slabDraft.rate || 0),
        weightUnitKg: Number(slabDraft.weightUnitKg || 20),
        minWeightKg: parseNumberOrNull(slabDraft.minWeightKg),
        minWeightInclusive: slabDraft.minWeightInclusive,
        maxWeightKg: parseNumberOrNull(slabDraft.maxWeightKg),
        maxWeightInclusive: slabDraft.maxWeightInclusive,
        minDistanceKm: parseNumberOrNull(slabDraft.minDistanceKm),
        minDistanceInclusive: slabDraft.minDistanceInclusive,
        maxDistanceKm: parseNumberOrNull(slabDraft.maxDistanceKm),
        maxDistanceInclusive: slabDraft.maxDistanceInclusive,
      };

      await authorizedRequest(
        slabDraft.id ? `/admin/delivery-charge/slabs/${slabDraft.id}` : "/admin/delivery-charge/slabs",
        {
          method: slabDraft.id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      showAdminSnackbar({
        tone: "success",
        title: slabDraft.id ? "Slab updated" : "Slab created",
        body: `${slabDraft.name} was saved successfully.`,
      });
      await loadData();
      startNewSlab();
    } catch (nextError) {
      showAdminSnackbar({
        tone: "error",
        title: slabDraft.id ? "Slab update failed" : "Slab create failed",
        body: nextError instanceof Error ? nextError.message : "Unable to save slab.",
      });
      setError(nextError instanceof Error ? nextError.message : "Unable to save slab.");
    } finally {
      setSavingSlab(false);
    }
  }

  async function deleteSlab(slab: AdminDeliveryChargeSlab) {
    if (!window.confirm(`Delete slab "${slab.name}"?`)) {
      return;
    }

    setDeletingSlabId(slab.id);
    setError("");
    setMessage("");

    try {
      await authorizedRequest(`/admin/delivery-charge/slabs/${slab.id}`, {
        method: "DELETE",
      });

      if (slabDraft.id === slab.id) {
        startNewSlab();
      }

      showAdminSnackbar({
        tone: "success",
        title: "Slab deleted",
        body: `${slab.name} was removed successfully.`,
      });
      await loadData();
    } catch (nextError) {
      showAdminSnackbar({
        tone: "error",
        title: "Delete failed",
        body: nextError instanceof Error ? nextError.message : "Unable to delete slab.",
      });
      setError(nextError instanceof Error ? nextError.message : "Unable to delete slab.");
    } finally {
      setDeletingSlabId("");
    }
  }

  async function moveSlab(slab: AdminDeliveryChargeSlab, direction: "up" | "down") {
    const index = selectedSlabs.findIndex((item) => item.id === slab.id);
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    const neighbor = selectedSlabs[neighborIndex];

    if (!neighbor) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await authorizedRequest(`/admin/delivery-charge/slabs/${slab.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sortOrder: neighbor.sortOrder }),
      });
      await authorizedRequest(`/admin/delivery-charge/slabs/${neighbor.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sortOrder: slab.sortOrder }),
      });
      await loadData();
      showAdminSnackbar({
        tone: "info",
        title: "Slab reordered",
        body: `${slab.name} moved ${direction}.`,
      });
    } catch (nextError) {
      showAdminSnackbar({
        tone: "error",
        title: "Reorder failed",
        body: nextError instanceof Error ? nextError.message : "Unable to reorder slab.",
      });
      setError(nextError instanceof Error ? nextError.message : "Unable to reorder slab.");
    }
  }

  const conditionPreview = useMemo(() => {
    if (!slabDraft.ruleKey.trim() && !slabDraft.name.trim()) {
      return "Fill out the slab form to preview its matching logic.";
    }

    const parts: string[] = [];
    if (slabDraft.minWeightKg || slabDraft.maxWeightKg) {
      parts.push(
        `Weight ${slabDraft.minWeightKg ? `${slabDraft.minWeightInclusive ? ">=" : ">"} ${slabDraft.minWeightKg} kg` : ""}${
          slabDraft.minWeightKg && slabDraft.maxWeightKg ? " and " : ""
        }${slabDraft.maxWeightKg ? `${slabDraft.maxWeightInclusive ? "<=" : "<"} ${slabDraft.maxWeightKg} kg` : ""}`.trim(),
      );
    }
    if (slabDraft.minDistanceKm || slabDraft.maxDistanceKm) {
      parts.push(
        `Distance ${slabDraft.minDistanceKm ? `${slabDraft.minDistanceInclusive ? ">=" : ">"} ${slabDraft.minDistanceKm} km` : ""}${
          slabDraft.minDistanceKm && slabDraft.maxDistanceKm ? " and " : ""
        }${slabDraft.maxDistanceKm ? `${slabDraft.maxDistanceInclusive ? "<=" : "<"} ${slabDraft.maxDistanceKm} km` : ""}`.trim(),
      );
    }
    parts.push(`${CALCULATION_MODE_LABELS[slabDraft.calculationMode]} charge`);
    return parts.join(", ");
  }, [slabDraft]);

  if (loading && !hasLoadedRef.current) {
    return <AdminLoadingCard label="Loading delivery charge settings..." />;
  }

  if (error && !profiles.length) {
    return <AdminErrorCard message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Shipping Control"
        title="Delivery Charges"
        description="Manage ordered slabs for Pan India and North East delivery charges from one place."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <AdminPill>{profileStats.totalProfiles} profiles</AdminPill>
        <AdminPill>{profileStats.activeProfiles} active profiles</AdminPill>
        <AdminPill>{profileStats.totalSlabs} slabs</AdminPill>
        <AdminPill>{profileStats.activeSlabs} active slabs</AdminPill>
      </div>

      <div className="flex flex-wrap gap-2">
        {profiles.map((profile) => (
          <button
            key={profile.code}
            type="button"
            onClick={() => {
              setSelectedProfileCode(profile.code);
              selectedProfileCodeRef.current = profile.code;
              selectedSlabIdRef.current = null;
              syncProfileDraft(profile);
              syncSlabDraft(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selectedProfileCode === profile.code
                ? "bg-[var(--admin-accent)] text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-[var(--admin-chip)]"
            }`}
          >
            {profile.name}
          </button>
        ))}
        <AdminActionButton type="button" tone="secondary" onClick={() => void loadData()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {refreshing ? "Refreshing..." : "Refresh"}
        </AdminActionButton>
      </div>

      {message ? (
        <div className="rounded-2xl border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-ink)]">
          {message}
        </div>
      ) : null}

      {error ? <AdminErrorCard message={error} onRetry={loadData} /> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <AdminPanel className="space-y-4 xl:col-span-1">
          <AdminSectionTitle
            title="Profile settings"
            description="Edit the label and state mapping for the current delivery profile."
          />

          {selectedProfile ? (
            <div className="space-y-4">
              <AdminInfoList
                items={[
                  { label: "Profile code", value: selectedProfile.code },
                  { label: "Current slabs", value: selectedSlabs.length },
                  { label: "Status", value: <AdminStatusPill status={selectedProfile.isActive ? "active" : "inactive"} /> },
                ]}
              />

              <AdminTextInput
                value={profileDraft.name}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Profile name"
              />
              <AdminTextarea
                value={profileDraft.description}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Profile description"
              />
              <AdminTextInput
                value={profileDraft.sortOrder}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, sortOrder: event.target.value }))
                }
                type="number"
                placeholder="Sort order"
              />
              <AdminTextInput
                value={profileDraft.statesText}
                onChange={(event) =>
                  setProfileDraft((current) => ({ ...current, statesText: event.target.value }))
                }
                placeholder="Comma-separated states"
              />
              <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--admin-ink)]">Active</span>
                <input
                  type="checkbox"
                  checked={profileDraft.isActive}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  className="h-5 w-5 accent-[var(--admin-accent)]"
                />
              </label>

              <AdminActionButton
                type="button"
                tone="primary"
                onClick={() => void saveProfile()}
                disabled={savingProfile}
              >
                <Save className="mr-2 h-4 w-4" />
                {savingProfile ? "Saving..." : "Save profile"}
              </AdminActionButton>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-6 text-sm text-[var(--admin-muted)]">
              No delivery profile found.
            </div>
          )}
        </AdminPanel>

        <AdminPanel className="space-y-4 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AdminSectionTitle
              title={`${selectedProfile?.name || "Delivery"} slabs`}
              description="Create, edit, delete, and reposition slabs with ordered sort values."
            />
            <div className="flex flex-wrap gap-2">
              <AdminActionButton type="button" tone="secondary" onClick={startNewSlab}>
                <CopyPlus className="mr-2 h-4 w-4" />
                New slab
              </AdminActionButton>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {selectedSlabs.map((slab, index) => (
                <div
                  key={slab.id}
                  className={`rounded-2xl border p-4 transition ${
                    slabDraft.id === slab.id
                      ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]"
                      : "border-[#e7e7e7] bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                        {CALCULATION_MODE_LABELS[slab.calculationMode]}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-[var(--admin-ink)]">
                        {slab.name}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                        {buildSlabSummary(slab)}
                      </p>
                    </div>
                    <AdminStatusPill status={slab.isActive ? "active" : "disabled"} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <AdminPill>Sort {slab.sortOrder}</AdminPill>
                    <AdminPill>{slab.ruleKey}</AdminPill>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => selectSlab(slab)}
                      className="rounded-full bg-[var(--admin-chip)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-ink)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveSlab(slab, "up")}
                      disabled={index === 0}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)] disabled:opacity-50"
                    >
                      <ArrowUp className="mr-1 inline h-3.5 w-3.5" />
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveSlab(slab, "down")}
                      disabled={index === selectedSlabs.length - 1}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)] disabled:opacity-50"
                    >
                      <ArrowDown className="mr-1 inline h-3.5 w-3.5" />
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSlab(slab)}
                      disabled={deletingSlabId === slab.id}
                      className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
                    >
                      <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 rounded-3xl border border-[#e7e7e7] p-4">
              <AdminSectionTitle
                title={slabDraft.id ? "Edit slab" : "Create slab"}
                description={conditionPreview}
              />

              <div className="grid gap-3">
                <AdminSelect
                  value={slabDraft.profileCode}
                  onChange={(event) =>
                    setSlabDraft((current) => ({ ...current, profileCode: event.target.value }))
                  }
                >
                  <option value="">Select profile</option>
                  {profiles.map((profile) => (
                    <option key={profile.code} value={profile.code}>
                      {profile.name}
                    </option>
                  ))}
                </AdminSelect>
                <AdminTextInput
                  value={slabDraft.ruleKey}
                  onChange={(event) =>
                    setSlabDraft((current) => ({ ...current, ruleKey: event.target.value }))
                  }
                  placeholder="Rule key"
                />
                <AdminTextInput
                  value={slabDraft.name}
                  onChange={(event) =>
                    setSlabDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Slab name"
                />
                <AdminTextarea
                  value={slabDraft.description}
                  onChange={(event) =>
                    setSlabDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Description"
                />
                <AdminTextarea
                  value={slabDraft.notes}
                  onChange={(event) =>
                    setSlabDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Internal notes"
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <AdminSelect
                    value={slabDraft.calculationMode}
                    onChange={(event) =>
                      setSlabDraft((current) => ({
                        ...current,
                        calculationMode: event.target.value as AdminDeliveryChargeSlabCalculationMode,
                      }))
                    }
                  >
                    <option value="per_distance">Per distance</option>
                    <option value="per_weight_unit">Per weight unit</option>
                    <option value="flat">Flat</option>
                  </AdminSelect>
                  <AdminTextInput
                    type="number"
                    value={slabDraft.rate}
                    onChange={(event) =>
                      setSlabDraft((current) => ({ ...current, rate: event.target.value }))
                    }
                    placeholder="Rate"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <AdminTextInput
                    type="number"
                    value={slabDraft.weightUnitKg}
                    onChange={(event) =>
                      setSlabDraft((current) => ({ ...current, weightUnitKg: event.target.value }))
                    }
                    placeholder="Weight unit kg"
                  />
                  <AdminTextInput
                    type="number"
                    value={slabDraft.sortOrder}
                    onChange={(event) =>
                      setSlabDraft((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                    placeholder="Sort order"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <AdminTextInput
                    type="number"
                    value={slabDraft.minWeightKg}
                    onChange={(event) =>
                      setSlabDraft((current) => ({ ...current, minWeightKg: event.target.value }))
                    }
                    placeholder="Min weight kg"
                  />
                  <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-[var(--admin-ink)]">Min inclusive</span>
                    <input
                      type="checkbox"
                      checked={slabDraft.minWeightInclusive}
                      onChange={(event) =>
                        setSlabDraft((current) => ({
                          ...current,
                          minWeightInclusive: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 accent-[var(--admin-accent)]"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <AdminTextInput
                    type="number"
                    value={slabDraft.maxWeightKg}
                    onChange={(event) =>
                      setSlabDraft((current) => ({ ...current, maxWeightKg: event.target.value }))
                    }
                    placeholder="Max weight kg"
                  />
                  <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-[var(--admin-ink)]">Max inclusive</span>
                    <input
                      type="checkbox"
                      checked={slabDraft.maxWeightInclusive}
                      onChange={(event) =>
                        setSlabDraft((current) => ({
                          ...current,
                          maxWeightInclusive: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 accent-[var(--admin-accent)]"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <AdminTextInput
                    type="number"
                    value={slabDraft.minDistanceKm}
                    onChange={(event) =>
                      setSlabDraft((current) => ({ ...current, minDistanceKm: event.target.value }))
                    }
                    placeholder="Min distance km"
                  />
                  <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-[var(--admin-ink)]">Min distance inclusive</span>
                    <input
                      type="checkbox"
                      checked={slabDraft.minDistanceInclusive}
                      onChange={(event) =>
                        setSlabDraft((current) => ({
                          ...current,
                          minDistanceInclusive: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 accent-[var(--admin-accent)]"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <AdminTextInput
                    type="number"
                    value={slabDraft.maxDistanceKm}
                    onChange={(event) =>
                      setSlabDraft((current) => ({ ...current, maxDistanceKm: event.target.value }))
                    }
                    placeholder="Max distance km"
                  />
                  <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-[var(--admin-ink)]">Max distance inclusive</span>
                    <input
                      type="checkbox"
                      checked={slabDraft.maxDistanceInclusive}
                      onChange={(event) =>
                        setSlabDraft((current) => ({
                          ...current,
                          maxDistanceInclusive: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 accent-[var(--admin-accent)]"
                    />
                  </label>
                </div>

                <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-white px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--admin-ink)]">Active</span>
                  <input
                    type="checkbox"
                    checked={slabDraft.isActive}
                    onChange={(event) =>
                      setSlabDraft((current) => ({ ...current, isActive: event.target.checked }))
                    }
                    className="h-5 w-5 accent-[var(--admin-accent)]"
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <AdminActionButton
                    type="button"
                    tone="primary"
                    onClick={() => void saveSlab()}
                    disabled={savingSlab}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingSlab ? "Saving..." : slabDraft.id ? "Update slab" : "Create slab"}
                  </AdminActionButton>
                  <AdminActionButton type="button" tone="secondary" onClick={startNewSlab}>
                    New draft
                  </AdminActionButton>
                </div>
              </div>
            </div>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}

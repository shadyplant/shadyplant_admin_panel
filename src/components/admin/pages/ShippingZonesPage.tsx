"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  DrawingManager,
  GoogleMap,
  Marker,
  Polygon,
  useJsApiLoader,
} from "@react-google-maps/api";
import { MapPinned, Plus, RefreshCw, Route } from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  AdminErrorCard,
  AdminLoadingCard,
} from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminPill,
  AdminSelect,
  AdminStatusPill,
  AdminTextarea,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type {
  AdminShippingZone,
  AdminShippingZonePoint,
  ApiResponse,
} from "@/lib/admin-api";

type ShippingZoneDraft = {
  name: string;
  zoneType: "service" | "restriction";
  description: string;
  notes: string;
  isActive: boolean;
  fillColor: string;
  strokeColor: string;
  opacity: string;
  polygon: AdminShippingZonePoint[];
};

const MAP_LIBRARIES: ("drawing" | "places")[] = ["drawing", "places"];
const DEFAULT_CENTER = {
  lat: 26.327975,
  lng: 90.838204,
};

const EMPTY_DRAFT: ShippingZoneDraft = {
  name: "",
  zoneType: "restriction",
  description: "",
  notes: "",
  isActive: true,
  fillColor: "#dc2626",
  strokeColor: "#991b1b",
  opacity: "0.28",
  polygon: [],
};

const SERVICE_COLORS = {
  fill: "#16a34a",
  stroke: "#166534",
};

const RESTRICTION_COLORS = {
  fill: "#dc2626",
  stroke: "#991b1b",
};

function cloneDraft(draft: ShippingZoneDraft): ShippingZoneDraft {
  return {
    ...draft,
    polygon: draft.polygon.map((point) => ({ ...point })),
  };
}

function zoneToDraft(zone: AdminShippingZone): ShippingZoneDraft {
  return {
    name: zone.name,
    zoneType: zone.zoneType,
    description: zone.description,
    notes: zone.notes,
    isActive: zone.isActive,
    fillColor: zone.fillColor || (zone.zoneType === "service" ? SERVICE_COLORS.fill : RESTRICTION_COLORS.fill),
    strokeColor:
      zone.strokeColor ||
      (zone.zoneType === "service" ? SERVICE_COLORS.stroke : RESTRICTION_COLORS.stroke),
    opacity: String(zone.opacity ?? 0.28),
    polygon: zone.polygon.map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })),
  };
}

function draftToPayload(draft: ShippingZoneDraft) {
  return {
    name: draft.name.trim(),
    zoneType: draft.zoneType,
    description: draft.description.trim(),
    notes: draft.notes.trim(),
    isActive: draft.isActive,
    fillColor: draft.fillColor.trim(),
    strokeColor: draft.strokeColor.trim(),
    opacity: Number(draft.opacity),
    vertices: draft.polygon.map((point) => ({
      lat: Number(point.lat),
      lng: Number(point.lng),
    })),
  };
}

function polygonToPath(polygon: AdminShippingZonePoint[] = []) {
  return polygon.map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }));
}

function readPolygonPath(polygon: google.maps.Polygon | null) {
  if (!polygon) {
    return [];
  }

  return polygon
    .getPath()
    .getArray()
    .map((latLng) => ({
      lat: latLng.lat(),
      lng: latLng.lng(),
    }));
}

function getZoneTone(zoneType: "service" | "restriction") {
  return zoneType === "service" ? "service" : "restriction";
}

export default function ShippingZonesPage() {
  const { authorizedRequest } = useAdminAuth();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: MAP_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRefs = useRef<Record<string, google.maps.Polygon | null>>({});
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [zones, setZones] = useState<AdminShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShippingZoneDraft>(cloneDraft(EMPTY_DRAFT));
  const [searchValue, setSearchValue] = useState("");
  const [drawingEnabled, setDrawingEnabled] = useState(false);

  const activeZone = useMemo(
    () => zones.find((zone) => zone.id === activeZoneId) || null,
    [activeZoneId, zones],
  );

  const filteredZones = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return zones;
    }

    return zones.filter((zone) =>
      [
        zone.name,
        zone.zoneType,
        zone.description,
        zone.notes,
        zone.isActive ? "active" : "inactive",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, zones]);

  const mapPolygons = useMemo(
    () =>
      filteredZones.map((zone) => ({
        ...zone,
        path: polygonToPath(zone.polygon),
      })),
    [filteredZones],
  );

  const totalServiceZones = zones.filter((zone) => zone.zoneType === "service").length;
  const totalRestrictionZones = zones.filter((zone) => zone.zoneType === "restriction").length;
  const polygonDrawingMode =
    typeof window !== "undefined"
      ? window.google?.maps?.drawing?.OverlayType?.POLYGON || null
      : null;

  async function syncZones() {
    setLoading(true);
    setError(null);

    try {
      const response = await authorizedRequest<ApiResponse<{ zones: AdminShippingZone[] }>>(
        "/admin/shipping-zones",
      );
      setZones(response.data.zones);
      const nextActiveZone =
        response.data.zones.find((zone) => zone.id === activeZoneId) ||
        response.data.zones[0] ||
        null;

      if (nextActiveZone) {
        if (!activeZoneId) {
          setActiveZoneId(nextActiveZone.id);
        }

        setDraft(zoneToDraft(nextActiveZone));
      } else {
        setActiveZoneId(null);
        setDraft(cloneDraft(EMPTY_DRAFT));
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load shipping zones.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadZones() {
      setLoading(true);
      setError(null);

      try {
        const response = await authorizedRequest<ApiResponse<{ zones: AdminShippingZone[] }>>(
          "/admin/shipping-zones",
        );

        if (cancelled) {
          return;
        }

        setZones(response.data.zones);

        if (response.data.zones.length) {
          const nextZone = response.data.zones[0];
          setActiveZoneId(nextZone.id);
          setDraft(zoneToDraft(nextZone));
        } else {
          setActiveZoneId(null);
          setDraft(cloneDraft(EMPTY_DRAFT));
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : "Unable to load shipping zones.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadZones();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  const centerMapOnZone = (zone: AdminShippingZone) => {
    if (!mapRef.current || !zone.polygon.length) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    zone.polygon.forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds, 72);
  };

  const handleMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    if (activeZone) {
      centerMapOnZone(activeZone);
    }
  };

  const handleZoneSelect = (zone: AdminShippingZone) => {
    setActiveZoneId(zone.id);
    setDraft(zoneToDraft(zone));
    setDrawingEnabled(false);
    centerMapOnZone(zone);
  };

  const handleNewZone = () => {
    setActiveZoneId(null);
    setDraft(cloneDraft(EMPTY_DRAFT));
    setDrawingEnabled(true);
  };

  const handlePolygonComplete = (polygon: google.maps.Polygon) => {
    const path = readPolygonPath(polygon);
    setDraft((current) => ({
      ...current,
      polygon: path,
    }));
    setDrawingEnabled(false);
    polygon.setMap(null);
  };

  const handlePolygonEdit = (zoneId: string) => {
    const polygon = polygonRefs.current[zoneId];
    if (!polygon) {
      return;
    }

    const path = readPolygonPath(polygon);
    if (zoneId === activeZoneId) {
      setDraft((current) => ({
        ...current,
        polygon: path,
      }));
    }
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      window.alert("Zone name is required.");
      return;
    }

    if (draft.polygon.length < 3) {
      window.alert("Draw a polygon with at least three points.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = draftToPayload(draft);
      const response = await authorizedRequest<ApiResponse<{ zone: AdminShippingZone }>>(
        activeZoneId ? `/admin/shipping-zones/${activeZoneId}` : "/admin/shipping-zones",
        {
          method: activeZoneId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      const nextZone = response.data.zone;
      setZones((currentZones) => {
        const nextZones = currentZones.filter((zone) => zone.id !== nextZone.id);
        return [nextZone, ...nextZones].sort(
          (left, right) =>
            new Date(right.updatedAt || right.createdAt || 0).getTime() -
            new Date(left.updatedAt || left.createdAt || 0).getTime(),
        );
      });
      setActiveZoneId(nextZone.id);
      setDraft(zoneToDraft(nextZone));
      setDrawingEnabled(false);
      centerMapOnZone(nextZone);
    } catch (nextError) {
      window.alert(
        nextError instanceof Error ? nextError.message : "Unable to save shipping zone.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (zone: AdminShippingZone) => {
    if (!window.confirm(`Delete zone "${zone.name}"?`)) {
      return;
    }

    setDeletingZoneId(zone.id);

    try {
      await authorizedRequest(`/admin/shipping-zones/${zone.id}`, {
        method: "DELETE",
      });
      await syncZones();
    } catch (nextError) {
      window.alert(
        nextError instanceof Error ? nextError.message : "Unable to delete shipping zone.",
      );
    } finally {
      setDeletingZoneId(null);
    }
  };

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) {
      return;
    }

    const nextPosition = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    mapRef.current?.panTo(nextPosition);
    mapRef.current?.setZoom(13);
  };

  if (loading) {
    return <AdminLoadingCard label="Loading shipping zones..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={syncZones} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Shipping Control"
        title="Shipping Zones"
        description="Draw service and restriction polygons on the map, then manage them from one workspace."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <AdminPanel className="space-y-4 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                Zones
              </p>
              <p className="text-sm font-semibold text-[var(--admin-ink)]">
                {zones.length} total records
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <AdminPill>{totalServiceZones} service</AdminPill>
            <AdminPill>{totalRestrictionZones} restriction</AdminPill>
            <AdminPill>{zones.filter((zone) => zone.isActive).length} active</AdminPill>
            <AdminPill>{zones.filter((zone) => !zone.isActive).length} inactive</AdminPill>
          </div>

          <div className="space-y-3">
            <AdminActionButton type="button" tone="primary" onClick={handleNewZone}>
              <Plus className="mr-2 h-4 w-4" />
              New zone
            </AdminActionButton>
            <AdminActionButton type="button" tone="secondary" onClick={() => void syncZones()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </AdminActionButton>
          </div>

          <AdminTextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search zones"
          />

          <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
            {filteredZones.length ? (
              filteredZones.map((zone) => {
                const active = zone.id === activeZoneId;

                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => handleZoneSelect(zone)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      active
                        ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]"
                        : "border-[var(--admin-line)] bg-white hover:bg-[var(--admin-chip)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                          {getZoneTone(zone.zoneType)}
                        </p>
                        <h3 className="mt-1 text-sm font-black text-[var(--admin-ink)]">
                          {zone.name}
                        </h3>
                        <p className="mt-1 text-xs text-[var(--admin-muted)]">
                          {zone.pointCount} points
                        </p>
                      </div>
                      <AdminStatusPill status={zone.isActive ? "active" : "disabled"} />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--admin-line)] bg-white px-4 py-6 text-sm text-[var(--admin-muted)]">
                No zones found.
              </div>
            )}
          </div>
        </AdminPanel>

        <AdminPanel className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                Map editor
              </p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                {activeZone ? activeZone.name : "Create a new zone"}
              </h2>
            </div>
            <AdminPill>{drawingEnabled ? "Drawing mode on" : "Selection mode"}</AdminPill>
          </div>

          <div className="space-y-3">
            <Autocomplete onLoad={(ref) => (autocompleteRef.current = ref)} onPlaceChanged={handlePlaceChanged}>
              <AdminTextInput
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search an area or pin the map"
              />
            </Autocomplete>

            <div className="overflow-hidden rounded-3xl border border-[var(--admin-line)]">
              {isLoaded && !loadError && polygonDrawingMode ? (
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "680px" }}
                  center={DEFAULT_CENTER}
                  zoom={11}
                  onLoad={handleMapLoad}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    clickableIcons: false,
                  }}
                >
                  {drawingEnabled ? (
                    <DrawingManager
                      drawingMode={polygonDrawingMode ?? undefined}
                      onPolygonComplete={handlePolygonComplete}
                      options={{
                        drawingControl: false,
                        polygonOptions: {
                          editable: true,
                          draggable: false,
                          fillColor:
                            draft.zoneType === "service"
                              ? SERVICE_COLORS.fill
                              : RESTRICTION_COLORS.fill,
                          strokeColor:
                            draft.zoneType === "service"
                              ? SERVICE_COLORS.stroke
                              : RESTRICTION_COLORS.stroke,
                          fillOpacity: Number(draft.opacity || 0.28),
                          strokeOpacity: 0.9,
                          strokeWeight: 2,
                        },
                      }}
                    />
                  ) : null}

                  {mapPolygons.map((zone) => (
                    <Polygon
                      key={zone.id}
                      paths={zone.path}
                      options={{
                        clickable: true,
                        editable: zone.id === activeZoneId,
                        draggable: zone.id === activeZoneId,
                        fillColor: zone.fillColor || (zone.zoneType === "service" ? SERVICE_COLORS.fill : RESTRICTION_COLORS.fill),
                        strokeColor:
                          zone.strokeColor ||
                          (zone.zoneType === "service" ? SERVICE_COLORS.stroke : RESTRICTION_COLORS.stroke),
                        fillOpacity: zone.opacity ?? 0.28,
                        strokeOpacity: 0.92,
                        strokeWeight: zone.id === activeZoneId ? 3 : 2,
                      }}
                      onLoad={(polygon) => {
                        polygonRefs.current[zone.id] = polygon;
                      }}
                      onUnmount={() => {
                        delete polygonRefs.current[zone.id];
                      }}
                      onClick={() => handleZoneSelect(zone)}
                      onMouseUp={() => handlePolygonEdit(zone.id)}
                      onDragEnd={() => handlePolygonEdit(zone.id)}
                    />
                  ))}

                  {draft.polygon[0] ? <Marker position={draft.polygon[0]} /> : null}
                </GoogleMap>
              ) : (
                <div className="flex min-h-[680px] items-center justify-center bg-[var(--admin-chip)] px-8 text-center text-sm text-[var(--admin-muted)]">
                  {loadError
                    ? "Google Maps failed to load. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in the admin panel env."
                    : isLoaded
                      ? "Google Maps drawing tools are still loading. Please wait a moment and try again."
                      : "Google Maps is loading for the shipping zone editor."}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <AdminPanel className="bg-[var(--admin-chip)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  Selected points
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--admin-ink)]">
                  {draft.polygon.length}
                </p>
              </AdminPanel>
              <AdminPanel className="bg-[var(--admin-chip)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  Mode
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--admin-ink)]">
                  {activeZone ? "Editing" : "Creating"}
                </p>
              </AdminPanel>
              <AdminPanel className="bg-[var(--admin-chip)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  Area type
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--admin-ink)]">
                  {draft.zoneType === "service" ? "Service" : "Restriction"}
                </p>
              </AdminPanel>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className="space-y-4 lg:col-span-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
              Zone details
            </p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
              {activeZone ? "Update zone" : "Create zone"}
            </h2>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Name
              </span>
              <AdminTextInput
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Assam service area"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Zone type
              </span>
              <AdminSelect
                value={draft.zoneType}
                onChange={(event) => {
                  const nextType = event.target.value as "service" | "restriction";
                  setDraft((current) => ({
                    ...current,
                    zoneType: nextType,
                    fillColor:
                      nextType === "service"
                        ? current.fillColor || SERVICE_COLORS.fill
                        : current.fillColor || RESTRICTION_COLORS.fill,
                    strokeColor:
                      nextType === "service"
                        ? current.strokeColor || SERVICE_COLORS.stroke
                        : current.strokeColor || RESTRICTION_COLORS.stroke,
                  }));
                }}
              >
                <option value="service">Service area</option>
                <option value="restriction">Restriction area</option>
              </AdminSelect>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Description
              </span>
              <AdminTextarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Internal description for the team"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Notes
              </span>
              <AdminTextarea
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Courier note, landmark, or operational context"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                  Fill color
                </span>
                <AdminTextInput
                  type="color"
                  value={draft.fillColor}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, fillColor: event.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                  Stroke color
                </span>
                <AdminTextInput
                  type="color"
                  value={draft.strokeColor}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, strokeColor: event.target.value }))
                  }
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Opacity
              </span>
              <AdminTextInput
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={draft.opacity}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, opacity: event.target.value }))
                }
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--admin-ink)]">
                Active zone
              </span>
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, isActive: event.target.checked }))
                }
                className="h-5 w-5 accent-[var(--admin-accent)]"
              />
            </label>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Polygon
              </p>
              <div className="rounded-2xl border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-muted)]">
                {draft.polygon.length >= 3
                  ? `${draft.polygon.length} points selected on the map.`
                  : "Draw a polygon on the map to define this zone."}
              </div>
              <div className="flex gap-3">
                <AdminActionButton
                  type="button"
                  tone="secondary"
                  onClick={() => {
                    setActiveZoneId(null);
                    setDraft((current) => ({ ...current, polygon: [] }));
                    setDrawingEnabled(true);
                  }}
                >
                  <Route className="mr-2 h-4 w-4" />
                  Draw / Redraw
                </AdminActionButton>
                <AdminActionButton
                  type="button"
                  tone="secondary"
                  onClick={() => setDraft((current) => ({ ...current, polygon: [] }))}
                >
                  Clear
                </AdminActionButton>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <AdminActionButton type="button" tone="primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving..." : activeZone ? "Update zone" : "Create zone"}
              </AdminActionButton>
              {activeZone ? (
                <AdminActionButton
                  type="button"
                  tone="danger"
                  onClick={() => void handleDelete(activeZone)}
                  disabled={deletingZoneId === activeZone.id}
                >
                  {deletingZoneId === activeZone.id ? "Deleting..." : "Delete"}
                </AdminActionButton>
              ) : null}
            </div>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}

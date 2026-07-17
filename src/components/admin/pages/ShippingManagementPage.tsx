"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
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
  AdminShippingCountry,
  AdminShippingRegion,
  AdminShippingRule,
  AdminShippingRuleType,
  AdminShippingState,
  ApiResponse,
} from "@/lib/admin-api";

type Section = "countries" | "states" | "regions" | "rules";

type CountryDraft = {
  id: string | null;
  iso2: string;
  iso3: string;
  name: string;
  isActive: boolean;
};

type StateDraft = {
  id: string | null;
  countryId: string;
  code: string;
  name: string;
  isActive: boolean;
};

type RegionDraft = {
  id: string | null;
  stateId: string;
  defaultService: boolean;
  isActive: boolean;
};

type RuleDraft = {
  id: string | null;
  shippingRegionId: string;
  action: "ALLOW" | "BLOCK";
  ruleType: AdminShippingRuleType;
  pin: string;
  startPin: string;
  endPin: string;
  reason: string;
};

const DEFAULT_COUNTRY_DRAFT: CountryDraft = {
  id: null,
  iso2: "",
  iso3: "",
  name: "",
  isActive: true,
};

const DEFAULT_STATE_DRAFT: StateDraft = {
  id: null,
  countryId: "",
  code: "",
  name: "",
  isActive: true,
};

const DEFAULT_REGION_DRAFT: RegionDraft = {
  id: null,
  stateId: "",
  defaultService: true,
  isActive: true,
};

const DEFAULT_RULE_DRAFT: RuleDraft = {
  id: null,
  shippingRegionId: "",
  action: "BLOCK",
  ruleType: "PIN",
  pin: "",
  startPin: "",
  endPin: "",
  reason: "",
};

const SECTION_LABELS: Record<Section, string> = {
  countries: "Countries",
  regions: "Regions",
  rules: "Rules",
  states: "States",
};

function cloneCountryDraft(draft: CountryDraft): CountryDraft {
  return { ...draft };
}

function cloneStateDraft(draft: StateDraft): StateDraft {
  return { ...draft };
}

function cloneRegionDraft(draft: RegionDraft): RegionDraft {
  return { ...draft };
}

function cloneRuleDraft(draft: RuleDraft): RuleDraft {
  return { ...draft };
}

function getRuleValue(rule: AdminShippingRule) {
  if (rule.ruleType === "PIN") {
    return rule.pin;
  }

  if (rule.ruleType === "PIN_RANGE") {
    return `${rule.startPin} - ${rule.endPin}`;
  }

  return rule.reason || "-";
}

export default function ShippingManagementPage() {
  const { authorizedRequest } = useAdminAuth();
  const [activeSection, setActiveSection] = useState<Section>("rules");
  const [countries, setCountries] = useState<AdminShippingCountry[]>([]);
  const [states, setStates] = useState<AdminShippingState[]>([]);
  const [regions, setRegions] = useState<AdminShippingRegion[]>([]);
  const [rules, setRules] = useState<AdminShippingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countryDraft, setCountryDraft] = useState<CountryDraft>(cloneCountryDraft(DEFAULT_COUNTRY_DRAFT));
  const [stateDraft, setStateDraft] = useState<StateDraft>(cloneStateDraft(DEFAULT_STATE_DRAFT));
  const [regionDraft, setRegionDraft] = useState<RegionDraft>(cloneRegionDraft(DEFAULT_REGION_DRAFT));
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(cloneRuleDraft(DEFAULT_RULE_DRAFT));

  const countryById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries],
  );
  const stateById = useMemo(
    () => new Map(states.map((state) => [state.id, state])),
    [states],
  );
  const regionById = useMemo(
    () => new Map(regions.map((region) => [region.id, region])),
    [regions],
  );

  const totals = {
    countries: countries.length,
    states: states.length,
    regions: regions.length,
    rules: rules.length,
    activeCountries: countries.filter((country) => country.isActive).length,
    activeStates: states.filter((state) => state.isActive).length,
    activeRegions: regions.filter((region) => region.isActive).length,
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [countriesResponse, statesResponse, regionsResponse, rulesResponse] =
        await Promise.all([
          authorizedRequest<ApiResponse<{ countries: AdminShippingCountry[] }>>(
            "/admin/shipping/countries",
          ),
          authorizedRequest<ApiResponse<{ states: AdminShippingState[] }>>(
            "/admin/shipping/states",
          ),
          authorizedRequest<ApiResponse<{ regions: AdminShippingRegion[] }>>(
            "/admin/shipping/regions",
          ),
          authorizedRequest<ApiResponse<{ rules: AdminShippingRule[] }>>(
            "/admin/shipping/rules",
          ),
        ]);

      setCountries(countriesResponse.data.countries);
      setStates(statesResponse.data.states);
      setRegions(regionsResponse.data.regions);
      setRules(rulesResponse.data.rules);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load shipping data.",
      );
    } finally {
      setLoading(false);
    }
  }, [authorizedRequest]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);
  const regionOptions = regions;

  const selectedCountry = countryDraft.id
    ? countryById.get(countryDraft.id) || null
    : null;
  const selectedState = stateDraft.id
    ? stateById.get(stateDraft.id) || null
    : null;
  const selectedRegion = regionDraft.id
    ? regionById.get(regionDraft.id) || null
    : null;
  const selectedRule = ruleDraft.id
    ? rules.find((rule) => rule.id === ruleDraft.id) || null
    : null;

  function selectCountry(country: AdminShippingCountry) {
    setActiveSection("countries");
    setCountryDraft({
      id: country.id,
      iso2: country.iso2,
      iso3: country.iso3,
      name: country.name,
      isActive: country.isActive,
    });
  }

  function selectState(state: AdminShippingState) {
    setActiveSection("states");
    setStateDraft({
      id: state.id,
      countryId: state.countryId,
      code: state.code,
      name: state.name,
      isActive: state.isActive,
    });
  }

  function selectRegion(region: AdminShippingRegion) {
    setActiveSection("regions");
    setRegionDraft({
      id: region.id,
      stateId: region.stateId,
      defaultService: region.defaultService,
      isActive: region.isActive,
    });
  }

  function selectRule(rule: AdminShippingRule) {
    setActiveSection("rules");
    setRuleDraft({
      id: rule.id,
      shippingRegionId: rule.shippingRegionId,
      action: rule.action,
      ruleType: rule.ruleType,
      pin: rule.pin,
      startPin: rule.startPin,
      endPin: rule.endPin,
      reason: rule.reason,
    });
  }

  async function saveCountry() {
    if (!countryDraft.iso2.trim() || !countryDraft.iso3.trim() || !countryDraft.name.trim()) {
      window.alert("Country code and name are required.");
      return;
    }

    try {
      await authorizedRequest(
        countryDraft.id
          ? `/admin/shipping/countries/${countryDraft.id}`
          : "/admin/shipping/countries",
        {
          method: countryDraft.id ? "PATCH" : "POST",
          body: JSON.stringify({
            iso2: countryDraft.iso2,
            iso3: countryDraft.iso3,
            name: countryDraft.name,
            isActive: countryDraft.isActive,
          }),
        },
      );
      setCountryDraft(cloneCountryDraft(DEFAULT_COUNTRY_DRAFT));
      await loadData();
    } catch (nextError) {
      window.alert(nextError instanceof Error ? nextError.message : "Unable to save country.");
    }
  }

  async function saveState() {
    if (!stateDraft.countryId || !stateDraft.code.trim() || !stateDraft.name.trim()) {
      window.alert("Country, state code, and state name are required.");
      return;
    }

    try {
      await authorizedRequest(
        stateDraft.id
          ? `/admin/shipping/states/${stateDraft.id}`
          : "/admin/shipping/states",
        {
          method: stateDraft.id ? "PATCH" : "POST",
          body: JSON.stringify({
            countryId: stateDraft.countryId,
            code: stateDraft.code,
            name: stateDraft.name,
            isActive: stateDraft.isActive,
          }),
        },
      );
      setStateDraft(cloneStateDraft(DEFAULT_STATE_DRAFT));
      await loadData();
    } catch (nextError) {
      window.alert(nextError instanceof Error ? nextError.message : "Unable to save state.");
    }
  }

  async function saveRegion() {
    if (!regionDraft.id) {
      window.alert("Select an existing region from the table to edit it.");
      return;
    }

    try {
      await authorizedRequest(`/admin/shipping/regions/${regionDraft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          defaultService: regionDraft.defaultService,
          isActive: regionDraft.isActive,
        }),
      });
      setRegionDraft(cloneRegionDraft(DEFAULT_REGION_DRAFT));
      await loadData();
    } catch (nextError) {
      window.alert(
        nextError instanceof Error ? nextError.message : "Unable to save shipping region.",
      );
    }
  }

  async function saveRule() {
    if (!ruleDraft.shippingRegionId) {
      window.alert("Choose a shipping region.");
      return;
    }

    if (ruleDraft.ruleType === "PIN" && !ruleDraft.pin.trim()) {
      window.alert("PIN is required for PIN rules.");
      return;
    }

    if (ruleDraft.ruleType === "PIN_RANGE" && (!ruleDraft.startPin.trim() || !ruleDraft.endPin.trim())) {
      window.alert("Start PIN and end PIN are required for PIN range rules.");
      return;
    }

    try {
      await authorizedRequest(
        ruleDraft.id ? `/admin/shipping/rules/${ruleDraft.id}` : "/admin/shipping/rules",
        {
          method: ruleDraft.id ? "PATCH" : "POST",
          body: JSON.stringify({
            shippingRegionId: ruleDraft.shippingRegionId,
            action: ruleDraft.action,
            ruleType: ruleDraft.ruleType,
            pin: ruleDraft.pin,
            startPin: ruleDraft.startPin,
            endPin: ruleDraft.endPin,
            reason: ruleDraft.reason,
          }),
        },
      );
      setRuleDraft(cloneRuleDraft(DEFAULT_RULE_DRAFT));
      await loadData();
    } catch (nextError) {
      window.alert(nextError instanceof Error ? nextError.message : "Unable to save rule.");
    }
  }

  async function deleteCountry(country: AdminShippingCountry) {
    if (!window.confirm(`Delete country "${country.name}"?`)) {
      return;
    }

    setDeletingKey(`country:${country.id}`);
    try {
      await authorizedRequest(`/admin/shipping/countries/${country.id}`, {
        method: "DELETE",
      });
      if (countryDraft.id === country.id) {
        setCountryDraft(cloneCountryDraft(DEFAULT_COUNTRY_DRAFT));
      }
      await loadData();
    } catch (nextError) {
      window.alert(nextError instanceof Error ? nextError.message : "Unable to delete country.");
    } finally {
      setDeletingKey(null);
    }
  }

  async function deleteState(state: AdminShippingState) {
    if (!window.confirm(`Delete state "${state.name}"?`)) {
      return;
    }

    setDeletingKey(`state:${state.id}`);
    try {
      await authorizedRequest(`/admin/shipping/states/${state.id}`, {
        method: "DELETE",
      });
      if (stateDraft.id === state.id) {
        setStateDraft(cloneStateDraft(DEFAULT_STATE_DRAFT));
      }
      await loadData();
    } catch (nextError) {
      window.alert(nextError instanceof Error ? nextError.message : "Unable to delete state.");
    } finally {
      setDeletingKey(null);
    }
  }

  async function deleteRule(rule: AdminShippingRule) {
    if (!window.confirm(`Delete rule for ${rule.countryCode}/${rule.stateCode}?`)) {
      return;
    }

    setDeletingKey(`rule:${rule.id}`);
    try {
      await authorizedRequest(`/admin/shipping/rules/${rule.id}`, {
        method: "DELETE",
      });
      if (ruleDraft.id === rule.id) {
        setRuleDraft(cloneRuleDraft(DEFAULT_RULE_DRAFT));
      }
      await loadData();
    } catch (nextError) {
      window.alert(nextError instanceof Error ? nextError.message : "Unable to delete rule.");
    } finally {
      setDeletingKey(null);
    }
  }

  if (loading) {
    return <AdminLoadingCard label="Loading shipping management..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Shipping Control"
        title="Country, State and PIN Rules"
        description="Manage shipping coverage with default service regions and explicit PIN exceptions."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <AdminPill>{totals.countries} countries</AdminPill>
        <AdminPill>{totals.states} states</AdminPill>
        <AdminPill>{totals.regions} regions</AdminPill>
        <AdminPill>{totals.rules} rules</AdminPill>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["rules", "regions", "states", "countries"] as Section[]).map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setActiveSection(section)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeSection === section
                ? "bg-[#207958] text-white"
                : "bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-[var(--admin-chip)]"
            }`}
          >
            {SECTION_LABELS[section]}
          </button>
        ))}
        <AdminActionButton type="button" tone="secondary" onClick={() => void loadData()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </AdminActionButton>
      </div>

      {activeSection === "countries" ? (
        <div className="grid gap-4 lg:grid-cols-3 ">
          <AdminPanel className="space-y-4 lg:col-span-1 shadow-[0_30px_90px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  Country form
                </p>
                <h2 className="mt-1 text-xl font-medium text-[var(--admin-ink)]">
                  {countryDraft.id ? "Edit country" : "Add country"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCountryDraft(cloneCountryDraft(DEFAULT_COUNTRY_DRAFT))}
                className="text-xs font-semibold text-[var(--admin-accent)]"
              >
                New
              </button>
            </div>

            <div className="space-y-3">
              <AdminTextInput
                value={countryDraft.iso2}
                onChange={(event) =>
                  setCountryDraft((current) => ({ ...current, iso2: event.target.value }))
                }
                placeholder="ISO2 e.g. IN"
              />
              <AdminTextInput
                value={countryDraft.iso3}
                onChange={(event) =>
                  setCountryDraft((current) => ({ ...current, iso3: event.target.value }))
                }
                placeholder="ISO3 e.g. IND"
              />
              <AdminTextInput
                value={countryDraft.name}
                onChange={(event) =>
                  setCountryDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Country name"
              />
              <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--admin-ink)]">Active</span>
                <input
                  type="checkbox"
                  checked={countryDraft.isActive}
                  onChange={(event) =>
                    setCountryDraft((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  className="h-5 w-5 accent-[var(--admin-accent)]"
                />
              </label>
              <AdminActionButton type="button" tone="primary" onClick={() => void saveCountry()}>
                <Save className="mr-2 h-4 w-4" />
                {countryDraft.id ? "Update country" : "Create country"}
              </AdminActionButton>
            </div>
          </AdminPanel>

          <AdminPanel className="lg:col-span-2 shadow-[0_30px_90px_rgba(0,0,0,0.05)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.16em] text-gray-500">
                  <tr>
                    <th className="px-3 py-3">Country</th>
                    <th className="px-3 py-3">ISO2</th>
                    <th className="px-3 py-3">ISO3</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((country) => (
                    <tr key={country.id} className="border-b border-gray-200">
                      <td className="px-3 py-4 font-semibold text-gray-800">{country.name}</td>
                      <td className="px-3 py-4">{country.iso2}</td>
                      <td className="px-3 py-4">{country.iso3}</td>
                      <td className="px-3 py-4">
                        <AdminStatusPill status={country.isActive ? "active" : "disabled"} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => selectCountry(country)}
                            className="rounded-full bg-[var(--admin-chip)] px-3 py-1.5 text-xs font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteCountry(country)}
                            disabled={deletingKey === `country:${country.id}`}
                            className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </div>
      ) : null}

      {activeSection === "states" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <AdminPanel className="space-y-4 lg:col-span-1 shadow-[0_30px_90px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  State form
                </p>
                <h2 className="mt-1 text-xl font-medium text-gray-800">
                  {stateDraft.id ? "Edit state" : "Add state"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setStateDraft(cloneStateDraft(DEFAULT_STATE_DRAFT))}
                className="text-xs font-semibold text-[var(--admin-accent)]"
              >
                New
              </button>
            </div>

            <div className="space-y-3">
              <AdminSelect
                value={stateDraft.countryId}
                onChange={(event) =>
                  setStateDraft((current) => ({ ...current, countryId: event.target.value }))
                }
              >
                <option value="">Select country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </AdminSelect>
              <AdminTextInput
                value={stateDraft.code}
                onChange={(event) =>
                  setStateDraft((current) => ({ ...current, code: event.target.value }))
                }
                placeholder="State code"
              />
              <AdminTextInput
                value={stateDraft.name}
                onChange={(event) =>
                  setStateDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="State name"
              />
              <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--admin-ink)]">Active</span>
                <input
                  type="checkbox"
                  checked={stateDraft.isActive}
                  onChange={(event) =>
                    setStateDraft((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  className="h-5 w-5 accent-[var(--admin-accent)]"
                />
              </label>
              <AdminActionButton type="button" tone="primary" onClick={() => void saveState()}>
                <Save className="mr-2 h-4 w-4" />
                {stateDraft.id ? "Update state" : "Create state"}
              </AdminActionButton>
            </div>
          </AdminPanel>

          <AdminPanel className="lg:col-span-2 shadow-[0_30px_90px_rgba(0,0,0,0.05)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.16em] text-gray-500">
                  <tr>
                    <th className="px-3 py-3">Country</th>
                    <th className="px-3 py-3">State</th>
                    <th className="px-3 py-3">Code</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {states.map((state) => (
                    <tr key={state.id} className="border-b border-gray-200">
                      <td className="px-3 py-4">{countryById.get(state.countryId)?.name || "-"}</td>
                      <td className="px-3 py-4 font-semibold text-gray-800">{state.name}</td>
                      <td className="px-3 py-4">{state.code}</td>
                      <td className="px-3 py-4">
                        <AdminStatusPill status={state.isActive ? "active" : "disabled"} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => selectState(state)}
                            className="rounded-full bg-[var(--admin-chip)] px-3 py-1.5 text-xs font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteState(state)}
                            disabled={deletingKey === `state:${state.id}`}
                            className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </div>
      ) : null}

      {activeSection === "regions" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <AdminPanel className="space-y-4 lg:col-span-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  Region form
                </p>
                <h2 className="mt-1 text-xl font-medium text-[var(--admin-ink)]">
                  Edit region defaults
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRegionDraft(cloneRegionDraft(DEFAULT_REGION_DRAFT))}
                className="text-xs font-semibold text-[var(--admin-accent)]"
              >
                Clear
              </button>
            </div>

            <div className="space-y-3">
              <AdminSelect
                value={regionDraft.stateId}
                onChange={(event) =>
                  setRegionDraft((current) => ({ ...current, stateId: event.target.value }))
                }
              >
                <option value="">Select state</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {countryById.get(state.countryId)?.name || "-"} - {state.name}
                  </option>
                ))}
              </AdminSelect>
              <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--admin-ink)]">Default service</span>
                <input
                  type="checkbox"
                  checked={regionDraft.defaultService}
                  onChange={(event) =>
                    setRegionDraft((current) => ({
                      ...current,
                      defaultService: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-[var(--admin-accent)]"
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--admin-ink)]">Active</span>
                <input
                  type="checkbox"
                  checked={regionDraft.isActive}
                  onChange={(event) =>
                    setRegionDraft((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  className="h-5 w-5 accent-[var(--admin-accent)]"
                />
              </label>
              <AdminActionButton type="button" tone="primary" onClick={() => void saveRegion()}>
                <Save className="mr-2 h-4 w-4" />
                Update region
              </AdminActionButton>
            </div>
          </AdminPanel>

          <AdminPanel className="lg:col-span-2 shadow-[0_30px_90px_rgba(0,0,0,0.05)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.16em] text-gray-500">
                  <tr>
                    <th className="px-3 py-3">Country</th>
                    <th className="px-3 py-3">State</th>
                    <th className="px-3 py-3">Default service</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.map((region) => (
                    <tr key={region.id} className="border-b border-gray-200">
                      <td className="px-3 py-4">{region.countryName || "-"}</td>
                      <td className="px-3 py-4 font-semibold text-gray-800">{region.stateName || "-"}</td>
                      <td className="px-3 py-4">
                        <AdminPill>{region.defaultService ? "Service" : "Restricted"}</AdminPill>
                      </td>
                      <td className="px-3 py-4">
                        <AdminStatusPill status={region.isActive ? "active" : "disabled"} />
                      </td>
                      <td className="px-3 py-4">
                        <button
                          type="button"
                          onClick={() => selectRegion(region)}
                          className="rounded-full bg-[var(--admin-chip)] px-3 py-1.5 text-xs font-semibold"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </div>
      ) : null}

      {activeSection === "rules" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <AdminPanel className="space-y-4 lg:col-span-1 shadow-[0_30px_90px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  Rule form
                </p>
                <h2 className="mt-1 text-xl font-medium text-[var(--admin-ink)]">
                  {ruleDraft.id ? "Edit rule" : "Add rule"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRuleDraft(cloneRuleDraft(DEFAULT_RULE_DRAFT))}
                className="text-xs font-semibold text-[var(--admin-accent)]"
              >
                New
              </button>
            </div>

            <div className="space-y-3">
              <AdminSelect
                value={ruleDraft.shippingRegionId}
                onChange={(event) =>
                  setRuleDraft((current) => ({ ...current, shippingRegionId: event.target.value }))
                }
              >
                <option value="">Select region</option>
                {regionOptions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.countryCode} - {region.stateName}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect
                value={ruleDraft.action}
                onChange={(event) =>
                  setRuleDraft((current) => ({
                    ...current,
                    action: event.target.value as "ALLOW" | "BLOCK",
                  }))
                }
              >
                <option value="BLOCK">BLOCK</option>
                <option value="ALLOW">ALLOW</option>
              </AdminSelect>
              <AdminSelect
                value={ruleDraft.ruleType}
                onChange={(event) =>
                  setRuleDraft((current) => ({
                    ...current,
                    ruleType: event.target.value as AdminShippingRuleType,
                  }))
                }
              >
                <option value="PIN">PIN</option>
                <option value="PIN_RANGE">PIN_RANGE</option>
                <option value="CITY">CITY</option>
                <option value="DISTRICT">DISTRICT</option>
                <option value="POLYGON">POLYGON</option>
                <option value="LATLNG">LATLNG</option>
              </AdminSelect>
              <AdminTextInput
                value={ruleDraft.pin}
                onChange={(event) =>
                  setRuleDraft((current) => ({ ...current, pin: event.target.value }))
                }
                placeholder="PIN"
              />
              <AdminTextInput
                value={ruleDraft.startPin}
                onChange={(event) =>
                  setRuleDraft((current) => ({ ...current, startPin: event.target.value }))
                }
                placeholder="Start PIN"
              />
              <AdminTextInput
                value={ruleDraft.endPin}
                onChange={(event) =>
                  setRuleDraft((current) => ({ ...current, endPin: event.target.value }))
                }
                placeholder="End PIN"
              />
              <AdminTextarea
                value={ruleDraft.reason}
                onChange={(event) =>
                  setRuleDraft((current) => ({ ...current, reason: event.target.value }))
                }
                placeholder="Reason"
              />
              <AdminActionButton type="button" tone="primary" onClick={() => void saveRule()}>
                <Save className="mr-2 h-4 w-4" />
                {ruleDraft.id ? "Update rule" : "Create rule"}
              </AdminActionButton>
            </div>
          </AdminPanel>

          <AdminPanel className="lg:col-span-2 shadow-[0_30px_90px_rgba(0,0,0,0.05)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.16em] text-gray-500">
                  <tr>
                    <th className="px-3 py-3">Country</th>
                    <th className="px-3 py-3">State</th>
                    <th className="px-3 py-3">Action</th>
                    <th className="px-3 py-3">Rule type</th>
                    <th className="px-3 py-3">Value</th>
                    <th className="px-3 py-3">Reason</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-gray-200">
                      <td className="px-3 py-4">{rule.countryCode || "-"}</td>
                      <td className="px-3 py-4">{rule.stateName || "-"}</td>
                      <td className="px-3 py-4">
                        <AdminPill>{rule.action}</AdminPill>
                      </td>
                      <td className="px-3 py-4">{rule.ruleType}</td>
                      <td className="px-3 py-4">{getRuleValue(rule)}</td>
                      <td className="px-3 py-4 max-w-[220px] truncate">{rule.reason || "-"}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => selectRule(rule)}
                            className="rounded-full bg-[var(--admin-chip)] px-3 py-1.5 text-xs font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteRule(rule)}
                            disabled={deletingKey === `rule:${rule.id}`}
                            className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </div>
      ) : null}

      <AdminPanel className="space-y-2 shadow-[0_30px_90px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-semibold text-[var(--admin-ink)]">Selected:</span>
          <span className="text-sm text-[var(--admin-muted)]">
            {activeSection === "countries"
              ? countryDraft.id
                ? selectedCountry?.name
                : "New country"
              : activeSection === "states"
                ? stateDraft.id
                  ? selectedState?.name
                  : "New state"
                : activeSection === "regions"
                  ? selectedRegion
                    ? `${selectedRegion.countryName} / ${selectedRegion.stateName}`
                    : "Choose a region"
                  : selectedRule
                    ? `${selectedRule.countryCode} / ${selectedRule.stateCode}`
                    : "New rule"}
          </span>
        </div>
      </AdminPanel>
    </div>
  );
}

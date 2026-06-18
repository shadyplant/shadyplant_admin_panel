"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Undo2, X } from "lucide-react";
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
  AdminPill,
  AdminSelect,
  AdminTextarea,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import MobileEmailPreview from "@/components/mobile-model/MobileModel";
import type { AdminCustomer, ApiResponse } from "@/lib/admin-api";
import { canViewMailer } from "@/lib/admin-permissions";

type MailMode = "html" | "text";

type MailerFormState = {
  subject: string;
  manualRecipients: string;
  contentMode: MailMode;
  htmlBody: string;
  textBody: string;
};

type AiDraftSnapshot = {
  htmlBody: string;
  textBody: string;
};

const emptyForm: MailerFormState = {
  subject: "",
  manualRecipients: "",
  contentMode: "html",
  htmlBody: "<p>Hi there,</p><p></p><p>Thanks for being with us.</p>",
  textBody: "Hi there,\n\nThanks for being with us.",
};

function normalizeRecipients(value: string) {
  return [...new Set(
    String(value || "")
      .split(/[\n,;]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  )];
}

function formatRecipientLabel(email: string) {
  return String(email || "").trim().toLowerCase();
}

export default function MailerPage() {
  const { authorizedRequest, staff } = useAdminAuth();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [form, setForm] = useState<MailerFormState>(emptyForm);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPromptMode, setAiPromptMode] = useState<MailMode>("html");
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [bodyHistory, setBodyHistory] = useState<AiDraftSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const allowMailerAccess = canViewMailer(staff?.role);

  async function loadCustomers() {
    setLoading(true);
    setError(null);

    try {
      const response = await authorizedRequest<
        ApiResponse<{ customers: AdminCustomer[] }>
      >("/admin/customers");

      setCustomers(response.data.customers || []);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load customers.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncCustomers() {
      setLoading(true);
      setError(null);

      try {
        const response = await authorizedRequest<
          ApiResponse<{ customers: AdminCustomer[] }>
        >("/admin/customers");

        if (!cancelled) {
          setCustomers(response.data.customers || []);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load customers.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncCustomers();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();

    return customers.filter((customer) => {
      if (!query) {
        return true;
      }

      return [customer.fullName, customer.email, customer.phoneNumber, customer.customerCategory]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [customerSearch, customers]);

  const selectedCustomers = useMemo(
    () => customers.filter((customer) => selectedCustomerIds.includes(customer.id)),
    [customers, selectedCustomerIds],
  );

  const manualRecipients = useMemo(
    () => normalizeRecipients(form.manualRecipients),
    [form.manualRecipients],
  );

  const selectedCustomerEmails = useMemo(
    () =>
      selectedCustomers
        .map((customer) => formatRecipientLabel(customer.email))
        .filter(Boolean),
    [selectedCustomers],
  );

  const recipientEmails = useMemo(
    () => [...new Set([...manualRecipients, ...selectedCustomerEmails])],
    [manualRecipients, selectedCustomerEmails],
  );

  const previewContent =
    form.contentMode === "html"
      ? form.htmlBody.trim() || "<p>No HTML content yet.</p>"
      : form.textBody.trim() || "No text content yet.";

  function toggleCustomer(customerId: string) {
    setSelectedCustomerIds((currentIds) =>
      currentIds.includes(customerId)
        ? currentIds.filter((id) => id !== customerId)
        : [...currentIds, customerId],
    );
  }

  function selectVisibleCustomers() {
    setSelectedCustomerIds((currentIds) =>
      [...new Set([...currentIds, ...filteredCustomers.map((customer) => customer.id)])],
    );
  }

  function clearSelectedCustomers() {
    setSelectedCustomerIds([]);
  }

  function openAiPrompt(mode: MailMode) {
    setAiPromptMode(mode);
    setAiPrompt("");
    setAiError(null);
    setAiPromptOpen(true);
  }

  function closeAiPrompt() {
    if (aiGenerating) {
      return;
    }

    setAiPromptOpen(false);
    setAiError(null);
  }

  function saveCurrentBodySnapshot() {
    setBodyHistory((currentHistory) => [
      ...currentHistory,
      {
        htmlBody: form.htmlBody,
        textBody: form.textBody,
      },
    ]);
  }

  function undoLastAiDraft() {
    setBodyHistory((currentHistory) => {
      const nextHistory = [...currentHistory];
      const lastSnapshot = nextHistory.pop();

      if (lastSnapshot) {
        setForm((currentForm) => ({
          ...currentForm,
          htmlBody: lastSnapshot.htmlBody,
          textBody: lastSnapshot.textBody,
        }));
      }

      return nextHistory;
    });
  }

  async function generateAiDraft() {
    const trimmedPrompt = aiPrompt.trim();

    if (!trimmedPrompt) {
      setAiError("Describe the email you want to generate.");
      return;
    }

    setAiGenerating(true);
    setAiError(null);

    try {
      const response = await authorizedRequest<
        ApiResponse<{ draft: { mode: MailMode; body: string } }>
      >("/admin/mailer/draft", {
        method: "POST",
        body: JSON.stringify({
          prompt: trimmedPrompt,
          mode: aiPromptMode,
          subject: form.subject.trim(),
          currentBody:
            aiPromptMode === "html" ? form.htmlBody : form.textBody,
        }),
      });

      const draftBody = String(response.data.draft.body || "").trim();
      if (!draftBody) {
        throw new Error("AI returned an empty draft.");
      }

      saveCurrentBodySnapshot();
      setForm((currentForm) => ({
        ...currentForm,
        contentMode: aiPromptMode,
        htmlBody: aiPromptMode === "html" ? draftBody : currentForm.htmlBody,
        textBody: aiPromptMode === "text" ? draftBody : currentForm.textBody,
      }));
      setAiPromptOpen(false);
    } catch (nextError) {
      setAiError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to generate draft right now.",
      );
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setSuccessMessage(null);

    const recipients = [...recipientEmails];

    if (!recipients.length) {
      setError("Add at least one recipient email.");
      setSending(false);
      return;
    }

    try {
      const payload =
        form.contentMode === "html"
          ? {
              recipients,
              subject: form.subject.trim(),
              html: form.htmlBody.trim(),
              source: "admin-mailer",
            }
          : {
              recipients,
              subject: form.subject.trim(),
              text: form.textBody.trim(),
              source: "admin-mailer",
            };

      const response = await authorizedRequest<
        ApiResponse<{ result: { delivered?: boolean; skipped?: boolean; transport?: string } }>
      >("/admin/mailer/send", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessMessage(
        response.data.result?.skipped
          ? `Mailer is set to ${response.data.result.transport || "disabled"} so the request was skipped safely.`
          : `Email processed successfully with ${response.data.result?.transport || "native mailer"}.`,
      );
      setForm({
        ...emptyForm,
        contentMode: form.contentMode,
      });
      setSelectedCustomerIds([]);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to send email right now.",
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <AdminLoadingCard label="Loading mailer workspace..." />;
  }

  if (error && !customers.length) {
    return <AdminErrorCard message={error} onRetry={() => void loadCustomers()} />;
  }

  if (!allowMailerAccess) {
    return (
      <AdminErrorCard message="You do not have access to the mailer workspace." />
    );
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        .admin-scrollbar-slim {
          scrollbar-width: thin;
          scrollbar-color: rgba(160, 173, 156, 0.85) transparent;
        }

        .admin-scrollbar-slim::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .admin-scrollbar-slim::-webkit-scrollbar-track {
          background: transparent;
        }

        .admin-scrollbar-slim::-webkit-scrollbar-thumb {
          background: rgba(160, 173, 156, 0.85);
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.72);
        }

        .admin-scrollbar-slim::-webkit-scrollbar-thumb:hover {
          background: rgba(136, 151, 132, 0.95);
        }
      `}</style>

      <AdminPageHeader
        eyebrow="Notifications"
        title="Mailer"
        description="Send a polished one-off email to any address or to selected customers, with either raw HTML or plain text."
      />


      {error ? (
        <AdminErrorCard message={error} onRetry={() => setError(null)} />
      ) : null}

      {successMessage ? (
        <AdminPanel className="border border-[#d6e7cf] bg-[#f7fbf4]">
          <p className="text-sm font-semibold text-[#356a37]">{successMessage}</p>
        </AdminPanel>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] xl:items-start">
          <div className="admin-scrollbar-slim space-y-6 xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto xl:pr-2">
            <AdminPanel className="space-y-5 border border-[var(--admin-line)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-line)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  Recipients
                </p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                  Send to customers or any email
                </h2>
              </div>
              <AdminPill>{customers.length} customers</AdminPill>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-5">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--admin-ink)]">
                    Manual email list
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--admin-muted)]">
                    Separate multiple addresses with commas or new lines.
                  </span>
                  <div className="mt-2">
                    <AdminTextarea
                      value={form.manualRecipients}
                      onChange={(event) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          manualRecipients: event.target.value,
                        }))
                      }
                      placeholder="client@example.com, team@example.com"
                      className="min-h-[190px]"
                    />
                  </div>
                </label>

                <div className="rounded-sm border border-[var(--admin-line)] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                    Final recipient list
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recipientEmails.length ? (
                      recipientEmails.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center rounded-full bg-[var(--admin-chip)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-ink)]"
                        >
                          {email}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--admin-muted)]">
                        No recipients added yet.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
                  <label className="block min-w-0 flex-1">
                    <span className="text-sm font-semibold text-[var(--admin-ink)]">
                      Search customers
                    </span>
                    <div className="mt-2">
                      <AdminTextInput
                        value={customerSearch}
                        onChange={(event) => setCustomerSearch(event.target.value)}
                        placeholder="Search by name, email, phone, or category"
                      />
                    </div>
                  </label>

                  <div className="flex shrink-0 items-center gap-2 lg:pb-[1px]">
                    <AdminActionButton
                      type="button"
                      tone="secondary"
                      onClick={selectVisibleCustomers}
                    >
                      Select All
                    </AdminActionButton>
                    <AdminActionButton
                      type="button"
                      tone="secondary"
                      onClick={clearSelectedCustomers}
                    >
                      Clear
                    </AdminActionButton>
                  </div>
                </div>

                <div className="rounded-[1.1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] p-3">
                  <div className="admin-scrollbar-slim max-h-[320px] space-y-2 overflow-auto pr-1">
                    {filteredCustomers.length ? (
                      filteredCustomers.map((customer) => {
                        const checked = selectedCustomerIds.includes(customer.id);

                        return (
                          <label
                            key={customer.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                              checked
                                ? "border-[var(--admin-accent)] bg-white"
                                : "border-transparent bg-white/70 hover:bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCustomer(customer.id)}
                              className="mt-1 h-4 w-4 rounded border-[var(--admin-line-strong)] text-[var(--admin-accent)] focus:ring-[var(--admin-accent-soft)]"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-[var(--admin-ink)]">
                                  {customer.fullName || "Unnamed customer"}
                                </p>
                                <span className="shrink-0 rounded-full bg-[var(--admin-chip)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                                  {customer.customerCategory.replaceAll("_", " ")}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-xs text-[var(--admin-muted)]">
                                {customer.email}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <AdminEmptyCard
                        title="No customers found"
                        description="Try a different search term or add a manual email address."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </AdminPanel>

            <AdminPanel className="space-y-5 border border-[var(--admin-line)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-line)] pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                    Compose
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                    Create message
                  </h2>
                </div>
                <AdminPill>{form.contentMode === "html" ? "HTML" : "Text"}</AdminPill>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-[var(--admin-ink)]">
                    Subject
                  </span>
                  <div className="mt-2">
                    <AdminTextInput
                      value={form.subject}
                      onChange={(event) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          subject: event.target.value,
                        }))
                      }
                      placeholder="Spring restock update"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[var(--admin-ink)]">
                    Message type
                  </span>
                  <div className="mt-2">
                    <AdminSelect
                      value={form.contentMode}
                      onChange={(event) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          contentMode: event.target.value as MailMode,
                        }))
                      }
                    >
                      <option value="html">HTML</option>
                      <option value="text">Plain text</option>
                    </AdminSelect>
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[var(--admin-ink)]">
                    Template tone
                  </span>
                  <div className="mt-2 rounded-xl border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-muted)]">
                    Keep the copy short and direct. HTML mode supports full markup, while text mode is ideal for quick operational messages.
                  </div>
                </label>

                {form.contentMode === "html" ? (
                  <label className="block md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[var(--admin-ink)]">
                        HTML body
                      </span>
                      <div className="flex items-center gap-2">
                        {bodyHistory.length ? (
                          <button
                            type="button"
                            onClick={undoLastAiDraft}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--admin-line-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Undo
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openAiPrompt("html")}
                          className="inline-flex items-center gap-2 rounded-full bg-[var(--admin-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-accent)] transition hover:brightness-95"
                        >
                          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                          AI
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <AdminTextarea
                        value={form.htmlBody}
                        onChange={(event) =>
                          setForm((currentForm) => ({
                            ...currentForm,
                            htmlBody: event.target.value,
                          }))
                        }
                        placeholder="<p>Hello customer,</p>"
                        className="min-h-[240px] font-mono text-[13px]"
                        required
                      />
                    </div>
                  </label>
                ) : (
                  <label className="block md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[var(--admin-ink)]">
                        Text body
                      </span>
                      <div className="flex items-center gap-2">
                        {bodyHistory.length ? (
                          <button
                            type="button"
                            onClick={undoLastAiDraft}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--admin-line-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Undo
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openAiPrompt("text")}
                          className="inline-flex items-center gap-2 rounded-full bg-[var(--admin-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-accent)] transition hover:brightness-95"
                        >
                          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                          AI
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <AdminTextarea
                        value={form.textBody}
                        onChange={(event) =>
                          setForm((currentForm) => ({
                            ...currentForm,
                            textBody: event.target.value,
                          }))
                        }
                        placeholder="Hello customer,"
                        className="min-h-[240px]"
                        required
                      />
                    </div>
                  </label>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end">
                <AdminActionButton
                  type="submit"
                  disabled={sending}
                  className="min-w-[180px] px-6 py-3"
                >
                  {sending ? "Sending..." : "Send email"}
                </AdminActionButton>
              </div>
            </AdminPanel>
          </div>

          <AdminPanel className="space-y-4 border border-[var(--admin-line)] xl:sticky xl:top-6 xl:max-h-[calc(100vh-11rem)] xl:overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  Mobile preview
                </span>
              </div>
              <AdminPill>
                {recipientEmails.length ? `${recipientEmails.length} recipients` : "No recipients yet"}
              </AdminPill>
            </div>

            <MobileEmailPreview
              subject={form.subject}
              senderName="ShadyPlant"
              previewContent={previewContent}
              contentMode={form.contentMode}
            />
          </AdminPanel>
        </div>
      </form>

      {aiPromptOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[rgba(8,15,8,0.42)] px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[1.5rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_30px_90px_rgba(16,30,14,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--admin-line)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  AI mail writer
                </p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                  Draft the {aiPromptMode === "html" ? "HTML" : "text"} body
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
                  Describe what you want. The AI will fill the current message field, and you can still undo it before sending.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAiPrompt}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--admin-line)] text-[var(--admin-muted)] transition hover:bg-[var(--admin-chip)]"
                aria-label="Close AI prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--admin-ink)]">
                  Prompt
                </span>
                <div className="mt-2">
                  <AdminTextarea
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Write a warm welcome email for new customers with a greener, premium tone."
                    className="min-h-[180px]"
                  />
                </div>
              </label>

              {aiError ? (
                <p className="rounded-xl border border-[#f1c7c3] bg-[#fff6f4] px-4 py-3 text-sm font-semibold text-[#a73d31]">
                  {aiError}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <AdminActionButton
                  type="button"
                  tone="secondary"
                  onClick={closeAiPrompt}
                >
                  Cancel
                </AdminActionButton>
                <AdminActionButton
                  type="button"
                  onClick={() => void generateAiDraft()}
                  disabled={aiGenerating}
                  className="min-w-[180px]"
                >
                  {aiGenerating ? "Generating..." : "Generate draft"}
                </AdminActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

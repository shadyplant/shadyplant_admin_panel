import { useState } from "react";

type MobileNotificationPreviewProps = {
  deliveryMode: "email" | "push";
  subject?: string;
  senderName?: string;
  previewContent?: string;
  contentMode?: "html" | "text";
  title?: string;
  description?: string;
  link?: string;
  buttonLabel?: string;
  buttonColor?: string;
  logoUrl?: string;
  imageUrl?: string;
  vibrate?: boolean;
  className?: string;
};

function StatusBar() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div
      className="flex items-center justify-between px-5 pt-3 pb-1"
      style={{ color: "#f8faf5" }}
    >
      <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>
        {time}
      </span>

      <div style={{ width: 120, height: 34, background: "#000", borderRadius: 20 }} />

      <div className="flex items-center gap-1.5">
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
          <rect x="0" y="7" width="3" height="5" rx="0.8" opacity="0.4" />
          <rect x="4.5" y="4.5" width="3" height="7.5" rx="0.8" opacity="0.6" />
          <rect x="9" y="2" width="3" height="10" rx="0.8" opacity="0.8" />
          <rect x="13.5" y="0" width="3" height="12" rx="0.8" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 9.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
          <path d="M2.5 5.5a8 8 0 0111 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />
          <path d="M4.8 7.8a5 5 0 016.4 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.75" />
        </svg>
        <div className="flex items-center gap-0.5">
          <div style={{ width: 25, height: 12, border: "1.5px solid currentColor", borderRadius: 3.5, padding: "1.5px" }}>
            <div style={{ width: "78%", height: "100%", background: "currentColor", borderRadius: 1.5 }} />
          </div>
          <div style={{ width: 2, height: 6, background: "currentColor", borderRadius: 1, opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
}

function renderHtmlPreview(previewContent: string) {
  return (
    <div className="overflow-hidden">
      <div
        className="origin-top-left"
        style={{ transform: "scale(0.66)", width: "151.5151515152%", fontSize: 14, lineHeight: "1.7" }}
      >
        <style>{`
          .mailer-preview-content,
          .mailer-preview-content * { box-sizing: border-box; }
          .mailer-preview-content {
            width: 100%; max-width: 100% !important;
            overflow-x: hidden; overflow-wrap: anywhere; word-break: break-word;
          }
          .mailer-preview-content img,
          .mailer-preview-content video,
          .mailer-preview-content iframe {
            display: block; width: 100% !important; max-width: 100% !important; height: auto !important;
          }
          .mailer-preview-content table {
            width: 100% !important; max-width: 100% !important;
            table-layout: fixed !important; border-collapse: collapse !important;
          }
          .mailer-preview-content td, .mailer-preview-content th {
            max-width: 100% !important; overflow-wrap: anywhere; word-break: break-word;
          }
          .mailer-preview-content p, .mailer-preview-content div,
          .mailer-preview-content span, .mailer-preview-content a,
          .mailer-preview-content blockquote, .mailer-preview-content li {
            overflow-wrap: anywhere; word-break: break-word;
          }
        `}</style>
        <div className="mailer-preview-content" dangerouslySetInnerHTML={{ __html: previewContent }} />
      </div>
    </div>
  );
}

export default function MobileEmailPreview({
  deliveryMode,
  subject = "",
  senderName = "ShadyPlant",
  previewContent = "",
  contentMode = "html",
  title = "",
  description = "",
  link = "",
  buttonLabel = "Open",
  buttonColor = "#207958",
  logoUrl = "",
  imageUrl = "",
  vibrate = false,
  className = "",
}: MobileNotificationPreviewProps) {
  const [starred, setStarred] = useState(false);

  if (deliveryMode === "push") {
    return (
      <div className={className}>
        <div className="px-3 py-4">
          <div
            className="mx-auto w-full max-w-[390px] flex flex-col overflow-hidden"
            style={{
              height: 820,
              borderRadius: "2.4rem",
              border: "1px solid #151c15",
              background: "linear-gradient(180deg,#1c1c1e 0%,#2c2c2e 100%)",
              padding: "0 4px 4px",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.12), 0 24px 60px rgba(12,18,10,0.35), inset 0 0 0 1px rgba(255,255,255,0.05)",
              position: "relative",
            }}
          >
            <div style={{ position: "absolute", left: -3, top: 120, width: 3, height: 32, background: "#3a3a3c", borderRadius: "2px 0 0 2px" }} />
            <div style={{ position: "absolute", left: -3, top: 164, width: 3, height: 56, background: "#3a3a3c", borderRadius: "2px 0 0 2px" }} />
            <div style={{ position: "absolute", left: -3, top: 230, width: 3, height: 56, background: "#3a3a3c", borderRadius: "2px 0 0 2px" }} />
            <div style={{ position: "absolute", right: -3, top: 180, width: 3, height: 80, background: "#3a3a3c", borderRadius: "0 2px 2px 0" }} />

            <div
              style={{
                borderRadius: 52,
                overflow: "hidden",
                background: "#000",
                flex: 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ background: "#1c281b", flexShrink: 0 }}>
                <StatusBar />
              </div>

              <div
                style={{
                  flex: 1,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  background:
                    "radial-gradient(circle at top, rgba(32,121,88,0.22), transparent 38%), #f2f2f7",
                  fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
                }}
              >
                <div
                  style={{
                    background: "rgba(242,242,247,0.95)",
                    borderBottom: "0.5px solid rgba(0,0,0,0.18)",
                    flexShrink: 0,
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        className="flex items-center gap-1"
                        style={{
                          color: "#007aff",
                          fontSize: 17,
                          fontWeight: 400,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <svg width="10" height="17" viewBox="0 0 10 17" fill="none">
                          <path d="M8.5 1.5L1.5 8.5L8.5 15.5" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span style={{ marginLeft: 2 }}>Notifications</span>
                      </button>
                    </div>
                    <span style={{ fontSize: 12, color: "#8e8e93", fontWeight: 600 }}>
                      Push
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px" }}>
                  <div
                    style={{
                      borderRadius: 28,
                      background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,250,248,0.98))",
                      boxShadow: "0 16px 40px rgba(12,18,10,0.12)",
                      border: "1px solid rgba(0,0,0,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, padding: 16, alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 16,
                          flexShrink: 0,
                          background: logoUrl
                            ? `center / cover no-repeat url(${logoUrl})`
                            : "linear-gradient(135deg,#2e7d32,#4caf50)",
                          boxShadow: "0 10px 24px rgba(32,121,88,0.18)",
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="flex items-center justify-between gap-2">
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                            ShadyPlant
                          </p>
                          <span style={{ fontSize: 12, color: "#8e8e93" }}>Now</span>
                        </div>
                        <h1 style={{ margin: "6px 0 8px", fontSize: 20, lineHeight: 1.2, fontWeight: 700, color: "#111827", wordBreak: "break-word" }}>
                          {title.trim() || "Push title preview"}
                        </h1>
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#374151", wordBreak: "break-word" }}>
                          {description.trim() || "Push description preview appears here."}
                        </p>
                      </div>
                    </div>

                    {imageUrl.trim() ? (
                      <div style={{ padding: "0 16px 16px" }}>
                        <div
                          style={{
                            width: "100%",
                            height: 180,
                            borderRadius: 22,
                            background: `center / cover no-repeat url(${imageUrl})`,
                            border: "1px solid rgba(0,0,0,0.06)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                          }}
                        />
                      </div>
                    ) : null}

                    <div style={{ padding: "0 16px 16px" }}>
                      {link.trim() ? (
                        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7280", wordBreak: "break-word" }}>
                          {link}
                        </p>
                      ) : null}

                      <button
                        type="button"
                        style={{
                          border: "none",
                          borderRadius: 999,
                          padding: "12px 18px",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#fff",
                          background: buttonColor || "#207958",
                          boxShadow: "0 12px 24px rgba(32,121,88,0.22)",
                          cursor: "pointer",
                        }}
                      >
                        {buttonLabel.trim() || "Open"}
                      </button>

                      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ borderRadius: 999, background: "#eef2f7", color: "#374151", fontSize: 12, fontWeight: 700, padding: "6px 10px" }}>
                          {vibrate ? "Vibrate on" : "Vibrate off"}
                        </span>
                        <span style={{ borderRadius: 999, background: "#eef2f7", color: "#374151", fontSize: 12, fontWeight: 700, padding: "6px 10px" }}>
                          High priority
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Outer green-gradient stand */}
      <div
        className=" px-3 py-4"
       
      >
        {/* Phone shell — graphite with subtle highlight ring, matches first design */}
        <div
          className="mx-auto w-full max-w-[390px] flex flex-col overflow-hidden"
          style={{
            height: 820,
            borderRadius: "2.4rem",
            border: "1px solid #151c15",
            background: "linear-gradient(180deg,#1c1c1e 0%,#2c2c2e 100%)",
            padding: "0 4px 4px",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.12), 0 24px 60px rgba(12,18,10,0.35), inset 0 0 0 1px rgba(255,255,255,0.05)",
            position: "relative",
          }}
        >
          {/* Side buttons */}
          <div style={{ position: "absolute", left: -3, top: 120, width: 3, height: 32, background: "#3a3a3c", borderRadius: "2px 0 0 2px" }} />
          <div style={{ position: "absolute", left: -3, top: 164, width: 3, height: 56, background: "#3a3a3c", borderRadius: "2px 0 0 2px" }} />
          <div style={{ position: "absolute", left: -3, top: 230, width: 3, height: 56, background: "#3a3a3c", borderRadius: "2px 0 0 2px" }} />
          <div style={{ position: "absolute", right: -3, top: 180, width: 3, height: 80, background: "#3a3a3c", borderRadius: "0 2px 2px 0" }} />

          {/* Screen bezel + content */}
          <div
            style={{
              borderRadius: 52,
              overflow: "hidden",
              background: "#000",
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Status bar on dark green brand bg */}
            <div style={{ background: "#1c281b", flexShrink: 0 }}>
              <StatusBar />
            </div>

            {/* Mail app */}
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                background: "#f2f2f7",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
              }}
            >
              {/* Nav bar */}
              <div
                style={{
                  background: "rgba(242,242,247,0.95)",
                  borderBottom: "0.5px solid rgba(0,0,0,0.18)",
                  flexShrink: 0,
                }}
              >
                <div className="flex items-center px-4 py-2">
                  <button
                    className="flex items-center gap-1"
                    style={{ color: "#007aff", fontSize: 17, fontWeight: 400, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <svg width="10" height="17" viewBox="0 0 10 17" fill="none">
                      <path d="M8.5 1.5L1.5 8.5L8.5 15.5" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ marginLeft: 2 }}>Inbox</span>
                  </button>
                  <div style={{ flex: 1 }} />
                  <div className="flex items-center gap-5">
                    <button
                      onClick={() => setStarred((s) => !s)}
                      style={{ color: starred ? "#ff9500" : "#007aff", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                      </svg>
                    </button>
                    <button style={{ color: "#007aff", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <polyline points="9 11 12 14 22 4" />
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                      </svg>
                    </button>
                    <button style={{ color: "#007aff", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable email body */}
              <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

                {/* Subject + sender */}
                <div style={{ background: "#fff", padding: "16px 16px 12px" }}>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: "#000", margin: "0 0 14px", lineHeight: 1.25 }}>
                    {subject.trim() || "Subject preview"}
                  </h1>
                  <div className="flex items-start gap-3">
                    <div style={{ width: 40, height: 40, borderRadius: 20, background: "linear-gradient(135deg,#4caf50,#2e7d32)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>
                      {(senderName || "S")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span style={{ fontWeight: 600, fontSize: 15, color: "#000" }}>{senderName}</span>
                        <span style={{ fontSize: 13, color: "#8e8e93" }}>9:41 AM</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span style={{ fontSize: 13, color: "#8e8e93" }}>To: me</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M3 4.5L6 7.5L9 4.5" stroke="#8e8e93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ background: "#fff", margin: "8px 0", padding: "16px" }}>
                  {contentMode === "html" ? (
                    renderHtmlPreview(previewContent)
                  ) : (
                    <pre style={{ fontSize: 15, lineHeight: 1.7, color: "#1a1a1a", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "inherit" }}>
                      {previewContent || "Email body preview appears here."}
                    </pre>
                  )}
                </div>

                {/* Quick chips */}
              <div style={{ padding: "0 16px 16px" }}>
                  <div className="flex gap-2 flex-wrap">
                    {["Reply", "Forward", "Unsubscribe"].map((label) => (
                      <button
                        key={label}
                        style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 20, padding: "6px 14px", fontSize: 14, color: "#007aff", fontWeight: 500, cursor: "pointer" }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom toolbar */}
              <div style={{ background: "rgba(242,242,247,0.95)", borderTop: "0.5px solid rgba(0,0,0,0.18)", padding: "10px 0 28px", flexShrink: 0 }}>
                <div className="flex items-center justify-around px-6">
                  {(
                    [
                      { label: "Archive", color: "#007aff", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> },
                      { label: "Move",    color: "#007aff", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg> },
                      { label: "Flag",    color: "#007aff", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> },
                      { label: "Delete",  color: "#ff3b30", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> },
                      { label: "Reply",   color: "#007aff", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg> },
                    ] as { label: string; color: string; icon: React.ReactNode }[]
                  ).map(({ label, icon, color }) => (
                    <button
                      key={label}
                      className="flex flex-col items-center gap-1"
                      style={{ color, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      {icon}
                      <span style={{ fontSize: 10, fontWeight: 400 }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

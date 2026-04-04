import { useState, useRef, useEffect } from "react";
import type { ThemeSettings } from "../useSettings";
import { useTranslation } from "../LocaleContext";
import type { Locale } from "../i18n";

interface SettingsProps {
  settings: ThemeSettings;
  onChange: (patch: Partial<ThemeSettings>) => void;
  onApplyPreset: (name: "dark" | "light") => void;
  onClose: () => void;
}

function ColorRow({
  label, value, settingKey, onChange,
}: {
  label: string;
  value: string;
  settingKey: keyof ThemeSettings;
  onChange: (patch: Partial<ThemeSettings>) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <label className="text-sm flex-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange({ [settingKey]: e.target.value })}
          className="w-7 h-7 rounded cursor-pointer bg-transparent"
          style={{ border: "1px solid var(--border-color)" }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange({ [settingKey]: e.target.value })}
          className="settings-input w-20 px-2 py-0.5 text-xs font-mono rounded"
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="settings-section-title w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider py-1.5"
      >
        {title}
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="pt-2">{children}</div>}
    </div>
  );
}

export function Settings({ settings, onChange, onApplyPreset, onClose }: SettingsProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close + focus trap
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>("button, input, [tabindex]:not([tabindex='-1'])"));
    focusable()[0]?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab") {
        const els = focusable();
        if (els.length === 0) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div ref={panelRef} className="settings-panel relative ml-auto w-96 h-full overflow-y-auto">
        <div className="settings-header sticky top-0 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-base font-semibold">{t("settings.title")}</h2>
          <button onClick={onClose} className="text-muted text-lg leading-none px-1">✕</button>
        </div>

        <div className="p-4">
          {/* Language selector */}
          <div className="mb-5">
            <h3 className="text-muted text-xs font-semibold uppercase tracking-wider mb-3">{t("settings.language")}</h3>
            <div className="grid grid-cols-2 gap-3">
              {(["en", "ja"] as Locale[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => onChange({ locale: loc })}
                  className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                  style={{ border: `2px solid ${settings.locale === loc ? "#6366f1" : "var(--border-color)"}` }}
                >
                  {loc === "en" ? "English" : "日本語"}
                </button>
              ))}
            </div>
          </div>

          {/* Preset theme selector */}
          <div className="mb-5">
            <h3 className="text-muted text-xs font-semibold uppercase tracking-wider mb-3">{t("settings.theme")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onApplyPreset("dark")}
                className="rounded-lg p-3 transition-colors"
                style={{ border: `2px solid ${settings.preset === "dark" ? "#6366f1" : "var(--border-color)"}` }}
              >
                <div className="rounded overflow-hidden" style={{ border: "1px solid #3f3f46" }}>
                  <div className="flex h-16">
                    <div className="w-1/3 p-1" style={{ backgroundColor: "#27272a", borderRight: "1px solid #3f3f46" }}>
                      <div className="h-1 w-3/4 rounded mb-1" style={{ backgroundColor: "#52525b" }} />
                      <div className="h-1 w-1/2 rounded mb-1" style={{ backgroundColor: "#52525b" }} />
                      <div className="h-1 w-2/3 rounded" style={{ backgroundColor: "#52525b" }} />
                    </div>
                    <div className="flex-1 p-1" style={{ backgroundColor: "#18181b" }}>
                      <div className="h-1.5 w-1/2 rounded mb-1" style={{ backgroundColor: "#71717a" }} />
                      <div className="h-1 w-full rounded mb-0.5" style={{ backgroundColor: "#3f3f46" }} />
                      <div className="h-1 w-3/4 rounded mb-0.5" style={{ backgroundColor: "#3f3f46" }} />
                      <div className="h-1 w-5/6 rounded" style={{ backgroundColor: "#3f3f46" }} />
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium mt-2">Dark</div>
              </button>

              <button
                onClick={() => onApplyPreset("light")}
                className="rounded-lg p-3 transition-colors"
                style={{ border: `2px solid ${settings.preset === "light" ? "#6366f1" : "var(--border-color)"}` }}
              >
                <div className="rounded overflow-hidden" style={{ border: "1px solid #d4d4d8" }}>
                  <div className="flex h-16">
                    <div className="w-1/3 p-1" style={{ backgroundColor: "#f4f4f5", borderRight: "1px solid #d4d4d8" }}>
                      <div className="h-1 w-3/4 rounded mb-1" style={{ backgroundColor: "#a1a1aa" }} />
                      <div className="h-1 w-1/2 rounded mb-1" style={{ backgroundColor: "#a1a1aa" }} />
                      <div className="h-1 w-2/3 rounded" style={{ backgroundColor: "#a1a1aa" }} />
                    </div>
                    <div className="flex-1 p-1" style={{ backgroundColor: "#ffffff" }}>
                      <div className="h-1.5 w-1/2 rounded mb-1" style={{ backgroundColor: "#52525b" }} />
                      <div className="h-1 w-full rounded mb-0.5" style={{ backgroundColor: "#d4d4d8" }} />
                      <div className="h-1 w-3/4 rounded mb-0.5" style={{ backgroundColor: "#d4d4d8" }} />
                      <div className="h-1 w-5/6 rounded" style={{ backgroundColor: "#d4d4d8" }} />
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium mt-2">Light</div>
              </button>
            </div>
          </div>

          <Section title={t("settings.appColors")}>
            <ColorRow label={t("settings.color.background")} value={settings.appBg} settingKey="appBg" onChange={onChange} />
            <ColorRow label={t("settings.color.sidebar")} value={settings.sidebarBg} settingKey="sidebarBg" onChange={onChange} />
            <ColorRow label={t("settings.color.text")} value={settings.textColor} settingKey="textColor" onChange={onChange} />
            <ColorRow label={t("settings.color.mutedText")} value={settings.textMuted} settingKey="textMuted" onChange={onChange} />
            <ColorRow label={t("settings.color.border")} value={settings.borderColor} settingKey="borderColor" onChange={onChange} />
            <ColorRow label={t("settings.color.button")} value={settings.buttonBg} settingKey="buttonBg" onChange={onChange} />
          </Section>

          <Section title={t("settings.markdownColors")}>
            <ColorRow label={t("settings.color.heading")} value={settings.mdHeadingColor} settingKey="mdHeadingColor" onChange={onChange} />
            <ColorRow label={t("settings.color.link")} value={settings.mdLinkColor} settingKey="mdLinkColor" onChange={onChange} />
            <ColorRow label={t("settings.color.codeBg")} value={settings.mdCodeBg} settingKey="mdCodeBg" onChange={onChange} />
            <ColorRow label={t("settings.color.mdBorder")} value={settings.mdBorderColor} settingKey="mdBorderColor" onChange={onChange} />
          </Section>

          <Section title={t("settings.mermaidColors")}>
            <ColorRow label={t("settings.color.mermaidBg")} value={settings.mermaidBg} settingKey="mermaidBg" onChange={onChange} />
            <ColorRow label={t("settings.color.primary")} value={settings.mermaidPrimaryColor} settingKey="mermaidPrimaryColor" onChange={onChange} />
            <ColorRow label={t("settings.color.primaryText")} value={settings.mermaidPrimaryTextColor} settingKey="mermaidPrimaryTextColor" onChange={onChange} />
            <ColorRow label={t("settings.color.lineArrow")} value={settings.mermaidLineColor} settingKey="mermaidLineColor" onChange={onChange} />
            <ColorRow label={t("settings.color.actorBox")} value={settings.mermaidActorBg} settingKey="mermaidActorBg" onChange={onChange} />
            <ColorRow label={t("settings.color.actorText")} value={settings.mermaidActorTextColor} settingKey="mermaidActorTextColor" onChange={onChange} />
            <ColorRow label={t("settings.color.signalText")} value={settings.mermaidSignalTextColor} settingKey="mermaidSignalTextColor" onChange={onChange} />
            <ColorRow label={t("settings.color.noteBg")} value={settings.mermaidNoteBg} settingKey="mermaidNoteBg" onChange={onChange} />
            <ColorRow label={t("settings.color.noteText")} value={settings.mermaidNoteTextColor} settingKey="mermaidNoteTextColor" onChange={onChange} />
          </Section>

          <div className="text-muted mt-2 text-xs">
            {t("settings.autoSave")}
          </div>
        </div>
      </div>
    </div>
  );
}

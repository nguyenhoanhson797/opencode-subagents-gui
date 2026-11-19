/** Small, dependency-free formatting helpers for the panel. */

export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute < 1_000) return String(Math.round(value));
  if (absolute < 1_000_000) return `${(value / 1_000).toFixed(absolute < 10_000 ? 1 : 0)}k`;
  if (absolute < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return `${(value / 1_000_000_000).toFixed(1)}B`;
}

export function formatTokens(value: number): string {
  return compactNumber(value);
}

export function formatCost(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value < 0.0001) return "<$0.0001";
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return `${minutes}m ${String(rest).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

export function formatAgo(timestamp: number, now = Date.now()): string {
  if (!timestamp) return "—";
  const diff = Math.max(0, now - timestamp);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return dayFormat.format(new Date(timestamp));
}

export function formatContext(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  return `${Math.round(value / 1_000)}k`;
}

export type ParsedModel = {
  providerID: string;
  modelID: string;
  variant: string;
  /** `provider/model`, without a variant. */
  base: string;
};

export function splitModel(reference: string | undefined): ParsedModel {
  const value = (reference ?? "").trim();
  if (!value) return { providerID: "", modelID: "", variant: "", base: "" };
  const hash = value.indexOf("#");
  const withoutVariant = hash === -1 ? value : value.slice(0, hash);
  const variant = hash === -1 ? "" : value.slice(hash + 1);
  const slash = withoutVariant.indexOf("/");
  if (slash === -1) {
    return { providerID: "", modelID: withoutVariant, variant, base: withoutVariant };
  }
  return {
    providerID: withoutVariant.slice(0, slash),
    modelID: withoutVariant.slice(slash + 1),
    variant,
    base: withoutVariant,
  };
}

export function modelReference(providerID: string, modelID: string, variant?: string): string {
  if (!providerID || !modelID) return "";
  return `${providerID}/${modelID}${variant ? `#${variant}` : ""}`;
}

export function shortModel(reference: string | undefined): string {
  const parsed = splitModel(reference);
  if (!parsed.base) return "";
  return parsed.variant ? `${parsed.base}#${parsed.variant}` : parsed.base;
}

export function statusLabelKey(
  outcome: "succeeded" | "failed" | "interrupted" | undefined,
  running: boolean,
): "panel.live.running" | "panel.live.done" | "panel.live.failed" | "panel.live.interrupted" | "panel.live.idle" {
  if (running) return "panel.live.running";
  if (outcome === "succeeded") return "panel.live.done";
  if (outcome === "failed") return "panel.live.failed";
  if (outcome === "interrupted") return "panel.live.interrupted";
  return "panel.live.idle";
}

export function totalTokens(tokens: {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}): number {
  return (
    (tokens?.input ?? 0) +
    (tokens?.output ?? 0) +
    (tokens?.reasoning ?? 0) +
    (tokens?.cache?.read ?? 0) +
    (tokens?.cache?.write ?? 0)
  );
}

/**
 * Merge field rendering: replaces {{field}} tokens with values.
 * Unknown fields render as an empty string so no template ever leaks
 * "{{first_name}}" to a guest. Field names are case insensitive and
 * tolerate spaces inside the braces.
 */
export type MergeValues = Record<string, string | number | null | undefined>;

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderMergeFields(template: string, values: MergeValues): string {
  return template.replace(TOKEN, (_m, key: string) => {
    const v = values[key] ?? values[key.toLowerCase()];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}

/** Lists the distinct field names used in a template. */
export function extractMergeFields(template: string): string[] {
  const out = new Set<string>();
  for (const m of template.matchAll(TOKEN)) out.add(m[1]!.toLowerCase());
  return [...out];
}

/** Fields that appear in the template but have no value provided. */
export function missingMergeFields(template: string, values: MergeValues): string[] {
  return extractMergeFields(template).filter((f) => values[f] === null || values[f] === undefined || values[f] === "");
}

/** Escape text for safe inclusion in HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Plain text with blank-line paragraphs to simple HTML. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

import { z } from "zod";
import { escapeHtml, renderMergeFields, textToHtml, type MergeValues } from "./merge";

/** Block based email content stored on campaigns.blocks. */
export const emailBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1), type: z.literal("heading"), text: z.string().max(200) }),
  z.object({ id: z.string().min(1), type: z.literal("text"), text: z.string().max(5000) }),
  z.object({ id: z.string().min(1), type: z.literal("image"), src: z.string().max(1000), alt: z.string().max(200) }),
  z.object({ id: z.string().min(1), type: z.literal("button"), text: z.string().max(100), href: z.string().max(1000) }),
  z.object({ id: z.string().min(1), type: z.literal("divider") }),
]);

export type EmailBlock = z.infer<typeof emailBlockSchema>;
export const emailBlocksSchema = z.array(emailBlockSchema).max(40);

export interface EmailBranding {
  parkName: string;
  website: string;
  address: string;
  logoUrl?: string | null;
}

/** Safe-ish URL for links: only http(s) and merge tokens are allowed. */
function safeHref(href: string): string {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("{{")) return trimmed;
  return "#";
}

export function renderBlocksToHtml(blocks: EmailBlock[], values: MergeValues, brand: EmailBranding): string {
  const body = blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
          return `<h1 style="font-size:24px;line-height:1.25;margin:0 0 16px 0;font-weight:700;color:#111">${escapeHtml(renderMergeFields(b.text, values))}</h1>`;
        case "text":
          return textToHtml(renderMergeFields(b.text, values));
        case "image":
          return `<img src="${escapeHtml(safeHref(b.src))}" alt="${escapeHtml(b.alt)}" style="display:block;width:100%;height:auto;border-radius:6px;margin:0 0 16px 0"/>`;
        case "button":
          return `<p style="margin:8px 0 20px 0"><a href="${escapeHtml(safeHref(renderMergeFields(b.href, values)))}" style="display:inline-block;background:#a3242b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600">${escapeHtml(renderMergeFields(b.text, values))}</a></p>`;
        case "divider":
          return `<hr style="border:0;border-top:1px solid #e5e5e5;margin:20px 0"/>`;
      }
    })
    .join("\n");

  return `<!doctype html><html><body style="margin:0;background:#f3f3f3;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#222">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background:#0b0b0e;color:#fff;padding:18px 28px;font-size:20px;font-weight:700;letter-spacing:0.04em">${escapeHtml(brand.parkName)}</td></tr>
<tr><td style="padding:28px;font-size:16px">${body}</td></tr>
<tr><td style="padding:18px 28px;font-size:12px;color:#777;border-top:1px solid #eee">${escapeHtml(brand.parkName)} · ${escapeHtml(brand.address)}<br/>You're receiving this because you opted in to marketing. <a href="${escapeHtml(brand.website)}/preferences" style="color:#777">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>`;
}

export function renderBlocksToText(blocks: EmailBlock[], values: MergeValues): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
          return renderMergeFields(b.text, values).toUpperCase();
        case "text":
          return renderMergeFields(b.text, values);
        case "image":
          return `[Image: ${b.alt}]`;
        case "button":
          return `${renderMergeFields(b.text, values)}: ${renderMergeFields(b.href, values)}`;
        case "divider":
          return "----------";
      }
    })
    .join("\n\n");
}

/** Wraps a plain text automation or support message in the same branded shell. */
export function renderPlainEmailHtml(text: string, brand: EmailBranding): string {
  return renderBlocksToHtml([{ id: "t", type: "text", text }], {}, brand);
}

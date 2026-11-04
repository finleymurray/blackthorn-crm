import { describe, expect, it } from "vitest";
import { extractMergeFields, missingMergeFields, renderMergeFields, escapeHtml } from "./merge";
import { smsStats } from "./sms";
import { renderBlocksToHtml, renderBlocksToText } from "./email-blocks";

describe("renderMergeFields", () => {
  it("replaces known fields", () => {
    expect(renderMergeFields("Hi {{first_name}}, ref {{booking_reference}}", { first_name: "Chloe", booking_reference: "BTH-7K2Q" })).toBe(
      "Hi Chloe, ref BTH-7K2Q",
    );
  });
  it("tolerates spaces and case inside braces", () => {
    expect(renderMergeFields("{{ First_Name }}", { first_name: "Sam" })).toBe("Sam");
  });
  it("renders unknown or empty fields as empty strings, never the token", () => {
    expect(renderMergeFields("Hi {{first_name}}{{unknown}}!", {})).toBe("Hi !");
    expect(renderMergeFields("{{x}}", { x: null })).toBe("");
  });
  it("renders numbers", () => {
    expect(renderMergeFields("{{group_size}} tickets", { group_size: 4 })).toBe("4 tickets");
  });
  it("extracts and reports missing fields", () => {
    expect(extractMergeFields("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
    expect(missingMergeFields("{{a}} {{b}}", { a: "x" })).toEqual(["b"]);
  });
});

describe("email blocks", () => {
  const brand = { parkName: "Blackthorn Scream Park", website: "https://example.com", address: "Nottingham" };
  it("renders merge fields inside blocks and escapes html", () => {
    const html = renderBlocksToHtml(
      [
        { id: "1", type: "heading", text: "Hello {{first_name}}" },
        { id: "2", type: "text", text: "<script>alert(1)</script>" },
        { id: "3", type: "button", text: "Book", href: "https://example.com/t?ref={{booking_reference}}" },
      ],
      { first_name: "Ava", booking_reference: "BTH-AAAA" },
      brand,
    );
    expect(html).toContain("Hello Ava");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("https://example.com/t?ref=BTH-AAAA");
  });
  it("blocks javascript: links", () => {
    const html = renderBlocksToHtml([{ id: "1", type: "button", text: "x", href: "javascript:alert(1)" }], {}, brand);
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });
  it("renders a text version", () => {
    const text = renderBlocksToText([{ id: "1", type: "heading", text: "Hi" }, { id: "2", type: "divider" }], {});
    expect(text).toBe("HI\n\n----------");
  });
  it("escapes quotes", () => {
    expect(escapeHtml(`"a" & 'b'`)).toBe("&quot;a&quot; &amp; &#39;b&#39;");
  });
});

describe("smsStats", () => {
  it("counts a single GSM segment", () => {
    const s = smsStats("Hello from Blackthorn");
    expect(s).toEqual({ encoding: "GSM-7", characters: 21, segments: 1, perSegment: 160 });
  });
  it("splits long GSM messages at 153 per segment", () => {
    expect(smsStats("a".repeat(160)).segments).toBe(1);
    expect(smsStats("a".repeat(161)).segments).toBe(2);
    expect(smsStats("a".repeat(306)).segments).toBe(2);
    expect(smsStats("a".repeat(307)).segments).toBe(3);
  });
  it("counts extended characters twice", () => {
    expect(smsStats("€").characters).toBe(2);
  });
  it("switches to UCS-2 for emoji and shortens the limit", () => {
    const s = smsStats("Boo 👻 " + "a".repeat(70));
    expect(s.encoding).toBe("UCS-2");
    expect(s.segments).toBe(2);
  });
  it("handles empty", () => {
    expect(smsStats("").segments).toBe(0);
  });
});

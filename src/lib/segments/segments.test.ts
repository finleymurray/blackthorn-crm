import { describe, expect, it } from "vitest";
import { compileSegment, describeGroup } from "./compile";
import { exclusionReason, summarise } from "./consent";
import type { RuleGroup } from "./types";

describe("compileSegment", () => {
  it("compiles an empty group to true", () => {
    expect(compileSegment({ op: "and", rules: [] })).toEqual({ where: "true", params: [] });
  });

  it("joins rules with AND / OR and parameterises values", () => {
    const rules: RuleGroup = {
      op: "or",
      rules: [
        { type: "lifetime_spend", op: "gt", pence: 15000 },
        { type: "visit_count", op: "gt", value: 2 },
      ],
    };
    const out = compileSegment(rules);
    expect(out.where).toBe("(g.lifetime_spend_pence > $1) or (g.visit_count > $2)");
    expect(out.params).toEqual([15000, 2]);
  });

  it("negates rules and nests groups", () => {
    const rules: RuleGroup = {
      op: "and",
      rules: [
        { type: "visited_season", season_year: 2025 },
        { type: "booked_season", season_year: 2026, negate: true },
        { op: "or", rules: [{ type: "email_consent", value: true }, { type: "sms_consent", value: true }] },
      ],
    };
    const out = compileSegment(rules);
    expect(out.where).toMatch(/^\(exists \(select 1 from crm\.bookings b .*s\.year = \$1 .*\) and not \(exists .*s\.year = \$2 .*\) and \(\(g\.email_consent = \$3\) or \(g\.sms_consent = \$4\)\)$/s);
    expect(out.params).toEqual([2025, 2026, true, true]);
  });

  it("never interpolates user input into the SQL text", () => {
    const out = compileSegment({ op: "and", rules: [{ type: "postcode_starts", value: "N';-" }, { type: "has_tag", tag: "x'); drop table guests; --" }] });
    expect(out.where).not.toContain("drop table");
    expect(out.where).not.toContain("';-");
    expect(out.params[0]).toBe("N';-%");
    expect(out.params[1]).toBe("x'); drop table guests; --");
  });

  it("strips LIKE wildcards from postcode input and upper-cases it", () => {
    const out = compileSegment({ op: "and", rules: [{ type: "postcode_starts", value: "ng%_" }] });
    expect(out.params).toEqual(["NG%"]);
    expect(() => compileSegment({ op: "and", rules: [{ type: "postcode_starts", value: "NG1 1AA" }] })).toThrow();
  });

  it("rejects unknown rule types", () => {
    expect(() => compileSegment({ op: "and", rules: [{ type: "nope" }] })).toThrow();
  });

  it("describes a group in plain English", () => {
    expect(
      describeGroup({
        op: "and",
        rules: [
          { type: "visited_season", season_year: 2025 },
          { type: "booked_season", season_year: 2026, negate: true },
        ],
      }),
    ).toBe("visited in 2025 AND not booked in 2026");
  });
});

describe("consent exclusion", () => {
  const base = { banned: false, email_consent: true, sms_consent: true, email: "a@b.com", phone: "07700 900123" };
  it("allows a consenting guest", () => {
    expect(exclusionReason(base, "email")).toBeNull();
    expect(exclusionReason(base, "sms")).toBeNull();
  });
  it("bans beat everything", () => {
    expect(exclusionReason({ ...base, banned: true }, "email")).toBe("banned");
    expect(exclusionReason({ ...base, banned: true }, "sms")).toBe("banned");
  });
  it("requires channel specific consent", () => {
    expect(exclusionReason({ ...base, email_consent: false }, "email")).toBe("no_email_consent");
    expect(exclusionReason({ ...base, email_consent: false }, "sms")).toBeNull();
    expect(exclusionReason({ ...base, sms_consent: false }, "sms")).toBe("no_sms_consent");
  });
  it("requires an address for the channel", () => {
    expect(exclusionReason({ ...base, phone: null }, "sms")).toBe("no_phone");
    expect(exclusionReason({ ...base, phone: "  " }, "sms")).toBe("no_phone");
    expect(exclusionReason({ ...base, email: "" }, "email")).toBe("no_email");
  });
  it("summarises an audience by reason", () => {
    const s = summarise(
      [base, { ...base, sms_consent: false }, { ...base, phone: null }, { ...base, banned: true, sms_consent: false }],
      "sms",
    );
    expect(s).toEqual({ total: 4, eligible: 1, excluded: 3, reasons: { no_sms_consent: 1, no_phone: 1, banned: 1 } });
  });
});

import { describe, expect, it } from "vitest";
import { computeDueAt, formatDuration, slaState } from "./sla";
import { perPersonPence, planRefund, RefundError } from "./refunds";

const policies = { urgent: 4, high: 8, normal: 24, low: 72 };
const t0 = new Date("2026-11-04T09:00:00Z");
const h = (n: number) => new Date(t0.getTime() + n * 3_600_000);

describe("SLA", () => {
  it("derives the due time from priority", () => {
    expect(computeDueAt(t0, "urgent", policies)).toEqual(h(4));
    expect(computeDueAt(t0, "low", policies)).toEqual(h(72));
  });
  it("is green early in the window", () => {
    const s = slaState(h(24), t0, h(2));
    expect(s.status).toBe("ok");
    expect(s.label).toBe("22 h left");
    expect(s.fraction).toBeCloseTo(2 / 24);
  });
  it("goes amber under 25% of the window or under two hours", () => {
    expect(slaState(h(24), t0, h(19)).status).toBe("amber"); // 5h left < 25% of 24h
    expect(slaState(h(4), t0, h(1)).status).toBe("ok"); // 3h left: more than 2h and 75% of the window
    expect(slaState(h(4), t0, h(2.5)).status).toBe("amber"); // 1.5h left < 2h
    expect(slaState(h(72), t0, h(10)).status).toBe("ok");
  });
  it("goes red when overdue and says by how much", () => {
    const s = slaState(h(24), t0, h(27.5));
    expect(s.status).toBe("red");
    expect(s.label).toBe("Overdue by 3 h 30 min");
    expect(s.fraction).toBeGreaterThan(1);
  });
  it("reports resolved tickets against the deadline", () => {
    expect(slaState(h(24), t0, h(40), h(20)).label).toBe("Resolved within SLA");
    expect(slaState(h(24), t0, h(40), h(30)).label).toBe("Resolved 6 h late");
  });
  it("formats durations in plain English", () => {
    expect(formatDuration(30_000)).toBe("under a minute");
    expect(formatDuration(45 * 60_000)).toBe("45 min");
    expect(formatDuration(49 * 3_600_000)).toBe("2 d 1 h");
  });
});

describe("refunds", () => {
  const booking = { total_paid_pence: 12000, refunded_pence: 0, status: "confirmed" };
  it("refunds the full remaining amount and marks the booking refunded", () => {
    expect(planRefund(booking, { kind: "full" })).toEqual({
      amount_pence: 12000,
      remaining_before_pence: 12000,
      remaining_after_pence: 0,
      new_refunded_pence: 12000,
      new_status: "refunded",
    });
  });
  it("refunds part and keeps the booking confirmed", () => {
    const p = planRefund(booking, { kind: "partial", amount_pence: 3000 });
    expect(p.new_refunded_pence).toBe(3000);
    expect(p.remaining_after_pence).toBe(9000);
    expect(p.new_status).toBe("confirmed");
  });
  it("a partial refund that clears the balance marks it refunded", () => {
    const p = planRefund({ ...booking, refunded_pence: 9000 }, { kind: "partial", amount_pence: 3000 });
    expect(p.new_status).toBe("refunded");
  });
  it("never refunds more than was paid", () => {
    expect(() => planRefund(booking, { kind: "partial", amount_pence: 12001 })).toThrow(RefundError);
    expect(() => planRefund({ ...booking, refunded_pence: 5000 }, { kind: "partial", amount_pence: 7001 })).toThrow(/at most £70.00/);
  });
  it("rejects zero, negative, fractional and already refunded", () => {
    expect(() => planRefund(booking, { kind: "partial", amount_pence: 0 })).toThrow(RefundError);
    expect(() => planRefund(booking, { kind: "partial", amount_pence: -5 })).toThrow(RefundError);
    expect(() => planRefund(booking, { kind: "partial", amount_pence: 10.5 })).toThrow(RefundError);
    expect(() => planRefund({ ...booking, status: "refunded", refunded_pence: 12000 }, { kind: "full" })).toThrow(/already/);
  });
  it("suggests a per person share", () => {
    expect(perPersonPence(12000, 4)).toBe(3000);
    expect(perPersonPence(10000, 3)).toBe(3333);
    expect(perPersonPence(500, 0)).toBe(500);
  });
});

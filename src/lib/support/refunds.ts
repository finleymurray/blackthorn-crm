/**
 * Refund maths. Money is in pence. A booking can be refunded in full or in
 * part, never beyond what was paid, and the booking status flips to
 * "refunded" only when nothing refundable is left.
 */
export interface RefundableBooking {
  total_paid_pence: number;
  refunded_pence: number;
  status: string;
}

export interface RefundRequest {
  kind: "full" | "partial";
  amount_pence?: number;
}

export interface RefundPlan {
  amount_pence: number;
  remaining_before_pence: number;
  remaining_after_pence: number;
  new_refunded_pence: number;
  new_status: "refunded" | "confirmed" | "transferred" | "no_show";
}

export class RefundError extends Error {}

export function planRefund(booking: RefundableBooking, request: RefundRequest): RefundPlan {
  if (booking.status === "refunded") throw new RefundError("This booking has already been refunded in full.");
  const remaining = booking.total_paid_pence - booking.refunded_pence;
  if (remaining <= 0) throw new RefundError("There is nothing left to refund on this booking.");

  let amount: number;
  if (request.kind === "full") {
    amount = remaining;
  } else {
    const a = request.amount_pence;
    if (a === undefined || !Number.isInteger(a)) throw new RefundError("Enter a refund amount in pounds and pence.");
    if (a <= 0) throw new RefundError("The refund amount must be more than £0.00.");
    if (a > remaining) throw new RefundError(`You can refund at most £${(remaining / 100).toFixed(2)} on this booking.`);
    amount = a;
  }
  const newRefunded = booking.refunded_pence + amount;
  const after = booking.total_paid_pence - newRefunded;
  return {
    amount_pence: amount,
    remaining_before_pence: remaining,
    remaining_after_pence: after,
    new_refunded_pence: newRefunded,
    new_status: after === 0 ? "refunded" : (booking.status as RefundPlan["new_status"]),
  };
}

/** Per person share of a booking, used to suggest a partial refund for one no-show in a group. */
export function perPersonPence(total_paid_pence: number, group_size: number): number {
  if (group_size <= 0) return total_paid_pence;
  return Math.round(total_paid_pence / group_size);
}

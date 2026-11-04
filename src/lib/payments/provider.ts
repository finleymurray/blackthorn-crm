/**
 * Payment provider seam. The demo never touches real money: processRefund()
 * returns a simulated provider reference. Replace the body with a Stripe,
 * Adyen or ticketing platform call to go live. Callers already record the
 * refund row and update the booking, so only this function changes.
 */
export interface RefundInstruction {
  bookingReference: string;
  amountPence: number;
  reason: string;
}

export interface RefundReceipt {
  providerReference: string;
  processedAt: Date;
  simulated: boolean;
}

export async function processRefund(instruction: RefundInstruction): Promise<RefundReceipt> {
  const ref = `sim_rf_${Math.random().toString(36).slice(2, 12)}`;
  void instruction;
  return { providerReference: ref, processedAt: new Date(), simulated: true };
}

export interface VoucherInstruction {
  code: string;
  amountPence: number;
  expiresOn: string;
}

/** Would register the voucher code with the ticketing platform. */
export async function registerVoucher(instruction: VoucherInstruction): Promise<{ simulated: boolean }> {
  void instruction;
  return { simulated: true };
}

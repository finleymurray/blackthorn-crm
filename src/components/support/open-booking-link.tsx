"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Opens a booking as a tab inside the current ticket, keeping the list filters in the URL. */
export function OpenBookingLink({ bookingId, children, className }: { bookingId: string; children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const sp = new URLSearchParams(search.toString());
  sp.set("view", bookingId);
  return (
    <Link href={`${pathname}?${sp}`} className={className}>
      {children}
    </Link>
  );
}

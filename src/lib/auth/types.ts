export type StaffRole = "admin" | "marketing" | "support" | "front_desk";

export const STAFF_ROLES: StaffRole[] = ["admin", "marketing", "support", "front_desk"];

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  marketing: "Marketing",
  support: "Support",
  front_desk: "Front desk",
};

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
}

/** Which top level areas each role may open. */
export const ROLE_ACCESS: Record<string, StaffRole[]> = {
  "/": ["admin", "marketing", "support", "front_desk"],
  "/guests": ["admin", "marketing", "support", "front_desk"],
  "/bookings": ["admin", "marketing", "support", "front_desk"],
  "/segments": ["admin", "marketing"],
  "/campaigns": ["admin", "marketing"],
  "/automations": ["admin", "marketing"],
  "/support": ["admin", "support", "front_desk"],
  "/outbox": ["admin", "marketing", "support"],
  "/settings": ["admin"],
};

export function canAccess(role: StaffRole, pathname: string): boolean {
  const base = "/" + (pathname.split("/")[1] ?? "");
  const allowed = ROLE_ACCESS[base];
  if (!allowed) return true;
  return allowed.includes(role);
}

export function canEditGuests(role: StaffRole) {
  return role === "admin" || role === "marketing" || role === "support";
}
export function canManageSupport(role: StaffRole) {
  return role === "admin" || role === "support";
}
export function canManageMarketing(role: StaffRole) {
  return role === "admin" || role === "marketing";
}

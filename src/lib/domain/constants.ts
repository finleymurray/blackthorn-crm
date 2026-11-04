/**
 * Domain constants shared by the app and the seed script.
 * Keep these free of server-only imports.
 */

export const MAZES = [
  {
    slug: "the-hollow",
    name: "The Hollow",
    description:
      "A sunken woodland trail where the trees have grown over the path. Something moves between the trunks, and it has learned your name.",
    minAge: 12,
    isExtreme: false,
  },
  {
    slug: "ward-13",
    name: "Ward 13",
    description:
      "The abandoned isolation ward of Blackthorn Asylum. The lights fail, the patients are loose, and the night shift never clocked off.",
    minAge: 12,
    isExtreme: false,
  },
  {
    slug: "rotwood",
    name: "Rotwood",
    description:
      "A derelict sawmill deep in the estate. Rusted blades still turn, the floor is slick, and the foreman keeps the heads he collects.",
    minAge: 14,
    isExtreme: false,
  },
  {
    slug: "the-butchers-yard",
    name: "The Butcher's Yard",
    description:
      "The old slaughterhouse and its cold stores. Carcasses swing in the dark, the family is hungry, and tonight's delivery is you.",
    minAge: 14,
    isExtreme: false,
  },
  {
    slug: "static",
    name: "Static",
    description:
      "A 1980s TV studio frozen mid-broadcast. Strobes, white noise and a presenter who stopped being human a long time ago.",
    minAge: 14,
    isExtreme: false,
  },
  {
    slug: "nightfall-manor",
    name: "Nightfall Manor",
    description:
      "Our extreme 18+ experience. Full contact, total darkness, restraints and no safe word until you say it. You will be touched.",
    minAge: 18,
    isExtreme: true,
  },
] as const;

export type MazeSlug = (typeof MAZES)[number]["slug"];

export const TICKET_TYPES = [
  { key: "standard", name: "Standard", description: "Entry to all five standard mazes plus the Hollow Ground scare zone." },
  { key: "fast_track", name: "Fast Track", description: "Standard entry with priority queueing on every maze." },
  { key: "vip", name: "VIP", description: "Fast Track, Nightfall Manor entry, a hot drink and a photo pack." },
  { key: "group", name: "Group (10+)", description: "Standard entry at a group rate for parties of ten or more." },
] as const;

export type TicketTypeKey = (typeof TICKET_TYPES)[number]["key"];

export const TICKET_TYPE_LABELS: Record<TicketTypeKey, string> = {
  standard: "Standard",
  fast_track: "Fast Track",
  vip: "VIP",
  group: "Group (10+)",
};

export const ADDONS = [
  { key: "photo_pack", name: "Photo pack", pricePence: 1000 },
  { key: "merch_bundle", name: "Merch bundle", pricePence: 2500 },
  { key: "food_voucher", name: "Food voucher", pricePence: 1200 },
] as const;

export type AddonKey = (typeof ADDONS)[number]["key"];

export const ADDON_LABELS: Record<string, string> = Object.fromEntries(ADDONS.map((a) => [a.key, a.name]));

export const TICKET_CATEGORIES = [
  { key: "refund", label: "Refund", defaultPriority: "normal", sortOrder: 10 },
  { key: "booking_change", label: "Booking change", defaultPriority: "normal", sortOrder: 20 },
  { key: "accessibility", label: "Accessibility", defaultPriority: "high", sortOrder: 30 },
  { key: "lost_property", label: "Lost property", defaultPriority: "low", sortOrder: 40 },
  { key: "complaint", label: "Complaint", defaultPriority: "high", sortOrder: 50 },
  { key: "general", label: "General", defaultPriority: "normal", sortOrder: 60 },
] as const;

export const ROOT_CAUSE_TAGS = [
  { key: "queue_times", label: "Queue times" },
  { key: "actor_conduct", label: "Actor conduct" },
  { key: "refund_policy", label: "Refund policy" },
  { key: "accessibility", label: "Accessibility" },
  { key: "safety", label: "Safety" },
  { key: "website", label: "Website" },
  { key: "staff_conduct", label: "Staff conduct" },
  { key: "weather", label: "Weather" },
] as const;

export const SLA_HOURS: Record<"low" | "normal" | "high" | "urgent", number> = {
  urgent: 4,
  high: 8,
  normal: 24,
  low: 72,
};

export const TICKET_STATUS_LABELS = {
  new: "New",
  open: "Open",
  waiting_on_guest: "Waiting on guest",
  resolved: "Resolved",
} as const;

export const TICKET_PRIORITY_LABELS = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
} as const;

export const BOOKING_STATUS_LABELS = {
  confirmed: "Confirmed",
  refunded: "Refunded / void",
  transferred: "Moved",
  no_show: "No show",
} as const;

export const CONSENT_SOURCE_LABELS: Record<string, string> = {
  booking: "Booking checkout",
  web_form: "Website form",
  staff: "Updated by staff",
  import: "Imported",
  competition: "Competition entry",
  unsubscribe_link: "Unsubscribe link",
};

/** Merge fields available in templates, with a description for the editor. */
export const MERGE_FIELDS = [
  { key: "first_name", label: "First name", example: "Chloe" },
  { key: "last_name", label: "Last name", example: "Bennett" },
  { key: "full_name", label: "Full name", example: "Chloe Bennett" },
  { key: "email", label: "Email", example: "chloe@example.com" },
  { key: "booking_reference", label: "Booking reference", example: "BTH-7K2Q" },
  { key: "visit_date", label: "Visit date", example: "31/10/2026" },
  { key: "entry_time", label: "Entry time", example: "19:30" },
  { key: "ticket_type", label: "Ticket type", example: "Fast Track" },
  { key: "group_size", label: "Group size", example: "4" },
  { key: "park_name", label: "Park name", example: "Blackthorn Scream Park" },
  { key: "support_email", label: "Support email", example: "support@blackthornscreampark.co.uk" },
  { key: "ticket_number", label: "Ticket number", example: "#1042" },
  { key: "voucher_code", label: "Voucher code", example: "BTV-K7Q2M" },
  { key: "refund_amount", label: "Refund amount", example: "£28.00" },
  { key: "staff_name", label: "Staff name", example: "Priya" },
] as const;

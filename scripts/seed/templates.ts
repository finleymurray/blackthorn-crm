/** Saved replies, automation templates, segments and campaigns for the seed. */
import type { RuleGroup } from "@/lib/segments/types";

export const SAVED_REPLIES = [
  {
    title: "Refund policy explained",
    category: "refund",
    body: "Hi {{first_name}},\n\nThanks for getting in touch. Our tickets are non refundable, but we can move your booking {{booking_reference}} to another night this season free of charge, or convert it to a voucher valid for 12 months.\n\nJust reply with which you'd prefer.\n\n{{staff_name}}\nBlackthorn Guest Support",
  },
  {
    title: "Refund processed",
    category: "refund",
    body: "Hi {{first_name}},\n\nI've processed a refund of {{refund_amount}} to your original payment method for booking {{booking_reference}}. It can take 3 to 5 working days to appear depending on your bank.\n\n{{staff_name}}",
  },
  {
    title: "Booking moved",
    category: "booking_change",
    body: "Hi {{first_name}},\n\nAll done. Your booking {{booking_reference}} has been moved to {{visit_date}} with a {{entry_time}} entry. Your existing tickets will scan as normal, no need to print anything new.\n\nSee you then,\n{{staff_name}}",
  },
  {
    title: "Entry time changed",
    category: "booking_change",
    body: "Hi {{first_name}},\n\nI've changed the entry time on {{booking_reference}} to {{entry_time}} on {{visit_date}}. Please arrive 15 minutes before your slot.\n\n{{staff_name}}",
  },
  {
    title: "Access wristband arranged",
    category: "accessibility",
    body: "Hi {{first_name}},\n\nThanks for letting us know in advance. We've added a note to booking {{booking_reference}} and an access wristband will be waiting at the box office on {{visit_date}}. That gives your group use of the Fast Track lanes and a quieter waiting area at no extra cost.\n\nStep free mazes: The Hollow, Ward 13, The Butcher's Yard. Rotwood and Static have steps and Static uses strobe lighting throughout.\n\nIf there's anything else we can do, just reply.\n\n{{staff_name}}",
  },
  {
    title: "Lost property: found",
    category: "lost_property",
    body: "Hi {{first_name}},\n\nGood news, your item has been handed in and is in the site office. You can collect it from the box office on any event night with some ID, or we can post it recorded delivery for £6.50.\n\n{{staff_name}}",
  },
  {
    title: "Lost property: not found yet",
    category: "lost_property",
    body: "Hi {{first_name}},\n\nSorry to hear that. Nothing matching that description has been handed in yet. The mazes are swept at the end of every night and anything found goes to the site office. I've logged your details and will let you know if it turns up in the next 14 days.\n\n{{staff_name}}",
  },
  {
    title: "Complaint acknowledged",
    category: "complaint",
    body: "Hi {{first_name}},\n\nThank you for taking the time to tell us about your visit on {{visit_date}}. I'm sorry it fell short. I'm looking into what happened and will come back to you with a full response within two working days.\n\n{{staff_name}}\nBlackthorn Guest Support",
  },
  {
    title: "Voucher issued",
    category: "general",
    body: "Hi {{first_name}},\n\nI've issued you a voucher, code {{voucher_code}}, which you can use on any night this season or next. Enter it at checkout on our website.\n\n{{staff_name}}",
  },
  {
    title: "Tickets resent",
    category: "general",
    body: "Hi {{first_name}},\n\nI've resent the tickets for {{booking_reference}} to {{email}}. They should arrive within a few minutes. If they don't, check your junk folder, and if they're still missing just show this email and your booking reference at the box office.\n\n{{staff_name}}",
  },
];

export const AUTOMATIONS = [
  {
    trigger: "booking_confirmed",
    name: "Booking confirmation",
    description: "Sent immediately after a booking is made.",
    channel: "email",
    delay_minutes: 0,
    subject: "You're booked: {{park_name}} on {{visit_date}}",
    body: "Hi {{first_name}},\n\nYour tickets are confirmed. Here's what you need to know.\n\nBooking reference: {{booking_reference}}\nDate: {{visit_date}}\nEntry time: {{entry_time}}\nTickets: {{group_size}} x {{ticket_type}}\n\nPlease arrive 15 minutes before your entry time with this email on your phone. Wear sturdy shoes and something warm: the paths are outdoors and it gets cold.\n\nNightfall Manor is strictly 18+ and ID will be checked.\n\nSee you in the dark,\nThe Blackthorn team",
  },
  {
    trigger: "reminder_48h",
    name: "Visit reminder",
    description: "Sent 48 hours before the visit.",
    channel: "email",
    delay_minutes: -2880,
    subject: "Two sleeps to go, {{first_name}}",
    body: "Hi {{first_name}},\n\nYou're visiting {{park_name}} on {{visit_date}} with a {{entry_time}} entry. A few reminders:\n\n- Bring your booking reference {{booking_reference}} on your phone\n- Parking opens one hour before entry. Follow the signs from Oxton Road\n- The forecast is looking cold, so layer up\n- Chicken-out points are in every maze. No shame in using them\n\nSee you soon,\nThe Blackthorn team",
  },
  {
    trigger: "post_visit_survey",
    name: "Post visit survey",
    description: "Sent at 10:00 the morning after a visit.",
    channel: "email",
    delay_minutes: 0,
    send_at_time: "10:00",
    subject: "How was your night, {{first_name}}?",
    body: "Hi {{first_name}},\n\nThanks for braving {{park_name}} last night. We'd love to know how it went. Our two minute survey asks you to score the night and each maze you went in.\n\nEveryone who completes it goes into the draw for VIP tickets next season.\n\nTake the survey: {{survey_link}}\n\nThe Blackthorn team",
  },
  {
    trigger: "win_back",
    name: "Win back last season's guests",
    description: "Sent in September to guests who came last season but haven't booked this one.",
    channel: "email",
    delay_minutes: 0,
    subject: "We've missed you, {{first_name}}",
    body: "Hi {{first_name}},\n\nLast year you made it out alive. This year we've rebuilt The Hollow, doubled the actors in Rotwood and added a brand new finale to Nightfall Manor.\n\nTickets for the 2026 season are on sale now and Saturdays are already going fast. Use code BACK10 for 10% off any night in October.\n\nBook now: {{booking_link}}\n\nThe Blackthorn team",
  },
] as const;

export const SEGMENTS: Array<{ name: string; description: string; rules: RuleGroup }> = [
  {
    name: "2025 guests not yet booked for 2026",
    description: "Came last season but have no 2026 booking. The win back audience.",
    rules: {
      op: "and",
      rules: [
        { type: "visited_season", season_year: 2025 },
        { type: "booked_season", season_year: 2026, negate: true },
      ],
    },
  },
  {
    name: "Happy guests with SMS consent",
    description: "Scored us 8 or more in a survey and can be texted.",
    rules: {
      op: "and",
      rules: [
        { type: "survey_score", op: "gt", value: 7 },
        { type: "sms_consent", value: true },
      ],
    },
  },
  {
    name: "VIP and Fast Track buyers",
    description: "Guests who have paid for a premium ticket at least once.",
    rules: {
      op: "or",
      rules: [
        { type: "booked_ticket_type", ticket_type: "vip" },
        { type: "booked_ticket_type", ticket_type: "fast_track" },
      ],
    },
  },
  {
    name: "Nottingham locals",
    description: "NG postcodes with email consent.",
    rules: {
      op: "and",
      rules: [
        { type: "postcode_starts", value: "NG" },
        { type: "email_consent", value: true },
      ],
    },
  },
  {
    name: "Big spenders",
    description: "Lifetime spend over £150 or three or more visits.",
    rules: {
      op: "or",
      rules: [
        { type: "lifetime_spend", op: "gt", pence: 15000 },
        { type: "visit_count", op: "gt", value: 2 },
      ],
    },
  },
];

export type EmailBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; src: string; alt: string }
  | { id: string; type: "button"; text: string; href: string }
  | { id: string; type: "divider" };

export const CAMPAIGNS: Array<{
  name: string;
  channel: "email" | "sms";
  segment: string;
  subject?: string;
  preheader?: string;
  blocks?: EmailBlock[];
  sms_body?: string;
  status: "draft" | "scheduled" | "sent";
  sent_at?: string;
  scheduled_for?: string;
}> = [
  {
    name: "2026 season launch",
    channel: "email",
    segment: "Big spenders",
    subject: "The gates open 2 October. Are you brave enough, {{first_name}}?",
    preheader: "Six mazes. One new finale. Tickets on sale now.",
    status: "sent",
    sent_at: "2026-09-04T18:30:00Z",
    blocks: [
      { id: "b1", type: "image", src: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=1200", alt: "A dark forest path lit by a single red light" },
      { id: "b2", type: "heading", text: "Blackthorn returns 2 October" },
      { id: "b3", type: "text", text: "Hi {{first_name}},\n\nSomething has been growing in the woods all summer. The Hollow has been rebuilt from the roots up, Rotwood has twice the crew, and Nightfall Manor has a finale we are not allowed to describe in an email.\n\nAs one of our regulars you get first pick of the dates before general sale on Monday." },
      { id: "b4", type: "button", text: "Book priority tickets", href: "https://blackthornscreampark.co.uk/tickets?src=launch26" },
      { id: "b5", type: "divider" },
      { id: "b6", type: "text", text: "Saturdays sold out by mid September last year. Don't say we didn't warn you." },
    ],
  },
  {
    name: "Halloween week: last tickets",
    channel: "sms",
    segment: "Nottingham locals",
    sms_body: "Blackthorn: Fri 30 & Sat 31 Oct are 90% sold. Thu 29 still has space & is 20% off with code THURS20. Book: bthorn.uk/hw {{first_name}}, reply STOP to opt out",
    status: "sent",
    sent_at: "2026-10-24T11:00:00Z",
  },
  {
    name: "Win back 2025 guests",
    channel: "email",
    segment: "2025 guests not yet booked for 2026",
    subject: "We saved you a spot in the dark, {{first_name}}",
    preheader: "10% off October nights with code BACK10",
    status: "draft",
    blocks: [
      { id: "b1", type: "heading", text: "We've missed you" },
      { id: "b2", type: "text", text: "Hi {{first_name}},\n\nLast season you made it out alive. This season is bigger, darker and colder. Use BACK10 for 10% off any October night." },
      { id: "b3", type: "button", text: "Claim 10% off", href: "https://blackthornscreampark.co.uk/tickets?code=BACK10" },
    ],
  },
  {
    name: "Christmas gift vouchers",
    channel: "email",
    segment: "VIP and Fast Track buyers",
    subject: "Give the gift of fear this Christmas",
    preheader: "2027 vouchers now available, 15% off until 1 December",
    status: "scheduled",
    scheduled_for: "2026-11-20T09:00:00Z",
    blocks: [
      { id: "b1", type: "heading", text: "Give the gift of fear" },
      { id: "b2", type: "text", text: "Hi {{first_name}},\n\n2027 gift vouchers are now available, and until 1 December they're 15% off. They never expire within the season and work on any ticket type, including Nightfall Manor." },
      { id: "b3", type: "button", text: "Buy a voucher", href: "https://blackthornscreampark.co.uk/vouchers" },
      { id: "b4", type: "divider" },
      { id: "b5", type: "text", text: "Vouchers are emailed instantly, so this works on Christmas Eve too." },
    ],
  },
];

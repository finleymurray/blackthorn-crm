/** Realistic inbound emails for the "Simulate inbound email" button. Merge fields are filled from a random guest. */
export const SIMULATED_INBOUND: Array<{ category: string; subject: string; body: string; source: "email" | "web_form" }> = [
  {
    category: "refund",
    source: "email",
    subject: "Refund for tonight - snowed in",
    body: "Hi, we're booked for tonight ({{booking_reference}}) but the A52 is closed with snow and we can't get there from Derby. Can we have a refund or move to next week?\n\n{{first_name}}",
  },
  {
    category: "booking_change",
    source: "web_form",
    subject: "Change name on booking",
    body: "My friend can't come anymore so someone else is taking her ticket. Does the name on {{booking_reference}} matter at the gate? We're coming on {{visit_date}}.",
  },
  {
    category: "complaint",
    source: "email",
    subject: "Hour queue for Ward 13 and rude staff",
    body: "We were there on {{visit_date}} and queued over an hour for Ward 13 then got told to 'hurry up' by the staff at the entrance. Not what I expect for £44 a ticket. Booking {{booking_reference}}. I want to know what you're going to do about it.\n\n{{first_name}} {{last_name}}",
  },
  {
    category: "lost_property",
    source: "web_form",
    subject: "Lost glasses in Static",
    body: "I lost my glasses (black Ray-Ban frames) somewhere in Static on {{visit_date}}. Can't see a thing without them. Have they been handed in? Booking ref {{booking_reference}}.",
  },
  {
    category: "accessibility",
    source: "email",
    subject: "Hearing impaired visitor",
    body: "My dad is coming with us on {{visit_date}} ({{booking_reference}}) and is profoundly deaf. Are there any mazes with verbal instructions he might miss, and can the staff be told in advance?\n\nThanks,\n{{first_name}}",
  },
  {
    category: "general",
    source: "web_form",
    subject: "Gift vouchers for Christmas?",
    body: "Do you sell gift vouchers? I want to get my brother tickets for next season as a Christmas present. He came with us this year on {{booking_reference}} and hasn't stopped talking about it.",
  },
  {
    category: "refund",
    source: "email",
    subject: "Charged but no confirmation",
    body: "I paid for four Fast Track tickets for {{visit_date}} about an hour ago and the money has left my account, but I haven't had a confirmation email. My booking ref might be {{booking_reference}} from a previous attempt. Please can you check?\n\n{{first_name}}",
  },
  {
    category: "general",
    source: "email",
    subject: "Is Nightfall Manor suitable for a stag do?",
    body: "Twelve of us coming on {{visit_date}}, ref {{booking_reference}}. The groom is terrified of the dark. Is Nightfall Manor a good idea or will he actually have a heart attack? Asking for a friend.",
  },
];

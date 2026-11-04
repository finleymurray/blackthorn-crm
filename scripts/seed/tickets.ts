/**
 * Support ticket templates. Merge fields are filled by the seed script:
 * {{first_name}}, {{booking_reference}}, {{visit_date}}, {{staff_name}}
 */
export interface TicketTemplate {
  category: "refund" | "booking_change" | "accessibility" | "lost_property" | "complaint" | "general";
  priority: "low" | "normal" | "high" | "urgent";
  subject: string;
  /** Alternating inbound / outbound messages, optionally with internal notes. */
  thread: Array<{ direction: "inbound" | "outbound" | "internal_note"; body: string }>;
  /** Root cause to apply when the template is a complaint that gets resolved. */
  rootCause?: string;
  finalResponse?: string;
  needsBooking?: boolean;
}

export const TICKET_TEMPLATES: TicketTemplate[] = [
  // Refunds
  {
    category: "refund",
    priority: "normal",
    needsBooking: true,
    subject: "Refund request - can't make our date",
    thread: [
      {
        direction: "inbound",
        body: "Hi,\n\nWe booked for {{visit_date}} (ref {{booking_reference}}) but my partner has been admitted to hospital so we can't make it. Is there any chance of a refund or moving the tickets? Happy with a voucher if that's easier.\n\nThanks,\n{{first_name}}",
      },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nSorry to hear that, I hope your partner is on the mend. Our tickets are normally non refundable, but given the circumstances I've moved your booking to a voucher you can use on any night this season or next.\n\nYour voucher code is in a separate email. If you'd rather pick a new date now, just reply with the night you'd like.\n\nBest wishes,\n{{staff_name}}\nBlackthorn Guest Support",
      },
    ],
  },
  {
    category: "refund",
    priority: "high",
    needsBooking: true,
    subject: "Charged twice for booking {{booking_reference}}",
    thread: [
      {
        direction: "inbound",
        body: "Your website hung when I paid and I pressed the button again. I've now got two charges of the same amount on my card but only one confirmation email ({{booking_reference}}). Please refund the duplicate asap.",
      },
      { direction: "internal_note", body: "Checked the payment provider: two captures 40 seconds apart. Second has no booking attached. Refunding the duplicate in full." },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nApologies for that. I can see the duplicate payment and have refunded it in full. It can take 3 to 5 working days to show on your statement depending on your bank.\n\nYour booking {{booking_reference}} is unaffected and we'll see you on {{visit_date}}.\n\n{{staff_name}}",
      },
      { direction: "inbound", body: "Brilliant, thanks for the quick turnaround." },
    ],
  },
  {
    category: "refund",
    priority: "normal",
    needsBooking: true,
    subject: "Partial refund - one of our group couldn't come",
    thread: [
      {
        direction: "inbound",
        body: "Hello, we had six tickets on {{booking_reference}} but one of our party was ill and didn't attend on {{visit_date}}. Could we get the cost of that ticket back?",
      },
    ],
  },
  {
    category: "refund",
    priority: "normal",
    needsBooking: true,
    subject: "Rained off on Friday",
    thread: [
      {
        direction: "inbound",
        body: "We were there on {{visit_date}} and it absolutely poured. The Hollow was closed for over an hour because of flooding and we only got through three mazes before closing. I don't think that's what we paid for. Can we have some money back?",
      },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nYou're right, Friday was grim and we had to close The Hollow for safety while the path drained. We don't refund for weather, but we don't think three mazes is a fair night either, so I've issued a 50% voucher towards another visit. The code is on its way in a separate email.\n\nThanks for your patience,\n{{staff_name}}",
      },
    ],
  },
  // Booking changes
  {
    category: "booking_change",
    priority: "normal",
    needsBooking: true,
    subject: "Move booking to a different night",
    thread: [
      {
        direction: "inbound",
        body: "Hi, is it possible to move {{booking_reference}} from {{visit_date}} to the following Saturday? Work has put me on a late shift. Same number of people.\n\nCheers,\n{{first_name}}",
      },
    ],
  },
  {
    category: "booking_change",
    priority: "normal",
    needsBooking: true,
    subject: "Add two more people to our booking",
    thread: [
      {
        direction: "inbound",
        body: "We've got four tickets on {{booking_reference}} and two friends now want to join. Can I add them to the same entry slot so we all go in together? Happy to pay the difference.",
      },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nYes, that slot still has space. Easiest thing is to book two more Standard tickets on the website for the same time and reply with the new reference, and I'll link them so you're all let in together.\n\n{{staff_name}}",
      },
      { direction: "inbound", body: "Done, new ref is in the confirmation. Thanks!" },
    ],
  },
  {
    category: "booking_change",
    priority: "low",
    needsBooking: true,
    subject: "Wrong entry time selected",
    thread: [
      {
        direction: "inbound",
        body: "I think I picked 18:30 instead of 20:30 by mistake on {{booking_reference}}. We won't be able to get there from Leicester by half six. Can you change it?",
      },
    ],
  },
  {
    category: "booking_change",
    priority: "normal",
    needsBooking: true,
    subject: "Upgrade to Fast Track",
    thread: [
      {
        direction: "inbound",
        body: "Hello, booking {{booking_reference}} for {{visit_date}}. Having read the reviews about queues on Saturdays, can we upgrade the whole group to Fast Track? Four people.",
      },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nGood call for a Saturday. I've upgraded all four tickets to Fast Track and sent a payment link for the difference. Once that's paid your tickets will update automatically.\n\n{{staff_name}}",
      },
    ],
  },
  // Accessibility
  {
    category: "accessibility",
    priority: "high",
    needsBooking: true,
    subject: "Wheelchair access and strobe lighting",
    thread: [
      {
        direction: "inbound",
        body: "Hi,\n\nMy son (14) is coming with us on {{visit_date}}, booking {{booking_reference}}. He uses a wheelchair and is also photosensitive. Could you let me know which mazes are step free and whether the strobes can be switched off in any of them? We'd also appreciate not being made to queue in the cold for long if that's possible.\n\nThank you,\n{{first_name}}",
      },
      {
        direction: "internal_note",
        body: "Flagged to ops. The Hollow, Ward 13 and Butcher's Yard are step free. Rotwood and Static have steps and Static is strobe heavy. We can do a no-strobe walkthrough of Static at 19:00 before the main run. Added accessibility flag to guest.",
      },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nThanks for letting us know in advance. Here's what we can do:\n\n- The Hollow, Ward 13 and The Butcher's Yard are fully step free.\n- Rotwood and Static have steps, but there is a bypass route for Rotwood that keeps most of the scares.\n- Static uses strobes throughout, so we've arranged a no-strobe walkthrough at 19:00 for your group before the main run. Please ask for Jess at the Static entrance.\n- You'll get an access wristband at the gate so you can use the Fast Track lanes with no extra cost, which keeps queueing to a minimum.\n\nIf anything changes just reply here.\n\n{{staff_name}}",
      },
      { direction: "inbound", body: "That is wonderful, thank you so much. He's going to be made up." },
    ],
  },
  // Lost property
  {
    category: "lost_property",
    priority: "low",
    needsBooking: true,
    subject: "Lost phone in Rotwood",
    thread: [
      {
        direction: "inbound",
        body: "I'm pretty sure I dropped my phone (black iPhone, cracked case with a cat on it) somewhere in Rotwood on {{visit_date}}. Ref {{booking_reference}}. Has anything been handed in?",
      },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nGood news, a black iPhone with a cat case was handed in by the Rotwood crew at the end of the night. It's in the site office. You can collect it any event night from the box office with some ID, or we can post it recorded delivery if you cover the postage (£6.50).\n\n{{staff_name}}",
      },
    ],
  },
  {
    category: "lost_property",
    priority: "low",
    subject: "Car keys",
    thread: [
      {
        direction: "inbound",
        body: "Lost a set of Ford keys with a Forest keyring on Saturday night, possibly in the queue for Ward 13 or the food area. Had to get the AA out. Please tell me they've turned up.",
      },
    ],
  },
  {
    category: "lost_property",
    priority: "low",
    subject: "Left a coat in the VIP lounge",
    thread: [
      {
        direction: "inbound",
        body: "Hi, I left a green North Face jacket on the back of a chair in the VIP lounge last night. Would really like it back, my train pass is in the pocket.",
      },
      { direction: "outbound", body: "Hi {{first_name}}, yes we have it. It's in the box office with your name on. Collect any event night, or reply with a postal address.\n\n{{staff_name}}" },
      { direction: "inbound", body: "Amazing, I'll come Friday. Thank you." },
    ],
  },
  // Complaints
  {
    category: "complaint",
    priority: "high",
    needsBooking: true,
    rootCause: "queue_times",
    subject: "Appalling queue times on Halloween - want a refund",
    finalResponse:
      "We're sorry your Halloween night fell well short of what you paid for. Queue times on 31/10 exceeded our targets across the park because of a power fault that closed Static for 50 minutes. As a gesture we have issued a full value voucher for a future visit and have shared your feedback with our operations team, who are increasing maze throughput for next season.",
    thread: [
      {
        direction: "inbound",
        body: "I'm writing to complain about our visit on {{visit_date}}, booking {{booking_reference}}.\n\nWe paid for six Standard tickets. We queued 85 minutes for Static, which then closed while we were in the queue, 70 minutes for Ward 13 and over an hour for The Butcher's Yard. We did not get into The Hollow or Rotwood at all before you closed. That's three mazes in five hours.\n\nYour queue boards said 30 minutes all night. That is just not true and feels like you were deliberately misleading people.\n\nI'd like a full refund. I've attached photos of the queue boards.\n\n{{first_name}}",
      },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nThank you for taking the time to write, and I'm sorry. Halloween night was our busiest ever and we had a power fault at Static that made things much worse. That doesn't excuse the queue boards being wrong, and I've passed that to our operations manager.\n\nI'd like to look at this properly rather than send a stock reply. Can you confirm which entry slot you arrived for and roughly what time you left? I'll come back to you by tomorrow.\n\n{{staff_name}}",
      },
      { direction: "inbound", body: "We arrived at 19:00 for our 19:30 slot and left at about 23:15 when it was obvious we weren't getting in anywhere else. I'd still like the refund rather than a voucher, we're not local." },
      { direction: "internal_note", body: "Static closure 20:10 to 21:00 confirmed by ops, and the queue boards were showing stale times all night. Recommending full value voucher plus apology; if guest insists on cash, escalate to Eleanor." },
    ],
  },
  {
    category: "complaint",
    priority: "urgent",
    needsBooking: true,
    rootCause: "actor_conduct",
    subject: "Actor grabbed my daughter - formal complaint",
    finalResponse:
      "We have completed our investigation. The actor involved has been stood down from performing for the remainder of the season and all Butcher's Yard performers have been re-briefed on the no contact rule in standard mazes. We apologise unreservedly, have refunded your booking in full and would welcome you back as our guests.",
    thread: [
      {
        direction: "inbound",
        body: "On {{visit_date}} (booking {{booking_reference}}) an actor in The Butcher's Yard grabbed my 15 year old daughter by the upper arm and pulled her towards him. She has a visible bruise today, photos attached. This is NOT the extreme maze and your website says actors will not touch guests in the standard mazes.\n\nI want to know what you are going to do about this. I have not yet contacted the police but I will if I don't hear back promptly.\n\n{{first_name}}",
      },
      {
        direction: "internal_note",
        body: "URGENT. Escalated to Eleanor and the show director. Pulling CCTV from Butcher's Yard room 4 for the 20:00 to 21:00 window. Actor rota for that room is Danny M and Steph K. Do not send anything until Eleanor has reviewed.",
      },
      {
        direction: "outbound",
        body: "Dear {{first_name}},\n\nI'm so sorry. What you've described is completely unacceptable and against everything we train our performers to do. I've escalated this to our General Manager and show director this morning and we are reviewing the camera footage from that part of the maze now.\n\nYou will hear from Eleanor Vance, our General Manager, personally within 24 hours. In the meantime, I hope your daughter is okay.\n\n{{staff_name}}",
      },
      { direction: "inbound", body: "Thank you for taking it seriously. She's shaken but fine. I'll wait to hear from Eleanor." },
    ],
  },
  {
    category: "complaint",
    priority: "high",
    needsBooking: true,
    rootCause: "refund_policy",
    subject: "Refused refund for sold out night I couldn't attend",
    thread: [
      {
        direction: "inbound",
        body: "I phoned on Friday to say I couldn't attend on {{visit_date}} ({{booking_reference}}) because of a family bereavement and was told flatly 'no refunds'. Your night was sold out, so you could easily have resold my tickets. I think this is a disgusting way to treat customers and I will be leaving reviews to that effect.",
      },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nI'm really sorry for your loss, and sorry that the call left you feeling that way. Our terms do say tickets are non refundable, but we have discretion for bereavement and that should have been offered. I've refunded the booking in full today.\n\n{{staff_name}}",
      },
      { direction: "inbound", body: "Thank you. I appreciate that. It should have happened on the phone but I'm glad it's sorted." },
    ],
  },
  {
    category: "complaint",
    priority: "normal",
    rootCause: "website",
    subject: "Website kept crashing during Halloween ticket release",
    thread: [
      {
        direction: "inbound",
        body: "Tried for 45 minutes to buy Halloween tickets when they went on sale and your site kept timing out. By the time it worked, Saturday was sold out. Really frustrating for people who've been coming for years.",
      },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nYou're not the only one and I'm sorry. The release saw about ten times the traffic we'd planned for and the booking site struggled. We've added capacity for next year's release. As a thank you for your loyalty I've added you to the priority access list so you'll get a link 24 hours before general sale in 2027.\n\n{{staff_name}}",
      },
    ],
  },
  {
    category: "complaint",
    priority: "high",
    needsBooking: true,
    rootCause: "safety",
    subject: "Slipped on mud path near Rotwood",
    thread: [
      {
        direction: "inbound",
        body: "My wife slipped on the unlit, unmade path between Rotwood and The Butcher's Yard on {{visit_date}} and has sprained her wrist. There was no gravel down and no lighting. A first aider helped on the night (thank you to him) but I want this recorded and to know what you'll do to prevent it.",
      },
      { direction: "internal_note", body: "First aid log confirms incident at 21:40, treated by Sam. Ops laid gravel and added two tower lights on that path the next morning. Replied with details; need final response for complaint close." },
    ],
  },
  // General
  {
    category: "general",
    priority: "normal",
    subject: "Is Nightfall Manor really 18+?",
    thread: [
      {
        direction: "inbound",
        body: "My son is 17 and a half and desperate to do Nightfall Manor. Can he go in if I sign something? He's done every other maze twice.",
      },
      {
        direction: "outbound",
        body: "Hi {{first_name}},\n\nI'm afraid not. Nightfall Manor is strictly 18+ with ID checked at the door and no exceptions, even with parental consent. It involves physical contact and restraint and our insurance is specific about it. He'll be very welcome next year!\n\n{{staff_name}}",
      },
    ],
  },
  {
    category: "general",
    priority: "low",
    subject: "Group booking for a works do",
    thread: [
      {
        direction: "inbound",
        body: "Hi, I'm organising a team night out for about 25 people from our Nottingham office in October. Do you do group rates and can we book a private area for food before?",
      },
    ],
  },
  {
    category: "general",
    priority: "normal",
    subject: "Do you allow dogs?",
    thread: [
      { direction: "inbound", body: "Random one but can we bring our dog? He's very chilled." },
      { direction: "outbound", body: "Hi {{first_name}}, only assistance dogs I'm afraid. With the noise, fog and actors it wouldn't be fair on him. See you soon though!\n\n{{staff_name}}" },
    ],
  },
  {
    category: "general",
    priority: "low",
    subject: "Photo pack never arrived",
    needsBooking: true,
    thread: [
      { direction: "inbound", body: "We bought the photo pack with {{booking_reference}} on {{visit_date}} but haven't had the download link. Can you resend?" },
      { direction: "outbound", body: "Hi {{first_name}}, sorry about that. I've resent the link to this address, it should be with you in a few minutes. Check junk if not.\n\n{{staff_name}}" },
      { direction: "inbound", body: "Got it, cheers. Love the one of my mate's face in Ward 13." },
    ],
  },
  {
    category: "general",
    priority: "normal",
    subject: "Tickets not showing in email",
    needsBooking: true,
    thread: [
      { direction: "inbound", body: "I booked {{booking_reference}} for {{visit_date}} but the email just says 'your tickets are attached' and there's nothing attached. We're coming tomorrow, bit worried." },
    ],
  },
  {
    category: "general",
    priority: "normal",
    subject: "Unsubscribe me from texts",
    thread: [
      { direction: "inbound", body: "Please stop sending me texts. Three in a week is too many. Keep the emails." },
      { direction: "outbound", body: "Hi {{first_name}}, done, you won't get any more texts from us. Sorry for the noise during Halloween week.\n\n{{staff_name}}" },
    ],
  },
  {
    category: "general",
    priority: "normal",
    subject: "Can I come in costume?",
    thread: [
      { direction: "inbound", body: "Planning to come as Pennywise on {{visit_date}}. Is that allowed? Don't want to get turned away at the gate." },
      { direction: "outbound", body: "Hi {{first_name}}, costumes are welcome but no masks that cover the face and no props that could be mistaken for weapons. A clown face is fine, a toy knife is not. Enjoy!\n\n{{staff_name}}" },
    ],
  },
];

/** Fresh, unanswered emails for the inbox queue. First message only; staff work them live. */
export const NEW_INBOUND: Array<{ category: TicketTemplate["category"]; priority?: TicketTemplate["priority"]; subject: string; body: string; source: "email" | "web_form" }> = [
  { category: "refund", source: "email", subject: "Can't attend Saturday - car written off", body: "Hi, I was in an accident on Thursday (I'm fine, car isn't) and there's no way I can get to you on {{visit_date}}. Booking {{booking_reference}}, four Fast Track. Is there anything you can do? Even a voucher would help.\n\n{{first_name}}" },
  { category: "refund", source: "web_form", subject: "Double booked by accident", body: "I think I've booked twice for the same night. {{booking_reference}} and another one I can't find the ref for, same email. Can you refund one of them please?" },
  { category: "booking_change", source: "email", subject: "Change entry time to later", body: "Our train gets into Nottingham at 19:10 so we won't make the 19:00 slot on {{booking_reference}}. Can we switch to 20:30? Three of us.\n\nThanks, {{first_name}}" },
  { category: "booking_change", source: "web_form", subject: "Swap Standard for VIP", body: "It's my partner's 30th on {{visit_date}}. Can we upgrade {{booking_reference}} to VIP for both of us? Happy to pay the difference by card over the phone." },
  { category: "booking_change", source: "email", subject: "One less person", body: "One of our group of five has dropped out for {{visit_date}} ({{booking_reference}}). Do we need to do anything or will the spare ticket just not get used?" },
  { category: "accessibility", source: "email", subject: "Autistic son - quiet entry?", body: "My son is 13 and autistic. He is desperate to come on {{visit_date}} ({{booking_reference}}) but crowds and queue noise are really hard for him. Is there any kind of quiet or early entry we could use? He has a sunflower lanyard.\n\n{{first_name}}" },
  { category: "accessibility", source: "web_form", subject: "Mobility scooter", body: "Can my mum bring her mobility scooter around the park paths? She can walk short distances so wouldn't take it into the mazes. Booking {{booking_reference}}." },
  { category: "lost_property", source: "email", subject: "Lost AirPods case in the Hollow queue", body: "Dropped a white AirPods case (with the AirPods in it, annoyingly) in the queue for The Hollow on {{visit_date}}. Ref {{booking_reference}}. Any chance it's been found?" },
  { category: "lost_property", source: "web_form", subject: "Left a hoodie at the bar", body: "Grey Carhartt hoodie left on the bench by the bar, {{visit_date}}. Sentimental value, it was a gift. {{first_name}}" },
  { category: "complaint", source: "email", subject: "Fog machine set off my asthma", body: "The fog in Static was so thick on {{visit_date}} I had an asthma attack and had to be taken out by staff. Nobody warned us about the level of fog. I'd like to understand what you're going to do about this. Booking {{booking_reference}}.\n\n{{first_name}} {{last_name}}" },
  { category: "complaint", source: "web_form", subject: "Rude bar staff", body: "The lad on the bar on {{visit_date}} was openly rude to my wife when she asked about allergens. Not acceptable for £7 a drink. Ref {{booking_reference}}." },
  { category: "complaint", source: "email", subject: "Nightfall Manor was shut and no refund offered", body: "We paid for VIP specifically for Nightfall Manor on {{visit_date}} ({{booking_reference}}) and it was closed all night with a handwritten sign. Nobody at the gate mentioned it. I want the difference between VIP and Standard back for all four of us." },
  { category: "general", source: "email", subject: "School trip enquiry - Year 11", body: "I teach at a secondary school in Mansfield and we're looking at bringing around 40 Year 11 students in October 2027 as a reward trip. Do you do school rates and what are the age rules for the mazes?" },
  { category: "general", source: "web_form", subject: "Is the car park gravel or grass?", body: "Silly question but my car is very low. Is the parking on hard standing? Coming on {{visit_date}}." },
  { category: "general", source: "email", subject: "Can we bring our own food?", body: "My daughter has coeliac disease. Can we bring our own food in on {{visit_date}}, or is there a gluten free option at the food vans? Ref {{booking_reference}}." },
  { category: "general", source: "web_form", subject: "Job application - scare actor", body: "Hi, I'm a drama student at NTU and I'd love to work as an actor next season. Who do I send a CV to?" },
  { category: "general", source: "email", subject: "Photo pack download link expired", body: "The photo download link for {{booking_reference}} says it has expired. We were there on {{visit_date}}. Can you resend it?" },
  { category: "booking_change", source: "email", subject: "Add Fast Track to existing booking", body: "Can I add Fast Track to {{booking_reference}} for {{visit_date}}? There are two of us. I've seen the Saturday queue reviews.\n\n{{first_name}}" },
];

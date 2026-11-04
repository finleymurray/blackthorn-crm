/** Name, place and text pools for realistic UK demo data. */

export const FIRST_NAMES = [
  "Oliver", "George", "Harry", "Noah", "Jack", "Leo", "Charlie", "Jacob", "Freddie", "Alfie", "Oscar", "Arthur",
  "Henry", "Archie", "Thomas", "Joshua", "James", "William", "Max", "Lucas", "Ethan", "Mason", "Logan", "Isaac",
  "Daniel", "Finley", "Theo", "Samuel", "Edward", "Joseph", "Adam", "Ryan", "Liam", "Callum", "Connor", "Kieran",
  "Jamie", "Lewis", "Luke", "Ben", "Matthew", "Nathan", "Dylan", "Kyle", "Aaron", "Jordan", "Owen", "Rhys",
  "Olivia", "Amelia", "Isla", "Ava", "Emily", "Mia", "Isabella", "Sophia", "Grace", "Lily", "Freya", "Ella",
  "Charlotte", "Poppy", "Evie", "Sophie", "Ruby", "Alice", "Jessica", "Daisy", "Florence", "Chloe", "Phoebe",
  "Millie", "Sienna", "Holly", "Lucy", "Hannah", "Georgia", "Megan", "Lauren", "Abbie", "Ellie", "Katie", "Jade",
  "Bethany", "Shannon", "Leah", "Rebecca", "Molly", "Niamh", "Amy", "Zoe", "Erin", "Rachel", "Laura", "Gemma",
  "Priya", "Aisha", "Zara", "Fatima", "Maryam", "Hamza", "Yusuf", "Ibrahim", "Ayaan", "Kai", "Jayden", "Tyler",
  "Kayleigh", "Courtney", "Danielle", "Stacey", "Kerry", "Donna", "Claire", "Nicola", "Sarah", "Karen", "Helen",
  "Mark", "Paul", "Dave", "Steve", "Gary", "Craig", "Lee", "Darren", "Wayne", "Dean", "Scott", "Carl",
];

export const LAST_NAMES = [
  "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright", "Thompson",
  "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke", "Harris", "Lewis", "Turner",
  "Hill", "Cooper", "Ward", "Morris", "Moore", "Clark", "Lee", "King", "Baker", "Harrison", "Morgan", "Allen",
  "James", "Scott", "Phillips", "Watson", "Davis", "Parker", "Price", "Bennett", "Young", "Griffiths", "Mitchell",
  "Kelly", "Cook", "Carter", "Richardson", "Bailey", "Collins", "Bell", "Shaw", "Murphy", "Miller", "Cox",
  "Richards", "Khan", "Marshall", "Anderson", "Simpson", "Ellis", "Adams", "Singh", "Begum", "Wilkinson", "Foster",
  "Chapman", "Powell", "Webb", "Rogers", "Gray", "Mason", "Ali", "Hunt", "Hussain", "Campbell", "Matthews",
  "Owen", "Palmer", "Holmes", "Mills", "Barnes", "Knight", "Lloyd", "Butler", "Russell", "Barker", "Fisher",
  "Stevens", "Jenkins", "Murray", "Dixon", "Harvey", "Graham", "Pearson", "Ahmed", "Fletcher", "Walsh", "Kaur",
  "Gibson", "Howard", "Andrews", "Stewart", "Elliott", "Reynolds", "Saunders", "Payne", "Fox", "Ford", "Pearce",
  "Hardcastle", "Oakes", "Greenwood", "Thorne", "Marsden", "Whitworth", "Bramley", "Ashworth", "Sutcliffe",
];

export const EMAIL_DOMAINS: ReadonlyArray<readonly [string, number]> = [
  ["gmail.com", 50],
  ["hotmail.co.uk", 14],
  ["outlook.com", 10],
  ["yahoo.co.uk", 7],
  ["icloud.com", 6],
  ["hotmail.com", 4],
  ["btinternet.com", 3],
  ["sky.com", 2],
  ["live.co.uk", 2],
  ["ntlworld.com", 1],
  ["virginmedia.com", 1],
];

/** Weighted postcode areas, East Midlands heavy. */
export const POSTCODE_AREAS: ReadonlyArray<readonly [string, readonly string[], number]> = [
  ["NG", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "31", "32", "33", "34"], 46],
  ["DE", ["1", "3", "4", "5", "6", "7", "11", "12", "13", "15", "21", "22", "23", "24", "55", "56", "65", "72", "73", "74", "75"], 16],
  ["LE", ["1", "2", "3", "4", "5", "7", "8", "9", "11", "12", "13", "65", "67"], 12],
  ["S", ["1", "2", "6", "8", "10", "11", "20", "21", "40", "41", "43", "80", "81"], 7],
  ["LN", ["1", "2", "4", "5", "6"], 4],
  ["NN", ["1", "2", "3", "4", "5", "8", "15", "16"], 3],
  ["B", ["1", "15", "17", "23", "31", "72", "90"], 3],
  ["CV", ["1", "4", "10", "11", "31"], 2],
  ["PE", ["1", "9", "11"], 2],
  ["DN", ["1", "4", "11", "22"], 2],
  ["M", ["1", "4", "14", "20", "33"], 1],
  ["LS", ["1", "6", "11"], 1],
  ["SK", ["7", "12"], 1],
];

export const STREET_WORDS = ["Oak", "Mill", "Church", "Station", "Park", "Victoria", "High", "Castle", "Forest", "Trent", "Derby", "Hucknall", "Mansfield"];

export const TAGS = ["superfan", "vip", "press", "influencer", "local", "birthday_group", "hen_party", "stag_party", "student", "corporate"];

export const SURVEY_COMMENTS_POSITIVE = [
  "Absolutely brilliant night. Ward 13 was terrifying, the actors never broke character once.",
  "Best scare park we've done. Nightfall Manor is not for the faint hearted!",
  "Loved it. Static was so disorientating, genuinely lost my mate in there.",
  "Great atmosphere, loved the walk between mazes. Queue for The Butcher's Yard was long but worth it.",
  "Rotwood smelled exactly like a sawmill, nice touch. Will be back next year.",
  "Fast Track was worth every penny on a Saturday. Didn't queue more than ten minutes anywhere.",
  "Our third year and it keeps getting better. The Hollow has had a proper upgrade.",
  "Staff were lovely, actors were relentless. Perfect.",
  "Came for my birthday with eight mates, everyone screamed, everyone loved it.",
  "Food was decent for an event like this. Hot chocolate saved my life, it was freezing.",
  "VIP lounge was a nice place to recover between mazes. Photo pack is a great souvenir.",
];

export const SURVEY_COMMENTS_MIXED = [
  "Mazes were great but we queued over an hour for Static on Halloween. Needs more capacity or better queue management.",
  "Good night out, though the car park was chaos leaving. Took 40 minutes to get out.",
  "Loved most of it. The Butcher's Yard had a lot of actors just standing around towards the end of the night.",
  "Fun but felt a bit short for the price. Five mazes in under two hours.",
  "Great scares, but the toilets near the entrance were in a state by 9pm.",
  "Nightfall Manor was intense. Maybe too intense, one of our group had to leave halfway.",
  "Would have liked clearer signage. We walked past Rotwood twice before we found the entrance.",
  "Good but the music in the scare zone was so loud we couldn't hear the actors.",
];

export const SURVEY_COMMENTS_NEGATIVE = [
  "Waited 75 minutes for Ward 13 and then it was rushed through in five. Not good enough for the money.",
  "An actor in The Butcher's Yard grabbed my daughter's arm hard enough to bruise. That is not a touch maze.",
  "Queue times were awful. The app said 20 minutes, reality was over an hour. Fix your signs.",
  "Really disappointed. Two of the mazes had hardly any actors in them.",
  "The 'extreme' maze was just people shouting at us in the dark. Over hyped.",
  "Mud everywhere. No gravel on the paths between mazes, my partner slipped and twisted her ankle.",
  "Staff at the entrance were rude when our tickets didn't scan. Took twenty minutes to sort out.",
  "Your website crashed when I tried to add fast track and I got charged twice.",
];

export const NOTES_POOL = [
  "Called in to ask about group rates for 2027. Keen to bring a works night out.",
  "Prefers SMS contact, says emails go to junk.",
  "Mentioned a heart condition at the gate and was advised against Nightfall Manor.",
  "Was involved in a dispute at the bar on 25/10. Resolved on the night, no further action.",
  "Regular. Always books opening weekend as soon as tickets go live.",
  "Asked to be removed from SMS marketing after the Halloween week texts.",
  "Lost a car key on site in 2025, found and returned two days later.",
  "Local radio competition winner (Gem 106).",
];

export const ACCESSIBILITY_NEEDS = [
  "Wheelchair user. Needs step free route; Rotwood and Static have steps so uses the bypass.",
  "Autistic. Strobe sensitivity: please warn before Static.",
  "Deaf. Lip reads; actors need to face guest for instructions.",
  "Uses a cane, limited mobility. Needs seating while queueing.",
  "Epilepsy. Must avoid strobe lighting (Static).",
  "Anxiety disorder. Carries a chicken-out token and may need to exit early.",
  "Partially sighted. Prefers to go through with a sighted companion holding their arm.",
];

export const BAN_REASONS = [
  "Assaulted an actor in The Butcher's Yard on 18/10/2025. Police called. Lifetime ban.",
  "Repeatedly ignored the no-touching rule towards actors on 11/10/2025 and was ejected. Banned for two seasons.",
];

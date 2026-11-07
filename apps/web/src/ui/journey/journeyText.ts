import { AREA_INFO, type AreaId, type JourneyStep } from '@es/shared';
import { t, tk } from '../../i18n';

/**
 * What each journey step says (learner's language) and the English line it practises. Keys go through the
 * translations (tk / t), so `pnpm --filter @es/api i18n:translate` translates them.
 */
interface Text {
  title: string;
  how: string;
  /** an English sentence to try (spoken with 🔊) */
  say?: string;
}
const MAIN: Record<string, Text> = {
  'm01-hello': { title: tk('Hello, English Street!'), how: tk('Find Priya at the Tourist Info desk and talk to her.'), say: 'Hello! Where is the café, please?' },
  'm02-coffee': { title: tk('Your first coffee'), how: tk('Go to the café and finish a conversation with the barista: order a drink and pay.'), say: "I'd like a latte, please." },
  'm03-look': { title: tk('A new look'), how: tk('Change your character: try on clothes in the clothes shop, or open Character and save a new look.'), say: 'Can I try this on?' },
  'm04-shopping': { title: tk('Going shopping'), how: tk('Get a shopping list at the supermarket, find everything on the shelves and pay at the checkout.'), say: 'Two bottles of milk, please.' },
  'm05-dinner': { title: tk('Dinner time'), how: tk('Sit at a table in the restaurant, order from the waiter, eat, then ask for the bill and pay.'), say: 'Could I have the bill, please?' },
  'm06-chef': { title: tk('Little chef'), how: tk('Go into the restaurant kitchen (behind the bar) and cook a dish: read each step and use the right place.'), say: 'Chop the tomatoes.' },
  'm07-friend': { title: tk('Make a friend'), how: tk('Say something in English in the chat to a player near you, or send someone a friend request.'), say: 'Hi! Where are you from?' },
  'm08-river': { title: tk('Across the river'), how: tk('Take the ferry at the pier, or hire a boat at the boat kiosk by the river.'), say: 'When does the next ferry leave?' },
  'm09-hotel': { title: tk('A night at the hotel'), how: tk('Check in at the hotel reception, find your room, then check out and check your bill.'), say: "I'd like to check in, please." },
  'm10-sports': { title: tk('Sports day'), how: tk('Play a game at the sports park: football, hoops, a race or "Coach says".'), say: 'Pass the ball!' },
  'm11-book': { title: tk('Bookworm'), how: tk('Read a chapter of a book in the library (in the cinema) and answer the questions.'), say: 'What happens next?' },
  'm12-citizen': { title: tk('English Street citizen'), how: tk('Collect 6 area stamps in your passport.') },
};
const DAILY: Record<string, Text> = {
  'd-quest': { title: tk('Finish a conversation quest'), how: tk('Talk to any shopkeeper and finish one of their quests.') },
  'd-cards': { title: tk('Open 5 word cards'), how: tk('Tap things in any area to open their word cards.') },
  'd-fish': { title: tk('Catch 2 fish'), how: tk('Go fishing at the end of a boat pier on the river.') },
  'd-cook': { title: tk('Cook a dish'), how: tk('Cook something in the restaurant kitchen.') },
  'd-read': { title: tk('Read a chapter'), how: tk('Read a chapter of a book and answer the questions.') },
  'd-chat': { title: tk('Say 3 things in the chat'), how: tk('Write 3 messages in English to players near you.') },
  'd-till': { title: tk('Pay at the supermarket checkout'), how: tk('Fill a trolley with your shopping list, pay Sam and check your change.') },
  'd-movie': { title: tk('Watch a film'), how: tk('Sit in Screen 1 at Star Cinema, watch the film and answer the questions.') },
  'd-class': { title: tk('Go to a class'), how: tk('Sit in the classroom at Maple School when the bell rings and answer the questions.') },
  'd-doctor': { title: tk('See a doctor'), how: tk('Check in at the hospital reception, see Dr. Chen and get your medicine at the pharmacy.') },
  'd-train': { title: tk('Take the train'), how: tk('Buy the right ticket at the station machine and ride the train.') },
  'd-sport': { title: tk('Play a sports game'), how: tk('Football, hoops, a race or "Coach says" at the sports park.') },
  'd-hug': { title: tk('Hug a pet'), how: tk('Walk up to a cat or a dog and give it a hug.') },
  'd-quiz': { title: tk('Pass an area quiz'), how: tk('Open an area guide (G) and take its quiz.') },
  'd-farm': { title: tk('Harvest on the farm'), how: tk('Plant seeds at the farm, wait, and harvest them.') },
};
/** Area tasks: by the part after the area in the id. */
const AREA: Record<string, Text> = {
  cards: { title: tk('Learn 5 words here'), how: tk('Tap things in this area to open 5 word cards.') },
  quiz: { title: tk('Pass the area quiz'), how: tk("Open the area guide and take the quiz.") },
  keeper: { title: tk('Help the zookeeper'), how: tk('Finish a conversation quest with the zookeeper.') },
  grocer: { title: tk('Talk to the grocer'), how: tk('Finish a conversation quest at the supermarket.') },
  mum: { title: tk('Talk to Mum'), how: tk('Finish a conversation quest with Mum at home.') },
  teacher: { title: tk('Go to class'), how: tk('Finish a conversation quest with the teacher.') },
  stylist: { title: tk('Talk to the stylist'), how: tk('Finish a conversation quest in the clothes shop.') },
  usher: { title: tk('At the cinema'), how: tk('Finish a conversation quest with the usher.') },
  master: { title: tk('Ask the station master'), how: tk('Finish a conversation quest at the station.') },
  doctor: { title: tk('See the doctor'), how: tk('Finish a conversation quest with the doctor.') },
  plant: { title: tk('Plant a seed'), how: tk('Plant something in your farm plot.') },
  harvest: { title: tk('Harvest your crop'), how: tk('Harvest something you planted.') },
  visit: { title: tk("Visit a neighbour's garden"), how: tk("Visit another player's farm garden.") },
  order: { title: tk('Order a meal'), how: tk('Sit at a table and order from the waiter.') },
  cook: { title: tk('Cook in the kitchen'), how: tk('Cook a dish in the restaurant kitchen.') },
  tip: { title: tk('Leave a tip'), how: tk('Pay the bill with a 10, 15 or 20% tip and work out the right total.') },
  list: { title: tk('Shop from a list'), how: tk('Buy everything on a shopping list and pay.') },
  shelf: { title: tk('A book for your shelf'), how: tk('Buy a book in the library: it goes on your bookshelf at home.') },
  outfit: { title: tk('Save an outfit'), how: tk('Try on clothes and save a new outfit.') },
  read: { title: tk('Read in the library'), how: tk('Read a chapter of a book and answer the questions.') },
  tickets: { title: tk('Buy the right ticket'), how: tk('Buy train tickets at the ticket office.') },
  pharmacy: { title: tk('At the pharmacy'), how: tk('Get the right medicine at the pharmacy.') },
  checkin: { title: tk('Check in'), how: tk('Check in at the hotel reception.') },
  service: { title: tk('Room service'), how: tk('Call room service on the phone in your room.') },
  checkout: { title: tk('Check out'), how: tk('Check out at reception and check your bill.') },
  goal: { title: tk('Score a goal'), how: tk('Join a football team and score a goal.') },
  hoops: { title: tk('Shoot some hoops'), how: tk('Play hoops on the basketball court.') },
  coach: { title: tk('Play "Coach says"'), how: tk('Do what Coach says, but only when he says "Coach says"!') },
  ferry: { title: tk('Take the ferry'), how: tk('Board the ferry at a ferry pier when it is docked.') },
  row: { title: tk('Row a boat'), how: tk('Hire a boat at the kiosk, or get in as a passenger.') },
  fish: { title: tk('Catch 3 fish'), how: tk('Go fishing at the end of a boat pier.') },
};

export function stepText(s: JourneyStep): { title: string; how: string; say?: string } {
  const pick = s.kind === 'main' ? MAIN[s.id] : s.kind === 'daily' ? DAILY[s.id] : AREA[s.id.split('-').slice(2).join('-')];
  return pick ? { title: t(pick.title), how: t(pick.how), say: pick.say } : { title: s.id, how: '' };
}
export function areaName(a: AreaId | 'river') {
  return a === 'river' ? { icon: '🚣', name: 'River' } : { icon: AREA_INFO[a].icon, name: AREA_INFO[a].name };
}

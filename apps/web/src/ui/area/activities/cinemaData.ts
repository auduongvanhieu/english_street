/**
 * Made-up films, snacks and library books of Star Cinema & Library: the posters in the scene and the
 * activity tab use the same lists (the NPC YAMLs usher.yaml / librarian.yaml describe them too).
 */
export interface Film {
  id: string;
  title: string;
  genre: string;
  /** Poster colours. */
  color: string;
  ink: string;
  times: string[];
}
export const FILMS: Film[] = [
  {
    id: 'space-cats',
    title: 'Space Cats',
    genre: 'science fiction comedy',
    color: '#1f2a6b',
    ink: '#ffd34d',
    times: ['2:00', '4:45', '7:30'],
  },
  {
    id: 'dragon',
    title: "The Dragon Who Couldn't Fly",
    genre: 'cartoon',
    color: '#3f9b5a',
    ink: '#ffffff',
    times: ['1:15', '3:30', '6:00'],
  },
  {
    id: 'robo-racers',
    title: 'Robo Racers',
    genre: 'action film',
    color: '#c0392b',
    ink: '#fff3c4',
    times: ['5:00', '8:15'],
  },
  {
    id: 'lighthouse',
    title: 'The Haunted Lighthouse',
    genre: 'mystery',
    color: '#2d2d3a',
    ink: '#9be7ff',
    times: ['6:45', '9:00'],
  },
  {
    id: 'penguin',
    title: 'Penguin Detective',
    genre: 'comedy',
    color: '#5bb6e8',
    ink: '#13233b',
    times: ['12:30', '3:00', '5:30'],
  },
  {
    id: 'ocean',
    title: 'Ocean Giants',
    genre: 'documentary',
    color: '#0f6e7a',
    ink: '#e6fbff',
    times: ['11:00', '4:00'],
  },
];

export const PRICE = { adult: 9, child: 6 };

export interface Snack {
  id: string;
  en: string;
  icon: string;
  price: number;
}
export const SNACKS: Snack[] = [
  { id: 'popcorn-s', en: 'small popcorn', icon: '🍿', price: 4 },
  { id: 'popcorn-l', en: 'large popcorn', icon: '🍿', price: 6 },
  { id: 'drink', en: 'soft drink', icon: '🥤', price: 3 },
  { id: 'nachos', en: 'nachos', icon: '🧀', price: 5 },
  { id: 'ice-cream', en: 'ice cream', icon: '🍦', price: 4 },
];

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  /** Cover colour name (said by the librarian) and hex. */
  colour: string;
  hex: string;
  /** Back-cover line (what the learner reads on the cover). */
  blurb: string;
  /** The librarian's description: genre/colour line, plot line, author line. */
  desc: string[];
  /** Follow-up opinion / summary question, answer = index 0 (options are shuffled). */
  q: string;
  options: string[];
}
export const BOOKS: Book[] = [
  {
    id: 'moon-bakery',
    title: 'The Moon Bakery',
    author: 'Lily Hart',
    genre: 'fantasy',
    colour: 'blue',
    hex: '#3f6fd8',
    blurb: 'Every loaf from Nana Rosa’s oven lifts you off the ground…',
    desc: [
      'It’s a fantasy story with a blue cover.',
      'A girl bakes bread, and anyone who eats it can fly.',
      'The author used to work in a bakery herself.',
    ],
    q: 'A reader says: “I couldn’t put it down!” What does she mean?',
    options: [
      'She loved it and read it very quickly.',
      'The book was too heavy to hold.',
      'She didn’t like it at all.',
      'She lost the book.',
    ],
  },
  {
    id: 'rocket-rex',
    title: 'Rocket Rex',
    author: 'Mia Lane',
    genre: 'adventure',
    colour: 'yellow',
    hex: '#f2c230',
    blurb: 'One small puppy. One big dream. Next stop: the stars!',
    desc: [
      'It’s a funny adventure book with a yellow cover.',
      'The main character is a dog who wants to be an astronaut.',
      'The author’s first name is Mia.',
    ],
    q: 'Which is the best one-sentence summary of Rocket Rex?',
    options: [
      'A brave puppy tries to make his dream of going to space come true.',
      'A girl opens a bakery on the Moon.',
      'Three friends spend a night in a lighthouse.',
      'A football team wins the cup.',
    ],
  },
  {
    id: 'silent-island',
    title: 'The Silent Island',
    author: 'Tom Reed',
    genre: 'mystery',
    colour: 'green',
    hex: '#2e8b57',
    blurb: 'No birds sing. No waves crash. Who stole the sound?',
    desc: [
      'It’s a mystery novel with a green cover.',
      'Some children visit an island where there is no sound at all, and they have to solve a puzzle.',
      'The author is a man, and he used to be a police officer.',
    ],
    q: 'Your friend asks: “Is it scary?” Which answer gives an opinion AND a reason?',
    options: [
      'A little, because you never know who the thief is until the end.',
      'It is a book.',
      'Yes.',
      'It has 200 pages.',
    ],
  },
  {
    id: 'grandpas-garden',
    title: "Grandpa's Garden",
    author: 'Ana Silva',
    genre: 'family story',
    colour: 'green',
    hex: '#7cb342',
    blurb: 'A summer of tomatoes, secrets and saying goodbye.',
    desc: [
      'It’s a gentle family story with a light green cover.',
      'A boy spends the summer with his grandfather, and it’s sad but hopeful at the end.',
      'The author is a woman who writes for children.',
    ],
    q: 'Mrs. Patel says the ending is “bittersweet”. What does that mean?',
    options: [
      'Happy and sad at the same time.',
      'Very funny.',
      'Very scary.',
      'Boring and too long.',
    ],
  },
  {
    id: 'football-stars',
    title: 'Football Stars',
    author: 'Sam Okafor',
    genre: 'sport',
    colour: 'red',
    hex: '#d64545',
    blurb: 'Eleven girls, one old ball and the biggest final of the year.',
    desc: [
      'It’s a sports story with a red cover.',
      'It’s about a girls’ football team that plays in a big final.',
      'The author used to be a football coach.',
    ],
    q: 'Which sentence is a review, not a summary?',
    options: [
      'The matches are so exciting that I felt I was in the stadium.',
      'The team plays in a final.',
      'The book has twelve chapters.',
      'The author is Sam Okafor.',
    ],
  },
  {
    id: 'whales',
    title: 'Whales of the Deep',
    author: 'Dr. Kai Ito',
    genre: 'non-fiction',
    colour: 'dark blue',
    hex: '#1d3a6e',
    blurb: 'Real photos and true facts from twenty years at sea.',
    desc: [
      'It isn’t a story, it’s a non-fiction book with a dark blue cover.',
      'It has true facts and photos about the biggest animals in the sea.',
      'The author is a scientist.',
    ],
    q: 'Why would someone choose this book?',
    options: [
      'To learn real facts about animals in the ocean.',
      'To read a funny story about a dog.',
      'To learn how to bake bread.',
      'To read a ghost story.',
    ],
  },
  {
    id: 'clockwork-fox',
    title: 'The Clockwork Fox',
    author: 'Hugo Bell',
    genre: 'fantasy',
    colour: 'orange',
    hex: '#ef7d22',
    blurb: 'Wind him up, and he’ll take you anywhere — once.',
    desc: [
      'It’s a fantasy book with an orange cover.',
      'A metal fox comes to life and takes a lonely boy on a journey through time.',
      'The author also draws the pictures in the book.',
    ],
    q: 'Which sentence describes the main character?',
    options: [
      'He’s a metal fox who is clever and a little sad.',
      'She’s a puppy who loves space.',
      'He’s a police officer on an island.',
      'She’s a football coach.',
    ],
  },
  {
    id: 'secret-recipe',
    title: 'The Secret Recipe',
    author: 'Lily Hart',
    genre: 'mystery',
    colour: 'yellow',
    hex: '#e8b923',
    blurb: 'The famous cake recipe is missing. Everyone is a suspect.',
    desc: [
      'It’s a mystery with a yellow cover.',
      'A famous cake recipe disappears from a hotel kitchen and a young cook must find the thief.',
      'The author also wrote The Moon Bakery.',
    ],
    q: 'Which question would a reader ask the librarian next?',
    options: [
      'Do you have any other books by Lily Hart?',
      'Is this the 7:30 show?',
      'Can I have a large popcorn?',
      'Which row is my seat in?',
    ],
  },
  {
    id: 'ghost-gran',
    title: 'My Gran Is a Ghost',
    author: 'Rob Finch',
    genre: 'comedy',
    colour: 'purple',
    hex: '#8e5bd8',
    blurb: 'She can walk through walls. She still makes him eat his vegetables.',
    desc: [
      'It’s a funny book with a purple cover — not scary at all!',
      'A boy’s grandmother becomes a friendly ghost and still tells him what to do.',
      'The author writes jokes for TV.',
    ],
    q: 'Your friend hates scary stories. What do you tell her?',
    options: [
      'Don’t worry, it’s more funny than scary.',
      'It’s a documentary about whales.',
      'The due date is Friday.',
      'It’s the scariest book in the library.',
    ],
  },
  {
    id: 'mountain',
    title: 'Over the Mountain',
    author: 'Nadia Cole',
    genre: 'adventure',
    colour: 'red',
    hex: '#b23a48',
    blurb: 'Two sisters, one map and a storm that won’t stop.',
    desc: [
      'It’s an adventure story with a red cover.',
      'Two sisters cross a mountain in a storm to bring medicine to their village.',
      'The author is a mountain guide.',
    ],
    q: 'How do the sisters probably feel during the storm?',
    options: [
      'Frightened but determined.',
      'Bored and sleepy.',
      'Hungry for popcorn.',
      'Angry with the librarian.',
    ],
  },
];

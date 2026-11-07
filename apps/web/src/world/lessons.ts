/**
 * Maple School's timed class (store/classroom.ts): one lesson every LESSON_MS on the server clock, the same for
 * everyone. Each lesson: five slides on the board (picture, word, example sentence, read by the teacher), then three
 * questions the pupils answer by putting up their hand.
 */
export interface Slide {
  pic: string;
  word: string;
  say: string;
}
export interface LessonQ {
  q: string;
  options: string[];
  /** index of the right option */
  answer: number;
}
export interface Lesson {
  id: string;
  title: string;
  slides: Slide[];
  quiz: LessonQ[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'colours',
    title: 'Colours',
    slides: [
      { pic: '🍎', word: 'red', say: 'An apple is red.' },
      { pic: '🍌', word: 'yellow', say: 'A banana is yellow.' },
      { pic: '🌳', word: 'green', say: 'The leaves are green.' },
      { pic: '🌊', word: 'blue', say: 'The sea is blue.' },
      { pic: '🍊', word: 'orange', say: 'An orange is orange too!' },
    ],
    quiz: [
      { q: 'What colour is a banana?', options: ['yellow', 'blue', 'red'], answer: 0 },
      { q: 'The sea is …', options: ['green', 'blue', 'orange'], answer: 1 },
      { q: 'Which one is red?', options: ['a leaf', 'the sky', 'an apple'], answer: 2 },
    ],
  },
  {
    id: 'time',
    title: 'Telling the time',
    slides: [
      { pic: '🕖', word: "seven o'clock", say: "I get up at seven o'clock." },
      { pic: '🕢', word: 'half past seven', say: 'I have breakfast at half past seven.' },
      { pic: '🕗', word: 'a quarter past eight', say: 'School starts at a quarter past eight.' },
      { pic: '🕛', word: 'noon', say: 'We have lunch at noon.' },
      { pic: '🕘', word: 'nine p.m.', say: 'I go to bed at nine p.m.' },
    ],
    quiz: [
      { q: '7:30 is …', options: ['half past seven', 'a quarter to seven', 'seven fifteen'], answer: 0 },
      { q: '12:00 in the day is …', options: ['midnight', 'noon', 'evening'], answer: 1 },
      { q: '"A quarter past eight" is …', options: ['7:45', '8:30', '8:15'], answer: 2 },
    ],
  },
  {
    id: 'family',
    title: 'My family',
    slides: [
      { pic: '👩', word: 'mother', say: 'My mother is a doctor.' },
      { pic: '👨', word: 'father', say: 'My father cooks dinner.' },
      { pic: '👧', word: 'sister', say: 'I have one sister.' },
      { pic: '👦', word: 'brother', say: 'My brother is ten years old.' },
      { pic: '👵', word: 'grandmother', say: "My grandmother is my mother's mother." },
    ],
    quiz: [
      { q: "Your mother's mother is your …", options: ['sister', 'grandmother', 'aunt'], answer: 1 },
      { q: 'A boy in your family is your …', options: ['brother', 'sister', 'mother'], answer: 0 },
      { q: '"I have one sister." How many sisters?', options: ['two', 'none', 'one'], answer: 2 },
    ],
  },
  {
    id: 'weather',
    title: 'The weather',
    slides: [
      { pic: '☀️', word: 'sunny', say: "It's sunny today. Let's go to the park!" },
      { pic: '🌧️', word: 'rainy', say: "It's rainy. Take an umbrella." },
      { pic: '☁️', word: 'cloudy', say: "It's cloudy, but it isn't raining." },
      { pic: '💨', word: 'windy', say: "It's windy. Hold your hat!" },
      { pic: '❄️', word: 'snowy', say: "It's snowy and very cold." },
    ],
    quiz: [
      { q: "It's raining. What do you take?", options: ['sunglasses', 'an umbrella', 'a ball'], answer: 1 },
      { q: 'Snow is …', options: ['cold', 'hot', 'yellow'], answer: 0 },
      { q: '"Hold your hat!" — it is …', options: ['sunny', 'snowy', 'windy'], answer: 2 },
    ],
  },
  {
    id: 'food',
    title: 'Food I like',
    slides: [
      { pic: '🍞', word: 'bread', say: 'I eat bread for breakfast.' },
      { pic: '🍚', word: 'rice', say: 'We eat rice every day.' },
      { pic: '🥛', word: 'milk', say: 'Milk is good for you.' },
      { pic: '🥕', word: 'carrot', say: 'Rabbits like carrots.' },
      { pic: '🍰', word: 'cake', say: "I don't eat cake every day." },
    ],
    quiz: [
      { q: 'Which one is a drink?', options: ['rice', 'milk', 'bread'], answer: 1 },
      { q: 'Rabbits like …', options: ['carrots', 'cake', 'milk'], answer: 0 },
      { q: '"I ___ cake every day." (no)', options: ["don't eats", "doesn't eat", "don't eat"], answer: 2 },
    ],
  },
  {
    id: 'jobs',
    title: 'Jobs',
    slides: [
      { pic: '👩‍⚕️', word: 'doctor', say: 'A doctor helps sick people.' },
      { pic: '👨‍🍳', word: 'chef', say: 'A chef cooks in a restaurant.' },
      { pic: '👩‍🏫', word: 'teacher', say: 'A teacher works in a school.' },
      { pic: '👨‍🚒', word: 'firefighter', say: 'A firefighter puts out fires.' },
      { pic: '👩‍🌾', word: 'farmer', say: 'A farmer grows vegetables.' },
    ],
    quiz: [
      { q: 'Who cooks in a restaurant?', options: ['a doctor', 'a chef', 'a farmer'], answer: 1 },
      { q: 'A teacher works in a …', options: ['school', 'hospital', 'farm'], answer: 0 },
      { q: 'Who helps sick people?', options: ['a firefighter', 'a chef', 'a doctor'], answer: 2 },
    ],
  },
  {
    id: 'routine',
    title: 'My day',
    slides: [
      { pic: '⏰', word: 'get up', say: 'I get up at six thirty.' },
      { pic: '🪥', word: 'brush my teeth', say: 'I brush my teeth after breakfast.' },
      { pic: '🚌', word: 'go to school', say: 'I go to school by bus.' },
      { pic: '📚', word: 'do homework', say: 'I do my homework in the evening.' },
      { pic: '🛏️', word: 'go to bed', say: 'I go to bed at nine.' },
    ],
    quiz: [
      { q: 'What do you do after breakfast?', options: ['go to bed', 'brush my teeth', 'get up'], answer: 1 },
      { q: '"I go to school ___ bus."', options: ['by', 'on foot', 'in'], answer: 0 },
      { q: 'When do you do homework?', options: ['at six thirty', 'at noon', 'in the evening'], answer: 2 },
    ],
  },
  {
    id: 'animals',
    title: 'Animals',
    slides: [
      { pic: '🦁', word: 'lion', say: 'A lion is big and strong.' },
      { pic: '🐘', word: 'elephant', say: 'An elephant has a long nose, called a trunk.' },
      { pic: '🐒', word: 'monkey', say: 'Monkeys can climb trees.' },
      { pic: '🐧', word: 'penguin', say: "Penguins can swim, but they can't fly." },
      { pic: '🦒', word: 'giraffe', say: 'A giraffe has a very long neck.' },
    ],
    quiz: [
      { q: 'Which animal has a trunk?', options: ['a giraffe', 'an elephant', 'a lion'], answer: 1 },
      { q: "Penguins can't …", options: ['fly', 'swim', 'walk'], answer: 0 },
      { q: 'Which animal can climb trees well?', options: ['a penguin', 'an elephant', 'a monkey'], answer: 2 },
    ],
  },
];

/* --------------------------------------------------------------------------------------------- the timetable
 *   0 … BELL          the bell, "Good morning, class!"
 *   BELL … QUIZ_AT    five slides, SLIDE_S each
 *   QUIZ_AT … BREAK   three questions, Q_S each
 *   BREAK … end       break time (the board shows the next lesson)
 */
export const LESSON_MS = 240_000;
export const BELL = 8;
export const SLIDE_S = 28;
export const QUIZ_AT = BELL + 5 * SLIDE_S;
export const Q_S = 20;
export const BREAK = QUIZ_AT + 3 * Q_S;

export interface ClassPhase {
  n: number;
  lesson: Lesson;
  t: number;
  phase: 'bell' | 'slide' | 'quiz' | 'break';
  slide: number;
  q: number;
  /** seconds left in this step */
  left: number;
}
export function classPhase(now: number): ClassPhase {
  const n = Math.floor(now / LESSON_MS);
  const lesson = LESSONS[((n % LESSONS.length) + LESSONS.length) % LESSONS.length]!;
  const t = (now - n * LESSON_MS) / 1000;
  if (t < BELL) return { n, lesson, t, phase: 'bell', slide: 0, q: 0, left: BELL - t };
  if (t < QUIZ_AT) {
    const slide = Math.floor((t - BELL) / SLIDE_S);
    return { n, lesson, t, phase: 'slide', slide, q: 0, left: BELL + (slide + 1) * SLIDE_S - t };
  }
  if (t < BREAK) {
    const q = Math.floor((t - QUIZ_AT) / Q_S);
    return { n, lesson, t, phase: 'quiz', slide: 4, q, left: QUIZ_AT + (q + 1) * Q_S - t };
  }
  return { n, lesson, t, phase: 'break', slide: 4, q: 2, left: LESSON_MS / 1000 - t };
}
export const nextLesson = (n: number) => LESSONS[(((n + 1) % LESSONS.length) + LESSONS.length) % LESSONS.length]!;

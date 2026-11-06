/** pnpm --filter @es/quests exec tsx src/validate-books.ts : check every book and print a summary. */
import { getBooks, bookCards } from './index';
const books = getBooks();
const cards = bookCards();
const ids = new Set<string>();
let bad = 0;
for (const b of books) {
  if (ids.has(b.id)) {
    console.log(`DUPLICATE id ${b.id}`);
    bad++;
  }
  ids.add(b.id);
  for (const [ci, c] of b.chapters.entries())
    for (const [qi, q] of c.questions.entries()) if (new Set(q.options).size !== 3) (console.log(`${b.id} ch${ci + 1} q${qi + 1}: options repeat`), bad++);
}
for (const c of cards) console.log(`${c.level}  ${c.id.padEnd(28)} ${String(c.chapters)} ch  ${String(c.words).padStart(4)} words  ${c.price} coins`);
console.log(`${books.length} books${bad ? `, ${bad} problems` : ', OK'}`);
process.exit(bad ? 1 : 0);

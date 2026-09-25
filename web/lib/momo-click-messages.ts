export const momoClickMessages = [
  'ooh ooh, you found me!', 'brain gains!', 'one card at a time',
  'aha moment!', 'notes meet their match', 'quiz time!',
  'you’ve got this!', 'keep curious!', 'Momo approves!',
  'big brain energy', 'bananas for learning', 'that tickles!',
  'tiny steps, big ideas', 'stay a little curious', 'less cram, more calm',
  'a little wiser already', 'peel back the mystery', 'study buddy reporting!',
  'ooh, good thinking!', 'high five, scholar!', 'make room for an aha',
  'your notes have potential', 'ready, set, recall!', 'go bananas for books',
  'a snack, then a flashcard', 'curiosity looks good on you', 'Momo’s rooting for you',
  'small wins count', 'let’s untangle those notes', 'another day, another aha',
  'knowledge is a good look', 'chatter now, ace it later', 'hey, clever human!',
  'that’s the study spirit', 'one more little discovery', 'keep that brain bouncing',
  'plot twist: you can do this', 'a very scholarly boop', 'certified curious',
  'the jungle has a book club', 'less panic, more practice', 'boop! back to the books',
] as const;

/** Shuffle once per round so every phrase is seen before any is repeated. */
export function createMessagePicker() {
  let remaining: string[] = [];
  let previous = '';
  return () => {
    if (!remaining.length) {
      remaining = [...momoClickMessages];
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      if (remaining[remaining.length - 1] === previous) {
        [remaining[0], remaining[remaining.length - 1]] = [remaining[remaining.length - 1], remaining[0]];
      }
    }
    previous = remaining.pop()!;
    return previous;
  };
}

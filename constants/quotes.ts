/**
 * Daily motivational quotes for the gym tracker app
 */

export interface Quote {
  text: string;
  author: string;
}

export const DAILY_QUOTES: Quote[] = [
  {
    text: "The master does the work and claims no credit; when the bar is racked, strength shows itself.",
    author: "Laozi"
  },
  {
    text: "Those who seek only the pump will not endure; those who endure will know true strength.",
    author: "Zhuangzi"
  },
  {
    text: "Do not wish the weight were lighter; wish that you were stronger.",
    author: "Epictetus"
  },
  {
    text: "First say to yourself what kind of lifter you would be, then do what that requires.",
    author: "Epictetus"
  },
  {
    text: "If it is endurable, then endure it. If it is not, lower the weight with dignity.",
    author: "Marcus Aurelius"
  },
  {
    text: "Waste no more time arguing what swole is. Be swole.",
    author: "Marcus Aurelius"
  },
  {
    text: "The unexamined training plan is not worth following.",
    author: "Socrates"
  },
  {
    text: "Know thy limits, and then approach them carefully.",
    author: "Socrates"
  },
  {
    text: "He who conquers the bar is strong; he who conquers himself is powerful.",
    author: "Laozi"
  },
  {
    text: "No one steps under the same bar twice, for it is not the same bar, and he is not the same man.",
    author: "Heraclitus"
  },
  {
    text: "Give me a place to stand and a bar long enough, and I will deadlift the world.",
    author: "Archimedes"
  },
  {
    text: "One must imagine Sisyphus happy on leg day.",
    author: "Camus"
  },
  {
    text: "He who has a why can endure almost any set.",
    author: "Nietzsche"
  },
  {
    text: "I train, therefore I am sore.",
    author: "Descartes"
  },
  {
    text: "The form exists before the lift; the lift merely imitates it.",
    author: "Plato"
  },
  {
    text: "Virtue is a habit, as is proper depth.",
    author: "Aristotle"
  },
  {
    text: "Pain is neither good nor bad; it is simply information.",
    author: "Epicurus"
  },
  {
    text: "We suffer more in imagination than under the bar.",
    author: "Seneca"
  },
  {
    text: "Freedom is wanting nothing but PRs.",
    author: "Diogenes"
  },
  {
    text: "The will is tested not by thought, but by that last rep.",
    author: "Kant"
  },
  {
    text: "Cause and effect are unclear, yet soreness reliably follows.",
    author: "Hume"
  },
  {
    text: "The Way need not be heavy for many men to complain of its weight.",
    author: "Laozi"
  },
  {
    text: "The sage trains daily and leaves no trace but chalk.",
    author: "Zhuangzi"
  },
  {
    text: "When the master forgets himself, the technique becomes form.",
    author: "Zhuangzi"
  },
  {
    text: "The master acts without strain; the bar moves because it has nowhere else to go.",
    author: "Laozi"
  },
  {
    text: "Those who rush the lift meet resistance; those who yield find leverage.",
    author: "Laozi"
  },
  {
    text: "The master brings no routine, so no rep is left unfinished.",
    author: "Laozi"
  },
  {
    text: "When effort disappears, the movement completes itself the way nature intends.",
    author: "Zhuangzi"
  },
  {
    text: "Do not ask if you were strong today; ask if you were present.",
    author: "Zhuangzi"
  },
  {
    text: "I do not fear the man who knows ten thousand lifts, but the one who does one lift ten thousand times.",
    author: "Bruce Lee"
  },
  {
    text: "The bar teaches faster than thought ever could.",
    author: "Bruce Lee"
  },
  {
    text: "Protect ya neck from injury.",
    author: "Wu-Tang sage"
  },
  {
    text: "When you are lifting, lift. When you are resting, rest. Do not half-lift and half-rest.",
    author: "Zhuangzi"
  },
  {
    text: "Suffering before is imagination; suffering during is training; suffering after is injury.",
    author: "Epictetus"
  },
  {
    text: "What stands in the way of your progress is often the weight you refuse to pick up.",
    author: "Marcus Aurelius"
  },
  {
    text: "Your power is over your mind, not over the plates; adjust what is truly yours to control.",
    author: "Marcus Aurelius"
  },
  {
    text: "I cannot teach you strength; I can only show you my progression charts.",
    author: "Socrates"
  },
  {
    text: "The softest water wears down the hardest stone; the smallest habit shapes the greatest strength.",
    author: "Laozi"
  },
  {
    text: "The barbell is a truthful teacher; it yields to no excuses.",
    author: "Zhuangzi"
  },
  {
    text: "He who is brave is free; he who steps under the bar is both.",
    author: "Epictetus"
  },
  {
    text: "No man is more misled than he who thinks the heaviest weight is not his own mind.",
    author: "Socrates"
  },
  {
    text: "When the ego lifts, it is the body that falls.",
    author: "Zhuangzi"
  }
];

/**
 * Get a quote for the current day (changes once per day)
 * Uses the current date as a seed for consistent daily selection
 */
export function getDailyQuote(): Quote {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const index = dayOfYear % DAILY_QUOTES.length;
  return DAILY_QUOTES[index];
}

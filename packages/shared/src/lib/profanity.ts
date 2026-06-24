// Random public codes can accidentally spell offensive words. We reject codes
// that match these patterns before inserting them (spec §7.2). This is a small,
// deliberately conservative list; it does not aim to be a full slur filter.
const BLOCKED_SUBSTRINGS = [
  "fuck",
  "shit",
  "cunt",
  "rape",
  "nazi",
  "fag",
  "slut",
  "porn",
  "anus",
  "dick",
  "cock",
  "tits",
  "kill",
];

// Leetspeak-ish normalization so e.g. "5h1t" is still caught.
const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[0134578]/g, (char) => LEET_MAP[char] ?? char);
}

export function containsBlockedPattern(value: string): boolean {
  const normalized = normalize(value);
  return BLOCKED_SUBSTRINGS.some((word) => normalized.includes(word));
}

export const NOTE_BLOCKED_MESSAGE = "Please keep parking updates appropriate and helpful.";
export const NOTE_MAX_LENGTH = 100;

// A local, deterministic first-line filter. Flags provide a second path for
// contextual abuse/false claims that a word filter cannot reliably understand.
const blockedWords = [
  "fuck", "fucks", "fucking", "fucker", "fuckers", "fucked", "fuk", "fck", "fvck", "shyt", "motherfucker", "motherfucking",
  "shit", "shits", "shitty", "bullshit", "bitch", "bitches", "bastard", "asshole",
  "arsehole", "dick", "dickhead", "cock", "cocksucker", "pussy", "cunt", "damn",
  "goddamn", "hell", "crap", "piss", "whore", "slut", "porn", "porno", "pornography", "sex", "sexual",
  "sexy", "nude", "nudes", "naked", "blowjob", "handjob", "masturbate", "orgasm",
  "penis", "vagina", "boobs", "tits", "hentai", "erotic", "nigger", "nigga", "faggot", "fag",
  "retard", "retarded", "chink", "spic", "kike", "tranny", "coon",
  "ass", "idiot", "moron", "loser", "dumbass", "stupid",
];

function normalize(value: string) {
  const confusables: Record<string, string> = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "і": "i",
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g",
    "@": "a", "$": "s",
  };
  return value.toLowerCase().normalize("NFKD")
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .replace(/[аеорсхі01345789@$]/g, (letter) => confusables[letter]);
}

const wordPatterns = blockedWords.map((word) =>
  new RegExp(`(?<![a-z])${word.split("").map((letter) => letter === "i" ? "[i!|]" : letter).join("[^a-z]*")}(?![a-z])`, "i"),
);
const maskedPatterns = blockedWords.filter((word) => word.length >= 4).map((word) =>
  new RegExp(`(?<![a-z])${word.split("").map((letter, index) =>
    index === 0 || index === word.length - 1 ? letter : `[${letter}*#]`,
  ).join("[^a-z]*")}(?![a-z])`, "i"),
);

function oneEditAway(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}

export function noteMentionsEmergency(note: string | null | undefined) {
  if (!note) return false;
  return /\b(fire|smoke|weapon|weapons|gun|guns|knife|bomb|shooting|medical|emergency|emergencies|danger|injured|unconscious|bleeding|ambulance|911)\b|\b(can'?t breathe|heart attack|immediate danger)\b/i.test(note.normalize("NFKD").replace(/[\p{M}\p{Cf}]/gu, ""));
}

export function moderateParkingNote(input: string | undefined): { note: string | null; error: string | null } {
  if (input === undefined || input.trim() === "") return { note: null, error: null };
  if (input.length > NOTE_MAX_LENGTH) return { note: null, error: "Keep your note to 100 characters or fewer." };
  const note = input.trim();
  const text = normalize(note);
  // Email/obfuscated email, international/US phone numbers, handles, URLs and
  // address-like contact details aren't appropriate for a public parking feed.
  const contact = /[\w.+-]+\s*@\s*[\w.-]+\s*\.\s*[a-z]{2,}/i.test(note)
    || /\b[\w.+-]+\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\bat\b)\s*[\w.-]+\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\bdot\b)\s*[a-z]{2,}/i.test(note)
    || /(?:\+?\d[\d ().-]{5,}\d)/.test(note)
    || /\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine)[ -]+){6,}(?:zero|one|two|three|four|five|six|seven|eight|nine)\b/i.test(note)
    || /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|io|co|edu)\b|@\w{2,})/i.test(note)
    || /\b(?:(?:call|text|email|contact|add)\s+me|dm|snapchat|instagram|telegram|whatsapp)\b/i.test(note)
    || /\b\d+\s+[a-z][a-z ]+\s(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr)\b/i.test(note);
  const abuse = wordPatterns.some((pattern) => pattern.test(text))
    || maskedPatterns.some((pattern) => pattern.test(text))
    || /\bf[*#]{2,}(?![a-z])/i.test(text)
    || /f+u+c+k+|nigg(?:er|a)|faggot/i.test(text.replace(/[^a-z]/g, ""))
    || /\b(?:kill|shoot|stab|hurt|attack|slap|beat)\s+(?:you|your|them|him|her|everyone|students|people)\b|\b(?:kill yourself|go die|shut up|i hate you|white power|heil hitler|go back to your country)\b/i.test(text)
    || /\b(?:i|we)\s+(?:will|am going to|are going to|want to)\s+(?:kill|shoot|stab|hurt|attack|bomb)\b|\bblow up\b/i.test(text)
    || /\b(?:hate|kill|ban|deport)\s+(?:all\s+)?(?:blacks|whites|asians|arabs|mexicans|indians|jews|muslims|hindus|immigrants|gays|trans|women|men)\b/i.test(text)
    || /\b(?:all|those)\s+\w+\s+(?:should die|are animals|are vermin)\b/i.test(text)
    || text.split(/[^a-z]+/).some((token) => token.length >= 5 &&
      blockedWords.some((word) => word.length >= 5 && oneEditAway(token, word)));
  const spam = /\b(?:buy now|click here|free money|cash prize|crypto|bitcoin|promo code|subscribe|follow me|limited offer|onlyfans)\b/i.test(text)
    || /(.)\1{6,}/u.test(text)
    || /\b([a-z]{2,})(?:\s+\1){3,}\b/i.test(text);
  const hasContent = /[a-z]/i.test(text);
  if (contact || abuse || spam || !hasContent || /[\p{Cc}]/u.test(note)) {
    return { note: null, error: NOTE_BLOCKED_MESSAGE };
  }
  return { note, error: null };
}

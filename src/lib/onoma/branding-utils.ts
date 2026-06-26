// src/lib/onoma/branding-utils.ts
// Onoma Lab — Branding & Typographical utilities

export const GOOGLE_FONTS = [
  { id: "Gentium Book Plus", family: "Gentium Book Plus", type: "serif" },
  { id: "Cardo", family: "Cardo", type: "serif" },
  { id: "Cinzel", family: "Cinzel", type: "serif" },
  { id: "Outfit", family: "Outfit", type: "sans" },
  { id: "Syne", family: "Syne", type: "display" },
  { id: "JetBrains Mono", family: "JetBrains Mono", type: "mono" },
  { id: "Lora", family: "Lora", type: "serif" },
  { id: "Inter", family: "Inter", type: "sans" },
];

/**
 * Wraps the brand name "Onoma" inside a string with linguistic flanking notations.
 */
export function applyFlanking(text: string, style?: string): string {
  if (!text) return "";
  const brandWord = "Onoma";
  if (!text.includes(brandWord)) return text;

  let decorated = brandWord;
  switch (style) {
    case "brackets":
      decorated = `⟨${brandWord}⟩`;
      break;
    case "slashes":
      decorated = `/${brandWord}/`;
      break;
    case "brackets-square":
      decorated = `[${brandWord}]`;
      break;
    case "asterisk":
      decorated = `*${brandWord}`;
      break;
    case "ipa":
      decorated = `${brandWord} [oʊˈnoʊmə]`;
      break;
    case "none":
    default:
      decorated = brandWord;
      break;
  }

  return text.replace(brandWord, decorated);
}

/**
 * Returns the Google Fonts CSS import link for a given font family name.
 */
export function getGoogleFontLink(fontFamily: string): string {
  const font = GOOGLE_FONTS.find((f) => f.family === fontFamily);
  if (!font) return "";
  const queryFamily = fontFamily.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${queryFamily}:wght@400;600;800&display=swap`;
}

/**
 * Translates an IPA transcription string into a phonetically readable
 * English spelling string for browser SpeechSynthesis.
 *
 * Example: "/ʃəˈnoʊmə/" -> "shuh-NOH-muh"
 */
export function ipaToSpeechSpelling(ipa: string): string {
  if (!ipa) return "";

  // Strip delimiters and lower boundaries
  let clean = ipa.replace(/[/\[\]]/g, "").trim();
  if (!clean) return "";

  // Remember stress index relative to vowel positions
  const stressIndex = clean.indexOf("ˈ");
  clean = clean.replace(/[ˈˌ]/g, "");

  // Mapping rules from IPA phonemes to English phonetic chunks
  const ipaMap: [string, string][] = [
    // Long vowels & Diphthongs (longest first)
    ["aɪ", "eye"],
    ["eɪ", "ay"],
    ["aʊ", "ow"],
    ["ɔɪ", "oy"],
    ["oʊ", "oh"],
    ["iː", "ee"],
    ["uː", "oo"],
    ["ɑː", "ah"],
    ["ɔː", "aw"],

    // Consonants
    ["tʃ", "ch"],
    ["dʒ", "j"],
    ["ts", "ts"],
    ["ks", "ks"],
    ["kw", "kw"],
    ["θ", "th"],
    ["ð", "th"],
    ["ʃ", "sh"],
    ["ʒ", "zh"],
    ["ŋ", "ng"],
    ["ʁ", "r"],
    ["ɣ", "gh"],
    ["ɬ", "l"],
    ["ɾ", "r"],
    ["x", "kh"],
    ["ʔ", ""], // silent glottal stop

    // Vowels
    ["ø", "ur"],
    ["œ", "ur"],
    ["ɛ", "eh"],
    ["ɔ", "aw"],
    ["ə", "uh"],
    ["æ", "ah"],
    ["y", "ew"],
    ["ʌ", "uh"],
    ["ɪ", "ih"],
    ["ʊ", "uu"],
    ["a", "ah"],
    ["e", "eh"],
    ["i", "ee"],
    ["o", "oh"],
    ["u", "oo"],
  ];

  // Perform translation token-by-token
  let spelled = "";
  let i = 0;
  let stressCharIndex = -1;

  while (i < clean.length) {
    if (i === stressIndex) {
      stressCharIndex = spelled.length;
    }

    let matched = false;
    for (const [from, to] of ipaMap) {
      if (clean.startsWith(from, i)) {
        spelled += to;
        i += from.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      spelled += clean[i];
      i++;
    }
  }

  if (i === stressIndex) {
    stressCharIndex = spelled.length;
  }

  // Syllabify the spelled English word
  const vowels = ["a", "e", "i", "o", "u", "y"];
  const isVowel = (char: string) => vowels.includes(char.toLowerCase());

  const letters = spelled.split("");
  const vowelPositions: number[] = [];
  for (let j = 0; j < letters.length; j++) {
    if (isVowel(letters[j])) {
      if (vowelPositions.length > 0 && vowelPositions[vowelPositions.length - 1] === j - 1) {
        // consecutive vowel characters
      } else {
        vowelPositions.push(j);
      }
    }
  }

  if (vowelPositions.length <= 1) {
    return spelled.toUpperCase();
  }

  const splitPoints: number[] = [];
  for (let k = 0; k < vowelPositions.length - 1; k++) {
    const v1 = vowelPositions[k];
    const v2 = vowelPositions[k + 1];

    let v1End = v1;
    while (v1End + 1 < letters.length && isVowel(letters[v1End + 1])) {
      v1End++;
    }

    const cBetween = v2 - v1End - 1;
    if (cBetween <= 1) {
      splitPoints.push(v1End + 1);
    } else {
      splitPoints.push(v1End + Math.floor(cBetween / 2) + 1);
    }
  }

  const syllables: string[] = [];
  let start = 0;
  for (const pt of splitPoints) {
    syllables.push(spelled.slice(start, pt));
    start = pt;
  }
  syllables.push(spelled.slice(start));

  const activeSyllables = syllables.filter(Boolean);

  if (activeSyllables.length <= 1) {
    return spelled.toUpperCase();
  }

  let currentPos = 0;
  const processedSyllables = activeSyllables.map((syl) => {
    const sylStart = currentPos;
    const sylEnd = currentPos + syl.length;
    currentPos = sylEnd;

    if (stressCharIndex >= sylStart && stressCharIndex < sylEnd) {
      return syl.toUpperCase();
    }
    if (stressCharIndex === sylStart) {
      return syl.toUpperCase();
    }
    return syl.toLowerCase();
  });

  const hasUppercase = processedSyllables.some((s) => s === s.toUpperCase() && s !== "");
  if (!hasUppercase && processedSyllables.length > 0) {
    processedSyllables[0] = processedSyllables[0].toUpperCase();
  }

  return processedSyllables.join("-");
}

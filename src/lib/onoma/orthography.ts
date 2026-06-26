// src/lib/onoma/orthography.ts
// Onoma Lab — Orthography Script Transcriber

/**
 * Transcribes a Latin-character word into Cyrillic, Greek, or Arabic scripts.
 */
export function transcribeToScript(name: string, script: "cyrillic" | "greek" | "arabic"): string {
  if (!name) return "";
  const lower = name.trim().toLowerCase();

  switch (script) {
    case "cyrillic":
      return transcribeToCyrillic(lower);
    case "greek":
      return transcribeToGreek(lower);
    case "arabic":
      return transcribeToArabic(lower);
    default:
      return name;
  }
}

/**
 * Maps multi-character and single-character Latin graphemes to Cyrillic.
 */
function transcribeToCyrillic(word: string): string {
  // Ordered array of search & replace pairs (longest first to avoid partial matching)
  const mapping: [string, string][] = [
    ["sch", "ш"],
    ["sh", "ш"],
    ["ch", "ч"],
    ["zh", "ж"],
    ["kh", "х"],
    ["ts", "ц"],
    ["ya", "я"],
    ["yu", "ю"],
    ["ph", "ф"],
    ["th", "т"],
    ["ae", "э"],
    ["a", "а"],
    ["b", "б"],
    ["v", "в"],
    ["w", "в"],
    ["g", "г"],
    ["d", "д"],
    ["e", "е"],
    ["ё", "ё"],
    ["z", "з"],
    ["i", "и"],
    ["j", "й"],
    ["k", "к"],
    ["l", "л"],
    ["m", "м"],
    ["n", "н"],
    ["o", "о"],
    ["p", "п"],
    ["r", "р"],
    ["s", "с"],
    ["t", "т"],
    ["u", "у"],
    ["f", "ф"],
    ["h", "х"],
    ["c", "к"],
    ["y", "ы"],
    ["x", "кс"],
  ];

  let result = word;
  for (const [latin, cyrillic] of mapping) {
    // Escape regex characters just in case
    const regex = new RegExp(latin, "g");
    result = result.replace(regex, cyrillic);
  }

  // Capitalize the first letter
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

/**
 * Maps multi-character and single-character Latin graphemes to Greek.
 */
function transcribeToGreek(word: string): string {
  const mapping: [string, string][] = [
    ["th", "θ"],
    ["ph", "φ"],
    ["ch", "χ"],
    ["ps", "ψ"],
    ["ks", "ξ"],
    ["a", "α"],
    ["b", "β"],
    ["g", "γ"],
    ["d", "δ"],
    ["e", "ε"],
    ["z", "ζ"],
    ["i", "ι"],
    ["k", "κ"],
    ["l", "λ"],
    ["m", "μ"],
    ["n", "ν"],
    ["o", "ο"],
    ["p", "π"],
    ["r", "ρ"],
    ["t", "τ"],
    ["u", "υ"],
    ["y", "υ"],
    ["v", "β"],
    ["w", "ου"],
    ["f", "φ"],
    ["x", "ξ"],
    ["h", ""], // silent in Greek
  ];

  let result = word;
  
  // Handle ending 's' character specially (final sigma 'ς')
  let endsWithS = false;
  if (result.endsWith("s")) {
    endsWithS = true;
    result = result.slice(0, -1);
  }

  // Map remaining letters to standard sigma 'σ'
  result = result.replace(/s/g, "σ");

  for (const [latin, greek] of mapping) {
    const regex = new RegExp(latin, "g");
    result = result.replace(regex, greek);
  }

  // Append final sigma if needed
  if (endsWithS) {
    result += "ς";
  }

  // Capitalize first letter
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

/**
 * Maps Latin graphemes to Arabic script (RTL).
 */
function transcribeToArabic(word: string): string {
  const mapping: [string, string][] = [
    ["sch", "ش"],
    ["sh", "ش"],
    ["th", "ث"],
    ["kh", "خ"],
    ["dh", "ذ"],
    ["gh", "غ"],
    ["ph", "ف"],
    ["a", "ا"],
    ["b", "ب"],
    ["t", "ت"],
    ["j", "ج"],
    ["h", "ه"],
    ["d", "د"],
    ["r", "ر"],
    ["z", "ز"],
    ["s", "س"],
    ["f", "ف"],
    ["q", "ق"],
    ["k", "ك"],
    ["l", "ل"],
    ["m", "م"],
    ["n", "ن"],
    ["w", "و"],
    ["u", "و"],
    ["y", "ي"],
    ["i", "ي"],
    ["o", "و"],
    ["e", "ي"],
    ["c", "ك"],
    ["v", "ف"],
    ["g", "ج"],
  ];

  let result = word;
  for (const [latin, arabic] of mapping) {
    const regex = new RegExp(latin, "g");
    result = result.replace(regex, arabic);
  }

  return result; // Arabic does not have capitalization
}

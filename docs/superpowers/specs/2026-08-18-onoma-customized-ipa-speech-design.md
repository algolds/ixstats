# Onoma Specification: Customized IRL Culture & Template/Dictionary Phonetics & Speech Engine

**Date:** 2026-08-18  
**Status:** Approved  
**Scope:** `src/lib/onoma/`, `src/hooks/useOnomaGenerator.ts`, `src/app/labs/onoma/`, `src/server/api/routers/onoma/`

---

## 1. Executive Summary

Procedural conworld naming and linguistic realism require accurate phonetics tailored to both real-world language families (Latin, Germanic, Celtic, Slavic, Arabic, Persian, Turkic, Indic, East-Asian, Austronesian, African, Uralic) and specialized fantasy/conworld templates (Elven, Dwarven, Orcish, Goblin, Dragon, Faery, Demon, Angel, Taverns, Mystic Orders, and Noble patronymic/matronymic lineages).

This specification defines:
1. **Upgraded IRL Culture Phonetics**: High-fidelity grapheme-to-IPA rule tables, phonotactic constraints, stress placement heuristics, BCP-47 speech codes, and Kokoro neural voice personas for all 13 natural language families.
2. **Template Phonetic Registry (`template-phonetics.ts`)**: 18+ dedicated linguistic profiles for fantasy species, organizations, taverns, and noble lineages.
3. **Hierarchical Phonetic Resolver**: 5-tier fallback cascade ensuring names generated from templates or stored in custom dictionaries receive authentic phonetic transcriptions and speech synthesis.
4. **Dictionary & Stash Custom Phonology**: Metadata support for dictionary-level phonology rules and per-entry explicit IPA overrides.
5. **Canonical "Hello World" Benchmark Suite**: Standardized test fixture testing the entire phonology matrix with the sentence `"Hello World"`.

---

## 2. Architecture & Resolution Hierarchy

### 2.1 5-Tier Fallback Cascade

$$\begin{CD}
\text{1. Explicit Local Override} @>\text{if not set}>> \text{2. Dictionary Entry / Metadata IPA} \\
@. @VV\text{if not set}V \\
\text{5. Universal Default} @<<\text{if not set}< \text{4. IRL Culture Family Table} @<<\text{if not set}< \text{3. Template Linguistic Profile}
\end{CD}$$

1. **Explicit Name Override**: Per-word user override in `localStorage` (`onoma-name-overrides`).
2. **Dictionary Entry / Metadata IPA**: Stashed custom dictionary entry explicit `ipa` string or custom conlang phonology rules.
3. **Template Linguistic Profile**: Exact phonetic rules, BCP-47 voice tag, and neural persona for preset templates (`species-elf`, `species-dwarf`, `noble-norman`, etc.).
4. **IRL Culture Family Rules**: High-fidelity grapheme-to-IPA scanner for the 13 natural linguistic families.
5. **Universal Default**: Standard English/Latin phonetic defaults.

### 2.2 Core Types (`src/lib/onoma/types.ts`)

```typescript
export interface LinguisticProfile {
  id: string;
  name: string;
  category: "culture" | "template" | "custom";
  description: string;
  rules: [string, string][];
  stressRule: "initial" | "penultimate" | "ultimate" | "vowel-weight" | "none";
  bcp47VoiceTag: string;
  kokoroVoicePersona?: string;
}

export interface ResolvedNamePhonetics {
  ipa: IPAString;
  bcp47VoiceTag: string;
  kokoroVoicePersona?: string;
  source: "override" | "dictionary" | "template" | "culture" | "default";
}
```

---

## 3. IRL Linguistic Family Upgrades (13 Families)

| Linguistic Family | Authentic Phonetic Enhancements | Stress Rule | BCP-47 Tag | Kokoro Persona |
|---|---|---|---|---|
| **Latin / Romance** | $c, g$ before $e,i,y \to$ [tʃ]/[dʒ] / [s]/[ʒ]; $gn \to$ [ɲ]; $gl \to$ [ʎ]; $sc \to$ [ʃ]; $qu \to$ [kʷ]; $v \to$ [w]/[v]; $ae,oe \to$ [aɪ]/[e] | Penultimate (vowel weight) | `it-IT` / `es-ES` / `la` | `bf_emma` |
| **Germanic** | $sch \to$ [ʃ]; $ch \to$ [x]/[ç]; $sp, st$ onset $\to$ [ʃp], [ʃt]; $ei \to$ [aɪ]; $ie \to$ [iː]; $eu, äu \to$ [ɔʏ]; $v \to$ [f]; $w \to$ [v]; $z, tz \to$ [ts]; $ä, ö, ü \to$ [ɛ], [ø], [y] | Initial (root onset) | `de-DE` / `nl-NL` | `bm_george` |
| **Celtic** | $ll \to$ [ɬ]; $dd, th \to$ [ð], [θ]; $rh \to$ [r̥]; $ch \to$ [x]; $bh, mh \to$ [v]; $dh, gh \to$ [ɣ]/[j]; $w \to$ [ʊ]/[uː]; $y \to$ [ə]/[ɨ] | Initial / Penultimate | `cy-GB` / `ga-IE` | `bf_isabella` |
| **Slavic** | $cz, sz, ż, ź \to$ [tʃ], [ʃ], [ʒ], [ʑ]; $rz \to$ [ʐ]; $ł \to$ [w]; $ś, ć, ń \to$ [ɕ], [tɕ], [ɲ]; $ch, kh \to$ [x]; $c \to$ [ts]; $ya, yu, ye \to$ [ja], [ju], [jɛ] | Penultimate (Polish) / Mobile | `pl-PL` / `cs-CZ` | `bf_emma` |
| **Arabic / Semitic** | $kh \to$ [x]; $gh \to$ [ɣ]; $dh \to$ [ð]; $th \to$ [θ]; $sh \to$ [ʃ]; $q \to$ [q]; $h, ḥ \to$ [ħ]; $'\ \to$ [ʔ]/[ʕ]; $ṣ, ḍ, ṭ, ẓ \to$ [sˤ], [dˤ], [tˤ], [ðˤ]; long vowels $\to$ [aː], [iː], [uː] | Penultimate (moraic) | `ar-SA` | `af_nicole` |
| **Persian / Iranian** | $kh \to$ [x]; $gh, q \to$ [ɢ]/[ɣ]; $zh \to$ [ʒ]; $ch, sh \to$ [tʃ], [ʃ]; $v \to$ [v]; $ow \to$ [oʊ]; $ey \to$ [eɪ]; $aa \to$ [ɒː] | Ultimate | `fa-IR` | `af_nicole` |
| **Turkic** | $ç \to$ [tʃ]; $ş \to$ [ʃ]; $c \to$ [dʒ]; $ğ \to$ vowel lengthening [ː]; $ı \to$ [ɯ]; $ö, ü \to$ [ø], [y]; $q, x \to$ [q], [x] | Ultimate | `tr-TR` | `am_fenrir` |
| **Indic / Sanskrit** | $kh, gh, th, dh, ph, bh \to$ aspirated [kʰ], [ɡʱ], [t̪ʰ], [d̪ʱ], [pʰ], [bʱ]; $ṭ, ḍ, ṇ \to$ retroflex [ʈ], [ɖ], [ɳ]; $ś, ṣ \to$ [ɕ], [ʂ]; $r, ṛ \to$ [ɽ]; $v, w \to$ [ʋ] | Penultimate (heavy mora) | `hi-IN` | `af_nicole` |
| **East-Asian** | *Pinyin*: $zh, ch, sh, r \to$ [ʈʂ], [ʈʂʰ], [ʂ], [ʐ]; $j, q, x \to$ [tɕ], [tɕʰ], [ɕ]; $z, c \to$ [ts], [tsʰ]; $ng \to$ [ŋ]. *Hepburn*: $tsu \to$ [tsɯ]; $shi, chi, fu \to$ [ɕi], [tɕi], [ɸɯ]; $r \to$ [ɾ] | High/Low Pitch (Flat IPA) | `ja-JP` / `zh-CN` | `af_nicole` |
| **Austronesian** | $ng \to$ [ŋ]; $c, j \to$ [tʃ], [dʒ]; $ny \to$ [ɲ]; $'\ \to$ [ʔ]; strict open-syllable CV; $wh \to$ [ɸ]/[f] | Penultimate | `id-ID` / `tl-PH` | `bf_emma` |
| **African (Bantu/Yoruba/Zulu)** | $ng' \to$ [ŋ]; $ny \to$ [ɲ]; $dh, th, gh \to$ [ð], [θ], [ɣ]; prenasalized onsets $mb, nd, ng, nj \to$ [ᵐb], [ⁿd], [ᵑɡ], [ᶮdʒ]; labial-velar $gb, kp \to$ [ɡ͡b], [k͡p] | Penultimate | `sw-KE` / `zu-ZA` | `am_fenrir` |
| **Uralic (Finnish/Hungarian)** | $gy, ty, ny, ly \to$ [ɟ], [c], [ɲ], [j]; $cs, sz, s, zs \to$ [tʃ], [s], [ʃ], [ʒ]; $y, ä, ö \to$ [y], [æ], [ø]; geminates $kk, tt, pp \to$ [kː], [tː], [pː] | Initial (always syllable 1) | `fi-FI` / `hu-HU` | `bm_george` |
| **Constructed / Conworld** | Sindarin/Quenya vowels ($ë \to$ [ɛ], $y \to$ [y], $ch \to$ [x], $dh \to$ [ð], $rh \to$ [r̥], $lh \to$ [ɬ]) | Penultimate (heavy) | `is-IS` / `cy-GB` | `bm_fable` |

---

## 4. 18+ Fantasy & Naming Convention Template Profiles

1. `species:elf`: Sindarin phonetic table ($dh \to$ [ð], $th \to$ [θ], $ch \to$ [x], $ë \to$ [ɛ], $lh, rh \to$ [ɬ], [r̥], $y \to$ [y]).
2. `species:dwarf`: Khuzdul phonetic table ($kh, gh \to$ [x], [ɣ], $th \to$ [tʰ], $z \to$ [z], $u \to$ [ʊ]).
3. `species:orc`: Black Speech guttural table ($gh \to$ [ɣ], $zg \to$ [zɡ], $ur \to$ [ʊr], $k \to$ [kʼ]).
4. `species:goblin`: Troglodytic table ($x \to$ [ks], $q \to$ [q], $zz \to$ [ts], sharp plosives).
5. `species:dragon`: Draconic sibilants & elongated velars ($ss, zz \to$ [sː], [zː], $yr \to$ [yːr]).
6. `species:faery`: Sylvan breathy table ($ll \to$ [ɬ], $ae, oe \to$ [aɪ], [ɔɪ]).
7. `species:demon`: Infernal friction table ($x \to$ [χ], $th \to$ [θ], $aa, oo \to$ [aː], [uː]).
8. `species:angel`: Celestial resonant table ($el, il \to$ [ɛl], [ɪl], $ph \to$ [f], $ae \to$ [eɪ]).
9. `organization:tavern`: Idiomatic compound phrasing with initial word stress.
10. `organization:mystic-order`: Latinate hieratic compounding with penultimate stress.
11. `organization:military-unit`: Military regiment phrasing with crisp consonants.
12. `noble:norman`: Anglo-Norman affixes (*Fitz-* $\to$ [fɪts], *de la* $\to$ [də lɑ], *le* $\to$ [lə]).
13. `noble:norse`: Scandinavian patronymics (*-son* $\to$ [sɔn], *-dottir* $\to$ [dɔhtːɪr], *af* $\to$ [aːv]).
14. `noble:celtic`: Goidelic/Brittonic patronymics (*Mac/Mc* $\to$ [mək], *O'* $\to$ [oː], *ap/ab* $\to$ [ap], [ab]).
15. `noble:iberian`: Spanish/Portuguese markers (*de* $\to$ [de], *y* $\to$ [i], *del* $\to$ [del], *da* $\to$ [dɐ]).
16. `noble:germanic`: High German titles (*von* $\to$ [fɔn], *zu* $\to$ [tsuː], *auf* $\to$ [aʊf], *vom* $\to$ [fɔm]).
17. `noble:arabic`: Classical lineage (*ibn/bin* $\to$ [ʔɪbn], [bɪn], *bint* $\to$ [bɪnt], *al-* assimilation).
18. `noble:slavic`: Slavic patronymics (*-ov/-ev/-ski* $\to$ [ɔf], [ɛf], [ski]).

---

## 5. Canonical "Hello World" Benchmark Suite

The canonical test fixture validates each phonetic profile using `"Hello World"` to verify exact vowel, consonant, and stress derivations:

```typescript
// Benchmark matrix:
// Latin:       /ˈhɛl.lo ˈwɔrld/
// Germanic:    /ˈhɛl.lo ˈvɔrld/
// Slavic:      /ˈxɛl.lo ˈvɔrld/
// Celtic:      /ˈhɛɬ.o ˈwɔrld/
// Arabic:      /ˈhɛl.lo ˈwɔrld/
// Uralic:      /ˈhɛl.lo ˈvɔrld/
// Sindarin:    /ˈhɛl.lo ˈwɔrld/
// Khuzdul:     /ˈxɛl.lo ˈwɔrld/
```

---

## 6. UI & Stash Integration

1. **`StudioPhonology.tsx`**:
   - Expanded culture selector supporting all 13 IRL families, 18 template profiles, and user-stashed conlangs.
   - Interactive rule table editor with live 2D IPA Vowel Quadrilateral ($F_1/F_2$) and FFT spectrum feedback.
2. **`StudioLexicon.tsx`**:
   - Per-dictionary default phonology profile selector.
   - Direct inline editing of word-level IPA overrides alongside definitions.
3. **`NameResultCard.tsx`**:
   - Automatically utilizes resolved template/dictionary BCP-47 voice tags and Kokoro personas for 🔊 IPA and 🎙 Read Naturally audio playback.

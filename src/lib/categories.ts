/**
 * The vocabulary local listings already print (STUZ, venue programmes), so the
 * model labels rather than invents. Lives on its own so client components can
 * import it without pulling in the Anthropic SDK.
 */
export const CATEGORIES = [
  "KONZERT",
  "PARTY",
  "FESTIVAL",
  "LESUNG",
  "KARAOKE",
  "JAM",
  "COMEDY",
  "BÜHNE",
  "KLASSIK & OPER",
  "KINO & FILM",
  "KUNST & AUSSTELLUNG",
  "BILDUNG & VORTRÄGE",
  "KINDER & JUGEND",
  "SPORT & GAMING",
  "MESSE & MÄRKTE",
  "WORKSHOP",
  "SONSTIGES",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Words that imply a category when no label is printed. Order matters: the
 * first hit wins, so the more specific terms are listed before the generic
 * ones ("poetry slam" before "slam", "open air" before "open").
 */
const HINTS: [RegExp, Category][] = [
  [/\bkaraoke\b|\bkreaoke\b/i, "KARAOKE"],
  [/\bworkshop\b|\bseminar\b|\bkurs\b/i, "WORKSHOP"],
  [/\bflohmarkt\b|\bnachtfloh\b|\bmarkt\b|\bmesse\b|\bbasar\b|\bsample sale\b|\bsale\b/i, "MESSE & MÄRKTE"],
  [/\bpoetry slam\b|\blesung\b|\bliteratur\b|\berzähl/i, "LESUNG"],
  [/\bscience slam\b|\bvortrag\b|\bvorträge\b|\bdiskussion\b|\bgespräch\b/i, "BILDUNG & VORTRÄGE"],
  [/\bcomedy\b|\bkabarett\b|\bstand.?up\b|\bimpro\b/i, "COMEDY"],
  [/\boper\b|\bklassik\b|\borchester\b|\bsinfoni|\bphilharmon|\bkammermusik\b/i, "KLASSIK & OPER"],
  [/\bkino\b|\bfilm\b|\bdokumentation\b|\bdoku\b|\bscreening\b/i, "KINO & FILM"],
  [/\bausstellung\b|\bvernissage\b|\bgalerie\b|\bkunst\b/i, "KUNST & AUSSTELLUNG"],
  [/\btheater\b|\bbühne\b|\bschauspiel\b|\bkomödie\b|\bmusical\b/i, "BÜHNE"],
  [/\bkinder\b|\bjugend\b|\bfamilien\b|\bab \d+ jahren?\b|\bpuppen/i, "KINDER & JUGEND"],
  [/\bturnier\b|\bcontest\b|\bbattle\b|\bgames\b|\besports\b|\bmeisterschaft\b/i, "SPORT & GAMING"],
  // "Open-Air" and "Open Air" both occur, often hyphenated on posters.
  [/\bopen[\s-]?air\b|\bfestival\b/i, "FESTIVAL"],
  [/\bopen stage\b|\bjam\b|\bsession\b/i, "JAM"],
  [/\bparty\b|\bdj\b|\brave\b|\bclub\b|\btanz\b|\bdisco\b|\bnachtflohmarkt\b/i, "PARTY"],
  // "Special Guests:" and "Support:" head the lineup on nearly every gig poster.
  [
    /\bkonzert\b|\blive\b|\bspecial guests?\b|\bsupport\b|\btour\b|\bband\b|\bakustik\b|\bunplugged\b/i,
    "KONZERT",
  ],
];

/** Printed labels, longest first so "KLASSIK & OPER" wins over "OPER". */
const PRINTED = [...CATEGORIES].sort((a, b) => b.length - a.length);

/**
 * Local programmes print the category next to the date — that label is the
 * answer, so look for it before guessing from the title. Falls back to keyword
 * hints, and to null rather than a wrong guess.
 */
export function detectCategory(text: string): Category | null {
  const haystack = text.toUpperCase();

  for (const category of PRINTED) {
    // "KONZERT: ROCK" and "KONZERT" both count; the ampersand forms are matched
    // loosely because OCR often drops the "&".
    const needle = category.replace(/\s*&\s*/g, ".{0,3}");
    if (new RegExp(`\\b${needle}\\b`).test(haystack)) return category;
  }

  for (const [pattern, category] of HINTS) {
    if (pattern.test(text)) return category;
  }

  return null;
}

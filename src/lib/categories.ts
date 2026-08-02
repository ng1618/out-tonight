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

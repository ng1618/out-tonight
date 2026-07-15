function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics after NFKD split
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildDedupeKey(
  title: string,
  venueName: string | null,
  startTime: string | null
): string {
  const datePart = startTime ? startTime.slice(0, 10) : "unknown-date";
  return [normalize(title), normalize(venueName ?? ""), datePart].join("|");
}

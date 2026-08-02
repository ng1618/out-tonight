import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORIES } from "./categories";

const CandidateSchema = z.object({
  title: z.string().describe("Event name exactly as printed, without the venue or date."),
  subtitle: z
    .string()
    .nullable()
    .describe("Supporting line: genre, tour name, lineup, room. Null if absent."),
  venueName: z
    .string()
    .nullable()
    .describe("Where it happens. Null if the image never names a venue."),
  city: z.string().nullable().describe("City, if printed or unambiguous from the venue."),
  startDate: z
    .string()
    .nullable()
    .describe("ISO date YYYY-MM-DD. Null if no date is printed at all."),
  endDate: z
    .string()
    .nullable()
    .describe("ISO date for multi-day events only; null for single-day events."),
  startTime: z
    .string()
    .nullable()
    .describe("24h HH:MM. Null when no clock time is printed."),
  timeNote: z
    .string()
    .nullable()
    .describe(
      'What the time actually means when it is not a plain start: "Einlass", "ab", "11-17 Uhr", "bis spät".'
    ),
  price: z
    .string()
    .nullable()
    .describe('As printed: "20 €", "AK 20 €", "Eintritt frei". Never a ticket-agency address.'),
  category: z.enum(CATEGORIES).nullable(),
  yearPrinted: z
    .boolean()
    .describe("True only if a year is actually printed for this event."),
  weekdayMatches: z
    .boolean()
    .nullable()
    .describe(
      "If a weekday AND a date are printed: does the weekday match the resolved date? Null if no weekday is printed."
    ),
  confidence: z.enum(["high", "medium", "low"]),
  needsReview: z
    .array(z.string())
    .describe("Field names you are unsure about, e.g. [\"startDate\", \"venueName\"]."),
});

const ExtractionSchema = z.object({
  imageKind: z
    .enum(["single_poster", "listing_page", "screenshot", "other"])
    .describe("What the image is, which explains how many events to expect."),
  candidates: z.array(CandidateSchema),
});

export type ExtractedCandidate = z.infer<typeof CandidateSchema>;
export type ExtractionResult = z.infer<typeof ExtractionSchema>;

const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export function isSupportedMediaType(value: string): value is SupportedMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(value);
}

const SYSTEM_PROMPT = `You read photographs of event advertising — posters, flyers, and pages from listings magazines — and pull out the events.

One image is not one event. A photographed magazine page routinely carries a dozen unrelated events: the advert itself, the venue columns beside it, day-by-day listings, and article text. Extract every event that is genuinely advertised, as a separate candidate. Ignore prose that merely mentions an event in passing, adverts for products rather than events, and anything you can only partially read at the edge of the frame.

Rules that matter more than completeness:

- Never invent a field. If something is not printed, the value is null. An empty field is a fact about the source; a guessed one is a fabrication that only surfaces when the evening is over.
- Missing years are the norm, not the exception. Local listings print "22.08." and expect the reader to know the year. You may resolve the year from the context date given in the user message, but set yearPrinted to false whenever the year was not actually on the page, and add "startDate" to needsReview.
- Cross-check weekday against date. German listings print both ("SA 04.07.", "Fr, 12.12."). If they disagree, the year or a digit is wrong: set weekdayMatches to false, lower confidence, and add "startDate" to needsReview.
- Time words carry meaning. "Einlass 15:00" is doors, not the start. "ab 14:00" is open-ended. "11-17 Uhr" is a range. Put the clock value in startTime and the qualifier in timeNote. If no clock time is printed, startTime is null — do not substitute a plausible evening hour.
- Multi-day events are one candidate with startDate and endDate ("17. bis 19. Juli", "21.-23. August"), not one per day.
- A recurring advert listing several dates for the same thing ("Schlager Special 01.07 & 09.09.") is one candidate per date.
- Small print listing ticket outlets, addresses, or phone numbers is not a price and not a venue.
- Prefer the printed category label when the source shows one.`;

function client(): Anthropic {
  // Reads ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile.
  return new Anthropic();
}

export type ExtractOutcome =
  | { status: "ok"; result: ExtractionResult }
  | { status: "refused"; category: string | null }
  | { status: "unparsed" };

export async function extractEventsFromImage(
  imageBase64: string,
  mediaType: SupportedMediaType,
  contextDate: Date = new Date()
): Promise<ExtractOutcome> {
  const today = contextDate.toISOString().slice(0, 10);
  const weekday = contextDate.toLocaleDateString("en-GB", { weekday: "long" });

  const response = await client().messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(ExtractionSchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: `Today is ${weekday}, ${today}. Use it only to resolve years that the page leaves out, and to decide which of two possible years an undated "22.08." means — never to invent a date that is not on the page.\n\nExtract every advertised event in this image.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    return { status: "refused", category: response.stop_details?.category ?? null };
  }
  if (!response.parsed_output) {
    return { status: "unparsed" };
  }

  return { status: "ok", result: response.parsed_output };
}

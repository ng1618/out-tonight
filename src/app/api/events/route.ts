import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function rangeToWindow(range: string | null): { from: string; to: string } | null {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  if (range === "tonight") {
    const from = startOfDay(now);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  if (range === "weekend") {
    const from = startOfDay(now);
    // Find the coming Friday (or today, if today is already Fri/Sat/Sun).
    const day = from.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
    const daysUntilFriday = day <= 5 ? 5 - day : 0;
    from.setDate(from.getDate() + daysUntilFriday);
    const to = new Date(from);
    to.setDate(to.getDate() + (day === 0 ? 1 : 3)); // through end of Sunday
    return { from: from.toISOString(), to: to.toISOString() };
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range");
  const includeDismissed = searchParams.get("includeDismissed") === "true";
  const includeOutOfRange = searchParams.get("includeOutOfRange") === "true";

  const db = getDb();
  const clauses: string[] = [];
  const values: (string | number)[] = [];

  if (!includeDismissed) {
    clauses.push("status != 'dismissed'");
  }
  if (!includeOutOfRange) {
    clauses.push("in_range = 1");
  }

  const window = rangeToWindow(range);
  if (window) {
    clauses.push("start_time IS NOT NULL AND start_time >= ? AND start_time < ?");
    values.push(window.from, window.to);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const events = db
    .prepare(
      `SELECT * FROM events ${where} ORDER BY start_time IS NULL, start_time ASC`
    )
    .all(...values);

  return NextResponse.json(events);
}

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { itineraryDays, itineraryItems } from "@/db/schema";
import { getTripRole, hasAtLeastRole } from "@/lib/access";

const addItemSchema = z.object({
  itineraryDayId: z.string().uuid(),
  spotId: z.string().uuid(),
  travelMode: z.enum(["walking", "driving", "transit", "bicycling"]).nullable().optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時刻の形式が正しくありません")
    .nullable()
    .optional(),
  durationMinutes: z.number().int().min(0).max(1440).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tripId } = await params;
  const role = await getTripRole(tripId, userId);
  if (!hasAtLeastRole(role, "editor")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = addItemSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();

  const [day] = await db
    .select({ id: itineraryDays.id })
    .from(itineraryDays)
    .where(
      and(
        eq(itineraryDays.id, parsed.data.itineraryDayId),
        eq(itineraryDays.tripId, tripId),
      ),
    )
    .limit(1);
  if (!day) return NextResponse.json({ error: "day_not_found" }, { status: 404 });

  const [last] = await db
    .select({ order: itineraryItems.order })
    .from(itineraryItems)
    .where(eq(itineraryItems.itineraryDayId, parsed.data.itineraryDayId))
    .orderBy(desc(itineraryItems.order))
    .limit(1);

  const [item] = await db
    .insert(itineraryItems)
    .values({
      itineraryDayId: parsed.data.itineraryDayId,
      spotId: parsed.data.spotId,
      order: (last?.order ?? -1) + 1,
      travelMode: parsed.data.travelMode ?? null,
      startTime: parsed.data.startTime ?? null,
      durationMinutes: parsed.data.durationMinutes ?? null,
    })
    .returning();

  return NextResponse.json(item, { status: 201 });
}

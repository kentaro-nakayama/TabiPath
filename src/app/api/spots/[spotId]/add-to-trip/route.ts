import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { itineraryDays, itineraryItems, savedSpots, spots } from "@/db/schema";
import { getSpotListRole, getTripRole, hasAtLeastRole } from "@/lib/access";

const addToTripSchema = z.object({
  tripId: z.string().uuid(),
  itineraryDayId: z.string().uuid(),
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
  { params }: { params: Promise<{ spotId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { spotId } = await params;
  const parsed = addToTripSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { tripId, itineraryDayId, travelMode, startTime, durationMinutes } = parsed.data;

  const role = await getTripRole(tripId, userId);
  if (!hasAtLeastRole(role, "editor")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getDb();

  const [savedSpot] = await db
    .select({
      id: savedSpots.id,
      spotListId: savedSpots.spotListId,
      name: savedSpots.name,
      address: savedSpots.address,
      lat: savedSpots.lat,
      lng: savedSpots.lng,
      googlePlaceId: savedSpots.googlePlaceId,
      notes: savedSpots.notes,
    })
    .from(savedSpots)
    .where(eq(savedSpots.id, spotId))
    .limit(1);
  if (!savedSpot) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const spotListRole = await getSpotListRole(savedSpot.spotListId, userId);
  if (!spotListRole) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [day] = await db
    .select({ id: itineraryDays.id })
    .from(itineraryDays)
    .where(and(eq(itineraryDays.id, itineraryDayId), eq(itineraryDays.tripId, tripId)))
    .limit(1);
  if (!day) return NextResponse.json({ error: "day_not_found" }, { status: 404 });

  const [tripSpot] = await db
    .insert(spots)
    .values({
      tripId,
      name: savedSpot.name,
      address: savedSpot.address,
      lat: savedSpot.lat,
      lng: savedSpot.lng,
      googlePlaceId: savedSpot.googlePlaceId,
      notes: savedSpot.notes,
      createdByUserId: userId,
    })
    .returning();

  const [last] = await db
    .select({ order: itineraryItems.order })
    .from(itineraryItems)
    .where(eq(itineraryItems.itineraryDayId, itineraryDayId))
    .orderBy(desc(itineraryItems.order))
    .limit(1);

  const [item] = await db
    .insert(itineraryItems)
    .values({
      itineraryDayId,
      spotId: tripSpot.id,
      order: (last?.order ?? -1) + 1,
      travelMode: travelMode ?? null,
      startTime: startTime ?? null,
      durationMinutes: durationMinutes ?? null,
    })
    .returning();

  return NextResponse.json({ ...item, spot: tripSpot }, { status: 201 });
}

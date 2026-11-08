import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { savedSpots } from "@/db/schema";
import { getSpotListRole, hasAtLeastRole } from "@/lib/access";

// 部分更新: クライアントはメモだけ、名前だけ、といった送り方をするため
// 送られてきたキーのみ更新する
const updateSpotSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

async function requireEditAccess(spotId: string, userId: string) {
  const db = getDb();
  const [spot] = await db
    .select({ id: savedSpots.id, spotListId: savedSpots.spotListId })
    .from(savedSpots)
    .where(eq(savedSpots.id, spotId))
    .limit(1);
  if (!spot) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };

  const role = await getSpotListRole(spot.spotListId, userId);
  if (!hasAtLeastRole(role, "editor")) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { db, spot };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ spotId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { spotId } = await params;
  const parsed = updateSpotSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await requireEditAccess(spotId, userId);
  if (result.error) return result.error;

  const updates: Partial<typeof savedSpots.$inferInsert> = { updatedAt: new Date() };
  if ("name" in parsed.data) updates.name = parsed.data.name;
  if ("notes" in parsed.data) updates.notes = parsed.data.notes ?? null;

  const [spot] = await result.db
    .update(savedSpots)
    .set(updates)
    .where(eq(savedSpots.id, spotId))
    .returning();

  return NextResponse.json(spot);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ spotId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { spotId } = await params;
  const result = await requireEditAccess(spotId, userId);
  if (result.error) return result.error;

  await result.db.delete(savedSpots).where(eq(savedSpots.id, spotId));

  return NextResponse.json({ ok: true });
}

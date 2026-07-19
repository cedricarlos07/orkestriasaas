import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { availabilityConfig, bookings } from "@/db/schema/index";
import { uid } from "./utils";

export const getBookingConfig = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await db.select().from(availabilityConfig).where(eq(availabilityConfig.id, "default")).limit(1);
  return rows[0] ?? null;
});

export const saveBookingConfig = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      timezone?: string;
      durationMin?: number;
      bufferMin?: number;
      workingDays?: number[];
      startHour?: number;
      endHour?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const row = {
      id: "default" as const,
      timezone: data.timezone ?? "Africa/Abidjan",
      durationMin: data.durationMin ?? 30,
      bufferMin: data.bufferMin ?? 10,
      workingDays: data.workingDays ?? [1, 2, 3, 4, 5],
      startHour: data.startHour ?? 9,
      endHour: data.endHour ?? 18,
      updatedAt: new Date(),
    };
    const existing = await db.select().from(availabilityConfig).where(eq(availabilityConfig.id, "default")).limit(1);
    if (existing[0]) {
      await db.update(availabilityConfig).set(row).where(eq(availabilityConfig.id, "default"));
    } else {
      await db.insert(availabilityConfig).values(row);
    }
    return row;
  });

export const listBookings = createServerFn({ method: "GET" }).handler(async () => {
  return db.select().from(bookings);
});

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      email: string;
      company?: string;
      topic: string;
      message?: string;
      startIso: string;
      endIso: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const row = {
      id: uid("bk"),
      name: data.name,
      email: data.email,
      company: data.company ?? null,
      topic: data.topic,
      message: data.message ?? null,
      startIso: new Date(data.startIso),
      endIso: new Date(data.endIso),
      status: "confirmed",
      createdAt: new Date(),
    };
    await db.insert(bookings).values(row);
    return row;
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, data.id));
    return { ok: true };
  });

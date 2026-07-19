import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { contactSubmissions } from "@/db/schema/index";
import { uid } from "./utils";

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      topic: string;
      name: string;
      email: string;
      message: string;
      context?: Record<string, unknown>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const row = {
      id: uid("ct"),
      topic: data.topic,
      name: data.name,
      email: data.email,
      message: data.message,
      context: data.context ?? {},
      createdAt: new Date(),
    };
    await db.insert(contactSubmissions).values(row);
    return row;
  });

export const listContactSubmissions = createServerFn({ method: "GET" }).handler(async () => {
  return db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt)).limit(200);
});

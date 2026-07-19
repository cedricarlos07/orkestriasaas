import { submitContact as submitContactFn } from "@/functions/contact";

export type ContactSubmission = {
  id: string;
  createdAt: string;
  topic: string;
  name: string;
  email: string;
  message: string;
  context: {
    goal?: string;
    step?: string;
    page?: string;
    referrer?: string;
    userAgent?: string;
    profileCompany?: string;
    profileRole?: string;
  };
};

export async function saveContactSubmission(
  s: Omit<ContactSubmission, "id" | "createdAt">,
): Promise<ContactSubmission> {
  const row = await submitContactFn({
    data: {
      topic: s.topic,
      name: s.name,
      email: s.email,
      message: s.message,
      context: s.context,
    },
  });
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    topic: row.topic,
    name: row.name,
    email: row.email,
    message: row.message,
    context: (row.context as ContactSubmission["context"]) ?? {},
  };
}

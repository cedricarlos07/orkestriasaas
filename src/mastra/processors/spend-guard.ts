import type { MastraDBMessage } from "@mastra/core/agent";
import type { Processor } from "@mastra/core/processors";

/**
 * Soft guardrail: remind the model never to invent spend figures
 * and never to go live without explicit user confirmation.
 */
export class SpendGuardProcessor implements Processor<"spend-guard"> {
  readonly id = "spend-guard" as const;
  readonly name = "Spend Guard";

  processInput(args: { messages: MastraDBMessage[] }): MastraDBMessage[] {
    const reminder: MastraDBMessage = {
      id: "spend-guard-reminder",
      role: "system",
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: "text",
            text: "[GUARDRAIL] N'invente aucun chiffre de dépense/CPA. Toute activation (spend) exige une confirmation explicite (« oui active »). Les créations partent toujours en PAUSE.",
          },
        ],
      },
    };
    return [reminder, ...args.messages];
  }
}

export const spendGuardProcessor = new SpendGuardProcessor();

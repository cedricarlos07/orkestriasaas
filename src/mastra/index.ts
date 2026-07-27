import { Mastra } from "@mastra/core";
import { Observability, DefaultExporter, SensitiveDataFilter } from "@mastra/observability";
import { createOrkestriaMemory, getMastraStorage } from "@/mastra/memory";
import {
  orkestriaAgent,
  campaignSpecialistAgent,
  auditSpecialistAgent,
} from "@/mastra/agents/orkestria";
import { campaignLaunchWorkflow } from "@/mastra/workflows/campaign-launch";
import { auditReportWorkflow } from "@/mastra/workflows/audit-report";
import { orkestriaScorers } from "@/mastra/scorers/media-buyer";

let _mastra: Mastra | null = null;

export function getMastra(): Mastra {
  if (_mastra) return _mastra;

  // Ensure memory/storage initialized before Mastra registers domains
  createOrkestriaMemory();
  const storage = getMastraStorage();

  _mastra = new Mastra({
    agents: {
      orkestria: orkestriaAgent,
      campaignSpecialist: campaignSpecialistAgent,
      auditSpecialist: auditSpecialistAgent,
    },
    workflows: {
      campaignLaunch: campaignLaunchWorkflow,
      auditReport: auditReportWorkflow,
    },
    storage,
    scorers: {
      mediaBuyerSafety: orkestriaScorers.mediaBuyerSafety,
    },
    observability: new Observability({
      configs: {
        default: {
          serviceName: "orkestria",
          exporters: [new DefaultExporter()],
          spanOutputProcessors: [new SensitiveDataFilter()],
        },
      },
    }),
  });

  return _mastra;
}

export { orkestriaAgent, campaignSpecialistAgent, auditSpecialistAgent };
export { campaignLaunchWorkflow, auditReportWorkflow };

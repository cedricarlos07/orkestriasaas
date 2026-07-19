import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCampaign as createCampaignFn,
  duplicateCampaign as duplicateCampaignFn,
  listCampaigns,
  updateCampaignStatus,
} from "@/functions/campaigns";

export type CampaignStatus = "draft" | "paused" | "live";

export type Campaign = {
  id: string;
  name: string;
  channel: "Meta" | "Google" | "TikTok" | string;
  status: CampaignStatus | string;
  spend: string;
  conv: number;
  roas: string;
  zone?: string | null;
  budget?: string | null;
  createdAt: Date | number;
  updatedAt: Date | number;
};

function mapCampaign(c: Awaited<ReturnType<typeof listCampaigns>>[number]): Campaign {
  return {
    ...c,
    channel: c.channel as Campaign["channel"],
    status: c.status as CampaignStatus,
    createdAt: c.createdAt.getTime(),
    updatedAt: c.updatedAt.getTime(),
  };
}

export function useCampaigns() {
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => (await listCampaigns()).map(mapCampaign),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["campaigns"] });

  const duplicateMut = useMutation({
    mutationFn: (id: string) => duplicateCampaignFn({ data: { id } }),
    onSuccess: invalidate,
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CampaignStatus }) =>
      updateCampaignStatus({ data: { id, status } }),
    onSuccess: invalidate,
  });

  const addMut = useMutation({
    mutationFn: (c: { name: string; channel: string; zone?: string; budget?: string }) =>
      createCampaignFn({ data: c }),
    onSuccess: invalidate,
  });

  return {
    list,
    isLoading,
    duplicate: (id: string) => duplicateMut.mutateAsync(id).then(mapCampaign),
    setStatus: (id: string, status: CampaignStatus) => statusMut.mutate({ id, status }),
    add: (c: Omit<Campaign, "id" | "createdAt" | "updatedAt" | "status" | "spend" | "conv" | "roas">) =>
      addMut.mutateAsync(c).then(mapCampaign),
  };
}

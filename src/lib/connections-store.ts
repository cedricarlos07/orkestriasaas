import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectPlatform,
  getOAuthAuthorizeUrl,
  listConnectionCatalog,
  listConnections,
  type ConnectionView,
} from "@/functions/connections";
import { getOAuthAvailability } from "@/functions/platform-config";
import type { ConnectorId } from "@/lib/oauth/connectors";

export function useConnections() {
  const qc = useQueryClient();
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => listConnections(),
  });
  const { data: catalog = [] } = useQuery({
    queryKey: ["connection-catalog"],
    queryFn: () => listConnectionCatalog(),
  });
  const { data: platformConfig } = useQuery({
    queryKey: ["platform-config"],
    queryFn: () => getOAuthAvailability(),
  });

  const connect = async (connector: ConnectorId) => {
    const item = catalog.find((c) => c.id === connector);
    if (item && !item.configured) {
      throw new Error(`${item.label} n'est pas configuré sur le serveur (credentials manquantes).`);
    }
    if (item?.connectMode === "unified") {
      window.open("https://app.adkit.so", "_blank", "noopener,noreferrer");
      return;
    }
    window.location.href = `/api/oauth/${connector}/authorize`;
  };

  const disconnectMut = useMutation({
    mutationFn: (connectionId: string) => disconnectPlatform({ data: { connectionId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });

  const byConnector = (connector: ConnectorId): ConnectionView | undefined =>
    connections.find((c) => c.connector === connector);

  return {
    connections,
    catalog,
    platformConfig,
    isLoading,
    connect,
    disconnect: (id: string) => disconnectMut.mutate(id),
    byConnector,
  };
}

export async function fetchOAuthUrl(connector: ConnectorId) {
  const { url } = await getOAuthAuthorizeUrl({ data: { connector } });
  return url;
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectConnectorPlatform,
  disconnectPlatform,
  getOAuthAuthorizeUrl,
  listConnectionCatalog,
  listConnections,
  type ConnectionView,
} from "@/functions/connections";
import { getOAuthAvailability } from "@/functions/platform-config";
import type { ConnectorId } from "@/lib/oauth/connectors";

function invalidateConnectionQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["connections"] });
  void qc.invalidateQueries({ queryKey: ["connection-catalog"] });
  void qc.invalidateQueries({ queryKey: ["meta-setup-status"] });
  void qc.invalidateQueries({ queryKey: ["google-setup-status"] });
  void qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
  void qc.invalidateQueries({ queryKey: ["setup-status"] });
}

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
      throw new Error(
        "Ce compte se lie côté Orkestria. Actualisez la page Connexions ou contactez le support.",
      );
    }
    window.location.href = `/api/oauth/${connector}/authorize`;
  };

  const disconnectMut = useMutation({
    mutationFn: (connectionId: string) => disconnectPlatform({ data: { connectionId } }),
    onSuccess: () => invalidateConnectionQueries(qc),
  });

  const disconnectConnectorMut = useMutation({
    mutationFn: (connector: ConnectorId) => disconnectConnectorPlatform({ data: { connector } }),
    onSuccess: () => invalidateConnectionQueries(qc),
  });

  const byConnector = (connector: ConnectorId): ConnectionView | undefined => {
    const active = connections.find((c) => c.connector === connector && c.status === "connectée");
    return active ?? connections.find((c) => c.connector === connector);
  };

  return {
    connections,
    catalog,
    platformConfig,
    isLoading,
    connect,
    disconnect: (id: string) => disconnectMut.mutate(id),
    disconnectConnector: (connector: ConnectorId) => disconnectConnectorMut.mutateAsync(connector),
    disconnecting: disconnectMut.isPending || disconnectConnectorMut.isPending,
    byConnector,
  };
}

export async function fetchOAuthUrl(connector: ConnectorId) {
  const { url } = await getOAuthAuthorizeUrl({ data: { connector } });
  return url;
}

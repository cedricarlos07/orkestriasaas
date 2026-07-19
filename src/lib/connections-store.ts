import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectPlatform,
  getOAuthAuthorizeUrl,
  listConnectionCatalog,
  listConnections,
  type ConnectionView,
} from "@/functions/connections";
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

  const connect = (connector: ConnectorId) => {
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

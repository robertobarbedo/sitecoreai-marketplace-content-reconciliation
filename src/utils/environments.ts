import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type { EnvironmentInfo } from "@/src/types/reconciliation";

/**
 * Lists the environments this (standalone, hence org-global) app has access
 * to — one resourceAccess entry per environment, each carrying the
 * sitecoreContextId (context.preview) its authoring GraphQL expects.
 */
export async function getEnvironments(
  client: ClientSDK,
): Promise<EnvironmentInfo[]> {
  const contextResponse = await client.query("application.context");
  const appContext = contextResponse.data as
    | Record<string, unknown>
    | undefined;
  const resourceAccess = (appContext?.resourceAccess ??
    appContext?.resources) as
    | Array<{
        tenantId?: string;
        tenantName?: string;
        tenantDisplayName?: string;
        context?: { preview?: string };
      }>
    | undefined;

  return (resourceAccess ?? [])
    .filter((resource) => resource.context?.preview)
    .map((resource, index) => ({
      tenantId:
        resource.tenantId ?? resource.context?.preview ?? String(index),
      tenantName:
        resource.tenantName ?? resource.tenantId ?? `environment-${index + 1}`,
      tenantDisplayName: resource.tenantDisplayName,
      contextId: resource.context?.preview ?? "",
    }));
}

export function environmentLabel(env: {
  tenantDisplayName?: string;
  tenantName: string;
}): string {
  return env.tenantDisplayName || env.tenantName;
}

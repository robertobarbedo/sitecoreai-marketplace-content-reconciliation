# SDK Information Dump — Standalone Extension

Captured output from [`src/app/standalone-extension/page.tsx`](src/app/standalone-extension/page.tsx) running inside the Sitecore Cloud Portal standalone extension (iframe).

**Prerequisites**

- Packages: `@sitecore-marketplace-sdk/client`, `@sitecore-marketplace-sdk/xmc`
- Hook: [`useMarketplaceClient`](src/utils/hooks/useMarketplaceClient.ts) initializes the client with the `XMC` module
- Host: app must be embedded in the Marketplace host (`window.parent`); queries are proxied by the host SDK

```typescript
const client = await ClientSDK.init({
  target: window.parent,
  modules: [XMC],
});
```

**General pattern for context queries**

```typescript
const response = await client.query("<query-key>");
// response contains: data, status, isLoading, isError, isSuccess, error
```

---

## Client SDK

### How retrieved

Built locally from the `useMarketplaceClient()` hook return value — not an SDK query. Reflects client initialization state and lists known query keys / client methods exposed by the page.

| Field | Source |
|-------|--------|
| `isInitialized`, `isLoading`, `hasClient`, `initError` | `useMarketplaceClient()` state |
| `initializeAvailable` | `typeof initialize === "function"` |
| `availableQueryKeys` | Hard-coded list in the page (`CONTEXT_QUERY_KEYS`) |
| `availableClientMethods` | Documented `ClientSDK` methods |

### Result

```json
{
  "isInitialized": true,
  "isLoading": false,
  "hasClient": true,
  "initializeAvailable": true,
  "availableQueryKeys": [
    "application.context",
    "host.user",
    "host.state",
    "pages.context",
    "site.context",
    "host.route"
  ],
  "availableClientMethods": [
    "query",
    "mutate",
    "logout",
    "openProfile",
    "navigateToExternalUrl",
    "emitRouteEvent",
    "getValue",
    "setValue",
    "closeApp",
    "destroy"
  ],
  "initError": null
}
```

---

## Query: application.context

### How retrieved

```typescript
const response = await client.query("application.context");
```

- **SDK query key:** `application.context`
- **Subscribe:** no (one-off request)
- **Returns:** `ApplicationContext` — app metadata, environments (`resourceAccess`), extension points, permissions, etc.
- **When:** On page load, after `isInitialized && client` (via `Promise.allSettled` with other context queries)

This is the primary source for discovering **accessible environments** (`resourceAccess[]`).

### Result

```json
{
  "data": {
    "id": "41e7f4fd-7421-4041-aa1c-7071886370c2",
    "name": "Standalone",
    "type": "custom",
    "url": "http://localhost:3000/standalone-extension?organizationId=org_lxSEYVnF3YpVUlEQ&marketplaceAppTenantId=ed21bd8d-e81d-49b0-23b1-08dec71a5844",
    "iconUrl": "https://media.sitecorecloud.io/api/media/v2/delivery/cf2c1403-5ee3-436e-0fa3-08de06908b4e/96eafaaa5e7342e5b711d8f66cccced7",
    "state": "active",
    "installationId": "c1b67650-ae50-4eab-9a97-7f29fce4f06c",
    "organizationId": "org_lxSEYVnF3YpVUlEQ",
    "marketplaceAppTenantId": "ed21bd8d-e81d-49b0-23b1-08dec71a5844",
    "resources": [
      {
        "resourceId": "xmcloud",
        "tenantId": "4e6ebf29-b3b3-469f-90da-08dd56fcafa6",
        "tenantName": null,
        "tenantDisplayName": "CLHIA / dev",
        "context": {
          "preview": "1682yejPZOoCQeIUSUCyW2",
          "live": "1dCOXJB0USsaiQoSMWs4CO"
        }
      },
      {
        "resourceId": "xmcloud",
        "tenantId": "e4cbb238-639a-4a60-3901-08dd1a149b4e",
        "tenantName": null,
        "tenantDisplayName": "CLHIA / qa",
        "context": {
          "preview": "2ilrgepli8wuMyC2ukgeA6",
          "live": "3eJMlwA0G4uSyi4sMy8eSa"
        }
      }
    ],
    "touchpoints": [
      {
        "touchpointId": "standalone",
        "route": "/standalone-extension",
        "meta": [
          {
            "id": "standalone",
            "route": "/standalone-extension",
            "title": "Standalone",
            "description": "Full screen in Cloud Portal",
            "iconUrl": null,
            "pictureUrl": null,
            "developerName": "Canadian Life and Health Insurance Association"
          }
        ]
      }
    ],
    "developer": null,
    "permissions": {
      "iframe": {
        "sandbox": [
          "allow-downloads",
          "allow-popups",
          "allow-popups-to-escape-sandbox"
        ],
        "allow": [
          "clipboard-read",
          "clipboard-write"
        ]
      }
    },
    "deletion": {
      "isPending": false,
      "scheduledAt": null
    },
    "resourceAccess": [
      {
        "resourceId": "xmcloud",
        "tenantId": "4e6ebf29-b3b3-469f-90da-08dd56fcafa6",
        "tenantName": null,
        "tenantDisplayName": "CLHIA / dev",
        "context": {
          "preview": "1682yejPZOoCQeIUSUCyW2",
          "live": "1dCOXJB0USsaiQoSMWs4CO"
        }
      },
      {
        "resourceId": "xmcloud",
        "tenantId": "e4cbb238-639a-4a60-3901-08dd1a149b4e",
        "tenantName": null,
        "tenantDisplayName": "CLHIA / qa",
        "context": {
          "preview": "2ilrgepli8wuMyC2ukgeA6",
          "live": "3eJMlwA0G4uSyi4sMy8eSa"
        }
      }
    ],
    "extensionPoints": [
      {
        "route": "/standalone-extension",
        "meta": [
          {
            "id": "standalone",
            "route": "/standalone-extension",
            "title": "Standalone",
            "description": "Full screen in Cloud Portal",
            "iconUrl": null,
            "pictureUrl": null,
            "developerName": "Canadian Life and Health Insurance Association"
          }
        ],
        "extensionPointId": "standalone"
      }
    ]
  },
  "status": "success",
  "isLoading": false,
  "isError": false,
  "isSuccess": true
}
```

---

## Query: host.user

### How retrieved

```typescript
const response = await client.query("host.user");
```

- **SDK query key:** `host.user`
- **Subscribe:** no
- **Returns:** Authenticated user profile from the host (Auth0 / Sitecore identity claims)
- **When:** On page load, parallel with other context queries

### Result

```json
{
  "data": {
    "https://auth.sitecorecloud.io/claims/org_id": "org_lxSEYVnF3YpVUlEQ",
    "https://auth.sitecorecloud.io/claims/org_name": "canadian-life-and-health-insurance-association-1",
    "https://auth.sitecorecloud.io/claims/org_display_name": "Canadian Life and Health Insurance Association",
    "https://auth.sitecorecloud.io/claims/org_account_id": "001Uj000007LlWEIA0",
    "https://auth.sitecorecloud.io/claims/org_type": "customer",
    "sc_org_region": "use",
    "https://auth.sitecorecloud.io/claims/tenant_id": "ed21bd8d-e81d-49b0-23b1-08dec71a5844",
    "https://auth.sitecorecloud.io/claims/tenant_name": "550a96b6-8eba-4db1-a470-1a7d64c63369",
    "sc_sys_id": "5c01153f-464a-464d-b691-23c131bf73f0",
    "https://auth.sitecorecloud.io/claims/roles": [
      "[Organization]\\Organization Admin"
    ],
    "given_name": "Roberto",
    "family_name": "Barbedo",
    "nickname": "roberto.barbedo",
    "name": "roberto.barbedo@verndale.com",
    "picture": "https://s.gravatar.com/avatar/feb15f6af8d269f3a78ee174db5b22f2?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fro.png",
    "updated_at": "2026-07-11T13:54:00.966Z",
    "email": "roberto.barbedo@verndale.com",
    "email_verified": true,
    "sub": "auth0|6a4bab84271b2c41db81c2c5"
  },
  "status": "success",
  "isLoading": false,
  "isError": false,
  "isSuccess": true
}
```

---

## Query: host.state

### How retrieved

```typescript
const response = await client.query("host.state");
```

- **SDK query key:** `host.state`
- **Subscribe:** yes (supports live updates; page uses one-off query)
- **Returns:** Current host environment state (e.g. `environment`, `language` when running in XM Apps)
- **When:** On page load, parallel with other context queries

### Result

**Failed in standalone extension** — timed out after 30s. Expected when not running inside an XM Apps host context.

```json
{
  "error": {
    "code": "TIMEOUT",
    "details": "Request for action \"host.state:query\" timed out after 30000 ms.",
    "name": "CoreError"
  },
  "status": "error",
  "isLoading": false,
  "isError": true,
  "isSuccess": false
}
```

---

## Query: pages.context

### How retrieved

```typescript
const response = await client.query("pages.context");
```

- **SDK query key:** `pages.context`
- **Subscribe:** yes
- **Returns:** Current page/site info when running in the Pages context panel extension point
- **When:** On page load, parallel with other context queries

### Result

**Failed in standalone extension** — not available outside the Pages context panel extension point.

```json
{
  "error": {
    "code": "EXECUTION_ERROR",
    "details": {},
    "name": "CoreError"
  },
  "status": "error",
  "isLoading": false,
  "isError": true,
  "isSuccess": false
}
```

---

## Query: site.context

### How retrieved

```typescript
const response = await client.query("site.context");
```

- **SDK query key:** `site.context`
- **Subscribe:** no
- **Returns:** Site-level context (site info, hosts) when available from the host
- **When:** On page load, parallel with other context queries

### Result

**Failed in standalone extension** — host does not expose site context in this extension point.

```json
{
  "error": {
    "code": "EXECUTION_ERROR",
    "details": {},
    "name": "CoreError"
  },
  "status": "error",
  "isLoading": false,
  "isError": true,
  "isSuccess": false
}
```

---

## Query: host.route

### How retrieved

```typescript
const response = await client.query("host.route");
```

- **SDK query key:** `host.route`
- **Subscribe:** no
- **Returns:** Current host route string
- **When:** On page load, parallel with other context queries

### Result

Query succeeded but returned no route data in this context.

```json
{
  "status": "success",
  "isLoading": false,
  "isError": false,
  "isSuccess": true
}
```

---

## Application Context (full object)

### How retrieved

Extracted from the **`application.context`** query response — the `data` property of the query result, stored in React state as `appContext`:

```typescript
const response = await client.query("application.context");
setAppContext(response.data);
```

This section is a re-display of the same object (all top-level properties), not a separate API call.

### Result

```json
{
  "id": "41e7f4fd-7421-4041-aa1c-7071886370c2",
  "name": "Standalone",
  "type": "custom",
  "url": "http://localhost:3000/standalone-extension?organizationId=org_lxSEYVnF3YpVUlEQ&marketplaceAppTenantId=ed21bd8d-e81d-49b0-23b1-08dec71a5844",
  "iconUrl": "https://media.sitecorecloud.io/api/media/v2/delivery/cf2c1403-5ee3-436e-0fa3-08de06908b4e/96eafaaa5e7342e5b711d8f66cccced7",
  "state": "active",
  "installationId": "c1b67650-ae50-4eab-9a97-7f29fce4f06c",
  "organizationId": "org_lxSEYVnF3YpVUlEQ",
  "marketplaceAppTenantId": "ed21bd8d-e81d-49b0-23b1-08dec71a5844",
  "resources": [
    {
      "resourceId": "xmcloud",
      "tenantId": "4e6ebf29-b3b3-469f-90da-08dd56fcafa6",
      "tenantName": null,
      "tenantDisplayName": "CLHIA / dev",
      "context": {
        "preview": "1682yejPZOoCQeIUSUCyW2",
        "live": "1dCOXJB0USsaiQoSMWs4CO"
      }
    },
    {
      "resourceId": "xmcloud",
      "tenantId": "e4cbb238-639a-4a60-3901-08dd1a149b4e",
      "tenantName": null,
      "tenantDisplayName": "CLHIA / qa",
      "context": {
        "preview": "2ilrgepli8wuMyC2ukgeA6",
        "live": "3eJMlwA0G4uSyi4sMy8eSa"
      }
    }
  ],
  "touchpoints": [
    {
      "touchpointId": "standalone",
      "route": "/standalone-extension",
      "meta": [
        {
          "id": "standalone",
          "route": "/standalone-extension",
          "title": "Standalone",
          "description": "Full screen in Cloud Portal",
          "iconUrl": null,
          "pictureUrl": null,
          "developerName": "Canadian Life and Health Insurance Association"
        }
      ]
    }
  ],
  "developer": null,
  "permissions": {
    "iframe": {
      "sandbox": [
        "allow-downloads",
        "allow-popups",
        "allow-popups-to-escape-sandbox"
      ],
      "allow": [
        "clipboard-read",
        "clipboard-write"
      ]
    }
  },
  "deletion": {
    "isPending": false,
    "scheduledAt": null
  },
  "resourceAccess": [
    {
      "resourceId": "xmcloud",
      "tenantId": "4e6ebf29-b3b3-469f-90da-08dd56fcafa6",
      "tenantName": null,
      "tenantDisplayName": "CLHIA / dev",
      "context": {
        "preview": "1682yejPZOoCQeIUSUCyW2",
        "live": "1dCOXJB0USsaiQoSMWs4CO"
      }
    },
    {
      "resourceId": "xmcloud",
      "tenantId": "e4cbb238-639a-4a60-3901-08dd1a149b4e",
      "tenantName": null,
      "tenantDisplayName": "CLHIA / qa",
      "context": {
        "preview": "2ilrgepli8wuMyC2ukgeA6",
        "live": "3eJMlwA0G4uSyi4sMy8eSa"
      }
    }
  ],
  "extensionPoints": [
    {
      "route": "/standalone-extension",
      "meta": [
        {
          "id": "standalone",
          "route": "/standalone-extension",
          "title": "Standalone",
          "description": "Full screen in Cloud Portal",
          "iconUrl": null,
          "pictureUrl": null,
          "developerName": "Canadian Life and Health Insurance Association"
        }
      ],
      "extensionPointId": "standalone"
    }
  ]
}
```

---

## Resource Access / Environments

### How retrieved

Derived from `appContext` — **not a separate API call**. Each entry represents one XM Cloud environment the app can access.

```typescript
const environments = appContext.resourceAccess ?? appContext.resources ?? [];
```

| Property | Meaning |
|----------|---------|
| `tenantDisplayName` | Human-readable environment name (e.g. `CLHIA / dev`) |
| `tenantId` | Environment/tenant UUID |
| `context.live` | Sitecore Context ID for live — used as `sitecoreContextId` in XMC API calls |
| `context.preview` | Sitecore Context ID for preview |

There is no dedicated "list environments" SDK endpoint; `resourceAccess` is the source of truth.

### Result

```json
[
  {
    "resourceId": "xmcloud",
    "tenantId": "4e6ebf29-b3b3-469f-90da-08dd56fcafa6",
    "tenantName": null,
    "tenantDisplayName": "CLHIA / dev",
    "context": {
      "preview": "1682yejPZOoCQeIUSUCyW2",
      "live": "1dCOXJB0USsaiQoSMWs4CO"
    }
  },
  {
    "resourceId": "xmcloud",
    "tenantId": "e4cbb238-639a-4a60-3901-08dd1a149b4e",
    "tenantName": null,
    "tenantDisplayName": "CLHIA / qa",
    "context": {
      "preview": "2ilrgepli8wuMyC2ukgeA6",
      "live": "3eJMlwA0G4uSyi4sMy8eSa"
    }
  }
]
```

---

## Extension Points

### How retrieved

Derived from `appContext` — **not a separate API call**.

```typescript
const extensionPoints = appContext.extensionPoints ?? appContext.touchpoints ?? [];
```

Lists where this Marketplace app is registered (routes, titles, descriptions).

### Result

```json
[
  {
    "route": "/standalone-extension",
    "meta": [
      {
        "id": "standalone",
        "route": "/standalone-extension",
        "title": "Standalone",
        "description": "Full screen in Cloud Portal",
        "iconUrl": null,
        "pictureUrl": null,
        "developerName": "Canadian Life and Health Insurance Association"
      }
    ],
    "extensionPointId": "standalone"
  }
]
```

---

## Sites by Environment

### How retrieved

After `application.context` loads, the page iterates every `resourceAccess` entry and calls the **SitecoreAI Sites REST API** via the XMC module — one request per environment, using the **live** context ID.

```typescript
for (const resource of appContext.resourceAccess) {
  const sitecoreContextId = resource.context.live;

  const response = await client.query("xmc.xmapp.listSites", {
    params: {
      query: { sitecoreContextId },
    },
  });

  // Sites array is at response.data.data (hey-api wrapper)
  const sites = response.data.data;
}
```

- **SDK query key:** `xmc.xmapp.listSites`
- **Underlying API:** `GET /api/v1/sites?sitecoreContextId=<live context id>`
- **Docs:** [Make a SitecoreAI Sites REST API request](https://doc.sitecore.com/mp/en/developers/sdk/0/sitecore-marketplace-sdk/make-a-sitecoreai-sites-rest-api-request.html)
- **Parallelism:** `Promise.allSettled` — one environment failing does not block others
- **Context used:** `context.live` (not preview)

---

### CLHIA / dev

#### Environment Resource

Single entry from `resourceAccess` for this environment (passed through as-is).

```json
{
  "resourceId": "xmcloud",
  "tenantId": "4e6ebf29-b3b3-469f-90da-08dd56fcafa6",
  "tenantName": null,
  "tenantDisplayName": "CLHIA / dev",
  "context": {
    "preview": "1682yejPZOoCQeIUSUCyW2",
    "live": "1dCOXJB0USsaiQoSMWs4CO"
  }
}
```

#### listSites Query Response

Full `client.query("xmc.xmapp.listSites")` result for `sitecoreContextId: "1dCOXJB0USsaiQoSMWs4CO"`.

```json
{
  "data": {
    "data": [
      {
        "id": "ac5fdc0c-f33b-4524-b6f7-aa2e42cf857a",
        "name": "CLHIA",
        "description": "",
        "displayName": "CLHIA",
        "thumbnail": {
          "url": "https://xmc-canadianlif38a5-clhiaa22e-dev232a.sitecorecloud.io/-/media/Project/CLHIA/CLHIA/System/thumbnail_ac5fdc0c-f33b-4524-b6f7-aa2e42cf857a.png?db=master&w=320&rev=a7a5c4fbfd8d49819e407764f334409e&hash=8E38BA4F6C59AAD5CCE633BADAF0ED17",
          "rootPath": "/sitecore/media library/Project/CLHIA/CLHIA",
          "autogenerated": false
        },
        "collectionId": "8f98844f4d604613a97a1be08aa532ea",
        "created": "2024-11-13T01:42:35+00:00",
        "createdBy": "sitecore\\rbarbedo@getfishtank.ca",
        "sortOrder": 100,
        "brandKitId": null,
        "permissions": {
          "canAdmin": true,
          "canWrite": true,
          "canCreate": true,
          "canDelete": true,
          "canRename": true,
          "canRead": true,
          "canPublish": true,
          "canDuplicate": true,
          "canWriteLanguage": true
        },
        "languages": [
          "en",
          "en-CA",
          "fr-CA"
        ],
        "hosts": [
          {
            "id": "12e01532-c02b-4b7c-ac41-87acfa6266ea",
            "name": "CLHIA",
            "hostnames": [
              "*"
            ],
            "targetHostname": "clhia-dev.vercel.app",
            "homePageId": "fac87f27-6a93-4be4-a16f-272740a94984",
            "renderingHost": {
              "id": "dffee92b044145a4920767810b72bd46",
              "name": "Default",
              "appName": "nextjsstarter",
              "layoutServiceConfiguration": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io:443/api/editing/config",
              "serverSideRenderingEngineEndpointUrl": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io:443/api/editing/render",
              "serverSideRenderingEngineApplicationUrl": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io/"
            },
            "editingHost": {
              "id": "dffee92b044145a4920767810b72bd46",
              "name": "Default",
              "appName": "nextjsstarter",
              "layoutServiceConfiguration": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io:443/api/editing/config",
              "serverSideRenderingEngineEndpointUrl": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io:443/api/editing/render",
              "serverSideRenderingEngineApplicationUrl": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io/"
            },
            "permissions": {
              "canAdmin": true,
              "canWrite": true,
              "canCreate": true,
              "canDelete": true,
              "canRename": true,
              "canRead": true,
              "canPublish": true,
              "canDuplicate": true,
              "canWriteLanguage": true
            },
            "settings": {
              "rootID": "{AC5FDC0C-F33B-4524-B6F7-AA2E42CF857A}",
              "scheme": "https",
              "collectionID": "{8F98844F-4D60-4613-A97A-1BE08AA532EA}"
            },
            "properties": {
              "IsSxaSite": "true",
              "linkProvider": "",
              "isSiteThumbnailSource": "true",
              "rootPath": "/sitecore/content/CLHIA/CLHIA",
              "startItem": "/Home",
              "SxaSiteTemplate": "{E46F3AF2-39FA-4866-A157-7017C4B2A40C}",
              "siteDefinitionPath": "/sitecore/content/CLHIA/CLHIA/Settings/Site Grouping/CLHIA",
              "sxaLinkable": "false",
              "siteDefinitionID": "{12E01532-C02B-4B7C-AC41-87ACFA6266EA}",
              "isInternal": "false",
              "idp": "Auth0,Bearer,OrcaBearer"
            },
            "analyticsIdentifiers": {},
            "languageSettings": {
              "defaultLanguage": "en-CA",
              "languageEmbedding": true,
              "itemLanguageFallback": false,
              "fieldLanguageFallback": false
            },
            "created": "0001-01-01T00:00:00",
            "createdBy": null
          }
        ],
        "supportedLanguages": [
          "en",
          "en-CA",
          "fr-CA"
        ],
        "errorPages": {
          "errorPage": null,
          "notFoundPage": null
        },
        "errorPagesConfiguration": {
          "errorPage": {
            "id": null,
            "path": null
          },
          "notFoundPage": {
            "id": null,
            "path": null
          }
        },
        "settings": {
          "thumbnailsRootPath": "/sitecore/media library/Project/CLHIA/CLHIA",
          "generateThumbnails": "true"
        },
        "properties": {
          "IsSxaSite": "true",
          "rootPath": "/sitecore/content/CLHIA/CLHIA",
          "SxaSiteTemplate": "{E46F3AF2-39FA-4866-A157-7017C4B2A40C}",
          "siteTemplate": "",
          "sitemapConfigId": "69319d08-ac5d-4959-80d9-ab30b5cd714a",
          "tagsFolderId": null,
          "linkSettings": "ItselfOnly",
          "sharedSite": "false",
          "XA.Foundation.LocalDatasources.Enabled": "true"
        }
      }
    ],
    "request": {},
    "response": {}
  },
  "status": "success",
  "isLoading": false,
  "isError": false,
  "isSuccess": true,
  "error": null
}
```

#### Site 1: CLHIA

Individual site object extracted from `response.data.data[]` via `normalizeSites()`.

```json
{
  "id": "ac5fdc0c-f33b-4524-b6f7-aa2e42cf857a",
  "name": "CLHIA",
  "description": "",
  "displayName": "CLHIA",
  "thumbnail": {
    "url": "https://xmc-canadianlif38a5-clhiaa22e-dev232a.sitecorecloud.io/-/media/Project/CLHIA/CLHIA/System/thumbnail_ac5fdc0c-f33b-4524-b6f7-aa2e42cf857a.png?db=master&w=320&rev=a7a5c4fbfd8d49819e407764f334409e&hash=8E38BA4F6C59AAD5CCE633BADAF0ED17",
    "rootPath": "/sitecore/media library/Project/CLHIA/CLHIA",
    "autogenerated": false
  },
  "collectionId": "8f98844f4d604613a97a1be08aa532ea",
  "created": "2024-11-13T01:42:35+00:00",
  "createdBy": "sitecore\\rbarbedo@getfishtank.ca",
  "sortOrder": 100,
  "brandKitId": null,
  "permissions": {
    "canAdmin": true,
    "canWrite": true,
    "canCreate": true,
    "canDelete": true,
    "canRename": true,
    "canRead": true,
    "canPublish": true,
    "canDuplicate": true,
    "canWriteLanguage": true
  },
  "languages": [
    "en",
    "en-CA",
    "fr-CA"
  ],
  "hosts": [
    {
      "id": "12e01532-c02b-4b7c-ac41-87acfa6266ea",
      "name": "CLHIA",
      "hostnames": [
        "*"
      ],
      "targetHostname": "clhia-dev.vercel.app",
      "homePageId": "fac87f27-6a93-4be4-a16f-272740a94984",
      "renderingHost": {
        "id": "dffee92b044145a4920767810b72bd46",
        "name": "Default",
        "appName": "nextjsstarter",
        "layoutServiceConfiguration": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io:443/api/editing/config",
        "serverSideRenderingEngineEndpointUrl": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io:443/api/editing/render",
        "serverSideRenderingEngineApplicationUrl": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io/"
      },
      "editingHost": {
        "id": "dffee92b044145a4920767810b72bd46",
        "name": "Default",
        "appName": "nextjsstarter",
        "layoutServiceConfiguration": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io:443/api/editing/config",
        "serverSideRenderingEngineEndpointUrl": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io:443/api/editing/render",
        "serverSideRenderingEngineApplicationUrl": "https://xmc-eh-1ham8g3tx7qlchk7hkcpyj.sitecorecloud.io/"
      },
      "permissions": {
        "canAdmin": true,
        "canWrite": true,
        "canCreate": true,
        "canDelete": true,
        "canRename": true,
        "canRead": true,
        "canPublish": true,
        "canDuplicate": true,
        "canWriteLanguage": true
      },
      "settings": {
        "rootID": "{AC5FDC0C-F33B-4524-B6F7-AA2E42CF857A}",
        "scheme": "https",
        "collectionID": "{8F98844F-4D60-4613-A97A-1BE08AA532EA}"
      },
      "properties": {
        "IsSxaSite": "true",
        "linkProvider": "",
        "isSiteThumbnailSource": "true",
        "rootPath": "/sitecore/content/CLHIA/CLHIA",
        "startItem": "/Home",
        "SxaSiteTemplate": "{E46F3AF2-39FA-4866-A157-7017C4B2A40C}",
        "siteDefinitionPath": "/sitecore/content/CLHIA/CLHIA/Settings/Site Grouping/CLHIA",
        "sxaLinkable": "false",
        "siteDefinitionID": "{12E01532-C02B-4B7C-AC41-87ACFA6266EA}",
        "isInternal": "false",
        "idp": "Auth0,Bearer,OrcaBearer"
      },
      "analyticsIdentifiers": {},
      "languageSettings": {
        "defaultLanguage": "en-CA",
        "languageEmbedding": true,
        "itemLanguageFallback": false,
        "fieldLanguageFallback": false
      },
      "created": "0001-01-01T00:00:00",
      "createdBy": null
    }
  ],
  "supportedLanguages": [
    "en",
    "en-CA",
    "fr-CA"
  ],
  "errorPages": {
    "errorPage": null,
    "notFoundPage": null
  },
  "errorPagesConfiguration": {
    "errorPage": {
      "id": null,
      "path": null
    },
    "notFoundPage": {
      "id": null,
      "path": null
    }
  },
  "settings": {
    "thumbnailsRootPath": "/sitecore/media library/Project/CLHIA/CLHIA",
    "generateThumbnails": "true"
  },
  "properties": {
    "IsSxaSite": "true",
    "rootPath": "/sitecore/content/CLHIA/CLHIA",
    "SxaSiteTemplate": "{E46F3AF2-39FA-4866-A157-7017C4B2A40C}",
    "siteTemplate": "",
    "sitemapConfigId": "69319d08-ac5d-4959-80d9-ab30b5cd714a",
    "tagsFolderId": null,
    "linkSettings": "ItselfOnly",
    "sharedSite": "false",
    "XA.Foundation.LocalDatasources.Enabled": "true"
  }
}
```

---

### CLHIA / qa

Same retrieval pattern as dev, with `sitecoreContextId: "3eJMlwA0G4uSyi4sMy8eSa"`.

#### Environment Resource

```json
{
  "resourceId": "xmcloud",
  "tenantId": "e4cbb238-639a-4a60-3901-08dd1a149b4e",
  "tenantName": null,
  "tenantDisplayName": "CLHIA / qa",
  "context": {
    "preview": "2ilrgepli8wuMyC2ukgeA6",
    "live": "3eJMlwA0G4uSyi4sMy8eSa"
  }
}
```

#### listSites Query Response

```json
{
  "data": {
    "data": [
      {
        "id": "ac5fdc0c-f33b-4524-b6f7-aa2e42cf857a",
        "name": "CLHIA",
        "description": "",
        "displayName": "CLHIA",
        "thumbnail": {
          "url": "https://xmc-canadianlif9e60-clhiae434-qae947.sitecorecloud.io/-/media/Project/CLHIA/CLHIA/Images/Landing-Pages/Family-Outdoors-Hero.png?db=master&w=320&rev=c65f4bde84f2431ca41f73a97443c582&hash=E0626A91E130C22189351E20FECF56CA",
          "rootPath": "/sitecore/media library/Project/CLHIA/CLHIA",
          "autogenerated": true
        },
        "collectionId": "8f98844f4d604613a97a1be08aa532ea",
        "created": "2024-11-13T01:42:35+00:00",
        "createdBy": "sitecore\\rbarbedo@getfishtank.ca",
        "sortOrder": 100,
        "brandKitId": null,
        "permissions": {
          "canAdmin": true,
          "canWrite": true,
          "canCreate": true,
          "canDelete": true,
          "canRename": true,
          "canRead": true,
          "canPublish": true,
          "canDuplicate": true,
          "canWriteLanguage": true
        },
        "languages": [
          "en",
          "en-CA",
          "fr-CA"
        ],
        "hosts": [
          {
            "id": "12e01532-c02b-4b7c-ac41-87acfa6266ea",
            "name": "CLHIA",
            "hostnames": [
              "*"
            ],
            "targetHostname": "clhia-qa.vercel.app",
            "homePageId": "fac87f27-6a93-4be4-a16f-272740a94984",
            "renderingHost": {
              "id": "dffee92b044145a4920767810b72bd46",
              "name": "Default",
              "appName": "nextjsstarter",
              "layoutServiceConfiguration": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io:443/api/editing/config",
              "serverSideRenderingEngineEndpointUrl": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io:443/api/editing/render",
              "serverSideRenderingEngineApplicationUrl": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io/"
            },
            "editingHost": {
              "id": "dffee92b044145a4920767810b72bd46",
              "name": "Default",
              "appName": "nextjsstarter",
              "layoutServiceConfiguration": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io:443/api/editing/config",
              "serverSideRenderingEngineEndpointUrl": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io:443/api/editing/render",
              "serverSideRenderingEngineApplicationUrl": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io/"
            },
            "permissions": {
              "canAdmin": true,
              "canWrite": true,
              "canCreate": true,
              "canDelete": true,
              "canRename": true,
              "canRead": true,
              "canPublish": true,
              "canDuplicate": true,
              "canWriteLanguage": true
            },
            "settings": {
              "rootID": "{AC5FDC0C-F33B-4524-B6F7-AA2E42CF857A}",
              "scheme": "https",
              "collectionID": "{8F98844F-4D60-4613-A97A-1BE08AA532EA}"
            },
            "properties": {
              "IsSxaSite": "true",
              "linkProvider": "",
              "isSiteThumbnailSource": "true",
              "rootPath": "/sitecore/content/CLHIA/CLHIA",
              "startItem": "/Home",
              "SxaSiteTemplate": "{E46F3AF2-39FA-4866-A157-7017C4B2A40C}",
              "siteDefinitionPath": "/sitecore/content/CLHIA/CLHIA/Settings/Site Grouping/CLHIA",
              "sxaLinkable": "false",
              "siteDefinitionID": "{12E01532-C02B-4B7C-AC41-87ACFA6266EA}",
              "isInternal": "false",
              "idp": "Auth0,Bearer,OrcaBearer"
            },
            "analyticsIdentifiers": {
              "en-CA": "clhia/en-ca",
              "fr-CA": "clhia/fr-ca"
            },
            "languageSettings": {
              "defaultLanguage": "en-CA",
              "languageEmbedding": true,
              "itemLanguageFallback": false,
              "fieldLanguageFallback": false
            },
            "created": "2024-11-13T01:42:36+00:00",
            "createdBy": "sitecore\\rbarbedo@getfishtank.ca"
          }
        ],
        "supportedLanguages": [
          "en",
          "en-CA",
          "fr-CA"
        ],
        "errorPages": {
          "errorPage": null,
          "notFoundPage": null
        },
        "errorPagesConfiguration": {
          "errorPage": {
            "id": null,
            "path": null
          },
          "notFoundPage": {
            "id": null,
            "path": null
          }
        },
        "settings": {
          "thumbnailsRootPath": "/sitecore/media library/Project/CLHIA/CLHIA",
          "generateThumbnails": "false"
        },
        "properties": {
          "IsSxaSite": "true",
          "rootPath": "/sitecore/content/CLHIA/CLHIA",
          "SxaSiteTemplate": "{E46F3AF2-39FA-4866-A157-7017C4B2A40C}",
          "siteTemplate": "",
          "sitemapConfigId": "69319d08-ac5d-4959-80d9-ab30b5cd714a",
          "tagsFolderId": null,
          "linkSettings": "ItselfOnly",
          "sharedSite": "false",
          "XA.Foundation.LocalDatasources.Enabled": "true"
        }
      }
    ],
    "request": {},
    "response": {}
  },
  "status": "success",
  "isLoading": false,
  "isError": false,
  "isSuccess": true,
  "error": null
}
```

#### Site 1: CLHIA

```json
{
  "id": "ac5fdc0c-f33b-4524-b6f7-aa2e42cf857a",
  "name": "CLHIA",
  "description": "",
  "displayName": "CLHIA",
  "thumbnail": {
    "url": "https://xmc-canadianlif9e60-clhiae434-qae947.sitecorecloud.io/-/media/Project/CLHIA/CLHIA/Images/Landing-Pages/Family-Outdoors-Hero.png?db=master&w=320&rev=c65f4bde84f2431ca41f73a97443c582&hash=E0626A91E130C22189351E20FECF56CA",
    "rootPath": "/sitecore/media library/Project/CLHIA/CLHIA",
    "autogenerated": true
  },
  "collectionId": "8f98844f4d604613a97a1be08aa532ea",
  "created": "2024-11-13T01:42:35+00:00",
  "createdBy": "sitecore\\rbarbedo@getfishtank.ca",
  "sortOrder": 100,
  "brandKitId": null,
  "permissions": {
    "canAdmin": true,
    "canWrite": true,
    "canCreate": true,
    "canDelete": true,
    "canRename": true,
    "canRead": true,
    "canPublish": true,
    "canDuplicate": true,
    "canWriteLanguage": true
  },
  "languages": [
    "en",
    "en-CA",
    "fr-CA"
  ],
  "hosts": [
    {
      "id": "12e01532-c02b-4b7c-ac41-87acfa6266ea",
      "name": "CLHIA",
      "hostnames": [
        "*"
      ],
      "targetHostname": "clhia-qa.vercel.app",
      "homePageId": "fac87f27-6a93-4be4-a16f-272740a94984",
      "renderingHost": {
        "id": "dffee92b044145a4920767810b72bd46",
        "name": "Default",
        "appName": "nextjsstarter",
        "layoutServiceConfiguration": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io:443/api/editing/config",
        "serverSideRenderingEngineEndpointUrl": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io:443/api/editing/render",
        "serverSideRenderingEngineApplicationUrl": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io/"
      },
      "editingHost": {
        "id": "dffee92b044145a4920767810b72bd46",
        "name": "Default",
        "appName": "nextjsstarter",
        "layoutServiceConfiguration": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io:443/api/editing/config",
        "serverSideRenderingEngineEndpointUrl": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io:443/api/editing/render",
        "serverSideRenderingEngineApplicationUrl": "https://xmc-eh-5yaa72zatixxsvgem61wee.sitecorecloud.io/"
      },
      "permissions": {
        "canAdmin": true,
        "canWrite": true,
        "canCreate": true,
        "canDelete": true,
        "canRename": true,
        "canRead": true,
        "canPublish": true,
        "canDuplicate": true,
        "canWriteLanguage": true
      },
      "settings": {
        "rootID": "{AC5FDC0C-F33B-4524-B6F7-AA2E42CF857A}",
        "scheme": "https",
        "collectionID": "{8F98844F-4D60-4613-A97A-1BE08AA532EA}"
      },
      "properties": {
        "IsSxaSite": "true",
        "linkProvider": "",
        "isSiteThumbnailSource": "true",
        "rootPath": "/sitecore/content/CLHIA/CLHIA",
        "startItem": "/Home",
        "SxaSiteTemplate": "{E46F3AF2-39FA-4866-A157-7017C4B2A40C}",
        "siteDefinitionPath": "/sitecore/content/CLHIA/CLHIA/Settings/Site Grouping/CLHIA",
        "sxaLinkable": "false",
        "siteDefinitionID": "{12E01532-C02B-4B7C-AC41-87ACFA6266EA}",
        "isInternal": "false",
        "idp": "Auth0,Bearer,OrcaBearer"
      },
      "analyticsIdentifiers": {
        "en-CA": "clhia/en-ca",
        "fr-CA": "clhia/fr-ca"
      },
      "languageSettings": {
        "defaultLanguage": "en-CA",
        "languageEmbedding": true,
        "itemLanguageFallback": false,
        "fieldLanguageFallback": false
      },
      "created": "2024-11-13T01:42:36+00:00",
      "createdBy": "sitecore\\rbarbedo@getfishtank.ca"
    }
  ],
  "supportedLanguages": [
    "en",
    "en-CA",
    "fr-CA"
  ],
  "errorPages": {
    "errorPage": null,
    "notFoundPage": null
  },
  "errorPagesConfiguration": {
    "errorPage": {
      "id": null,
      "path": null
    },
    "notFoundPage": {
      "id": null,
      "path": null
    }
  },
  "settings": {
    "thumbnailsRootPath": "/sitecore/media library/Project/CLHIA/CLHIA",
    "generateThumbnails": "false"
  },
  "properties": {
    "IsSxaSite": "true",
    "rootPath": "/sitecore/content/CLHIA/CLHIA",
    "SxaSiteTemplate": "{E46F3AF2-39FA-4866-A157-7017C4B2A40C}",
    "siteTemplate": "",
    "sitemapConfigId": "69319d08-ac5d-4959-80d9-ab30b5cd714a",
    "tagsFolderId": null,
    "linkSettings": "ItselfOnly",
    "sharedSite": "false",
    "XA.Foundation.LocalDatasources.Enabled": "true"
  }
}
```

---

## Quick reference

| Section | Retrieval method | SDK call? |
|---------|------------------|-----------|
| Client SDK | `useMarketplaceClient()` hook state | No |
| Query: `application.context` | `client.query("application.context")` | Yes |
| Query: `host.user` | `client.query("host.user")` | Yes |
| Query: `host.state` | `client.query("host.state")` | Yes (timed out here) |
| Query: `pages.context` | `client.query("pages.context")` | Yes (failed here) |
| Query: `site.context` | `client.query("site.context")` | Yes (failed here) |
| Query: `host.route` | `client.query("host.route")` | Yes |
| Application Context | `response.data` from `application.context` | Derived |
| Resource Access / Environments | `appContext.resourceAccess ?? appContext.resources` | Derived |
| Extension Points | `appContext.extensionPoints ?? appContext.touchpoints` | Derived |
| Environment Resource | Single `resourceAccess[]` entry | Derived |
| listSites Query Response | `client.query("xmc.xmapp.listSites", { params: { query: { sitecoreContextId } } })` | Yes |
| Site objects | `response.data.data[]` from listSites | Derived |

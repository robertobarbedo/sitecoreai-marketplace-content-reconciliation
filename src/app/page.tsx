"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { DEFAULT_LANGUAGE } from "@/src/constants";
import type {
  EnvironmentInfo,
  MarkerData,
  ReconciliationData,
} from "@/src/types/reconciliation";
import { useMarketplaceClient } from "@/src/utils/hooks/useMarketplaceClient";
import { environmentLabel, getEnvironments } from "@/src/utils/environments";
import { getLanguages } from "@/src/utils/sitecore-graphql";
import {
  createSecondaryMarker,
  detectBaseEnvironment,
  loadData,
  resolveBaseConflict,
  saveData,
  setupBaseEnvironment,
} from "@/src/utils/reconciliation-store";
import { emptyReconciliationData } from "@/src/types/reconciliation";
import { AppStateProvider, useAppState } from "@/src/context/AppStateContext";
import { SetupScreen } from "@/src/components/SetupScreen";
import { ConflictScreen } from "@/src/components/ConflictScreen";
import { ResetModal } from "@/src/components/ResetModal";
import { ContentTree, type TreeSelection } from "@/src/components/ContentTree";
import { FieldPanel } from "@/src/components/FieldPanel";
import { ApplyView } from "@/src/components/ApplyView";
import {
  Icon,
  mdiChevronDown,
  mdiChevronRight,
  mdiCog,
  mdiFileDocumentOutline,
} from "@/src/components/Icon";
import { readLanguageCookie, writeLanguageCookie } from "@/src/utils/preferences";
import { Banner, Button, Modal, Spinner, Toast } from "@/src/components/ui";

type AppPhase =
  | "initializing"
  | "setup"
  | "conflict"
  | "parse-error"
  | "ready"
  | "error";

interface SecondaryFailure {
  env: EnvironmentInfo;
  error: string;
}

export default function Page() {
  const { client, error: clientError, isInitialized } = useMarketplaceClient();

  const [phase, setPhase] = useState<AppPhase>("initializing");
  const [environments, setEnvironments] = useState<EnvironmentInfo[]>([]);
  const [baseEnv, setBaseEnv] = useState<EnvironmentInfo | null>(null);
  const [initialData, setInitialData] = useState<ReconciliationData | null>(null);
  const [languages, setLanguages] = useState<string[]>([DEFAULT_LANGUAGE]);
  const [rawBlob, setRawBlob] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [secondaryFailures, setSecondaryFailures] = useState<SecondaryFailure[]>([]);
  const [conflictCandidates, setConflictCandidates] = useState<
    { env: EnvironmentInfo; marker: MarkerData | null }[]
  >([]);
  const [straySecondaries, setStraySecondaries] = useState<EnvironmentInfo[]>([]);
  const [unreachable, setUnreachable] = useState<SecondaryFailure[]>([]);
  const [screenBusy, setScreenBusy] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  const loadLanguages = useCallback(
    async (sdk: ClientSDK, base: EnvironmentInfo): Promise<string[]> => {
      try {
        const names = await getLanguages(sdk, base.contextId);
        return names.length ? names : [DEFAULT_LANGUAGE];
      } catch {
        return [DEFAULT_LANGUAGE];
      }
    },
    [],
  );

  const runDetection = useCallback(async () => {
    if (!client) return;
    setPhase("initializing");
    setFatalError(null);
    setWarnings([]);
    try {
      const envs = await getEnvironments(client);
      setEnvironments(envs);
      if (envs.length === 0) {
        setFatalError(
          "No environments with a preview context are accessible to this app.",
        );
        setPhase("error");
        return;
      }

      const detection = await detectBaseEnvironment(client, envs);
      setUnreachable(detection.unreachable);
      const detectionWarnings = detection.unreachable.map(
        ({ env, error }) =>
          `Environment ${environmentLabel(env)} could not be checked: ${error}`,
      );

      if (detection.baseCandidates.length > 1) {
        setConflictCandidates(detection.baseCandidates);
        setPhase("conflict");
        return;
      }

      if (detection.baseCandidates.length === 1) {
        const base = detection.baseCandidates[0].env;
        setBaseEnv(base);
        const loadResult = await loadData(client, base, envs);
        if (!loadResult.ok) {
          setRawBlob(loadResult.raw);
          setPhase("parse-error");
          return;
        }
        setLanguages(await loadLanguages(client, base));
        setInitialData(loadResult.data);
        setWarnings(detectionWarnings);
        setPhase("ready");
        return;
      }

      // No base marker anywhere.
      setStraySecondaries(detection.secondaries);
      setWarnings(detectionWarnings);
      setPhase("setup");
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : String(error));
      setPhase("error");
    }
  }, [client, loadLanguages]);

  // Rerun detection once the SDK is up (and only once per client instance).
  const detectionRanFor = useRef<ClientSDK | null>(null);
  useEffect(() => {
    if (isInitialized && client && detectionRanFor.current !== client) {
      detectionRanFor.current = client;
      runDetection();
    }
  }, [isInitialized, client, runDetection]);

  const handleSetup = async (chosenBase: EnvironmentInfo) => {
    if (!client) return;
    setScreenBusy(true);
    setScreenError(null);
    try {
      const result = await setupBaseEnvironment(client, chosenBase, environments);
      setSecondaryFailures(result.secondaryFailures);
      setBaseEnv(chosenBase);
      setLanguages(await loadLanguages(client, chosenBase));
      setInitialData(result.initialData);
      setPhase("ready");
    } catch (error) {
      setScreenError(error instanceof Error ? error.message : String(error));
    } finally {
      setScreenBusy(false);
    }
  };

  const handleResolveConflict = async (chosen: EnvironmentInfo) => {
    if (!client) return;
    setScreenBusy(true);
    setScreenError(null);
    try {
      const others = conflictCandidates
        .map((c) => c.env)
        .filter((e) => e.tenantId !== chosen.tenantId);
      const { failures } = await resolveBaseConflict(client, chosen, others);
      if (failures.length) {
        setScreenError(
          failures
            .map((f) => `${environmentLabel(f.env)}: ${f.error}`)
            .join("; "),
        );
        return;
      }
      await runDetection();
    } catch (error) {
      setScreenError(error instanceof Error ? error.message : String(error));
    } finally {
      setScreenBusy(false);
    }
  };

  const handleDiscardCorruptData = async () => {
    if (!client || !baseEnv) return;
    setScreenBusy(true);
    setScreenError(null);
    try {
      const empty = emptyReconciliationData(
        { ...baseEnv },
        environments.map((e) => ({
          tenantId: e.tenantId,
          tenantName: e.tenantName,
          tenantDisplayName: e.tenantDisplayName,
        })),
      );
      await saveData(client, baseEnv, empty, "", environments, true);
      setRawBlob(null);
      await runDetection();
    } catch (error) {
      setScreenError(error instanceof Error ? error.message : String(error));
    } finally {
      setScreenBusy(false);
    }
  };

  const handleRetrySecondary = async (failure: SecondaryFailure) => {
    if (!client) return;
    try {
      await createSecondaryMarker(client, failure.env);
      setSecondaryFailures((prev) =>
        prev.filter((f) => f.env.tenantId !== failure.env.tenantId),
      );
    } catch (error) {
      setSecondaryFailures((prev) =>
        prev.map((f) =>
          f.env.tenantId === failure.env.tenantId
            ? { ...f, error: error instanceof Error ? error.message : String(error) }
            : f,
        ),
      );
    }
  };

  if (clientError) {
    return (
      <CenteredMessage>
        <Banner tone="danger">
          Failed to initialize the Marketplace SDK: {clientError.message}. This
          app only works embedded inside SitecoreAI.
        </Banner>
      </CenteredMessage>
    );
  }

  if (!isInitialized || phase === "initializing") {
    return (
      <CenteredMessage>
        <Spinner label="Connecting to SitecoreAI and detecting the base environment…" />
      </CenteredMessage>
    );
  }

  if (phase === "error") {
    return (
      <CenteredMessage>
        <Banner tone="danger">{fatalError}</Banner>
        <Button variant="primary" onClick={runDetection}>
          Retry
        </Button>
      </CenteredMessage>
    );
  }

  if (phase === "setup") {
    return (
      <SetupScreen
        environments={environments}
        straySecondaries={straySecondaries}
        unreachable={unreachable}
        busy={screenBusy}
        error={screenError}
        onSetup={handleSetup}
      />
    );
  }

  if (phase === "conflict") {
    return (
      <ConflictScreen
        candidates={conflictCandidates}
        busy={screenBusy}
        error={screenError}
        onResolve={handleResolveConflict}
      />
    );
  }

  if (phase === "parse-error") {
    return (
      <div
        className="card"
        style={{
          maxWidth: 720,
          margin: "var(--spacing-10) auto",
          padding: "var(--spacing-8)",
        }}
      >
        <h3 style={{ marginBottom: "var(--spacing-3)" }}>Stored data is corrupt</h3>
        <Banner tone="danger">
          The reconciliation data stored in{" "}
          {baseEnv ? environmentLabel(baseEnv) : "the base environment"} could
          not be parsed as JSON. Copy the raw content below somewhere safe
          before discarding it — discarding is permanent.
        </Banner>
        <textarea
          readOnly
          value={rawBlob ?? ""}
          style={{
            width: "100%",
            height: 240,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-xs)",
            padding: "var(--spacing-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            margin: "var(--spacing-3) 0",
          }}
        />
        {screenError && <Banner tone="danger">{screenError}</Banner>}
        <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center" }}>
          <Button variant="danger" disabled={screenBusy} onClick={handleDiscardCorruptData}>
            Discard and reinitialize empty data
          </Button>
          <Button disabled={screenBusy} onClick={runDetection}>
            Reload
          </Button>
          {screenBusy && <Spinner />}
        </div>
      </div>
    );
  }

  // phase === "ready"
  if (!client || !baseEnv || !initialData) {
    return (
      <CenteredMessage>
        <Banner tone="danger">Unexpected state — reload the app.</Banner>
      </CenteredMessage>
    );
  }

  return (
    <AppStateProvider
      client={client}
      environments={environments}
      baseEnv={baseEnv}
      languages={languages}
      initialData={initialData}
    >
      <MainShell
        warnings={warnings}
        secondaryFailures={secondaryFailures}
        onRetrySecondary={handleRetrySecondary}
        onReset={() => {
          setBaseEnv(null);
          setInitialData(null);
          setSecondaryFailures([]);
          runDetection();
        }}
      />
    </AppStateProvider>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "var(--spacing-4)",
        padding: "var(--spacing-8)",
      }}
    >
      {children}
    </div>
  );
}

function LogoMark() {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/icon.svg"
      alt="Content Reconciliation"
      width={40}
      height={40}
      style={{ flexShrink: 0 }}
    />
  );
}

function MainShell({
  warnings,
  secondaryFailures,
  onRetrySecondary,
  onReset,
}: {
  warnings: string[];
  secondaryFailures: SecondaryFailure[];
  onRetrySecondary: (failure: SecondaryFailure) => void;
  onReset: () => void;
}) {
  const {
    client,
    environments,
    baseEnv,
    languages,
    data,
    saveConflict,
    saveError,
    savedToast,
    save,
    reload,
  } = useAppState();

  const [view, setView] = useState<"tracking" | "apply">("tracking");
  const [language, setLanguageState] = useState(() => {
    const cookieLang = readLanguageCookie();
    if (cookieLang && languages.includes(cookieLang)) return cookieLang;
    return languages.includes(DEFAULT_LANGUAGE) ? DEFAULT_LANGUAGE : languages[0];
  });
  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    writeLanguageCookie(lang);
  };
  const [selection, setSelection] = useState<TreeSelection | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTrackedList, setShowTrackedList] = useState(false);

  const trackedIds = new Set(data.items.map((i) => i.itemId));

  const treeColumn = (
    <div
      className="card"
      style={{
        width: 320,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, padding: "var(--spacing-2) 0" }}>
        <ContentTree
          client={client}
          contextId={baseEnv.contextId}
          language={language}
          trackedIds={trackedIds}
          selectedId={selection?.itemId ?? null}
          onSelect={setSelection}
        />
      </div>

      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          maxHeight: showTrackedList ? "45%" : undefined,
          minHeight: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setShowTrackedList((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-1)",
            border: "none",
            background: "none",
            cursor: "pointer",
            padding: "var(--spacing-3) var(--spacing-4)",
            font: "inherit",
            fontSize: "var(--font-size-sm)",
            fontWeight: 600,
            color: "var(--color-foreground)",
            flexShrink: 0,
          }}
        >
          <Icon
            path={showTrackedList ? mdiChevronDown : mdiChevronRight}
            size={0.7}
            style={{ color: "var(--color-muted-foreground)" }}
          />
          Tracked items
          <span
            style={{
              marginLeft: "auto",
              fontSize: "var(--font-size-2xs)",
              fontWeight: 600,
              background: "var(--color-primary-soft)",
              color: "var(--color-primary-soft-foreground)",
              borderRadius: "var(--radius-full)",
              padding: "0 var(--spacing-1-5)",
            }}
          >
            {data.items.length}
          </span>
        </button>

        {showTrackedList && (
          <div style={{ overflowY: "auto", padding: "0 var(--spacing-2) var(--spacing-2)" }}>
            {data.items.length === 0 ? (
              <p
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-muted-foreground)",
                  padding: "var(--spacing-1) var(--spacing-2) var(--spacing-2)",
                }}
              >
                No items tracked yet. Select an item in the tree above to start
                tracking it.
              </p>
            ) : (
              data.items.map((trackedItem) => {
                const isSelected = selection?.itemId === trackedItem.itemId;
                return (
                  <button
                    key={trackedItem.itemId}
                    type="button"
                    title={trackedItem.path}
                    onClick={() =>
                      setSelection({
                        itemId: trackedItem.itemId,
                        name: trackedItem.name,
                        path: trackedItem.path,
                      })
                    }
                    className={`tree-row${isSelected ? " tree-row-selected" : ""}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--spacing-1-5)",
                      width: "100%",
                      border: isSelected
                        ? "1px solid var(--color-primary)"
                        : "1px solid transparent",
                      background: isSelected ? "var(--color-background)" : "none",
                      borderRadius: "var(--radius-lg)",
                      cursor: "pointer",
                      textAlign: "left",
                      font: "inherit",
                      padding: "var(--spacing-1-5) var(--spacing-2)",
                      color: "var(--color-foreground)",
                    }}
                  >
                    <Icon
                      path={mdiFileDocumentOutline}
                      size={0.7}
                      style={{ opacity: 0.75, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontSize: "var(--font-size-sm)",
                        fontWeight: isSelected ? 600 : 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {trackedItem.name}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "var(--font-size-2xs)",
                        color: "var(--color-muted-foreground)",
                        flexShrink: 0,
                      }}
                    >
                      {trackedItem.fields.length}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxWidth: 1280,
        margin: "0 auto",
        background: "var(--color-page)",
        padding: "var(--spacing-6)",
        gap: "var(--spacing-5)",
      }}
    >
      {(warnings.length > 0 || secondaryFailures.length > 0 || saveError) && (
        <div>
          {warnings.map((w) => (
            <Banner key={w} tone="warning">
              {w}
            </Banner>
          ))}
          {secondaryFailures.map((f) => (
            <Banner key={f.env.tenantId} tone="warning">
              Could not mark {environmentLabel(f.env)} as a secondary
              environment: {f.error}{" "}
              <Button
                style={{ fontSize: "var(--font-size-2xs)", padding: "var(--spacing-0-5) var(--spacing-2)" }}
                onClick={() => onRetrySecondary(f)}
              >
                Retry
              </Button>
            </Banner>
          ))}
          {saveError && <Banner tone="danger">Save failed: {saveError}</Banner>}
        </div>
      )}

      {/* Row 1 — title + settings */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)" }}>
        <LogoMark />
        <div>
          <h3 style={{ marginBottom: "var(--spacing-0-5)" }}>
            Content Reconciliation
          </h3>
          <p
            style={{
              fontSize: "var(--font-size-2xs)", /* console page subtitle: 11px */
              color: "var(--color-muted-foreground)",
            }}
          >
            Capture the correct value of environment-specific fields and restore
            them after a content transfer overwrites them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          title="Settings"
          aria-label="Settings"
          className="icon-button"
          style={{ marginLeft: "auto", flexShrink: 0 }}
        >
          <Icon path={mdiCog} size={0.9} />
        </button>
      </div>

      {/* Row 2 — tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--spacing-4)",
        }}
      >
        <div className="view-tabs">
          <button
            type="button"
            className={`view-tab${view === "tracking" ? " active" : ""}`}
            onClick={() => setView("tracking")}
          >
            Configure reconciliation
          </button>
          <button
            type="button"
            className={`view-tab${view === "apply" ? " active" : ""}`}
            onClick={() => setView("apply")}
          >
            Preview and apply changes
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {view === "tracking" ? (
          <div style={{ display: "flex", gap: "var(--spacing-5)", height: "100%" }}>
            {treeColumn}
            <div
              className="card"
              style={{
                flex: 1,
                minWidth: 0,
                overflowY: "auto",
                /* No top padding: the sticky FieldPanel header must sit flush
                   with the card's top edge and carries the spacing itself. */
                padding: "0 var(--spacing-8) var(--spacing-6)",
              }}
            >
              <FieldPanel selection={selection} language={language} />
            </div>
          </div>
        ) : (
          <div
            className="card"
            style={{
              height: "100%",
              overflowY: "auto",
              padding: "var(--spacing-6) var(--spacing-8)",
            }}
          >
            <ApplyView />
          </div>
        )}
      </div>

      {saveConflict && (
        <Modal title="Data changed on the server">
          <p style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-4)" }}>
            The stored reconciliation data was modified since you loaded it
            (at {new Date(saveConflict).toLocaleString()}) — possibly by
            another session. Overwrite it with your version, or discard your
            local changes and reload the server version?
          </p>
          <div style={{ display: "flex", gap: "var(--spacing-2)", justifyContent: "flex-end" }}>
            <Button onClick={reload}>Discard mine and reload</Button>
            <Button variant="danger" onClick={() => save(true)}>
              Overwrite
            </Button>
          </div>
        </Modal>
      )}

      {showSettings && (
        <Modal title="Settings" onClose={() => setShowSettings(false)}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-4)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--spacing-4)",
                paddingBottom: "var(--spacing-3)",
                borderBottom: "1px solid var(--color-border)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <span>Base environment:</span>
              <strong
                style={{
                  color: "var(--color-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {environmentLabel(baseEnv)}
              </strong>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--spacing-4)",
                paddingBottom: "var(--spacing-3)",
                borderBottom: "1px solid var(--color-border)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <span>Context Language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  padding: "var(--spacing-1) var(--spacing-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--font-size-sm)",
                  background: "var(--color-background)",
                }}
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--spacing-4)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <span style={{ color: "var(--color-muted-foreground)" }}>
                Delete all reconciliation data and start over
              </span>
              <Button
                variant="danger"
                onClick={() => {
                  setShowSettings(false);
                  setShowReset(true);
                }}
              >
                Reset
              </Button>
            </div>

            <div
              style={{
                textAlign: "center",
                fontSize: "var(--font-size-xs)",
                color: "var(--color-muted-foreground)",
                paddingTop: "var(--spacing-3)",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              Developed by Roberto Barbedo
            </div>
          </div>
        </Modal>
      )}

      {showReset && (
        <ResetModal
          client={client}
          environments={environments}
          onCancel={() => setShowReset(false)}
          onComplete={() => {
            setShowReset(false);
            onReset();
          }}
        />
      )}

      {savedToast && <Toast>Changes saved</Toast>}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackendEndpoints,
  getDefaultEndpoints,
  RangeXBackendClient,
} from './services/backendClient';
import { useAvlStore } from './store/useAvlStore';
import { TopCommandBar } from './components/layout/TopCommandBar';
import { TreeStageViewport } from './components/visualizer/TreeStageViewport';
import { LiveEventPanel } from './components/events/LiveEventPanel';
import { PlaybackControls } from './components/playback/PlaybackControls';
import { IntervalExplorer } from './components/explorer/IntervalExplorer';
import { WarehouseAnalytics } from './components/analytics/WarehouseAnalytics';
import { AvlLearningMode } from './components/learn/AvlLearningMode';

export function App() {
  const activeSection = useAvlStore((s) => s.activeSection);
  const [endpoints, setEndpoints] = useState<BackendEndpoints>(getDefaultEndpoints);
  const clientRef = useRef<RangeXBackendClient | null>(null);

  useEffect(() => {
    const store = useAvlStore.getState();
    const client = new RangeXBackendClient(endpoints, {
      onStatusChange: (status, detail) => store.setConnectionStatus(status, detail),
      onEvent: (event) => store.ingestBackendEvent(event),
      onSnapshotSync: (snapshot, intervals, analytics) =>
        store.syncInitialSnapshot(snapshot, intervals, analytics),
      onInvalidPayload: (reason, preview) => store.recordInvalidEvent(reason, preview),
    });

    clientRef.current = client;
    void client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [endpoints]);

  const handleReconnect = useCallback(() => {
    void clientRef.current?.connect();
  }, []);

  const handleDisconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const handleSubmitPackage = useCallback(async (packageId: number) => {
    const store = useAvlStore.getState();
    store.setAwaitingBackendResponse(true, null);
    const result = await clientRef.current?.submitPackageArrival(packageId);
    if (!result || !result.accepted) {
      store.setAwaitingBackendResponse(
        false,
        result?.error ?? 'Failed to dispatch package to backend.',
      );
    } else {
      store.setAwaitingBackendResponse(false, null);
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col gap-3 bg-obsidian p-3 text-slate-100 sm:p-4">
      <TopCommandBar
        endpoints={endpoints}
        onUpdateEndpoints={setEndpoints}
        onReconnect={handleReconnect}
        onDisconnect={handleDisconnect}
        onSubmitPackage={handleSubmitPackage}
      />

      <main className="flex flex-1 flex-col gap-3">
        {activeSection === 'visualizer' && (
          <>
            <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
              <section className="lg:col-span-8 xl:col-span-9">
                <TreeStageViewport />
              </section>
              <aside className="min-h-[420px] lg:col-span-4 xl:col-span-3">
                <LiveEventPanel />
              </aside>
            </div>
            <PlaybackControls />
          </>
        )}

        {activeSection === 'explorer' && (
          <>
            <IntervalExplorer />
            <PlaybackControls />
          </>
        )}

        {activeSection === 'analytics' && <WarehouseAnalytics />}

        {activeSection === 'learn' && <AvlLearningMode />}
      </main>
    </div>
  );
}

export default App;

import React, { useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Database,
  FileJson,
  Layers,
  PackagePlus,
  PlugZap,
  RefreshCw,
  Settings2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AppSection, useAvlStore } from '../../store/useAvlStore';
import { RECORDED_BACKEND_TRACES } from '../../fixtures/backendTraces';
import { BackendEndpoints } from '../../services/backendClient';

interface TopCommandBarProps {
  endpoints: BackendEndpoints;
  onUpdateEndpoints: (next: BackendEndpoints) => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onSubmitPackage: (packageId: number) => Promise<void>;
}

const NAV_ITEMS: Array<{ id: AppSection; label: string; icon: React.ReactNode }> = [
  { id: 'visualizer', label: 'AVL Visualizer', icon: <Activity className="h-3.5 w-3.5" /> },
  { id: 'explorer', label: 'Interval Explorer', icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'analytics', label: 'Warehouse Analytics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: 'learn', label: 'DSA Learning Mode', icon: <BookOpen className="h-3.5 w-3.5" /> },
];

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  endpoints,
  onUpdateEndpoints,
  onReconnect,
  onDisconnect,
  onSubmitPackage,
}) => {
  const connectionStatus = useAvlStore((s) => s.connectionStatus);
  const connectionDetail = useAvlStore((s) => s.connectionDetail);
  const activeSourceLabel = useAvlStore((s) => s.activeSourceLabel);
  const activeSection = useAvlStore((s) => s.activeSection);
  const isAwaitingBackendResponse = useAvlStore((s) => s.isAwaitingBackendResponse);
  const lastSubmissionError = useAvlStore((s) => s.lastSubmissionError);

  const setActiveSection = useAvlStore((s) => s.setActiveSection);
  const loadRecordedTrace = useAvlStore((s) => s.loadRecordedTrace);
  const recordInvalidEvent = useAvlStore((s) => s.recordInvalidEvent);

  const [packageInput, setPackageInput] = useState('');
  const [showConnModal, setShowConnModal] = useState(false);
  const [draftApiUrl, setDraftApiUrl] = useState(endpoints.apiUrl);
  const [draftWsUrl, setDraftWsUrl] = useState(endpoints.wsUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(packageInput.trim());
    if (!packageInput.trim() || !Number.isInteger(parsed)) {
      useAvlStore
        .getState()
        .setAwaitingBackendResponse(false, 'Please enter a valid integer Package ID.');
      return;
    }
    await onSubmitPackage(parsed);
    setPackageInput('');
  };

  const handleUploadTraceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json: unknown = JSON.parse(text);
      const events = Array.isArray(json)
        ? json
        : typeof json === 'object' && json !== null && Array.isArray((json as { events?: unknown[] }).events)
          ? (json as { events: unknown[] }).events
          : null;

      if (!events) {
        recordInvalidEvent('Uploaded JSON file must be an array or { events: [...] }', text.slice(0, 140));
        return;
      }
      loadRecordedTrace(events, file.name, false);
    } catch {
      recordInvalidEvent('Uploaded trace file contains invalid JSON', file.name);
    } finally {
      e.target.value = '';
    }
  };

  const statusBadge = (() => {
    switch (connectionStatus) {
      case 'connected':
        return {
          cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
          icon: <Wifi className="h-3.5 w-3.5" />,
          label: 'Backend Live',
        };
      case 'connecting':
      case 'reconnecting':
        return {
          cls: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
          icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
          label: connectionStatus === 'connecting' ? 'Connecting' : 'Reconnecting',
        };
      default:
        return {
          cls: 'border-slate-700 bg-charcoal-900 text-slate-400',
          icon: <WifiOff className="h-3.5 w-3.5" />,
          label: 'Backend Offline',
        };
    }
  })();

  return (
    <header className="rangex-panel rounded-2xl px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyanpulse-400/40 bg-gradient-to-br from-electric-600/30 to-charcoal-950 shadow-glow">
            <span className="font-mono text-sm font-black tracking-tight text-cyanpulse-300">
              RX
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-wide text-white sm:text-base">
                RANGEX
              </h1>
              <span className="rounded border border-electric-500/30 bg-electric-600/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-electric-400">
                AVL INDEX MODULE
              </span>
            </div>
            <p className="font-mono text-[11px] text-slate-400">
              Intelligent Warehouse Arrival Index · {activeSourceLabel}
            </p>
          </div>
        </div>

        {/* Package Arrival Dispatch Form */}
        <form onSubmit={handleDispatch} className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="number"
              step={1}
              value={packageInput}
              onChange={(e) => setPackageInput(e.target.value)}
              placeholder="Enter Package ID (e.g. 25)"
              aria-label="Package ID"
              className="w-48 rounded-xl border border-slate-700/90 bg-charcoal-950 px-3 py-2 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-cyanpulse-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isAwaitingBackendResponse}
            className="flex items-center gap-1.5 rounded-xl bg-electric-600 px-3.5 py-2 text-xs font-semibold text-white shadow-glow transition hover:bg-electric-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            {isAwaitingBackendResponse ? 'Sending...' : 'Insert Package'}
          </button>
        </form>

        {/* Backend Connection + Recorded Trace Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center gap-1.5">
            <select
              aria-label="Load recorded backend trace"
              defaultValue=""
              onChange={(e) => {
                const trace = RECORDED_BACKEND_TRACES.find((t) => t.id === e.target.value);
                if (trace) {
                  loadRecordedTrace(trace.events, trace.name, false);
                }
                e.target.value = '';
              }}
              className="rounded-xl border border-slate-700/80 bg-charcoal-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyanpulse-400 focus:outline-none"
            >
              <option value="" disabled>
                Load Recorded Backend Trace...
              </option>
              {RECORDED_BACKEND_TRACES.map((trace) => (
                <option key={trace.id} value={trace.id}>
                  {trace.name}
                </option>
              ))}
            </select>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleUploadTraceFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded-xl border border-slate-700/80 bg-charcoal-900 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyanpulse-400 hover:text-white"
              title="Import recorded JSON event log from Member 2 backend"
            >
              <FileJson className="h-3.5 w-3.5 text-cyanpulse-400" />
              Import Log
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowConnModal((v) => !v)}
            title={connectionDetail}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${statusBadge.cls}`}
          >
            {statusBadge.icon}
            <span>{statusBadge.label}</span>
            <Settings2 className="ml-0.5 h-3 w-3 opacity-75" />
          </button>
        </div>
      </div>

      {/* Submission Error / Backend Offline Notice */}
      {lastSubmissionError && (
        <div className="mt-2.5 flex items-center justify-between rounded-xl border border-red-500/35 bg-red-950/35 px-3 py-1.5 font-mono text-xs text-red-300">
          <span>{lastSubmissionError}</span>
          <button
            type="button"
            onClick={() => useAvlStore.getState().setAwaitingBackendResponse(false, null)}
            className="text-[11px] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
        <nav className="flex flex-wrap gap-1.5" aria-label="Module Navigation">
          {NAV_ITEMS.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-electric-600/25 text-cyanpulse-300 ring-1 ring-electric-500/50 shadow-glow'
                    : 'text-slate-400 hover:bg-charcoal-900 hover:text-slate-200'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <Database className="h-3.5 w-3.5 text-electric-400" />
          <span>Source of truth: C++ AVL Backend Events</span>
        </div>
      </div>

      {/* Backend Connection Settings Popover */}
      {showConnModal && (
        <div className="mt-3 rounded-xl border border-slate-700/80 bg-charcoal-950 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <PlugZap className="h-4 w-4 text-cyanpulse-400" />
              Member 2 Backend Gateway Endpoints
            </div>
            <span className="font-mono text-[11px] text-slate-400">{connectionDetail}</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-[11px] text-slate-400">
              REST API Base URL
              <input
                type="text"
                value={draftApiUrl}
                onChange={(e) => setDraftApiUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-charcoal-900 px-2.5 py-1.5 font-mono text-xs text-slate-100"
              />
            </label>
            <label className="block text-[11px] text-slate-400">
              WebSocket Event Stream URL
              <input
                type="text"
                value={draftWsUrl}
                onChange={(e) => setDraftWsUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-charcoal-900 px-2.5 py-1.5 font-mono text-xs text-slate-100"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Disconnect
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdateEndpoints({ apiUrl: draftApiUrl.trim(), wsUrl: draftWsUrl.trim() });
                onReconnect();
                setShowConnModal(false);
              }}
              className="rounded-lg bg-electric-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-electric-500"
            >
              Save &amp; Connect
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

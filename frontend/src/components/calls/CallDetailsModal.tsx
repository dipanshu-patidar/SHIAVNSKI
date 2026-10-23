import React, { useState, useEffect } from 'react';
import {
  X,
  PhoneCall,
  Clock,
  Radio,
  Copy,
  Check,
  Bot,
  Calendar,
  Sparkles,
  CheckCircle2,
  Play,
  PhoneOff,
} from 'lucide-react';
import { Call, callApi } from '../../api/call.api';
import { useToast } from '../../context/ToastContext';

export interface CallDetailsModalProps {
  isOpen: boolean;
  call: Call | null;
  onClose: () => void;
  onCallUpdated?: (updated: Call) => void;
}

export const CallDetailsModal: React.FC<CallDetailsModalProps> = ({
  isOpen,
  call,
  onClose,
  onCallUpdated,
}) => {
  const [activeCall, setActiveCall] = useState<Call | null>(call);
  const [copiedId, setCopiedId] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    setActiveCall(call);
  }, [call]);

  if (!isOpen || !activeCall) return null;

  const handleCopyProviderId = () => {
    navigator.clipboard.writeText(activeCall.providerCallId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isMock = activeCall.isMock ?? activeCall.providerCallId.startsWith('call_mock_');

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSimulateStep = async () => {
    if (!isMock || simulating) return;
    setSimulating(true);

    try {
      const updated = await callApi.simulateCallStep(activeCall.id);
      setActiveCall(updated);
      onCallUpdated?.(updated);
      success(
        `Mock call state transitioned to ${updated.status} [SIMULATED]`,
        'Mock Lifecycle [SIMULATED]'
      );
    } catch (err: any) {
      error(
        err?.response?.data?.message || err?.message || 'Failed to advance mock call step'
      );
    } finally {
      setSimulating(false);
    }
  };

  // Determine accurate disconnection & connection message
  const getDisconnectionStatus = () => {
    if (activeCall.disconnectionReason) {
      return activeCall.disconnectionReason;
    }
    switch (activeCall.status) {
      case 'INITIATED':
        return isMock ? 'Awaiting Simulated Pickup' : 'Awaiting Connection';
      case 'ONGOING':
        return 'In Progress / Active';
      case 'ENDED':
        return 'Normal Completion';
      case 'FAILED':
        return 'Connection Failed';
      default:
        return 'Not Disconnected';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-details-title"
    >
      <div className="w-full max-w-2xl bg-[#0c121e] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-fade-in relative flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="call-details-title" className="text-lg font-bold text-white tracking-tight">
                  Call Record Details
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    activeCall.status === 'ENDED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : activeCall.status === 'ONGOING'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse'
                      : activeCall.status === 'FAILED'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {activeCall.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{activeCall.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          {/* Provider Transparency Callout */}
          <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 text-amber-300">
              <Radio className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">
                  {isMock ? 'Provider Mode: MOCK / SIMULATED' : 'Provider Mode: Retell Live'}
                </p>
                <p className="text-amber-300/80 mt-0.5">
                  {isMock
                    ? 'Deterministic local simulation. Zero Retell cloud telephony credits were consumed.'
                    : 'Real telephony carrier dispatch through Retell AI.'}
                </p>
              </div>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold self-start sm:self-center">
              MOCK/SIMULATED
            </span>
          </div>

          {/* Mock Lifecycle Simulation Control */}
          {isMock && (activeCall.status === 'INITIATED' || activeCall.status === 'ONGOING') && (
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-blue-200">Simulate Mock Call Lifecycle</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {activeCall.status === 'INITIATED'
                    ? 'Advance mock call to connected / answering state.'
                    : 'Advance mock call to completed / hung-up state.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSimulateStep}
                disabled={simulating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30 disabled:opacity-50 shrink-0"
              >
                {activeCall.status === 'INITIATED' ? (
                  <>
                    <Play className="w-3.5 h-3.5" /> Simulate Pickup
                  </>
                ) : (
                  <>
                    <PhoneOff className="w-3.5 h-3.5" /> Simulate Hangup
                  </>
                )}
              </button>
            </div>
          )}

          {/* Telephony Identifiers Grid (Masked Destination & Caller ID) */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Destination Number (Masked)
              </span>
              <p className="text-sm font-bold text-white font-mono mt-1 select-all">
                {activeCall.maskedToNumber || activeCall.toNumber}
              </p>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Caller ID (Masked)
              </span>
              <p className="text-sm font-bold text-slate-300 font-mono mt-1">
                {activeCall.maskedFromNumber || activeCall.fromNumber}
              </p>
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-slate-800/60">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Provider Call ID
              </span>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs text-blue-300 font-mono bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                  {activeCall.providerCallId}
                </code>
                <button
                  onClick={handleCopyProviderId}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Copy provider call ID"
                >
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Associated Voice Agent Info */}
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
            <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
              Assigned Voice Agent
            </span>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {activeCall.agent?.name || 'Agent Persona'}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  {activeCall.agent?.language || 'en-US'} • {activeCall.agent?.voiceId || 'Default Voice'}
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Variables Passed to Call (Safely Rendered Text) */}
          {activeCall.dynamicVariables && Object.keys(activeCall.dynamicVariables).length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Dynamic Runtime Variables
              </span>
              <div className="rounded-xl border border-slate-800/80 overflow-hidden bg-slate-900/60">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2">Variable Key</th>
                      <th className="px-4 py-2">Injected Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {Object.entries(activeCall.dynamicVariables).map(([key, val]) => (
                      <tr key={key} className="hover:bg-slate-800/40">
                        <td className="px-4 py-2 text-blue-300 font-semibold">{key}</td>
                        <td className="px-4 py-2 text-slate-300 break-words">{String(val)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Timings Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Duration
              </span>
              <p className="font-mono text-white font-semibold">
                {formatDuration(activeCall.durationSeconds)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Initiated
              </span>
              <p className="font-mono text-white font-medium text-[11px]">
                {new Date(activeCall.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 col-span-2 sm:col-span-1">
              <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Disconnection
              </span>
              <p className="text-slate-300 font-medium truncate">
                {getDisconnectionStatus()}
              </p>
            </div>
          </div>

          {/* Webhook & Telemetry Synchronization Info */}
          <div className="p-3.5 rounded-xl bg-slate-900/30 border border-slate-800/60 flex items-start gap-2.5 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Live call status updates and available post-call telemetry are synchronized through the configured Retell webhook. Recordings, transcripts, and analysis appear only when supplied by the provider. Mock calls do not contain real audio or transcripts.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallDetailsModal;

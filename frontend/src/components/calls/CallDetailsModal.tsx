import React, { useState, useEffect } from 'react';
import {
  X,
  PhoneCall,
  Clock,
  Radio,
  Copy,
  Check,
  Bot,
  User,
  Calendar,
  Sparkles,
  CheckCircle2,
  Play,
  PhoneOff,
  Trash2,
  RefreshCw,
  Volume2,
  VolumeX,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { Call, callApi, TranscriptTurn } from '../../api/call.api';
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
  const [syncing, setSyncing] = useState(false);

  // Deletion Confirmation Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingRecording, setDeletingRecording] = useState(false);

  const { success, error, info } = useToast();

  useEffect(() => {
    setActiveCall(call);
    setShowDeleteConfirm(false);
  }, [call]);

  if (!isOpen || !activeCall) return null;

  const handleCopyProviderId = () => {
    navigator.clipboard.writeText(activeCall.providerCallId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isMock = activeCall.isMock ?? activeCall.providerCallId.startsWith('call_mock_');
  const isWebCall = activeCall.callType === 'web_call';

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Sync latest call telemetry, transcript, and recording from Retell backend
   */
  const handleSyncCall = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const updated = await callApi.syncCall(activeCall.id);
      setActiveCall(updated);
      onCallUpdated?.(updated);
      success('Call data synchronized with Retell provider.', 'Synced');
    } catch (err: any) {
      error(
        err?.response?.data?.message || err?.message || 'Failed to sync call with provider',
        'Sync Error'
      );
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Advance mock call lifecycle
   */
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

  /**
   * Delete or remove recording from application
   * Preserves call record, transcript, and metadata!
   */
  const handleConfirmDeleteRecording = async () => {
    if (deletingRecording) return;
    setDeletingRecording(true);

    try {
      const res = await callApi.deleteRecording(activeCall.id);
      const updated = res.call;
      setActiveCall(updated);
      onCallUpdated?.(updated);
      setShowDeleteConfirm(false);

      success(
        'Recording reference removed from application. Call history and transcript preserved.',
        'Recording Removed'
      );

      if (!res.providerDeleted) {
        info(
          'Note: Retell AI does not support isolated provider-side recording deletion without destroying the entire remote call record. The audio reference was safely removed from this app.',
          'Provider Storage Notice'
        );
      }
    } catch (err: any) {
      error(
        err?.response?.data?.message || err?.message || 'Failed to remove call recording',
        'Deletion Failed'
      );
    } finally {
      setDeletingRecording(false);
    }
  };

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

  // Determine transcript turns to render
  const transcriptTurns: TranscriptTurn[] = Array.isArray(activeCall.transcriptObject)
    ? activeCall.transcriptObject
    : activeCall.transcriptText
    ? activeCall.transcriptText
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((line) => {
          if (line.toLowerCase().startsWith('agent:')) {
            return { role: 'agent', content: line.replace(/^agent:\s*/i, '') };
          }
          if (line.toLowerCase().startsWith('user:')) {
            return { role: 'user', content: line.replace(/^user:\s*/i, '') };
          }
          return { role: 'agent', content: line };
        })
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-details-title"
    >
      <div className="w-full max-w-2xl bg-[#0c121e] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-fade-in relative flex flex-col max-h-[92vh]">
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

                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {isWebCall ? 'Browser Web Call' : 'Phone Call'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{activeCall.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCall}
              disabled={syncing}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Refresh / Sync call data from provider"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                    : isWebCall
                    ? 'Browser WebRTC voice session connected directly to Retell AI.'
                    : 'Real telephony carrier dispatch through Retell AI.'}
                </p>
              </div>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold self-start sm:self-center">
              {isMock ? 'MOCK' : 'LIVE'}
            </span>
          </div>

          {/* RECORDING PLAYBACK SECTION */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-blue-400" /> Call Audio Recording
              </span>

              {activeCall.recordingUrl && (
                <button
                  type="button"
                  id="delete-recording-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-600/30 border border-rose-500/30 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Recording</span>
                </button>
              )}
            </div>

            {activeCall.recordingUrl ? (
              /* REAL AUDIO PLAYER (Play, Pause, Seek Controls) */
              <div className="space-y-2 pt-1">
                <audio
                  controls
                  src={activeCall.recordingUrl}
                  className="w-full rounded-xl bg-slate-950 focus:outline-none"
                  preload="metadata"
                >
                  Your browser does not support the audio element.
                </audio>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Authentic audio recording provided by Retell AI telephony infrastructure.
                </p>
              </div>
            ) : activeCall.recordingStatus === 'removed' ? (
              /* RECORDING REMOVED STATE */
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 flex items-center gap-2.5">
                <VolumeX className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  The audio recording was removed from this application. Call metadata and transcript remain preserved.
                </span>
              </div>
            ) : activeCall.status === 'ENDED' ? (
              /* NO RECORDING OR PROCESSING STATE */
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>No Audio Recording Available for this Call</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {isMock
                    ? 'Mock simulated calls do not generate audio recordings.'
                    : 'Recordings may take 10-60 seconds to process after call completion, or audio recording may not be enabled on your Retell account/agent configuration. Click "Sync" above to check for updates.'}
                </p>
              </div>
            ) : (
              /* CALL ONGOING / INITIATED */
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Audio recording becomes available after the call has completed.</span>
              </div>
            )}
          </div>

          {/* FULL TRANSCRIPT SECTION */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Full Conversation Transcript
              </span>

              {transcriptTurns.length > 0 && (
                <span className="text-[10px] text-slate-400 font-mono">
                  {transcriptTurns.length} dialogue {transcriptTurns.length === 1 ? 'turn' : 'turns'}
                </span>
              )}
            </div>

            {transcriptTurns.length > 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 max-h-60 overflow-y-auto space-y-3 font-sans text-xs">
                {transcriptTurns.map((turn, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 ${
                      turn.role === 'agent' ? 'text-blue-300' : 'text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                        turn.role === 'agent'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {turn.role === 'agent' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <span className="font-semibold text-[10px] uppercase tracking-wider block text-slate-400">
                        {turn.role === 'agent' ? activeCall.agent?.name || 'Agent' : 'User'}
                      </span>
                      <p className="leading-relaxed mt-0.5 whitespace-pre-wrap">{turn.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 text-center py-6">
                {activeCall.status === 'ENDED'
                  ? 'No transcript was recorded for this session. If the call just ended, click Sync above to retrieve processed transcript data.'
                  : 'Transcript will appear here once the conversation begins.'}
              </div>
            )}
          </div>

          {/* Call Analysis Summary if present */}
          {activeCall.summary && (
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5 text-xs text-indigo-300">
              <span className="font-bold text-indigo-200 block uppercase tracking-wider text-[10px]">
                Post-Call AI Summary
              </span>
              <p className="leading-relaxed text-slate-200">{activeCall.summary}</p>
              {activeCall.sentiment && (
                <p className="text-[11px] text-indigo-300/80 font-mono pt-1">
                  User Sentiment: <strong>{activeCall.sentiment}</strong>
                </p>
              )}
            </div>
          )}

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

          {/* Telephony Identifiers Grid */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                {isWebCall ? 'Call Type & Endpoint' : 'Destination Number (Masked)'}
              </span>
              <p className="text-sm font-bold text-white font-mono mt-1 select-all">
                {isWebCall ? 'Browser Web Call' : activeCall.maskedToNumber || activeCall.toNumber}
              </p>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Caller ID / Origin
              </span>
              <p className="text-sm font-bold text-slate-300 font-mono mt-1">
                {isWebCall ? 'Browser Client' : activeCall.maskedFromNumber || activeCall.fromNumber}
              </p>
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-slate-800/60">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Provider Call ID / Retell Session ID
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
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Date & Time
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

        {/* DELETE RECORDING CONFIRMATION DIALOG (Requirement 5) */}
        {showDeleteConfirm && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in"
            role="alertdialog"
            aria-labelledby="confirm-delete-title"
            aria-describedby="confirm-delete-desc"
          >
            <div className="w-full max-w-md bg-[#0F172A] border border-rose-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="confirm-delete-title" className="text-base font-bold text-white">
                    Delete Call Recording?
                  </h3>
                  <p className="text-xs text-rose-300">Action is irreversible in this app</p>
                </div>
              </div>

              <div id="confirm-delete-desc" className="text-xs text-slate-300 space-y-2 leading-relaxed">
                <p>
                  This action will <strong>remove the recording reference from PostgreSQL</strong> and permanently disable audio playback in this application.
                </p>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-sans">
                  <p className="font-semibold text-slate-300">What will be preserved:</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    <li>Full call record and duration</li>
                    <li>Entire conversation transcript</li>
                    <li>Timestamp, status, and metadata</li>
                  </ul>
                </div>
                <p className="text-[11px] text-amber-300/90 font-mono">
                  Note: Retell AI does not support isolated provider-side recording erasure without destroying the entire remote call. The remote recording may remain subject to your Retell account retention rules.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletingRecording}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="confirm-remove-recording-btn"
                  onClick={handleConfirmDeleteRecording}
                  disabled={deletingRecording}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  {deletingRecording ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" /> Remove Recording from App
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallDetailsModal;

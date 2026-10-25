import React, { useState } from 'react';
import {
  X,
  Bot,
  Copy,
  Check,
  Globe,
  Volume2,
  Sliders,
  Calendar,
  FileText,
  Radio,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { Agent } from '../../api/agent.api';
import { Badge } from '../common/Badge';

export interface AgentDetailsModalProps {
  isOpen: boolean;
  agent: Agent | null;
  onClose: () => void;
  onEdit: (agent: Agent) => void;
}

export const AgentDetailsModal: React.FC<AgentDetailsModalProps> = ({
  isOpen,
  agent,
  onClose,
  onEdit,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen || !agent) return null;

  const handleCopyProviderId = () => {
    if (agent.providerAgentId) {
      navigator.clipboard.writeText(agent.providerAgentId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const isMock = agent.providerAgentId?.startsWith('agent_mock_') ?? true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-details-title"
    >
      <div className="w-full max-w-2xl bg-[#0c121e] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-fade-in relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="agent-details-title" className="text-lg font-bold text-white tracking-tight">
                  {agent.name}
                </h2>
                <Badge variant={agent.isActive ? 'success' : 'neutral'} dot size="sm">
                  {agent.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{agent.id}</p>
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

        {/* Content Body */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          {/* Provider Transparency Callout */}
          <div
            className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              isMock
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <Radio className={`w-4 h-4 shrink-0 mt-0.5 ${isMock ? 'text-amber-400' : 'text-emerald-400'}`} />
              <div>
                <p className={`font-semibold ${isMock ? 'text-amber-200' : 'text-emerald-200'}`}>
                  {isMock ? 'Provider Mode: MOCK / SIMULATED' : 'Provider Mode: RETELL LIVE'}
                </p>
                <p className={`mt-0.5 ${isMock ? 'text-amber-300/80' : 'text-emerald-300/80'}`}>
                  {isMock
                    ? 'Deterministic local simulation. Retell cloud API credentials are not consumed.'
                    : 'Synced with live Retell AI cloud infrastructure and official Retell SDK.'}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold self-start sm:self-center ${
                isMock
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {isMock ? 'MOCK/SIMULATED' : 'RETELL LIVE'}
            </span>
          </div>

          {/* Provider ID & Sync Status Card */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Provider Agent ID
              </span>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs text-blue-300 font-mono bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                  {agent.providerAgentId || 'unassigned'}
                </code>
                {agent.providerAgentId && (
                  <button
                    onClick={handleCopyProviderId}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Copy provider agent ID"
                  >
                    {copiedId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">
                Sync Status
              </span>
              <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mt-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{agent.syncStatus}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {agent.description && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Description
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-900/30 p-3 rounded-xl border border-slate-800/50">
                {agent.description}
              </p>
            </div>
          )}

          {/* Configuration Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Voice Model</span>
              </div>
              <p className="text-xs font-semibold text-white truncate">{agent.voiceId}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Language</span>
              </div>
              <p className="text-xs font-semibold text-white truncate">{agent.language}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Responsiveness</span>
              </div>
              <p className="text-xs font-semibold text-white font-mono">
                {agent.responsiveness.toFixed(1)}x
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Interruption</span>
              </div>
              <p className="text-xs font-semibold text-white font-mono">
                {agent.interruptionSensitivity.toFixed(2)}
              </p>
            </div>
          </div>

          {/* System Prompt Box */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>System Persona Prompt Instructions</span>
            </h4>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap select-text">
              {agent.systemPrompt}
            </div>
          </div>

          {/* Timestamps */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Created:{' '}
              {new Date(agent.createdAt).toLocaleDateString()}
            </span>
            <span>Last Updated: {new Date(agent.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(agent);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Agent</span>
          </button>
        </div>
      </div>
    </div>
  );
};

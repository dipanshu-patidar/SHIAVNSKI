import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bot,
  ShieldCheck,
  Zap,
  Radio,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Sliders,
  Volume2,
  Globe,
  Mic,
} from 'lucide-react';
import { agentApi, Agent } from '../api/agent.api';
import { callApi } from '../api/call.api';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { WebVoiceCallModal } from '../components/calls/WebVoiceCallModal';

interface VariableEntry {
  id: string;
  key: string;
  value: string;
}

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export const NewCallPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState<boolean>(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('+14155552671');
  const [variables, setVariables] = useState<VariableEntry[]>([
    { id: '1', key: 'customer_name', value: 'Alex Morgan' },
    { id: '2', key: 'service_inquiry', value: 'Quarterly Account Review' },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [webCallModalOpen, setWebCallModalOpen] = useState<boolean>(false);

  // Load user's agents
  useEffect(() => {
    async function loadAgents() {
      try {
        setLoadingAgents(true);
        const res = await agentApi.listAgents({ limit: 100 });
        setAgents(res.agents);
        // Default to first active agent
        const firstActive = res.agents.find((a) => a.isActive);
        if (firstActive) {
          setSelectedAgentId(firstActive.id);
        } else if (res.agents.length > 0) {
          setSelectedAgentId(res.agents[0].id);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load voice agents';
        toast.error(msg, 'Agent Error');
      } finally {
        setLoadingAgents(false);
      }
    }
    loadAgents();
  }, [toast]);

  // Selected agent details
  const selectedAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId);
  }, [agents, selectedAgentId]);

  // Variables management
  const handleAddVariable = () => {
    const newEntry: VariableEntry = {
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      key: '',
      value: '',
    };
    setVariables([...variables, newEntry]);
  };

  const handleUpdateVariable = (id: string, field: 'key' | 'value', value: string) => {
    setVariables(
      variables.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
    if (errors[`var_${id}`]) {
      const newErrors = { ...errors };
      delete newErrors[`var_${id}`];
      setErrors(newErrors);
    }
  };

  const handleRemoveVariable = (id: string) => {
    setVariables(variables.filter((v) => v.id !== id));
  };

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedAgentId) {
      newErrors.agentId = 'Please select a voice agent to handle the call.';
    }

    const trimmedPhone = phoneNumber.trim();
    if (!trimmedPhone) {
      newErrors.phoneNumber = 'Recipient phone number is required.';
    } else if (!E164_REGEX.test(trimmedPhone)) {
      newErrors.phoneNumber =
        'Phone number must be in international E.164 format with country code (e.g. +14155552671 or +919876543210).';
    }

    // Validate variables
    variables.forEach((v) => {
      const trimmedKey = v.key.trim();
      if (trimmedKey && !/^[a-zA-Z0-9_]{1,50}$/.test(trimmedKey)) {
        newErrors[`var_${v.id}`] =
          'Variable keys must contain only letters, numbers, or underscores (up to 50 chars).';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) {
      toast.warning('Please correct the highlighted form errors before dispatching.', 'Validation Warning');
      return;
    }

    // Format dynamic variables into an object
    const dynamicVariables: Record<string, string> = {};
    variables.forEach((v) => {
      const k = v.key.trim();
      const val = v.value.trim();
      if (k) {
        dynamicVariables[k] = val;
      }
    });

    // Unique client idempotency key to prevent accidental duplicate dispatch
    const idempotencyKey = `call_dispatch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      setIsSubmitting(true);
      const call = await callApi.initiateCall(
        {
          agentId: selectedAgentId,
          toNumber: phoneNumber.trim(),
          dynamicVariables: Object.keys(dynamicVariables).length > 0 ? dynamicVariables : undefined,
        },
        idempotencyKey
      );

      toast.success(
        `Outbound call initiated successfully! Provider ID: ${call.providerCallId}`,
        'Call Dispatched'
      );

      // Redirect to call history so user sees their new call in the table
      navigate('/calls');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to dispatch outbound call';
      toast.error(msg, 'Call Dispatch Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Dispatch Outbound Call
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Radio className="w-3 h-3 text-amber-400" />
              MOCK/SIMULATED
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Specify a verified destination phone number, configure runtime LLM prompt variables, and initiate the call.
          </p>
        </div>

        <Link
          to="/calls"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80 transition-all shrink-0"
        >
          View Call History &rarr;
        </Link>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        {/* Call Dispatch Form Column (2 Cols) */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 sm:p-8 border border-slate-800/80 bg-[#0F1523]/90 shadow-xl space-y-6">
          {/* Provider Simulation Notice */}
          <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-300">
            <Radio className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">
                Simulated Telephony Provider Mode Active
              </p>
              <p className="text-amber-300/80 mt-0.5 leading-relaxed">
                Calls are processed by the local <strong>MockVoiceProvider</strong>. Synthetic call identifiers (<code className="text-amber-200">call_mock_*</code>) will be generated and persisted in PostgreSQL without consuming Retell cloud API credits.
              </p>
            </div>
          </div>

          {/* Prominent Real Browser Voice Call Section */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Browser Voice Conversation</h3>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Converse directly with <strong>{selectedAgent?.name || 'your agent'}</strong> using your browser microphone and speakers via real-time WebRTC. No phone number or carrier charges required.
                </p>
              </div>
            </div>

            <button
              type="button"
              id="start-browser-voice-btn"
              onClick={() => setWebCallModalOpen(true)}
              disabled={loadingAgents || agents.length === 0}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] shrink-0"
            >
              <Mic className="w-4 h-4" /> Start Voice Conversation
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Agent Selection Section */}
            <div className="space-y-2">
              <label htmlFor="select-agent" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Select Voice Agent Persona <span className="text-rose-400">*</span>
              </label>

              {loadingAgents ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <LoadingSpinner size="sm" inline />
                  <span>Loading your agents...</span>
                </div>
              ) : agents.length === 0 ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
                  <span>No voice agents found. You must create an agent before dispatching a call.</span>
                  <Link
                    to="/agents"
                    className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 font-semibold text-rose-200 text-xs transition-colors"
                  >
                    Create Agent &rarr;
                  </Link>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="select-agent"
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  >
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id} className="bg-slate-900 text-white">
                        {agent.name} ({agent.language} / {agent.voiceId}) {agent.isActive ? '• Active' : '• Inactive'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {errors.agentId && <p className="text-xs text-rose-400 mt-1">{errors.agentId}</p>}
            </div>

            {/* Recipient Phone Number */}
            <div className="space-y-2">
              <label htmlFor="recipient-phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Destination Phone Number (International E.164) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="recipient-phone"
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (errors.phoneNumber) setErrors({ ...errors, phoneNumber: '' });
                  }}
                  placeholder="+14155552671"
                  className={`w-full px-4 py-3 bg-slate-900 border rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all ${
                    errors.phoneNumber
                      ? 'border-rose-500/60 bg-rose-500/5'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                />
              </div>
              {errors.phoneNumber ? (
                <p className="text-xs text-rose-400 mt-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.phoneNumber}
                </p>
              ) : (
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  Standard international format with leading + (e.g. +14155552671 for US, +919876543210 for India).
                </p>
              )}
            </div>

            {/* Dynamic Call Variables Editor */}
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Dynamic Prompt Variables
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Inject contextual user data directly into the agent persona instructions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddVariable}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Variable
                </button>
              </div>

              {variables.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No dynamic variables defined. Click "Add Variable" to pass personalized parameters.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {variables.map((v) => (
                    <div key={v.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="variable_key (e.g. customer_name)"
                          value={v.key}
                          onChange={(e) => handleUpdateVariable(v.id, 'key', e.target.value)}
                          className="w-1/3 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Value (e.g. Sarah Connor)"
                          value={v.value}
                          onChange={(e) => handleUpdateVariable(v.id, 'value', e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveVariable(v.id)}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Remove variable"
                          aria-label="Remove variable"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {errors[`var_${v.id}`] && (
                        <p className="text-[11px] text-rose-400 pl-1">{errors[`var_${v.id}`]}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form Footer Action */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Double-dispatch debounce & idempotency protection active.
              </span>

              <button
                type="submit"
                disabled={isSubmitting || loadingAgents || agents.length === 0}
                className="inline-flex items-center justify-center gap-2 px-6 h-11 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/60 disabled:text-slate-400 text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.01] shrink-0"
              >
                {isSubmitting ? (
                  <LoadingSpinner size="sm" inline text="Dispatching Outbound Call..." />
                ) : (
                  <>
                    <Zap className="w-4 h-4 shrink-0" />
                    <span>Initiate Voice Call</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Selected Agent Summary & Telemetry Column (1 Col) */}
        <div className="space-y-5">
          {/* Selected Agent Summary Card */}
          <div className="glass-card rounded-3xl p-6 border border-slate-800/80 bg-[#0F1523]/90 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <span>Selected Agent Persona</span>
            </h3>

            {selectedAgent ? (
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{selectedAgent.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{selectedAgent.providerAgentId || selectedAgent.id}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      selectedAgent.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {selectedAgent.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-blue-400" /> Voice Model
                    </span>
                    <span className="font-medium text-white">{selectedAgent.voiceId}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" /> Language
                    </span>
                    <span className="font-medium text-white">{selectedAgent.language}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" /> Tuning
                    </span>
                    <span className="font-mono text-white text-[11px]">
                      {selectedAgent.responsiveness.toFixed(1)}x / {selectedAgent.interruptionSensitivity.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                    Prompt Preview
                  </span>
                  <p className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-slate-800/60 line-clamp-3 leading-relaxed font-mono">
                    {selectedAgent.systemPrompt}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 text-center py-6">
                No voice agent selected.
              </div>
            )}
          </div>

          {/* Telemetry Architecture Overview */}
          <div className="glass-card rounded-3xl p-6 border border-slate-800/80 bg-[#0F1523]/90 shadow-xl space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" /> Telephony Pipeline
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <p className="text-slate-300 font-semibold mb-0.5">1. Authentication & Ownership</p>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Server verifies your session and confirms agent tenant ownership before dispatching.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <p className="text-slate-300 font-semibold mb-0.5">2. Provider Abstraction</p>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Dispatched via <code>IVoiceProvider</code>. In mock mode, a safe simulation call is provisioned.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <p className="text-slate-300 font-semibold mb-0.5">3. PostgreSQL Persistence</p>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Call records are stored in PostgreSQL and immediately accessible in Call History.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Browser Web Voice Conversation Modal */}
      <WebVoiceCallModal
        isOpen={webCallModalOpen}
        agent={selectedAgent || null}
        onClose={() => setWebCallModalOpen(false)}
        onCallCompleted={() => {
          navigate('/calls');
        }}
      />
    </div>
  );
};

export default NewCallPage;

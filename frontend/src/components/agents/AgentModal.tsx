import React, { useState, useEffect } from 'react';
import { X, Bot, Sparkles, Sliders, Volume2, Globe, FileText, Check } from 'lucide-react';
import { Agent, CreateAgentDTO, UpdateAgentDTO } from '../../api/agent.api';
import { LoadingSpinner } from '../common/LoadingSpinner';

export interface AgentModalProps {
  isOpen: boolean;
  agent?: Agent | null; // null if creating, Agent if editing
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAgentDTO | UpdateAgentDTO) => Promise<void>;
}

const VOICE_OPTIONS = [
  { id: '11labs-Adrian', label: 'Adrian (ElevenLabs)', desc: 'Friendly, warm & articulate' },
  { id: '11labs-Sarah', label: 'Sarah (ElevenLabs)', desc: 'Natural conversational assistant' },
  { id: '11labs-Michael', label: 'Michael (ElevenLabs)', desc: 'Authoritative, executive presenter' },
  { id: '11labs-Emma', label: 'Emma (ElevenLabs)', desc: 'Crisp, upbeat & high-energy' },
  { id: 'retell-Cimo', label: 'Cimo (Retell Voice)', desc: 'Natural voice used by published Retell agent' },
  { id: 'retell-neural-eva', label: 'Eva (Retell Neural)', desc: 'Low-latency conversational agent' },
];

const LANGUAGE_OPTIONS = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'fr-FR', label: 'French (France)' },
  { code: 'de-DE', label: 'German (Germany)' },
  { code: 'hi-IN', label: 'Hindi (India)' },
];

export const AgentModal: React.FC<AgentModalProps> = ({
  isOpen,
  agent,
  isLoading = false,
  onClose,
  onSubmit,
}) => {
  const isEditMode = !!agent;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    voiceId: '11labs-Adrian',
    language: 'en-US',
    systemPrompt: '',
    responsiveness: 1.0,
    interruptionSensitivity: 0.8,
    isActive: true,
    providerAgentId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset or populate form when modal opens or agent changes
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || '',
        description: agent.description || '',
        voiceId: agent.voiceId || '11labs-Adrian',
        language: agent.language || 'en-US',
        systemPrompt: agent.systemPrompt || '',
        responsiveness: agent.responsiveness ?? 1.0,
        interruptionSensitivity: agent.interruptionSensitivity ?? 0.8,
        isActive: agent.isActive ?? true,
        providerAgentId: agent.providerAgentId || '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        voiceId: '11labs-Adrian',
        language: 'en-US',
        systemPrompt:
          'You are an intelligent voice AI assistant for Shiavnski Voice. Your tone is warm, polite, and helpful. You speak naturally and concisely.',
        responsiveness: 1.0,
        interruptionSensitivity: 0.8,
        isActive: true,
        providerAgentId: '',
      });
    }
    setErrors({});
  }, [agent, isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Agent name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name cannot exceed 100 characters';
    }

    if (!formData.voiceId.trim()) {
      newErrors.voiceId = 'Voice selection is required';
    }

    if (!formData.systemPrompt.trim()) {
      newErrors.systemPrompt = 'System prompt instructions are required';
    } else if (formData.systemPrompt.trim().length < 5) {
      newErrors.systemPrompt = 'System prompt must be at least 5 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      voiceId: formData.voiceId,
      language: formData.language,
      systemPrompt: formData.systemPrompt.trim(),
      responsiveness: Number(formData.responsiveness),
      interruptionSensitivity: Number(formData.interruptionSensitivity),
      isActive: formData.isActive,
      providerAgentId: formData.providerAgentId.trim() || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-modal-title"
    >
      <div className="w-full max-w-2xl bg-[#0c121e] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-fade-in relative flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 id="agent-modal-title" className="text-lg font-bold text-white tracking-tight">
                {isEditMode ? 'Edit Voice Agent' : 'Create New Voice Agent'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditMode
                  ? 'Update persona instructions, voice model, and runtime tuning.'
                  : 'Configure persona, TTS model, and conversational responsiveness.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {/* Simulated Mode Banner */}
          <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Simulated Provider Mode:</strong> Agents are safely provisioned via local MockVoiceProvider (zero Retell credentials used).
            </span>
          </div>

          {/* Name & Active Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="agent-name" className="text-xs font-semibold text-slate-300">
                Agent Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="agent-name"
                type="text"
                placeholder="e.g. Sales Inbound Concierge"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all ${
                  errors.name ? 'border-rose-500/60 bg-rose-500/5' : 'border-slate-800 hover:border-slate-700'
                }`}
              />
              {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Status</label>
              <div
                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
              >
                <span className="text-xs font-medium text-slate-300">
                  {formData.isActive ? 'Active' : 'Inactive'}
                </span>
                <div
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                    formData.isActive ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      formData.isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="agent-description" className="text-xs font-semibold text-slate-300">
              Description <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              id="agent-description"
              type="text"
              placeholder="e.g. Primary qualification bot for scheduling sales calls"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
            />
          </div>

          {/* Retell Agent ID (Optional) */}
          <div className="space-y-1.5">
            <label htmlFor="agent-provider-id" className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Retell Agent ID <span className="text-slate-500 font-normal">(Optional — e.g. agent_ba6661e78710d75a9fe62d6451)</span></span>
              {formData.providerAgentId?.startsWith('agent_ba') && (
                <span className="text-[10px] text-emerald-400 font-medium">Published Live Agent</span>
              )}
            </label>
            <input
              id="agent-provider-id"
              type="text"
              placeholder="agent_ba6661e78710d75a9fe62d6451 or leave blank to auto-generate"
              value={formData.providerAgentId}
              onChange={(e) => setFormData({ ...formData, providerAgentId: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
            />
          </div>

          {/* Voice Model & Language Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="agent-voice" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Voice Model</span> <span className="text-rose-400">*</span>
              </label>
              <select
                id="agent-voice"
                value={formData.voiceId}
                onChange={(e) => {
                  setFormData({ ...formData, voiceId: e.target.value });
                  if (errors.voiceId) setErrors({ ...errors, voiceId: '' });
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              >
                {VOICE_OPTIONS.map((voice) => (
                  <option key={voice.id} value={voice.id} className="bg-slate-900 text-white">
                    {voice.label} — {voice.desc}
                  </option>
                ))}
              </select>
              {errors.voiceId && <p className="text-xs text-rose-400 mt-1">{errors.voiceId}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="agent-language" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Language & Locale</span>
              </label>
              <select
                id="agent-language"
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                    {lang.label} ({lang.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversational Sliders: Responsiveness & Interruption Sensitivity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" /> Responsiveness
                </span>
                <span className="text-amber-400 font-mono">{formData.responsiveness.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.1"
                value={formData.responsiveness}
                onChange={(e) => setFormData({ ...formData, responsiveness: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0.2x (Patient)</span>
                <span>1.0x (Normal)</span>
                <span>1.5x (Fast)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Interruption Sensitivity
                </span>
                <span className="text-indigo-400 font-mono">{formData.interruptionSensitivity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={formData.interruptionSensitivity}
                onChange={(e) =>
                  setFormData({ ...formData, interruptionSensitivity: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0.0 (Strict)</span>
                <span>0.8 (Balanced)</span>
                <span>1.0 (High)</span>
              </div>
            </div>
          </div>

          {/* System Prompt Persona Instructions */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="agent-prompt" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>System Persona Prompt Instructions</span> <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {formData.systemPrompt.length} characters
              </span>
            </div>
            <textarea
              id="agent-prompt"
              rows={4}
              placeholder="Define agent personality, business rules, greeting message, and conversational instructions..."
              value={formData.systemPrompt}
              onChange={(e) => {
                setFormData({ ...formData, systemPrompt: e.target.value });
                if (errors.systemPrompt) setErrors({ ...errors, systemPrompt: '' });
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all ${
                errors.systemPrompt
                  ? 'border-rose-500/60 bg-rose-500/5'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            />
            {errors.systemPrompt && (
              <p className="text-xs text-rose-400 mt-1">{errors.systemPrompt}</p>
            )}
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 h-10 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-5 h-10 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] disabled:opacity-50 shrink-0"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" inline />
              ) : (
                <Check className="w-4 h-4 shrink-0" />
              )}
              <span>{isEditMode ? 'Save Changes' : 'Create Agent'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bot,
  Plus,
  Sliders,
  Volume2,
  Globe,
  CheckCircle2,
  Search,
  Trash2,
  Pencil,
  Eye,
  Radio,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { agentApi, Agent, CreateAgentDTO, UpdateAgentDTO } from '../api/agent.api';
import { Badge } from '../components/common/Badge';
import { useToast } from '../context/ToastContext';
import { AgentModal } from '../components/agents/AgentModal';
import { AgentDetailsModal } from '../components/agents/AgentDetailsModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const AgentsPage: React.FC = () => {
  const toast = useToast();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalAgent, setModalAgent] = useState<Agent | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // View details modal state
  const [detailsAgent, setDetailsAgent] = useState<Agent | null>(null);

  // Delete confirmation dialog state
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [syncingRetell, setSyncingRetell] = useState<boolean>(false);

  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  // Sync Retell agent
  const handleSyncRetell = async () => {
    try {
      setSyncingRetell(true);
      const synced = await agentApi.syncRetellAgent();
      setAgents((prev) => {
        const exists = prev.some((a) => a.id === synced.id);
        if (exists) {
          return prev.map((a) => (a.id === synced.id ? synced : a));
        }
        return [synced, ...prev];
      });
      toast.success(`Retell Agent "${synced.name}" (${synced.providerAgentId}) synced into PostgreSQL.`, 'Retell Synced');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sync Retell agent';
      toast.error(msg, 'Sync Error');
    } finally {
      setSyncingRetell(false);
    }
  };

  // Load agents from backend PostgreSQL API
  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await agentApi.listAgents({ search: searchQuery });
      setAgents(res.agents);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch voice agents';
      setError(msg);
      toastRef.current.error(msg, 'Network Error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Client-side filtering for status tabs
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (statusFilter === 'active') return agent.isActive;
      if (statusFilter === 'inactive') return !agent.isActive;
      return true;
    });
  }, [agents, statusFilter]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setModalAgent(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (agent: Agent) => {
    setModalAgent(agent);
    setIsModalOpen(true);
  };

  // Open Details Modal
  const handleOpenDetailsModal = (agent: Agent) => {
    setDetailsAgent(agent);
  };

  // Handle Create or Update submission
  const handleModalSubmit = async (data: CreateAgentDTO | UpdateAgentDTO) => {
    try {
      setSubmitting(true);
      if (modalAgent) {
        // Edit flow
        const updated = await agentApi.updateAgent(modalAgent.id, data as UpdateAgentDTO);
        setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setIsModalOpen(false);
        toast.success(`Agent "${updated.name}" updated successfully.`, 'Agent Updated');
      } else {
        // Create flow
        const created = await agentApi.createAgent(data as CreateAgentDTO);
        setAgents((prev) => [created, ...prev]);
        setIsModalOpen(false);
        toast.success(`Agent "${created.name}" created successfully.`, 'Agent Created');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save agent';
      toast.error(msg, 'Save Error');
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger Delete confirmation
  const handlePromptDelete = (agent: Agent) => {
    setAgentToDelete(agent);
  };

  // Execute Delete
  const handleConfirmDelete = async () => {
    if (!agentToDelete) return;
    try {
      setDeleting(true);
      await agentApi.deleteAgent(agentToDelete.id);
      setAgents((prev) => prev.filter((a) => a.id !== agentToDelete.id));
      toast.success(`Agent "${agentToDelete.name}" deleted successfully.`, 'Agent Deleted');
      setAgentToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete agent';
      toast.error(msg, 'Delete Error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Voice Agents
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Radio className="w-3 h-3 text-amber-400" />
              MOCK/SIMULATED
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Configure agent personas, TTS voice models, and conversational responsiveness with PostgreSQL persistence.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleSyncRetell}
            disabled={syncingRetell}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all hover:scale-[1.02] disabled:opacity-50"
            title="Sync published Retell agent into PostgreSQL database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingRetell ? 'animate-spin' : ''}`} />
            {syncingRetell ? 'Syncing...' : 'Sync Retell Agent'}
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" /> Create Agent
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-[#0F1523]/80 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search agents by name, voice, or prompt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
          />
        </div>

        {/* Status Filter Tabs & Refresh Button */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({agents.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'active'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Active ({agents.filter((a) => a.isActive).length})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Inactive ({agents.filter((a) => !a.isActive).length})
            </button>
          </div>

          <button
            onClick={fetchAgents}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800 transition-colors disabled:opacity-50"
            title="Refresh list"
            aria-label="Refresh agents list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={fetchAgents}
            className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-xs font-semibold text-rose-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="rounded-2xl p-5 border border-slate-800/80 bg-[#0F1523]/60 h-64 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-800" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-3/4 h-4 bg-slate-800 rounded" />
                    <div className="w-1/2 h-3 bg-slate-800 rounded" />
                  </div>
                </div>
                <div className="w-full h-8 bg-slate-800/60 rounded mt-3" />
              </div>
              <div className="w-full h-10 bg-slate-800/40 rounded" />
            </div>
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        /* Empty State */
        <div className="rounded-3xl p-12 border-2 border-dashed border-slate-800/80 bg-[#0F1523]/40 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
            <Bot className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">
            {searchQuery ? 'No matching voice agents' : 'No voice agents configured yet'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md">
            {searchQuery
              ? `No agents matched "${searchQuery}". Try a different keyword or clear your search.`
              : 'Create your first voice agent with custom system instructions, TTS voice selection, and pacing controls.'}
          </p>
          <div className="mt-6 flex items-center gap-3">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                Clear Search
              </button>
            )}
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" /> Add New Agent
            </button>
          </div>
        </div>
      ) : (
        /* Agents Roster Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
          {filteredAgents.map((agent) => {
            const isMock = agent.providerAgentId?.startsWith('agent_mock_') ?? true;

            return (
              <div
                key={agent.id}
                className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0F1523]/90 relative overflow-hidden flex flex-col justify-between group hover:border-slate-700/80 transition-all shadow-lg hover:shadow-xl"
              >
                <div>
                  {/* Card Header: Avatar, Name, Status Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold shrink-0">
                        <Bot className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-white truncate">{agent.name}</h3>
                        <span className="text-[11px] text-slate-400 font-mono truncate block">
                          {agent.providerAgentId || agent.id}
                        </span>
                      </div>
                    </div>
                    <Badge variant={agent.isActive ? 'success' : 'neutral'} dot size="sm">
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Provider Mode Banner */}
                  <div className="mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                        isMock
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      <Radio className="w-2.5 h-2.5" />
                      {isMock ? 'MOCK / SIMULATED' : 'RETELL LIVE'}
                    </span>
                  </div>

                  {/* Description snippet */}
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mb-4 min-h-[32px]">
                    {agent.description || agent.systemPrompt}
                  </p>

                  {/* Configuration Metadata Summary */}
                  <div className="space-y-2 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Voice
                      </span>
                      <span className="text-slate-200 font-medium truncate max-w-[150px]">
                        {agent.voiceId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Language
                      </span>
                      <span className="text-slate-200 font-medium">{agent.language}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Tuning
                      </span>
                      <span className="text-slate-200 font-medium font-mono text-[11px]">
                        resp:{agent.responsiveness.toFixed(1)}x / int:{agent.interruptionSensitivity.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Sync Status + Action Buttons */}
                <div className="mt-5 pt-3.5 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Synced</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenDetailsModal(agent)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="View Details"
                      aria-label={`View details for ${agent.name}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(agent)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                      title="Edit Agent"
                      aria-label={`Edit ${agent.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePromptDelete(agent)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete Agent"
                      aria-label={`Delete ${agent.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Create New Agent Placeholder Card */}
          <div
            onClick={handleOpenCreateModal}
            className="rounded-2xl p-6 border-2 border-dashed border-slate-800/80 hover:border-blue-500/50 bg-[#0F1523]/40 flex flex-col items-center justify-center text-center cursor-pointer group transition-all min-h-[240px]"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
              <Plus className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
              Add New Voice Agent
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Configure system prompts, voice selection, and conversational pacing.
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      <AgentModal
        isOpen={isModalOpen}
        agent={modalAgent}
        isLoading={submitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
      />

      <AgentDetailsModal
        isOpen={!!detailsAgent}
        agent={detailsAgent}
        onClose={() => setDetailsAgent(null)}
        onEdit={(a) => {
          setDetailsAgent(null);
          handleOpenEditModal(a);
        }}
      />

      <ConfirmDialog
        isOpen={!!agentToDelete}
        title="Delete Voice Agent"
        message={`Are you sure you want to permanently delete "${agentToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Agent"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setAgentToDelete(null)}
      />
    </div>
  );
};

export default AgentsPage;

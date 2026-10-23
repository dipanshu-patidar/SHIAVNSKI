import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PhoneCall,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Radio,
  Eye,
  PhoneOutgoing,
  Bot,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { callApi, Call, CallStatus } from '../api/call.api';
import { agentApi, Agent } from '../api/agent.api';
import { useToast } from '../context/ToastContext';
import { CallDetailsModal } from '../components/calls/CallDetailsModal';

export const CallsPage: React.FC = () => {
  const toast = useToast();

  const [calls, setCalls] = useState<Call[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [agentFilter, setAgentFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const limit = 15;

  // Selected Call for Details Modal
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  // Load user's agents for dropdown filter
  useEffect(() => {
    async function loadAgents() {
      try {
        const res = await agentApi.listAgents({ limit: 100 });
        setAgents(res.agents);
      } catch (e) {
        console.warn('Failed to load agents for filter:', e);
      }
    }
    loadAgents();
  }, []);

  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  // Fetch calls from backend API
  const fetchCalls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Parameters<typeof callApi.listCalls>[0] = {
        page,
        limit,
        search: searchQuery.trim() || undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as CallStatus) : undefined,
        agentId: agentFilter !== 'ALL' ? agentFilter : undefined,
      };

      const res = await callApi.listCalls(params);
      setCalls(res.calls);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch call history';
      setError(msg);
      toastRef.current.error(msg, 'History Error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, statusFilter, agentFilter]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: CallStatus) => {
    switch (status) {
      case 'ENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ended
          </span>
        );
      case 'ONGOING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <PhoneCall className="w-3.5 h-3.5" /> Ongoing
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      case 'INITIATED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Initiated
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Call Records & Telemetry
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Radio className="w-3 h-3 text-amber-400" />
              MOCK/SIMULATED
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Browse paginated call records, inspect recipient metadata, and monitor telemetry persisted in PostgreSQL.
          </p>
        </div>

        <Link
          to="/call/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] shrink-0"
        >
          <PhoneOutgoing className="w-4 h-4" /> Dispatch Call
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-[#0F1523]/80 border border-slate-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 w-full">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by destination phone or call ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
          />
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="inline-flex p-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-medium">
            {['ALL', 'INITIATED', 'ONGOING', 'ENDED', 'FAILED'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors capitalize ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Agent Filter Dropdown */}
          {agents.length > 0 && (
            <select
              value={agentFilter}
              onChange={(e) => {
                setAgentFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[160px] truncate"
            >
              <option value="ALL">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchCalls}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800 transition-colors disabled:opacity-50"
            title="Refresh call records"
            aria-label="Refresh call records"
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
            onClick={fetchCalls}
            className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-xs font-semibold text-rose-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Calls Table Card */}
      <div className="glass-card rounded-3xl border border-slate-800/80 bg-[#0F1523]/90 overflow-hidden shadow-xl w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="text-xs uppercase tracking-wider text-slate-400 bg-slate-900/60 border-b border-slate-800/60">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Destination (Masked)</th>
                <th className="px-6 py-4">Voice Agent</th>
                <th className="px-6 py-4">Provider Call ID</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {loading ? (
                // Loading Skeleton Rows
                [1, 2, 3, 4, 5].map((n) => (
                  <tr key={n} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="w-20 h-5 bg-slate-800 rounded-full" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-28 h-4 bg-slate-800 rounded" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-32 h-4 bg-slate-800 rounded" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-36 h-4 bg-slate-800 rounded" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-12 h-4 bg-slate-800 rounded" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 h-4 bg-slate-800 rounded" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="w-16 h-4 bg-slate-800 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : calls.length === 0 ? (
                // Empty State Row
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                        <PhoneCall className="w-7 h-7" />
                      </div>
                      <h4 className="text-base font-bold text-white">
                        {searchQuery || statusFilter !== 'ALL' || agentFilter !== 'ALL'
                          ? 'No matching calls found'
                          : 'No call records yet'}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'Try clearing your search query or status filter to see all records.'
                          : 'Initiate your first outbound call to test persona behavior and monitor real-time call states.'}
                      </p>
                      <Link
                        to="/call/new"
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30"
                      >
                        <PhoneOutgoing className="w-3.5 h-3.5" /> Dispatch Outbound Call
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                // Call Rows
                calls.map((call) => {
                  const isMock = call.isMock ?? call.providerCallId.startsWith('call_mock_');

                  return (
                    <tr
                      key={call.id}
                      className="hover:bg-slate-900/40 transition-colors group"
                    >
                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(call.status)}
                      </td>

                      {/* Masked Destination Number */}
                      <td className="px-6 py-4 font-mono text-sm text-white font-medium whitespace-nowrap">
                        {call.maskedToNumber || call.toNumber}
                      </td>

                      {/* Agent */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-blue-400 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-white truncate max-w-[160px]">
                              {call.agent?.name || 'Agent Persona'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {call.agent?.voiceId || 'Default'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Provider Call ID */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {call.providerCallId}
                          </code>
                          {isMock && (
                            <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                              MOCK
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="px-6 py-4 text-xs font-mono text-slate-300 whitespace-nowrap">
                        {formatDuration(call.durationSeconds)}
                      </td>

                      {/* Timestamp */}
                      <td className="px-6 py-4 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(call.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedCall(call)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-400 hover:text-white hover:bg-blue-600/20 border border-blue-500/20 transition-all"
                          title="View Call Details"
                          aria-label={`View details for call ${call.id}`}
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination Controls */}
        <div className="p-4 bg-slate-900/40 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              Showing {calls.length} of {total} call records • PostgreSQL Persisted
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2 self-center sm:self-auto">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 disabled:opacity-40 transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-300 font-mono px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 disabled:opacity-40 transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Call Details Modal */}
      <CallDetailsModal
        isOpen={!!selectedCall}
        call={selectedCall}
        onClose={() => setSelectedCall(null)}
        onCallUpdated={(updated) => {
          setSelectedCall(updated);
          setCalls((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        }}
      />
    </div>
  );
};

export default CallsPage;

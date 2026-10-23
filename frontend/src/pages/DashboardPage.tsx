import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PhoneCall,
  Users,
  Clock,
  CheckCircle2,
  Server,
  AlertCircle,
  Activity,
  ArrowUpRight,
  Filter,
  Calendar,
  Sparkles,
  RefreshCw,
  Eye,
  Bot,
  Radio,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { callApi, Call, DashboardMetrics, CallStatus } from '../api/call.api';
import { agentApi, Agent } from '../api/agent.api';
import { CallDetailsModal } from '../components/calls/CallDetailsModal';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  providerMode: string;
}

type DateRangeOption = '24h' | '7d' | '30d' | 'all';

export const DashboardPage: React.FC = () => {
  // Backend API Connectivity Health
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Dynamic Dashboard Metrics State
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Filter State
  const [dateRange, setDateRange] = useState<DateRangeOption>('7d');
  const [agentFilter, setAgentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [agents, setAgents] = useState<Agent[]>([]);

  // Selected Call for Modal
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  // Check backend health
  useEffect(() => {
    async function checkHealth() {
      try {
        setLoadingHealth(true);
        const res = await apiClient.get('/health');
        if (res.data?.data) {
          setHealth(res.data.data);
          setHealthError(null);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Backend connection unavailable';
        setHealthError(message);
      } finally {
        setLoadingHealth(false);
      }
    }
    checkHealth();
  }, []);

  // Load user's agents for filter dropdown
  useEffect(() => {
    async function loadAgents() {
      try {
        const res = await agentApi.listAgents({ limit: 100 });
        setAgents(res.agents);
      } catch (err) {
        console.warn('Failed to load agents for dashboard filter:', err);
      }
    }
    loadAgents();
  }, []);

  // Compute date range timestamps
  const getDateRangeFilter = (range: DateRangeOption) => {
    if (range === 'all') return { startDate: undefined, endDate: undefined };
    const now = new Date();
    const start = new Date();
    if (range === '24h') {
      start.setHours(now.getHours() - 24);
    } else if (range === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (range === '30d') {
      start.setDate(now.getDate() - 30);
    }
    return {
      startDate: start.toISOString(),
      endDate: now.toISOString(),
    };
  };

  // Fetch dynamic metrics from backend API
  const fetchMetrics = useCallback(async () => {
    try {
      setLoadingMetrics(true);
      setMetricsError(null);
      const { startDate, endDate } = getDateRangeFilter(dateRange);
      const data = await callApi.getDashboardMetrics({
        startDate,
        endDate,
        agentId: agentFilter !== 'ALL' ? agentFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setMetrics(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard metrics';
      setMetricsError(msg);
    } finally {
      setLoadingMetrics(false);
    }
  }, [dateRange, agentFilter, statusFilter]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusBadge = (status: CallStatus) => {
    switch (status) {
      case 'ENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Ended
          </span>
        );
      case 'ONGOING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <PhoneCall className="w-3 h-3" /> Ongoing
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'INITIATED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Initiated
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Operations Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Radio className="w-3 h-3 text-amber-400" />
              MOCK/SIMULATED
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telephony telemetry, agent metrics, and live call records persisted in PostgreSQL.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchMetrics}
            disabled={loadingMetrics}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh dashboard metrics"
            aria-label="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loadingMetrics ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            to="/call/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all hover:scale-[1.02]"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Launch Outbound Call</span>
          </Link>
        </div>
      </div>

      {/* Backend API Connectivity Ribbon */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800/80 bg-[#0F1523]/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center text-blue-400 border border-slate-700/60">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Backend API Connectivity</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Connected to <code className="text-blue-400 font-mono">/api/health</code>
              </p>
            </div>
          </div>

          <div>
            {loadingHealth ? (
              <LoadingSpinner size="sm" text="Connecting to backend..." />
            ) : healthError ? (
              <div className="flex items-center gap-2 text-rose-400 text-xs font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>Backend offline ({healthError})</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Badge variant="success" dot size="md">
                  API Online ({health?.status})
                </Badge>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Mode: <span className="text-slate-200 font-semibold uppercase">{health?.providerMode}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metric Error Alert */}
      {metricsError && (
        <div className="rounded-2xl p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="text-sm">{metricsError}</span>
          </div>
          <button
            type="button"
            onClick={fetchMetrics}
            className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-xs font-semibold text-rose-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Metric Cards (Calculated from Real Database Records) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Card 1: Total Calls */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0F1523]/90 relative overflow-hidden group hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <PhoneCall className="w-5 h-5" />
            </div>
            <Activity className="w-4 h-4 text-slate-500" />
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Total Calls
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-bold text-white tracking-tight">
              {metrics?.totalCalls ?? 0}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" /> {metrics?.completedCalls ?? 0} completed
            </span>
          </div>
        </div>

        {/* Card 2: Avg Duration */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0F1523]/90 relative overflow-hidden group hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <Activity className="w-4 h-4 text-slate-500" />
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Avg Duration
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-bold text-white tracking-tight">
              {formatDuration(metrics?.avgDurationSeconds ?? 0)}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" /> {metrics?.ongoingCalls ?? 0} active
            </span>
          </div>
        </div>

        {/* Card 3: Success Rate */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0F1523]/90 relative overflow-hidden group hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <Activity className="w-4 h-4 text-slate-500" />
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Success Rate
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-bold text-white tracking-tight">
              {typeof metrics?.successRate === 'number' ? `${metrics.successRate.toFixed(1)}%` : '0.0%'}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
              {metrics?.failedCalls ?? 0} failed
            </span>
          </div>
        </div>

        {/* Card 4: Active Agents */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0F1523]/90 relative overflow-hidden group hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <Activity className="w-4 h-4 text-slate-500" />
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Active Agents
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-bold text-white tracking-tight">
              {metrics?.activeAgents ?? 0}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              Ready
            </span>
          </div>
        </div>
      </div>

      {/* Call Log Table Section (Persisted Database Records with Interactive Filters) */}
      <div className="glass-card rounded-2xl border border-slate-800/80 bg-[#0F1523]/90 overflow-hidden w-full">
        {/* Table Header with Interactive Filters */}
        <div className="p-5 border-b border-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Recent Call Telemetry</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live calls, recipient metadata, and persisted database history
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Date Range Filter */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="dashboard-date-range" className="sr-only">Date Range</label>
              <select
                id="dashboard-date-range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="24h" className="bg-slate-900 text-white">Last 24 Hours</option>
                <option value="7d" className="bg-slate-900 text-white">Last 7 Days</option>
                <option value="30d" className="bg-slate-900 text-white">Last 30 Days</option>
                <option value="all" className="bg-slate-900 text-white">All Time</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="dashboard-status-filter" className="sr-only">Status</label>
              <select
                id="dashboard-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">All Records</option>
                <option value="ENDED" className="bg-slate-900 text-white">Ended / Completed</option>
                <option value="ONGOING" className="bg-slate-900 text-white">Ongoing</option>
                <option value="INITIATED" className="bg-slate-900 text-white">Initiated</option>
                <option value="FAILED" className="bg-slate-900 text-white">Failed</option>
              </select>
            </div>

            {/* Agent Filter */}
            {agents.length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <Bot className="w-3.5 h-3.5 text-slate-400" />
                <label htmlFor="dashboard-agent-filter" className="sr-only">Agent</label>
                <select
                  id="dashboard-agent-filter"
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer max-w-[150px] truncate"
                >
                  <option value="ALL" className="bg-slate-900 text-white">All Agents</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Table Content / States */}
        {loadingMetrics ? (
          <div className="p-12 flex items-center justify-center">
            <LoadingSpinner size="md" text="Loading telemetry from PostgreSQL..." />
          </div>
        ) : !metrics || !Array.isArray(metrics.recentCalls) || metrics.recentCalls.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">No call records found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No outbound calls matching your filter criteria are persisted in the database.
            </p>
            <div className="mt-4">
              <Link
                to="/call/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Launch First Call
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[650px]">
              <thead className="text-xs uppercase tracking-wider text-slate-400 bg-slate-900/40 border-b border-slate-800/60">
                <tr>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Destination (Masked)</th>
                  <th className="px-6 py-3.5">Voice Agent</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {metrics.recentCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="px-6 py-4">
                      {getStatusBadge(call.status)}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-200">
                      {call.maskedToNumber || call.toNumber}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      {call.agent?.name || 'Assigned Agent'}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-300">
                      {formatDuration(call.durationSeconds)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(call.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedCall(call)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info ribbon */}
        <div className="p-4 bg-slate-900/30 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            Displaying persisted call records from PostgreSQL. Filter by date, agent, or status to inspect historical telemetry.
          </span>
          <Link to="/calls" className="text-blue-400 hover:text-blue-300 font-medium shrink-0">
            View All Call Records &rarr;
          </Link>
        </div>
      </div>

      {/* Call Details Modal */}
      <CallDetailsModal
        isOpen={!!selectedCall}
        call={selectedCall}
        onClose={() => setSelectedCall(null)}
        onCallUpdated={(updated) => {
          setSelectedCall(updated);
          fetchMetrics();
        }}
      />
    </div>
  );
};

export default DashboardPage;

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mic, Radio, Sparkles, Menu } from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const location = useLocation();
  const providerMode = (import.meta.env.VITE_PROVIDER_MODE || 'mock').toLowerCase();
  const isMock = providerMode === 'mock';

  // Determine current active page title
  const getPageTitle = () => {
    if (location.pathname === '/' || location.pathname === '/dashboard') return 'Dashboard';
    if (location.pathname.startsWith('/agents')) return 'Voice Agents';
    if (location.pathname.startsWith('/calls')) return 'Call Records';
    return 'Voice Console';
  };

  return (
    <header className="sticky top-0 z-20 w-full border-b border-slate-800/70 bg-[#0c121e]/85 backdrop-blur-xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      {/* Left: Mobile Hamburger Toggle & Active Section Heading */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
            {getPageTitle()}
          </h2>
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3" /> Live Console
          </span>
        </div>
      </div>

      {/* Right: Persistent Provider Mode Badge & Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* REQ-FE-05: Persistent Provider Mode Badge */}
        <div data-testid="provider-mode-badge" className="shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 sm:gap-2 font-medium rounded-full border text-[11px] sm:text-xs px-2.5 sm:px-3.5 py-1 sm:py-1.5 font-semibold tracking-wide transition-all ${
              isMock
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-sm shadow-amber-500/10'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10'
            }`}
          >
            <span
              className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full shrink-0 ${
                isMock ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <Radio className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">
              {isMock ? 'PROVIDER: MOCK SIMULATION' : 'PROVIDER: RETELL LIVE'}
            </span>
          </span>
        </div>

        {/* Quick Voice Conversation Navigation Button */}
        <Link
          to="/calls"
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all hover:scale-[1.02] shrink-0"
        >
          <Mic className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Voice Console</span>
        </Link>
      </div>
    </header>
  );
};

export default Navbar;

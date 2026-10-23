import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Bot,
  Phone,
  PhoneOutgoing,
  ChevronDown,
  ShieldCheck,
  Radio,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onClose,
  className = '',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const mainNav = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/agents', label: 'Voice Agents', icon: Bot },
    { to: '/calls', label: 'Call Records', icon: Phone },
    { to: '/call/new', label: 'Dispatch Call', icon: PhoneOutgoing },
  ];

  const isItemActive = (to: string, exact?: boolean) => {
    if (exact || to === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(to);
  };

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      if (onClose) onClose();
      navigate('/login');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const displayName = user?.fullName || 'AI Admin';
  const displayRole = user?.role || 'USER';

  // Dynamic unique AI bot avatar generated for each user based on their identity
  const userSeed = user?.email || user?.id || user?.fullName || 'ai-admin';
  const aiAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
    userSeed
  )}&backgroundColor=0f172a,1e1b4b,172554,022c22,31104b`;

  useEffect(() => {
    setAvatarError(false);
  }, [userSeed]);

  const sidebarContent = (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-5 space-y-5">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-blue-400/30">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              <span>Shiavnski Voice</span>
            </h1>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
              AI Voice Console
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User Profile Card with Logout Trigger */}
      <div className="relative">
        <div
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="mx-1 px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full ring-2 ring-blue-500/40 bg-slate-900 overflow-hidden flex items-center justify-center shadow-md shadow-blue-500/20">
                {!avatarError ? (
                  <img
                    src={aiAvatarUrl}
                    alt={displayName}
                    onError={() => setAvatarError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-500">
                    <Bot className="w-5 h-5 text-cyan-300" />
                  </div>
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-950" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{displayName}</p>
              <p className="text-xs text-slate-400 truncate">{displayRole}</p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-transform shrink-0 ${
              showUserMenu ? 'rotate-180 text-blue-400' : ''
            }`}
          />
        </div>

        {/* User Dropdown Menu */}
        {showUserMenu && (
          <div className="absolute left-1 right-1 top-full mt-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800 shadow-xl z-20 space-y-1">
            <div className="px-3 py-2 border-b border-slate-800/80">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              <p className="text-[11px] text-slate-400 truncate font-mono">{user?.email || 'admin@shiavnski.com'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Navigation Menu */}
      <nav className="space-y-1">
        {mainNav.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item.to, item.exact);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleLinkClick}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );

  const sidebarFooter = (
    <div className="p-4 border-t border-slate-800/60 space-y-2">
      <div className="rounded-xl p-3 bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-1">
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Multi-Tenant Boundary</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">
          Tenant: <strong className="text-slate-300 font-mono">{user?.id?.slice(0, 10) || 'dev-local'}</strong>
        </p>
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Log Out</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar (Always visible on desktop lg+) */}
      <aside
        className={`hidden lg:flex w-64 shrink-0 bg-[#0c121e]/90 border-r border-slate-800/70 backdrop-blur-xl flex-col justify-between h-screen sticky top-0 z-30 ${className}`}
      >
        {sidebarContent}
        {sidebarFooter}
      </aside>

      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-in Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-[#0c121e] border-r border-slate-800/80 shadow-2xl flex flex-col justify-between h-full lg:hidden transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
        {sidebarFooter}
      </div>
    </>
  );
};

export default Sidebar;

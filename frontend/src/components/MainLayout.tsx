import React, { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Database, 
  Send, 
  CreditCard, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X, 
  Sparkles 
} from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { business, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Conversations', path: '/conversations', icon: MessageSquare },
    { name: 'Knowledge Base', path: '/knowledge', icon: Database },
    { name: 'Broadcast', path: '/broadcast', icon: Send },
    { name: 'Billing', path: '/billing', icon: CreditCard },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPlanBadgeClass = (plan?: string) => {
    switch(plan) {
      case 'pro': return 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-900/30';
      case 'starter': return 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-900/30';
      default: return 'bg-slate-800 text-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            BizReply
          </span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar - Desktop & Mobile Drawer */}
      <aside className={`
        fixed inset-0 z-50 md:relative md:z-0
        flex flex-col w-64 bg-slate-900 border-r border-slate-800/80 transition-transform duration-300
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <span className="font-extrabold text-xl bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              BizReply
            </span>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Business Context Profile card */}
        <div className="p-4 mx-3 my-4 bg-slate-950/50 rounded-xl border border-slate-800/60 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm truncate max-w-[120px]">{business?.name || 'My Business'}</h4>
            <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${getPlanBadgeClass(business?.plan)}`}>
              {business?.plan || 'free'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <div className={`w-2 h-2 rounded-full ${business?.aiEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
            <span>AI Status: {business?.aiEnabled ? 'Active' : 'Paused'}</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
                  ${isActive 
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}
                `}
              >
                <Icon size={18} className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer / Logout */}
        <div className="p-4 border-t border-slate-800/80">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent transition-all duration-200 cursor-pointer"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Desktop Header Bar */}
        <header className="hidden md:flex bg-slate-900/40 backdrop-blur-md border-b border-slate-800/60 px-8 py-4 items-center justify-between sticky top-0 z-30">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0 p-0" style={{ fontSize: '1.25rem' }}>
              {business?.name || 'Dashboard'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage your WhatsApp customer automation</p>
          </div>
          <div className="flex items-center gap-4">
            {business?.whatsappNumber ? (
              <div className="text-xs text-slate-400 bg-slate-800/60 border border-slate-700/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>WhatsApp: {business.whatsappNumber}</span>
              </div>
            ) : (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                <span>WhatsApp not connected</span>
              </div>
            )}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-semibold text-sm">
              {business?.name?.charAt(0).toUpperCase() || 'B'}
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
        />
      )}
    </div>
  );
};

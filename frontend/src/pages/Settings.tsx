import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Settings as SettingsIcon,
  Bot, 
  Smartphone, 
  Clock, 
  Lock, 
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Save
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 }
];

const Settings: React.FC = () => {
  const { business, updateBusiness } = useAuth();

  // Settings State
  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  
  // Business Hours
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  
  // Rebrand Option
  const [customBranding, setCustomBranding] = useState(false);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status logs
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Initialize fields
  useEffect(() => {
    if (business) {
      setName(business.name || '');
      setWhatsappNumber(business.whatsappNumber || '');
      setWhatsappPhoneId(business.whatsappPhoneId || '');
      setAiEnabled(business.aiEnabled ?? false);
      
      // Load Hours if exists
      const hours = (business as any).businessHours;
      if (hours) {
        setOpenTime(hours.open || '09:00');
        setCloseTime(hours.close || '18:00');
        setSelectedDays(hours.days || [1, 2, 3, 4, 5]);
      }
      setLoading(false);
    }
  }, [business]);

  const showStatus = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 6000);
  };

  const handleDayToggle = (dayVal: number) => {
    setSelectedDays((prev) => 
      prev.includes(dayVal) 
        ? prev.filter((d) => d !== dayVal) 
        : [...prev, dayVal].sort()
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setStatusMessage(null);

    const payload = {
      name,
      whatsappNumber,
      whatsappToken: whatsappToken || undefined, // Send only if written
      whatsappPhoneId,
      businessHours: {
        open: openTime,
        close: closeTime,
        days: selectedDays
      },
      aiEnabled
    };

    try {
      const response = await api.put('/business/update', payload);
      if (response.data?.success) {
        showStatus('Business settings updated successfully.');
        // Update context details
        updateBusiness(response.data.data);
      }
    } catch (err: any) {
      console.error('Update error:', err);
      showStatus(
        err.response?.data?.message || 'Failed to update business profile settings.',
        true
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showStatus('New passwords do not match.', true);
      return;
    }

    setSavingPassword(true);
    try {
      // Simulate password change request successfully
      await new Promise(resolve => setTimeout(resolve, 1500));
      showStatus('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showStatus('Failed to update password.', true);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('WARNING: THIS IS IRREVERSIBLE. Are you sure you want to permanently delete your BizReply business account and erase all associated database records?')) {
      return;
    }

    setDeletingAccount(true);
    try {
      // Simulate deletion or prompt
      await new Promise(resolve => setTimeout(resolve, 2000));
      localStorage.clear();
      window.location.href = '/login';
    } catch (err) {
      showStatus('Failed to process deletion.', true);
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-400 text-sm">Querying business settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">System Settings</h2>
        <p className="text-slate-400 text-sm">Configure WhatsApp cloud webhooks, operations hours, branding, and credentials.</p>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl flex items-start gap-3 text-sm border ${
          statusMessage.isError 
            ? 'bg-red-500/10 border-red-500/20 text-red-200' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
        }`}>
          {statusMessage.isError ? <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-400" /> : <CheckCircle size={18} className="shrink-0 mt-0.5 text-emerald-400" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Config Form Card */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main profile form */}
          <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 space-y-6">
            <div className="flex items-center gap-2">
              <SettingsIcon size={18} className="text-indigo-400" />
              <h3 className="text-base font-bold text-white">Profile & Meta Configuration</h3>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Business Profile Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-sm focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    WhatsApp Connected Number
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <Smartphone size={16} />
                    </span>
                    <input
                      type="text"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="e.g. +919876543210"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-sm focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Meta Phone ID (whatsappPhoneId)
                  </label>
                  <input
                    type="text"
                    value={whatsappPhoneId}
                    onChange={(e) => setWhatsappPhoneId(e.target.value)}
                    placeholder="e.g. 1055598124991"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-sm focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Meta Cloud API Token (whatsappToken)
                  </label>
                  <input
                    type="password"
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-sm focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Operating Hours Block */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-850 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Automation Operations Hours</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Open Time</label>
                    <input
                      type="time"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-white px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Close Time</label>
                    <input
                      type="time"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-white px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-2">Active Automation Days</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const isActive = selectedDays.includes(day.value);
                      return (
                        <button
                          type="button"
                          key={day.value}
                          onClick={() => handleDayToggle(day.value)}
                          className={`
                            px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none
                            ${isActive 
                              ? 'bg-indigo-650 text-white border-transparent' 
                              : 'bg-slate-950 text-slate-500 border-slate-850 hover:text-slate-300'}
                          `}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bot toggles */}
              <div className="flex items-center justify-between p-4 bg-slate-950/40 rounded-xl border border-slate-850">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Bot size={15} className="text-violet-400" />
                    <span>Enable Global AI Auto-Replies</span>
                  </h4>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed">
                    Toggle to suspend AI automation across all chats at once. Resume manually later.
                  </p>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10.5 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Rebrand check */}
              <div className="flex items-center justify-between p-4 bg-slate-950/40 rounded-xl border border-slate-850">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-white">Custom Branding & Rebranding</h4>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed">
                    Strip BizReply branding from your client WhatsApp templates and auto-replies.
                  </p>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={customBranding}
                    onChange={(e) => setCustomBranding(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10.5 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-950/25 transition-all w-fit cursor-pointer disabled:opacity-50"
              >
                {savingSettings ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar credentials / Danger Zone */}
        <div className="space-y-6">
          
          {/* Password Card */}
          <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 space-y-5">
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-indigo-400" />
              <h3 className="text-base font-bold text-white">Update Password</h3>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-indigo-500 rounded-lg text-white text-xs focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-indigo-500 rounded-lg text-white text-xs focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-indigo-500 rounded-lg text-white text-xs focus:outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-red-500/20 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              <h3 className="text-base font-bold text-white">Danger Zone</h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Deleting your business profile will permanently wipe out your database lists, subscription settings, and webhook history.
            </p>

            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="w-full py-2.5 bg-red-600/10 hover:bg-red-650 hover:text-white border border-red-500/20 hover:border-transparent rounded-xl text-xs font-bold text-red-400 transition-all cursor-pointer disabled:opacity-50"
            >
              {deletingAccount ? 'Erasing Workspace...' : 'Delete Business Account'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;

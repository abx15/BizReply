import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Send, 
  Clock, 
  Users, 
  Sparkles, 
  Lock, 
  Calendar,
  AlertCircle,
  CheckCircle,
  FileText,
  History
} from 'lucide-react';

interface Campaign {
  _id: string;
  name: string;
  content: string;
  targets: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledAt: string;
  deliveredCount?: number;
}

const Broadcast: React.FC = () => {
  const { business } = useAuth();

  const isPro = business?.plan === 'pro';

  // Composer State
  const [message, setMessage] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [totalCustomers, setTotalCustomers] = useState(0);
  
  // Status & Logs
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchCampaigns = async () => {
    if (!isPro) {
      setLoading(false);
      return;
    }
    try {
      const response = await api.get('/broadcast/history');
      if (response.data?.success) {
        setCampaigns(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  };

  const fetchCustomerCount = async () => {
    try {
      const response = await api.get('/conversations');
      if (response.data?.success) {
        const uniquePhones = new Set(response.data.data.map((c: any) => c.customerPhone));
        setTotalCustomers(uniquePhones.size);
      }
    } catch (err) {
      console.error('Error estimating contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerCount();
    fetchCampaigns();
  }, [isPro]);

  const showStatus = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 6000);
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    setStatusMessage(null);

    const payload: any = { message };
    if (isScheduled && scheduleAt) {
      payload.scheduleAt = new Date(scheduleAt).toISOString();
    }

    try {
      const response = await api.post('/broadcast/send', payload);
      if (response.data?.success) {
        showStatus(
          isScheduled 
            ? 'Broadcast campaign scheduled successfully.' 
            : `Broadcast queued successfully for ${totalCustomers} contacts.`,
          false
        );
        setMessage('');
        setIsScheduled(false);
        setScheduleAt('');
        fetchCampaigns();
      }
    } catch (err: any) {
      console.error('Broadcast error:', err);
      showStatus(
        err.response?.data?.message || 'Failed to dispatch broadcast. Ensure parameters are correct.',
        true
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">Completed</span>;
      case 'pending':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">Scheduled</span>;
      case 'processing':
        return <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full text-xs font-semibold animate-pulse">Sending...</span>;
      case 'failed':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">Failed</span>;
      default:
        return null;
    }
  };

  // Plan Gate screen block for Free/Starter plans
  if (!isPro) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto space-y-6">
        <div className="bg-gradient-to-tr from-violet-600 to-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-900/35 relative">
          <Lock size={36} />
          <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider">PRO</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Unlock Broadcast Campaigns</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Broadcast messages allow you to compose, schedule, and bulk send WhatsApp messages directly to all your previous customers at once. This premium feature is locked under the Pro subscription plan.
          </p>
        </div>
        
        <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-left space-y-2 text-xs w-full">
          <h4 className="font-semibold text-slate-300">Why upgrade to PRO?</h4>
          <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
            <li>Send unlimited bulk messages to all active threads.</li>
            <li>Schedule campaigns for specific date and timezone times.</li>
            <li>Access detailed delivery logs and tracking statistics.</li>
            <li>Increase your WhatsApp template message volume limitations.</li>
          </ul>
        </div>

        <Link
          to="/billing"
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/35 transition-all w-fit cursor-pointer"
        >
          <Sparkles size={16} />
          <span>Upgrade to Pro Plan</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">WhatsApp Broadcast campaigns</h2>
        <p className="text-slate-400 text-sm">Draft template campaigns and dispatch messages immediately or scheduled for later.</p>
      </div>

      {/* Grid: Compose vs stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer Card */}
        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 space-y-6">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-indigo-400" />
            <h3 className="text-base font-bold text-white font-sans">Campaign Composer</h3>
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

          <form onSubmit={handleSendBroadcast} className="space-y-5">
            {/* Target Audience stat */}
            <div className="flex items-center gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-850">
              <div className="bg-indigo-500/10 p-2.5 rounded-xl text-indigo-400">
                <Users size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Estimated Target Audience</p>
                <p className="text-sm font-bold text-white">{totalCustomers} unique customer contacts</p>
              </div>
            </div>

            {/* Content Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Message Content
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                required
                rows={5}
                placeholder="Write your WhatsApp message here. Use plain text. Make sure to double check prices and details..."
                className="w-full p-4 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm transition-all resize-none"
              />
              <div className="flex justify-end text-[10px] text-slate-500 mt-1">
                <span>{message.length} / 1000 characters</span>
              </div>
            </div>

            {/* Schedule picker */}
            <div className="space-y-3 p-4 bg-slate-950/30 rounded-xl border border-slate-850">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="rounded border-slate-800 text-indigo-600 bg-slate-950 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-300">Schedule campaign for a future time</span>
              </label>

              {isScheduled && (
                <div className="relative w-fit">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                    <Calendar size={16} />
                  </span>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    required={isScheduled}
                    min={new Date().toISOString().slice(0, 16)}
                    className="pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-white focus:outline-none cursor-pointer"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!message.trim() || submitting || (isScheduled && !scheduleAt)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer w-fit"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : isScheduled ? (
                <>
                  <Clock size={16} />
                  <span>Schedule Broadcast</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Send Broadcast Now</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info card side */}
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 space-y-4 h-fit">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-violet-400" />
            <h3 className="text-base font-bold text-white">Broadcast Policy</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Meta requires WhatsApp Business templates for initiated messages if outside the 24-hour service window. Sending too many low-quality promotional messages may result in number blocking.
          </p>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 text-[11px] text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-400">💡 Optimization tip:</span> Use personalized tags and offer value. Keep messages concise and offer an "opt-out" mechanism like "Reply STOP to cancel".
          </div>
        </div>
      </div>

      {/* Campaign Log Table */}
      <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2">
          <History size={18} className="text-indigo-400" />
          <h3 className="text-base font-bold text-white">Campaign Logs & Scheduled Events</h3>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/30">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Campaign Name</th>
                <th className="px-4 py-3 min-w-[250px]">Message Preview</th>
                <th className="px-4 py-3 w-32">Targets</th>
                <th className="px-4 py-3 w-32">Delivered</th>
                <th className="px-4 py-3 w-36">Scheduled/Sent</th>
                <th className="px-4 py-3 w-32">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Querying campaign log...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">
                    No broadcast campaigns configured yet.
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => (
                  <tr key={camp._id} className="hover:bg-slate-900/35 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">{camp.name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] truncate max-w-[250px]" title={camp.content}>
                      {camp.content}
                    </td>
                    <td className="px-4 py-3">{camp.targets?.length || 0}</td>
                    <td className="px-4 py-3">{camp.deliveredCount ?? 0}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(camp.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(camp.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Broadcast;

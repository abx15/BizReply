import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Check, 
  AlertCircle, 
  CheckCircle,
  TrendingUp,
  Sparkles,
  Calendar
} from 'lucide-react';

interface BillingStatus {
  plan: 'free' | 'starter' | 'pro';
  subscriptionId?: string | null;
  trialEndsAt?: string | null;
  nextBillingDate?: string | null;
  usageStats: {
    outboundMessageCount30Days: number;
  };
}

const Billing: React.FC = () => {
  const { business, updateBusiness } = useAuth();
  
  const [billingInfo, setBillingInfo] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchBillingStatus = async () => {
    try {
      const response = await api.get('/billing/status');
      if (response.data?.success) {
        setBillingInfo(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching billing status:', err);
      showStatus('Failed to load billing status details.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingStatus();
  }, []);

  const showStatus = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 7000);
  };

  // Helper to load Razorpay SDK dynamically
  const loadRazorpaySDK = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (plan: 'starter' | 'pro') => {
    setActionLoading(plan);
    setStatusMessage(null);

    try {
      const response = await api.post('/billing/create-subscription', { plan });
      const { success, data, message } = response.data;

      if (!success) {
        showStatus(message || 'Failed to create subscription.', true);
        return;
      }

      if (data.mock) {
        // Mock success mode
        showStatus(`Mock payment successful! Activated ${plan.toUpperCase()} plan.`);
        // Update user context so sidebar plan badge changes instantly
        updateBusiness({ plan });
        await fetchBillingStatus();
      } else {
        // Live Razorpay payment integration
        const isLoaded = await loadRazorpaySDK();
        if (!isLoaded) {
          showStatus('Razorpay Checkout SDK failed to load. Are you connected to the internet?', true);
          return;
        }

        const options = {
          key: data.keyId,
          subscription_id: data.subscription.id,
          name: 'BizReply SaaS',
          description: `Subscribe to ${plan.toUpperCase()} Plan`,
          image: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=100&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', // placeholder logo
          handler: async () => {
            showStatus('Payment authorized. Processing subscription setup...');
            // In a production server, Razorpay webhook handles state updates,
            // but we fetch status details again to check if updated
            setTimeout(async () => {
              await fetchBillingStatus();
              // Try updating profile locally
              updateBusiness({ plan });
              showStatus('Subscription activated successfully! Enjoy premium features.', false);
            }, 3000);
          },
          prefill: {
            name: business?.name || '',
            email: business?.email || ''
          },
          theme: {
            color: '#6366f1'
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      showStatus(
        err.response?.data?.message || 'Error configuring payment gateway. Check network link.',
        true
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will be downgraded to the Free tier.')) {
      return;
    }

    setActionLoading('cancel');
    try {
      const matchedRes = await api.post('/billing/cancel-subscription');

      if (matchedRes.data?.success) {
        showStatus('Subscription cancelled successfully. Account downgraded to Free plan.');
        updateBusiness({ plan: 'free' });
        await fetchBillingStatus();
      }
    } catch (err: any) {
      console.error('Cancel subscription error:', err);
      showStatus(err.response?.data?.message || 'Failed to request subscription cancellation.', true);
    } finally {
      setActionLoading(null);
    }
  };

  const getLimitDetails = () => {
    switch(billingInfo?.plan) {
      case 'pro':
        return { limit: 100000, displayLimit: '100,000 (Pro Unlimited)' };
      case 'starter':
        return { limit: 1000, displayLimit: '1,000' };
      default:
        return { limit: 100, displayLimit: '100 (Free Trial)' };
    }
  };

  const limits = getLimitDetails();
  const usage = billingInfo?.usageStats?.outboundMessageCount30Days || 0;
  const usagePercent = Math.min(Math.round((usage / limits.limit) * 100), 100);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-400 text-sm">Querying active billing status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Billing & Subscription</h2>
        <p className="text-slate-400 text-sm">Manage your monthly usage limits, plans, and Razorpay checkouts.</p>
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

      {/* Usage Analytics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Usage progress bar */}
        <div className="md:col-span-2 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-400" />
              <h3 className="text-base font-bold text-white">Monthly Message Usage</h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{usage} / {limits.displayLimit} messages</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-900">
            <div 
              style={{ width: `${usagePercent}%` }} 
              className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                usagePercent > 85 ? 'from-rose-600 to-red-500' :
                usagePercent > 60 ? 'from-amber-600 to-amber-500' : 'from-indigo-600 to-violet-500'
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Reset cycle: Rolling 30 days</span>
            <span>{usagePercent}% utilized</span>
          </div>
        </div>

        {/* Current Plan Overview card */}
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Subscription</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white uppercase tracking-tight">
                {billingInfo?.plan || 'free'}
              </span>
              <span className="text-xs text-slate-500">plan tier</span>
            </div>
            
            {billingInfo?.trialEndsAt && billingInfo.plan === 'free' && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1">
                <Calendar size={12} />
                <span>Trial ends: {new Date(billingInfo.trialEndsAt).toLocaleDateString()}</span>
              </p>
            )}

            {billingInfo?.nextBillingDate && billingInfo.subscriptionId && (
              <p className="text-[11px] text-indigo-400 flex items-center gap-1">
                <Calendar size={12} />
                <span>Renewal: {new Date(billingInfo.nextBillingDate).toLocaleDateString()}</span>
              </p>
            )}
          </div>

          {billingInfo?.subscriptionId && (
            <button
              onClick={handleCancelSubscription}
              disabled={actionLoading === 'cancel'}
              className="mt-4 w-full py-2 bg-slate-950 border border-slate-800 hover:border-red-500/40 hover:text-red-400 rounded-xl text-xs font-semibold text-slate-400 cursor-pointer transition-all disabled:opacity-50"
            >
              {actionLoading === 'cancel' ? 'Processing...' : 'Cancel Subscription'}
            </button>
          )}
        </div>
      </div>

      {/* Subscription Pricing Grid */}
      <div className="space-y-4">
        <div className="text-center max-w-md mx-auto space-y-1">
          <h3 className="text-xl font-bold text-white">Compare Plans & Upgrade</h3>
          <p className="text-xs text-slate-400">Scale your automation with higher message limits and premium features.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {/* Plan 1: Free */}
          <div className="bg-slate-900/25 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-white text-base">Free Trial</h4>
                <p className="text-xs text-slate-500 mt-1">Basic test playground</p>
              </div>
              <div className="text-2xl font-extrabold text-white">₹0 <span className="text-xs font-normal text-slate-500">/ forever</span></div>
              
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>100 AI responses / mo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Manual conversations dashboard</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Basic FAQ spreadsheet</span>
                </li>
              </ul>
            </div>
            
            <button 
              disabled={billingInfo?.plan === 'free'}
              className="w-full py-2.5 bg-slate-800 text-slate-400 border border-slate-700/40 rounded-xl text-xs font-bold"
            >
              {billingInfo?.plan === 'free' ? 'Current Plan' : 'Free Tier'}
            </button>
          </div>

          {/* Plan 2: Starter */}
          <div className={`
            bg-slate-900/40 border rounded-2xl p-6 flex flex-col justify-between space-y-6 relative overflow-hidden
            ${billingInfo?.plan === 'starter' ? 'border-indigo-500 shadow-md shadow-indigo-950/20' : 'border-slate-800'}
          `}>
            {billingInfo?.plan === 'starter' && (
              <span className="absolute top-3 right-3 bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider">Active</span>
            )}
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-white text-base">Starter</h4>
                <p className="text-xs text-slate-500 mt-1">Great for growing retail shops</p>
              </div>
              <div className="text-2xl font-extrabold text-white">₹299 <span className="text-xs font-normal text-slate-500">/ month</span></div>
              
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>1,000 AI responses / mo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Excel knowledge base upload</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Auto-saved FAQ table</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSubscribe('starter')}
              disabled={billingInfo?.plan === 'starter' || actionLoading !== null}
              className={`
                w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                ${billingInfo?.plan === 'starter' 
                  ? 'bg-slate-800 text-slate-400 border border-transparent' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/25'}
              `}
            >
              {actionLoading === 'starter' ? 'Opening SDK...' : billingInfo?.plan === 'starter' ? 'Current Plan' : 'Subscribe Starter'}
            </button>
          </div>

          {/* Plan 3: Pro */}
          <div className={`
            bg-slate-900/40 border rounded-2xl p-6 flex flex-col justify-between space-y-6 relative overflow-hidden
            ${billingInfo?.plan === 'pro' ? 'border-violet-500 shadow-md shadow-violet-950/20' : 'border-slate-800 hover:border-slate-700/60'}
          `}>
            <div className="absolute top-3 right-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded shadow-sm">Best Value</div>
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-white text-base">Pro Automation</h4>
                <p className="text-xs text-slate-500 mt-1">Ultimate WhatsApp automation</p>
              </div>
              <div className="text-2xl font-extrabold text-white">₹799 <span className="text-xs font-normal text-slate-500">/ month</span></div>
              
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Unlimited replies / mo</span>
                </li>
                <li className="flex items-center gap-2 text-white font-semibold">
                  <Sparkles size={14} className="text-amber-400 shrink-0 animate-pulse" />
                  <span>Broadcast Campaign Scheduler</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Priority Claude API responses</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-indigo-400 shrink-0" />
                  <span>Dedicated server resources</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSubscribe('pro')}
              disabled={billingInfo?.plan === 'pro' || actionLoading !== null}
              className={`
                w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                ${billingInfo?.plan === 'pro' 
                  ? 'bg-slate-800 text-slate-400 border border-transparent' 
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/30'}
              `}
            >
              {actionLoading === 'pro' ? 'Opening SDK...' : billingInfo?.plan === 'pro' ? 'Current Plan' : 'Subscribe Pro'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Billing;

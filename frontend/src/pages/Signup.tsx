import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Mail, Lock, User, Phone, Sparkles, AlertCircle, ArrowRight, Building } from 'lucide-react';

const Signup: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessType, setBusinessType] = useState('Retail');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/signup', {
        name,
        email,
        phone,
        password,
        businessType // included in submission payload
      });

      const { success, data, message } = response.data;

      if (success && data?.token && data?.business) {
        login(data.token, data.business);
        navigate('/dashboard');
      } else {
        setError(message || 'Failed to register.');
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(
        err.response?.data?.message || 
        'Registration failed. Please check your inputs.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Glow elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative z-10 my-8">
        {/* Header logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-gradient-to-tr from-indigo-500 to-violet-500 p-3 rounded-2xl text-white mb-3 shadow-lg shadow-indigo-500/20">
            <Sparkles size={28} className="animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold text-white text-center tracking-tight mb-1">
            Create your account
          </h2>
          <p className="text-slate-400 text-sm text-center">
            Start automating your customer relations via WhatsApp
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Business Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <User size={18} />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Acme Agency"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Mail size={18} />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="owner@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Phone size={18} />
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="e.g. +919876543210"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Business Type
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Building size={18} />
              </span>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm appearance-none cursor-pointer"
              >
                <option value="Retail">Retail</option>
                <option value="SaaS">SaaS</option>
                <option value="Consulting">Consulting</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Education">Education</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Lock size={18} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/35 hover:shadow-indigo-500/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-sm"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Sign Up</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;

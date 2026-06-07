import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { 
  Search, 
  Send, 
  Bot, 
  AlertCircle, 
  Play, 
  Pause,
  MessageSquare,
  Smartphone
} from 'lucide-react';

interface Conversation {
  _id: string;
  customerPhone: string;
  customerName?: string;
  status: 'active' | 'resolved' | 'needs_attention';
  isAiPaused: boolean;
  lastMessageAt: string;
}

interface Message {
  _id: string;
  conversationId: string;
  businessId: string;
  direction: 'inbound' | 'outbound';
  content: string;
  handledBy: 'ai' | 'owner' | 'system';
  aiConfidence?: number;
  whatsappMsgId?: string;
  createdAt: string;
}

const Conversations: React.FC = () => {
  const { socket } = useSocket();
  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'needs_attention' | 'resolved'>('all');

  // Load state passed from dashboard
  const stateSelectedId = (location.state as any)?.selectedId;

  const fetchConversations = async () => {
    try {
      const response = await api.get('/conversations');
      if (response.data?.success) {
        const list: Conversation[] = response.data.data;
        setConversations(list);
        
        // If selected ID was passed, select it
        if (stateSelectedId) {
          const matched = list.find(c => c._id === stateSelectedId);
          if (matched) {
            handleSelectConversation(matched);
          }
        } else if (list.length > 0 && !activeConv) {
          // Select first by default
          handleSelectConversation(list[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    setLoadingChat(true);
    try {
      const response = await api.get(`/conversations/${convId}/messages`);
      if (response.data?.success) {
        setMessages(response.data.data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [stateSelectedId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket setup
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { conversation: Conversation; message: Message }) => {
      // 1. Update conversations list
      setConversations((prev) => {
        const filtered = prev.filter(c => c._id !== data.conversation._id);
        return [data.conversation, ...filtered];
      });

      // 2. If it's the active conversation, append the message
      if (activeConv && activeConv._id === data.conversation._id) {
        setMessages((prev) => {
          if (prev.some(m => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
        // Sync activeConv details (e.g. status/ai state changes on message)
        setActiveConv(data.conversation);
      }
    };

    const handleStatusChanged = (conv: Conversation) => {
      setConversations((prev) => 
        prev.map(c => c._id === conv._id ? conv : c)
      );
      if (activeConv && activeConv._id === conv._id) {
        setActiveConv(conv);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('newMessage', handleNewMessage);
    socket.on('ai_replied', handleNewMessage);
    socket.on('conversationStatusChanged', handleStatusChanged);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('newMessage', handleNewMessage);
      socket.off('ai_replied', handleNewMessage);
      socket.off('conversationStatusChanged', handleStatusChanged);
    };
  }, [socket, activeConv]);

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConv(conv);
    fetchMessages(conv._id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeConv || sending) return;

    setSending(true);
    const contentToSend = replyText;
    setReplyText('');

    try {
      const response = await api.post(`/conversations/${activeConv._id}/messages`, {
        content: contentToSend
      });
      if (response.data?.success) {
        const loggedMsg = response.data.data;
        setMessages((prev) => [...prev, loggedMsg]);
        // Backend auto-pauses AI and changes status to active. Update local state:
        const updatedConv = { ...activeConv, isAiPaused: true, status: 'active' as const, lastMessageAt: new Date().toISOString() };
        setActiveConv(updatedConv);
        setConversations(prev => 
          prev.map(c => c._id === updatedConv._id ? updatedConv : c).sort((a,b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
        );
      }
    } catch (err) {
      console.error('Failed to send manual reply:', err);
    } finally {
      setSending(false);
    }
  };

  const handleToggleAI = async () => {
    if (!activeConv) return;
    const newState = !activeConv.isAiPaused;

    try {
      const response = await api.put(`/conversations/${activeConv._id}/toggle-ai`, {
        isAiPaused: newState
      });
      if (response.data?.success) {
        const updated = response.data.data;
        setActiveConv(updated);
        setConversations(prev => prev.map(c => c._id === updated._id ? updated : c));
      }
    } catch (err) {
      console.error('Failed to toggle AI status:', err);
    }
  };

  const handleUpdateStatus = async (newStatus: 'active' | 'resolved' | 'needs_attention') => {
    if (!activeConv) return;

    try {
      const response = await api.put(`/conversations/${activeConv._id}/status`, {
        status: newStatus
      });
      if (response.data?.success) {
        const updated = response.data.data;
        setActiveConv(updated);
        setConversations(prev => prev.map(c => c._id === updated._id ? updated : c));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    const nameMatch = (c.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = c.customerPhone.includes(searchTerm);
    const matchesSearch = nameMatch || phoneMatch;

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && c.status === statusFilter;
  });

  return (
    <div className="h-[calc(100vh-160px)] md:h-[calc(100vh-110px)] flex bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      
      {/* LEFT PANE - Conversation List */}
      <div className="w-full md:w-80 flex flex-col border-r border-slate-800 shrink-0 bg-slate-900/60">
        
        {/* Search & Filter header */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1">
            {(['all', 'active', 'needs_attention', 'resolved'] as const).map((stat) => (
              <button
                key={stat}
                onClick={() => setStatusFilter(stat)}
                className={`
                  px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all border
                  ${statusFilter === stat 
                    ? 'bg-indigo-600/15 text-indigo-400 border-indigo-500/35' 
                    : 'bg-slate-950 text-slate-500 border-transparent hover:text-slate-300'}
                `}
              >
                {stat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* List scroll container */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {loadingList ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-500">Querying threads...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="text-slate-700 flex justify-center"><MessageSquare size={32} /></div>
              <p className="text-xs text-slate-500">No chats match criteria.</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = activeConv?._id === conv._id;
              return (
                <div
                  key={conv._id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`
                    p-4 cursor-pointer transition-all border-l-2
                    ${isSelected 
                      ? 'bg-indigo-600/5 border-indigo-500 text-white' 
                      : 'border-transparent text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm truncate max-w-[120px] text-white">
                      {conv.customerName || conv.customerPhone}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 truncate max-w-[150px]">
                      {conv.customerPhone}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {!conv.isAiPaused && (
                        <span title="AI Active"><Bot size={12} className="text-violet-400" /></span>
                      )}
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        conv.status === 'needs_attention' ? 'bg-rose-500 animate-pulse' :
                        conv.status === 'active' ? 'bg-emerald-500' : 'bg-slate-500'
                      }`}></span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANE - Chat Window */}
      <div className="flex-1 flex flex-col bg-slate-950/40">
        {activeConv ? (
          <>
            {/* Header controls */}
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/60">
              <div>
                <h3 className="font-bold text-white text-base">
                  {activeConv.customerName || 'WhatsApp Customer'}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Smartphone size={12} className="text-slate-500" />
                  <span className="text-xs text-slate-400">{activeConv.customerPhone}</span>
                </div>
              </div>

              {/* Control Panel buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* AI Toggle */}
                <button
                  onClick={handleToggleAI}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer
                    ${activeConv.isAiPaused 
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' 
                      : 'bg-violet-600 text-white border-transparent hover:bg-violet-500 shadow-sm shadow-violet-900/30'}
                  `}
                >
                  {activeConv.isAiPaused ? (
                    <>
                      <Play size={12} />
                      <span>Resume AI</span>
                    </>
                  ) : (
                    <>
                      <Pause size={12} />
                      <span>Pause AI</span>
                    </>
                  )}
                </button>

                {/* Status selector */}
                <select
                  value={activeConv.status}
                  onChange={(e) => handleUpdateStatus(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="needs_attention">Needs Attention</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* Chat Messages scroll area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingChat ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isInbound = msg.direction === 'inbound';
                  return (
                    <div 
                      key={msg._id} 
                      className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                    >
                      <div className="max-w-[70%] space-y-1">
                        {/* Bubble */}
                        <div className={`
                          px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                          ${isInbound 
                            ? 'bg-slate-800/80 text-slate-100 rounded-tl-none border border-slate-700/30' 
                            : 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-950/20'}
                        `}>
                          {msg.content}
                        </div>

                        {/* Handled by Badge & Date */}
                        <div className="flex items-center gap-2 px-1 text-[10px] text-slate-500">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {!isInbound && (
                            <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded uppercase tracking-wider font-extrabold text-[8px] border ${
                              msg.handledBy === 'ai' 
                                ? 'bg-violet-950/50 text-violet-400 border-violet-850' 
                                : 'bg-amber-950/50 text-amber-400 border-amber-850'
                            }`}>
                              {msg.handledBy === 'ai' ? `AI (${Math.round((msg.aiConfidence || 0.8)*100)}%)` : 'Owner'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900/40">
              {activeConv.isAiPaused ? (
                <div className="mb-2 text-[10.5px] text-amber-400/80 bg-amber-500/5 px-3 py-1.5 border border-amber-500/10 rounded-lg flex items-center gap-1.5">
                  <AlertCircle size={12} className="shrink-0" />
                  <span>AI assistant is paused. Sending this reply will keep the AI paused until you hit "Resume AI".</span>
                </div>
              ) : (
                <div className="mb-2 text-[10.5px] text-slate-500 bg-slate-800/5 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Bot size={12} className="shrink-0 text-violet-400" />
                  <span>AI assistant is active. Sending a manual reply will automatically pause the AI in this chat.</span>
                </div>
              )}
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a manual WhatsApp message..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sending}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-3 rounded-xl transition-all shadow-md shadow-indigo-950/30 flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center p-8">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800/60 text-slate-600">
              <MessageSquare size={36} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">No chat selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Select an active customer thread from the sidebar to view full message history, control AI response filters, and send manual overrides.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default Conversations;

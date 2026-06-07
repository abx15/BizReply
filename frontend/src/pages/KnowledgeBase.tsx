import React, { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Database, 
  Upload, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Sparkles, 
  Download,
  Info,
  CheckCircle
} from 'lucide-react';

interface KnowledgeItem {
  _id: string;
  type: 'service' | 'product' | 'faq' | 'policy';
  name: string;
  price?: number;
  duration?: string;
  notes?: string;
}

const KnowledgeBase: React.FC = () => {
  const { business } = useAuth();
  
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchItems = async () => {
    try {
      const response = await api.get('/knowledge');
      if (response.data?.success) {
        setItems(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching knowledge items:', err);
      showStatus('Failed to load knowledge items.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const showStatus = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Dropzone file handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('file', file);
    
    setUploading(true);
    showStatus('Uploading and parsing Excel file...');

    try {
      const response = await api.post('/knowledge/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data?.success) {
        showStatus(response.data.message || 'Successfully uploaded database!');
        setItems(response.data.data.items || []);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      showStatus(err.response?.data?.message || 'Failed to process Excel file.', true);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  // Spread Sheet Action: Add row
  const handleAddRow = async () => {
    try {
      const defaultItem = {
        type: 'faq' as const,
        name: 'New Question/Item',
        notes: 'Provide description or reply here'
      };

      const response = await api.post('/knowledge', defaultItem);
      if (response.data?.success) {
        setItems((prev) => [response.data.data, ...prev]);
        showStatus('New row added successfully.');
      }
    } catch (err: any) {
      console.error('Failed to create row:', err);
      showStatus(err.response?.data?.message || 'Failed to create new item.', true);
    }
  };

  // Spread Sheet Action: Update row on blur
  const handleUpdateRow = async (id: string, updatedFields: Partial<KnowledgeItem>) => {
    try {
      const response = await api.put(`/knowledge/${id}`, updatedFields);
      if (response.data?.success) {
        setItems((prev) => 
          prev.map((item) => item._id === id ? response.data.data : item)
        );
      }
    } catch (err) {
      console.error('Failed to update knowledge item:', err);
      showStatus('Failed to save cell change.', true);
    }
  };

  // Spread Sheet Action: Delete row
  const handleDeleteRow = async (id: string) => {
    try {
      const response = await api.delete(`/knowledge/${id}`);
      if (response.data?.success) {
        setItems((prev) => prev.filter((item) => item._id !== id));
        showStatus('Row deleted successfully.');
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
      showStatus('Failed to delete item.', true);
    }
  };

  // Generate prompt preview string
  const getPromptPreview = () => {
    const bizName = business?.name || 'Your Business';
    const sampleItems = items.slice(0, 3).map(i => {
      let desc = `${i.type.toUpperCase()}: ${i.name}`;
      if (i.price) desc += ` - Price: ₹${i.price}`;
      if (i.duration) desc += ` (${i.duration})`;
      if (i.notes) desc += `. Details: ${i.notes}`;
      return desc;
    }).join('\n');

    const suffix = items.length > 3 ? `\n...and ${items.length - 3} other knowledge details.` : '';
    
    return `Tu ${bizName} ka WhatsApp assistant hai. Sirf inhi services/products/FAQs ka jawab de:\n${sampleItems || '(None loaded yet. Upload spreadsheet to configure)'}${suffix}\n\nHindi/Hinglish mein short, responsive jawab de. Agar kuch pata nahi toh bol — owner se confirm karo.`;
  };

  return (
    <div className="space-y-8">
      {/* Title block */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">AI Knowledge Base</h2>
        <p className="text-slate-400 text-sm">Upload Excel spreadsheets or write custom FAQs to context-feed your AI responses.</p>
      </div>

      {/* Grid: Excel Upload & System Prompt Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Zone Card */}
        <div className="lg:col-span-1 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Upload size={18} className="text-indigo-400" />
              <h3 className="text-base font-bold text-white">Import Database</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload your Excel list of services, prices, durations, FAQs, and policies. Uploading a new sheet replaces all current listings.
            </p>

            {/* Drag and Drop Zone */}
            <div 
              {...getRootProps()} 
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                ${isDragActive 
                  ? 'border-indigo-500 bg-indigo-500/5' 
                  : 'border-slate-800 hover:border-slate-700/80 bg-slate-950/40'}
              `}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div className="space-y-3">
                  <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-400">Parsing xlsx matrix...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-slate-900/80 w-10 h-10 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Upload size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-300">
                      {isDragActive ? 'Drop the file here' : 'Drag & drop Excel file'}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">Accepts .xlsx or .xls files</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Info size={12} className="text-indigo-400" />
              <span>Max sheet rows: 1,000</span>
            </span>
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                showStatus('Template downloaded (Simulated). Columns: Type, Name, Price, Duration, Notes');
              }}
              className="text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              <Download size={12} />
              <span>Sample Template</span>
            </a>
          </div>
        </div>

        {/* AI Prompt Preview Card */}
        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-violet-400" />
              <h3 className="text-base font-bold text-white">System Prompt Preview</h3>
            </div>
            <span className="text-[10px] uppercase font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">Claude 3.5 Sonnet</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Here is the live instruction prompt built from your profile and knowledge base that will be sent to Anthropic's Claude API to answer WhatsApp customer inquiries:
          </p>
          <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-xl font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap max-h-[140px] overflow-y-auto">
            {getPromptPreview()}
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
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

      {/* Spreadsheet Editing Grid */}
      <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-indigo-400" />
            <h3 className="text-base font-bold text-white">Knowledge Base spreadsheet ({items.length} records)</h3>
          </div>
          
          <button 
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Row</span>
          </button>
        </div>

        {/* Excel Table Layout */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/30">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 w-36">Type</th>
                <th className="px-4 py-3 min-w-[200px]">Name / Question</th>
                <th className="px-4 py-3 w-28">Price (₹)</th>
                <th className="px-4 py-3 w-36">Duration</th>
                <th className="px-4 py-3 min-w-[200px]">Notes / Response Description</th>
                <th className="px-4 py-3 w-16 text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Querying records...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No records found. Upload an Excel file or click 'Add Row' to start building.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-900/35 transition-colors">
                    
                    {/* Type Select */}
                    <td className="px-3 py-2">
                      <select
                        value={item.type}
                        onChange={(e) => handleUpdateRow(item._id, { type: e.target.value as any })}
                        className="bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-lg text-slate-300 px-2 py-1.5 w-full focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="service">Service</option>
                        <option value="product">Product</option>
                        <option value="faq">FAQ</option>
                        <option value="policy">Policy</option>
                      </select>
                    </td>

                    {/* Name Input */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        defaultValue={item.name}
                        onBlur={(e) => {
                          if (e.target.value !== item.name) {
                            handleUpdateRow(item._id, { name: e.target.value });
                          }
                        }}
                        className="bg-slate-950 border border-slate-855 focus:border-indigo-500 rounded-lg text-slate-200 px-3 py-1.5 w-full focus:outline-none"
                      />
                    </td>

                    {/* Price Input */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        defaultValue={item.price ?? ''}
                        placeholder="N/A"
                        onBlur={(e) => {
                          const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                          if (val !== item.price) {
                            handleUpdateRow(item._id, { price: val });
                          }
                        }}
                        className="bg-slate-950 border border-slate-855 focus:border-indigo-500 rounded-lg text-slate-200 px-3 py-1.5 w-full focus:outline-none"
                      />
                    </td>

                    {/* Duration Input */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        defaultValue={item.duration || ''}
                        placeholder="e.g. 1 hour"
                        onBlur={(e) => {
                          if (e.target.value !== (item.duration || '')) {
                            handleUpdateRow(item._id, { duration: e.target.value });
                          }
                        }}
                        className="bg-slate-950 border border-slate-855 focus:border-indigo-500 rounded-lg text-slate-200 px-3 py-1.5 w-full focus:outline-none"
                      />
                    </td>

                    {/* Notes Input */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        defaultValue={item.notes || ''}
                        placeholder="e.g. FAQ Answer details"
                        onBlur={(e) => {
                          if (e.target.value !== (item.notes || '')) {
                            handleUpdateRow(item._id, { notes: e.target.value });
                          }
                        }}
                        className="bg-slate-950 border border-slate-855 focus:border-indigo-500 rounded-lg text-slate-200 px-3 py-1.5 w-full focus:outline-none"
                      />
                    </td>

                    {/* Delete action */}
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleDeleteRow(item._id)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer mx-auto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-slate-500 italic mt-2">
          Spreadsheet rows auto-save locally to your AI database on field blur. Double check inputs before confirming.
        </p>
      </div>

    </div>
  );
};

export default KnowledgeBase;

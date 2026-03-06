import React, { useState, useEffect, useRef } from 'react';
import { productionLogService } from '../services/supabase';
import { ProductionLog } from '../types';
import { Layers, CheckCircle, XCircle, RefreshCw, AlertCircle, Clock, Calendar, Database, ListChecks, Search, ArrowRight, Package, Archive, XSquare, History, Trash2 } from 'lucide-react';

export const ProductionApproval: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'DECLINED' | 'STATUS_LOG'>('PENDING');
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Use ref to track if we should skip updates
  const isProcessingRef = useRef(false);

  const loadData = async () => {
    if (isProcessingRef.current) return;
    setLoading(true);
    try {
        let data: ProductionLog[] = [];
        if (activeTab === 'PENDING') {
            data = await productionLogService.getPending();
        } else if (activeTab === 'APPROVED') {
            data = await productionLogService.getByStatus('APPROVED');
        } else if (activeTab === 'DECLINED') {
            data = await productionLogService.getByStatus('DECLINED');
        } else if (activeTab === 'STATUS_LOG') {
            data = await productionLogService.getHistory();
        }
        setLogs(data);
    } catch (e) {
      console.error("Failed to load logs", e);
    } finally {
      setLoading(false);
    }
  };

  // --- POLLING ---
  useEffect(() => {
    loadData();
    let intervalId: any;
    
    // Poll active tab
    intervalId = setInterval(() => {
        loadData();
    }, 3000); 

    return () => {
        if (intervalId) clearInterval(intervalId);
    };
  }, [activeTab]);

  const handleApprove = async (log: ProductionLog) => {
    if (!window.confirm(`Approve +${log.qty} ${log.product_name}?\nThis will update the Stock Inventory.`)) return;
    
    setProcessingId(log.id);
    isProcessingRef.current = true; // PAUSE POLLING

    try {
        await productionLogService.approveEntry(log);
        // Optimistic update
        setLogs(prev => prev.filter(p => p.id !== log.id));
        
        // Wait a bit before resuming polling
        setTimeout(() => {
            isProcessingRef.current = false;
            loadData(); 
        }, 500);

    } catch (e: any) {
        isProcessingRef.current = false;
        alert(`Failed: ${e.message}`);
    } finally {
        setProcessingId(null);
    }
  };

  const handleDecline = async (log: ProductionLog) => {
    if(!window.confirm(`Decline ${log.product_name}?`)) return;
    
    setProcessingId(log.id);
    isProcessingRef.current = true;

    try {
        await productionLogService.declineEntry(log.id);
        setLogs(prev => prev.filter(p => p.id !== log.id));
        
        setTimeout(() => {
            isProcessingRef.current = false;
            loadData();
        }, 500);

    } catch (e: any) {
        isProcessingRef.current = false;
        alert(`Failed: ${e.message}`);
    } finally {
        setProcessingId(null);
    }
  };

  const handleDelete = async (log: ProductionLog) => {
    if(!window.confirm(`Permanently DELETE this entry for ${log.product_name}? This cannot be undone.`)) return;
    
    setProcessingId(log.id);
    isProcessingRef.current = true;

    try {
        await productionLogService.deleteEntry(log.id);
        setLogs(prev => prev.filter(p => p.id !== log.id));
        
        setTimeout(() => {
            isProcessingRef.current = false;
            loadData();
        }, 500);

    } catch (e: any) {
        isProcessingRef.current = false;
        alert(`Failed: ${e.message}`);
    } finally {
        setProcessingId(null);
    }
  };

  const filteredLogs = logs.filter(l => 
    l.product_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (l.user_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 h-full flex flex-col">
       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Database className="text-sky-500" /> Production Database
                </h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">
                    Approvals & Stock Sync (Server)
                </p>
            </div>
            
            {/* TABS */}
            <div className="flex flex-wrap bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                <button 
                  onClick={() => { setActiveTab('PENDING'); setSearchTerm(''); }}
                  className={`px-4 py-2.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'PENDING' ? 'bg-white text-orange-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <ListChecks size={16} /> 
                    PENDING
                    {activeTab === 'PENDING' && logs.length > 0 && (
                        <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[10px] min-w-[18px] text-center">{logs.length}</span>
                    )}
                </button>
                <button 
                  onClick={() => { setActiveTab('APPROVED'); setSearchTerm(''); }}
                  className={`px-4 py-2.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'APPROVED' ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <CheckCircle size={16} /> APPROVED
                </button>
                <button 
                  onClick={() => { setActiveTab('DECLINED'); setSearchTerm(''); }}
                  className={`px-4 py-2.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'DECLINED' ? 'bg-white text-red-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <XSquare size={16} /> DECLINED
                </button>
                {/* NEW TAB */}
                <button 
                  onClick={() => { setActiveTab('STATUS_LOG'); setSearchTerm(''); }}
                  className={`px-4 py-2.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'STATUS_LOG' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <History size={16} /> PRODUCTION STATUS
                </button>
            </div>
       </div>

       {/* Toolbar & Stats */}
       <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
           {/* Search Bar */}
           <div className="md:col-span-8 flex items-center bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                <Search size={18} className="ml-2 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search by Product, Staff or Shift..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-3 pr-3 py-2 w-full text-sm border-none bg-transparent outline-none font-bold text-gray-700 placeholder-gray-300"
                />
                <button 
                    onClick={() => { isProcessingRef.current = false; loadData(); }}
                    className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sky-600 transition"
                    title="Force Refresh"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
           </div>

           {/* Context Stat */}
           <div className={`md:col-span-4 border rounded-xl p-3 flex items-center justify-between px-5 ${activeTab === 'PENDING' ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
               <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeTab === 'PENDING' ? 'bg-orange-100 text-orange-600' : 'bg-white text-gray-400'}`}>
                       <Package size={20} />
                   </div>
                   <div>
                       <span className={`block text-[10px] font-bold uppercase tracking-wider ${activeTab === 'PENDING' ? 'text-orange-400' : 'text-gray-400'}`}>
                           {activeTab === 'PENDING' ? 'Pending Qty' : 'Records Shown'}
                       </span>
                       <span className={`block text-xl font-black leading-none ${activeTab === 'PENDING' ? 'text-orange-900' : 'text-gray-700'}`}>
                           {activeTab === 'PENDING' 
                             ? logs.reduce((acc, l) => acc + Number(l.qty), 0)
                             : filteredLogs.length
                           }
                       </span>
                   </div>
               </div>
           </div>
       </div>

       {/* TABLE */}
       <div className="flex-1 bg-white rounded-xl shadow-sm border border-sky-100 overflow-hidden flex flex-col">
           <div className="overflow-auto flex-1">
               <table className="w-full text-left border-collapse">
                   <thead className="bg-sky-50 sticky top-0 z-10 shadow-sm">
                       <tr className="text-[10px] uppercase text-sky-800 font-extrabold tracking-wider">
                           <th className="p-4 w-32">Date Log</th>
                           <th className="p-4 w-24">Shift</th>
                           <th className="p-4">Product Name</th>
                           <th className="p-4 text-right w-24">Input Qty</th>
                           <th className="p-4 w-32">Staff</th>
                           <th className="p-4 text-center w-32">Status</th>
                           {/* Allow Action on Pending and Declined tabs to enable cleaning up */}
                           {(activeTab === 'PENDING' || activeTab === 'DECLINED') && <th className="p-4 text-center w-40">Action</th>}
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50 text-sm">
                       {loading && logs.length === 0 ? (
                           <tr><td colSpan={7} className="p-12 text-center text-gray-400 font-medium">Loading server data...</td></tr>
                       ) : filteredLogs.length === 0 ? (
                           <tr>
                               <td colSpan={7} className="p-12 text-center text-gray-300 flex flex-col items-center justify-center gap-3">
                                   <Database size={48} className="opacity-20"/>
                                   <span className="font-bold">No records found in this view.</span>
                               </td>
                           </tr>
                       ) : (
                           filteredLogs.map(log => {
                               const isProcessing = processingId === log.id;
                               const isPending = log.status === 'PENDING';
                               const isApproved = log.status === 'APPROVED';
                               const isDeclined = log.status === 'DECLINED';
                               
                               return (
                                   <tr key={log.id} className={`group hover:bg-sky-50/30 transition-all ${isProcessing ? 'opacity-50' : ''} ${isPending ? 'bg-orange-50/30' : ''}`}>
                                       <td className="p-4">
                                           <div className="font-bold text-gray-700 text-xs">{log.date}</div>
                                           <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                                               <Clock size={10}/> {log.time}
                                           </div>
                                       </td>
                                       <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide border ${
                                                log.shift === 'Day' 
                                                ? 'bg-amber-50 text-amber-600 border-amber-100' 
                                                : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                            }`}>
                                                {log.shift}
                                            </span>
                                       </td>
                                       <td className="p-4 font-bold text-gray-800">
                                           {log.product_name}
                                       </td>
                                       <td className="p-4 text-right">
                                           <span className={`font-mono font-black text-lg ${isDeclined ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                               +{log.qty}
                                           </span>
                                       </td>
                                       <td className="p-4 text-xs font-medium text-gray-500">
                                           <div className="flex items-center gap-1.5">
                                               <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-600">
                                                   {log.user_name ? log.user_name.substring(0,1) : 'S'}
                                               </div>
                                               {log.user_name || 'Staff'}
                                           </div>
                                       </td>
                                       <td className="p-4 text-center">
                                            {isApproved && (
                                                <div className="flex flex-col items-center">
                                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center justify-center gap-1 border border-green-200">
                                                        <CheckCircle size={10} /> Approved
                                                    </span>
                                                    <span className="text-[8px] font-bold text-green-600 mt-0.5">STOCK ADDED</span>
                                                </div>
                                            )}
                                            {isDeclined && (
                                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center justify-center gap-1 border border-red-200">
                                                    <XCircle size={10} /> Declined
                                                </span>
                                            )}
                                            {isPending && (
                                                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center justify-center gap-1 border border-orange-200 animate-pulse">
                                                    <AlertCircle size={10} /> Pending
                                                </span>
                                            )}
                                       </td>
                                       
                                       {/* PENDING TAB ACTIONS */}
                                       {activeTab === 'PENDING' && (
                                           <td className="p-4 text-center">
                                               <div className="flex items-center justify-center gap-2 opacity-100 transition-opacity">
                                                   <button 
                                                     onClick={() => handleApprove(log)}
                                                     disabled={isProcessing}
                                                     className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm shadow-green-200 transition active:scale-95"
                                                     title="Add to Stock"
                                                   >
                                                       <CheckCircle size={14} /> Add
                                                   </button>
                                                   <button 
                                                     onClick={() => handleDecline(log)}
                                                     disabled={isProcessing}
                                                     className="p-1.5 bg-white text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition active:scale-95"
                                                     title="Reject"
                                                   >
                                                       <XCircle size={16} />
                                                   </button>
                                                   <button 
                                                     onClick={() => handleDelete(log)}
                                                     disabled={isProcessing}
                                                     className="p-1.5 bg-gray-50 text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-red-600 transition active:scale-95"
                                                     title="Delete Permanently"
                                                   >
                                                       <Trash2 size={16} />
                                                   </button>
                                               </div>
                                           </td>
                                       )}

                                       {/* DECLINED TAB ACTIONS (Cleanup) */}
                                       {activeTab === 'DECLINED' && (
                                           <td className="p-4 text-center">
                                               <div className="flex items-center justify-center gap-2 opacity-100 transition-opacity">
                                                   <button 
                                                     onClick={() => handleDelete(log)}
                                                     disabled={isProcessing}
                                                     className="flex items-center gap-1 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95"
                                                     title="Delete Permanently"
                                                   >
                                                       <Trash2 size={14} /> Remove
                                                   </button>
                                               </div>
                                           </td>
                                       )}
                                   </tr>
                               );
                           })
                       )}
                   </tbody>
               </table>
           </div>
       </div>
    </div>
  );
};
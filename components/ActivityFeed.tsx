
import React, { useState, useEffect } from 'react';
import { auditService } from '../services/supabase';
import { ActivityLog } from '../types';
import { Bell, Truck, Package, RefreshCw, Clock, CheckCircle, AlertTriangle, User, Info, FileText, ArrowRight, Activity, Filter, X, Calendar, Hash, Tag, Globe } from 'lucide-react';

export const ActivityFeed: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ORDER' | 'STOCK' | 'SYSTEM'>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // State for Detail View Modal
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
        let data;
        if (selectedDate) {
            data = await auditService.getLogsByDate(selectedDate);
        } else {
            data = await auditService.getRecentLogs(100);
        }
        setLogs(data);
    } catch (e) {
        console.error(e);
    } finally {
        if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(() => loadLogs(true), 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [selectedDate]);

  const getIcon = (type: string, description: string) => {
      if (type === 'ORDER') {
          if (description.includes('DELIVERED')) return <CheckCircle className="text-white" size={14} />;
          if (description.includes('OUT_FOR_DELIVERY')) return <Truck className="text-white" size={14} />;
          if (description.includes('CANCELLED')) return <AlertTriangle className="text-white" size={14} />;
          if (description.includes('CREATED') || description.includes('New Order')) return <FileText className="text-white" size={14} />;
          return <Activity className="text-white" size={14} />;
      }
      if (type === 'STOCK') return <Package className="text-white" size={14} />;
      if (type === 'SYSTEM') return <Info className="text-white" size={14} />;
      if (type === 'USER') return <User className="text-white" size={14} />;
      return <Bell className="text-white" size={14} />;
  };

  const getColor = (type: string, description: string) => {
      if (type === 'ORDER') {
          if (description.includes('DELIVERED')) return 'bg-green-500';
          if (description.includes('OUT_FOR_DELIVERY')) return 'bg-sky-500';
          if (description.includes('CANCELLED')) return 'bg-red-500';
          if (description.includes('LOADING')) return 'bg-yellow-500';
          return 'bg-blue-500';
      }
      if (type === 'STOCK') return 'bg-amber-500';
      if (type === 'SYSTEM') return 'bg-slate-500';
      return 'bg-purple-500';
  };

  const formatTime = (isoString: string) => {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const formatFullDate = (isoString: string) => {
      return new Date(isoString).toLocaleString([], { dateStyle: 'full', timeStyle: 'medium' });
  };

  const formatDateGroup = (isoString: string) => {
      const date = new Date(isoString);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) return 'Today';
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

      return date.toLocaleDateString();
  };

  // Render smart content based on log description
  const renderContent = (log: ActivityLog) => {
      // 1. Status Change: "Order 4100 status changed to OUT_FOR_DELIVERY"
      if (log.description.includes('status changed to')) {
          const parts = log.description.split(' status changed to ');
          const subject = parts[0];
          const newStatus = parts[1];
          return (
              <div>
                  <span className="font-bold text-slate-700">{subject}</span>
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">Moved to</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full text-white ${
                          newStatus === 'DELIVERED' ? 'bg-green-500' :
                          newStatus === 'OUT_FOR_DELIVERY' ? 'bg-sky-500' :
                          newStatus === 'CANCELLED' ? 'bg-red-500' :
                          newStatus === 'LOADING' ? 'bg-yellow-500' : 'bg-gray-500'
                      }`}>
                          {newStatus.replace(/_/g, ' ')}
                      </span>
                  </div>
              </div>
          );
      }
      
      // 2. Creation: "New Order Created: 4100"
      if (log.description.includes('New Order Created:')) {
          return (
              <div>
                  <span className="text-gray-500 text-xs">New Order Generated</span>
                  <div className="font-black text-slate-800 text-sm mt-0.5">
                      {log.description.split(': ')[1] || log.description}
                  </div>
              </div>
          );
      }

      // 3. Production Input
      if (log.description.includes('Production Input:')) {
         return (
             <div>
                 <span className="text-amber-600 text-[10px] font-black uppercase tracking-wide">Production Entry</span>
                 <div className="font-bold text-slate-800 text-sm mt-0.5">
                     {log.description.replace('Production Input: ', '')}
                 </div>
             </div>
         );
      }

      // Default
      return <span className="font-bold text-slate-700 text-sm">{log.description}</span>;
  };

  const filteredLogs = logs.filter(l => {
      // 1. Apply Type Filter
      if (filter !== 'ALL' && l.entity_type !== filter) return false;

      // 2. EXCLUDE "Added item" logs (User Request)
      if (l.description.includes('Added item:')) return false;

      return true;
  });

  // Group logs by date
  const groupedLogs: Record<string, ActivityLog[]> = {};
  filteredLogs.forEach(log => {
      const dateKey = formatDateGroup(log.created_at);
      if (!groupedLogs[dateKey]) groupedLogs[dateKey] = [];
      groupedLogs[dateKey].push(log);
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-black text-slate-800 flex items-center gap-2 text-lg">
                        <Bell className="text-sky-600" size={20}/> Activity Center
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wide">System Audit Trail & Live Updates</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                        <Calendar size={14} className="text-slate-400" />
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="text-xs font-bold text-slate-600 outline-none bg-transparent w-24"
                        />
                        {selectedDate && (
                            <button onClick={() => setSelectedDate('')} className="text-slate-400 hover:text-red-500">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <button onClick={() => loadLogs()} className="p-2 hover:bg-white rounded-full text-slate-400 transition shadow-sm border border-transparent hover:border-slate-200">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>
            
            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {[
                    { label: 'ALL', val: 'ALL' },
                    { label: 'ORDER', val: 'ORDER' },
                    { label: 'PRODUCTION', val: 'STOCK' },
                    { label: 'SYSTEM', val: 'SYSTEM' }
                ].map((f) => (
                    <button
                        key={f.label}
                        onClick={() => setFilter(f.val as any)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${
                            filter === f.val 
                            ? 'bg-sky-600 text-white border-sky-600 shadow-sm' 
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Timeline Feed */}
        <div className="flex-1 overflow-y-auto p-4 bg-white relative">
            {Object.keys(groupedLogs).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <Activity size={32} className="opacity-20" />
                    </div>
                    <span className="font-bold text-xs">No activity found</span>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.keys(groupedLogs).map(dateLabel => (
                        <div key={dateLabel}>
                            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm py-2 mb-2 border-b border-dashed border-slate-100">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50 px-2 py-1 rounded-md">
                                    {dateLabel}
                                </span>
                            </div>
                            
                            <div className="relative space-y-0">
                                {/* Vertical Line */}
                                <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100 -z-0"></div>

                                {groupedLogs[dateLabel].map((log) => (
                                    <div 
                                        key={log.id} 
                                        onClick={() => setSelectedLog(log)}
                                        className="relative pl-12 py-3 group hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                        {/* Icon Dot */}
                                        <div className={`absolute left-2 top-3.5 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border-2 border-white z-10 transition-transform group-hover:scale-110 ${getColor(log.entity_type, log.description)}`}>
                                            {getIcon(log.entity_type, log.description)}
                                        </div>

                                        <div className="flex justify-between items-start pr-2">
                                            <div className="flex-1">
                                                {renderContent(log)}
                                                
                                                {/* Meta Info */}
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    {log.performed_by && (
                                                        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                                            <User size={10} className="text-slate-400"/> {log.performed_by}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-mono text-gray-400">
                                                        {log.entity_type}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1 bg-white border border-gray-100 px-2 py-1 rounded-lg shadow-sm group-hover:border-sky-200 group-hover:text-sky-600 transition">
                                                <Clock size={10} /> {formatTime(log.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* --- DETAILS MODAL --- */}
        {selectedLog && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div 
                    className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={`p-6 text-white ${getColor(selectedLog.entity_type, selectedLog.description)}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                                {getIcon(selectedLog.entity_type, selectedLog.description)}
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="text-white/70 hover:text-white transition bg-white/10 rounded-full p-1.5">
                                <X size={20} />
                            </button>
                        </div>
                        <h3 className="font-black text-lg leading-tight mb-1">{selectedLog.description}</h3>
                        <p className="text-white/80 text-xs font-bold uppercase tracking-wide">{selectedLog.action_type}</p>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto">
                        
                        {/* Primary Details Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1">
                                    <Clock size={10} /> Time
                                </span>
                                <div className="text-xs font-bold text-slate-800 break-words">
                                    {formatFullDate(selectedLog.created_at)}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1">
                                    <User size={10} /> Performed By
                                </span>
                                <div className="text-xs font-bold text-slate-800">
                                    {selectedLog.performed_by || 'System'}
                                </div>
                            </div>
                        </div>

                        {/* Entity Info */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1">
                                    <Tag size={10} /> Entity Type
                                </span>
                                <div className="text-sm font-bold text-slate-800">{selectedLog.entity_type}</div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase flex items-center justify-end gap-1 mb-1">
                                    <Hash size={10} /> ID / Ref
                                </span>
                                <div className="text-sm font-mono font-bold text-slate-800">{selectedLog.entity_id || '-'}</div>
                            </div>
                        </div>

                        {/* Extended Details */}
                        {selectedLog.details && (
                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                <span className="text-[10px] font-black text-yellow-600 uppercase flex items-center gap-1 mb-2">
                                    <FileText size={10} /> Additional Details
                                </span>
                                <p className="text-xs text-yellow-900 font-medium leading-relaxed">
                                    {selectedLog.details}
                                </p>
                            </div>
                        )}

                        <div className="pt-2 text-center">
                            <span className="text-[9px] text-slate-300 font-mono">Log ID: {selectedLog.id}</span>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                        <button onClick={() => setSelectedLog(null)} className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition text-sm">
                            Close Details
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

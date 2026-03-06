
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { productService, productionLogService, productionConfigService } from '../services/supabase';
import { Product, ProductionLog } from '../types';
import { Sun, Moon, Plus, Clock, RefreshCw, Layers, Check, LogOut, Lock, AlertCircle, CheckCircle, ChevronRight, Hourglass, XCircle, ShoppingBag } from 'lucide-react';

interface ProductionEntryProps {
  user: User;
  onLogout: () => void;
  onNotification?: (msg: string, type: 'success' | 'info') => void;
  onOpenOrder?: () => void;
}

// Utility for Local Date String (YYYY-MM-DD)
const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const ProductionEntry: React.FC<ProductionEntryProps> = ({ user, onLogout, onNotification, onOpenOrder }) => {
  const [shift, setShift] = useState<'Day' | 'Night'>('Day');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  
  // Lock State
  const [isLocked, setIsLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);
  
  // Use Local Date
  const currentDate = getLocalToday();

  useEffect(() => {
    const loadProducts = async () => {
        const prods = await productService.getAll();
        
        // CUSTOM SORTING LOGIC
        const priority = [
            "WATER", 
            "MANGO", 
            "COLA JEERA", 
            "COLA", 
            "CL", 
            "JEERA", 
            "APP", 
            "STRONG", 
            "BISTER", 
            "KIDS", 
            "IT"
        ];

        prods.sort((a, b) => {
            const nameA = a.product_name.toUpperCase();
            const nameB = b.product_name.toUpperCase();

            const indexA = priority.findIndex(p => nameA.includes(p));
            const indexB = priority.findIndex(p => nameB.includes(p));

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return nameA.localeCompare(nameB);
        });

        setProducts(prods);
    };
    loadProducts();
    
    checkStatusAndLogs();

    // Auto Refresh every 2 seconds to check Lock Status & Logs
    const intervalId = setInterval(() => {
        checkStatusAndLogs();
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  const checkStatusAndLogs = async () => {
    try {
        // 1. Check Lock Status from dedicated table
        const isActive = await productionConfigService.get();
        setIsLocked(!isActive); // Locked if NOT active
        setCheckingLock(false);

        // 2. Load Logs
        const data = await productionLogService.getByDate(currentDate);
        setLogs(data);
    } catch (e) {
        console.error("Failed to sync", e);
    }
  };

  const handleSubmit = async () => {
    if (isLocked) return;
    if (!selectedProductId || !qty) return;
    
    setLoading(true);
    
    try {
      const productName = products.find(p => p.id === selectedProductId)?.product_name || 'Unknown';
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      // Direct Add (Service now defaults to PENDING)
      await productionLogService.add({
        date: currentDate,
        time: currentTime,
        product_id: selectedProductId,
        product_name: productName,
        qty: parseFloat(qty),
        shift: shift,
        user_name: user.name
      });

      setQty('');
      // alert("Production Sent for Approval!");
      if(onNotification) onNotification("Production Sent for Approval!", 'success');
      
      setTimeout(() => checkStatusAndLogs(), 500); 

    } catch (e: any) {
      console.error(e);
      if(onNotification) onNotification(`FAILED: ${e.message}`, 'info');
      else alert(`FAILED: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- LOCKED SCREEN ---
  if (!checkingLock && isLocked) {
      return (
        <div className="flex flex-col h-full bg-slate-50 font-sans">
            <div className="bg-white px-4 py-3 border-b border-slate-100 flex justify-between items-center sticky top-0 z-20">
                <h1 className="font-black text-slate-800 text-base">Production</h1>
                <button onClick={onLogout} className="text-slate-400"><LogOut size={18}/></button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <Lock size={40} className="text-red-400" />
                </div>
                <h2 className="text-xl font-black text-slate-800 mb-2">Entry Disabled</h2>
                <p className="text-xs text-slate-500 font-medium max-w-xs">
                    Production entry is currently locked by the Administrator. Please try again later.
                </p>
                <div className="mt-8 p-4 bg-white rounded-xl border border-slate-100 w-full shadow-sm">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Today's History</h3>
                    <div className="text-xl font-black text-slate-800">{logs.length} Entries</div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans">
      
      {/* --- Header (Compact) --- */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 flex justify-between items-center sticky top-0 z-20">
         <div>
             <div className="flex items-center gap-2 mb-0.5">
                <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center">
                    <Layers className="text-indigo-500" size={14} />
                </div>
                <h1 className="font-black text-slate-800 text-base tracking-tight">Production Input</h1>
             </div>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                 {new Date().toDateString()}
             </p>
         </div>
         <button onClick={onLogout} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition border border-slate-200">
             <LogOut size={14} />
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 pb-24">
         
         {/* --- QUICK ACTION: PLACE ORDER (New) --- */}
         {onOpenOrder && (
             <div 
                onClick={onOpenOrder}
                className="bg-gradient-to-r from-sky-600 to-indigo-600 rounded-xl p-3 shadow-md shadow-sky-100 flex items-center justify-between cursor-pointer active:scale-95 transition"
             >
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                         <ShoppingBag className="text-white" size={20} strokeWidth={2.5}/>
                     </div>
                     <div>
                         <h3 className="font-black text-white text-sm leading-tight">Place New Order</h3>
                         <p className="text-[10px] text-sky-100 font-medium">Create Invoice & Dispatch</p>
                     </div>
                 </div>
                 <ChevronRight className="text-white" size={18} />
             </div>
         )}

         {/* --- Main Input Card (Compact) --- */}
         <div className="bg-white rounded-[1.2rem] shadow-[0_5px_30px_-5px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden relative">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-indigo-500"></div>
             
             {/* Shift Toggle */}
             <div className="p-4 pb-1">
                 <div className="flex bg-slate-100/80 p-1 rounded-full relative">
                     <button 
                        onClick={() => setShift('Day')} 
                        className={`flex-1 py-2 rounded-full text-[10px] font-black flex items-center justify-center gap-1.5 transition-all relative z-10 ${shift === 'Day' ? 'text-amber-600 shadow-sm bg-white' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                         <Sun size={14} className={shift === 'Day' ? "fill-amber-500 text-amber-500" : ""} /> DAY
                     </button>
                     <button 
                        onClick={() => setShift('Night')} 
                        className={`flex-1 py-2 rounded-full text-[10px] font-black flex items-center justify-center gap-1.5 transition-all relative z-10 ${shift === 'Night' ? 'text-indigo-600 shadow-sm bg-white' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                         <Moon size={14} className={shift === 'Night' ? "fill-indigo-500 text-indigo-500" : ""} /> NIGHT
                     </button>
                 </div>
             </div>

             <div className="p-4 pt-3 space-y-3">
                 <div>
                     <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1 pl-1">Select Product</label>
                     <div className="relative">
                        <select 
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition appearance-none"
                        >
                            <option value="">Choose item...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                        </select>
                        <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400">
                            <ChevronRight size={16} className="rotate-90" />
                        </div>
                     </div>
                 </div>
                 
                 <div>
                     <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1 pl-1">Quantity</label>
                     <input 
                        type="number" 
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xl font-black text-slate-800 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition placeholder-slate-300 text-center"
                        placeholder="0"
                     />
                 </div>

                 <button 
                    onClick={handleSubmit}
                    disabled={loading || !selectedProductId || !qty}
                    className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none"
                 >
                    {loading ? (
                        <>
                            <RefreshCw className="animate-spin" size={16}/> UPDATING...
                        </>
                    ) : (
                        <>
                            <Plus size={18}/> SEND FOR APPROVAL
                        </>
                    )} 
                 </button>
             </div>
         </div>

         {/* --- Activity Log --- */}
         <div>
             <div className="flex items-center justify-between px-2 mb-2">
                 <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today's History</h3>
                 <div className="flex items-center gap-2">
                     <span className="text-[8px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
                 </div>
             </div>
             
             <div className="space-y-2 relative">
                 <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-slate-200"></div>

                 {logs.length === 0 ? (
                     <div className="text-center py-8 text-slate-300 text-[10px] font-medium bg-white rounded-xl border border-slate-100 border-dashed">
                        No production today
                     </div>
                 ) : (
                     logs.map((log, idx) => (
                         <div key={log.id} className="relative pl-10 animate-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                             <div className={`absolute left-0 top-1.5 w-8 h-8 rounded-full border-2 border-slate-50 shadow-sm z-10 flex items-center justify-center ${log.shift === 'Day' ? 'bg-amber-100 text-amber-500' : 'bg-indigo-100 text-indigo-500'}`}>
                                 {log.shift === 'Day' ? <Sun size={12} className="fill-current"/> : <Moon size={12} className="fill-current"/>}
                             </div>
                             
                             <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex justify-between items-center">
                                 <div className="min-w-0 pr-2">
                                     <div className="font-bold text-xs text-slate-800 truncate">{log.product_name}</div>
                                     <div className="flex gap-2 text-[9px] font-medium text-slate-400 mt-0.5">
                                         <span className="flex items-center gap-1 bg-slate-50 px-1 py-0.5 rounded"><Clock size={9}/> {log.time}</span>
                                     </div>
                                 </div>
                                 <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                     <span className="text-base font-black text-slate-700">+{log.qty}</span>
                                     
                                     {/* DYNAMIC STATUS BADGE */}
                                     {log.status === 'APPROVED' ? (
                                         <span className="bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase flex items-center gap-0.5">
                                            <CheckCircle size={8} /> OK
                                         </span>
                                     ) : log.status === 'DECLINED' ? (
                                         <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase flex items-center gap-0.5">
                                            <XCircle size={8} /> No
                                         </span>
                                     ) : (
                                         <span className="bg-yellow-50 text-yellow-600 border border-yellow-200 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase flex items-center gap-0.5">
                                            <Hourglass size={8} /> Wait
                                         </span>
                                     )}
                                 </div>
                             </div>
                         </div>
                     ))
                 )}
             </div>
         </div>
      </div>
    </div>
  );
};

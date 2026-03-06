
import React, { useState, useEffect } from 'react';
import { User, SalesDashboardStats, Bill } from '../types';
import { billService, orderConfigService } from '../services/supabase';
import { RefreshCw, LogOut, Plus, Clock, Truck, CheckCircle, List, ChevronRight, TrendingUp, ScanLine, FileText, Lock } from 'lucide-react';

interface SalesDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (screen: any) => void;
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({ user, onLogout, onNavigate }) => {
  const [stats, setStats] = useState<SalesDashboardStats>({
    todayCount: 0,
    pendingCount: 0,
    deliveryCount: 0,
    doneCount: 0
  });
  const [recentOrders, setRecentOrders] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [ordersEnabled, setOrdersEnabled] = useState(true);

  const loadStats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch fresh data manually here to ensure APPROVED is counted correctly in the UI
      // Ideally billService.getSalesDashboardStats should be updated, but we can patch logic here or ensure backend aligns.
      // Current implementation of `getSalesDashboardStats` filters `status === 'DELIVERED'` for doneCount.
      // We need to count `APPROVED` as well.
      
      const allBills = await billService.getAll();
      const salesmanOrders = allBills.filter(b => b.bill_type === 'ORDER' && b.salesman_name === user.name);
      
      const todayStr = new Date().toISOString().split('T')[0];
      const todayOrders = salesmanOrders.filter(b => b.bill_date === todayStr);
      
      const pending = salesmanOrders.filter(b => b.status === 'PENDING' || !b.status).length;
      const loadingCount = salesmanOrders.filter(b => b.status === 'LOADING').length;
      const delivering = salesmanOrders.filter(b => b.status === 'OUT_FOR_DELIVERY').length;
      const done = salesmanOrders.filter(b => b.status === 'DELIVERED' || b.status === 'APPROVED').length; // Include APPROVED

      setStats({
          todayCount: todayOrders.length,
          pendingCount: pending + loadingCount, // Group pending & loading for dashboard summary
          deliveryCount: delivering,
          doneCount: done
      });

      const isActive = await orderConfigService.get();
      setOrdersEnabled(isActive);
      
      // Recent Orders
      const recent = salesmanOrders.slice(0, 3);
      setRecentOrders(recent);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(() => loadStats(true), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#F3F4F6] relative font-sans">
      
      {/* --- Header Section (Compact) --- */}
      <div className="bg-[#007f5f] p-4 pb-12 rounded-b-[1.5rem] shadow-lg relative z-10">
        <div className="flex justify-between items-start text-white mb-2">
          <div>
            <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-widest">Welcome,</p>
            <h1 className="text-xl font-black tracking-tight leading-none">{user.name}</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => loadStats()} 
              className={`p-1.5 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur-md transition border border-white/10 ${loading ? 'animate-spin' : ''}`}
            >
                <RefreshCw size={14} className="text-white" />
            </button>
            <button 
              onClick={onLogout} 
              className="p-1.5 bg-white/10 rounded-full hover:bg-red-500/80 backdrop-blur-md transition border border-white/10"
            >
                <LogOut size={14} className="text-white" />
            </button>
          </div>
        </div>

        {/* Counter */}
        <div className="flex justify-between items-end">
            <div>
                <div className="text-5xl font-black text-white tracking-tighter">{stats.todayCount}</div>
                <p className="text-emerald-100 text-xs font-bold opacity-80">Orders Today</p>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded text-[9px] font-bold text-white flex items-center gap-1 border border-white/10 shadow-sm mb-1">
                <TrendingUp size={10} /> +Live
            </div>
        </div>
      </div>

      {/* --- Main Content (Shifted Up) --- */}
      <div className="flex-1 overflow-y-auto px-4 -mt-8 pb-24 space-y-3 relative z-20">
        
        {/* --- Stats Row (Floating) --- */}
        <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-2 rounded-xl shadow-[0_4px_15px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                <Clock size={12} strokeWidth={3} />
              </div>
              <div className="text-center">
                 <span className="text-base font-black text-gray-800 block leading-none">{stats.pendingCount}</span>
                 <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide block">Processing</span>
              </div>
            </div>
            <div className="bg-white p-2 rounded-xl shadow-[0_4px_15px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center gap-1">
               <div className="w-6 h-6 rounded-full bg-sky-50 flex items-center justify-center text-sky-500">
                <Truck size={12} strokeWidth={3} />
              </div>
              <div className="text-center">
                 <span className="text-base font-black text-gray-800 block leading-none">{stats.deliveryCount}</span>
                 <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide block">Delivery</span>
              </div>
            </div>
            <div className="bg-white p-2 rounded-xl shadow-[0_4px_15px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                <CheckCircle size={12} strokeWidth={3} />
              </div>
              <div className="text-center">
                 <span className="text-base font-black text-gray-800 block leading-none">{stats.doneCount}</span>
                 <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide block">Done</span>
              </div>
            </div>
        </div>

        {/* --- Hero Action Button --- */}
        <button 
          onClick={() => {
              if (ordersEnabled) onNavigate('SALES_ORDER');
          }}
          disabled={!ordersEnabled}
          className={`w-full rounded-xl p-4 shadow-lg active:scale-[0.98] transition-all group relative overflow-hidden flex items-center justify-between ${
              ordersEnabled 
              ? 'bg-[#0f172a] shadow-slate-900/10 cursor-pointer' 
              : 'bg-gray-200 cursor-not-allowed shadow-none'
          }`}
        >
          {ordersEnabled && <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 transition group-hover:scale-110"></div>}
          
          <div className="flex items-center gap-4 relative z-10">
             <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${
                 ordersEnabled 
                 ? 'bg-[#10b981] shadow-emerald-500/20 text-white' 
                 : 'bg-gray-400 text-gray-100 shadow-none'
             }`}>
                {ordersEnabled ? <Plus size={20} strokeWidth={3} /> : <Lock size={20} strokeWidth={2.5}/>}
             </div>
             <div className="text-left">
                <h3 className={`font-bold text-base leading-tight ${ordersEnabled ? 'text-white' : 'text-gray-500'}`}>
                    {ordersEnabled ? 'New Order' : 'Locked'}
                </h3>
                <p className={`text-[10px] font-medium ${ordersEnabled ? 'text-slate-400' : 'text-gray-400'}`}>
                    {ordersEnabled ? 'Create invoice & dispatch' : 'Disabled by Admin'}
                </p>
             </div>
          </div>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${ordersEnabled ? 'bg-white/10 text-white/70' : 'bg-gray-300 text-gray-400'}`}>
              <ChevronRight size={14} />
          </div>
        </button>

        {/* --- Quick Actions Grid (Compact) --- */}
        <div className="grid grid-cols-2 gap-3">
             <button 
                onClick={() => onNavigate('SALESMAN_SCANNER')}
                className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-1 active:scale-95 transition h-20"
             >
                <div className="w-8 h-8 bg-sky-50 rounded-full flex items-center justify-center text-sky-600 shadow-sm">
                    <ScanLine size={16} />
                </div>
                <span className="font-bold text-gray-800 text-xs mt-1">Scan Received</span>
             </button>

             <button 
                onClick={() => onNavigate('MY_ORDERS')}
                className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-1 active:scale-95 transition h-20"
             >
                <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shadow-sm">
                    <FileText size={16} />
                </div>
                <span className="font-bold text-gray-800 text-xs mt-1">My Orders</span>
             </button>
        </div>

        {/* --- Recent Activity Section --- */}
        <div className="px-1 pt-1">
            <div className="flex justify-between items-end mb-2 px-1">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Activity</h3>
                <button onClick={() => onNavigate('MY_ORDERS')} className="text-[10px] font-bold text-sky-600">View All</button>
            </div>
            <div className="space-y-2">
                {recentOrders.map(o => (
                    <div key={o.id} className="bg-white p-3 rounded-xl shadow-[0_2px_8px_rgb(0,0,0,0.02)] border border-gray-100 flex justify-between items-center active:scale-[0.99] transition" onClick={() => onNavigate('MY_ORDERS')}>
                        <div className="min-w-0">
                            <div className="font-bold text-gray-800 text-xs truncate">{o.customer_name}</div>
                            <div className="text-[9px] text-gray-400 font-mono mt-0.5">{o.bill_no} • {o.total_qty} Items</div>
                        </div>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ml-2 ${
                             o.status === 'APPROVED' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                             o.status === 'DELIVERED' ? 'bg-green-50 text-green-700 border-green-100' :
                             o.status === 'OUT_FOR_DELIVERY' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                             o.status === 'CANCELLED' ? 'bg-red-600 text-white border-red-700' : 
                             'bg-orange-50 text-orange-700 border-orange-100'
                        }`}>
                            {(o.status || 'PENDING').replace(/_/g, ' ')}
                        </span>
                    </div>
                ))}
                {recentOrders.length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-[10px] bg-white rounded-xl border border-gray-100">No recent orders</div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

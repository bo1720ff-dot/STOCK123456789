
import React, { useEffect, useState, useRef } from 'react';
import { billService, productionConfigService, orderConfigService, stockService, productService, systemService, auditService } from '../services/supabase';
import { DailySummary, Bill, BillType, OrderStatus, Product, StockEntry, BillItem } from '../types';
import { RefreshCw, Package, FileText, Calendar, Lock, Unlock, CheckCircle, XCircle, ShoppingBag, Truck, Activity, User, Grid, Monitor, BarChart3, ArrowRight, Layers, Sun, Moon, Clock, X, MapPin, IndianRupee, Megaphone, Send, Power, Bell } from 'lucide-react';
import { ActivityFeed } from './ActivityFeed';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LIVE' | 'STOCK' | 'ACTIVITY'>('OVERVIEW');
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [activeOrders, setActiveOrders] = useState<Bill[]>([]);
  const [stockSummary, setStockSummary] = useState<{product: string, closing: number}[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Notification Badge
  const [activityCount, setActivityCount] = useState(0);
  
  // Production Switch State
  const [productionEnabled, setProductionEnabled] = useState<boolean>(true);
  const [switching, setSwitching] = useState(false);
  
  // Order Switch State
  const [ordersEnabled, setOrdersEnabled] = useState<boolean>(true);
  const [switchingOrders, setSwitchingOrders] = useState(false);

  // SYSTEM ACCESS CONTROL
  const [systemOpen, setSystemOpen] = useState(true);
  const [systemMessage, setSystemMessage] = useState('');
  const [savingSystem, setSavingSystem] = useState(false);
  
  // View Details Modal State
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const [viewItems, setViewItems] = useState<BillItem[]>([]);
  
  const pendingToggleState = useRef<boolean | null>(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [summaryData, recentData, prodActive, orderActive, allBills, products, stocks, sysStatus, recentLogs] = await Promise.all([
          billService.getTodaySummary(),
          billService.getRecent(20),
          productionConfigService.get(),
          orderConfigService.get(),
          billService.getAll(), // Fetch all to filter for active orders
          productService.getAll(),
          stockService.getByDate(today),
          systemService.getStatus(),
          auditService.getRecentLogs(20) // Fetch logs for badge count
      ]);
      
      setSummary(summaryData);
      setRecentBills(recentData);
      
      // Basic Activity Count Logic: Count logs from 'Today' as recent activity
      // In a real app, you'd track 'lastReadTime' in local storage
      const todayLogs = recentLogs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString());
      setActivityCount(todayLogs.length);

      if(!silent) {
          setSystemOpen(sysStatus.isOpen);
          setSystemMessage(sysStatus.message);
      }
      
      // Filter Live Orders (Pending, Loading, Out For Delivery)
      const live = allBills.filter(b => b.bill_type === BillType.ORDER && b.status && ['PENDING', 'LOADING', 'OUT_FOR_DELIVERY'].includes(b.status));
      setActiveOrders(live);

      // Build Quick Stock Summary
      const stockOverview = products.map(p => {
          const entry = stocks.find(s => s.product_id === p.id);
          const closing = entry ? (Number(entry.opening_stock) + Number(entry.day_production) + Number(entry.night_production) - Number(entry.stock_out || 0)) : 0;
          return { product: p.product_name, closing };
      });
      setStockSummary(stockOverview);
      
      // Sync Production State
      if (pendingToggleState.current !== null) {
          if (prodActive === pendingToggleState.current) {
             pendingToggleState.current = null;
             setProductionEnabled(prodActive);
          }
      } else {
          setProductionEnabled(prodActive);
      }

      setOrdersEnabled(orderActive);

    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 5000); // 5s refresh
    return () => clearInterval(interval);
  }, []);

  const toggleProduction = async () => {
      setSwitching(true);
      const newState = !productionEnabled;
      pendingToggleState.current = newState;
      setProductionEnabled(newState);

      try {
          await productionConfigService.set(newState);
          setTimeout(() => {
              if (pendingToggleState.current === newState) pendingToggleState.current = null;
          }, 5000);
      } catch (e) {
          console.error(e);
          setProductionEnabled(!newState);
          pendingToggleState.current = null;
          alert("Failed to update setting.");
      } finally {
          setSwitching(false);
      }
  };

  const toggleOrders = async () => {
      setSwitchingOrders(true);
      const newState = !ordersEnabled;
      setOrdersEnabled(newState);

      try {
          await orderConfigService.set(newState);
      } catch (e) {
          console.error(e);
          setOrdersEnabled(!newState);
          alert("Failed to update order status.");
      } finally {
          setSwitchingOrders(false);
      }
  };

  const handleToggleSystem = async () => {
      const newStatus = !systemOpen;
      setSystemOpen(newStatus);
      setSavingSystem(true);
      
      try {
          // If turning OFF (Blocking), ensure message is saved
          await systemService.setStatus(newStatus, systemMessage);
          
          if (!newStatus) {
              alert("SYSTEM LOCKED: Staff access is now blocked. Admin access remains open.");
          } else {
              alert("SYSTEM UNLOCKED: Staff can access app.");
          }
      } catch (e) {
          alert("Failed to update system status");
          setSystemOpen(!newStatus); // revert
      } finally {
          setSavingSystem(false);
      }
  };

  const handleUpdateMessage = async () => {
      if (!systemMessage.trim()) return;
      setSavingSystem(true);
      try {
          await systemService.setStatus(systemOpen, systemMessage);
          alert("Message updated.");
      } catch(e) {
          alert("Failed");
      } finally {
          setSavingSystem(false);
      }
  };

  const handleViewDetails = async (bill: Bill) => {
      try {
          // Check if items are already attached, if not fetch
          let items = bill.items;
          if (!items || items.length === 0) {
             items = await billService.getItemsByBillId(bill.id);
          }
          setViewItems(items || []);
          setViewBill(bill);
      } catch (e) {
          console.error(e);
      }
  };

  // --- Derived Data for Recent Activity ---
  const recentInvoices = recentBills.filter(b => b.bill_type === BillType.SMALL).slice(0, 5);
  const recentVehicles = Array.from(new Set(recentBills.filter(b => b.vehicle_number).map(b => b.vehicle_number)))
    .slice(0, 5)
    .map(v => {
        const lastBill = recentBills.find(b => b.vehicle_number === v);
        return { 
            number: v, 
            driver: lastBill?.driver_name,
            lastActive: lastBill?.bill_date 
        };
    });

  if (loading && !summary) {
    return <div className="flex justify-center items-center h-64 text-sky-600 animate-pulse font-bold">Loading Dashboard...</div>;
  }

  const StatCard = ({ title, value, icon: Icon, colorClass, subTitle }: any) => (
    <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between`}>
      <div>
        <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">{title}</span>
        <div className={`text-3xl font-black mt-1 ${colorClass}`}>{value}</div>
        {subTitle && <div className="text-xs mt-1 font-medium">{subTitle}</div>}
      </div>
      <div className="p-3 rounded-full bg-slate-50 text-slate-600">
        <Icon size={28} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800">Admin Dashboard</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">
                  Overview for {new Date().toLocaleDateString()}
              </p>
            </div>
            
            {/* Global Controls (Always Visible) */}
            <div className="flex items-center gap-3">
                 {/* ORDER CONTROL */}
                 <button 
                    onClick={toggleOrders}
                    disabled={switchingOrders}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        ordersEnabled 
                        ? 'bg-blue-50 border-blue-200 text-blue-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-500'
                    }`}
                 >
                     <div className="text-[9px] font-black uppercase text-right leading-none">
                         Order<br/>Taking
                     </div>
                     {switchingOrders ? <RefreshCw size={16} className="animate-spin"/> : (ordersEnabled ? <Unlock size={16}/> : <Lock size={16}/>)}
                 </button>

                 {/* PRODUCTION CONTROL */}
                 <button 
                    onClick={toggleProduction}
                    disabled={switching}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        productionEnabled 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                 >
                     <div className="text-[9px] font-black uppercase text-right leading-none">
                         Prod.<br/>Input
                     </div>
                     {switching ? <RefreshCw size={16} className="animate-spin"/> : (productionEnabled ? <Unlock size={16}/> : <Lock size={16}/>)}
                 </button>
            </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm w-full md:w-fit overflow-x-auto">
            <button 
                onClick={() => setActiveTab('OVERVIEW')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'OVERVIEW' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
                <Grid size={16} /> OVERVIEW
            </button>
            <button 
                onClick={() => setActiveTab('LIVE')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'LIVE' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
                <Monitor size={16} /> LIVE OPS
                {activeOrders.length > 0 && <span className="bg-white text-sky-600 px-1.5 rounded-full text-[9px]">{activeOrders.length}</span>}
            </button>
            <button 
                onClick={() => setActiveTab('STOCK')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'STOCK' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
                <Layers size={16} /> STOCK
            </button>
            <button 
                onClick={() => setActiveTab('ACTIVITY')}
                className={`relative flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'ACTIVITY' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
                <Bell size={16} /> NOTIFICATIONS
                {activityCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                        {activityCount > 9 ? '9+' : activityCount}
                    </span>
                )}
            </button>
        </div>
      </div>

      {/* --- TAB CONTENT: OVERVIEW --- */}
      {activeTab === 'OVERVIEW' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              
              {/* SYSTEM ACCESS CONTROL CARD */}
              <div className={`rounded-xl p-5 shadow-lg transition-all ${
                  systemOpen 
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white' 
                  : 'bg-gradient-to-r from-red-600 to-rose-700 text-white'
              }`}>
                  <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${systemOpen ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                              <Power size={24} />
                          </div>
                          <div>
                              <h4 className="font-black text-lg uppercase tracking-tight">System Access Control</h4>
                              <p className="text-xs font-bold opacity-80">
                                  {systemOpen ? 'STAFF ACCESS GRANTED' : 'LOCKED FOR STAFF (Admin Access Only)'}
                              </p>
                          </div>
                      </div>
                      
                      <button 
                        onClick={handleToggleSystem}
                        disabled={savingSystem}
                        className={`px-5 py-2 rounded-lg font-black text-xs uppercase shadow-md transition flex items-center gap-2 ${
                            systemOpen 
                            ? 'bg-white text-emerald-700 hover:bg-emerald-50' 
                            : 'bg-white text-red-700 hover:bg-red-50'
                        }`}
                      >
                          {savingSystem ? <RefreshCw className="animate-spin" size={14}/> : (systemOpen ? 'LOCK ACCESS' : 'UNLOCK ACCESS')}
                      </button>
                  </div>

                  <div className="bg-white/10 p-3 rounded-lg border border-white/20">
                      <label className="text-[10px] font-bold uppercase text-white/70 mb-1 block">Block Reason / Message to Staff</label>
                      <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={systemMessage}
                            onChange={(e) => setSystemMessage(e.target.value)}
                            placeholder="e.g. System Maintenance, Day End Processing..."
                            className="flex-1 bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-white/50 outline-none focus:bg-white/30 transition"
                          />
                          {!systemOpen && (
                              <button 
                                onClick={handleUpdateMessage}
                                disabled={savingSystem}
                                className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg font-bold text-xs"
                              >
                                  UPDATE MSG
                              </button>
                          )}
                      </div>
                  </div>
              </div>

              {/* Stats Grid - REMOVED INVOICE VALUE */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Total Bills" value={summary ? summary.totalBills : 0} icon={FileText} colorClass="text-slate-800" />
                <StatCard title="Total Qty" value={summary ? summary.totalQty : 0} icon={Package} colorClass="text-sky-600" />
                <StatCard title="Dispatches" value={summary ? summary.dispatchBillCount + summary.orderCount : 0} icon={Truck} colorClass="text-orange-600" />
              </div>

              {/* Recent Activity Lists */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Invoices */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
                      <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2"><FileText size={16} className="text-slate-400"/> Recent Invoices</h4>
                      </div>
                      <div className="flex-1 p-2">
                          {recentInvoices.length === 0 ? <div className="text-center p-8 text-gray-400 text-xs">No invoices yet</div> : (
                              <div className="space-y-1">
                                  {recentInvoices.map(b => (
                                      <div 
                                        key={b.id} 
                                        onClick={() => handleViewDetails(b)}
                                        className="p-3 hover:bg-slate-50 rounded-xl transition border-b border-gray-100 last:border-0 group cursor-pointer active:bg-slate-100"
                                      >
                                          <div className="flex justify-between items-start">
                                              <div className="min-w-0 flex-1 mr-2">
                                                  <div className="flex items-center gap-2 mb-0.5">
                                                      <span className="text-[10px] font-mono font-bold text-slate-400 group-hover:text-sky-500 transition-colors">{b.bill_no}</span>
                                                      <span className="text-[9px] text-gray-300">•</span>
                                                      <span className="text-[10px] text-gray-400 font-medium">
                                                          {b.created_at ? new Date(b.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                                      </span>
                                                  </div>
                                                  <div className="font-bold text-slate-800 text-sm truncate">{b.customer_name || 'Cash Sale'}</div>
                                                  
                                                  <div className="flex flex-wrap gap-2 mt-1.5">
                                                      {b.vehicle_number && (
                                                          <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded shadow-sm">
                                                              <Truck size={10} className="text-gray-400"/> {b.vehicle_number}
                                                          </div>
                                                      )}
                                                      {b.salesman_name && (
                                                          <div className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                              <User size={10}/> {b.salesman_name}
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                              
                                              <div className="text-right bg-slate-100 px-2 py-1 rounded-lg group-hover:bg-slate-200 transition">
                                                  <div className="font-black text-slate-900 text-sm">{b.total_qty}</div>
                                                  <div className="text-[8px] font-bold text-slate-400 uppercase text-center">Qty</div>
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Recently Used Vehicles */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
                      <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Truck size={16} className="text-slate-400"/> Active Vehicles</h4>
                      </div>
                      <div className="flex-1 p-2">
                          {recentVehicles.length === 0 ? <div className="text-center p-8 text-gray-400 text-xs">No active vehicles</div> : (
                              <div className="space-y-1">
                                  {recentVehicles.map((v, i) => (
                                      <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition">
                                          <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                  <Truck size={14}/>
                                              </div>
                                              <div>
                                                  <div className="font-bold text-slate-800 text-xs">{v.number}</div>
                                                  <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                      <User size={10}/> {v.driver || 'Unknown'}
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="text-[9px] font-mono text-gray-400 bg-slate-50 px-2 py-1 rounded">
                                              {v.lastActive}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- TAB CONTENT: LIVE OPERATIONS --- */}
      {activeTab === 'LIVE' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <Monitor className="text-sky-500"/> Live Orders Monitor
              </h3>
              
              {activeOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                          <CheckCircle size={32} />
                      </div>
                      <h4 className="text-gray-500 font-bold">All Clear!</h4>
                      <p className="text-xs text-gray-400 mt-1">No active pending or loading orders at the moment.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeOrders.map(order => (
                          <div key={order.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                              {/* Status Strip */}
                              <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                  order.status === 'OUT_FOR_DELIVERY' ? 'bg-sky-500' :
                                  order.status === 'LOADING' ? 'bg-yellow-400' : 'bg-orange-400'
                              }`}></div>
                              
                              <div className="pl-3">
                                  <div className="flex justify-between items-start mb-2">
                                      <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{order.bill_no}</span>
                                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                                          order.status === 'OUT_FOR_DELIVERY' ? 'bg-sky-50 text-sky-600' :
                                          order.status === 'LOADING' ? 'bg-yellow-50 text-yellow-600' : 'bg-orange-50 text-orange-600'
                                      }`}>
                                          {(order.status || 'PENDING').replace(/_/g, ' ')}
                                      </span>
                                  </div>
                                  
                                  <h4 className="font-bold text-slate-800 text-sm truncate mb-1">{order.customer_name}</h4>
                                  <div className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                                      <User size={12}/> {order.salesman_name || 'Direct'}
                                  </div>

                                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                                      <div className="text-center">
                                          <div className="text-[10px] text-gray-400 uppercase font-bold">Qty</div>
                                          <div className="font-black text-slate-800 text-sm">{order.total_qty}</div>
                                      </div>
                                      <div className="w-px h-6 bg-gray-200"></div>
                                      <div className="text-center">
                                          <div className="text-[10px] text-gray-400 uppercase font-bold">Vehicle</div>
                                          <div className="font-bold text-slate-800 text-xs truncate max-w-[80px]">{order.vehicle_number || '-'}</div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* --- TAB CONTENT: STOCK MONITOR --- */}
      {activeTab === 'STOCK' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                      <Layers className="text-emerald-500"/> Current Stock Levels
                  </h3>
                  <div className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1 rounded-full border shadow-sm">
                      Today's Closing (Calculated)
                  </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                          <tr>
                              <th className="p-4">Product Name</th>
                              <th className="p-4 text-right">Available Stock</th>
                              <th className="p-4 w-1/3">Status</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                          {stockSummary.map((item, idx) => {
                              // Mock threshold for visual bar
                              const max = 1000; 
                              const percentage = Math.min((item.closing / max) * 100, 100);
                              
                              return (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                      <td className="p-4 font-bold text-slate-700">{item.product}</td>
                                      <td className="p-4 text-right font-mono font-black text-slate-900">{item.closing}</td>
                                      <td className="p-4">
                                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                              <div 
                                                className={`h-full rounded-full ${
                                                    item.closing < 50 ? 'bg-red-500' :
                                                    item.closing < 200 ? 'bg-yellow-400' : 'bg-emerald-500'
                                                }`} 
                                                style={{width: `${percentage}%`}}
                                              ></div>
                                          </div>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- TAB CONTENT: ACTIVITY FEED (New) --- */}
      {activeTab === 'ACTIVITY' && (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
              <ActivityFeed />
          </div>
      )}

      {/* --- VIEW DETAILS MODAL --- */}
      {viewBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg">Invoice Details</h3>
                        <p className="text-xs text-slate-500 font-mono">{viewBill.bill_no} • {new Date(viewBill.bill_date).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => setViewBill(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm border border-slate-100">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Customer Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                            <User size={12}/> Customer
                        </h4>
                        <div className="font-bold text-slate-800 text-lg leading-tight">{viewBill.customer_name || 'CASH SALE'}</div>
                        {viewBill.customer_address && (
                            <div className="text-sm text-slate-500 mt-1 flex items-start gap-2">
                                <MapPin size={14} className="mt-0.5 shrink-0"/> {viewBill.customer_address}
                            </div>
                        )}
                        {viewBill.salesman_name && (
                            <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Sales By:</span>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{viewBill.salesman_name}</span>
                            </div>
                        )}
                    </div>

                    {/* Logistics if available */}
                    {viewBill.vehicle_number && (
                        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex justify-between items-center">
                             <div>
                                 <span className="text-[10px] font-bold text-orange-400 uppercase block">Vehicle</span>
                                 <span className="font-mono font-bold text-orange-900 text-sm">{viewBill.vehicle_number}</span>
                             </div>
                             <Truck size={20} className="text-orange-300"/>
                        </div>
                    )}

                    {/* Items Table */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                            <Package size={12}/> Items
                        </h4>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase">
                                    <tr>
                                        <th className="p-3 text-left">Product</th>
                                        <th className="p-3 text-right">Qty</th>
                                        {viewBill.bill_type === 'SMALL' && <th className="p-3 text-right">Total</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {viewItems.map((item, idx) => (
                                        <tr key={idx} className="bg-white">
                                            <td className="p-3 font-medium text-slate-700">{item.product_name}</td>
                                            <td className="p-3 text-right font-bold text-slate-900">{item.qty}</td>
                                            {viewBill.bill_type === 'SMALL' && (
                                                <td className="p-3 text-right font-medium text-slate-600">
                                                    {item.line_total ? item.line_total.toFixed(0) : '-'}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50 border-t border-slate-200">
                                        <td className="p-3 font-black text-slate-700 text-xs uppercase">Total</td>
                                        <td className="p-3 text-right font-black text-slate-900">{viewBill.total_qty}</td>
                                        {viewBill.bill_type === 'SMALL' && (
                                            <td className="p-3 text-right font-black text-slate-900 flex items-center justify-end gap-0.5">
                                                <IndianRupee size={10} strokeWidth={3}/> 
                                                {viewBill.total_amount ? viewBill.total_amount.toFixed(0) : '0'}
                                            </td>
                                        )}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div className="p-5 bg-white border-t border-slate-100">
                    <button onClick={() => setViewBill(null)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

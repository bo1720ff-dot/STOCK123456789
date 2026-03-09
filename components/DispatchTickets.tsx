
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { billService, vehicleService } from '../services/supabase';
import { Bill, BillType, User, UserRole, Vehicle } from '../types';
import { MapPin, Truck, Clock, Package, User as UserIcon, Shield, FileText, ShoppingBag, IndianRupee, Layers, ChevronDown, ChevronUp, Ticket, ScanLine, X, CheckCircle, RefreshCw, QrCode, Phone, Edit2 } from 'lucide-react';

// Helper to get local date string (YYYY-MM-DD) to fix "Today" visibility issues
// Force rebuild
const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface DispatchTicketsProps {
    onPrint?: (bill: Bill, items: any[]) => void;
    user?: User;
}

export const DispatchTickets: React.FC<DispatchTicketsProps> = ({ onPrint, user }) => {
  const [selectedDate, setSelectedDate] = useState<string>(getLocalToday());
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  
  // Driver Specific State
  const [driverVehicle, setDriverVehicle] = useState<Vehicle | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedDriverBill, setSelectedDriverBill] = useState<Bill | null>(null); // NEW: For Driver Modal
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBillNo, setManualBillNo] = useState('');
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Load Driver's Vehicle on Mount
  useEffect(() => {
      if (user?.role === UserRole.DRIVER) {
          vehicleService.getAll().then(vehicles => {
              // Find vehicle where driver_name matches user.name (case-insensitive)
              let myVehicle = vehicles.find(v => (v.driver_name || '').toLowerCase() === (user.name || '').toLowerCase());
              
              // Fallback: Check if user.username matches vehicle_number (since we set username = vehicle_number in login)
              if (!myVehicle && user.username) {
                  myVehicle = vehicles.find(v => (v.vehicle_number || '').replace(/\s/g,'').toLowerCase() === (user.username || '').replace(/\s/g,'').toLowerCase());
              }

              if (myVehicle) setDriverVehicle(myVehicle);
          });
      }
  }, [user]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // getDeepBillsByDate fetches ALL types where status is NOT Pending/Cancelled
      const data = await billService.getDeepBillsByDate(selectedDate);
      setBills(data);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Filter Bills for Driver
  const displayedBills = useMemo(() => {
      if (user?.role === UserRole.DRIVER) {
          return bills.filter(b => {
              // Match by Driver Name directly on Bill
              const nameMatch = (b.driver_name || '').toLowerCase() === (user.name || '').toLowerCase();
              // OR Match by Vehicle Number if we found the driver's vehicle
              const vehicleMatch = driverVehicle && (b.vehicle_number || '').replace(/\s/g,'').toLowerCase() === (driverVehicle.vehicle_number || '').replace(/\s/g,'').toLowerCase();
              
              return nameMatch || vehicleMatch;
          });
      }
      return bills;
  }, [bills, user, driverVehicle]);

  // Calculate Grand Totals for the Day
  const stats = useMemo(() => {
      return displayedBills.reduce((acc, bill) => ({
          totalQty: acc.totalQty + (bill.total_qty || 0),
          totalAmount: acc.totalAmount + (bill.total_amount || 0),
          count: acc.count + 1
      }), { totalQty: 0, totalAmount: 0, count: 0 });
  }, [displayedBills]);

  const getStatusStyle = (status?: string) => {
      switch(status) {
          case 'LOADING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
          case 'OUT_FOR_DELIVERY': return 'bg-sky-100 text-sky-800 border-sky-200';
          case 'DELIVERED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
          case 'APPROVED': return 'bg-purple-100 text-purple-800 border-purple-200';
          default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
  };

  const getTypeIcon = (type: BillType) => {
      switch(type) {
          case BillType.SMALL: return <ShoppingBag size={14}/>;
          case BillType.DISPATCH: return <Truck size={14}/>;
          case BillType.ORDER: return <FileText size={14}/>;
      }
  };

  const getTypeColor = (type: BillType) => {
      switch(type) {
          case BillType.SMALL: return 'text-emerald-700 bg-emerald-50 border-emerald-200';
          case BillType.DISPATCH: return 'text-orange-700 bg-orange-50 border-orange-200';
          case BillType.ORDER: return 'text-blue-700 bg-blue-50 border-blue-200';
      }
  };

  const toggleExpand = (id: string) => {
      setExpandedCard(expandedCard === id ? null : id);
  };

  // --- SCANNER LOGIC ---
  const startScanner = () => {
      setShowScanner(true);
      setScanMessage(null);
      
      setTimeout(() => {
          // @ts-ignore
          if (!window.Html5Qrcode) return;

          try {
              // @ts-ignore
              const html5QrCode = new window.Html5Qrcode("driver-reader");
              scannerRef.current = html5QrCode;

              html5QrCode.start(
                  { facingMode: "environment" }, 
                  { fps: 10, qrbox: { width: 250, height: 250 } },
                  (decodedText: string) => {
                      html5QrCode.pause();
                      handleScanSuccess(decodedText);
                  },
                  () => {}
              ).catch((err: any) => console.error("Camera Error", err));
          } catch(e) { console.error(e); }
      }, 300);
  };

  const stopScanner = () => {
      if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
              scannerRef.current.clear();
              setShowScanner(false);
          }).catch(() => setShowScanner(false));
      } else {
          setShowScanner(false);
      }
  };

  const handleScanSuccess = async (billNo: string) => {
      try {
          const cleanNo = billNo.trim().toUpperCase();
          const bill = await billService.getByBillNo(cleanNo);
          
          if (!bill) throw new Error("Order not found");
          
          // Verify Ownership
          const isMyBill = (bill.driver_name || '').toLowerCase() === (user?.name || '').toLowerCase() ||
                           (driverVehicle && (bill.vehicle_number || '').replace(/\s/g,'').toLowerCase() === (driverVehicle.vehicle_number || '').replace(/\s/g,'').toLowerCase());

          if (!isMyBill && user?.role === UserRole.DRIVER) {
              throw new Error("This order is not assigned to you.");
          }

          if (bill.status === 'DELIVERED') {
              throw new Error("Already Delivered.");
          }

          // Update Status
          await billService.updateStatusByBillNo(cleanNo, 'DELIVERED');
          
          setScanMessage({ type: 'success', text: `Order ${cleanNo} Delivered!` });
          loadData(true); // Refresh list
          
          // Auto close after 2s
          setTimeout(() => {
              if (scannerRef.current) scannerRef.current.resume();
              setScanMessage(null);
          }, 2000);

      } catch (e: any) {
          setScanMessage({ type: 'error', text: e.message || "Scan Failed" });
          setTimeout(() => {
            if (scannerRef.current) scannerRef.current.resume();
            setScanMessage(null);
        }, 3000);
      }
  };

  // --- DRIVER MOBILE INTERFACE ---
  if (user?.role === UserRole.DRIVER) {
      return (
          <div className="h-full flex flex-col bg-slate-50 text-slate-900 pb-20">
              {/* Driver Header */}
              <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                  <div>
                      <h1 className="text-lg font-black tracking-tight text-sky-600 flex items-center gap-2">
                          <Truck size={20}/> MY DELIVERIES
                      </h1>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {driverVehicle?.vehicle_number || 'No Vehicle Assigned'}
                      </p>
                  </div>
                  <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setShowManualEntry(true)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-full shadow-sm active:scale-95 transition"
                        title="Manual Entry"
                      >
                          <Edit2 size={24} />
                      </button>
                      <button 
                        onClick={startScanner}
                        className="bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-full shadow-lg shadow-sky-200 active:scale-95 transition"
                        title="Scan QR"
                      >
                          <ScanLine size={24} />
                      </button>
                  </div>
              </div>

              {/* Date Selector (Compact) */}
              <div className="px-4 py-2 bg-sky-50 flex justify-between items-center border-b border-sky-100">
                  <span className="text-[10px] font-bold text-sky-700 uppercase">Delivery Date</span>
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-white border border-sky-200 rounded px-2 py-1 text-xs font-bold text-sky-900 outline-none focus:ring-2 focus:ring-sky-500"
                  />
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-2 p-2">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
                      <span className="text-2xl font-black text-slate-800">{stats.count}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Orders</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
                      <span className="text-2xl font-black text-sky-600">{stats.totalQty}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Total Qty</span>
                  </div>
              </div>

              {/* Driver Ticket List */}
              <div className="flex-1 overflow-y-auto px-2 space-y-3 pt-2">
                  {loading && bills.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                          <RefreshCw className="animate-spin text-sky-500" size={24}/>
                          <span className="text-xs font-bold">Loading Tasks...</span>
                      </div>
                  ) : displayedBills.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl m-2 bg-white">
                          <CheckCircle size={48} className="opacity-20 mb-2"/>
                          <p className="text-sm font-bold text-slate-500">All Caught Up!</p>
                          <p className="text-[10px]">No pending deliveries for {selectedDate}.</p>
                      </div>
                  ) : (
                      displayedBills.map(bill => {
                          const isDelivered = bill.status === 'DELIVERED';
                          return (
                              <div 
                                key={bill.id} 
                                onClick={() => setSelectedDriverBill(bill)}
                                className={`rounded-xl overflow-hidden border transition-all active:scale-95 duration-200 cursor-pointer relative ${
                                    isDelivered 
                                    ? 'bg-slate-50 border-slate-200 opacity-80' 
                                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-sky-300'
                                }`}
                              >
                                  {/* Status Stripe */}
                                  <div className={`h-1 w-full ${isDelivered ? 'bg-emerald-500' : 'bg-sky-500'}`}></div>

                                  <div className="p-4 space-y-4">
                                      {/* Header Row */}
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <span className="font-mono font-black text-xl text-slate-800 tracking-tight">#{bill.bill_no}</span>
                                              <div className="flex items-center gap-2 mt-1">
                                                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                                      <Clock size={10}/> {new Date(bill.created_at || bill.bill_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                  </span>
                                                  {bill.salesman_name && (
                                                      <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                          <UserIcon size={10}/> {bill.salesman_name}
                                                      </span>
                                                  )}
                                              </div>
                                          </div>
                                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border ${
                                              isDelivered ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                                          }`}>
                                              {bill.status}
                                          </span>
                                      </div>

                                      {/* Customer Block */}
                                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Customer</div>
                                          <div className="text-base font-black text-slate-800 leading-tight">{bill.customer_name}</div>
                                          <div className="mt-2 space-y-1">
                                              <div className="flex items-start gap-2 text-xs text-slate-600">
                                                  <MapPin size={14} className="shrink-0 text-sky-500 mt-0.5"/> 
                                                  <span className="leading-snug">{bill.customer_address || 'No Address'}</span>
                                              </div>
                                              {bill.phone_number && (
                                                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                                                      <Phone size={14} className="shrink-0 text-sky-500"/> 
                                                      <span>{bill.phone_number}</span>
                                                  </div>
                                              )}
                                          </div>
                                      </div>

                                      {/* Metrics Grid */}
                                      <div className="grid grid-cols-2 gap-3">
                                          <div className="border border-slate-100 rounded-lg p-2 flex flex-col items-center justify-center bg-slate-50/50">
                                              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Qty</span>
                                              <span className="text-lg font-black text-slate-800">{bill.total_qty}</span>
                                          </div>
                                          <div className="border border-slate-100 rounded-lg p-2 flex flex-col items-center justify-center bg-slate-50/50">
                                              <span className="text-[10px] font-bold text-slate-400 uppercase">Amount</span>
                                              <span className="text-lg font-black text-slate-800 flex items-center">
                                                  <IndianRupee size={12} strokeWidth={3}/> {bill.total_amount?.toLocaleString() || '0'}
                                              </span>
                                          </div>
                                      </div>

                                      {/* Items Preview (Text) */}
                                      {bill.items && bill.items.length > 0 && (
                                          <div className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                                              <span className="font-bold text-slate-700">Includes: </span>
                                              {bill.items.map(i => i.product_name).join(', ').substring(0, 60)}
                                              {bill.items.reduce((acc, i) => acc + i.product_name.length, 0) > 60 && '...'}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          );
                      })
                  )}
              </div>

              {/* Order Details Modal */}
              {selectedDriverBill && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-200"
                        onClick={() => setSelectedDriverBill(null)}
                    ></div>
                    
                    {/* Modal Content */}
                    <div className="relative z-10 bg-white w-full max-w-md h-[85vh] sm:h-auto sm:rounded-2xl rounded-t-2xl shadow-2xl pointer-events-auto flex flex-col animate-in slide-in-from-bottom duration-300">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">#{selectedDriverBill.bill_no}</h3>
                            </div>
                            <button onClick={() => setSelectedDriverBill(null)} className="p-2 bg-white rounded-full shadow-sm text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* Status Banner */}
                            <div className={`p-3 rounded-xl flex items-center gap-3 ${
                                selectedDriverBill.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-orange-50 text-orange-700 border border-orange-100'
                            }`}>
                                {selectedDriverBill.status === 'DELIVERED' ? <CheckCircle size={24} /> : <Clock size={24} />}
                                <div>
                                    <p className="text-xs font-bold uppercase opacity-70">Current Status</p>
                                    <p className="font-black text-lg">{selectedDriverBill.status}</p>
                                </div>
                            </div>

                            {/* Customer Info */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Customer Information</h4>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <p className="text-lg font-bold text-slate-800">{selectedDriverBill.customer_name}</p>
                                    <div className="flex items-start gap-2 mt-2 text-sm text-slate-600">
                                        <MapPin size={16} className="shrink-0 text-sky-500 mt-0.5" />
                                        <p>{selectedDriverBill.customer_address || 'No Address Provided'}</p>
                                    </div>
                                    {selectedDriverBill.phone_number && (
                                        <div className="flex items-center gap-2 mt-2 text-sm font-bold text-sky-600">
                                            <Phone size={16} />
                                            <a href={`tel:${selectedDriverBill.phone_number}`}>{selectedDriverBill.phone_number}</a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Additional Details - REMOVED Date/Time & Remarks as per request "JUST QTY" */}
                            
                            {/* Items List */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Product List</h4>
                                <div className="border border-slate-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                                            <tr>
                                                <th className="p-3">Product Name</th>
                                                <th className="p-3 text-right">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {selectedDriverBill.items?.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-3 font-bold text-slate-700">{item.product_name}</td>
                                                    <td className="p-3 text-right font-black text-slate-900 bg-slate-50/50 text-base">{item.qty}</td>
                                                </tr>
                                            ))}
                                            {/* GROSS TOTAL ROW */}
                                            <tr className="bg-sky-50 border-t border-sky-100">
                                                <td className="p-3 font-black text-sky-700 uppercase text-xs tracking-wider">Gross Total Qty</td>
                                                <td className="p-3 text-right font-black text-sky-700 text-xl">{selectedDriverBill.total_qty}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer (Actions) */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                            {selectedDriverBill.status !== 'DELIVERED' ? (
                                <button 
                                    onClick={() => {
                                        if(confirm("Confirm Delivery?")) {
                                            handleScanSuccess(selectedDriverBill.bill_no);
                                            setSelectedDriverBill(null);
                                        }
                                    }}
                                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={24} /> MARK AS DELIVERED
                                </button>
                            ) : (
                                <button disabled className="w-full py-4 bg-slate-200 text-slate-400 rounded-xl font-bold text-lg flex items-center justify-center gap-2 cursor-not-allowed">
                                    <CheckCircle size={24} /> ALREADY DELIVERED
                                </button>
                            )}
                        </div>
                    </div>
                </div>
              )}

              {/* Scanner Overlay (Reused) */}
              {showScanner && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col">
                    <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                        <h2 className="text-white font-bold text-lg flex items-center gap-2"><QrCode /> Scan Delivery</h2>
                        <button onClick={stopScanner} className="bg-white/20 p-2 rounded-full text-white"><X size={24}/></button>
                    </div>
                    <div id="driver-reader" className="flex-1 bg-black w-full h-full"></div>
                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                            <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl"></div>
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl"></div>
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl"></div>
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl"></div>
                            </div>
                    </div>
                    {scanMessage && (
                        <div className="absolute bottom-20 left-4 right-4 z-30 animate-in slide-in-from-bottom-4 fade-in duration-300">
                            <div className={`p-4 rounded-xl flex items-center gap-3 shadow-2xl ${scanMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                {scanMessage.type === 'success' ? <CheckCircle className="shrink-0" size={24}/> : <X className="shrink-0" size={24}/>}
                                <div className="font-bold text-sm">{scanMessage.text}</div>
                            </div>
                        </div>
                    )}
                </div>
              )}

              {/* Manual Entry Modal */}
              {showManualEntry && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                              <h3 className="font-black text-slate-800">Manual Entry</h3>
                              <button onClick={() => { setShowManualEntry(false); setScanMessage(null); }} className="text-slate-400 hover:text-slate-600">
                                  <X size={20} />
                              </button>
                          </div>
                          <div className="p-5 space-y-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Invoice / Bill Number</label>
                                  <input 
                                      type="text" 
                                      value={manualBillNo}
                                      onChange={e => setManualBillNo(e.target.value)}
                                      placeholder="e.g. 4105"
                                      className="w-full text-2xl font-black text-center p-3 border-2 border-slate-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 outline-none uppercase"
                                      autoFocus
                                  />
                              </div>
                              {scanMessage && (
                                  <div className={`p-3 rounded-lg text-sm font-bold flex items-center gap-2 ${scanMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                      {scanMessage.type === 'success' ? <CheckCircle size={16}/> : <X size={16}/>}
                                      {scanMessage.text}
                                  </div>
                              )}
                              <button 
                                  onClick={() => {
                                      if (!manualBillNo.trim()) return;
                                      handleScanSuccess(manualBillNo);
                                  }}
                                  className="w-full py-3 bg-sky-600 text-white rounded-xl font-black text-lg shadow-lg shadow-sky-200 hover:bg-sky-700 active:scale-95 transition"
                              >
                                  MARK DELIVERED
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  return (
    <div className="space-y-4 h-full flex flex-col bg-slate-50/50 relative">
      
      {/* --- Top Control Bar --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Ticket className="text-sky-600" /> 
                {user?.role === UserRole.DRIVER ? 'My Deliveries' : 'Dispatch Tickets'}
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                {user?.role === UserRole.DRIVER ? `Vehicle: ${driverVehicle?.vehicle_number || 'Not Assigned'}` : 'Monitor Live Output & Logistics'}
            </p>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
              {user?.role === UserRole.DRIVER && (
                  <button 
                    onClick={startScanner}
                    className="bg-sky-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-200 active:scale-95 transition"
                  >
                      <ScanLine size={16} /> SCAN DELIVERY
                  </button>
              )}
              
              <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 ml-auto md:ml-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase pl-2">DATE:</span>
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:border-sky-400"
                  />
              </div>
          </div>
      </div>

      {/* --- Grand Summary Dashboard --- */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 px-1">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tickets</span>
              <span className="text-2xl font-black text-slate-800">{stats.count}</span>
          </div>
          <div className="bg-sky-600 p-3 rounded-xl shadow-md shadow-sky-100 flex flex-col items-center justify-center text-white">
              <span className="text-[10px] font-bold text-sky-100 uppercase tracking-wider">Total Qty</span>
              <span className="text-2xl font-black">{stats.totalQty}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Value</span>
              <span className="text-2xl font-black text-slate-800 flex items-center gap-0.5">
                  <span className="text-sm text-slate-400">₹</span>{stats.totalAmount.toLocaleString()}
              </span>
          </div>
      </div>

      {/* --- Ticket Grid --- */}
      <div className="flex-1 overflow-y-auto pb-20 px-1">
          {loading && bills.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
                  <div className="text-slate-400 font-bold text-xs">Loading Tickets...</div>
              </div>
          ) : displayedBills.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-300 border-2 border-dashed border-slate-200 rounded-2xl m-4">
                  <Ticket size={48} className="opacity-20 mb-2"/>
                  <p className="text-sm font-bold text-slate-400">No Tickets Found</p>
                  <p className="text-[10px]">No active invoices or dispatches for {selectedDate}.</p>
              </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
                  {displayedBills.map(bill => {
                      const statusClass = getStatusStyle(bill.status);
                      const typeClass = getTypeColor(bill.bill_type);
                      const time = new Date(bill.created_at || bill.bill_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                      const isExpanded = expandedCard === bill.id;
                      
                      return (
                      <div key={bill.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-all duration-200">
                          
                          {/* Header */}
                          <div className="p-3 border-b border-dashed border-slate-300 bg-slate-50/50 flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${typeClass}`}>
                                      {getTypeIcon(bill.bill_type)}
                                  </div>
                                  <div>
                                      <span className="text-base font-black text-slate-800 font-mono tracking-tight block leading-none">{bill.bill_no}</span>
                                      <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                                          <Clock size={9}/> {time}
                                      </span>
                                  </div>
                              </div>
                              <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wide border ${statusClass}`}>
                                  {(bill.status || 'APPROVED').replace(/_/g, ' ')}
                              </span>
                          </div>

                          {/* Body */}
                          <div className="p-4 flex-1 flex flex-col gap-3">
                              {/* Customer Info */}
                              <div className="bg-white">
                                  <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{bill.customer_name || 'Cash Sale'}</h3>
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                                      <MapPin size={10} className="shrink-0 text-slate-400"/> 
                                      <span className="truncate">{bill.customer_address || '-'}</span>
                                  </div>
                                  {bill.salesman_name && (
                                      <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-indigo-600">
                                          <Shield size={9}/> {bill.salesman_name}
                                      </div>
                                  )}
                              </div>

                              {/* Driver View: Show more details if it's my delivery */}
                              {user?.role === UserRole.DRIVER && (
                                  <div className="bg-sky-50 p-3 rounded-lg border border-sky-100">
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="text-[10px] font-bold text-sky-700 uppercase">Delivery Details</span>
                                          {bill.status === 'DELIVERED' ? (
                                              <CheckCircle size={14} className="text-emerald-500"/>
                                          ) : (
                                              <button 
                                                onClick={() => {
                                                    // Trigger manual scan/delivery for this specific bill
                                                    if(confirm("Mark this order as DELIVERED?")) {
                                                        handleScanSuccess(bill.bill_no);
                                                    }
                                                }}
                                                className="bg-sky-600 text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm active:scale-95"
                                              >
                                                  MARK DELIVERED
                                              </button>
                                          )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                                          <div>
                                              <span className="text-sky-400 block uppercase text-[8px]">Vehicle</span>
                                              <span className="font-bold text-sky-900">{bill.vehicle_number || '-'}</span>
                                          </div>
                                          <div className="text-right">
                                              <span className="text-sky-400 block uppercase text-[8px]">Contact</span>
                                              <span className="font-bold text-sky-900">{bill.phone_number || '-'}</span>
                                          </div>
                                      </div>
                                  </div>
                              )}

                              {/* Logistics (Compact Row) - Only show if NOT driver (since driver sees detailed view above) */}
                              {user?.role !== UserRole.DRIVER && (bill.vehicle_number || bill.driver_name) && (
                                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <Truck size={14} className="text-slate-400"/>
                                      <div className="flex-1 min-w-0">
                                          <span className="font-mono font-bold text-slate-700 text-xs block truncate">{bill.vehicle_number || 'No Vehicle'}</span>
                                          {bill.driver_name && <span className="text-[9px] text-slate-400 block truncate">{bill.driver_name}</span>}
                                      </div>
                                  </div>
                              )}

                              {/* Items List */}
                              <div className="border border-slate-100 rounded-lg overflow-hidden">
                                  <div 
                                    onClick={() => toggleExpand(bill.id)}
                                    className="bg-slate-50 p-2 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition"
                                  >
                                      <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                          <Package size={10}/> Items List
                                      </span>
                                      <div className="flex items-center gap-1">
                                          <span className="text-xs font-black text-slate-800">{bill.total_qty}</span>
                                          {isExpanded ? <ChevronUp size={12} className="text-slate-400"/> : <ChevronDown size={12} className="text-slate-400"/>}
                                      </div>
                                  </div>
                                  
                                  {/* Expanded Items */}
                                  {isExpanded && bill.items && (
                                      <div className="max-h-40 overflow-y-auto bg-white">
                                          <table className="w-full text-left text-[10px]">
                                              <tbody className="divide-y divide-slate-50">
                                                  {bill.items.map((item, idx) => (
                                                      <tr key={idx}>
                                                          <td className="p-2 font-medium text-slate-700 truncate max-w-[120px]">{item.product_name}</td>
                                                          <td className="p-2 text-right font-bold text-slate-900 w-12 bg-slate-50/50">{item.qty}</td>
                                                      </tr>
                                                  ))}
                                              </tbody>
                                          </table>
                                      </div>
                                  )}
                              </div>
                          </div>
                          
                          {/* Footer */}
                          <div className="p-3 bg-slate-50 border-t border-dashed border-slate-300 flex justify-between items-center">
                              <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Total Qty</span>
                                  <span className="text-sm font-black text-slate-800 leading-none">{bill.total_qty}</span>
                              </div>
                              
                              {bill.total_amount && bill.total_amount > 0 && (
                                  <div className="flex flex-col items-end">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase">Total Value</span>
                                      <span className="text-sm font-black text-slate-800 leading-none flex items-center">
                                          <IndianRupee size={10} strokeWidth={3}/> {bill.total_amount.toLocaleString()}
                                      </span>
                                  </div>
                              )}
                          </div>
                      </div>
                  )})}
              </div>
          )}
      </div>

      {/* --- SCANNER MODAL --- */}
      {showScanner && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
              <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                  <h2 className="text-white font-bold text-lg flex items-center gap-2"><QrCode /> Scan Delivery</h2>
                  <button onClick={stopScanner} className="bg-white/20 p-2 rounded-full text-white"><X size={24}/></button>
              </div>
              
              <div id="driver-reader" className="flex-1 bg-black w-full h-full"></div>

              {/* Overlay Frame */}
              <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl"></div>
                    </div>
              </div>

              {scanMessage && (
                  <div className="absolute bottom-20 left-4 right-4 z-30 animate-in slide-in-from-bottom-4 fade-in duration-300">
                      <div className={`p-4 rounded-xl flex items-center gap-3 shadow-2xl ${scanMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                          {scanMessage.type === 'success' ? <CheckCircle className="shrink-0" size={24}/> : <X className="shrink-0" size={24}/>}
                          <div className="font-bold text-sm">{scanMessage.text}</div>
                      </div>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

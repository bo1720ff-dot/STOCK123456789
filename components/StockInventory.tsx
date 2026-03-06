
import React, { useState, useEffect } from 'react';
import { productionModuleService, productionLogService, stockService } from '../services/supabase';
import { Grid, ScrollText, Copy, Save, RefreshCw, ChevronLeft, ChevronRight, FileDown, AlertTriangle, X, List } from 'lucide-react';

// --- DATE UTILITIES ---
const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getLocalToday = () => {
    return formatDate(new Date());
};

const addDays = (dateStr: string, days: number) => {
    const d = parseLocalDate(dateStr);
    d.setDate(d.getDate() + days);
    return formatDate(d);
};

interface DailyStatementSummary {
    date: string;
    totalProduction: number;
    totalSales: number;
    totalBalance: number;
    items: any[];
}

export const StockInventory: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'TODAY' | 'STATEMENTS'>('TODAY');
  const [loading, setLoading] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  // --- TAB 1: TODAY'S STOCK STATE ---
  const [date, setDate] = useState<string>(getLocalToday());
  const [inventoryData, setInventoryData] = useState<any[]>([]);

  // --- TAB 2: STATEMENTS STATE ---
  const [stmtStart, setStmtStart] = useState<string>(addDays(getLocalToday(), -30));
  const [stmtEnd, setStmtEnd] = useState<string>(getLocalToday());
  const [statements, setStatements] = useState<DailyStatementSummary[]>([]);
  const [viewStatement, setViewStatement] = useState<DailyStatementSummary | null>(null);

  // --- MODAL STATE: BREAKDOWN ---
  const [breakdownData, setBreakdownData] = useState<{ bill_no: string, customer: string, qty: number, status: string }[] | null>(null);
  const [breakdownProduct, setBreakdownProduct] = useState('');

  // ==========================================
  // TAB 1 LOGIC: TODAY'S WORKSPACE
  // ==========================================
  useEffect(() => {
    if (activeTab === 'TODAY') loadInventory();
  }, [date, activeTab]);

  const loadInventory = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Fetch Dashboard Data (From View)
      const dashboardRows = await productionModuleService.getDashboard(date);
      
      // 2. Fetch Pending Logs (Inputs from Employee App)
      const pendingLogs = await productionLogService.getByDate(date);
      const pending = pendingLogs.filter(l => l.status === 'PENDING');
      setHasPending(pending.length > 0);

      // 3. Merge Data (View Data + Pending Inputs for Preview)
      const formatted = dashboardRows.map(row => {
          // Find pending logs for this product to show "Potential" total
          const productPendingLogs = pending.filter(l => l.product_id === row.product_id || l.product_name === row.product_name);
          
          const pendingDay = productPendingLogs.filter(l => l.shift === 'Day').reduce((acc, l) => acc + Number(l.qty), 0);
          const pendingNight = productPendingLogs.filter(l => l.shift === 'Night').reduce((acc, l) => acc + Number(l.qty), 0);

          // The View already contains "Approved" production. We add "Pending" for visual preview.
          const finalDay = Number(row.day_production) + pendingDay;
          const finalNight = Number(row.night_production) + pendingNight;
          const finalTotalOut = Number(row.stock_out);
          const finalOpening = Number(row.opening);
          
          // Closing = Opening + (Approved + Pending Prod) - Sales
          const closing = finalOpening + finalDay + finalNight - finalTotalOut;

          return {
              id: row.product_id,
              date: row.date,
              product_id: row.product_id,
              product_name: row.product_name,
              opening_stock: finalOpening,
              day_production: finalDay,
              night_production: finalNight,
              stock_out: finalTotalOut,
              closing_stock: Number(closing.toFixed(2)),
              hasPending: pendingDay > 0 || pendingNight > 0, 
              note: '' 
          };
      });
      
      setInventoryData(formatted);

    } catch (e) {
      console.error(e);
      if(!silent) alert("Failed to load data");
    } finally {
      if(!silent) setLoading(false);
    }
  };

  const handleCopyTable = () => {
      if (inventoryData.length === 0) return;
      const headers = ['Product', 'Today Stock', 'Day P.', 'Night P.', 'Total Prod', 'Out', 'Available'];
      const rows = inventoryData.map(row => [
          row.product_name,
          row.opening_stock,
          row.day_production,
          row.night_production,
          (row.day_production + row.night_production),
          row.stock_out,
          row.closing_stock
      ].join('\t'));
      const text = [headers.join('\t'), ...rows].join('\n');
      navigator.clipboard.writeText(text);
      alert("Table copied to clipboard!");
  };

  const handleSave = async () => {
    // In the new system, "Save" essentially means "Approve All Pending Inputs"
    // Sales are already auto-synced.
    if (!hasPending) {
        alert("Data is auto-saved. No pending production inputs to approve.");
        return;
    }

    if(!window.confirm("Approve all pending production inputs for this date?")) return;

    setLoading(true);
    try {
      await productionLogService.approveAllByDate(date);
      alert("All pending inputs approved & stock updated!");
      loadInventory(true); 
    } catch (e) {
      console.error(e);
      alert("Failed to approve inputs");
    } finally {
      setLoading(false);
    }
  };

  const downloadWorksheetPDF = () => {
      const totalOp = inventoryData.reduce((a,b)=>a+b.opening_stock,0);
      const totalDay = inventoryData.reduce((a,b)=>a+b.day_production,0);
      const totalNight = inventoryData.reduce((a,b)=>a+b.night_production,0);
      const totalOut = inventoryData.reduce((a,b)=>a+b.stock_out,0);
      const totalClose = inventoryData.reduce((a,b)=>a+b.closing_stock,0);

      const summary: DailyStatementSummary = {
          date: date,
          totalProduction: totalDay + totalNight,
          totalSales: totalOut,
          totalBalance: totalClose,
          items: inventoryData
      };
      handlePrintStatement(summary);
  };

  const handleViewBreakdown = async (row: any) => {
      if (row.stock_out <= 0) return;
      
      setBreakdownProduct(row.product_name);
      setLoading(true);
      try {
          const details = await stockService.getBreakdown(date, row.product_id);
          setBreakdownData(details);
      } catch (e) {
          alert("Failed to fetch details");
      } finally {
          setLoading(false);
      }
  };

  // ==========================================
  // TAB 2 LOGIC: STATEMENTS
  // ==========================================
  
  const loadStatements = async () => {
      setLoading(true);
      try {
          const d1 = new Date(stmtStart);
          const d2 = new Date(stmtEnd);
          const dates = [];
          while (d1 <= d2) {
              dates.push(new Date(d1).toISOString().split('T')[0]);
              d1.setDate(d1.getDate() + 1);
          }
          dates.reverse();

          const summaries: DailyStatementSummary[] = [];

          for (const d of dates) {
              // Fetch from View directly
              const rows = await productionModuleService.getDashboard(d);
              if (rows.length === 0) continue;

              let tProd = 0, tSale = 0, tCl = 0;
              const items = rows.map(r => {
                  const prod = Number(r.total_production);
                  const sale = Number(r.stock_out);
                  const close = Number(r.closing_stock);
                  tProd += prod; tSale += sale; tCl += close;
                  return {
                      product_name: r.product_name,
                      opening_stock: r.opening,
                      day_production: r.day_production,
                      night_production: r.night_production,
                      stock_out: sale,
                      closing_stock: close,
                      note: '' 
                  };
              });

              if (tProd > 0 || tSale > 0 || tCl > 0) {
                  summaries.push({
                      date: d,
                      totalProduction: tProd,
                      totalSales: tSale,
                      totalBalance: tCl,
                      items: items
                  });
              }
          }
          setStatements(summaries);
      } catch (e) {
          console.error(e);
          alert("Error loading statements.");
      } finally {
          setLoading(false);
      }
  };

  const handlePrintStatement = (summary: DailyStatementSummary) => {
      const rows = summary.items.map(item => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 6px; font-weight: bold; font-size: 10px; text-align: left;">${item.product_name}</td>
            <td style="padding: 6px; text-align: center; font-size: 10px;">${item.opening_stock}</td>
            <td style="padding: 6px; text-align: center; font-size: 10px;">${item.day_production || '-'}</td>
            <td style="padding: 6px; text-align: center; font-size: 10px;">${item.night_production || '-'}</td>
            <td style="padding: 6px; text-align: center; font-size: 10px; background-color: #f0fdf4;">${(item.day_production||0) + (item.night_production||0)}</td>
            <td style="padding: 6px; text-align: center; color: #dc2626; font-size: 10px; font-weight: bold;">${item.stock_out || '-'}</td>
            <td style="padding: 6px; text-align: center; font-weight: bold; font-size: 10px; color: #166534; background-color: #f1f5f9;">${item.closing_stock}</td>
        </tr>
      `).join('');

      const content = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #000; width: 100%;">
            <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
                <div>
                    <h1 style="font-size: 20px; font-weight: 900; text-transform: uppercase;">GREENZAR FOOD & BEVERAGE</h1>
                    <p style="margin: 2px 0 0; font-size: 10px; font-weight: bold;">Stock Statement</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 2px 0 0; font-size: 11px; font-weight: bold;">Date: ${summary.date}</p>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <thead>
                    <tr style="border-bottom: 2px solid #000; background-color: #f3f4f6;">
                        <th style="padding: 8px; text-align: left;">PRODUCT</th>
                        <th style="padding: 8px; text-align: center;">OPENING</th>
                        <th style="padding: 8px; text-align: center;">DAY</th>
                        <th style="padding: 8px; text-align: center;">NIGHT</th>
                        <th style="padding: 8px; text-align: center;">TOTAL PROD</th>
                        <th style="padding: 8px; text-align: center;">OUT</th>
                        <th style="padding: 8px; text-align: center;">CLOSING</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
      `;
      const element = document.createElement('div');
      element.innerHTML = content;
      const opt = { margin: 10, filename: `Statement_${summary.date}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
      // @ts-ignore
      if (window.html2pdf) window.html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="space-y-4 h-full flex flex-col pb-20 relative">
      
      <div className="flex justify-center mb-2">
          <div className="bg-slate-200 p-1 rounded-full flex gap-1 shadow-inner">
              <button onClick={() => setActiveTab('TODAY')} className={`px-6 py-2 rounded-full text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'TODAY' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Grid size={16}/> LIVE STOCK
              </button>
              <button onClick={() => setActiveTab('STATEMENTS')} className={`px-6 py-2 rounded-full text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'STATEMENTS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <ScrollText size={16}/> HISTORY
              </button>
          </div>
      </div>

      {activeTab === 'TODAY' && (
          <div className="flex-1 flex flex-col space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                       <Grid className="text-sky-500" /> Live Stock Worksheet
                    </h2>
                    <p className="text-xs text-slate-400 font-bold mt-1">Automatic Calculation • {date}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                   <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                        <button onClick={() => setDate(addDays(date, -1))} className="p-2 hover:bg-white rounded shadow-sm text-slate-600"><ChevronLeft size={18} /></button>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-800 outline-none w-32 text-center"/>
                        <button onClick={() => setDate(addDays(date, 1))} className="p-2 hover:bg-white rounded shadow-sm text-slate-600"><ChevronRight size={18} /></button>
                   </div>
                   <button onClick={() => loadInventory()} className="p-2.5 bg-gray-50 text-sky-600 rounded-lg hover:bg-sky-50 font-bold text-xs flex items-center gap-2 shadow-sm border border-gray-200" title="Refresh">
                     <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 
                   </button>
                   <button onClick={handleCopyTable} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-bold text-xs flex items-center gap-2 shadow-sm border border-indigo-100">
                     <Copy size={16} /> Copy
                   </button>
                   <button onClick={downloadWorksheetPDF} className="p-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-bold text-xs flex items-center gap-2 shadow-sm border border-red-100">
                     <FileDown size={16} /> PDF
                   </button>
                   {hasPending && (
                       <button onClick={handleSave} className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold text-xs flex items-center gap-2 shadow-md animate-pulse">
                         <Save size={16} /> APPROVE INPUTS
                       </button>
                   )}
                </div>
              </div>

              {hasPending && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                          <AlertTriangle className="text-amber-500" size={20} />
                          <div>
                              <p className="text-xs font-bold text-amber-800">Pending Production Detected</p>
                              <p className="text-[10px] text-amber-600">Inputs are shown in the table but not yet final. Click "APPROVE INPUTS" to finalize.</p>
                          </div>
                      </div>
                  </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-slate-300 flex-1 flex flex-col overflow-hidden relative">
                <div className="overflow-auto flex-1 pb-10">
                  <table className="w-full text-left border-collapse border border-slate-300 min-w-[800px]">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0 z-20 text-[11px] font-bold uppercase tracking-wider shadow-sm">
                      <tr>
                        <th className="p-3 text-left w-64 sticky left-0 bg-slate-100 z-30 border border-slate-300">Product</th>
                        <th className="p-2 border border-slate-300 text-center bg-gray-50 text-gray-700">Opening</th>
                        <th className="p-2 border border-slate-300 text-center text-amber-700">Day P.</th>
                        <th className="p-2 border border-slate-300 text-center text-indigo-700">Night P.</th>
                        <th className="p-2 border border-slate-300 bg-green-50 text-green-700 text-center">Total Prod</th>
                        <th className="p-2 border border-slate-300 bg-red-50 text-red-700 text-center">Out</th>
                        <th className="p-2 border border-slate-300 bg-slate-200 text-slate-800 text-center">Available</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loading && inventoryData.length === 0 ? (
                         <tr><td colSpan={7} className="p-10 text-center text-slate-400">Loading Live Data...</td></tr>
                      ) : (
                        inventoryData.map((row, idx) => {
                            const totalProd = (row.day_production || 0) + (row.night_production || 0);
                            return (
                              <tr key={row.product_id} className={`group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                <td className="p-2 font-bold text-slate-800 sticky left-0 bg-inherit z-10 border border-slate-300">
                                  {row.product_name}
                                  {row.hasPending && <span className="ml-2 w-2 h-2 rounded-full bg-amber-500 inline-block" title="Has Pending Inputs"></span>}
                                </td>
                                <td className="p-2 text-center border border-slate-300 bg-gray-50 font-mono font-bold text-gray-600">
                                    {row.opening_stock}
                                </td>
                                <td className="p-2 text-center border border-slate-300 font-mono font-bold text-amber-700">
                                    {row.day_production || '-'}
                                </td>
                                <td className="p-2 text-center border border-slate-300 font-mono font-bold text-indigo-700">
                                    {row.night_production || '-'}
                                </td>
                                <td className="p-2 text-center border border-slate-300 bg-green-50 font-mono font-black text-green-700">
                                    {totalProd > 0 ? totalProd : '-'}
                                </td>
                                
                                {/* CLICKABLE STOCK OUT CELL */}
                                <td className="p-2 text-center border border-slate-300 bg-red-50 font-mono font-black text-red-600 relative">
                                    {row.stock_out > 0 ? (
                                        <button 
                                            onClick={() => handleViewBreakdown(row)}
                                            className="hover:underline hover:text-red-800 flex items-center justify-center w-full gap-1"
                                            title="View Breakdown"
                                        >
                                            {row.stock_out} <List size={10} />
                                        </button>
                                    ) : (
                                        '-'
                                    )}
                                </td>
                                
                                <td className="p-2 text-center border border-slate-300 bg-slate-100 font-mono font-black text-slate-800">
                                    {row.closing_stock}
                                </td>
                              </tr>
                            );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
      )}

      {/* STATEMENTS TAB (Read Only History) */}
      {activeTab === 'STATEMENTS' && (
          <div className="flex-1 flex flex-col space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                     <ScrollText className="text-indigo-500" /> Historical Statements
                  </h2>
                  <div className="flex gap-2">
                      <input type="date" value={stmtStart} onChange={e => setStmtStart(e.target.value)} className="border rounded p-1"/>
                      <input type="date" value={stmtEnd} onChange={e => setStmtEnd(e.target.value)} className="border rounded p-1"/>
                      <button onClick={loadStatements} className="bg-indigo-600 text-white px-3 py-1 rounded font-bold text-xs">Find</button>
                  </div>
              </div>
              <div className="flex-1 overflow-auto space-y-3">
                  {statements.map((stmt) => (
                      <div key={stmt.date} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex justify-between items-center">
                          <div>
                              <h4 className="font-black text-slate-800">{stmt.date}</h4>
                              <p className="text-xs text-gray-500">Prod: {stmt.totalProduction} | Sales: {stmt.totalSales}</p>
                          </div>
                          <button onClick={() => handlePrintStatement(stmt)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-xs">PDF</button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- BREAKDOWN MODAL --- */}
      {breakdownData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
                  <div className="bg-red-50 p-5 border-b border-red-100 flex justify-between items-center">
                      <div>
                          <h3 className="font-black text-red-800 text-lg">Stock Out Details</h3>
                          <p className="text-xs text-red-600 font-bold mt-1">{breakdownProduct} • {date}</p>
                      </div>
                      <button onClick={() => setBreakdownData(null)} className="p-2 bg-white rounded-full text-red-400 hover:text-red-600 shadow-sm"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4">
                      {breakdownData.length === 0 ? (
                          <div className="text-center p-8 text-gray-400 text-xs">No records found.</div>
                      ) : (
                          <table className="w-full text-left text-xs">
                              <thead className="bg-red-50/50 text-red-800 uppercase font-bold sticky top-0">
                                  <tr>
                                      <th className="p-3 rounded-l-lg">Bill No</th>
                                      <th className="p-3">Customer</th>
                                      <th className="p-3">Status</th>
                                      <th className="p-3 text-right rounded-r-lg">Qty</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-red-50">
                                  {breakdownData.map((item, i) => (
                                      <tr key={i} className="hover:bg-red-50/30">
                                          <td className="p-3 font-mono font-bold text-gray-700">{item.bill_no}</td>
                                          <td className="p-3 font-bold text-gray-800 truncate max-w-[150px]">{item.customer}</td>
                                          <td className="p-3">
                                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[9px] uppercase font-bold border border-gray-200">
                                                  {item.status.replace(/_/g, ' ')}
                                              </span>
                                          </td>
                                          <td className="p-3 text-right font-black text-red-600">{item.qty}</td>
                                      </tr>
                                  ))}
                              </tbody>
                              <tfoot className="border-t border-red-200 font-black text-sm">
                                  <tr>
                                      <td colSpan={3} className="p-3 text-right text-red-800">TOTAL OUT:</td>
                                      <td className="p-3 text-right text-red-600">{breakdownData.reduce((a,b) => a + b.qty, 0)}</td>
                                  </tr>
                              </tfoot>
                          </table>
                      )}
                  </div>
                  
                  <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                      <button onClick={() => setBreakdownData(null)} className="px-6 py-2 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition">
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { productService, dailyReportService, stockService } from '../services/supabase';
import { DailyReportEntry, Product, UserRole, User } from '../types';
import { Save, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Clipboard, PackagePlus, ArrowDownToLine, Calculator, ArrowLeftRight } from 'lucide-react';

interface DailyProductReportProps {
    user: User | null;
}

export const DailyProductReport: React.FC<DailyProductReportProps> = ({ user }) => {
    // Ensure we use local date to match what the user expects for "Today"
    const getLocalToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState<string>(getLocalToday());
    const [loading, setLoading] = useState(false);
    const [entries, setEntries] = useState<DailyReportEntry[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    useEffect(() => {
        loadData();
    }, [date]);

    const loadData = async (forceSync = false) => {
        setLoading(true);
        try {
            // 1. Fetch Products (Critical)
            const prods = await productService.getAll().catch(e => {
                console.error("Failed to load products", e);
                return [];
            });
            setProducts(prods);

            if (prods.length === 0) {
                setEntries([]);
                setLoading(false);
                return;
            }

            // 2. Fetch Saved Report (The snapshot)
            const savedReport = await dailyReportService.getByDate(date).catch(e => []);

            // 3. Fetch Live Data (Production from 'daily_stock' & Sales from Bills)
            const liveStockEntries = await stockService.getByDate(date).catch(e => []);
            const liveSalesMap = await stockService.getStockOutByDate(date).catch(e => ({}));

            // Merge Logic
            const merged = await Promise.all(prods.map(async (p) => {
                const saved = savedReport.find(r => r.product_name === p.product_name);
                const liveProd = liveStockEntries.find(s => s.product_id === p.id);
                const liveSaleQty = liveSalesMap[p.product_name.trim().toLowerCase()] || 0;

                let opening = 0;
                
                // Opening Stock Logic:
                // If forceSync is ON, ignore saved opening and fetch fresh previous closing
                if (saved && !forceSync) {
                    opening = Number(saved.opening_stock);
                } else {
                    opening = await dailyReportService.getPreviousClosing(p.product_name, date);
                }

                // Smart Sync Logic:
                // If forceSync is true -> Use LIVE data.
                // If NO saved record -> Use LIVE data.
                // If Saved record has 0 production BUT Live data has production -> Use LIVE (Auto-update for ease).
                let useLive = forceSync || !saved;
                
                if (saved && !forceSync) {
                    const savedProd = Number(saved.production_day) + Number(saved.production_night);
                    const liveProdTotal = Number(liveProd?.day_production || 0) + Number(liveProd?.night_production || 0);
                    // If saved is 0 but live is > 0, suggest live (or auto-switch if logic permits).
                    if (savedProd === 0 && liveProdTotal > 0) useLive = true;
                }

                const prodDay = useLive ? Number(liveProd?.day_production || 0) : Number(saved?.production_day || 0);
                const prodNight = useLive ? Number(liveProd?.night_production || 0) : Number(saved?.production_night || 0);
                const stockIn = useLive ? (saved ? Number(saved.stock_in) : 0) : Number(saved?.stock_in || 0); 
                // For Sales, we usually want live unless manually overridden/saved.
                // If saved exists, use saved. If not, live.
                const stockOut = saved && !useLive ? Number(saved.stock_out) : liveSaleQty;
                
                const remarks = saved ? saved.remarks : '';

                // Calculate Closing
                const totalAvail = opening + prodDay + prodNight + stockIn;
                const closing = totalAvail - stockOut;

                return {
                    product_name: p.product_name,
                    date: date,
                    opening_stock: opening,
                    production_day: prodDay,
                    production_night: prodNight,
                    stock_in: stockIn,
                    stock_out: stockOut,
                    closing_stock: closing,
                    remarks: remarks
                };
            }));

            setEntries(merged);
        } catch (e) {
            console.error("Critical failure in loadData", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncOpeningOnly = async () => {
        if (!window.confirm("Refresh OPENING STOCK from Previous Day's Closing?\n\nThis will update the 'Opening' column for all products based on yesterday's final numbers.")) return;
        
        setLoading(true);
        try {
            const updatedEntries = await Promise.all(entries.map(async (entry) => {
                // Fetch previous closing strictly
                const prevClosing = await dailyReportService.getPreviousClosing(entry.product_name, date);
                
                // Recalculate this row
                const totalProd = (entry.production_day || 0) + (entry.production_night || 0);
                const totalAvail = prevClosing + totalProd + (entry.stock_in || 0);
                const closing = totalAvail - (entry.stock_out || 0);

                return {
                    ...entry,
                    opening_stock: prevClosing,
                    closing_stock: closing
                };
            }));

            setEntries(updatedEntries);
            // Optional: Auto-save immediately so they don't lose the sync
            await dailyReportService.upsert(updatedEntries);
            alert("Opening Stock Synchronized!");
        } catch (e) {
            console.error(e);
            alert("Failed to sync opening stock.");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (index: number, field: keyof DailyReportEntry, value: string) => {
        const newEntries = [...entries];
        const entry = { ...newEntries[index] };
        
        if (field === 'remarks') {
            entry.remarks = value;
        } else {
            const numVal = parseFloat(value) || 0;
            // @ts-ignore
            entry[field] = numVal;
        }

        // Auto Calculate Logic
        const totalProd = (entry.production_day || 0) + (entry.production_night || 0);
        const totalAvail = (entry.opening_stock || 0) + totalProd + (entry.stock_in || 0);
        entry.closing_stock = totalAvail - (entry.stock_out || 0);

        newEntries[index] = entry;
        setEntries(newEntries);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await dailyReportService.upsert(entries);
            alert("Daily Report Saved Successfully!");
            loadData(false); // Reload but keep saved values
        } catch (e) {
            console.error(e);
            alert("Failed to save report.");
        } finally {
            setLoading(false);
        }
    };

    const shiftDate = (days: number) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setDate(`${year}-${month}-${day}`);
    };

    // Calculate Summaries
    const totalProdDay = entries.reduce((acc, e) => acc + (e.production_day || 0), 0);
    const totalProdNight = entries.reduce((acc, e) => acc + (e.production_night || 0), 0);
    const totalIn = entries.reduce((acc, e) => acc + (e.stock_in || 0), 0);
    const totalOut = entries.reduce((acc, e) => acc + (e.stock_out || 0), 0);

    const isDateLocked = user?.role === UserRole.SALESMAN && date !== getLocalToday();

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Clipboard className="text-sky-500" /> Daily Product Report
                    </h2>
                    <p className="text-xs text-slate-400 font-bold mt-1">Production, Stock Movement & Closing</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <button onClick={() => shiftDate(-1)} disabled={user?.role === UserRole.SALESMAN} className="p-2 hover:bg-white rounded shadow-sm text-slate-600 disabled:opacity-50"><ChevronLeft size={18} /></button>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)} 
                        disabled={user?.role === UserRole.SALESMAN}
                        className="bg-transparent border-none text-sm font-bold text-slate-800 outline-none text-center w-32 disabled:opacity-70"
                    />
                    <button onClick={() => shiftDate(1)} disabled={user?.role === UserRole.SALESMAN} className="p-2 hover:bg-white rounded shadow-sm text-slate-600 disabled:opacity-50"><ChevronRight size={18} /></button>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => loadData(true)} 
                        className="bg-indigo-50 text-indigo-600 px-3 py-2.5 rounded-lg font-bold shadow-sm hover:bg-indigo-100 transition flex items-center gap-2 text-xs border border-indigo-100" 
                        title="Force refresh live production & sales"
                    >
                        <ArrowDownToLine size={16} /> SYNC LIVE
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isDateLocked || loading || entries.length === 0} 
                        className="bg-sky-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-sky-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={18}/> SAVE
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Production (Day)</div>
                    <div className="text-xl font-black text-amber-600">{totalProdDay}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Production (Night)</div>
                    <div className="text-xl font-black text-indigo-600">{totalProdNight}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Total Stock IN</div>
                    <div className="text-xl font-black text-blue-600">{totalIn}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Total Stock OUT</div>
                    <div className="text-xl font-black text-red-600">{totalOut}</div>
                </div>
            </div>

            {/* Warning Message if Date Locked */}
            {isDateLocked && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-100">
                    <AlertCircle size={16}/> Viewing Past Record - Read Only Mode
                </div>
            )}

            {/* Data Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-300 flex-1 flex flex-col overflow-hidden relative">
                <div className="overflow-auto flex-1 pb-10">
                    <table className="w-full text-left border-collapse border border-slate-300 min-w-[1000px]">
                        <thead className="bg-slate-100 text-slate-600 sticky top-0 z-20 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            <tr>
                                <th className="p-3 w-48 sticky left-0 bg-slate-100 z-30 border border-slate-300">Product Name</th>
                                <th className="p-2 border border-slate-300 text-center w-24 bg-gray-50">
                                    <div className="flex items-center justify-center gap-1">
                                        Opening
                                        <button 
                                            onClick={handleSyncOpeningOnly} 
                                            disabled={isDateLocked}
                                            className="p-1 hover:bg-gray-200 rounded text-sky-600 transition" 
                                            title="Pull Yesterday's Closing"
                                        >
                                            <RefreshCw size={12} />
                                        </button>
                                    </div>
                                </th>
                                <th className="p-2 border border-slate-300 text-center w-24 bg-amber-50 text-amber-800">Prod (Day)</th>
                                <th className="p-2 border border-slate-300 text-center w-24 bg-indigo-50 text-indigo-800">Prod (Night)</th>
                                <th className="p-2 border border-slate-300 text-center w-24 bg-blue-50 text-blue-800">Stock IN</th>
                                <th className="p-2 border border-slate-300 text-center w-24 bg-red-50 text-red-800">Stock OUT</th>
                                <th className="p-2 border border-slate-300 text-center w-28 bg-green-50 text-green-800">Closing</th>
                                <th className="p-2 border border-slate-300 text-left">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs font-medium">
                            {loading ? (
                                <tr><td colSpan={8} className="p-12 text-center text-gray-400 font-bold animate-pulse">Loading report data...</td></tr>
                            ) : entries.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <PackagePlus size={48} className="text-gray-200" />
                                            <p className="font-bold text-gray-500">No products available.</p>
                                            <p className="text-xs max-w-xs text-center">
                                                Go to <b>Masters &gt; Products</b> to add items first.
                                            </p>
                                            <button onClick={() => loadData(true)} className="mt-2 text-sky-600 font-bold underline">Retry Loading</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                entries.map((entry, idx) => (
                                    <tr key={idx} className={`hover:bg-slate-50 ${entry.closing_stock < 10 ? 'bg-red-50/50' : 'bg-white'}`}>
                                        <td className="p-2 sticky left-0 bg-inherit z-10 border border-slate-300 font-bold text-slate-700">
                                            {entry.product_name}
                                            {entry.closing_stock < 10 && <span className="ml-2 text-[8px] bg-red-100 text-red-600 px-1 rounded border border-red-200">LOW</span>}
                                        </td>
                                        <td className="p-0 border border-slate-300 bg-gray-50">
                                            <input 
                                                type="number" 
                                                value={entry.opening_stock} 
                                                onChange={e => handleInputChange(idx, 'opening_stock', e.target.value)}
                                                disabled={isDateLocked}
                                                className="w-full h-full p-2 text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-sky-300 text-slate-600 font-bold disabled:bg-gray-50" 
                                            />
                                        </td>
                                        <td className="p-0 border border-slate-300">
                                            <input 
                                                type="number" 
                                                value={entry.production_day} 
                                                onChange={e => handleInputChange(idx, 'production_day', e.target.value)}
                                                disabled={isDateLocked}
                                                className="w-full h-full p-2 text-center bg-transparent outline-none focus:bg-amber-50 focus:ring-2 focus:ring-inset focus:ring-amber-300 text-amber-700 font-bold disabled:bg-gray-50"
                                            />
                                        </td>
                                        <td className="p-0 border border-slate-300">
                                            <input 
                                                type="number" 
                                                value={entry.production_night} 
                                                onChange={e => handleInputChange(idx, 'production_night', e.target.value)}
                                                disabled={isDateLocked}
                                                className="w-full h-full p-2 text-center bg-transparent outline-none focus:bg-indigo-50 focus:ring-2 focus:ring-inset focus:ring-indigo-300 text-indigo-700 font-bold disabled:bg-gray-50"
                                            />
                                        </td>
                                        <td className="p-0 border border-slate-300">
                                            <input 
                                                type="number" 
                                                value={entry.stock_in} 
                                                onChange={e => handleInputChange(idx, 'stock_in', e.target.value)}
                                                disabled={isDateLocked}
                                                className="w-full h-full p-2 text-center bg-transparent outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-300 text-blue-700 font-bold disabled:bg-gray-50"
                                            />
                                        </td>
                                        <td className="p-0 border border-slate-300">
                                            <input 
                                                type="number" 
                                                value={entry.stock_out} 
                                                onChange={e => handleInputChange(idx, 'stock_out', e.target.value)}
                                                disabled={isDateLocked}
                                                className="w-full h-full p-2 text-center bg-transparent outline-none focus:bg-red-50 focus:ring-2 focus:ring-inset focus:ring-red-300 text-red-600 font-bold disabled:bg-gray-50"
                                            />
                                        </td>
                                        <td className="p-0 border border-slate-300 bg-green-50">
                                            <div className={`w-full h-full p-2 text-center font-black text-sm flex items-center justify-center ${entry.closing_stock < 0 ? 'text-red-600' : 'text-green-800'}`}>
                                                {entry.closing_stock}
                                            </div>
                                        </td>
                                        <td className="p-0 border border-slate-300">
                                            <input 
                                                type="text" 
                                                value={entry.remarks} 
                                                onChange={e => handleInputChange(idx, 'remarks', e.target.value)}
                                                disabled={isDateLocked}
                                                placeholder="Notes..."
                                                className="w-full h-full p-2 bg-transparent outline-none text-slate-600 text-xs disabled:bg-gray-50"
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

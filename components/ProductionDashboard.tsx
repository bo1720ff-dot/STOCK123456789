
import React, { useState, useEffect } from 'react';
import { productionModuleService, productService } from '../services/supabase';
import { ProdDashboardRow, Product, ProdShift, User, UserRole } from '../types';
import { Calendar, RefreshCw, Plus, Package, Truck, AlertTriangle, Lock, Unlock, Database, User as UserIcon, BarChart3, ArrowRight, Settings, ArrowDownToLine } from 'lucide-react';

interface ProductionDashboardProps {
    user: User;
}

export const ProductionDashboard: React.FC<ProductionDashboardProps> = ({ user }) => {
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [rows, setRows] = useState<ProdDashboardRow[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    
    // UI States
    const [showProdModal, setShowProdModal] = useState(false);
    const [showOutModal, setShowOutModal] = useState(false);
    const [showAdjModal, setShowAdjModal] = useState(false);

    // Form States
    const [selectedProduct, setSelectedProduct] = useState('');
    const [shift, setShift] = useState<ProdShift>('DAY');
    const [qty, setQty] = useState('');
    const [remark, setRemark] = useState(''); // Used for Ref No or Reason

    const isAdmin = user.role === UserRole.ADMIN;

    useEffect(() => {
        loadData();
        productService.getAll().then(setProducts);
    }, [date]);

    const loadData = async () => {
        setLoading(true);
        try {
            // First ensure day is initialized
            await productionModuleService.initializeDay(date);
            // Then fetch view
            const data = await productionModuleService.getDashboard(date);
            setRows(data);
        } catch (e) {
            console.error(e);
            alert("Failed to load dashboard");
        } finally {
            setLoading(false);
        }
    };

    const handleSyncOpening = async () => {
        if (!window.confirm("Recalculate Opening Stock from Previous Day's Closing?\n\nThis will overwrite manual opening stock entries for this date.")) return;
        
        setLoading(true);
        try {
            await productionModuleService.recalculateDayOpening(date);
            await loadData();
            alert("Opening stock synced.");
        } catch (e) {
            console.error(e);
            alert("Failed to sync opening stock.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddProduction = async () => {
        if (!selectedProduct || !qty) return;
        try {
            await productionModuleService.addProduction({
                product_id: selectedProduct,
                date: date,
                shift: shift,
                qty: parseFloat(qty),
                operator_name: user.name
            });
            setShowProdModal(false);
            setQty('');
            loadData();
        } catch (e: any) {
            alert("Failed: " + e.message);
        }
    };

    const handleAddStockOut = async () => {
        if (!selectedProduct || !qty) return;
        // Validation check vs available stock?
        const currentRow = rows.find(r => r.product_id === selectedProduct);
        const currentStock = currentRow ? currentRow.closing_stock : 0;
        
        if (parseFloat(qty) > currentStock) {
            if (!window.confirm(`⚠️ WARNING: Stock Out (${qty}) is greater than Available (${currentStock}). Proceed?`)) return;
        }

        try {
            await productionModuleService.addStockOut({
                product_id: selectedProduct,
                date: date,
                qty: parseFloat(qty),
                out_type: 'dispatch',
                reference_no: remark || 'Manual Dispatch'
            });
            setShowOutModal(false);
            setQty('');
            setRemark('');
            loadData();
        } catch (e: any) {
            alert("Failed: " + e.message);
        }
    };

    const handleAdjustment = async () => {
        if (!selectedProduct || !qty || !remark) {
            alert("Please fill all fields for adjustment.");
            return;
        }
        try {
            await productionModuleService.addAdjustment(selectedProduct, date, parseFloat(qty), remark, user.name);
            setShowAdjModal(false);
            setQty('');
            setRemark('');
            loadData();
        } catch (e: any) {
            alert("Failed: " + e.message);
        }
    };

    const handleLockDay = async () => {
        if (!window.confirm("Lock this day? This will prevent further edits.")) return;
        try {
            await productionModuleService.lockDay(date);
            loadData();
        } catch (e) {
            alert("Failed to lock day");
        }
    };

    // Calculate Summary
    const totalProd = rows.reduce((a, b) => a + Number(b.total_production), 0);
    const totalOut = rows.reduce((a, b) => a + Number(b.stock_out), 0);
    const totalClosing = rows.reduce((a, b) => a + Number(b.closing_stock), 0);
    const isDayLocked = rows.length > 0 && rows[0].is_locked;

    return (
        <div className="space-y-6 h-full flex flex-col">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Database className="text-sky-600" /> Production & Stock Control
                    </h2>
                    <p className="text-xs text-slate-400 font-bold mt-1">Live Backend Calculations View</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input 
                            type="date" 
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-200"
                        />
                    </div>
                    <button onClick={handleSyncOpening} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition border border-amber-200" title="Sync Opening from Yesterday">
                        <ArrowDownToLine size={18} />
                    </button>
                    <button onClick={loadData} className="p-2 bg-slate-50 text-slate-500 rounded-lg hover:text-sky-600 transition">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {isAdmin && (
                        <button 
                            onClick={handleLockDay}
                            disabled={isDayLocked}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white transition ${isDayLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900'}`}
                        >
                            {isDayLocked ? <Lock size={14} /> : <Unlock size={14} />}
                            {isDayLocked ? 'DAY LOCKED' : 'LOCK DAY'}
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Production</span>
                        <div className="text-2xl font-black text-slate-800 mt-1">{totalProd}</div>
                    </div>
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                        <Package size={20} />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Total Dispatch</span>
                        <div className="text-2xl font-black text-slate-800 mt-1">{totalOut}</div>
                    </div>
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                        <Truck size={20} />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Closing Stock</span>
                        <div className="text-2xl font-black text-slate-800 mt-1">{totalClosing}</div>
                    </div>
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <BarChart3 size={20} />
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            {!isDayLocked && (
                <div className="flex gap-3">
                    <button onClick={() => setShowProdModal(true)} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-md shadow-emerald-100 hover:bg-emerald-700 transition flex items-center justify-center gap-2">
                        <Plus size={18} /> Add Production
                    </button>
                    <button onClick={() => setShowOutModal(true)} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold shadow-md shadow-red-100 hover:bg-red-700 transition flex items-center justify-center gap-2">
                        <ArrowRight size={18} /> Add Dispatch / Stock Out
                    </button>
                    {isAdmin && (
                        <button onClick={() => setShowAdjModal(true)} className="px-6 bg-slate-600 text-white py-3 rounded-xl font-bold shadow-md shadow-slate-200 hover:bg-slate-700 transition flex items-center justify-center gap-2">
                            <Settings size={18} /> Adjust
                        </button>
                    )}
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
                            <tr>
                                <th className="p-4 border-b border-slate-200">Product</th>
                                <th className="p-4 border-b border-slate-200 text-center bg-gray-50">Opening</th>
                                <th className="p-4 border-b border-slate-200 text-center text-amber-600">Day Prod</th>
                                <th className="p-4 border-b border-slate-200 text-center text-indigo-600">Night Prod</th>
                                <th className="p-4 border-b border-slate-200 text-center text-purple-600">Extra</th>
                                <th className="p-4 border-b border-slate-200 text-center bg-green-50 text-green-700">Total Prod</th>
                                <th className="p-4 border-b border-slate-200 text-center bg-red-50 text-red-700">Stock Out</th>
                                <th className="p-4 border-b border-slate-200 text-center text-slate-400">Adj</th>
                                <th className="p-4 border-b border-slate-200 text-center bg-slate-100 text-slate-800 font-black">Closing</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {rows.length === 0 ? (
                                <tr><td colSpan={9} className="p-8 text-center text-gray-400">No data found for this date.</td></tr>
                            ) : (
                                rows.map(row => (
                                    <tr key={row.product_id} className="hover:bg-slate-50/50 transition">
                                        <td className="p-4 font-bold text-slate-700">{row.product_name}</td>
                                        <td className="p-4 text-center font-mono text-gray-500 bg-gray-50/30">{row.opening}</td>
                                        <td className="p-4 text-center font-mono text-amber-700">{row.day_production || '-'}</td>
                                        <td className="p-4 text-center font-mono text-indigo-700">{row.night_production || '-'}</td>
                                        <td className="p-4 text-center font-mono text-purple-700">{row.extra_production || '-'}</td>
                                        <td className="p-4 text-center font-bold text-green-700 bg-green-50/30">{row.total_production}</td>
                                        <td className="p-4 text-center font-bold text-red-600 bg-red-50/30">{row.stock_out}</td>
                                        <td className="p-4 text-center font-mono text-xs text-slate-400">
                                            {row.adjustment !== 0 ? <span className={row.adjustment > 0 ? 'text-green-600' : 'text-red-500'}>{row.adjustment > 0 ? '+' : ''}{row.adjustment}</span> : '-'}
                                        </td>
                                        <td className={`p-4 text-center font-black bg-slate-50 ${row.closing_stock < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                            {row.closing_stock}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODALS --- */}
            {showProdModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="font-black text-slate-800 mb-4 text-lg">Add Production</h3>
                        <div className="space-y-4">
                            <select className="w-full p-3 border rounded-xl font-bold text-slate-700" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                                <option value="">Select Product...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <select className="flex-1 p-3 border rounded-xl font-bold" value={shift} onChange={e => setShift(e.target.value as any)}>
                                    <option value="DAY">DAY</option>
                                    <option value="NIGHT">NIGHT</option>
                                    <option value="EXTRA">EXTRA</option>
                                </select>
                                <input type="number" placeholder="Qty" className="flex-1 p-3 border rounded-xl font-bold" value={qty} onChange={e => setQty(e.target.value)}/>
                            </div>
                            <button onClick={handleAddProduction} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg">Submit</button>
                            <button onClick={() => setShowProdModal(false)} className="w-full text-slate-400 text-xs font-bold mt-2">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showOutModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="font-black text-slate-800 mb-4 text-lg">Add Stock Out / Dispatch</h3>
                        <div className="space-y-4">
                            <select className="w-full p-3 border rounded-xl font-bold text-slate-700" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                                <option value="">Select Product...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                            </select>
                            <input type="number" placeholder="Qty" className="w-full p-3 border rounded-xl font-bold" value={qty} onChange={e => setQty(e.target.value)}/>
                            <input type="text" placeholder="Ref No / Bill No" className="w-full p-3 border rounded-xl font-bold" value={remark} onChange={e => setRemark(e.target.value)}/>
                            <button onClick={handleAddStockOut} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg">Dispatch Out</button>
                            <button onClick={() => setShowOutModal(false)} className="w-full text-slate-400 text-xs font-bold mt-2">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showAdjModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex items-center gap-2 mb-4 text-slate-800">
                            <AlertTriangle className="text-orange-500" />
                            <h3 className="font-black text-lg">Stock Adjustment</h3>
                        </div>
                        <div className="space-y-4">
                            <select className="w-full p-3 border rounded-xl font-bold text-slate-700" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                                <option value="">Select Product...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                            </select>
                            <input type="number" placeholder="Qty (+/-)" className="w-full p-3 border rounded-xl font-bold" value={qty} onChange={e => setQty(e.target.value)}/>
                            <input type="text" placeholder="Reason (Required)" className="w-full p-3 border rounded-xl font-bold" value={remark} onChange={e => setRemark(e.target.value)}/>
                            <button onClick={handleAdjustment} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold shadow-lg">Save Adjustment</button>
                            <button onClick={() => setShowAdjModal(false)} className="w-full text-slate-400 text-xs font-bold mt-2">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

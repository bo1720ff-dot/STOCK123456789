
import React, { useState, useEffect } from 'react';
import { databaseService } from '../services/supabase';
import { Database, Edit2, Trash2, Save, X, RefreshCw, AlertTriangle, Search, AlertOctagon } from 'lucide-react';

const TABLES = [
    { name: 'products', label: 'Products' },
    { name: 'customers', label: 'Customers' },
    { name: 'vehicles', label: 'Vehicles' },
    { name: 'parties', label: 'Parties' },
    { name: 'addresses', label: 'Addresses' },
    { name: 'bills', label: 'Bills (Sales)' },
    { name: 'bill_items', label: 'Bill Items' },
    { name: 'production_logs', label: 'Production Logs' },
    { name: 'inventory_ledger', label: 'Inventory Ledger' },
    { name: 'app_users', label: 'Users' },
    { name: 'activity_logs', label: 'Audit Logs' },
];

export const DatabaseEditor: React.FC = () => {
    const [selectedTable, setSelectedTable] = useState(TABLES[0].name);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<any>({});

    useEffect(() => {
        loadTableData();
    }, [selectedTable]);

    const loadTableData = async () => {
        setLoading(true);
        try {
            const result = await databaseService.fetchTableData(selectedTable);
            setData(result);
        } catch (e: any) {
            alert("Error loading table: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (row: any) => {
        setEditingId(row.id);
        setEditForm({ ...row });
    };

    const handleDeleteClick = async (id: string) => {
        if (!window.confirm("⚠️ DANGER: Are you sure you want to delete this record?\n\nDeleting raw data can break relationships (e.g., deleting a Product will break all Sales history for that product).")) return;
        
        try {
            await databaseService.deleteRow(selectedTable, id);
            setData(prev => prev.filter(item => item.id !== id));
        } catch (e: any) {
            alert("Delete Failed: " + e.message);
        }
    };

    const handleSave = async () => {
        try {
            // Remove ID and created_at from updates usually, but supabase handles ID ignore
            const { id, created_at, ...updates } = editForm;
            
            await databaseService.updateRow(selectedTable, editingId!, updates);
            
            // Update local state
            setData(prev => prev.map(item => item.id === editingId ? { ...item, ...updates } : item));
            setEditingId(null);
            setEditForm({});
        } catch (e: any) {
            alert("Update Failed: " + e.message);
        }
    };

    const handleInputChange = (key: string, value: string) => {
        setEditForm((prev: any) => ({ ...prev, [key]: value }));
    };

    // Filter logic
    const filteredData = data.filter(row => {
        if (!searchTerm) return true;
        return Object.values(row).some(val => 
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    if (data.length === 0 && !loading && filteredData.length === 0) {
        // Handle empty state later
    }

    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Database className="text-red-600" /> Database Editor
                    </h2>
                    <p className="text-xs text-red-500 font-bold uppercase tracking-wide flex items-center gap-1">
                        <AlertOctagon size={12} /> Advanced Mode: Direct Data Manipulation
                    </p>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                    <select 
                        value={selectedTable} 
                        onChange={(e) => { setSelectedTable(e.target.value); setSearchTerm(''); }}
                        className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5 font-bold outline-none"
                    >
                        {TABLES.map(t => (
                            <option key={t.name} value={t.name}>{t.label} ({t.name})</option>
                        ))}
                    </select>
                    
                    <button onClick={loadTableData} className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search in raw data..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-200 outline-none text-sm font-medium"
                />
            </div>

            {/* Table Editor */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden relative flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10 text-xs uppercase font-bold text-gray-500">
                            <tr>
                                <th className="p-3 border-b text-center bg-gray-100 w-24 sticky left-0 z-20">Actions</th>
                                {columns.map(col => (
                                    <th key={col} className="p-3 border-b min-w-[150px] whitespace-nowrap">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.map((row, idx) => {
                                const isEditingRow = editingId === row.id;
                                return (
                                    <tr key={row.id || idx} className={isEditingRow ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                                        <td className="p-2 border-r bg-gray-50 sticky left-0 z-10 flex justify-center gap-2 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                            {isEditingRow ? (
                                                <>
                                                    <button onClick={handleSave} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"><Save size={16}/></button>
                                                    <button onClick={() => { setEditingId(null); setEditForm({}); }} className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"><X size={16}/></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEditClick(row)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded transition"><Edit2 size={16}/></button>
                                                    <button onClick={() => handleDeleteClick(row.id)} className="p-1.5 hover:bg-red-100 text-red-600 rounded transition"><Trash2 size={16}/></button>
                                                </>
                                            )}
                                        </td>
                                        {columns.map(col => (
                                            <td key={col} className="p-2 border-r last:border-r-0 max-w-xs truncate">
                                                {isEditingRow && col !== 'id' && col !== 'created_at' ? (
                                                    <input 
                                                        type="text" 
                                                        value={editForm[col] || ''} 
                                                        onChange={(e) => handleInputChange(col, e.target.value)}
                                                        className="w-full p-1 border rounded bg-white text-xs font-mono focus:border-blue-500 outline-none"
                                                    />
                                                ) : (
                                                    <span className={`block truncate text-xs ${col === 'id' ? 'font-mono text-gray-400' : 'text-gray-800'}`}>
                                                        {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                                    </span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length + 1} className="p-8 text-center text-gray-400">
                                        No data found or table is empty.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-2 bg-red-50 text-red-800 text-[10px] font-bold text-center border-t border-red-100">
                    CAUTION: Direct edits bypass some system validations. Use with care.
                </div>
            </div>
        </div>
    );
};

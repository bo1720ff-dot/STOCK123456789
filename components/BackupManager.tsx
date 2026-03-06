
import React, { useState } from 'react';
import { backupService } from '../services/supabase';
import { Database, Download, FileSpreadsheet, Server, ShieldCheck, AlertTriangle, CheckCircle, Loader } from 'lucide-react';

const TABLES = [
    { name: 'bills', label: 'Sales Orders & Invoices' },
    { name: 'bill_items', label: 'Bill Line Items' },
    { name: 'inventory_ledger', label: 'Full Inventory Ledger' },
    { name: 'production_logs', label: 'Production Logs' },
    { name: 'products', label: 'Product Master' },
    { name: 'customers', label: 'Customer Master' },
    { name: 'vehicles', label: 'Vehicle Master' },
    { name: 'parties', label: 'Party Names' },
    { name: 'addresses', label: 'Saved Addresses' },
    { name: 'app_users', label: 'System Users' },
    { name: 'activity_logs', label: 'Audit/Activity Logs' },
    { name: 'app_settings', label: 'System Settings' },
];

export const BackupManager: React.FC = () => {
    const [downloading, setDownloading] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('');

    const convertToCSV = (objArray: any[]) => {
        if (!objArray || objArray.length === 0) return '';
        const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
        
        // Collect all unique keys from all objects to ensure headers are complete
        const keys = new Set<string>();
        array.forEach((obj: any) => {
            Object.keys(obj).forEach(k => keys.add(k));
        });
        const headers = Array.from(keys);

        let str = headers.join(',') + '\r\n';

        for (let i = 0; i < array.length; i++) {
            let line = '';
            for (let index in headers) {
                if (line !== '') line += ',';
                const header = headers[index];
                let value = array[i][header];
                
                // Handle null/undefined
                if (value === null || value === undefined) {
                    value = '';
                } else {
                    // Convert to string and escape quotes
                    value = String(value).replace(/"/g, '""');
                    // Wrap in quotes if it contains comma, newline or quote
                    if (value.search(/("|,|\n)/g) >= 0) {
                        value = `"${value}"`;
                    }
                }
                line += value;
            }
            str += line + '\r\n';
        }
        return str;
    };

    const downloadFile = (csvData: string, filename: string) => {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownload = async (tableName: string, label: string) => {
        setDownloading(tableName);
        setStatus(`Fetching ${label}...`);
        try {
            const data = await backupService.fetchAllTableData(tableName);
            if (!data || data.length === 0) {
                alert(`No data found in ${label}`);
            } else {
                const csv = convertToCSV(data);
                const dateStr = new Date().toISOString().split('T')[0];
                downloadFile(csv, `Greenzar_${tableName}_${dateStr}.csv`);
                setStatus(`Downloaded ${label}`);
            }
        } catch (e: any) {
            console.error(e);
            alert(`Failed to download ${label}: ${e.message}`);
            setStatus('Error occurred');
        } finally {
            setDownloading(null);
            setTimeout(() => setStatus(''), 3000);
        }
    };

    const handleDownloadAll = async () => {
        if (!window.confirm("This will download multiple files sequentially. Continue?")) return;
        
        for (const table of TABLES) {
            await handleDownload(table.name, table.label);
            // Small delay to prevent browser blocking multiple downloads
            await new Promise(resolve => setTimeout(resolve, 500)); 
        }
        setStatus('All downloads completed');
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Database className="text-sky-500" /> System Backup
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                        Export Database Tables to CSV
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {status && <span className="text-xs font-bold text-sky-600 animate-pulse">{status}</span>}
                    <button 
                        onClick={handleDownloadAll}
                        disabled={!!downloading}
                        className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-900 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <Server size={18} /> BACKUP ALL DATA
                    </button>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                <div>
                    <h4 className="font-bold text-amber-800 text-sm">Data Security Notice</h4>
                    <p className="text-xs text-amber-700 mt-1">
                        Downloaded files contain sensitive business information including customer details and sales figures. 
                        Please ensure these files are stored securely.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 overflow-auto pb-10">
                {TABLES.map((table) => (
                    <div key={table.name} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${downloading === table.name ? 'bg-sky-100 text-sky-600' : 'bg-gray-50 text-gray-400 group-hover:bg-sky-50 group-hover:text-sky-500'}`}>
                                {downloading === table.name ? <Loader size={20} className="animate-spin"/> : <FileSpreadsheet size={20} />}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-sm">{table.label}</h4>
                                <code className="text-[10px] text-gray-400 font-mono bg-gray-50 px-1 py-0.5 rounded">{table.name}</code>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDownload(table.name, table.label)}
                            disabled={!!downloading}
                            className="p-2 hover:bg-sky-50 rounded-lg text-gray-400 hover:text-sky-600 transition"
                            title="Download CSV"
                        >
                            <Download size={20} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="mt-auto text-center text-xs text-gray-400 font-medium flex items-center justify-center gap-2 pt-4 border-t border-gray-100">
                <ShieldCheck size={14} />
                Secure Export System • Greenzar Stock App
            </div>
        </div>
    );
};

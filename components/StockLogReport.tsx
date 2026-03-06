import React, { useState, useEffect } from 'react';
import { productService, stockService } from '../services/supabase';
import { Product, StockEntry } from '../types';
import { Calendar, Download, FileDown, ClipboardList } from 'lucide-react';

export const StockLogReport: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [logs, setLogs] = useState<(StockEntry & { product_name: string })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load products map initially
    const init = async () => {
        const prods = await productService.getAll();
        setProducts(prods);
    };
    init();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
        const entries = await stockService.getRange(startDate, endDate);
        
        // Map Product IDs to Names
        const mappedLogs = entries.map(entry => {
            const prod = products.find(p => p.id === entry.product_id);
            return {
                ...entry,
                product_name: prod ? prod.product_name : 'Unknown Product'
            };
        });

        // Filter out entries with 0 production to keep the log clean
        const activeLogs = mappedLogs.filter(l => (l.day_production || 0) > 0 || (l.night_production || 0) > 0);
        
        setLogs(activeLogs);
    } catch (e) {
        console.error(e);
        alert("Failed to fetch logs");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (products.length > 0) {
        loadLogs();
    }
  }, [startDate, endDate, products]);

  const downloadCSV = () => {
    if (logs.length === 0) {
        alert("No data to download");
        return;
    }
    
    let csv = "Date,Product,Day Input Qty,Night Input Qty,Total Input\n";
    logs.forEach(row => {
        const total = (row.day_production || 0) + (row.night_production || 0);
        csv += `${row.date},"${row.product_name}",${row.day_production},${row.night_production},${total}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock_Input_Log_${startDate}_to_${endDate}.csv`;
    a.click();
  };

  const downloadPDF = () => {
    if (logs.length === 0) {
        alert("No data to download");
        return;
    }

    // Explicit Black Color Styles to fix invisible text issue
    const cellStyle = "padding: 6px; border: 1px solid #000000; color: #000000; background-color: #ffffff;";
    const headerStyle = "padding: 6px; border: 1px solid #000000; font-weight: bold; background-color: #e5e7eb; color: #000000;";

    const rows = logs.map(row => {
        const total = (row.day_production || 0) + (row.night_production || 0);
        return `
            <tr>
                <td style="${cellStyle} text-align: left;">${row.date}</td>
                <td style="${cellStyle} font-weight: bold; text-align: left;">${row.product_name}</td>
                <td style="${cellStyle} text-align: right;">${row.day_production}</td>
                <td style="${cellStyle} text-align: right;">${row.night_production}</td>
                <td style="${cellStyle} text-align: right; font-weight: bold;">${total}</td>
            </tr>
        `;
    }).join('');

    const content = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #ffffff; color: #000000;">
        <h2 style="text-align: center; margin-bottom: 5px; color: #000000;">STOCK INPUT STATEMENT</h2>
        <p style="text-align: center; font-size: 12px; margin-top: 0; color: #000000;">Period: ${startDate} to ${endDate}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; color: #000000;">
            <thead>
                <tr>
                    <th style="${headerStyle} text-align: left;">Date</th>
                    <th style="${headerStyle} text-align: left;">Product</th>
                    <th style="${headerStyle} text-align: right;">Day Qty</th>
                    <th style="${headerStyle} text-align: right;">Night Qty</th>
                    <th style="${headerStyle} text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        <div style="margin-top: 20px; text-align: right; font-size: 10px; color: #000000;">
            Generated on ${new Date().toLocaleString()}
        </div>
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = content;

    const opt = {
      margin:       10,
      filename:     `Stock_Input_Statement_${startDate}_${endDate}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // @ts-ignore
    if (window.html2pdf) {
      // @ts-ignore
      window.html2pdf().set(opt).from(element).save();
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ClipboardList className="text-sky-500" /> Stock Input Logs
        </h2>

        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm w-full md:w-auto">
            {/* Date Range */}
            <div className="flex items-center gap-2 w-full md:w-auto">
                 <div className="relative flex-1 md:flex-none">
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded text-sm focus:border-sky-400 outline-none"
                    />
                    <Calendar size={14} className="absolute left-2 top-2.5 text-gray-400" />
                 </div>
                 <span className="text-gray-400 font-bold">-</span>
                 <div className="relative flex-1 md:flex-none">
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded text-sm focus:border-sky-400 outline-none"
                    />
                    <Calendar size={14} className="absolute left-2 top-2.5 text-gray-400" />
                 </div>
            </div>

            <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>

            <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={downloadCSV}
                  className="flex-1 md:flex-none bg-green-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition"
                >
                  <Download size={14} /> CSV
                </button>
                <button 
                  onClick={downloadPDF}
                  className="flex-1 md:flex-none bg-red-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition"
                >
                  <FileDown size={14} /> PDF
                </button>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-sky-100 overflow-hidden flex-1 flex flex-col">
          {loading ? (
             <div className="flex-1 flex justify-center items-center text-gray-400">Loading Logs...</div>
          ) : logs.length === 0 ? (
             <div className="flex-1 flex flex-col justify-center items-center text-gray-300 gap-2">
                <ClipboardList size={40} />
                <p>No production entries found for this period.</p>
             </div>
          ) : (
             <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-sky-50 sticky top-0 z-10 shadow-sm">
                        <tr className="text-xs uppercase text-gray-500 font-bold tracking-wider">
                            <th className="p-4">Date</th>
                            <th className="p-4">Product Name</th>
                            <th className="p-4 text-right">Day Qty</th>
                            <th className="p-4 text-right">Night Qty</th>
                            <th className="p-4 text-right">Total Input</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                        {logs.map((log, idx) => {
                            const total = (log.day_production || 0) + (log.night_production || 0);
                            return (
                                <tr key={idx} className="hover:bg-sky-50/50 transition">
                                    <td className="p-4 text-gray-500 font-mono">{log.date}</td>
                                    <td className="p-4 font-bold text-gray-800">{log.product_name}</td>
                                    <td className="p-4 text-right font-mono text-amber-600 font-medium">
                                        {log.day_production > 0 ? log.day_production : '-'}
                                    </td>
                                    <td className="p-4 text-right font-mono text-indigo-600 font-medium">
                                        {log.night_production > 0 ? log.night_production : '-'}
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-gray-900">
                                        {total}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
             </div>
          )}
      </div>
    </div>
  );
};
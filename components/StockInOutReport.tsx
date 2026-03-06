
import React, { useState, useEffect } from 'react';
import { productService, stockService } from '../services/supabase';
import { Product } from '../types';
import { Calendar, Download, FileDown, ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';

interface ReportItem {
    product: string;
    total_in: number;
    total_out: number;
    balance: number;
}

export const StockInOutReport: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
        // 1. Fetch Masters & Data
        // Now getRange returns aggregated transactions including Sales and Production
        const [products, dailyEntries] = await Promise.all([
            productService.getAll(),
            stockService.getRange(startDate, endDate)
        ]);

        // 2. Aggregate Data per Product
        const consolidated: ReportItem[] = products.map(p => {
            // Find all entries for this product in range
            const relevantEntries = dailyEntries.filter(e => e.product_id === p.id);
            
            // Sum Production
            const totalIn = relevantEntries.reduce((sum, e) => sum + (e.day_production || 0) + (e.night_production || 0), 0);
            
            // Sum Sales (getRange now correctly populates stock_out)
            const totalOut = relevantEntries.reduce((sum, e) => sum + (e.stock_out || 0), 0);

            return {
                product: p.product_name,
                total_in: totalIn,
                total_out: totalOut,
                balance: totalIn - totalOut
            };
        });

        // Filter: Show rows where something happened (In or Out > 0)
        const activeRows = consolidated.filter(r => r.total_in > 0 || r.total_out > 0);
        setReportData(activeRows);

    } catch (e) {
        console.error(e);
        alert("Failed to generate report");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate]);

  const downloadCSV = () => {
    if (reportData.length === 0) {
        alert("No data to download");
        return;
    }
    
    let csv = "Product,Total Production (IN),Total Sales (OUT),Net Difference\n";
    reportData.forEach(row => {
        csv += `"${row.product}",${row.total_in},${row.total_out},${row.balance}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock_InOut_Status_${startDate}_to_${endDate}.csv`;
    a.click();
  };

  const downloadPDF = () => {
    if (reportData.length === 0) {
        alert("No data to download");
        return;
    }

    const cellStyle = "padding: 8px; border: 1px solid #000; color: #000; background-color: #fff; font-size: 12px;";
    const headerStyle = "padding: 8px; border: 1px solid #000; font-weight: bold; background-color: #f3f4f6; color: #000; font-size: 12px;";

    const rows = reportData.map(row => `
        <tr>
            <td style="${cellStyle} font-weight: bold; text-align: left;">${row.product}</td>
            <td style="${cellStyle} text-align: right; color: #166534;">${row.total_in}</td>
            <td style="${cellStyle} text-align: right; color: #991b1b;">${row.total_out}</td>
            <td style="${cellStyle} text-align: right; font-weight: bold;">${row.balance > 0 ? '+' : ''}${row.balance}</td>
        </tr>
    `).join('');

    const content = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #fff; color: #000;">
        <h2 style="text-align: center; margin-bottom: 5px; text-transform: uppercase;">Stock In/Out Status Report</h2>
        <p style="text-align: center; font-size: 12px; margin-top: 0; color: #555;">Period: ${startDate} to ${endDate}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
                <tr>
                    <th style="${headerStyle} text-align: left;">Product</th>
                    <th style="${headerStyle} text-align: right;">Total IN (Prod)</th>
                    <th style="${headerStyle} text-align: right;">Total OUT (Sale)</th>
                    <th style="${headerStyle} text-align: right;">Difference</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr>
                    <td style="${cellStyle} font-weight: bold;">TOTALS</td>
                    <td style="${cellStyle} font-weight: bold; text-align: right;">${reportData.reduce((a,b) => a + b.total_in, 0)}</td>
                    <td style="${cellStyle} font-weight: bold; text-align: right;">${reportData.reduce((a,b) => a + b.total_out, 0)}</td>
                    <td style="${cellStyle} background-color: #f3f4f6;"></td>
                </tr>
            </tfoot>
        </table>
        <div style="margin-top: 20px; text-align: right; font-size: 10px; color: #888;">
            Generated on ${new Date().toLocaleString()}
        </div>
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = content;

    const opt = {
      margin:       10,
      filename:     `Stock_InOut_Status_${startDate}_${endDate}.pdf`,
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
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ArrowLeftRight className="text-sky-500" /> Stock In/Out Status
        </h2>

        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm w-full md:w-auto">
            {/* Date Range */}
            <div className="flex items-center gap-2 w-full md:w-auto">
                 <div className="relative flex-1 md:flex-none">
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded text-sm focus:border-sky-400 outline-none font-medium text-gray-700"
                    />
                    <Calendar size={14} className="absolute left-2 top-2.5 text-gray-400" />
                 </div>
                 <span className="text-gray-400 font-bold">-</span>
                 <div className="relative flex-1 md:flex-none">
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded text-sm focus:border-sky-400 outline-none font-medium text-gray-700"
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

      {/* Report Table */}
      <div className="bg-white rounded-xl shadow-sm border border-sky-100 overflow-hidden flex-1 flex flex-col">
          {loading ? (
             <div className="flex-1 flex justify-center items-center text-gray-400">Loading Report Data...</div>
          ) : reportData.length === 0 ? (
             <div className="flex-1 flex flex-col justify-center items-center text-gray-300 gap-2">
                <ArrowLeftRight size={40} className="opacity-20" />
                <p>No activity found for this period.</p>
             </div>
          ) : (
             <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-sky-50 sticky top-0 z-10 shadow-sm">
                        <tr className="text-xs uppercase text-gray-500 font-bold tracking-wider">
                            <th className="p-4 w-1/3">Product Name</th>
                            <th className="p-4 text-right bg-green-50 text-green-700 w-1/5">
                                <div className="flex items-center justify-end gap-1">Total IN <TrendingUp size={12}/></div>
                                <span className="text-[9px] opacity-70 block">(Production)</span>
                            </th>
                            <th className="p-4 text-right bg-red-50 text-red-700 w-1/5">
                                <div className="flex items-center justify-end gap-1">Total OUT <TrendingDown size={12}/></div>
                                <span className="text-[9px] opacity-70 block">(Sales)</span>
                            </th>
                            <th className="p-4 text-right w-1/5">Net Diff</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                        {reportData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-sky-50/30 transition">
                                <td className="p-4 font-bold text-gray-800">{row.product}</td>
                                <td className="p-4 text-right font-mono font-bold text-green-600 bg-green-50/30">
                                    {row.total_in}
                                </td>
                                <td className="p-4 text-right font-mono font-bold text-red-600 bg-red-50/30">
                                    {row.total_out}
                                </td>
                                <td className="p-4 text-right font-mono font-black">
                                    <span className={`${row.balance > 0 ? 'text-green-600' : row.balance < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {row.balance > 0 ? '+' : ''}{row.balance}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold text-xs sticky bottom-0 shadow-inner">
                        <tr>
                            <td className="p-4 text-gray-600">TOTALS</td>
                            <td className="p-4 text-right text-green-800 bg-green-100/50">
                                {reportData.reduce((a,b) => a + b.total_in, 0)}
                            </td>
                            <td className="p-4 text-right text-red-800 bg-red-100/50">
                                {reportData.reduce((a,b) => a + b.total_out, 0)}
                            </td>
                            <td className="p-4 text-right text-gray-800">
                                {reportData.reduce((a,b) => a + b.balance, 0)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
             </div>
          )}
      </div>
    </div>
  );
};

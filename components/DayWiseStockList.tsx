
import React, { useState, useEffect } from 'react';
import { stockService, productService } from '../services/supabase';
import { Product } from '../types';
import { Calendar, RefreshCw, Filter, Database, FileDown } from 'lucide-react';

export const DayWiseStockList: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(() => {
      const d = new Date();
      d.setDate(d.getDate() - 6); 
      return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [data, setData] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');

  useEffect(() => {
      productService.getAll().then(setProducts).catch(console.error);
  }, []);

  useEffect(() => {
      loadReport();
  }, [startDate, endDate, products]);

  const loadReport = async () => {
      setLoading(true);
      try {
          const rows = await stockService.getRange(startDate, endDate);
          // Map product names
          const mapped = rows.map(r => {
              const p = products.find(prod => prod.id === r.product_id);
              return {
                  ...r,
                  product_name: p ? p.product_name : 'Unknown Product'
              };
          });
          setData(mapped);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const filteredData = data.filter(row => {
      if (selectedProduct !== 'ALL' && row.product_id !== selectedProduct) return false;
      return true;
  });

  const downloadCSV = () => {
      if (filteredData.length === 0) return;
      let csv = "Date,Product,Opening,Day Prod,Night Prod,Total Prod,Total Out,Closing\n";
      filteredData.forEach(row => {
          csv += `${row.date},"${row.product_name}",${row.opening_stock},${row.day_production},${row.night_production},${row.day_production + row.night_production},${row.stock_out},${row.closing_stock}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Stock_History_${startDate}_${endDate}.csv`;
      a.click();
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Calendar className="text-sky-600" /> Stock History Report
            </h2>
            <div className="flex flex-wrap gap-2 items-center">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded p-1 text-xs" />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded p-1 text-xs" />
                <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="border rounded p-1 text-xs font-bold">
                    <option value="ALL">All Products</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                </select>
                <button onClick={loadReport} className="p-2 bg-sky-50 text-sky-600 rounded hover:bg-sky-100"><RefreshCw size={16}/></button>
                <button onClick={downloadCSV} className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100"><FileDown size={16}/></button>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 sticky top-0 z-10 text-[10px] font-black uppercase text-slate-500">
                        <tr>
                            <th className="p-3 w-28">Date</th>
                            <th className="p-3">Product</th>
                            <th className="p-3 text-center text-amber-600">Day</th>
                            <th className="p-3 text-center text-indigo-600">Night</th>
                            <th className="p-3 text-center bg-green-50 text-green-700">Total In</th>
                            <th className="p-3 text-center bg-red-50 text-red-600">Sales</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">Loading...</td></tr>
                        ) : filteredData.length === 0 ? (
                            <tr><td colSpan={6} className="p-12 text-center text-gray-300">No data found.</td></tr>
                        ) : (
                            filteredData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-3 font-mono text-slate-500 font-bold">{row.date}</td>
                                    <td className="p-3 font-bold text-slate-800">{row.product_name}</td>
                                    <td className="p-3 text-center font-mono text-amber-700">{row.day_production || '-'}</td>
                                    <td className="p-3 text-center font-mono text-indigo-700">{row.night_production || '-'}</td>
                                    <td className="p-3 text-center font-mono font-bold text-green-700 bg-green-50/30">{row.day_production + row.night_production}</td>
                                    <td className="p-3 text-center font-mono font-bold text-red-600 bg-red-50/30">{row.stock_out}</td>
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

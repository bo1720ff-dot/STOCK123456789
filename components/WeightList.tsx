
import React, { useState, useEffect } from 'react';
import { productService } from '../services/supabase';
import { Product } from '../types';
import { Scale, Search, RefreshCw, Lock } from 'lucide-react';

export const WeightList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadProducts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await productService.getAll();
      setProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = products.filter(p => p.product_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Scale className="text-sky-500" />
            Product Weight Master
            </h2>
            <p className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-wide flex items-center gap-1">
                <Lock size={12} /> Read Only View (Database Edit Required)
            </p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 shadow-sm w-full md:w-auto">
            <Search size={18} className="text-gray-400 ml-2"/>
            <input 
                type="text" 
                placeholder="Search products..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 w-full md:w-64 py-1"
            />
            <button onClick={() => loadProducts()} className="p-2 bg-gray-50 hover:bg-sky-50 rounded-lg text-sky-600 transition">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-sky-100 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-sky-50 text-xs uppercase text-gray-500 font-semibold tracking-wider sticky top-0 shadow-sm z-10">
              <tr>
                <th className="p-4">Product Name</th>
                <th className="p-4 w-32">Unit</th>
                <th className="p-4 text-center w-40">Weight / Unit (KG)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr><td colSpan={3} className="p-8 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-gray-400">No products found.</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-sky-50/50 transition group">
                    <td className="p-4 font-bold text-gray-800">{p.product_name}</td>
                    <td className="p-4">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600 border border-gray-200 uppercase">
                        {p.unit}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                        <span className="font-mono font-black text-sky-700 bg-sky-50/50 border border-sky-100 px-3 py-1.5 rounded-lg">
                            {p.weight ? p.weight.toFixed(3) : '-'}
                        </span>
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

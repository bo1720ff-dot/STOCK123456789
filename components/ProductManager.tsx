
import React, { useState, useEffect } from 'react';
import { productService } from '../services/supabase';
import { Product } from '../types';
import { Plus, Package, Save, X, Trash2, Image as ImageIcon } from 'lucide-react';
import { CsvImporter } from './CsvImporter';

export const ProductManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [rate, setRate] = useState('');
  const [weight, setWeight] = useState(''); // NEW: Weight State
  const [imageUrl, setImageUrl] = useState(''); // NEW: Image State

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await productService.getAll();
      setProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleAddProduct = async () => {
    if (!name || !rate) {
      alert("Name and Rate are required");
      return;
    }

    try {
      await productService.add({
        product_name: name,
        unit: unit,
        rate: parseFloat(rate),
        weight: parseFloat(weight) || 0,
        image_url: imageUrl
      });
      
      // Reset and reload
      setName('');
      setRate('');
      setUnit('kg');
      setWeight('');
      setImageUrl('');
      setShowAddForm(false);
      loadProducts();
      alert("Product added successfully!");
    } catch (e) {
      alert("Failed to add product");
    }
  };

  const handleImport = async (data: any[]) => {
      await productService.importBulk(data);
      loadProducts();
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Are you sure you want to delete this product?")) return;
    try {
        await productService.delete(id);
        loadProducts();
    } catch(e) {
        alert("Failed to delete product");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="text-sky-500" />
          Product Management
        </h2>
        <div className="flex gap-3">
            <CsvImporter 
                onImport={handleImport} 
                sampleHeaders={['product_name', 'unit', 'rate', 'weight', 'image_url']}
            />
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition flex items-center gap-2 font-medium shadow-sm"
            >
              <Plus size={18} /> Add New Product
            </button>
        </div>
      </div>

      {/* Add Product Form (Modal) */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-lg font-bold text-gray-800">Add New Product</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Product Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                  placeholder="e.g. Red Apple"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">Unit</label>
                  <select 
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none bg-white transition"
                  >
                    <option value="kg">kg</option>
                    <option value="pcs">pcs</option>
                    <option value="box">box</option>
                    <option value="bundle">bundle</option>
                    <option value="liter">liter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">Rate</label>
                  <input 
                    type="number" 
                    value={rate}
                    onChange={e => setRate(e.target.value)}
                    className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">Wgt/Case</label>
                  <input 
                    type="number" 
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                    placeholder="KG"
                  />
                </div>
              </div>

              {/* Image Input */}
              <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">Image URL</label>
                  <input 
                    type="text" 
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition text-xs"
                    placeholder="https://example.com/image.jpg"
                  />
                  {imageUrl && (
                      <div className="mt-2 w-full h-32 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                          <img src={imageUrl} alt="Preview" className="h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')}/>
                      </div>
                  )}
              </div>

              <button 
                onClick={handleAddProduct}
                className="w-full bg-sky-500 text-white py-3 rounded-lg font-bold hover:bg-sky-600 transition mt-4 flex justify-center items-center gap-2"
              >
                <Save size={18} /> Save Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product List */}
      <div className="bg-white rounded-xl shadow-sm border border-sky-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50 border-b border-sky-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="p-4 w-16">Img</th>
                <th className="p-4">Product Name</th>
                <th className="p-4">Unit</th>
                <th className="p-4 text-right">Default Rate</th>
                <th className="p-4 text-right">Weight/Case</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-400">No products found. Add one!</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-sky-50/50 transition">
                    <td className="p-4">
                        {p.image_url ? (
                            <img src={p.image_url} alt="img" className="w-10 h-10 rounded object-cover border border-gray-100"/>
                        ) : (
                            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                                <ImageIcon size={16}/>
                            </div>
                        )}
                    </td>
                    <td className="p-4 font-medium text-gray-800">{p.product_name}</td>
                    <td className="p-4 text-gray-500">
                      <span className="bg-gray-50 px-2 py-1 rounded text-xs font-bold border border-gray-200">
                        {p.unit}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-medium text-gray-600">{p.rate.toFixed(2)}</td>
                    <td className="p-4 text-right font-mono font-medium text-gray-600">{p.weight || '-'}</td>
                    <td className="p-4 text-center">
                        <button onClick={() => handleDelete(p.id)} className="text-gray-300 hover:text-red-500 transition">
                            <Trash2 size={16} />
                        </button>
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

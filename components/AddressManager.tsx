
import React, { useState, useEffect } from 'react';
import { addressService } from '../services/supabase';
import { SavedAddress } from '../types';
import { Plus, MapPin, Save, X, Trash2 } from 'lucide-react';
import { CsvImporter } from './CsvImporter';

export const AddressManager: React.FC = () => {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addrLine, setAddrLine] = useState('');

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const data = await addressService.getAll();
      setAddresses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleAdd = async () => {
    if (!addrLine) {
      alert("Address is required");
      return;
    }

    try {
      await addressService.add({
        address_line: addrLine,
      });
      
      setAddrLine('');
      setShowAddForm(false);
      loadAddresses();
    } catch (e) {
      alert("Failed to add address");
    }
  };

  const handleImport = async (data: any[]) => {
      await addressService.importBulk(data);
      loadAddresses();
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Are you sure you want to delete this address?")) return;
    try {
        await addressService.delete(id);
        loadAddresses();
    } catch(e) {
        alert("Failed to delete address");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <MapPin className="text-sky-500" />
          Address Master
        </h2>
        <div className="flex gap-3">
            <CsvImporter 
                onImport={handleImport} 
                sampleHeaders={['address_line']}
            />
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition flex items-center gap-2 font-medium shadow-sm"
            >
              <Plus size={18} /> Add Address
            </button>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-lg font-bold text-gray-800">Add Address</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Address / Location</label>
                <input 
                  autoFocus
                  type="text" 
                  value={addrLine}
                  onChange={e => setAddrLine(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                  placeholder="e.g. Mumbai Market"
                />
              </div>

              <button 
                onClick={handleAdd}
                className="w-full bg-sky-500 text-white py-3 rounded-lg font-bold hover:bg-sky-600 transition mt-4 flex justify-center items-center gap-2"
              >
                <Save size={18} /> Save Address
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-sky-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50 border-b border-sky-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="p-4">Address</th>
                <th className="p-4 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr><td colSpan={2} className="p-4 text-center">Loading...</td></tr>
              ) : addresses.length === 0 ? (
                <tr><td colSpan={2} className="p-4 text-center text-gray-400">No addresses found.</td></tr>
              ) : (
                addresses.map((a) => (
                  <tr key={a.id} className="hover:bg-sky-50/50 transition">
                    <td className="p-4 font-bold text-gray-800">{a.address_line}</td>
                    <td className="p-4 text-center">
                        <button onClick={() => handleDelete(a.id)} className="text-gray-300 hover:text-red-500 transition">
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


import React, { useState, useEffect } from 'react';
import { partyService } from '../services/supabase';
import { Party } from '../types';
import { Plus, User, Save, X, Trash2 } from 'lucide-react';
import { CsvImporter } from './CsvImporter';

export const PartyManager: React.FC = () => {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');

  const loadParties = async () => {
    setLoading(true);
    try {
      const data = await partyService.getAll();
      setParties(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParties();
  }, []);

  const handleAdd = async () => {
    if (!name) {
      alert("Party Name is required");
      return;
    }

    try {
      await partyService.add({
        party_name: name,
      });
      
      setName('');
      setShowAddForm(false);
      loadParties();
    } catch (e) {
      alert("Failed to add party");
    }
  };

  const handleImport = async (data: any[]) => {
      await partyService.importBulk(data);
      loadParties();
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Are you sure you want to delete this party?")) return;
    try {
        await partyService.delete(id);
        loadParties();
    } catch(e) {
        alert("Failed to delete party");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <User className="text-sky-500" />
          Party Name Master
        </h2>
        <div className="flex gap-3">
            <CsvImporter 
                onImport={handleImport} 
                sampleHeaders={['party_name']}
            />
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition flex items-center gap-2 font-medium shadow-sm"
            >
              <Plus size={18} /> Add Party Name
            </button>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-lg font-bold text-gray-800">Add Party</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Party Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                  placeholder="e.g. Rahul Traders"
                />
              </div>

              <button 
                onClick={handleAdd}
                className="w-full bg-sky-500 text-white py-3 rounded-lg font-bold hover:bg-sky-600 transition mt-4 flex justify-center items-center gap-2"
              >
                <Save size={18} /> Save Party
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
                <th className="p-4">Party Name</th>
                <th className="p-4 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr><td colSpan={2} className="p-4 text-center">Loading...</td></tr>
              ) : parties.length === 0 ? (
                <tr><td colSpan={2} className="p-4 text-center text-gray-400">No parties found.</td></tr>
              ) : (
                parties.map((p) => (
                  <tr key={p.id} className="hover:bg-sky-50/50 transition">
                    <td className="p-4 font-bold text-gray-800">{p.party_name}</td>
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

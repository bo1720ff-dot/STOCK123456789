
import React, { useState, useEffect } from 'react';
import { customerService } from '../services/supabase';
import { Customer } from '../types';
import { Plus, User, MapPin, Truck, Save, X, Trash2 } from 'lucide-react';
import { CsvImporter } from './CsvImporter';

export const CustomerManager: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [vehicle, setVehicle] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await customerService.getAll();
      setCustomers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleAddCustomer = async () => {
    if (!name) {
      alert("Customer Name is required");
      return;
    }

    try {
      await customerService.add({
        customer_name: name,
        customer_address: address,
        vehicle_number: vehicle
      });
      
      // Reset and reload
      setName('');
      setAddress('');
      setVehicle('');
      setShowAddForm(false);
      loadCustomers();
      alert("Customer added successfully!");
    } catch (e) {
      alert("Failed to add customer");
    }
  };

  const handleImport = async (data: any[]) => {
      await customerService.importBulk(data);
      loadCustomers();
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
        await customerService.delete(id);
        loadCustomers();
    } catch(e) {
        alert("Failed to delete customer");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <User className="text-sky-500" />
          Name & Address Manager
        </h2>
        <div className="flex gap-3">
            <CsvImporter 
                onImport={handleImport} 
                sampleHeaders={['customer_name', 'customer_address', 'vehicle_number']}
            />
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition flex items-center gap-2 font-medium shadow-sm"
            >
              <Plus size={18} /> Add New Customer
            </button>
        </div>
      </div>

      {/* Add Customer Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-lg font-bold text-gray-800">Add Customer</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Customer Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                  placeholder="e.g. Rahul Traders"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Address</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                  placeholder="City or Area"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Vehicle Number</label>
                <input 
                  type="text" 
                  value={vehicle}
                  onChange={e => setVehicle(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                  placeholder="MH-XX-1234"
                />
              </div>

              <button 
                onClick={handleAddCustomer}
                className="w-full bg-sky-500 text-white py-3 rounded-lg font-bold hover:bg-sky-600 transition mt-4 flex justify-center items-center gap-2"
              >
                <Save size={18} /> Save Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer List */}
      <div className="bg-white rounded-xl shadow-sm border border-sky-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50 border-b border-sky-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="p-4">Name</th>
                <th className="p-4">Address</th>
                <th className="p-4">Vehicle</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-gray-400">No customers found.</td></tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-sky-50/50 transition">
                    <td className="p-4 font-bold text-gray-800">{c.customer_name}</td>
                    <td className="p-4 text-gray-600 flex items-center gap-2">
                       {c.customer_address && <MapPin size={14} className="text-gray-400" />}
                       {c.customer_address || '-'}
                    </td>
                    <td className="p-4 text-gray-600 font-mono">
                        {c.vehicle_number && <Truck size={14} className="inline mr-2 text-gray-400" />}
                        {c.vehicle_number || '-'}
                    </td>
                    <td className="p-4 text-center">
                        <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-500 transition">
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

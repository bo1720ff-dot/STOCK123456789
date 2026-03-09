
import React, { useState, useEffect } from 'react';
import { vehicleService, userService } from '../services/supabase';
import { Vehicle } from '../types';
import { Plus, Truck, Save, X, Trash2, User as UserIcon, Phone } from 'lucide-react';
import { CsvImporter } from './CsvImporter';

export const VehicleManager: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]); // List of Driver Users
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form State
  const [vehicleNo, setVehicleNo] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState(''); // Selected Driver ID
  const [driverName, setDriverName] = useState(''); // Fallback manual name
  const [driverContact, setDriverContact] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [vData, uData] = await Promise.all([
          vehicleService.getAll(),
          userService.getAll()
      ]);
      setVehicles(vData);
      // Filter users who have the role 'DRIVER'
      setDrivers(uData.filter((u: any) => u.role === 'DRIVER'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async () => {
    if (!vehicleNo) {
      alert("Vehicle Number is required");
      return;
    }

    // If a driver is selected from dropdown, use their name. Otherwise use manual input.
    let finalDriverName = driverName;
    if (selectedDriverId) {
        const selectedDriver = drivers.find(d => d.id === selectedDriverId);
        if (selectedDriver) finalDriverName = selectedDriver.name;
    }

    try {
      await vehicleService.add({
        vehicle_number: vehicleNo.toUpperCase(),
        driver_name: finalDriverName,
        driver_contact: driverContact
      });
      
      // Reset Form
      setVehicleNo('');
      setDriverName('');
      setSelectedDriverId('');
      setDriverContact('');
      setShowAddForm(false);
      loadData();
    } catch (e) {
      alert("Failed to add vehicle");
    }
  };

  const handleImport = async (data: any[]) => {
      await vehicleService.importBulk(data);
      loadVehicles();
  };

  const handleDelete = async (id: string) => {
      if(!window.confirm("Are you sure you want to delete this vehicle?")) return;
      try {
          await vehicleService.delete(id);
          loadVehicles();
      } catch(e) {
          alert("Failed to delete");
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Truck className="text-sky-500" />
          Vehicle & Driver Master
        </h2>
        <div className="flex gap-3">
            <CsvImporter 
                onImport={handleImport} 
                sampleHeaders={['vehicle_number', 'driver_name', 'driver_contact']}
            />
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition flex items-center gap-2 font-medium shadow-sm"
            >
              <Plus size={18} /> Add New Vehicle
            </button>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-lg font-bold text-gray-800">Add Vehicle</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Vehicle Number *</label>
                <input 
                  autoFocus
                  type="text" 
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition uppercase"
                  placeholder="WB-XX-XXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Assign Driver (User)</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => {
                      setSelectedDriverId(e.target.value);
                      if (e.target.value) setDriverName(''); // Clear manual name if user selected
                  }}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition bg-white"
                >
                    <option value="">-- Select Driver Account --</option>
                    {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.username})</option>
                    ))}
                </select>
              </div>

              {!selectedDriverId && (
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-1">Or Enter Driver Name (Manual)</label>
                    <input 
                      type="text" 
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition uppercase"
                      placeholder="Name"
                    />
                  </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Driver Contact (Default)</label>
                <input 
                  type="text" 
                  value={driverContact}
                  onChange={e => setDriverContact(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                  placeholder="Phone"
                />
              </div>

              <button 
                onClick={handleAdd}
                className="w-full bg-sky-500 text-white py-3 rounded-lg font-bold hover:bg-sky-600 transition mt-4 flex justify-center items-center gap-2"
              >
                <Save size={18} /> Save
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
                <th className="p-4">Vehicle Number</th>
                <th className="p-4">Default Driver</th>
                <th className="p-4">Contact</th>
                <th className="p-4 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>
              ) : vehicles.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-gray-400">No vehicles found.</td></tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-sky-50/50 transition">
                    <td className="p-4 font-bold text-gray-800 font-mono flex items-center gap-2">
                        <Truck size={16} className="text-gray-400" />
                        {v.vehicle_number}
                    </td>
                    <td className="p-4 text-gray-600">
                        {v.driver_name ? (
                            <span className="flex items-center gap-2">
                                <UserIcon size={14} className="text-gray-400" /> {v.driver_name}
                            </span>
                        ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="p-4 text-gray-600 font-mono text-xs">
                        {v.driver_contact ? (
                            <span className="flex items-center gap-2">
                                <Phone size={14} className="text-gray-400" /> {v.driver_contact}
                            </span>
                        ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="p-4 text-center">
                        <button onClick={() => handleDelete(v.id)} className="text-gray-400 hover:text-red-500">
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

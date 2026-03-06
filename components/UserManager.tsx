
import React, { useState, useEffect } from 'react';
import { userService } from '../services/supabase';
import { User, UserRole } from '../types';
import { Plus, Shield, Save, X, Trash2, UserPlus } from 'lucide-react';
import { CsvImporter } from './CsvImporter';

export const UserManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.SALESMAN);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getAll();
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async () => {
    if (!name || !username || !password) {
      alert("All fields are required");
      return;
    }

    try {
      await userService.add({
        name,
        username,
        password,
        role
      });
      
      // Reset and reload
      setName('');
      setUsername('');
      setPassword('');
      setRole(UserRole.SALESMAN);
      setShowAddForm(false);
      loadUsers();
      alert("User added successfully!");
    } catch (e) {
      alert("Failed to add user. Username might be taken.");
    }
  };

  const handleImport = async (data: any[]) => {
      await userService.importBulk(data);
      loadUsers();
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Are you sure you want to delete this user?")) return;
    try {
        await userService.delete(id);
        loadUsers();
    } catch(e) {
        alert("Failed to delete user");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="text-sky-500" />
          User Management
        </h2>
        <div className="flex gap-3">
            <CsvImporter 
                onImport={handleImport} 
                sampleHeaders={['username', 'password', 'name', 'role']}
            />
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition flex items-center gap-2 font-medium shadow-sm"
            >
              <Plus size={18} /> Add New User
            </button>
        </div>
      </div>

      {/* Add User Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><UserPlus size={20} className="text-sky-500"/> Add User</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Full Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Username (Login ID)</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                  placeholder="e.g. johnd"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Password</label>
                <input 
                  type="text" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none transition"
                  placeholder="Secret Password"
                />
              </div>

              <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">Role</label>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full border border-gray-200 p-2 rounded focus:ring-2 focus:ring-sky-400 outline-none bg-white transition"
                  >
                      <option value={UserRole.ADMIN}>ADMIN (Full Access)</option>
                      <option value={UserRole.SALESMAN}>SALESMAN (Mobile Order)</option>
                      <option value={UserRole.EMPLOYEE}>EMPLOYEE (Stock Entry)</option>
                      <option value={UserRole.DRIVER}>DRIVER (Dispatch & Delivery)</option>
                  </select>
              </div>

              <button 
                onClick={handleAddUser}
                className="w-full bg-sky-500 text-white py-3 rounded-lg font-bold hover:bg-sky-600 transition mt-4 flex justify-center items-center gap-2"
              >
                <Save size={18} /> Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User List */}
      <div className="bg-white rounded-xl shadow-sm border border-sky-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50 border-b border-sky-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="p-4">Name</th>
                <th className="p-4">Username</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-gray-400">No users found.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-sky-50/50 transition">
                    <td className="p-4 font-bold text-gray-800">{u.name}</td>
                    <td className="p-4 text-gray-600 font-mono">{u.username}</td>
                    <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${
                            u.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            u.role === UserRole.SALESMAN ? 'bg-sky-50 text-sky-700 border-sky-200' :
                            u.role === UserRole.DRIVER ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-green-50 text-green-700 border-green-200'
                        }`}>
                            {u.role}
                        </span>
                    </td>
                    <td className="p-4 text-center">
                        <button onClick={() => handleDelete(u.id!)} className="text-gray-300 hover:text-red-500 transition">
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

import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { userService, notificationService, vehicleService } from '../services/supabase';
import { Send, Megaphone, CheckCircle } from 'lucide-react';

export const SendNotification: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    userService.getAll().then(setUsers);
  }, []);

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id || ''));
    }
  };

  const handleToggleUser = (id: string) => {
    setSelectedUsers(prev => 
      prev.includes(id) ? prev.filter(uId => uId !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (!message.trim() || selectedUsers.length === 0) return;
    setLoading(true);
    try {
      for (const userId of selectedUsers) {
        if (userId) {
          await notificationService.send(userId, currentUser.id, message);
        }
      }
      setSuccess(true);
      setMessage('');
      setSelectedUsers([]);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to send notifications:', error);
      alert('Failed to send notifications');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-2">
          <Megaphone className="text-sky-500" /> Broadcast Notification
        </h2>
        <p className="text-slate-500 text-sm font-medium mb-6">Send a message to specific users or everyone.</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition resize-none h-32"
              placeholder="Type your notification message here..."
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Select Recipients</label>
              <button onClick={handleSelectAll} className="text-xs font-bold text-sky-600 hover:text-sky-700">
                {selectedUsers.length === users.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-64 overflow-y-auto">
              {users.map(u => (
                <div 
                  key={u.id} 
                  onClick={() => handleToggleUser(u.id || '')}
                  className="flex items-center gap-3 p-3 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(u.id || '')}
                    readOnly
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 pointer-events-none"
                  />
                  <div className="flex-1 pointer-events-none">
                    <div className="font-bold text-slate-800 text-sm">{u.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{u.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={loading || !message.trim() || selectedUsers.length === 0}
            className="w-full py-4 bg-sky-600 text-white font-black rounded-xl shadow-lg shadow-sky-200 hover:bg-sky-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? 'Sending...' : 'Send Notification'}
            {!loading && <Send size={18} />}
          </button>

          {success && (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-center justify-center gap-2 font-bold text-sm">
              <CheckCircle size={18} /> Notifications sent successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { User } from '../types';
import { userService } from '../services/supabase';
import { Lock, User as UserIcon } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
        const user = await userService.authenticate(username.trim(), password.trim());
        if (user) {
            // Direct login - No security question
            onLogin(user);
        } else {
            setError('Invalid credentials. Access Denied.');
            setLoading(false);
        }
    } catch (err) {
        setError('Login failed. Please try again.');
        console.error(err);
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sky-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden relative">
        
        {/* Header */}
        <div className="p-8 text-center bg-sky-600">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Lock className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-wide">GREENZAR STOCK</h1>
          <p className="text-sky-100 text-sm mt-1 font-medium">
              Secure Access Portal
          </p>
        </div>

        <div className="p-8 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <form onSubmit={handleLogin} className="space-y-6">
                
                {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg font-bold text-center animate-pulse">
                    {error}
                </div>
                )}

                <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Username</label>
                <div className="relative">
                    <UserIcon className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition bg-gray-50 focus:bg-white font-medium text-gray-800"
                    placeholder="Enter username"
                    autoComplete="off"
                    />
                </div>
                </div>

                <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition bg-gray-50 focus:bg-white font-medium text-gray-800"
                    placeholder="••••••••"
                    />
                </div>
                </div>

                <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-sky-200 transition-all flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                    "LOGIN TO DASHBOARD"
                )}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="text-center">
                <p className="text-xs text-gray-400 font-bold mb-2">Greenzar Food And Beverage</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
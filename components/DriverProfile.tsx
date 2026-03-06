import React, { useEffect, useState } from 'react';
import { User, Vehicle } from '../types';
import { vehicleService } from '../services/supabase';
import { User as UserIcon, Truck, Phone, LogOut, Shield, Calendar } from 'lucide-react';

interface DriverProfileProps {
    user: User;
    onLogout: () => void;
}

export const DriverProfile: React.FC<DriverProfileProps> = ({ user, onLogout }) => {
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadVehicle = async () => {
            try {
                const vehicles = await vehicleService.getAll();
                // Logic from DispatchTickets.tsx
                let myVehicle = vehicles.find(v => (v.driver_name || '').toLowerCase() === (user.name || '').toLowerCase());
                
                if (!myVehicle && user.username) {
                    myVehicle = vehicles.find(v => (v.vehicle_number || '').replace(/\s/g,'').toLowerCase() === (user.username || '').replace(/\s/g,'').toLowerCase());
                }
                setVehicle(myVehicle || null);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadVehicle();
    }, [user]);

    return (
        <div className="h-full bg-slate-50 flex flex-col">
            {/* Header / Banner */}
            <div className="bg-sky-600 pt-10 pb-16 px-6 rounded-b-[3rem] shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                     <Truck size={300} className="absolute -right-10 -bottom-10 text-white transform -rotate-12"/>
                </div>
                
                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-24 h-24 bg-white rounded-full border-4 border-sky-300 shadow-xl flex items-center justify-center mb-4">
                        <UserIcon size={48} className="text-sky-600" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">{user.name}</h1>
                    <div className="flex items-center gap-2 mt-1 bg-sky-700/50 px-3 py-1 rounded-full backdrop-blur-sm border border-sky-500/30">
                        <Shield size={12} className="text-sky-200"/>
                        <span className="text-xs font-bold text-sky-100 uppercase tracking-wider">Verified Driver</span>
                    </div>
                </div>
            </div>

            {/* Content Card */}
            <div className="flex-1 px-4 -mt-10 pb-20 overflow-y-auto">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 space-y-6">
                    
                    {/* Vehicle Info */}
                    <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Vehicle Assignment</h3>
                        {loading ? (
                            <div className="animate-pulse h-20 bg-slate-100 rounded-2xl"></div>
                        ) : vehicle ? (
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
                                <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600 shrink-0">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <p className="text-lg font-black text-slate-800">{vehicle.vehicle_number}</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Active Vehicle</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 text-center">
                                <p className="text-orange-600 font-bold text-sm">No Vehicle Assigned</p>
                            </div>
                        )}
                    </div>

                    {/* Personal Details */}
                    <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Driver Details</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <UserIcon size={20}/>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Username</p>
                                    <p className="font-bold text-slate-800">{user.username}</p>
                                </div>
                            </div>
                            
                            {vehicle?.driver_contact && (
                                <div className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                        <Phone size={20}/>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Contact</p>
                                        <p className="font-bold text-slate-800">{vehicle.driver_contact}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <Calendar size={20}/>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Joined</p>
                                    <p className="font-bold text-slate-800">Active Member</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Logout Action */}
                    <div className="pt-4 border-t border-slate-100">
                        <button 
                            onClick={onLogout}
                            className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black text-sm hover:bg-red-100 transition flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} /> LOGOUT ACCOUNT
                        </button>
                        <p className="text-center text-[10px] font-bold text-slate-300 mt-4 uppercase">
                            Greenzar Logistics v2.0
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

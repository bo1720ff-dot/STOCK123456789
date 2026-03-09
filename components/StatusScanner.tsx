
import React, { useState, useRef, useEffect } from 'react';
import { billService } from '../services/supabase';
import { OrderStatus, UserRole, User } from '../types';
import { QrCode, ArrowRight, CheckCircle, AlertTriangle, Truck, PackageCheck, Camera, X, RefreshCw, Lock } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface StatusScannerProps {
  role: UserRole; // EMPLOYEE or SALESMAN
  user: User;
}

// Utility for Local Date String (YYYY-MM-DD)
const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const StatusScanner: React.FC<StatusScannerProps> = ({ role, user }) => {
  const [billNo, setBillNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(true); // Default to TRUE for fast start
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<any>(null); // Stores the Html5Qrcode instance

  // --- CONFIGURATION BASED ON ROLE ---
  // Employee -> OUT_FOR_DELIVERY (Dispatching)
  // Salesman -> RECEIVED (Received at destination/customer, pending final Delivery confirmation by Admin)
  const targetStatus: OrderStatus = role === UserRole.EMPLOYEE ? 'OUT_FOR_DELIVERY' : 'RECEIVED';
  
  const title = role === UserRole.EMPLOYEE ? 'Dispatch Scanner' : 'Receive Scanner';
  const desc = role === UserRole.EMPLOYEE ? 'Scan to mark Out for Delivery' : 'Scan to mark Received';
  const colorClass = role === UserRole.EMPLOYEE ? 'bg-sky-600' : 'bg-teal-600';

  useEffect(() => {
    // Auto-start scanner when component mounts
    startScanner();
    
    // Cleanup scanner on unmount
    return () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    scannerRef.current.stop().then(() => {
                        scannerRef.current.clear();
                    }).catch((err: any) => console.error(err));
                } else {
                    scannerRef.current.clear();
                }
            } catch (e) {
                console.error("Failed to cleanup scanner", e);
            }
        }
    };
  }, []);

  const processBill = async (scannedBillNo: string) => {
      const cleanNo = scannedBillNo.trim().toUpperCase();
      if (!cleanNo) return;

      setLoading(true);
      setMessage(null);

      try {
        // 1. Fetch Bill Details First
        const bill = await billService.getByBillNo(cleanNo);
        
        if (!bill) {
            throw new Error(`Order ${cleanNo} not found.`);
        }

        // 2. CHECK IF LOCKED (APPROVED OR DELIVERED)
        if (bill.status === 'APPROVED' || bill.status === 'DELIVERED') {
            throw new Error(`Order ${cleanNo} is ${bill.status}. Cannot change.`);
        }

        // 3. Salesman Ownership Check
        if (role === UserRole.SALESMAN) {
            const billSalesman = (bill.salesman_name || '').trim().toLowerCase();
            const currentSalesman = (user.name || '').trim().toLowerCase();

            // Strict check: Salesman can only scan their own orders
            if (billSalesman !== currentSalesman) {
                throw new Error(`Permission Denied: This order belongs to ${bill.salesman_name || 'Admin/Direct'}`);
            }
        }

        // 4. Update Status AND Remark with "Edited by" using Regex
        let currentRemark = bill.remark || '';
        // Remove old tag to prevent duplicates (handles various spacing)
        currentRemark = currentRemark.replace(/\s*\|\s*Edited by:.*$/i, '').trim();
        
        const tag = ` | Edited by: ${user.name}`;
        currentRemark = currentRemark + tag;

        // Use generic update to save status, remark AND DATE
        await billService.update(bill.id, { 
            status: targetStatus,
            remark: currentRemark,
            bill_date: getLocalToday() // UPDATE DATE TO TODAY
        });
        
        // Success Message
        setMessage({ 
            type: 'success', 
            text: `Order ${cleanNo} Marked as ${targetStatus.replace(/_/g, ' ')}` 
        });
        setBillNo('');
        
      } catch (err: any) {
        console.error(err);
        setMessage({ type: 'error', text: err.message || "Failed to update status" });
      } finally {
        setLoading(false);
      }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      processBill(billNo);
  };

  const startScanner = () => {
      setIsScannerActive(true);
      setMessage(null);
      
      // Small delay to ensure DOM element exists
      setTimeout(() => {
          // @ts-ignore
          if (!window.Html5Qrcode) {
              setTimeout(startScanner, 500);
              return;
          }

          if (scannerRef.current && scannerRef.current.isScanning) return;

          try {
              // @ts-ignore
              const html5QrCode = new window.Html5Qrcode("reader");
              scannerRef.current = html5QrCode;

              const config = { 
                  fps: 25, 
                  qrbox: { width: 250, height: 250 },
                  aspectRatio: 1.0,
                  disableFlip: false
              };

              // Try rear camera strict
              html5QrCode.start(
                  { facingMode: { exact: "environment" } }, 
                  config,
                  (decodedText: string) => {
                      html5QrCode.pause();
                      setBillNo(decodedText);
                      processBill(decodedText).then(() => {
                          html5QrCode.resume();
                      });
                  },
                  (errorMessage: string) => {}
              ).catch((err: any) => {
                  // Fallback
                  html5QrCode.start(
                      { facingMode: "environment" },
                      config,
                      (decodedText: string) => {
                          html5QrCode.pause();
                          setBillNo(decodedText);
                          processBill(decodedText).then(() => html5QrCode.resume());
                      },
                      () => {}
                  ).catch((err2: any) => {
                      setIsScannerActive(false);
                      alert("Camera failed to start. Please use manual entry.");
                  });
              });
          } catch(e) {
              setIsScannerActive(false);
          }

      }, 300);
  };

  return (
    <div className="flex flex-col h-full bg-black">
        {/* Full Screen Camera View */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4 flex justify-between items-start">
                <div className="flex items-center gap-3 text-white">
                    <div className={`p-2 rounded-full ${role === UserRole.EMPLOYEE ? 'bg-sky-600' : 'bg-teal-600'}`}>
                        {role === UserRole.EMPLOYEE ? <Truck size={20}/> : <PackageCheck size={20}/>}
                    </div>
                    <div>
                        <h2 className="font-bold text-lg leading-none">{title}</h2>
                        <p className="text-xs text-white/70">{desc}</p>
                    </div>
                </div>
                <div className="bg-white/10 rounded-full backdrop-blur-md">
                    <NotificationBell currentUser={user} />
                </div>
            </div>

            {/* Camera Area */}
            <div id="reader" className="w-full h-full bg-black object-cover"></div>

            {/* Overlay Frame */}
            {isScannerActive && (
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl"></div>
                    </div>
                </div>
            )}

            {/* Message Overlay */}
            {message && (
             <div className="absolute top-20 left-4 right-4 z-30 animate-in slide-in-from-top-4 fade-in duration-300">
                 <div className={`p-4 rounded-xl flex items-center gap-3 shadow-2xl ${message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {message.type === 'success' ? <CheckCircle className="shrink-0" size={24}/> : <Lock className="shrink-0" size={24}/>}
                    <div className="font-bold text-sm">{message.text}</div>
                 </div>
             </div>
            )}
        </div>

        {/* Bottom Manual Entry (Compact) */}
        <div className="bg-white p-4 pt-2 rounded-t-2xl z-20">
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4"></div>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
                <div className="relative flex-1">
                    <div className="absolute left-3 top-3.5 text-gray-400">
                        <QrCode size={20} />
                    </div>
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={billNo}
                        onChange={(e) => setBillNo(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-sky-500 placeholder:text-gray-400 uppercase"
                        placeholder="Manual Bill No"
                    />
                </div>
                <button 
                    type="submit" 
                    disabled={loading || !billNo}
                    className={`px-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${colorClass}`}
                >
                    {loading ? <RefreshCw className="animate-spin" size={24}/> : <ArrowRight size={24} />}
                </button>
            </form>
        </div>
    </div>
  );
};

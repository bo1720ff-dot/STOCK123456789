import React, { useState, useEffect } from 'react';
import { productionLogService, billService } from '../services/supabase';
import { ArrowUp, ArrowDown, User, Truck, Clock, ScrollText, Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface TransactionItem {
    type: 'IN' | 'OUT';
    ref: string;
    title: string;
    items: string[];
    time: string;
    rawTime: number;
}

const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const TransactionLog: React.FC = () => {
  const [date, setDate] = useState<string>(getLocalToday());
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    try {
        // 1. Production Logs (IN)
        const prodLogs = await productionLogService.getByDate(date);
        const approvedLogs = prodLogs.filter(l => l.status === 'APPROVED');
        
        const prodTx: TransactionItem[] = approvedLogs.map(log => ({
            type: 'IN',
            ref: `${log.shift} PROD`,
            title: log.user_name || 'Staff',
            items: [`${log.product_name} (+${log.qty})`],
            time: log.time,
            rawTime: new Date(`${date} ${log.time}`).getTime() || 0
        }));

        // 2. Sales Bills (OUT)
        const salesBills = await billService.getDeepBillsByDate(date);
        const salesTx: TransactionItem[] = salesBills.map(bill => {
            const t = bill.created_at ? new Date(bill.created_at) : new Date();
            const timeStr = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            
            return {
                type: 'OUT',
                ref: bill.bill_no,
                title: bill.customer_name || 'Cash Sale',
                items: (bill.items || []).map(i => `${i.product_name} (${i.qty})`),
                time: timeStr,
                rawTime: t.getTime()
            };
        });

        // 3. Merge and Sort
        const allTx = [...prodTx, ...salesTx].sort((a, b) => b.rawTime - a.rawTime);
        setTransactions(allTx);

    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const shiftDate = (days: number) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <ScrollText className="text-sky-500" /> Daily Transaction Log
            </h2>
            
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-gray-100 rounded text-gray-500">
                    <ChevronLeft size={20} />
                </button>
                <div className="relative">
                    <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)}
                        className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-bold focus:border-sky-400 outline-none text-center w-36"
                    />
                    <Calendar size={16} className="absolute left-2.5 top-2.5 text-gray-400" />
                </div>
                <button onClick={() => shiftDate(1)} className="p-2 hover:bg-gray-100 rounded text-gray-500">
                    <ChevronRight size={20} />
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                <button onClick={() => loadData()} className="p-2 hover:bg-gray-100 rounded text-sky-600">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
                </button>
            </div>
       </div>

       <div className="flex-1 overflow-y-auto bg-gray-50/50 rounded-xl border border-gray-200 p-4">
            {loading ? (
                <div className="flex justify-center items-center h-full text-gray-400">Loading transactions...</div>
            ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                    <ScrollText size={40} className="opacity-20"/>
                    <p>No transactions found for {date}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {transactions.map((tx, i) => (
                        <div 
                            key={i} 
                            className={`bg-white p-4 rounded-xl border-l-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition hover:shadow-md ${
                                tx.type === 'IN' ? 'border-l-emerald-500' : 'border-l-red-500'
                            }`}
                        >
                            {/* Left: Icon & Ref */}
                            <div className="flex items-start gap-3 w-full md:w-1/3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    tx.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                }`}>
                                    {tx.type === 'IN' ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
                                </div>
                                <div>
                                    <div className={`text-[10px] font-bold uppercase tracking-wide ${
                                        tx.type === 'IN' ? 'text-emerald-600' : 'text-red-600'
                                    }`}>
                                        {tx.type === 'IN' ? 'PLUS (PRODUCTION)' : 'MINUS (STOCK OUT)'}
                                    </div>
                                    <div className="font-bold text-gray-900 text-sm">{tx.ref}</div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                        {tx.type === 'IN' ? <User size={12}/> : <Truck size={12}/>} 
                                        {tx.title}
                                    </div>
                                </div>
                            </div>

                            {/* Middle: Items */}
                            <div className="flex-1 w-full">
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Items & Quantity</div>
                                <div className="flex flex-wrap gap-2">
                                    {tx.items.map((item, idx) => (
                                        <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold font-mono border border-gray-200">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Time */}
                            <div className="w-full md:w-auto text-left md:text-right">
                                <div className="flex items-center md:justify-end gap-1 text-gray-400 text-xs font-bold bg-gray-50 px-2 py-1 rounded-lg">
                                    <Clock size={12} /> {tx.time}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
       </div>
    </div>
  );
};
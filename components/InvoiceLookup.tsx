
import React, { useState, useEffect } from 'react';
import { billService, productService, vehicleService } from '../services/supabase';
import { Bill, BillItem, Product, OrderStatus, BillType, Vehicle, User, UserRole } from '../types';
import { Search, Package, MapPin, Phone, User as UserIcon, Truck, Clock, Calendar, CheckCircle, AlertCircle, FileText, CreditCard, Edit3, Save, X, Plus, Trash2, IndianRupee, Lock, RefreshCw, Edit2 } from 'lucide-react';
import { SearchableDropdown } from './SearchableDropdown';

interface InvoiceLookupProps {
  user?: User | null;
}

export const InvoiceLookup: React.FC<InvoiceLookupProps> = ({ user }) => {
  const [billNo, setBillNo] = useState('');
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- EDIT MODE STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Bill>>({});
  const [editItems, setEditItems] = useState<BillItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  // New Item State
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemRate, setNewItemRate] = useState('');

  useEffect(() => {
      // Preload products and vehicles
      const loadMasters = async () => {
          try {
              const [p, v] = await Promise.all([
                  productService.getAll(),
                  vehicleService.getAll()
              ]);
              setProducts(p);
              setVehicles(v);
          } catch(e) {
              console.error("Failed to load masters", e);
          }
      };
      loadMasters();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!billNo.trim()) return;

    setLoading(true);
    setError('');
    setBill(null);
    setIsEditing(false);

    try {
      const result = await billService.getByBillNo(billNo);
      if (result) {
        // --- PERMISSION CHECK FOR SALESMAN ---
        if (user && user.role === UserRole.SALESMAN) {
            const billSalesman = (result.salesman_name || '').trim().toLowerCase();
            const currentSalesman = (user.name || '').trim().toLowerCase();

            if (billSalesman !== currentSalesman) {
                setError(`Access Denied: This invoice belongs to ${result.salesman_name || 'Admin/Another Salesman'}`);
                setBill(null);
                setLoading(false);
                return;
            }
        }

        setBill(result);
      } else {
        setError('Invoice not found. Please check the number.');
      }
    } catch (err) {
      console.error(err);
      setError('System error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
      if (!bill) return;
      // Locked if Approved or Delivered (Strict)
      if (bill.status === 'APPROVED' || bill.status === 'DELIVERED') {
          setError(`Cannot edit ${bill.status} invoices.`);
          return;
      }
      setEditForm({ ...bill });
      // Deep copy items to avoid mutating original displayed bill until save
      setEditItems(bill.items ? JSON.parse(JSON.stringify(bill.items)) : []);
      setIsEditing(true);
  };

  const cancelEditing = () => {
      setIsEditing(false);
      setEditForm({});
      setEditItems([]);
  };

  const handleFormChange = (field: keyof Bill, value: any) => {
      setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: keyof BillItem, value: any) => {
      const updated = [...editItems];
      updated[index] = { ...updated[index], [field]: value };
      
      // Auto calc line total
      if (field === 'qty' || field === 'rate') {
          const q = parseFloat(updated[index].qty as any) || 0;
          const r = parseFloat(updated[index].rate as any) || 0;
          updated[index].line_total = q * r;
      }
      setEditItems(updated);
  };

  const deleteItem = (index: number) => {
      const updated = [...editItems];
      updated.splice(index, 1);
      setEditItems(updated);
  };

  const addNewItem = () => {
      if (!newItemName || !newItemQty) return;
      const qty = parseFloat(newItemQty);
      const rate = parseFloat(newItemRate) || 0;
      
      setEditItems([...editItems, {
          product_name: newItemName,
          qty: qty,
          rate: rate,
          line_total: qty * rate
      }]);
      
      // Reset inputs
      setNewItemName('');
      setNewItemQty('');
      setNewItemRate('');
  };

  const saveChanges = async () => {
      if (!bill || !editForm.bill_no) return;
      
      // --- CONFIRMATION FOR DELIVERED STATUS ---
      if (editForm.status === 'DELIVERED') {
          const confirm1 = window.confirm("⚠️ CONFIRMATION: Mark this order as DELIVERED?\n\nThis will lock the order for editing. Continue?");
          if (!confirm1) return;
      } else {
          if (!window.confirm("Are you sure you want to save changes to this invoice?")) return;
      }

      setLoading(true);
      try {
          // 1. Recalculate totals
          const totalQty = editItems.reduce((acc, i) => acc + Number(i.qty), 0);
          const totalAmount = editItems.reduce((acc, i) => acc + (Number(i.line_total) || 0), 0);

          // --- AUTO-APPEND "EDITED BY" MARK TO REMARK (REGEX) ---
          let currentRemark = editForm.remark || '';
          // Remove old tag using regex to be robust
          currentRemark = currentRemark.replace(/\s*\|\s*Edited by:.*$/i, '').trim();
          
          if (user) {
             const tag = ` | Edited by: ${user.name}`;
             currentRemark = currentRemark + tag;
          }

          // 2. STRICT PAYLOAD CONSTRUCTION
          const updatePayload = {
              bill_date: editForm.bill_date,
              bill_type: editForm.bill_type,
              customer_name: editForm.customer_name,
              customer_address: editForm.customer_address,
              phone_number: editForm.phone_number,
              gst_number: editForm.gst_number,
              pan_number: editForm.pan_number,
              aadhar_number: editForm.aadhar_number,
              vehicle_number: editForm.vehicle_number,
              driver_name: editForm.driver_name,
              driver_contact: editForm.driver_contact,
              salesman_name: editForm.salesman_name,
              payment_upi: editForm.payment_upi,
              remark: currentRemark, // SAVE UPDATED REMARK
              status: editForm.status,
              total_qty: totalQty,
              total_amount: totalAmount
          };

          // 3. Send Update
          await billService.update(bill.id, updatePayload, editItems);
          
          // 4. Refresh data
          const fresh = await billService.getByBillNo(bill.bill_no);
          setBill(fresh);
          setIsEditing(false);
          alert("Invoice Updated Successfully!");

      } catch (e: any) {
          console.error(e);
          alert(`Failed to update invoice: ${e.message || 'Unknown Error'}`);
      } finally {
          setLoading(false);
      }
  };

  const calculateDuration = (bill: Bill) => {
      const start = new Date(bill.created_at || bill.bill_date);
      const end = new Date(); // Current time
      
      const diffMs = end.getTime() - start.getTime();
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.round(((diffMs % 3600000) / 60000));
      
      if (diffHrs > 24) {
          const days = Math.floor(diffHrs / 24);
          return `${days} Days ${diffHrs % 24} Hours`;
      }
      return `${diffHrs} Hours ${diffMins} Mins`;
  };

  const getStatusStep = (status?: string) => {
      if (!status || status === 'PENDING') return 1;
      if (status === 'LOADING') return 2;
      if (status === 'OUT_FOR_DELIVERY') return 3;
      if (status === 'DELIVERED') return 4;
      if (status === 'APPROVED') return 5;
      return 1;
  };

  const step = bill ? getStatusStep(bill.status) : 0;
  const productOptions = products.map(p => ({ id: p.id, title: p.product_name, subtitle: `Rate: ${p.rate}` }));
  const vehicleOptions = vehicles.map(v => ({ 
      id: v.id, 
      title: v.vehicle_number, 
      subtitle: v.driver_name,
      tag: 'VEH',
      originalData: v 
  }));

  // Parse Remark & Editor
  const getEditorName = (remark?: string) => {
      if (!remark || !remark.includes('| Edited by:')) return null;
      return remark.split('| Edited by:')[1].trim();
  };
  const getCleanRemark = (remark?: string) => {
      if (!remark) return '';
      return remark.split('| Edited by:')[0].trim();
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full bg-slate-50 relative font-sans p-4 space-y-6">
        
        {/* Header & Search */}
        <div className="max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 mb-1 flex items-center gap-2">
                        <Search className="text-sky-500" strokeWidth={3} /> Invoice Check
                    </h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-6">
                        Track, View & Edit Full Details
                    </p>
                </div>
                {/* HIDE EDIT BUTTON FOR SALESMAN OR IF LOCKED */}
                {bill && !isEditing && user?.role !== UserRole.SALESMAN && (
                    <button 
                        onClick={startEditing}
                        disabled={bill.status === 'APPROVED' || bill.status === 'DELIVERED'}
                        className={`px-5 py-2.5 rounded-xl font-bold shadow-lg transition flex items-center gap-2 ${
                            bill.status === 'APPROVED' || bill.status === 'DELIVERED'
                            ? 'bg-gray-100 text-gray-400 shadow-none cursor-not-allowed' 
                            : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'
                        }`}
                    >
                        {bill.status === 'APPROVED' || bill.status === 'DELIVERED' ? <Lock size={18} /> : <Edit3 size={18} />}
                        {bill.status === 'APPROVED' ? 'LOCKED (FINAL)' : bill.status === 'DELIVERED' ? 'LOCKED (DELIVERED)' : 'EDIT INVOICE'}
                    </button>
                )}
            </div>

            {!isEditing && (
                <form onSubmit={handleSearch} className="relative group mb-6">
                    <div className="absolute left-4 top-4 text-slate-400 group-focus-within:text-sky-500 transition-colors">
                        <FileText size={24} />
                    </div>
                    <input 
                        type="text" 
                        value={billNo}
                        onChange={e => setBillNo(e.target.value)}
                        className="w-full pl-14 pr-32 py-4 rounded-2xl border-2 border-slate-200 bg-white text-lg font-black text-slate-800 outline-none focus:border-sky-500 focus:shadow-xl focus:shadow-sky-100 transition-all placeholder:text-slate-300 uppercase"
                        placeholder="ENTER BILL NO (e.g. 4050)"
                        autoFocus
                    />
                    <button 
                        type="submit"
                        disabled={loading}
                        className="absolute right-2 top-2 bottom-2 bg-sky-600 text-white px-6 rounded-xl font-bold hover:bg-sky-700 transition active:scale-95 disabled:opacity-70"
                    >
                        {loading ? 'Searching...' : 'CHECK'}
                    </button>
                </form>
            )}

            {error && !isEditing && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={20} /> {error}
                </div>
            )}
        </div>

        {/* --- EDIT MODE --- */}
        {isEditing && (
            <div className="max-w-5xl mx-auto w-full bg-white rounded-3xl shadow-2xl border border-indigo-100 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center sticky top-0 z-30">
                    <h3 className="font-black text-lg flex items-center gap-2"><Edit3 size={20}/> EDITING INVOICE: {editForm.bill_no}</h3>
                    <div className="flex gap-2">
                        <button onClick={saveChanges} disabled={loading} className="px-4 py-2 bg-white text-indigo-700 rounded-lg font-bold hover:bg-indigo-50 transition flex items-center gap-2">
                            {loading ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>} SAVE
                        </button>
                        <button onClick={cancelEditing} className="px-4 py-2 bg-indigo-800 text-white rounded-lg font-bold hover:bg-indigo-900 transition">
                            CANCEL
                        </button>
                    </div>
                </div>
                
                <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-h-[75vh] overflow-y-auto">
                    {/* Section 1: Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Bill Date</label>
                            <input type="date" value={editForm.bill_date} onChange={e => handleFormChange('bill_date', e.target.value)} className="w-full p-2 border rounded font-bold bg-white text-gray-900" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Bill Type</label>
                            <select value={editForm.bill_type} onChange={e => handleFormChange('bill_type', e.target.value)} className="w-full p-2 border rounded font-bold bg-white text-gray-900">
                                <option value={BillType.SMALL}>Small Bill</option>
                                <option value={BillType.DISPATCH}>Dispatch</option>
                                <option value={BillType.ORDER}>Order</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
                            <select value={editForm.status || 'PENDING'} onChange={e => handleFormChange('status', e.target.value)} className="w-full p-2 border rounded font-bold bg-white text-gray-900">
                                <option value="PENDING">Pending</option>
                                <option value="LOADING">Loading</option>
                                <option value="OUT_FOR_DELIVERY">Out For Delivery</option>
                                <option value="DELIVERED">Delivered</option>
                                {/* NOTE: Do not allow selecting APPROVED from edit screen to prevent accidental lock */}
                            </select>
                        </div>
                    </div>

                    {/* Section 2: Customer */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><UserIcon size={16}/> Customer Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input placeholder="Name" value={editForm.customer_name || ''} onChange={e => handleFormChange('customer_name', e.target.value)} className="w-full p-2 border rounded bg-white text-gray-900 font-bold" />
                            <input placeholder="Phone" value={editForm.phone_number || ''} onChange={e => handleFormChange('phone_number', e.target.value)} className="w-full p-2 border rounded bg-white text-gray-900 font-bold" />
                            <input placeholder="Address" value={editForm.customer_address || ''} onChange={e => handleFormChange('customer_address', e.target.value)} className="w-full p-2 border rounded md:col-span-2 bg-white text-gray-900 font-bold" />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:col-span-2">
                                <input placeholder="GSTIN" value={editForm.gst_number || ''} onChange={e => handleFormChange('gst_number', e.target.value)} className="w-full p-2 border rounded text-xs bg-white text-gray-900 font-bold" />
                                <input placeholder="PAN" value={editForm.pan_number || ''} onChange={e => handleFormChange('pan_number', e.target.value)} className="w-full p-2 border rounded text-xs bg-white text-gray-900 font-bold" />
                                <input placeholder="Aadhar" value={editForm.aadhar_number || ''} onChange={e => handleFormChange('aadhar_number', e.target.value)} className="w-full p-2 border rounded text-xs bg-white text-gray-900 font-bold" />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Logistics & Sales */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                            <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2"><Truck size={16}/> Logistics</h4>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase block">Vehicle No</label>
                                <SearchableDropdown 
                                    options={vehicleOptions} 
                                    value={editForm.vehicle_number || ''} 
                                    onChange={(val) => handleFormChange('vehicle_number', val.toUpperCase())} 
                                    placeholder="SEARCH OR ENTER VEHICLE NO"
                                    onSelect={(opt) => {
                                        handleFormChange('vehicle_number', opt.title);
                                        // Auto-fill Driver Details
                                        const v = opt.originalData as Vehicle;
                                        if (v) {
                                            if(v.driver_name) handleFormChange('driver_name', v.driver_name);
                                            if(v.driver_contact) handleFormChange('driver_contact', v.driver_contact);
                                        }
                                    }}
                                />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Driver Name</label>
                                        <input placeholder="Driver Name" value={editForm.driver_name || ''} onChange={e => handleFormChange('driver_name', e.target.value)} className="w-full p-2 border rounded bg-white text-gray-900 font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Contact</label>
                                        <input placeholder="Driver Contact" value={editForm.driver_contact || ''} onChange={e => handleFormChange('driver_contact', e.target.value)} className="w-full p-2 border rounded bg-white text-gray-900 font-bold" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                            <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2"><CreditCard size={16}/> Sales Info</h4>
                            <div className="space-y-2">
                                <input placeholder="Salesman Name" value={editForm.salesman_name || ''} onChange={e => handleFormChange('salesman_name', e.target.value)} className="w-full p-2 border rounded bg-white text-gray-900 font-bold" />
                                <input placeholder="Payment UPI ID" value={editForm.payment_upi || ''} onChange={e => handleFormChange('payment_upi', e.target.value)} className="w-full p-2 border rounded bg-white text-gray-900 font-bold" />
                                <textarea placeholder="Remark..." value={editForm.remark || ''} onChange={e => handleFormChange('remark', e.target.value)} className="w-full p-2 border rounded text-xs h-16 bg-white text-gray-900 font-bold" />
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Items */}
                    <div>
                        <h4 className="font-bold text-gray-700 mb-2">Order Items</h4>
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-sm border-collapse min-w-[500px]">
                                <thead className="bg-gray-100 text-gray-600">
                                    <tr>
                                        <th className="p-2 text-left border">Product</th>
                                        <th className="p-2 text-center border w-24">Qty</th>
                                        <th className="p-2 text-center border w-24">Rate</th>
                                        <th className="p-2 text-right border w-28">Total</th>
                                        <th className="p-2 text-center border w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-1 border"><input className="w-full p-1 outline-none bg-white text-gray-900 font-bold" value={item.product_name} onChange={e => handleItemChange(idx, 'product_name', e.target.value)} /></td>
                                            <td className="p-1 border"><input type="number" className="w-full p-1 text-center outline-none bg-white text-gray-900 font-bold" value={item.qty} onChange={e => handleItemChange(idx, 'qty', e.target.value)} /></td>
                                            <td className="p-1 border"><input type="number" className="w-full p-1 text-center outline-none bg-white text-gray-900 font-bold" value={item.rate || ''} onChange={e => handleItemChange(idx, 'rate', e.target.value)} /></td>
                                            <td className="p-2 text-right border font-bold text-gray-900">{item.line_total?.toFixed(2)}</td>
                                            <td className="p-1 text-center border"><button onClick={() => deleteItem(idx)} className="text-red-500"><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                    {/* Add Row */}
                                    <tr className="bg-indigo-50/50">
                                        <td className="p-1 border">
                                            <SearchableDropdown 
                                                options={productOptions} 
                                                value={newItemName} 
                                                onChange={setNewItemName} 
                                                placeholder="Add Item..."
                                                onSelect={(opt) => {
                                                    setNewItemName(opt.title);
                                                    // auto fill rate if mapped
                                                    const p = products.find(prod => prod.id === opt.id);
                                                    if(p) setNewItemRate(p.rate.toString());
                                                }}
                                            />
                                        </td>
                                        <td className="p-1 border"><input type="number" placeholder="Qty" className="w-full p-1 text-center border rounded bg-white text-gray-900 font-bold" value={newItemQty} onChange={e => setNewItemQty(e.target.value)} /></td>
                                        <td className="p-1 border"><input type="number" placeholder="Rate" className="w-full p-1 text-center border rounded bg-white text-gray-900 font-bold" value={newItemRate} onChange={e => setNewItemRate(e.target.value)} /></td>
                                        <td className="p-2 text-right border text-gray-600 text-xs italic">Auto</td>
                                        <td className="p-1 text-center border"><button onClick={addNewItem} className="bg-indigo-600 text-white rounded p-1"><Plus size={16}/></button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- VIEW MODE --- */}
        {bill && !isEditing && (
            <div className="max-w-5xl mx-auto w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* 1. Status Header */}
                <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-2xl font-black tracking-tight">{bill.bill_no}</span>
                            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
                                {bill.bill_type}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400 text-xs font-medium">
                            <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(bill.bill_date).toLocaleDateString()}</span>
                            {bill.created_at && <span className="flex items-center gap-1"><Clock size={12}/> {new Date(bill.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-xl font-black uppercase ${
                            bill.status === 'APPROVED' ? 'text-purple-400' :
                            bill.status === 'DELIVERED' ? 'text-green-400' : 
                            bill.status === 'OUT_FOR_DELIVERY' ? 'text-sky-400' : 'text-orange-400'
                        }`}>
                            {(bill.status || 'PENDING').replace(/_/g, ' ')}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-bold uppercase">Current Status</div>
                    </div>
                </div>

                {/* 2. Timeline Progress */}
                <div className="p-6 bg-slate-50 border-b border-slate-100">
                    <div className="relative flex justify-between items-center z-10 max-w-lg mx-auto">
                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 -z-10 rounded-full"></div>
                        <div className={`absolute top-1/2 left-0 h-1 bg-sky-500 -z-10 rounded-full transition-all duration-1000 ease-out`} style={{width: `${((step - 1) / 4) * 100}%`}}></div>

                        {['Pending', 'Loading', 'On Way', 'Delivered', 'Approved'].map((label, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                                    step > idx ? 'bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-200' : 'bg-white border-slate-300 text-slate-300'
                                }`}>
                                    <CheckCircle size={14} strokeWidth={3} />
                                </div>
                                <span className={`text-[10px] font-bold uppercase ${step > idx ? 'text-sky-600' : 'text-slate-300'}`}>{label}</span>
                            </div>
                        ))}
                    </div>
                    
                    {/* Time Analysis */}
                    <div className="mt-6 flex justify-center">
                        <div className="bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-bold text-slate-600">
                            <Clock size={14} className="text-sky-500"/> 
                            Order Age: <span className="text-slate-900">{calculateDuration(bill)}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Detailed Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
                    {/* Customer Block */}
                    <div className="bg-white p-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <UserIcon size={14} className="text-sky-500"/> Customer Details
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400">NAME</label>
                                <div className="text-sm font-bold text-slate-800">{bill.customer_name}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400">ADDRESS</label>
                                <div className="text-sm font-medium text-slate-600 flex items-start gap-1">
                                    <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400"/> {bill.customer_address || '-'}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400">PHONE</label>
                                    <div className="text-sm font-medium text-slate-600">{bill.phone_number || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400">SALESMAN</label>
                                    <div className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 rounded w-fit">{bill.salesman_name || '-'}</div>
                                </div>
                            </div>
                            {/* ID Proofs */}
                            <div className="pt-2 border-t border-dashed border-slate-200 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-400 flex items-center gap-1"><CreditCard size={10}/> PAN NO</label>
                                    <div className="text-xs font-mono font-bold text-slate-700">{bill.pan_number || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-400 flex items-center gap-1"><CreditCard size={10}/> AADHAR</label>
                                    <div className="text-xs font-mono font-bold text-slate-700">{bill.aadhar_number || '-'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Logistics Block */}
                    <div className="bg-white p-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Truck size={14} className="text-orange-500"/> Logistics Info
                        </h3>
                        <div className="space-y-4">
                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                                <label className="block text-[10px] font-bold text-orange-400 uppercase">VEHICLE NUMBER</label>
                                <div className="text-lg font-black text-orange-900 tracking-tight font-mono">{bill.vehicle_number || 'PENDING'}</div>
                            </div>
                            <div className="flex gap-4">
                                 <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400">DRIVER NAME</label>
                                    <div className="text-sm font-bold text-slate-800">{bill.driver_name || '-'}</div>
                                 </div>
                                 <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400">CONTACT</label>
                                    <div className="text-sm font-medium text-slate-600 flex items-center gap-1">
                                        {bill.driver_contact && <Phone size={12} />} {bill.driver_contact || '-'}
                                    </div>
                                 </div>
                            </div>
                            {bill.remark && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                    <label className="block text-[10px] font-bold text-slate-400">REMARK</label>
                                    <div className="text-xs text-gray-600 italic">{getCleanRemark(bill.remark)}</div>
                                </div>
                            )}
                            
                            {/* Edited By Badge */}
                            {getEditorName(bill.remark) && (
                                <div className="mt-2 flex items-center gap-2 bg-yellow-50 p-2 rounded-lg border border-yellow-100">
                                    <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                                        <Edit2 size={12} />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[9px] font-bold text-yellow-500 uppercase tracking-wide block">Last Edited By</span>
                                        <span className="text-xs font-bold text-yellow-800">{getEditorName(bill.remark)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 4. Items Table */}
                <div className="p-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Package size={14} className="text-emerald-500"/> Item Details
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[500px]">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="p-3">Product Name</th>
                                    <th className="p-3 text-right">Qty</th>
                                    {bill.bill_type === 'SMALL' && <th className="p-3 text-right">Rate</th>}
                                    {bill.bill_type === 'SMALL' && <th className="p-3 text-right">Amount</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(bill.items || []).map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition">
                                        <td className="p-3 font-bold text-slate-700">{item.product_name}</td>
                                        <td className="p-3 text-right font-mono font-bold">{item.qty}</td>
                                        {bill.bill_type === 'SMALL' && <td className="p-3 text-right text-slate-500">{item.rate}</td>}
                                        {bill.bill_type === 'SMALL' && <td className="p-3 text-right font-bold">{item.line_total}</td>}
                                    </tr>
                                ))}
                                <tr className="bg-slate-50 font-black text-slate-800">
                                    <td className="p-3 uppercase text-xs">Total</td>
                                    <td className="p-3 text-right text-base">{bill.total_qty}</td>
                                    {bill.bill_type === 'SMALL' && <td className="p-3"></td>}
                                    {bill.bill_type === 'SMALL' && <td className="p-3 text-right text-lg">₹{bill.total_amount?.toFixed(0)}</td>}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        )}
    </div>
  );
};

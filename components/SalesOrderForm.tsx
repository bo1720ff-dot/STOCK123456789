
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BillType, Product, BillItem, OrderStatus, User } from '../types';
import { productService, billService } from '../services/supabase';
import { Send, User as UserIcon, MapPin, Phone, FileText, ChevronDown, Package, Plus, Trash2, ArrowLeft, ArrowRight, Calendar, ShoppingCart, CheckCircle, IndianRupee, Scale, X, Search, Minus, AlertTriangle } from 'lucide-react';
import { SearchableDropdown, DropdownOption } from './SearchableDropdown';

interface SalesOrderFormProps {
  user: User;
  onOrderSaved: () => void;
  onNotification?: (msg: string, type: 'success' | 'info') => void;
}

export const SalesOrderForm: React.FC<SalesOrderFormProps> = ({ user, onOrderSaved, onNotification }) => {
  // --- STATE ---
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // STEP 1: Customer Data
  const [selectedPartyName, setSelectedPartyName] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(''); 
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [customNote, setCustomNote] = useState(''); 
  const [showExtras, setShowExtras] = useState(false);

  // STEP 2: Item Entry (Redesigned)
  const [cartItems, setCartItems] = useState<BillItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState('');
  const [addRate, setAddRate] = useState('');

  // CONFIRMATION MODAL STATE
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // QUICK FILTERS DEFINITION (Updated LITCHI to ORAL E+)
  const QUICK_FILTERS = [
      { label: 'ALL', val: '' },
      { label: 'WATER', val: 'WATER' },
      { label: 'MANGO', val: 'MANGO' },
      { label: 'COLA', val: 'COLA' },
      { label: 'JEERA', val: 'JEERA' },
      { label: 'APPLE', val: 'APP' },
      { label: 'STRONG', val: 'STRONG' },
      { label: 'BISTER', val: 'BISTER' },
      { label: 'KIDS', val: 'KIDS' },
      { label: 'ORAL E+', val: 'ORAL' },
  ];

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      const prods = await productService.getAll();
      
      // CUSTOM SORTING LOGIC (Updated LITCHI to ORAL E+)
      const priority = [
          "WATER", 
          "MANGO", 
          "COLA JEERA", 
          "COLA", 
          "CL", 
          "JEERA", 
          "APP", 
          "STRONG", 
          "BISTER", 
          "KIDS", 
          "ORAL"
      ];

      prods.sort((a, b) => {
          const nameA = a.product_name.toUpperCase();
          const nameB = b.product_name.toUpperCase();

          const indexA = priority.findIndex(p => nameA.includes(p));
          const indexB = priority.findIndex(p => nameB.includes(p));

          // If both found, sort by priority index
          if (indexA !== -1 && indexB !== -1) {
              if (indexA !== indexB) return indexA - indexB;
              return nameA.localeCompare(nameB);
          }
          
          // If only A found, A comes first
          if (indexA !== -1) return -1;
          
          // If only B found, B comes first
          if (indexB !== -1) return 1;

          // If neither found, sort alphabetically
          return nameA.localeCompare(nameB);
      });

      setProducts(prods);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDeliveryDate(tomorrow.toISOString().split('T')[0]);
    };
    init();
  }, []);

  // --- CART HELPERS ---
  const getCartItem = (productName: string) => {
      return cartItems.find(i => i.product_name === productName);
  };

  const removeFromCart = (productName: string) => {
      setCartItems(prev => prev.filter(i => i.product_name !== productName));
  };

  const handleAddItem = () => {
      if (!selectedProduct) return;
      
      const qty = parseFloat(addQty);
      const rate = parseFloat(addRate);

      if (isNaN(qty) || qty <= 0) {
          alert("Please enter a valid quantity");
          return;
      }
      if (isNaN(rate) || rate < 0) {
          alert("Please enter a valid rate");
          return;
      }

      const existingIdx = cartItems.findIndex(i => i.product_name === selectedProduct.product_name);
      const newCart = [...cartItems];

      if (existingIdx !== -1) {
          // Update existing
          newCart[existingIdx] = {
              ...newCart[existingIdx],
              qty: qty,
              rate: rate,
              line_total: qty * rate
          };
      } else {
          // Add new
          newCart.push({
              product_name: selectedProduct.product_name,
              qty: qty,
              rate: rate,
              line_total: qty * rate
          });
      }
      setCartItems(newCart);

      // Reset Form
      setSelectedProduct(null);
      setProductSearch('');
      setAddQty('');
      setAddRate('');
      setShowProductDropdown(false);
  };

  const handleProductSelect = (p: Product) => {
      setSelectedProduct(p);
      setProductSearch(p.product_name);
      setShowProductDropdown(false);
      
      // Pre-fill if exists
      const existing = getCartItem(p.product_name);
      if (existing) {
          setAddQty(existing.qty.toString());
          setAddRate(existing.rate.toString());
      } else {
          setAddQty('');
          setAddRate(p.rate.toString());
      }
  };

  // Filter Logic for Dropdown
  const filteredProducts = products.filter(p => {
      const matchSearch = p.product_name.toLowerCase().includes(productSearch.toLowerCase());
      const matchCat = !categoryFilter || p.product_name.toUpperCase().includes(categoryFilter);
      return matchSearch && matchCat;
  });

  // Navigation Logic
  const handleNext = () => {
      if (step === 1) {
          if (!selectedPartyName.trim()) {
              alert("Please enter Customer Name.");
              return;
          }
          setStep(2);
      } else if (step === 2) {
          if (cartItems.length === 0) {
              alert("Please add at least one product.");
              return;
          }
          // Cleanup 0 qty items before proceeding
          const validItems = cartItems.filter(i => i.qty > 0);
          if (validItems.length === 0) {
              alert("Please add at least one product with valid quantity.");
              setCartItems([]);
              return;
          }
          setCartItems(validItems);
          setStep(3);
      }
  };

  const handleBack = () => {
      if (step > 1) setStep((s) => (s - 1) as any);
  };

  // Trigger Confirmation Modal
  const handleConfirmOrder = () => {
      setShowConfirmModal(true);
  };

  // Final Submit
  const processOrder = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    try {
        const nextBillNo = await billService.getNextBillNumber();
        
        let finalRemarkParts = [];
        if (deliveryDate) finalRemarkParts.push(`Target Delivery: ${deliveryDate}`);
        if (customNote.trim()) finalRemarkParts.push(customNote.trim());
        const finalRemark = finalRemarkParts.join(' | ');

        const orderData = {
            bill_no: nextBillNo,
            bill_type: BillType.ORDER,
            total_qty: cartItems.reduce((acc, i) => acc + i.qty, 0),
            total_amount: cartItems.reduce((acc, i) => acc + (i.line_total || 0), 0),
            total_weight: totalWeight, 
            bill_date: new Date().toISOString().split('T')[0],
            customer_name: selectedPartyName,
            customer_address: selectedAddress,
            phone_number: phoneNumber,
            salesman_name: user.name,
            gst_number: gstNumber,
            pan_number: panNumber,    
            aadhar_number: aadharNumber, 
            remark: finalRemark,
            status: 'PENDING' as OrderStatus
        };

        await billService.create(orderData, cartItems);
        
        if(onNotification) onNotification("Order Placed Successfully!", 'success');
        onOrderSaved();
    } catch (e) {
        console.error(e);
        alert("Failed to place order.");
    } finally {
        setLoading(false);
    }
  };

  // Calculations
  const totalQty = cartItems.reduce((acc, i) => acc + i.qty, 0);
  const totalAmount = cartItems.reduce((acc, i) => acc + (i.line_total || 0), 0);

  const totalWeight = useMemo(() => {
      return cartItems.reduce((acc, item) => {
          const product = products.find(p => p.product_name.toLowerCase() === item.product_name.toLowerCase());
          const unitWeight = product?.weight || 0;
          return acc + (item.qty * unitWeight);
      }, 0);
  }, [cartItems, products]);

  const formatWeight = (kg: number) => {
      if (kg >= 1000) {
          const tons = Math.floor(kg / 1000);
          const rem = kg % 1000;
          return `${tons} MT ${rem.toFixed(0)} KG`;
      }
      return `${kg.toFixed(2)} KG`;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans relative overflow-hidden">
      
      {/* --- Stepper Header --- */}
      <div className="bg-white pt-2 pb-2 px-4 shadow-sm z-20 sticky top-0 border-b border-gray-100">
          <div className="flex justify-between items-center mb-1">
              <div className={`flex flex-col items-center flex-1 ${step >= 1 ? 'text-sky-600' : 'text-gray-300'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2 mb-0.5 transition-all ${step >= 1 ? 'border-sky-600 bg-sky-50' : 'border-gray-200'}`}>1</div>
                  <span className="text-[7px] font-bold uppercase tracking-wide">Customer</span>
              </div>
              <div className={`h-0.5 w-8 mb-3 ${step >= 2 ? 'bg-sky-600' : 'bg-gray-200'}`}></div>
              <div className={`flex flex-col items-center flex-1 ${step >= 2 ? 'text-sky-600' : 'text-gray-300'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2 mb-0.5 transition-all ${step >= 2 ? 'border-sky-600 bg-sky-50' : 'border-gray-200'}`}>2</div>
                  <span className="text-[7px] font-bold uppercase tracking-wide">Select</span>
              </div>
              <div className={`h-0.5 w-8 mb-3 ${step >= 3 ? 'bg-sky-600' : 'bg-gray-200'}`}></div>
              <div className={`flex flex-col items-center flex-1 ${step >= 3 ? 'text-sky-600' : 'text-gray-300'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2 mb-0.5 transition-all ${step >= 3 ? 'border-sky-600 bg-sky-50' : 'border-gray-200'}`}>3</div>
                  <span className="text-[7px] font-bold uppercase tracking-wide">Confirm</span>
              </div>
          </div>
      </div>

      {/* --- SCROLLABLE CONTENT --- */}
      <div className="flex-1 overflow-y-auto pb-24 bg-slate-50">
         
         {/* --- STEP 1: CUSTOMER --- */}
         {step === 1 && (
             <div className="p-4 space-y-4 animate-in slide-in-from-right-8 duration-300">
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-xs font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                        <UserIcon size={16} className="text-sky-500"/> Customer Details
                    </h3>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Party Name *</label>
                            <input 
                                autoFocus
                                type="text" 
                                value={selectedPartyName} 
                                onChange={e => setSelectedPartyName(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                placeholder="Enter Name"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Phone</label>
                                <input 
                                    type="tel" 
                                    value={phoneNumber} 
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                    placeholder="Mobile No"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Date</label>
                                <input 
                                    type="date" 
                                    value={deliveryDate} 
                                    onChange={e => setDeliveryDate(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Address</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={selectedAddress} 
                                    onChange={e => setSelectedAddress(e.target.value)}
                                    className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                    placeholder="Delivery Location"
                                />
                                <button 
                                    onClick={() => setShowExtras(!showExtras)}
                                    className={`w-12 rounded-xl flex items-center justify-center border transition-all ${showExtras ? 'bg-sky-50 border-sky-200 text-sky-600' : 'bg-white border-slate-200 text-gray-400'}`}
                                >
                                    <ChevronDown size={20} className={showExtras ? 'rotate-180 transition' : 'transition'} />
                                </button>
                            </div>
                        </div>

                        {/* ORDER NOTE FIELD */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Note / Instructions</label>
                            <textarea 
                                value={customNote}
                                onChange={e => setCustomNote(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition h-20"
                                placeholder="Any special remarks or instructions..."
                            />
                        </div>

                        {showExtras && (
                            <div className="pt-2 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                                <input type="text" placeholder="GST IN" value={gstNumber} onChange={e => setGstNumber(e.target.value)} className="p-2 border rounded-lg text-xs font-bold uppercase"/>
                                <input type="text" placeholder="PAN NO" value={panNumber} onChange={e => setPanNumber(e.target.value)} className="p-2 border rounded-lg text-xs font-bold uppercase"/>
                                <input type="text" placeholder="AADHAR" value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} className="p-2 border rounded-lg text-xs font-bold col-span-2"/>
                            </div>
                        )}
                    </div>
                 </div>
             </div>
         )}

         {/* --- STEP 2: PRODUCTS (REDESIGNED) --- */}
         {step === 2 && (
             <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300 bg-slate-50">
                 
                 <div className="p-4 space-y-4">
                     {/* ADD ITEMS CARD */}
                     <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                         <h3 className="text-xs font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                             <Package size={16} className="text-sky-500"/> Add Items
                         </h3>

                         <div className="space-y-3">
                             {/* Category Chips */}
                             <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                                {QUICK_FILTERS.map(f => (
                                    <button
                                        key={f.label}
                                        onClick={() => setCategoryFilter(f.val)}
                                        className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 border ${
                                            categoryFilter === f.val
                                            ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-200' 
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-sky-200 hover:text-sky-600'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                             </div>

                             {/* Product Search */}
                             <div className="relative">
                                 <Search className="absolute left-3 top-3.5 text-gray-400" size={16} />
                                 <input 
                                     type="text" 
                                     placeholder="Find Product..." 
                                     value={productSearch}
                                     onChange={(e) => {
                                         setProductSearch(e.target.value);
                                         setShowProductDropdown(true);
                                         if (!e.target.value) setSelectedProduct(null);
                                     }}
                                     onFocus={() => setShowProductDropdown(true)}
                                     className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                 />
                                 {selectedProduct && (
                                     <button onClick={() => {
                                         setSelectedProduct(null);
                                         setProductSearch('');
                                         setAddQty('');
                                         setAddRate('');
                                     }} className="absolute right-3 top-3.5 text-gray-400 hover:text-red-500">
                                         <X size={16} />
                                     </button>
                                 )}
                                 
                                 {/* Dropdown */}
                                 {showProductDropdown && (
                                     <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto z-50">
                                         {filteredProducts.length === 0 ? (
                                             <div className="p-3 text-center text-xs text-gray-400 font-bold">No products found</div>
                                         ) : (
                                             filteredProducts.map(p => (
                                                 <button
                                                     key={p.id}
                                                     onClick={() => handleProductSelect(p)}
                                                     className="w-full text-left p-3 hover:bg-sky-50 flex items-center justify-between border-b border-gray-50 last:border-0 transition"
                                                 >
                                                     <div>
                                                         <div className="font-bold text-slate-800 text-sm">{p.product_name}</div>
                                                         <div className="text-[10px] text-slate-400 font-bold uppercase">{p.unit} • ₹{p.rate}</div>
                                                     </div>
                                                     {getCartItem(p.product_name) && (
                                                         <span className="text-[9px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">ADDED</span>
                                                     )}
                                                 </button>
                                             ))
                                         )}
                                     </div>
                                 )}
                             </div>

                             {/* Qty & Rate Row */}
                             <div className="flex gap-3">
                                 <div className="flex-1">
                                     <input 
                                         type="number" 
                                         inputMode="numeric"
                                         placeholder="Qty" 
                                         value={addQty}
                                         onChange={e => setAddQty(e.target.value)}
                                         className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition text-center placeholder-gray-300"
                                     />
                                 </div>
                                 <div className="w-24">
                                     <input 
                                         type="number" 
                                         inputMode="numeric"
                                         placeholder="Rate" 
                                         value={addRate}
                                         onChange={e => setAddRate(e.target.value)}
                                         className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition text-center placeholder-gray-300"
                                     />
                                 </div>
                                 <button 
                                     onClick={handleAddItem}
                                     disabled={!selectedProduct || !addQty}
                                     className={`w-14 rounded-xl flex items-center justify-center shadow-lg transition active:scale-95 ${
                                         selectedProduct && addQty 
                                         ? 'bg-sky-600 text-white shadow-sky-200 hover:bg-sky-700' 
                                         : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                     }`}
                                 >
                                     <Plus size={24} strokeWidth={3} />
                                 </button>
                             </div>
                         </div>
                     </div>

                     {/* CART LIST */}
                     <div className="pb-20">
                         {cartItems.length === 0 ? (
                             <div className="flex flex-col items-center justify-center py-12 opacity-50">
                                 <ShoppingCart size={48} className="text-gray-300 mb-2" />
                                 <p className="text-sm font-bold text-gray-400">Cart is empty</p>
                             </div>
                         ) : (
                             <div className="space-y-2">
                                 {cartItems.map((item, idx) => (
                                     <div key={idx} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
                                         <div className="flex items-center gap-3">
                                             <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 font-bold text-xs border border-sky-100">
                                                 {idx + 1}
                                             </div>
                                             <div>
                                                 <div className="font-bold text-slate-800 text-sm">{item.product_name}</div>
                                                 <div className="text-xs text-slate-500 font-medium">
                                                     {item.qty} x ₹{item.rate}
                                                 </div>
                                             </div>
                                         </div>
                                         <div className="flex items-center gap-3">
                                             <div className="font-black text-slate-800 text-sm">₹{(item.line_total || 0).toFixed(0)}</div>
                                             <button 
                                                 onClick={() => removeFromCart(item.product_name)}
                                                 className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                                             >
                                                 <Trash2 size={16} />
                                             </button>
                                         </div>
                                     </div>
                                 ))}
                                 
                                 {/* Total Summary */}
                                 <div className="mt-4 bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
                                     <span className="font-bold text-xs uppercase tracking-wider text-slate-400">Total Amount</span>
                                     <span className="font-black text-xl">₹{totalAmount.toFixed(0)}</span>
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
         )}

         {/* --- STEP 3: CONFIRM --- */}
         {step === 3 && (
             <div className="space-y-4 p-4 animate-in slide-in-from-right-8 duration-300">
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-center">
                     <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
                         <CheckCircle size={32} />
                     </div>
                     <h2 className="text-lg font-black text-slate-800">Review Order</h2>
                     <p className="text-xs text-slate-400 font-medium">Please verify details before confirming.</p>
                 </div>

                 {/* Summary Card */}
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                     <div className="p-4 bg-slate-50 border-b border-slate-100">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Info</h4>
                         <div className="mt-1 font-bold text-slate-800 text-base">{selectedPartyName}</div>
                         <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                             <Phone size={12}/> {phoneNumber || 'N/A'}
                         </div>
                         <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                             <MapPin size={12}/> {selectedAddress || 'N/A'}
                         </div>
                         {deliveryDate && (
                             <div className="mt-2 inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded text-[10px] font-bold text-slate-600">
                                 <Calendar size={10}/> Delivery: {deliveryDate}
                             </div>
                         )}
                         {customNote && (
                             <div className="mt-2 bg-yellow-50 border border-yellow-100 p-2 rounded text-[10px] text-yellow-800 font-medium">
                                 <strong>Note:</strong> {customNote}
                             </div>
                         )}
                     </div>
                     
                     <div className="p-4">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Order Items</h4>
                         <div className="space-y-2 mb-3">
                             {cartItems.map((item, idx) => (
                                 <div key={idx} className="flex justify-between text-xs border-b border-slate-50 pb-1 last:border-0">
                                     <span className="font-medium text-slate-700">{item.product_name}</span>
                                     <span className="font-bold text-slate-900">{item.qty} x {item.rate}</span>
                                 </div>
                             ))}
                         </div>
                         
                         <div className="flex justify-between items-center pt-2 border-t border-slate-100 mb-1">
                             <span className="font-bold text-slate-500 text-xs">Total Weight</span>
                             <span className="font-bold text-slate-700 text-xs">{formatWeight(totalWeight)}</span>
                         </div>

                         <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                             <span className="font-bold text-slate-500 text-xs">Total Amount</span>
                             <span className="font-black text-slate-900 text-lg flex items-center"><IndianRupee size={14}/>{totalAmount.toFixed(0)}</span>
                         </div>
                     </div>
                 </div>
             </div>
         )}

      </div>

      {/* --- CONFIRMATION MODAL --- */}
      {showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
                  <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-600">
                      <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">Place Order?</h3>
                  <p className="text-sm text-slate-500 font-medium mb-6">
                      Are you sure you want to submit this order for <strong>{selectedPartyName}</strong>?
                  </p>
                  
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setShowConfirmModal(false)}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={processOrder}
                        className="flex-1 py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 shadow-lg shadow-sky-200 transition"
                      >
                          Yes, Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- BOTTOM ACTIONS --- */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 z-30">
          <div className="flex gap-3">
              {step > 1 && (
                  <button 
                    onClick={handleBack}
                    className="px-4 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition"
                  >
                      <ArrowLeft size={20} />
                  </button>
              )}
              
              <button 
                onClick={step === 3 ? handleConfirmOrder : handleNext}
                disabled={loading}
                className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition active:scale-[0.98] ${
                    step === 3 ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700' : 'bg-sky-600 shadow-sky-200 hover:bg-sky-700'
                }`}
              >
                  {loading ? 'Processing...' : step === 3 ? 'CONFIRM ORDER' : 'NEXT STEP'}
                  {!loading && (step === 3 ? <Send size={18} /> : <ArrowRight size={18} />)}
              </button>
          </div>
      </div>

    </div>
  );
};

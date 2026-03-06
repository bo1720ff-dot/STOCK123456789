
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BillType, Product, BillItem, Party, SavedAddress, Vehicle } from '../types';
import { productService, billService, partyService, addressService, vehicleService } from '../services/supabase';
import { Plus, Trash2, Printer, ShoppingCart, User, MapPin, Truck, QrCode, Check, Save, RefreshCw, Scale, Edit2, Lock, Mic } from 'lucide-react';
import { SearchableDropdown, DropdownOption } from './SearchableDropdown';

// Add Speech Recognition Types
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

interface CreateBillProps {
  onBillSaved: (bill: any, items: any[], shouldPrint: boolean) => void;
  onNotification?: (msg: string, type: 'success' | 'info') => void;
}

export const CreateBill: React.FC<CreateBillProps> = ({ onBillSaved, onNotification }) => {
  // --- Refs for Focus Management ---
  const partyRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const vehicleRef = useRef<HTMLInputElement>(null);
  const productRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);

  // State
  const [billType, setBillType] = useState<BillType>(BillType.SMALL);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  const [billNo, setBillNo] = useState<string>('Loading...');
  const [isManualNo, setIsManualNo] = useState(false); // NEW: Manual Bill No Toggle

  // Initialize with LOCAL DATE to prevent timezone issues
  const [billDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Customer State
  const [selectedPartyName, setSelectedPartyName] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  
  // Payment State
  const [upiId, setUpiId] = useState<string>('9874682388@ibl');
  
  // QR Type State - DEFAULT CHANGED TO TRACKING (Invoice Value)
  const [qrType, setQrType] = useState<'PAYMENT' | 'TRACKING'>('TRACKING');
  
  // Current Line Item State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProductName, setSelectedProductName] = useState<string>('');
  const [qty, setQty] = useState<string>('');
  const [customRate, setCustomRate] = useState<string>('');
  
  // Cart
  const [cartItems, setCartItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingBill, setRefreshingBill] = useState(false);

  // Initial Load
  const init = async () => {
    try {
      const [prods, parts, addrs, vehs, nextBill] = await Promise.all([
        productService.getAll(),
        partyService.getAll(),
        addressService.getAll(),
        vehicleService.getAll(),
        billService.getNextBillNumber()
      ]);

      // CUSTOM SORTING LOGIC
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
          "IT"
      ];

      prods.sort((a, b) => {
          const nameA = a.product_name.toUpperCase();
          const nameB = b.product_name.toUpperCase();

          const indexA = priority.findIndex(p => nameA.includes(p));
          const indexB = priority.findIndex(p => nameB.includes(p));

          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return nameA.localeCompare(nameB);
      });

      setProducts(prods);
      setParties(parts);
      setAddresses(addrs);
      setVehicles(vehs);
      setBillNo(nextBill);
      
      // Auto focus party name on load
      setTimeout(() => partyRef.current?.focus(), 100);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const handleRefreshBillNo = async () => {
      setRefreshingBill(true);
      try {
          const next = await billService.getNextBillNumber();
          setBillNo(next);
      } catch(e) {
          console.error(e);
      } finally {
          setRefreshingBill(false);
      }
  };

  // --- Data Transformation for Dropdowns ---
  
  const partyOptions: DropdownOption[] = parties.map(p => ({
    id: p.id,
    title: p.party_name,
    tag: p.party_name.substring(0, 2).toUpperCase(),
    originalData: p
  }));

  const addressOptions: DropdownOption[] = addresses.map(a => ({
    id: a.id,
    title: a.address_line,
    tag: 'LOC',
    originalData: a
  }));

  const vehicleOptions: DropdownOption[] = vehicles.map(v => ({
    id: v.id,
    title: v.vehicle_number,
    tag: 'VEH',
    originalData: v
  }));

  const productOptions: DropdownOption[] = products.map(p => ({
    id: p.id,
    title: p.product_name,
    subtitle: `Rate: ₹${p.rate}`,
    rightText: `${p.unit}`,
    tag: p.unit.substring(0,3).toUpperCase(),
    originalData: p
  }));

  // Calculations
  const isSmall = billType === BillType.SMALL;

  const addItem = () => {
    // 1. Identify Product
    let finalProductId = selectedProductId;
    
    // Robustness: If ID is missing (user typed manually or state cleared), try to find by name match
    if (!finalProductId && selectedProductName) {
       const match = products.find(p => p.product_name.toLowerCase() === selectedProductName.toLowerCase());
       if (match) {
           finalProductId = match.id;
           // If rate is missing and we just found the product, use default
           if (isSmall && !customRate) setCustomRate(match.rate.toString());
       }
    }

    if (!finalProductId || !qty) {
        if(!finalProductId) alert("Please select a valid product");
        return;
    }

    const parsedQty = parseFloat(qty);
    // Use customRate if available, otherwise try to fetch from product if we just found it
    let finalRateStr = customRate;
    
    // If rate is still empty for small bill, try to fill it one last time if we have the product
    if (isSmall && !finalRateStr && finalProductId) {
         const p = products.find(prod => prod.id === finalProductId);
         if (p) finalRateStr = p.rate.toString();
    }

    const parsedRate = isSmall ? parseFloat(finalRateStr) : null;
    
    if (parsedQty <= 0) {
      alert("Quantity must be greater than 0");
      return;
    }
    if (isSmall && (parsedRate === null || isNaN(parsedRate) || parsedRate < 0)) {
      alert("Rate is required for Small Bill");
      return;
    }

    const lineTotal = isSmall && parsedRate !== null ? parsedQty * parsedRate : null;

    const newItem: BillItem = {
      product_name: selectedProductName,
      qty: parsedQty,
      rate: parsedRate,
      line_total: lineTotal
    };

    setCartItems([...cartItems, newItem]);

    // Reset inputs and Focus back to Product Select for next item
    setSelectedProductId('');
    setSelectedProductName('');
    setQty('');
    setCustomRate('');
    setTimeout(() => productRef.current?.focus(), 50);
  };

  const removeItem = (idx: number) => {
    const newItems = [...cartItems];
    newItems.splice(idx, 1);
    setCartItems(newItems);
  };

  const totalQty = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const totalAmount = isSmall 
    ? cartItems.reduce((acc, item) => acc + (item.line_total || 0), 0)
    : null;

  // New: Live Weight Calculation
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

  const handleSave = async (shouldPrint: boolean) => {
    if (cartItems.length === 0) {
      alert("Add at least one item");
      return;
    }

    if (!selectedPartyName.trim()) {
        const confirmNoName = window.confirm("Party Name is empty. Continue?");
        if (!confirmNoName) {
            partyRef.current?.focus();
            return;
        }
    }

    setLoading(true);
    try {
      let finalBillNo = billNo;

      // Logic: If Manual Mode is OFF, fetch fresh number to avoid conflicts.
      // If Manual Mode is ON, use the typed number.
      if (!isManualNo) {
          finalBillNo = await billService.getNextBillNumber();
          setBillNo(finalBillNo);
      } else {
          // Validate manual input
          if (!finalBillNo.trim()) {
              alert("Please enter a valid Bill No.");
              setLoading(false);
              return;
          }
      }

      const selectedVehicleObj = vehicles.find(v => v.vehicle_number === selectedVehicle);

      const billData = {
        bill_no: finalBillNo, 
        bill_type: billType,
        total_qty: totalQty,
        total_amount: totalAmount,
        total_weight: totalWeight, // SAVE TOTAL WEIGHT
        bill_date: billDate,
        customer_name: selectedPartyName,
        customer_address: selectedAddress,
        vehicle_number: selectedVehicle,
        driver_name: selectedVehicleObj?.driver_name,     // SAVE DRIVER NAME
        driver_contact: selectedVehicleObj?.driver_contact, // SAVE DRIVER CONTACT
        payment_upi: upiId,
        qrCodeType: qrType // Pass the selected preference to the local handler
      };

      const savedBill = await billService.create(billData, cartItems);
      
      // Trigger Print Logic in App.tsx
      onBillSaved(savedBill, cartItems, shouldPrint);
      
      // --- NOTIFICATION TRIGGER ---
      if (onNotification && !shouldPrint) {
          onNotification(`Bill ${finalBillNo} Created!`, 'success');
      }

      // --- RESET FORM IMMEDIATELY FOR NEXT BILL ---
      setCartItems([]);
      setSelectedPartyName('');
      setSelectedAddress('');
      setSelectedVehicle('');
      setQrType('TRACKING'); // Reset to default (Tracking)
      setIsManualNo(false); // Reset to Auto
      
      // Get NEXT bill number for display (prediction)
      // The real one will be fetched again on next save (unless manual)
      const next = await billService.getNextBillNumber();
      setBillNo(next);
      
      // Reset Focus to Start
      setTimeout(() => partyRef.current?.focus(), 500); 

    } catch (e: any) {
      console.error(e);
      if (e.code === '23505') { // Postgres Unique Violation
          alert("Error: Bill Number already exists. Please use a different number.");
      } else {
          alert("Failed to save bill. Check connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Keyboard Shortcut: Insert Key for Single Print
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Insert') {
        e.preventDefault();
        // Check if loading or cart empty
        if (!loading && cartItems.length > 0) {
            handleSave(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, loading, cartItems]); // Re-bind when handleSave changes (state updates)

  const handleEnterKey = (e: React.KeyboardEvent, nextAction: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextAction();
    }
  };

  // Handlers for selection
  const handleProductSelect = (option: DropdownOption) => {
    const p = option.originalData as Product;
    setSelectedProductId(p.id);
    setSelectedProductName(p.product_name);
    if (isSmall) {
        setCustomRate(p.rate.toString());
    }
    setTimeout(() => qtyRef.current?.focus(), 50);
  };

  // Voice Search Handler
  const [isListening, setIsListening] = useState(false);

  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-IN'; // Default to Indian English
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      console.log("Voice Input:", transcript);

      // Fuzzy matching logic
      // 1. Exact match
      let match = products.find(p => p.product_name.toLowerCase() === transcript);
      
      // 2. Starts with
      if (!match) {
          match = products.find(p => p.product_name.toLowerCase().startsWith(transcript));
      }

      // 3. Includes
      if (!match) {
          match = products.find(p => p.product_name.toLowerCase().includes(transcript));
      }

      if (match) {
          const option = productOptions.find(o => o.id === match.id);
          if (option) {
              handleProductSelect(option);
              if (onNotification) onNotification(`Voice Selected: ${match.product_name}`, 'success');
          }
      } else {
          alert(`No product found matching "${transcript}"`);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20 md:pb-0 h-full">
      
      {/* LEFT COLUMN: Controls & Input (Span 5) */}
      <div className="lg:col-span-5 space-y-4">
        
        {/* Bill Info Card */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100">
          <div className="grid grid-cols-2 gap-4 mb-4">
             <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">
                    BILL NO {isManualNo && <span className="text-amber-500">(MANUAL)</span>}
                </label>
                <div className="flex items-center gap-1">
                    <input 
                        type="text" 
                        value={billNo} 
                        onChange={(e) => setBillNo(e.target.value)}
                        disabled={!isManualNo}
                        className={`font-mono p-2 rounded text-sky-700 font-bold border flex-1 text-center outline-none ${isManualNo ? 'bg-white border-sky-300 focus:ring-2 focus:ring-sky-200' : 'bg-sky-50 border-sky-100'}`}
                        placeholder="Invoice No"
                    />
                    <button 
                        onClick={() => setIsManualNo(!isManualNo)} 
                        className={`p-2 rounded transition border ${isManualNo ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-400 border-gray-100 hover:text-sky-600'}`}
                        title={isManualNo ? "Switch to Auto" : "Switch to Manual"}
                    >
                        {isManualNo ? <Lock size={16} /> : <Edit2 size={16} />} 
                    </button>
                    <button 
                        onClick={handleRefreshBillNo} 
                        disabled={refreshingBill || isManualNo} 
                        className="p-2 bg-gray-50 rounded hover:bg-sky-50 text-sky-600 transition border border-gray-100 disabled:opacity-50"
                        title="Get Next Auto Number"
                    >
                        <RefreshCw size={16} className={refreshingBill ? 'animate-spin' : ''} />
                    </button>
                </div>
             </div>
             <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">DATE</label>
                <div className="font-mono bg-sky-50 p-2 rounded text-sky-700 border border-sky-100 text-center font-bold">{billDate}</div>
             </div>
          </div>
          <div className="mb-3">
              <label className="text-xs text-gray-400 font-bold block mb-1">BILL TYPE</label>
              <div className="relative">
                <select 
                  value={billType} 
                  onChange={(e) => {
                      setBillType(e.target.value as BillType);
                      setCartItems([]); 
                      setTimeout(() => partyRef.current?.focus(), 50);
                  }}
                  className="w-full p-3 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 font-bold focus:ring-2 focus:ring-sky-400 outline-none appearance-none"
                >
                  <option value={BillType.SMALL}>SMALL BILL (Invoice)</option>
                  <option value={BillType.DISPATCH}>DISPATCH BILL (Qty Only)</option>
                </select>
              </div>
          </div>
          
          {/* UPI ID INPUT */}
          <div>
              <label className="text-xs text-gray-400 font-bold block mb-1 flex items-center gap-1">
                 <QrCode size={12} /> PAYMENT UPI ID
              </label>
              <input 
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. number@upi"
                className="w-full p-2 border border-gray-200 rounded text-sm font-medium focus:border-sky-400 outline-none transition bg-white text-gray-700"
              />
          </div>

          {/* QR Option Toggle (Only for Small Bills) */}
          {billType === BillType.SMALL && (
            <div className="mt-3 bg-sky-50 p-2 rounded-lg border border-sky-100">
               <label className="text-[10px] font-bold text-sky-700 uppercase mb-2 block">QR Code Mode</label>
               <div className="flex gap-2">
                  <button 
                    onClick={() => setQrType('TRACKING')}
                    className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition ${qrType === 'TRACKING' ? 'bg-white border-sky-300 text-sky-700 shadow-sm' : 'border-transparent text-gray-400 hover:bg-white/50'}`}
                  >
                    Invoice No (Default)
                  </button>
                  <button 
                    onClick={() => setQrType('PAYMENT')}
                    className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition ${qrType === 'PAYMENT' ? 'bg-white border-sky-300 text-sky-700 shadow-sm' : 'border-transparent text-gray-400 hover:bg-white/50'}`}
                  >
                    Payment (Amount)
                  </button>
               </div>
            </div>
          )}
        </div>

        {/* Party Details (Three Separate Dropdowns) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100 space-y-3">
            <h3 className="font-bold text-gray-700 border-b border-gray-100 pb-2 flex items-center gap-2">
                <User size={16} className="text-sky-500" /> Party Details
            </h3>
            
            <SearchableDropdown 
                ref={partyRef}
                label="Party Name"
                placeholder="Select Party Name"
                options={partyOptions}
                value={selectedPartyName}
                onChange={setSelectedPartyName}
                onSelect={(opt) => {
                    setSelectedPartyName(opt.title);
                    setTimeout(() => addressRef.current?.focus(), 50);
                }}
                onKeyDown={(e) => handleEnterKey(e, () => addressRef.current?.focus())}
            />
            
            <div className="grid grid-cols-2 gap-3">
                <div>
                   <SearchableDropdown 
                      ref={addressRef}
                      label="Address"
                      placeholder="Select Address"
                      options={addressOptions}
                      value={selectedAddress}
                      onChange={setSelectedAddress}
                      onSelect={(opt) => {
                        setSelectedAddress(opt.title);
                        setTimeout(() => vehicleRef.current?.focus(), 50);
                      }}
                      onKeyDown={(e) => handleEnterKey(e, () => vehicleRef.current?.focus())}
                  />
                </div>
                <div>
                    <SearchableDropdown 
                        ref={vehicleRef}
                        label="Vehicle No"
                        placeholder="WB-XX-XXXX"
                        options={vehicleOptions}
                        value={selectedVehicle}
                        onChange={(val) => setSelectedVehicle(val.toUpperCase())}
                        onSelect={(opt) => {
                           setSelectedVehicle(opt.title);
                           setTimeout(() => productRef.current?.focus(), 50);
                        }}
                        onKeyDown={(e) => handleEnterKey(e, () => productRef.current?.focus())}
                    />
                    {/* Driver Details Display */}
                    {selectedVehicle && vehicles.find(v => v.vehicle_number === selectedVehicle) && (
                        <div className="mt-1 bg-sky-50 border border-sky-100 rounded p-1.5 flex flex-col gap-0.5 animate-in fade-in">
                            <div className="flex items-center gap-1 text-[10px] text-sky-700 font-bold">
                                <User size={10} /> 
                                {vehicles.find(v => v.vehicle_number === selectedVehicle)?.driver_name || 'No Driver'}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-sky-600 font-medium">
                                <Truck size={10} /> 
                                {vehicles.find(v => v.vehicle_number === selectedVehicle)?.driver_contact || '-'}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Input Card */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
             <h3 className="font-bold text-gray-700">Add Items</h3>
          </div>
          
          <div className="flex items-end gap-2">
            <div className="flex-1">
                <SearchableDropdown 
                    ref={productRef}
                    label="Product"
                    placeholder="Search Product..."
                    options={productOptions}
                    value={selectedProductName}
                    onChange={(val) => {
                        setSelectedProductName(val);
                        setSelectedProductId(''); // Reset ID if user types freely
                    }}
                    onSelect={handleProductSelect}
                />
            </div>
            <button
                onClick={startVoiceSearch}
                className={`p-3 rounded-lg border transition flex items-center justify-center h-[46px] w-[46px] shadow-sm ${isListening ? 'bg-red-100 text-red-600 border-red-200 animate-pulse ring-2 ring-red-200' : 'bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100 hover:border-sky-300'}`}
                title="Voice Search Product"
            >
                <Mic size={20} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Quantity</label>
              <input 
                ref={qtyRef}
                type="number" 
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={(e) => handleEnterKey(e, () => {
                    if (isSmall) {
                        rateRef.current?.focus();
                    } else {
                        addItem();
                    }
                })}
                placeholder="0.00"
                className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition bg-white text-gray-900"
              />
            </div>
            
            {isSmall && (
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Rate</label>
                <input 
                  ref={rateRef}
                  type="number" 
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  onKeyDown={(e) => handleEnterKey(e, addItem)}
                  placeholder="0.00"
                  className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition bg-white text-gray-900"
                />
              </div>
            )}
          </div>

          <button 
            onClick={addItem}
            className="w-full py-3 bg-sky-500 text-white rounded-lg font-bold hover:bg-sky-600 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-sky-200"
          >
            <Plus size={20} /> ADD ITEM <span className="text-[10px] opacity-70 font-normal">(ENTER)</span>
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Cart (Span 7) */}
      <div className="lg:col-span-7 flex flex-col h-full">
         <div className="bg-white rounded-xl shadow-sm border border-sky-100 flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-sky-50 border-b border-sky-100 flex justify-between items-center">
              <h3 className="font-bold text-sky-800 flex items-center gap-2">
                <ShoppingCart size={18} /> Current Bill Items
              </h3>
              <span className="text-sm bg-white border border-sky-100 px-3 py-1 rounded-full font-mono text-sky-600 font-bold">
                {cartItems.length} Items
              </span>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                  <tr className="text-gray-400 text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold bg-gray-50/50">Item</th>
                    <th className="p-4 font-bold bg-gray-50/50 text-right">Qty</th>
                    {isSmall && <th className="p-4 font-bold bg-gray-50/50 text-right">Rate</th>}
                    {isSmall && <th className="p-4 font-bold bg-gray-50/50 text-right">Amount</th>}
                    <th className="p-4 font-bold bg-gray-50/50 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cartItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-gray-300 flex flex-col items-center justify-center gap-2">
                        <ShoppingCart size={40} className="text-gray-200" />
                        <p>No items added yet.</p>
                      </td>
                    </tr>
                  ) : (
                    cartItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-sky-50/50">
                        <td className="p-4 font-medium text-gray-800">{item.product_name}</td>
                        <td className="p-4 text-right font-mono">{item.qty}</td>
                        {isSmall && <td className="p-4 text-right font-mono text-gray-500">{item.rate?.toFixed(2)}</td>}
                        {isSmall && <td className="p-4 text-right font-mono font-bold text-gray-800">{item.line_total?.toFixed(2)}</td>}
                        <td className="p-4 text-center">
                          <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-sky-50 border-t border-sky-100 space-y-2">
               {/* New: Est Weight Display */}
               <div className="flex justify-between items-center text-xs text-sky-600 bg-white/50 px-2 py-1 rounded">
                  <span className="font-bold flex items-center gap-1"><Scale size={12}/> Est. Weight</span>
                  <span className="font-mono font-bold">{formatWeight(totalWeight)}</span>
               </div>

               <div className="flex justify-between items-center">
                  <span className="text-gray-500">Total Quantity</span>
                  <span className="font-bold text-lg text-gray-800">{totalQty}</span>
               </div>
               {isSmall && (
                 <div className="flex justify-between items-center text-sky-700">
                    <span className="font-bold text-lg">Grand Total</span>
                    <span className="font-extrabold text-2xl">{totalAmount?.toFixed(2)}</span>
                 </div>
               )}
            </div>
         </div>

         {/* Desktop Action Buttons */}
         <div className="hidden lg:flex gap-4 mt-4">
            <button 
              onClick={() => handleSave(false)}
              disabled={loading || cartItems.length === 0}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition flex justify-center items-center gap-2 disabled:opacity-50 disabled:shadow-none"
            >
              <Save size={20} /> SAVE ONLY
            </button>
            <button 
              onClick={() => handleSave(true)}
              disabled={loading || cartItems.length === 0}
              className="flex-1 py-4 bg-sky-600 text-white rounded-xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-700 transition flex justify-center items-center gap-2 disabled:opacity-50 disabled:shadow-none"
            >
              <Printer size={20} /> SINGLE PRINT <span className="text-[10px] opacity-70 font-normal bg-white/20 px-1.5 py-0.5 rounded">(INSERT)</span>
            </button>
         </div>
      </div>

      {/* Mobile Sticky Action Buttons */}
      <div className="lg:hidden fixed bottom-[60px] left-0 right-0 p-4 bg-white border-t border-gray-200 flex gap-3 z-10">
        <button 
          onClick={() => handleSave(false)}
          disabled={loading || cartItems.length === 0}
          className="flex-1 py-3 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold flex justify-center items-center gap-2 disabled:opacity-50 text-xs"
        >
          <Save size={16} /> SAVE
        </button>
        <button 
          onClick={() => handleSave(true)}
          disabled={loading || cartItems.length === 0}
          className="flex-[2] py-3 bg-sky-600 text-white rounded-lg font-bold shadow hover:bg-sky-700 flex justify-center items-center gap-2 disabled:opacity-50"
        >
          <Printer size={18} /> SINGLE PRINT (INS)
        </button>
      </div>

    </div>
  );
};

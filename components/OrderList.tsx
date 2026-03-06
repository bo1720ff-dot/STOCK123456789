
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { billService, vehicleService, productService, userService } from '../services/supabase';
import { Bill, BillItem, BillType, UserRole, Vehicle, Product, OrderStatus, User } from '../types';
import { Printer, Package, Calendar, Eye, X, Filter, Search, Edit2, Truck, User as UserIcon, Phone, Download, Save, Plus, Clock, FileText, ChevronRight, IndianRupee, MapPin, FileDown, RefreshCw, Lock, CheckCircle, AlertTriangle, KeyRound, Ban, Trash2, Briefcase, Scale, CreditCard } from 'lucide-react';
import { SearchableDropdown, DropdownOption } from './SearchableDropdown';

interface OrderListProps {
  onPrintDispatch: (bill: Bill, items: BillItem[]) => void;
  userRole?: UserRole;
  currentUser?: User;
  onStatusUpdate?: () => void;
  onNotification?: (msg: string, type: 'success' | 'info') => void;
}

// Skeleton Loader Component
const OrderSkeleton = () => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 animate-pulse relative h-48">
    <div className="flex justify-between mb-4">
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        <div className="h-6 bg-gray-200 rounded w-20"></div>
    </div>
    <div className="space-y-3 mb-6">
        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
    </div>
    <div className="absolute bottom-5 left-5 right-5 flex gap-2">
        <div className="h-10 bg-gray-200 rounded flex-1"></div>
        <div className="h-10 bg-gray-200 rounded w-12"></div>
        <div className="h-10 bg-gray-200 rounded w-12"></div>
    </div>
  </div>
);

// Utility for Local Date String (YYYY-MM-DD) to ensure consistency
const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const OrderList: React.FC<OrderListProps> = ({ onPrintDispatch, userRole, currentUser, onStatusUpdate, onNotification }) => {
  const [orders, setOrders] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering State - Default to Today
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [search, setSearch] = useState('');
  const [salesmanFilter, setSalesmanFilter] = useState('');
  const [startDate, setStartDate] = useState(getLocalToday());
  const [endDate, setEndDate] = useState(getLocalToday());
  
  // Data Lists
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesmen, setSalesmen] = useState<User[]>([]);

  // Modal State for PROCESSING (Edit/Update Status)
  const [editingOrder, setEditingOrder] = useState<Bill | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [editItems, setEditItems] = useState<(BillItem & { qtyInput?: string; rateInput?: string })[]>([]);
  
  // Edit Form State
  const [driverName, setDriverName] = useState('');
  const [driverContact, setDriverContact] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('PENDING'); // Track status in modal
  
  // Editable Customer Details
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editRemark, setEditRemark] = useState(''); // NEW: Editable Remark

  // CONFIRMATION STATES
  const [confirmDelivery, setConfirmDelivery] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Bill | null>(null); // For Cancel Confirmation Modal
  
  // Adding new Item state in modal
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemRate, setNewItemRate] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // View Only Modal
  const [viewOrder, setViewOrder] = useState<Bill | null>(null);
  const [viewItems, setViewItems] = useState<BillItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Refs for adding items
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const isSalesman = userRole === UserRole.SALESMAN;
  const isEmployee = userRole === UserRole.EMPLOYEE;
  const isAdmin = userRole === UserRole.ADMIN;

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let orderBills: Bill[] = [];
      const today = getLocalToday();
      
      // OPTIMIZED FETCHING STRATEGY
      if (statusFilter === 'ALL' && startDate === today && endDate === today && !search && !salesmanFilter) {
          // Default View: Fetch only OPEN orders (Pending/Loading/Out)
          orderBills = await billService.getOpenOrders();
      } else {
          // Filtered View: Fetch by Date Range
          orderBills = await billService.getOrdersByDateRange(startDate, endDate);
      }
      
      // RESTRICTION: Salesman can ONLY see their own orders
      if (isSalesman && currentUser) {
          orderBills = orderBills.filter(b => b.salesman_name === currentUser.name);
      }
      
      setOrders(orderBills);
      
      // Load masters only once ideally, but check if empty
      if (!silent && (vehicles.length === 0 || products.length === 0)) {
          const v = await vehicleService.getAll();
          setVehicles(v);
          
          const p = await productService.getAll();
          setProducts(p);

          const allUsers = await userService.getAll();
          // Filter to show Salesmen AND Employees in the filter dropdown for Admin
          setSalesmen(allUsers.filter(u => u.role === UserRole.SALESMAN || u.role === UserRole.EMPLOYEE));
      }

    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => loadOrders(true), 10000); // Increased to 10s
    return () => clearInterval(interval);
  }, [startDate, endDate, statusFilter, search, salesmanFilter]); // Re-fetch on filter change

  // --- STATEMENT PDF GENERATOR ---
  const handleGenerateStatement = () => {
      if (filteredOrders.length === 0) {
          alert("No orders match the current filter to generate a statement.");
          return;
      }

      const salesmanLabel = salesmanFilter ? salesmanFilter : "All Salesmen";

      // --- PROTECTION: PROMPT BEFORE DOWNLOAD ---
      // We removed the file encryption. Now we check password here.
      if (salesmanFilter) {
          const namePart = salesmanFilter.trim().split(' ')[0] || '';
          if (namePart.length > 0) {
             const code = namePart.substring(0, 3).toLowerCase();
             const requiredPass = `gfb${code}`;
             
             // Prompt Logic
             const userPass = window.prompt(`🔒 SECURITY CHECK\n\nEnter password for ${salesmanLabel} to download:`);
             if (userPass === null) return; // Cancelled
             if (userPass !== requiredPass) {
                 alert("❌ Incorrect Password. Access Denied.");
                 return;
             }
          }
      }

      // Calculate Totals (Exclude Cancelled)
      const validOrders = filteredOrders.filter(o => o.status !== 'CANCELLED');
      const totalQty = validOrders.reduce((sum, o) => sum + o.total_qty, 0);
      const totalAmt = validOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      
      // HTML Construction
      const rows = filteredOrders.map((o, i) => {
        const isCancelled = o.status === 'CANCELLED';
        const rowColor = isCancelled ? '#f3f4f6' : (i % 2 === 0 ? '#ffffff' : '#f8fafc');
        const textColor = isCancelled ? '#9ca3af' : '#1e293b';
        // Date parsing robustness
        let dateStr = o.bill_date;
        try {
            const d = new Date(o.bill_date);
            if (!isNaN(d.getTime())) {
                dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
            }
        } catch(e) {}

        return `
        <tr style="background-color: ${rowColor}; color: ${textColor};">
            <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 600;">${dateStr}</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 9px; font-weight: 700;">${o.bill_no}</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9px;">
                <div style="font-weight: 700; text-transform: uppercase;">${o.customer_name}</div>
                ${isCancelled ? '<span style="font-size: 8px; color: #ef4444; font-weight: bold;">(CANCELLED)</span>' : ''}
            </td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9px;">${o.salesman_name || '-'}</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 8px; font-weight: 700; text-transform: uppercase;">${(o.status || 'PENDING').replace(/_/g, ' ')}</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 10px; font-weight: 700;">${o.total_qty}</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 10px; font-weight: 500;">${(o.total_amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
        </tr>
      `}).join('');

      const content = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; width: 100%; color: #334155; box-sizing: border-box;">
            
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #0f172a; margin-bottom: 25px;">
                <div style="flex: 1;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; text-transform: uppercase;">GREENZAR</h1>
                    <div style="font-size: 11px; font-weight: 700; color: #0284c7; letter-spacing: 2px; margin-top: 2px; text-transform: uppercase;">Food & Beverage</div>
                    <div style="margin-top: 10px; font-size: 9px; color: #64748b; line-height: 1.4;">
                        Jhampa, Deganga, North 24 PGS<br>
                        West Bengal, PIN.-743423<br>
                        <strong>Ph: 9476156298</strong>
                    </div>
                </div>
                <div style="text-align: right; flex: 1;">
                    <div style="background-color: #f1f5f9; display: inline-block; padding: 8px 16px; border-radius: 6px;">
                        <h2 style="margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase;">Sales Order Statement</h2>
                    </div>
                    <table style="width: 100%; margin-top: 12px; font-size: 10px; border-collapse: collapse;">
                        <tr>
                            <td style="text-align: right; padding-bottom: 4px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Period:</td>
                            <td style="text-align: right; padding-bottom: 4px; padding-left: 10px; font-weight: 700; color: #334155;">${startDate} <span style="color: #cbd5e1;">to</span> ${endDate}</td>
                        </tr>
                        <tr>
                            <td style="text-align: right; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Salesman:</td>
                            <td style="text-align: right; padding-left: 10px; font-weight: 700; color: #0284c7; text-transform: uppercase;">${salesmanLabel}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background-color: #0f172a; color: #ffffff;">
                        <th style="padding: 10px 6px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; border-top-left-radius: 4px;">Date</th>
                        <th style="padding: 10px 6px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase;">Ref No</th>
                        <th style="padding: 10px 6px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase;">Customer</th>
                        <th style="padding: 10px 6px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase;">Staff</th>
                        <th style="padding: 10px 6px; text-align: center; font-size: 9px; font-weight: 700; text-transform: uppercase;">Status</th>
                        <th style="padding: 10px 6px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase;">Qty</th>
                        <th style="padding: 10px 6px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase; border-top-right-radius: 4px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
                <tfoot>
                    <tr style="background-color: #f8fafc; border-top: 2px solid #0f172a;">
                        <td colspan="5" style="padding: 12px 10px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">Valid Totals</td>
                        <td style="padding: 12px 6px; text-align: right; font-size: 12px; font-weight: 900; color: #0f172a;">${totalQty}</td>
                        <td style="padding: 12px 6px; text-align: right; font-size: 12px; font-weight: 900; color: #0f172a;">${totalAmt.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Summary Box -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Summary</div>
                    <div style="font-size: 11px; font-weight: 600; color: #475569; margin-top: 4px;">Includes all non-cancelled orders for ${salesmanLabel}.</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 20px; font-weight: 900; color: #0f172a;">${validOrders.length}</div>
                    <div style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">Orders Count</div>
                </div>
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                <p style="margin: 0; font-size: 8px; color: #cbd5e1; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                    Generated by Greenzar Stock • ${new Date().toLocaleString()}
                </p>
            </div>
        </div>
      `;

      const element = document.createElement('div');
      element.innerHTML = content;
      const opt = { 
          margin: 10, 
          filename: `Statement_${salesmanLabel}_${startDate}.pdf`, 
          image: { type: 'jpeg', quality: 0.98 }, 
          html2canvas: { scale: 2, useCORS: true }, 
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
      };
      
      // Standard Save (No Encryption)
      if ((window as any).html2pdf) {
          (window as any).html2pdf().set(opt).from(element).save();
      } else {
          alert("PDF Library missing.");
      }
  };

  const handleCancelClick = (e: React.MouseEvent, bill: Bill) => {
      e.stopPropagation();
      // Double check cancellability
      if (bill.status !== 'PENDING' && bill.status !== 'LOADING') {
          alert("Order cannot be cancelled in this stage.");
          return;
      }
      setCancelTarget(bill);
  };

  const processCancelOrder = async () => {
      if (!cancelTarget) return;
      
      try {
          await billService.cancelBill(cancelTarget.id);
          loadOrders();
          if (onNotification) onNotification(`Order Cancelled (Renamed)`, 'info');
          setCancelTarget(null);
          setEditingOrder(null);
      } catch (e) {
          console.error(e);
          alert("Failed to cancel order.");
      }
  };

  const handleDeleteOrder = async (e: React.MouseEvent, bill: Bill) => {
      e.stopPropagation();
      if (!window.confirm("PERMANENTLY DELETE?\n\nThis will completely remove this record from history. This action cannot be undone.")) return;
      
      try {
          await billService.deleteBill(bill.id);
          if (onNotification) onNotification(`Order Deleted Permanently`, 'success');
          loadOrders();
          setEditingOrder(null); // Close modal if open
      } catch(e) {
          alert("Failed to delete.");
      }
  }

  // --- PRINT HANDLER ---
  const handlePrintClick = async (e: React.MouseEvent, bill: Bill) => {
      e.stopPropagation();
      try {
          let items = bill.items;
          if (!items || items.length === 0) {
             items = await billService.getItemsByBillId(bill.id);
          }
          onPrintDispatch(bill, items || []);
      } catch (e) {
          console.error(e);
          alert("Failed to load details for printing");
      }
  };

  // --- PDF DOWNLOAD HANDLER ---
  const handleDownloadPDF = async (e: React.MouseEvent, bill: Bill) => {
    e.stopPropagation();
    try {
      const items = await billService.getItemsByBillId(bill.id);
      
      const itemsHtml = items.map(item => `
        <div style="display: flex; margin-bottom: 2px; font-size: 9px; font-weight: bold; color: black; line-height: 1.1;">
          <div style="flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding-right: 2px;">${item.product_name}</div>
          <div style="width: 20px; text-align: right;">${item.qty}</div>
          <div style="width: 30px; text-align: right;">-</div>
          <div style="width: 40px; text-align: right;">-</div>
        </div>
      `).join('');

      const dateObj = new Date(bill.bill_date);
      const formattedDate = !isNaN(dateObj.getTime()) 
        ? `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth()+1).padStart(2, '0')}-${dateObj.getFullYear()}`
        : bill.bill_date;
      
      let qrHtml = `<div style="width: 80px; height: 80px;"></div>`;
      if ((window as any).QRious) {
          const qrData = bill.bill_no;
          if(qrData) {
             const qr = new (window as any).QRious({ value: qrData, size: 250 });
             const qrDataUrl = qr.toDataURL();
             qrHtml = `<div style="text-align: center;"><img src="${qrDataUrl}" width="100" height="100" style="border: 1px solid #eee;" /><div style="font-size: 6px; font-weight: bold; margin-top: 1px;">Order #${bill.bill_no}</div></div>`;
          }
      }

      const content = `
        <div style="font-family: Arial, sans-serif; padding: 0; color: black; width: 100%; background: white;">
          <div style="text-align: center; margin-bottom: 2px;">
            <h1 style="font-size: 14px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">GREENZAR FOOD & BEVERAGE</h1>
            <p style="font-size: 8px; margin: 1px 0 0; font-weight: bold;">Jhampa, Deganga, North 24 PGS, PIN.-743423</p>
          </div>
          <div style="text-align: center; font-weight: bold; font-size: 10px; text-transform: uppercase; margin: 2px 0;">ORDER DISPATCH NOTE</div>
          <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">
             <div style="display: flex; gap: 2px; align-items: flex-end;"><span>No.</span><span style="font-size: 10px; line-height: 1;">${bill.bill_no}</span></div>
             <div>${formattedDate}</div>
          </div>
          <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid black; padding-bottom: 2px; margin-bottom: 2px;">
             <div style="display: flex; gap: 2px; width: 100%;"><span>NAME:</span><span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bill.customer_name || 'CASH'}</span></div>
             ${bill.salesman_name ? `<div style="display: flex; gap: 2px; width: 100%;"><span>SALES:</span><span>${bill.salesman_name}</span></div>` : ''}
             ${bill.vehicle_number ? `<div style="display: flex; gap: 2px; width: 100%; margin-top: 2px;"><span>VEHICLE:</span><span>${bill.vehicle_number}</span></div>` : ''}
          </div>
          <div style="border-bottom: 1px solid black; margin-bottom: 2px; padding-bottom: 2px; font-weight: bold; font-size: 9px; display: flex; color: black;">
            <div style="flex: 1;">Item</div><div style="width: 20px; text-align: right;">Qty</div><div style="width: 30px; text-align: right;"></div><div style="width: 40px; text-align: right;"></div>
          </div>
          <div style="margin-bottom: 4px;">${itemsHtml}</div>
          <div style="border-top: 1px solid black; border-bottom: 1px solid black; padding: 3px 0; display: flex; justify-content: space-between; font-weight: bold; font-size: 10px; text-transform: uppercase; color: black;">
            <div>Gross Qty:- ${bill.total_qty}</div><div>-</div>
          </div>
          <div style="display: flex; gap: 4px; margin-top: 8px; align-items: flex-start;">${qrHtml}
             <div style="font-size: 8px; font-weight: bold; flex: 1; padding-top: 2px; line-height: 1.1; text-align: right;">For any query, contact our Helpline Number-<br/><span style="font-size: 10px;">9476156298</span></div>
          </div>
        </div>
      `;

      const element = document.createElement('div');
      element.innerHTML = content;
      const opt = { margin: 0, filename: `${bill.bill_no}_Dispatch.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 3 }, jsPDF: { unit: 'mm', format: [72, 297], orientation: 'portrait' } };
      
      if ((window as any).html2pdf) (window as any).html2pdf().set(opt).from(element).save();
      else alert("PDF Library not loaded.");
    } catch (e) { alert("Failed to generate PDF"); }
  };

  // Open "Process/Edit Order" Modal
  const handleProcessOrder = async (e: React.MouseEvent, bill: Bill) => {
    e.stopPropagation();
    
    // --- PIN CHECK FOR LOCKED ORDERS ---
    if (bill.status === 'APPROVED' || bill.status === 'DELIVERED') {
        const pin = window.prompt("🔒 ORDER LOCKED\nEnter PIN '2006' to Unlock & Edit:");
        if (pin !== '2006') {
            alert("❌ Incorrect PIN. Access Denied.");
            return;
        }
    }
    
    // Ensure products are loaded
    if (products.length === 0) {
        productService.getAll().then(setProducts);
    }

    setEditingOrder(bill);
    
    // Initializing Form Data
    setDriverName(bill.driver_name || '');
    setDriverContact(bill.driver_contact || '');
    setVehicleNo(bill.vehicle_number || '');
    setSelectedStatus(bill.status || 'PENDING');
    
    setEditCustomerName(bill.customer_name || '');
    setEditCustomerAddress(bill.customer_address || '');
    setEditCustomerPhone(bill.phone_number || '');
    setEditRemark(bill.remark || ''); // Load existing remark

    setConfirmDelivery(false); // Reset confirmation check
    setSaveLoading(false);
    
    setEditItems([]);
    setLoadingItems(true);
    
    try {
        const items = await billService.getItemsByBillId(bill.id);
        setEditItems((items || []).map(i => ({
            ...i, 
            qtyInput: i.qty.toString(),
            rateInput: (i.rate || 0).toString()
        })));
    } catch (e) {
        console.error(e);
        alert("Failed to load order items");
    } finally {
        setLoadingItems(false);
    }
  };

  const handleUpdateItem = (idx: number, field: 'qty' | 'product_name' | 'rate', val: string) => {
      const updated = [...editItems];
      if (field === 'qty') {
          updated[idx].qtyInput = val;
          updated[idx].qty = parseFloat(val) || 0; 
      } else if (field === 'rate') {
          updated[idx].rateInput = val;
          updated[idx].rate = parseFloat(val) || 0;
      } else if (field === 'product_name') {
          updated[idx].product_name = val;
      }

      updated[idx].line_total = (updated[idx].qty || 0) * (updated[idx].rate || 0);
      setEditItems(updated);
  };

  const handleRemoveItem = (idx: number) => {
      const updated = [...editItems];
      updated.splice(idx, 1);
      setEditItems(updated);
  };

  const handleAddItem = () => {
      if (!newItemName || !newItemQty) return;
      const q = parseFloat(newItemQty);
      const r = parseFloat(newItemRate) || 0;
      setEditItems([...editItems, {
          product_name: newItemName,
          qty: q,
          qtyInput: newItemQty,
          rate: r,
          rateInput: newItemRate,
          line_total: q * r
      }]);
      setNewItemName('');
      setNewItemQty('');
      setNewItemRate('');
  };

  const handleSaveOrder = async () => {
      if (!editingOrder) return;
      
      // 1. CONFIRMATION CHECK FOR DELIVERED STATUS
      if (selectedStatus === 'DELIVERED') {
          if (!confirmDelivery) {
              alert("⚠️ Please confirm delivery by checking the box.");
              return;
          }
      }

      // 2. Validation for Dispatch info
      if (!isSalesman && (selectedStatus === 'OUT_FOR_DELIVERY' || selectedStatus === 'RECEIVED' || selectedStatus === 'DELIVERED') && !vehicleNo) {
          if (!window.confirm("⚠️ Missing Vehicle Number\n\nAre you sure you want to proceed without a Vehicle Number?")) {
              return;
          }
      }
      
      setSaveLoading(true);

      try {
          const totalQty = editItems.reduce((sum, i) => sum + (parseFloat(i.qtyInput || i.qty.toString()) || 0), 0);
          const totalAmount = editItems.reduce((sum, i) => sum + (i.line_total || 0), 0);
          
          // Re-calculate Total Weight based on edited items
          const totalWeight = editItems.reduce((sum, item) => {
              const product = products.find(p => p.product_name.trim().toLowerCase() === item.product_name.trim().toLowerCase());
              const weight = product?.weight || 0;
              const q = parseFloat(item.qtyInput || item.qty.toString()) || 0;
              return sum + (q * weight);
          }, 0);

          const cleanItems: BillItem[] = editItems.map(i => ({
              product_name: i.product_name,
              qty: parseFloat(i.qtyInput || i.qty.toString()) || 0,
              rate: parseFloat(i.rateInput || (i.rate || 0).toString()) || 0,
              line_total: i.line_total || 0,
              id: i.id,
              bill_id: i.bill_id
          }));

          let finalStatus = isSalesman ? editingOrder.status : selectedStatus;
          
          if (!isSalesman && editingOrder.status === 'PENDING' && selectedStatus === 'PENDING') {
              finalStatus = 'LOADING';
          }

          // --- ROBUST "EDITED BY" LOGIC (REGEX FIX) ---
          // 1. Start with whatever is in the edit box
          let currentRemark = editRemark || '';
          
          // 2. Use Regex to strip any existing "Edited by" suffix (case insensitive, robust spacing)
          currentRemark = currentRemark.replace(/\s*\|\s*Edited by:.*$/i, '').trim();

          // 3. Append fresh tag
          if (currentUser) {
             currentRemark = `${currentRemark} | Edited by: ${currentUser.name}`;
          }

          await billService.update(editingOrder.id, {
              customer_name: editCustomerName,
              customer_address: editCustomerAddress,
              phone_number: editCustomerPhone,
              vehicle_number: vehicleNo,
              driver_name: driverName,
              driver_contact: driverContact,
              total_qty: totalQty,
              total_amount: totalAmount,
              total_weight: totalWeight, 
              status: finalStatus,
              remark: currentRemark, // SAVE UPDATED REMARK
              bill_date: getLocalToday() // UPDATE DATE TO TODAY
          }, cleanItems);

          setEditingOrder(null);
          loadOrders();
          
          if (onStatusUpdate) onStatusUpdate();
          if (onNotification) onNotification(`Order Updated`, 'success');

      } catch (e: any) {
          console.error("Save Error:", e);
          alert(`Failed to save: ${e.message || 'Unknown Error'}`);
      } finally {
          setSaveLoading(false);
      }
  };

  const handleViewDetails = async (bill: Bill) => {
      try {
          // Ensure products are loaded to calculate weight
          if (products.length === 0) {
             const p = await productService.getAll();
             setProducts(p);
          }

          let items = bill.items;
          if (!items || items.length === 0) {
             items = await billService.getItemsByBillId(bill.id);
          }
          setViewItems(items || []);
          setViewOrder(bill);
      } catch (e) {
          console.error(e);
          alert("Failed to load details");
      }
  };

  const filteredOrders = orders.filter(o => {
      const matchesStatus = statusFilter === 'ALL' || (o.status || 'PENDING') === statusFilter;
      const matchesSearch = (o.customer_name || '').toLowerCase().includes(search.toLowerCase()) || o.bill_no.toLowerCase().includes(search.toLowerCase());
      const matchesSalesman = salesmanFilter === '' || o.salesman_name === salesmanFilter;
      
      const today = getLocalToday();
      const isDefaultView = (startDate === today && endDate === today);
      const isActive = ['PENDING', 'LOADING', 'OUT_FOR_DELIVERY'].includes(o.status || 'PENDING');
      
      // LOGIC: Show if date matches OR if it's the default view and the order is Active
      const isDateMatch = (!startDate || o.bill_date >= startDate) && (!endDate || o.bill_date <= endDate);
      const isVisible = isDateMatch || (isDefaultView && isActive);

      return matchesStatus && matchesSearch && matchesSalesman && isVisible;
  });

  const allStatusOptions: OrderStatus[] = ['PENDING', 'LOADING', 'OUT_FOR_DELIVERY', 'RECEIVED', 'DELIVERED', 'APPROVED', 'CANCELLED'];

  // Parse Delivery Date from Remark
  const getDeliveryDate = (remark?: string) => {
      if (!remark) return null;
      if (remark.includes('Target Delivery:')) {
          return remark.split('Target Delivery:')[1].split('|')[0].trim();
      }
      return null;
  };

  const formatOrderDate = (order: Bill) => {
      const dateStr = order.created_at || order.bill_date;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return order.bill_date;
      
      return (
          <div className="flex flex-col items-start text-xs text-gray-400 font-medium">
              <span className="flex items-center gap-1"><Calendar size={12}/> {d.toLocaleDateString()}</span>
              <span className="flex items-center gap-1 ml-4 text-[10px]"><Clock size={10}/> {d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
      );
  };

  // Helper to calculate total weight for a list of items
  const calculateTotalWeight = (items: (BillItem & { qtyInput?: string })[]) => {
      return items.reduce((total, item) => {
          const product = products.find(p => p.product_name.trim().toLowerCase() === item.product_name.trim().toLowerCase());
          const weight = product?.weight || 0;
          const q = item.qtyInput ? parseFloat(item.qtyInput) : (item.qty || 0);
          return total + (q * weight);
      }, 0);
  };

  const formatWeight = (kg: number) => {
      if (kg >= 1000) {
          const tons = Math.floor(kg / 1000);
          const rem = kg % 1000;
          return `${tons} MT ${rem.toFixed(0)} KG`;
      }
      return `${kg.toFixed(2)} KG`;
  }

  // STRICT LOCK: Approved, Delivered, Cancelled
  const isLocked = editingOrder && (
      editingOrder.status === 'APPROVED' || 
      editingOrder.status === 'DELIVERED' ||
      editingOrder.status === 'CANCELLED'
  );

  // CONTENT LOCK: Includes OUT_FOR_DELIVERY (Prevents editing items/logistics, but allows Status Update)
  const isContentLocked = isLocked || (editingOrder?.status === 'OUT_FOR_DELIVERY');

  // Product Selection for Add Item (Dropdown)
  const productOptions = products.map(p => ({
    id: p.id,
    title: p.product_name,
    subtitle: `Rate: ${p.rate}`,
    rightText: p.unit,
    tag: p.unit.substring(0,3).toUpperCase(),
    originalData: p
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

  return (
    <div className="flex flex-col h-full bg-[#F3F4F6]">
      {/* Header */}
      <div className="p-4 bg-white shadow-sm z-10 sticky top-0 md:relative border-b border-gray-100">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                <Package className="text-sky-500" size={20} /> Order History
            </h2>
            <div className="flex gap-2">
                <button onClick={() => setShowFilters(!showFilters)} className="md:hidden p-2 bg-gray-100 rounded-full text-gray-600">
                    <Filter size={16}/>
                </button>
                {/* STATEMENT BUTTON */}
                <button 
                    onClick={handleGenerateStatement}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full font-bold text-xs hover:bg-red-100 transition border border-red-100 shadow-sm"
                    title="Download Statement PDF"
                >
                    <FileText size={14} /> Statement
                </button>
                <button onClick={() => loadOrders()} className="text-xs font-bold text-sky-600 bg-sky-50 px-3 py-1.5 rounded-full hover:bg-sky-100 transition border border-sky-100 shadow-sm">Refresh</button>
            </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
             <div className="relative">
                 <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                 <input 
                    type="text" 
                    placeholder="Search Customer or Order No..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-sky-200 outline-none"
                 />
             </div>
             
             {/* Advanced Filters */}
             <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 ${showFilters ? 'grid' : 'hidden md:grid'}`}>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="bg-gray-50 border-none text-gray-600 text-xs font-bold rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-sky-200" 
                />
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="bg-gray-50 border-none text-gray-600 text-xs font-bold rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-sky-200" 
                />
                {!isSalesman && (
                    <select 
                      value={salesmanFilter} 
                      onChange={e => setSalesmanFilter(e.target.value)}
                      className="bg-gray-50 border-none text-gray-600 text-xs font-bold rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-sky-200 col-span-2 md:col-span-1"
                    >
                      <option value="">All Salesmen/Staff</option>
                      {salesmen.map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.role.substring(0,3)})</option>
                      ))}
                    </select>
                )}
             </div>

             {/* Status Filters */}
             <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {allStatusOptions.map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s as any)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition border ${
                            statusFilter === s 
                            ? 'bg-sky-600 text-white border-sky-600 shadow-sm' 
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        {s.replace(/_/g, ' ')}
                    </button>
                ))}
                <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition border ${
                        statusFilter === 'ALL' 
                        ? 'bg-sky-600 text-white border-sky-600 shadow-sm' 
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    ALL
                </button>
             </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
         {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {[1,2,3,4,5,6].map(i => <OrderSkeleton key={i} />)}
             </div>
         ) : filteredOrders.length === 0 ? (
             <div className="flex flex-col items-center justify-center pt-20 gap-3 text-gray-300">
                 <Filter size={48} />
                 <p className="font-bold">No orders match filter.</p>
             </div>
         ) : (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {filteredOrders.map(order => {
                       const isCancellable = order.status === 'PENDING' || order.status === 'LOADING';
                       const isEditable = order.status === 'PENDING';
                       const isCancelled = order.status === 'CANCELLED';
                       const deliveryDate = getDeliveryDate(order.remark);
                       const creator = salesmen.find(u => u.name === order.salesman_name);
                       const isStaffOrder = creator?.role === UserRole.EMPLOYEE;
                       const editorName = getEditorName(order.remark);

                       return (
                       <div 
                          key={order.id} 
                          onClick={() => handleViewDetails(order)}
                          className={`bg-white p-5 rounded-2xl shadow-sm border relative overflow-hidden group hover:shadow-md transition cursor-pointer active:scale-[0.99] flex flex-col ${isCancelled ? 'opacity-70 bg-gray-50 border-gray-200' : 'border-gray-100'}`}
                       >
                           <div className="absolute top-4 right-4">
                               <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                                   order.status === 'APPROVED' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                   order.status === 'DELIVERED' ? 'bg-green-50 text-green-700 border-green-100' :
                                   order.status === 'RECEIVED' ? 'bg-teal-50 text-teal-700 border-teal-100' :
                                   order.status === 'OUT_FOR_DELIVERY' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                                   order.status === 'CANCELLED' ? 'bg-red-600 text-white border-red-700' :
                                   order.status === 'LOADING' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                   'bg-gray-100 text-gray-600 border-gray-200'
                               }`}>
                                   {(order.status || 'PENDING').replace(/_/g, ' ')}
                               </span>
                           </div>
                           
                           <div className="mb-3 pr-16">
                               <div className="text-[10px] font-mono text-gray-400 mb-1">{order.bill_no}</div>
                               <h3 className={`font-bold text-gray-800 text-lg leading-tight truncate ${isCancelled ? 'line-through text-gray-500' : ''}`}>{order.customer_name}</h3>
                               <div className="mt-1">{formatOrderDate(order)}</div>
                               
                               {/* Customer Details (Address & Phone) */}
                               <div className="mt-2 space-y-1">
                                   <div className="flex items-start gap-1.5 text-xs text-gray-500">
                                       <MapPin size={12} className="shrink-0 mt-0.5 text-gray-400"/> 
                                       <span className="leading-snug line-clamp-2">{order.customer_address || 'No Address'}</span>
                                   </div>
                                   {order.phone_number && (
                                       <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                           <Phone size={12} className="shrink-0 text-gray-400"/> 
                                           <span>{order.phone_number}</span>
                                       </div>
                                   )}
                               </div>
                           </div>

                           {order.salesman_name && (
                               <div className="mb-3 flex flex-wrap items-center gap-2">
                                   <div className="flex items-center gap-2 bg-indigo-50 px-2 py-1.5 rounded-lg w-fit">
                                       <UserIcon size={12} className="text-indigo-500" />
                                       <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wide flex items-center gap-1">
                                           By: <span className="text-indigo-900">{order.salesman_name}</span>
                                           {isStaffOrder && (
                                               <span className="bg-teal-100 text-teal-700 px-1 rounded text-[8px] ml-1 border border-teal-200 flex items-center gap-0.5">
                                                   <Briefcase size={8}/> STAFF
                                               </span>
                                           )}
                                       </span>
                                   </div>
                               </div>
                           )}
                           
                           {/* Delivery Date Display */}
                           {deliveryDate && (
                               <div className="mb-2">
                                   <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm w-full md:w-auto">
                                       <Truck size={14} className="shrink-0" />
                                       <span className="text-xs font-bold uppercase truncate">
                                           Delivery: <span className="text-orange-900">{deliveryDate}</span>
                                       </span>
                                   </div>
                               </div>
                           )}

                           {/* Edited By Tag */}
                           {editorName && (
                               <div className="mb-3">
                                   <div className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg border border-yellow-100 w-auto">
                                       <Edit2 size={10} className="shrink-0" />
                                       <span className="text-[10px] font-bold">
                                           Edited by: <span className="text-yellow-900">{editorName}</span>
                                       </span>
                                   </div>
                               </div>
                           )}
                           
                           <div className="grid grid-cols-2 gap-2 mb-4">
                               <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                                   <span className="text-[9px] text-gray-400 font-bold uppercase">Items</span>
                                   <span className="font-bold text-gray-700">{order.total_qty}</span>
                               </div>
                               <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                                   <span className="text-[9px] text-gray-400 font-bold uppercase">Amount</span>
                                   <span className="font-black text-gray-700 flex items-center gap-0.5">
                                       <IndianRupee size={10} strokeWidth={3}/> {(order.total_amount || 0).toLocaleString()}
                                   </span>
                               </div>
                           </div>

                           {/* Items Preview */}
                           {order.items && order.items.length > 0 && (
                               <div className="mb-4 text-[10px] text-gray-500 leading-relaxed border-t border-gray-50 pt-2">
                                   <span className="font-bold text-gray-700">Includes: </span>
                                   {order.items.map(i => i.product_name).join(', ').substring(0, 50)}
                                   {order.items.reduce((acc, i) => acc + i.product_name.length, 0) > 50 && '...'}
                               </div>
                           )}
                           
                           {/* Admin & Employee Actions */}
                           {!isSalesman && (
                           <div className="mt-auto pt-3 border-t border-gray-50 space-y-2">
                               <button 
                                 onClick={(e) => handleProcessOrder(e, order)}
                                 className={`w-full h-10 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm ${
                                    order.status === 'PENDING'
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200' 
                                    : order.status === 'CANCELLED' ? 'bg-gray-200 text-gray-500'
                                    : order.status === 'APPROVED' || order.status === 'DELIVERED' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-200' 
                                 }`}
                               >
                                 <Edit2 size={16} />
                                 {order.status === 'CANCELLED' ? 'CANCELLED' : order.status === 'PENDING' ? 'EDIT & PROCESS' : 'UPDATE STATUS'}
                               </button>

                               {order.status !== 'CANCELLED' && (
                                   <div className="grid grid-cols-2 gap-2">
                                       <button 
                                         onClick={(e) => handlePrintClick(e, order)}
                                         className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:text-sky-600 hover:border-sky-200 h-9 rounded-lg text-xs font-bold transition shadow-sm"
                                       >
                                           <Printer size={14} /> Print
                                       </button>
                                       <button 
                                         onClick={(e) => handleDownloadPDF(e, order)}
                                         className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:text-red-600 hover:border-red-200 h-9 rounded-lg text-xs font-bold transition shadow-sm"
                                       >
                                           <FileDown size={14} /> PDF
                                       </button>
                                   </div>
                               )}
                           </div>
                           )}

                           {/* SALESMAN Actions: EDIT & CANCEL */}
                           {isSalesman && !isCancelled && (
                               <div className="mt-auto pt-2 border-t border-gray-50 grid grid-cols-2 gap-2">
                                   <button 
                                     onClick={(e) => handleProcessOrder(e, order)}
                                     disabled={!isEditable}
                                     className={`h-9 flex items-center justify-center rounded-lg font-bold text-xs gap-1 transition ${
                                         isEditable 
                                         ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm shadow-sky-200' 
                                         : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                     }`}
                                   >
                                       <Edit2 size={14} /> EDIT
                                   </button>

                                   <button 
                                     onClick={(e) => handleCancelClick(e, order)}
                                     disabled={!isCancellable}
                                     className={`h-9 flex items-center justify-center rounded-lg font-bold text-xs gap-1 transition ${
                                         isCancellable 
                                         ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' 
                                         : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                     }`}
                                   >
                                       {isCancellable ? <Ban size={14} /> : <Lock size={12}/>}
                                       CANCEL
                                   </button>
                               </div>
                           )}
                           
                           {/* If Cancelled, allow DELETE (For Admin/Employee to clean up) */}
                           {isCancelled && !isSalesman && (
                               <div className="mt-auto pt-2 border-t border-gray-50">
                                   <button 
                                     onClick={(e) => handleDeleteOrder(e, order)}
                                     className="w-full h-9 flex items-center justify-center rounded-lg font-bold text-xs gap-1 transition bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                                   >
                                       <Trash2 size={14} /> DELETE PERMANENTLY
                                   </button>
                               </div>
                           )}
                           
                       </div>
                   )})}
                </div>
            </div>
         )}
      </div>

      {/* EDIT MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
                <div className={`p-4 md:p-5 border-b border-gray-100 flex justify-between items-center ${isLocked ? 'bg-gray-100' : 'bg-gray-50'}`}>
                    <div>
                        <h3 className="font-black text-gray-800 text-base md:text-lg flex items-center gap-2">
                           {isLocked ? <Lock size={20} className="text-gray-400"/> : null}
                           {isLocked ? 'Order Locked' : isContentLocked ? 'Update Status (Locked)' : isSalesman ? 'Edit Order Details' : 'Update Order'}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono">{editingOrder.bill_no}</p>
                    </div>
                    <button onClick={() => setEditingOrder(null)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-700 shadow-sm"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 relative">
                    
                    {/* SECTION 1: CUSTOMER DETAILS (EDITABLE IF NOT LOCKED) */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2"><UserIcon size={16} /> Customer Details</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Customer Name</label>
                                <input 
                                    type="text" 
                                    value={editCustomerName} 
                                    onChange={e => setEditCustomerName(e.target.value)} 
                                    className="w-full p-2 border rounded-lg text-sm font-bold text-gray-800 disabled:bg-gray-100"
                                    disabled={isContentLocked}
                                    placeholder="Customer Name"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Address</label>
                                    <input 
                                        type="text" 
                                        value={editCustomerAddress} 
                                        onChange={e => setEditCustomerAddress(e.target.value)} 
                                        className="w-full p-2 border rounded-lg text-sm font-bold text-gray-800 disabled:bg-gray-100"
                                        disabled={isContentLocked}
                                        placeholder="Address"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Phone</label>
                                    <input 
                                        type="text" 
                                        value={editCustomerPhone} 
                                        onChange={e => setEditCustomerPhone(e.target.value)} 
                                        className="w-full p-2 border rounded-lg text-sm font-bold text-gray-800 disabled:bg-gray-100"
                                        disabled={isContentLocked}
                                        placeholder="Mobile"
                                    />
                                </div>
                            </div>
                            
                            {/* Remark Edit Field */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Note / Remarks (Edit here)</label>
                                <textarea 
                                    value={editRemark} 
                                    onChange={e => setEditRemark(e.target.value)} 
                                    className="w-full p-2 border rounded-lg text-sm text-gray-700 disabled:bg-gray-100 min-h-[60px]"
                                    disabled={isContentLocked}
                                    placeholder="Add any notes..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: DISPATCH DETAILS (ADMIN/STAFF ONLY OR VIEW ONLY) */}
                    {!isSalesman && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h4 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2"><Truck size={16} /> Dispatch Logistics</h4>
                            
                            <div className="grid grid-cols-1 gap-3 mb-4">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Order Status</label>
                                <div className="flex flex-col gap-2">
                                    <select 
                                        value={selectedStatus} 
                                        onChange={(e) => {
                                            setSelectedStatus(e.target.value as OrderStatus);
                                            setConfirmDelivery(false);
                                        }}
                                        className="bg-white border border-blue-200 text-blue-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold outline-none w-full"
                                        disabled={isLocked} 
                                    >
                                        {allStatusOptions.filter(s => {
                                            if (s === 'APPROVED' && !isAdmin) return false; 
                                            if (editingOrder.status !== 'PENDING' && s === 'PENDING') return false;
                                            return true;
                                        }).map(s => (
                                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                        ))}
                                    </select>
                                    {selectedStatus === 'DELIVERED' && !isLocked && (
                                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2">
                                            <input type="checkbox" id="confirm-del" checked={confirmDelivery} onChange={e => setConfirmDelivery(e.target.checked)} className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300 shrink-0" />
                                            <label htmlFor="confirm-del" className="text-xs font-bold text-red-700 cursor-pointer select-none">Confirm Delivery (Locks Order)</label>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Vehicle Number</label>
                                    <SearchableDropdown 
                                        options={vehicles.map(v => ({ id: v.id, title: v.vehicle_number, originalData: v }))} 
                                        value={vehicleNo} 
                                        onChange={setVehicleNo} 
                                        placeholder="Enter or Select Vehicle"
                                        disabled={isContentLocked}
                                        onSelect={(opt) => {
                                            setVehicleNo(opt.title);
                                            const v = opt.originalData as Vehicle;
                                            if (v) {
                                                setDriverName(v.driver_name || '');
                                                setDriverContact(v.driver_contact || '');
                                            }
                                        }}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Driver Name</label>
                                        <input 
                                            type="text" 
                                            value={driverName} 
                                            onChange={e => setDriverName(e.target.value)} 
                                            className="w-full p-2 border rounded-lg text-sm font-bold text-gray-800 disabled:bg-gray-100"
                                            disabled={isContentLocked}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Contact</label>
                                        <input 
                                            type="text" 
                                            value={driverContact} 
                                            onChange={e => setDriverContact(e.target.value)} 
                                            className="w-full p-2 border rounded-lg text-sm font-bold text-gray-800 disabled:bg-gray-100"
                                            disabled={isContentLocked}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 3: ADD ITEM CARD (Like SalesOrderForm) */}
                    {!isContentLocked && (
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                             <h3 className="text-xs font-black text-slate-800 uppercase mb-3 flex items-center gap-2">
                                <Package size={16} className="text-sky-500"/> Add Products
                             </h3>
                             <div className="space-y-3">
                                 <SearchableDropdown 
                                    placeholder="Find Product..."
                                    options={productOptions}
                                    value={newItemName}
                                    onChange={setNewItemName}
                                    onSelect={(opt) => {
                                        setNewItemName(opt.title);
                                        const p = opt.originalData as Product;
                                        if (p) setNewItemRate(p.rate.toString());
                                        setTimeout(() => qtyInputRef.current?.focus(), 100);
                                    }}
                                 />
                                 
                                 <div className="flex gap-2">
                                     <div className="flex-1">
                                         <input 
                                            ref={qtyInputRef}
                                            type="number" 
                                            value={newItemQty}
                                            onChange={e => setNewItemQty(e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                            placeholder="Qty"
                                         />
                                     </div>
                                     <div className="w-24">
                                         <input 
                                            type="number" 
                                            value={newItemRate}
                                            onChange={e => setNewItemRate(e.target.value)}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                            placeholder="Rate"
                                         />
                                     </div>
                                     <button 
                                        onClick={handleAddItem}
                                        className="bg-sky-600 text-white w-14 rounded-xl flex items-center justify-center shadow-lg shadow-sky-200 active:scale-95 transition hover:bg-sky-700"
                                     >
                                         <Plus size={24} strokeWidth={3} />
                                     </button>
                                 </div>
                             </div>
                        </div>
                    )}

                    {/* SECTION 4: ITEMS LIST */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2"><Package size={16} /> Item List ({editItems.length})</h4>
                            <div className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded border border-sky-100 flex items-center gap-1">
                                <Scale size={12} />
                                {formatWeight(calculateTotalWeight(editItems))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            {editItems.map((item, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div className="font-bold text-slate-800 text-sm">{item.product_name}</div>
                                        {!isContentLocked && (
                                            <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 transition">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1 flex gap-2 items-center bg-slate-50 p-1 rounded-lg">
                                            <span className="text-[10px] font-bold text-gray-400 pl-2 uppercase">Qty</span>
                                            <input 
                                                type="number" 
                                                value={item.qtyInput} 
                                                onChange={e => handleUpdateItem(idx, 'qty', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded p-1 text-center font-bold text-slate-900 outline-none focus:border-sky-400"
                                                disabled={isContentLocked}
                                            />
                                        </div>
                                        <span className="text-gray-400 font-bold">x</span>
                                        <div className="w-20 flex gap-1 items-center bg-slate-50 p-1 rounded-lg">
                                            <span className="text-[10px] font-bold text-gray-400 pl-1 uppercase">₹</span>
                                            <input 
                                                type="number" 
                                                value={item.rateInput} 
                                                onChange={e => handleUpdateItem(idx, 'rate', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded p-1 text-center font-bold text-slate-900 outline-none focus:border-sky-400"
                                                disabled={isContentLocked}
                                            />
                                        </div>
                                        <div className="w-20 text-right font-black text-slate-800">
                                            ₹{(item.line_total || 0).toFixed(0)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {editItems.length === 0 && (
                                <div className="text-center p-6 text-gray-400 border border-dashed border-gray-200 rounded-xl text-xs">
                                    No items added yet. Use the form above.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 md:p-5 border-t border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-3 mt-auto">
                        <button onClick={() => setEditingOrder(null)} className="w-full md:w-auto px-5 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition">Close</button>
                        
                        {isSalesman && !isLocked && (
                            <button 
                                onClick={processCancelOrder}
                                className="w-full md:w-auto px-5 py-3 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition flex items-center justify-center gap-2"
                            >
                                <Ban size={16}/> CANCEL ORDER
                            </button>
                        )}

                        {!isLocked && (
                            <button onClick={handleSaveOrder} disabled={saveLoading || (selectedStatus === 'DELIVERED' && !confirmDelivery)} className="w-full md:w-auto px-6 py-3 rounded-xl font-bold shadow-lg bg-sky-600 text-white hover:bg-sky-700 transition">
                                {saveLoading ? 'Saving...' : 'UPDATE & SAVE'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- CANCEL CONFIRMATION MODAL --- */}
      {cancelTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                      <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">Cancel Order?</h3>
                  <div className="text-sm text-gray-500 mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="font-bold text-gray-800 mb-1">{cancelTarget.customer_name}</div>
                      <div className="font-mono text-xs">Order #{cancelTarget.bill_no}</div>
                  </div>
                  <p className="text-xs text-red-500 font-bold mb-6">
                      This action cannot be undone. The order will be renamed to free up the Invoice No.
                  </p>
                  
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setCancelTarget(null)}
                        className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
                      >
                          No, Keep It
                      </button>
                      <button 
                        onClick={processCancelOrder}
                        className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition flex items-center justify-center gap-2"
                      >
                          <Ban size={16} /> Yes, Cancel
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- VIEW ONLY MODAL --- */}
      {viewOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                  {/* Modal Header */}
                  <div className="bg-gray-50 p-5 border-b border-gray-100 flex justify-between items-center">
                       <div>
                           <h3 className="font-black text-gray-800 text-lg">Details</h3>
                           <p className="text-xs text-gray-400 font-mono">{viewOrder.bill_no} • {new Date(viewOrder.bill_date).toLocaleDateString()}</p>
                       </div>
                       <button onClick={() => setViewOrder(null)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 shadow-sm border border-gray-100">
                           <X size={20} />
                       </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                      {/* Customer Info Card */}
                      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                           <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
                           <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                               <UserIcon size={12}/> Customer Information
                           </h4>
                           <p className="font-bold text-gray-800 text-lg">{viewOrder.customer_name}</p>
                           <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                               <MapPin size={14}/> {viewOrder.customer_address || 'No Address Provided'}
                           </p>
                           {viewOrder.phone_number && (
                               <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                   <Phone size={14}/> {viewOrder.phone_number}
                               </p>
                           )}
                           
                           {/* FULL DETAILS (GST/PAN/AADHAR) */}
                           <div className="mt-4 pt-3 border-t border-dashed border-gray-200 grid grid-cols-2 gap-4">
                               {viewOrder.gst_number && (
                                   <div>
                                       <span className="text-[9px] font-bold text-gray-400 uppercase block">GSTIN</span>
                                       <span className="text-xs font-mono font-bold text-gray-700">{viewOrder.gst_number}</span>
                                   </div>
                               )}
                               {viewOrder.pan_number && (
                                   <div>
                                       <span className="text-[9px] font-bold text-gray-400 uppercase block">PAN</span>
                                       <span className="text-xs font-mono font-bold text-gray-700">{viewOrder.pan_number}</span>
                                   </div>
                               )}
                               {viewOrder.aadhar_number && (
                                   <div>
                                       <span className="text-[9px] font-bold text-gray-400 uppercase block">AADHAR</span>
                                       <span className="text-xs font-mono font-bold text-gray-700">{viewOrder.aadhar_number}</span>
                                   </div>
                               )}
                           </div>
                      </div>

                      {/* Dispatch & Driver Info Card */}
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                           <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-1">
                               <Truck size={12}/> Dispatch Logistics
                           </h4>
                           <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">Vehicle No</span>
                                    <span className="font-bold text-gray-900 bg-white px-2 py-1 rounded border border-gray-200 font-mono">
                                        {viewOrder.vehicle_number || 'Pending'}
                                    </span>
                                </div>
                                {viewOrder.driver_name && (
                                    <div className="flex justify-between items-start text-sm pt-2">
                                        <span className="text-gray-500 font-medium">Driver</span>
                                        <div className="text-right">
                                            <span className="font-bold text-gray-900 block">{viewOrder.driver_name}</span>
                                            {viewOrder.driver_contact && (
                                                <span className="text-xs text-sky-600 font-medium flex items-center justify-end gap-1 mt-0.5">
                                                    <Phone size={10}/> {viewOrder.driver_contact}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                           </div>
                      </div>

                      {/* Item List */}
                      <div>
                          <div className="flex justify-between items-center mb-3">
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                  <Package size={12}/> Bill Items & Amount
                              </h4>
                              {/* Total Weight Display */}
                              <div className="text-[10px] font-black text-sky-700 bg-sky-50 px-2 py-1 rounded border border-sky-100 flex items-center gap-1">
                                  <Scale size={10} />
                                  WEIGHT: {viewOrder.total_weight ? formatWeight(viewOrder.total_weight) : formatWeight(calculateTotalWeight(viewItems))}
                              </div>
                          </div>
                          
                          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                              <table className="w-full text-sm">
                                  <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase">
                                      <tr>
                                          <th className="p-3 text-left">Product</th>
                                          <th className="p-3 text-right">Qty</th>
                                          <th className="p-3 text-right">Rate</th>
                                          <th className="p-3 text-right">Total</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                      {viewItems.length === 0 && (
                                          <tr><td colSpan={4} className="p-4 text-center text-gray-400">Loading details...</td></tr>
                                      )}
                                      {viewItems.map((item, idx) => (
                                          <tr key={idx} className="bg-white hover:bg-gray-50 transition">
                                              <td className="p-3 text-gray-700 font-medium">{item.product_name}</td>
                                              <td className="p-3 text-right font-bold text-gray-900">{item.qty}</td>
                                              <td className="p-3 text-right text-gray-500">{item.rate || '-'}</td>
                                              <td className="p-3 text-right font-bold text-gray-900">
                                                  {item.line_total ? item.line_total.toFixed(0) : '-'}
                                              </td>
                                          </tr>
                                      ))}
                                      
                                      <tr className="bg-gray-50 border-t border-gray-200">
                                          <td className="p-3 font-black text-gray-700 uppercase text-xs">Total</td>
                                          <td className="p-3 text-right font-black text-gray-900 text-base">{viewOrder.total_qty}</td>
                                          <td className="p-3"></td>
                                          <td className="p-3 text-right font-black text-gray-900 text-lg flex items-center justify-end gap-0.5">
                                              <IndianRupee size={12}/> 
                                              {viewOrder.total_amount ? viewOrder.total_amount.toFixed(0) : '0'}
                                          </td>
                                      </tr>
                                  </tbody>
                              </table>
                          </div>
                      </div>
                      
                      {/* Note & Remarks (Enhanced) */}
                      {viewOrder.remark && (
                          <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                              <h4 className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                                  <FileText size={12}/> Notes & Remarks
                              </h4>
                              <div className="text-sm font-medium text-yellow-900 leading-relaxed">
                                  {getCleanRemark(viewOrder.remark)}
                              </div>
                          </div>
                      )}

                      {/* Edited By Badge In Modal */}
                      {getEditorName(viewOrder.remark) && (
                          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-3 rounded-xl">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-600 shadow-sm border border-gray-100">
                                  <Edit2 size={16} />
                              </div>
                              <div>
                                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Last Updated By</div>
                                  <div className="font-bold text-gray-800 text-sm">{getEditorName(viewOrder.remark)}</div>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-5 bg-white border-t border-gray-100 flex gap-3">
                      <button onClick={() => setViewOrder(null)} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition">
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

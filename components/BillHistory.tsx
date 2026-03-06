
import React, { useState, useEffect } from 'react';
import { billService } from '../services/supabase';
import { Bill, BillItem, BillType } from '../types';
import { Printer, FileText, Download, Calendar, FileDown, Eye, X, Package, Truck, User, Phone, IndianRupee, MapPin, Search, Edit2, CreditCard } from 'lucide-react';

interface BillHistoryProps {
  onReprint: (bill: Bill, items: BillItem[]) => void;
  forcedFilter?: BillType | 'ALL';
}

// Skeleton Row Component
const SkeletonRow = () => (
  <tr className="animate-pulse border-b border-gray-50">
    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-24"></div></td>
    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-32"></div></td>
    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-40"></div></td>
    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-20"></div></td>
    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-16"></div></td>
    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-12"></div></td>
    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-16"></div></td>
    <td className="p-4 flex gap-2 justify-center">
        <div className="h-8 w-8 bg-gray-100 rounded-full"></div>
        <div className="h-8 w-8 bg-gray-100 rounded-full"></div>
    </td>
  </tr>
);

export const BillHistory: React.FC<BillHistoryProps> = ({ onReprint, forcedFilter = 'ALL' }) => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>(forcedFilter);
  
  // Details Modal State
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const [viewItems, setViewItems] = useState<BillItem[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // Party Name Search

  // If prop changes, update internal state
  useEffect(() => {
    setFilterType(forcedFilter);
  }, [forcedFilter]);

  useEffect(() => {
    loadBills();
    const interval = setInterval(() => loadBills(true), 5000); // 5s poll
    return () => clearInterval(interval);
  }, []);

  const loadBills = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await billService.getAll();
      setBills(data);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleReprint = async (e: React.MouseEvent, bill: Bill) => {
    e.stopPropagation();
    try {
      const items = await billService.getItemsByBillId(bill.id);
      onReprint(bill, items);
    } catch (e) {
      alert("Error fetching bill details");
    }
  };

  const handleViewDetails = async (bill: Bill) => {
      try {
          let items = bill.items;
          if (!items || items.length === 0) {
             items = await billService.getItemsByBillId(bill.id);
          }
          setViewItems(items || []);
          setViewBill(bill);
      } catch (e) {
          console.error(e);
      }
  };

  // --- PDF GENERATION LOGIC ---
  const handleDownloadPDF = async (e: React.MouseEvent, bill: Bill) => {
    e.stopPropagation();
    try {
      const items = await billService.getItemsByBillId(bill.id);
      const isSmall = bill.bill_type === BillType.SMALL;
      
      const itemsHtml = items.map(item => `
        <div style="display: flex; margin-bottom: 2px; font-size: 9px; font-weight: bold; color: black; line-height: 1.1;">
          <div style="flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding-right: 2px;">${item.product_name}</div>
          <div style="width: 20px; text-align: right;">${item.qty}</div>
          <div style="width: 30px; text-align: right;">${isSmall ? item.rate : '-'}</div>
          <div style="width: 40px; text-align: right;">${isSmall ? item.line_total?.toFixed(2) : '-'}</div>
        </div>
      `).join('');

      const dateObj = new Date(bill.bill_date);
      const formattedDate = !isNaN(dateObj.getTime()) 
        ? `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth()+1).padStart(2, '0')}-${dateObj.getFullYear()}`
        : bill.bill_date;
      
      let qrHtml = `<div style="width: 80px; height: 80px;"></div>`;
      // @ts-ignore
      if (window.QRious) {
          const qrData = bill.bill_no;
          if(qrData) {
             // @ts-ignore
             const qr = new window.QRious({ value: qrData, size: 250 });
             const qrDataUrl = qr.toDataURL();
             qrHtml = `<div style="text-align: center;"><img src="${qrDataUrl}" width="100" height="100" style="border: 1px solid #eee;" /><div style="font-size: 6px; font-weight: bold; margin-top: 1px;">Track Order</div></div>`;
          }
      }

      const content = `
        <div style="font-family: Arial, sans-serif; padding: 0; color: black; width: 100%; background: white;">
          <div style="text-align: center; margin-bottom: 2px;">
            <h1 style="font-size: 14px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: -0.5px;">GREENZAR FOOD & BEVERAGE</h1>
            <p style="font-size: 8px; margin: 1px 0 0; font-weight: bold;">Jhampa, Deganga, North 24 PGS, PIN.-743423</p>
          </div>
          <div style="text-align: center; font-weight: bold; font-size: 10px; text-transform: uppercase; margin: 2px 0;">${isSmall ? 'MEMO BILL' : 'DISPATCH'}</div>
          <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">
             <div style="display: flex; gap: 2px; align-items: flex-end;"><span>No.</span><span style="font-size: 10px; line-height: 1;">${bill.bill_no}</span></div>
             <div>${formattedDate}</div>
          </div>
          <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid black; padding-bottom: 2px; margin-bottom: 2px;">
             <div style="display: flex; gap: 2px; width: 100%;"><span>NAME:</span><span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bill.customer_name || 'CASH'}</span></div>
             ${bill.vehicle_number ? `<div style="display: flex; gap: 2px; width: 100%; margin-top: 4px;"><span>VEHICLE:</span><span>${bill.vehicle_number}</span></div>` : ''}
          </div>
          <div style="border-bottom: 1px solid black; margin-bottom: 2px; padding-bottom: 2px; font-weight: bold; font-size: 9px; display: flex; color: black;">
            <div style="flex: 1;">Item</div><div style="width: 20px; text-align: right;">Qty</div><div style="width: 30px; text-align: right;">Price</div><div style="width: 40px; text-align: right;">Total</div>
          </div>
          <div style="margin-bottom: 4px;">${itemsHtml}</div>
          <div style="border-top: 1px solid black; border-bottom: 1px solid black; padding: 3px 0; display: flex; justify-content: space-between; font-weight: bold; font-size: 10px; text-transform: uppercase; color: black;">
            <div>Gross Qty:- ${bill.total_qty}</div><div>Total- ₹ ${isSmall ? (bill.total_amount || 0).toFixed(2) : '-'}</div>
          </div>
          <div style="display: flex; gap: 4px; margin-top: 8px; align-items: flex-start;">${qrHtml}
             <div style="font-size: 8px; font-weight: bold; flex: 1; padding-top: 2px; line-height: 1.1; text-align: right;">For any query, contact our Helpline Number-<br/><span style="font-size: 10px;">9476156298</span></div>
          </div>
        </div>
      `;

      const element = document.createElement('div');
      element.innerHTML = content;
      const opt = { margin: 0, filename: `${bill.bill_no}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 3 }, jsPDF: { unit: 'mm', format: [72, 297], orientation: 'portrait' } };
      // @ts-ignore
      if (window.html2pdf) window.html2pdf().set(opt).from(element).save();
      else alert("PDF Library not loaded.");
    } catch (e) { alert("Failed to generate PDF"); }
  };

  const filteredBills = bills.filter(b => {
    const typeMatch = filterType === 'ALL' || b.bill_type === filterType;
    if (!typeMatch) return false;
    if (startDate && b.bill_date < startDate) return false;
    if (endDate && b.bill_date > endDate) return false;
    
    // Updated Search Logic: Matches Party Name OR Bill No OR Vehicle No
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = (b.customer_name || '').toLowerCase().includes(term);
        const matchesBillNo = (b.bill_no || '').toLowerCase().includes(term);
        const matchesVehicle = (b.vehicle_number || '').toLowerCase().includes(term);
        if (!matchesName && !matchesBillNo && !matchesVehicle) return false;
    }
    
    return true;
  });

  const getTitle = () => {
    if (forcedFilter === BillType.DISPATCH) return "Dispatch List";
    if (forcedFilter === BillType.SMALL) return "Small Bill List";
    return "All Print Logs";
  }

  const downloadCSV = () => {
    if (filteredBills.length === 0) {
      alert("No data to download");
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Date,Bill No,Type,Customer Name,Salesman,Vehicle No,Total Qty,Total Amount\n";
    filteredBills.forEach(b => {
      csvContent += `${b.bill_date},${b.bill_no},${b.bill_type},"${b.customer_name || ''}","${b.salesman_name || ''}",${b.vehicle_number || ''},${b.total_qty},${b.total_amount || 0}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Greenzar_Statement_${searchTerm || 'All'}_${startDate || 'Start'}_to_${endDate || 'End'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- NEW: STATEMENT PDF DOWNLOAD ---
  const downloadStatementPDF = () => {
      if (filteredBills.length === 0) {
          alert("No data found for this period/name to generate a statement.");
          return;
      }

      const totalQty = filteredBills.reduce((acc, b) => acc + b.total_qty, 0);
      const totalAmount = filteredBills.reduce((acc, b) => acc + (b.total_amount || 0), 0);
      const showAmount = filterType !== BillType.DISPATCH;

      const cellStyle = "padding: 6px; border-bottom: 1px solid #e5e7eb; font-size: 10px; color: #1f2937;";
      const headerStyle = "padding: 8px; border-bottom: 2px solid #374151; font-weight: bold; font-size: 10px; color: #111827; text-transform: uppercase; background-color: #f3f4f6;";

      const rows = filteredBills.map((b, i) => `
        <tr style="background-color: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
            <td style="${cellStyle} text-align: left;">${b.bill_date}</td>
            <td style="${cellStyle} text-align: left; font-family: monospace;">${b.bill_no}</td>
            <td style="${cellStyle} text-align: left; font-weight: 600;">${b.customer_name}</td>
            <td style="${cellStyle} text-align: center;">${b.bill_type}</td>
            <td style="${cellStyle} text-align: right; font-weight: bold;">${b.total_qty}</td>
            ${showAmount ? `<td style="${cellStyle} text-align: right;">${(b.total_amount || 0).toFixed(2)}</td>` : ''}
        </tr>
      `).join('');

      const content = `
        <div style="font-family: 'Helvetica', sans-serif; padding: 30px; background: white; width: 100%;">
            <div style="border-bottom: 3px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between;">
                <div>
                    <h1 style="margin: 0; font-size: 24px; color: #0f172a; font-weight: 900; letter-spacing: -0.5px;">GREENZAR FOOD & BEVERAGE</h1>
                    <p style="margin: 5px 0 0; color: #64748b; font-size: 11px;">Jhampa, Deganga, North 24 PGS, PIN.-743423</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; font-size: 16px; color: #0284c7; font-weight: 800; text-transform: uppercase;">Party Order Statement</h2>
                    ${searchTerm ? `<p style="margin: 5px 0 0; font-size: 14px; font-weight: bold; color: #0f172a;">${searchTerm}</p>` : ''}
                    <p style="margin: 2px 0 0; font-size: 10px; color: #64748b;">Period: ${startDate || 'Begin'} to ${endDate || 'Now'}</p>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr>
                        <th style="${headerStyle} text-align: left;">Date</th>
                        <th style="${headerStyle} text-align: left;">Bill No</th>
                        <th style="${headerStyle} text-align: left;">Party Name</th>
                        <th style="${headerStyle} text-align: center;">Type</th>
                        <th style="${headerStyle} text-align: right;">Qty</th>
                        ${showAmount ? `<th style="${headerStyle} text-align: right;">Amount (₹)</th>` : ''}
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
                <tfoot>
                    <tr style="background-color: #f1f5f9;">
                        <td colspan="4" style="padding: 10px; font-weight: 800; text-align: right; font-size: 11px; color: #0f172a; border-top: 2px solid #334155;">TOTALS</td>
                        <td style="padding: 10px; font-weight: 800; text-align: right; font-size: 12px; color: #0f172a; border-top: 2px solid #334155;">${totalQty}</td>
                        ${showAmount ? `<td style="padding: 10px; font-weight: 800; text-align: right; font-size: 12px; color: #0284c7; border-top: 2px solid #334155;">₹${totalAmount.toFixed(2)}</td>` : ''}
                    </tr>
                </tfoot>
            </table>

            <div style="margin-top: 40px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                Computer Generated Statement via Greenzar Stock App • Generated on ${new Date().toLocaleString()}
            </div>
        </div>
      `;

      const element = document.createElement('div');
      element.innerHTML = content;
      const opt = { margin: 10, filename: `Statement_${searchTerm || 'Summary'}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
      // @ts-ignore
      if (window.html2pdf) window.html2pdf().set(opt).from(element).save();
  };

  // Helper: Extract name from remark if present
  const getEditorName = (remark?: string) => {
      if (!remark || !remark.includes('| Edited by:')) return null;
      return remark.split('| Edited by:')[1].trim();
  };
  const getCleanRemark = (remark?: string) => {
      if (!remark) return '';
      return remark.split('| Edited by:')[0].trim();
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-sky-500" /> {getTitle()}
        </h2>
        
        <div className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
          {/* Party Name Search */}
          <div className="relative w-full md:w-48">
              <input 
                type="text" 
                placeholder="Search Party, Bill, or Vehicle..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-2 py-1.5 border border-gray-200 rounded text-sm focus:border-sky-400 outline-none w-full font-bold text-gray-700"
              />
              <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2 w-full md:w-auto">
             <div className="relative flex-1">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="pl-8 pr-2 py-1.5 border border-gray-200 rounded text-sm focus:border-sky-400 outline-none w-full"
                />
                <Calendar size={14} className="absolute left-2 top-2.5 text-gray-400" />
             </div>
             <span className="text-gray-400 font-bold">-</span>
             <div className="relative flex-1">
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  className="pl-8 pr-2 py-1.5 border border-gray-200 rounded text-sm focus:border-sky-400 outline-none w-full"
                />
                <Calendar size={14} className="absolute left-2 top-2.5 text-gray-400" />
             </div>
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block"></div>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
              {/* CSV Download */}
              <button 
                  onClick={downloadCSV}
                  className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition shadow-sm whitespace-nowrap"
                  title="Download List as CSV"
              >
                  <Download size={14} /> CSV
              </button>

              {/* PDF Statement */}
              <button 
                  onClick={downloadStatementPDF}
                  className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition shadow-sm whitespace-nowrap"
                  title="Download Filtered Statement PDF"
              >
                  <FileDown size={14} /> Statement
              </button>

              {/* Only show toggle if not forced */}
              {forcedFilter === 'ALL' && (
                <div className="flex p-0.5 bg-gray-100 rounded border border-gray-200 ml-2">
                  <button onClick={() => setFilterType('ALL')} className={`px-3 py-1 text-xs font-bold rounded transition ${filterType === 'ALL' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>ALL</button>
                  <button onClick={() => setFilterType(BillType.SMALL)} className={`px-3 py-1 text-xs font-bold rounded transition ${filterType === BillType.SMALL ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500'}`}>SMALL</button>
                  <button onClick={() => setFilterType(BillType.DISPATCH)} className={`px-3 py-1 text-xs font-bold rounded transition ${filterType === BillType.DISPATCH ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>DISP</button>
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-sky-100 overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="overflow-auto flex-1">
             <table className="w-full text-left border-collapse">
               <thead className="bg-sky-50 sticky top-0 z-10 shadow-sm">
                 <tr className="text-xs uppercase text-gray-400 font-bold tracking-wider">
                   <th className="p-4 hidden md:table-cell">Date</th>
                   <th className="p-4">Bill No</th>
                   <th className="p-4">Customer</th>
                   <th className="p-4">Vehicle</th>
                   <th className="p-4">Type</th>
                   <th className="p-4 text-right">Qty</th>
                   {filterType !== BillType.DISPATCH && <th className="p-4 text-right">Amount</th>}
                   <th className="p-4 text-center">Action</th>
                 </tr>
               </thead>
               <tbody>
                  {[1,2,3,4,5].map(i => <SkeletonRow key={i}/>)}
               </tbody>
             </table>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center text-gray-400 gap-2">
              <Search size={40} className="opacity-20"/>
              <div>No records found for current filter.</div>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-sky-50 sticky top-0 z-10 shadow-sm">
                <tr className="text-xs uppercase text-gray-400 font-bold tracking-wider">
                  <th className="p-4 hidden md:table-cell">Date</th>
                  <th className="p-4">Bill No</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Vehicle</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-right">Qty</th>
                  {filterType !== BillType.DISPATCH && <th className="p-4 text-right">Amount</th>}
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {filteredBills.map((bill) => (
                  <tr 
                    key={bill.id} 
                    onClick={() => handleViewDetails(bill)}
                    className="hover:bg-sky-50/50 transition cursor-pointer group"
                  >
                    <td className="p-4 text-gray-500 whitespace-nowrap hidden md:table-cell">{bill.bill_date}</td>
                    <td className="p-4 font-mono font-medium text-gray-900">
                      {bill.bill_no}
                      <div className="md:hidden text-xs text-gray-400 mt-1">{bill.bill_date}</div>
                    </td>
                    <td className="p-4 font-medium text-gray-700">
                      {bill.customer_name || '-'}
                      {bill.salesman_name && <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">By: {bill.salesman_name}</div>}
                    </td>
                    <td className="p-4 text-gray-500 font-mono text-xs">
                        {bill.vehicle_number || '-'}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        bill.bill_type === BillType.SMALL ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {bill.bill_type}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono">{bill.total_qty}</td>
                    {filterType !== BillType.DISPATCH && (
                      <td className="p-4 text-right font-mono font-bold text-gray-900">
                        {bill.total_amount ? bill.total_amount.toFixed(2) : '-'}
                      </td>
                    )}
                    <td className="p-4 text-center flex items-center justify-center gap-2">
                      <button 
                        onClick={(e) => handleReprint(e, bill)}
                        className="text-gray-400 hover:text-sky-600 transition p-2 rounded-full hover:bg-sky-50"
                        title="Reprint"
                      >
                        <Printer size={18} />
                      </button>
                      <button 
                        onClick={(e) => handleDownloadPDF(e, bill)}
                        className="text-gray-400 hover:text-green-600 transition p-2 rounded-full hover:bg-green-50"
                        title="PDF Receipt"
                      >
                        <FileDown size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- VIEW ONLY MODAL --- */}
      {viewBill && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                  {/* Modal Header */}
                  <div className="bg-gray-50 p-5 border-b border-gray-100 flex justify-between items-center">
                       <div>
                           <h3 className="font-black text-gray-800 text-lg">Details</h3>
                           <p className="text-xs text-gray-400 font-mono">{viewBill.bill_no} • {new Date(viewBill.bill_date).toLocaleDateString()}</p>
                       </div>
                       <button onClick={() => setViewBill(null)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 shadow-sm border border-gray-100">
                           <X size={20} />
                       </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                      {/* Customer Info Card */}
                      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                           <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
                           <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                               <User size={12}/> Customer Information
                           </h4>
                           <p className="font-bold text-gray-800 text-lg">{viewBill.customer_name}</p>
                           <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                               <MapPin size={14}/> {viewBill.customer_address || 'No Address Provided'}
                           </p>
                           {viewBill.phone_number && (
                               <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                   <Phone size={14}/> {viewBill.phone_number}
                               </p>
                           )}

                           {/* FULL DETAILS (GST/PAN/AADHAR) */}
                           <div className="mt-4 pt-3 border-t border-dashed border-gray-200 grid grid-cols-2 gap-4">
                               {viewBill.gst_number && (
                                   <div>
                                       <span className="text-[9px] font-bold text-gray-400 uppercase block">GSTIN</span>
                                       <span className="text-xs font-mono font-bold text-gray-700">{viewBill.gst_number}</span>
                                   </div>
                               )}
                               {viewBill.pan_number && (
                                   <div>
                                       <span className="text-[9px] font-bold text-gray-400 uppercase block">PAN</span>
                                       <span className="text-xs font-mono font-bold text-gray-700">{viewBill.pan_number}</span>
                                   </div>
                               )}
                               {viewBill.aadhar_number && (
                                   <div>
                                       <span className="text-[9px] font-bold text-gray-400 uppercase block">AADHAR</span>
                                       <span className="text-xs font-mono font-bold text-gray-700">{viewBill.aadhar_number}</span>
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
                                        {viewBill.vehicle_number || 'Pending'}
                                    </span>
                                </div>
                                {viewBill.driver_name && (
                                    <div className="flex justify-between items-start text-sm pt-2">
                                        <span className="text-gray-500 font-medium">Driver</span>
                                        <div className="text-right">
                                            <span className="font-bold text-gray-900 block">{viewBill.driver_name}</span>
                                            {viewBill.driver_contact && (
                                                <span className="text-xs text-sky-600 font-medium flex items-center justify-end gap-1 mt-0.5">
                                                    <Phone size={10}/> {viewBill.driver_contact}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                           </div>
                      </div>

                      {/* Item List */}
                      <div>
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                              <Package size={12}/> Bill Items & Amount
                          </h4>
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
                                          <td className="p-3 text-right font-black text-gray-900 text-base">{viewBill.total_qty}</td>
                                          <td className="p-3"></td>
                                          <td className="p-3 text-right font-black text-gray-900 text-lg flex items-center justify-end gap-0.5">
                                              <IndianRupee size={12}/> 
                                              {viewBill.total_amount ? viewBill.total_amount.toFixed(0) : '0'}
                                          </td>
                                      </tr>
                                  </tbody>
                              </table>
                          </div>
                      </div>

                      {/* Remark */}
                      {viewBill.remark && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                              <label className="block text-[10px] font-bold text-slate-400">REMARK</label>
                              <div className="text-xs text-gray-600 italic">{getCleanRemark(viewBill.remark)}</div>
                          </div>
                      )}

                      {/* Edited By Badge */}
                      {getEditorName(viewBill.remark) && (
                          <div className="flex items-center gap-2 bg-yellow-50 p-3 rounded-xl border border-yellow-100 mt-2">
                              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                                  <Edit2 size={16} />
                              </div>
                              <div>
                                  <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-wide">Last Updated By</div>
                                  <div className="font-bold text-yellow-800 text-sm">{getEditorName(viewBill.remark)}</div>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-5 bg-white border-t border-gray-100 flex gap-3">
                      <button onClick={() => setViewBill(null)} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition">
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

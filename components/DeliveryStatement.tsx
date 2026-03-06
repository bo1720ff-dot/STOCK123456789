import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Calendar, Printer, Search, ArrowLeft, Truck, FileDown } from 'lucide-react';
import { billService, vehicleService } from '../services/supabase';
import { Bill, BillType, Vehicle } from '../types';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface DeliveryStatementProps {
  onBack?: () => void;
}

export const DeliveryStatement: React.FC<DeliveryStatementProps> = ({ onBack }) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    fetchBills();
  }, [startDate, endDate]);

  const fetchVehicles = async () => {
    try {
      const data = await vehicleService.getAll();
      setVehicles(data);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const fetchBills = async () => {
    setLoading(true);
    try {
      const data = await billService.getDeepBillsByDateRange(startDate, endDate);
      // Show all bill types (ORDER, DISPATCH, SMALL)
      setBills(data);
    } catch (error) {
      console.error("Error fetching bills:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!printRef.current) return;
    
    // Clone the element to modify it for PDF generation without affecting the UI
    const element = printRef.current.cloneNode(true) as HTMLElement;
    
    // Ensure the cloned element is visible and has white background
    element.style.display = 'block';
    element.style.background = 'white';
    element.style.padding = '5px'; // Minimal padding
    element.style.width = '100%';
    element.style.fontSize = '8px'; // Very small base font size

    // Reduce header size
    const headers = element.querySelectorAll('h1');
    headers.forEach(h => {
        (h as HTMLElement).style.fontSize = '12px';
        (h as HTMLElement).style.marginBottom = '4px';
    });

    // Reduce print header container spacing
    const printHeader = element.querySelector('.print-header');
    if (printHeader) {
        (printHeader as HTMLElement).style.marginBottom = '5px';
        (printHeader as HTMLElement).style.paddingBottom = '5px';
    }

    // Reduce period/vehicle text
    const headerTexts = element.querySelectorAll('.print-header p');
    headerTexts.forEach(p => {
        (p as HTMLElement).style.fontSize = '8px';
        (p as HTMLElement).style.marginBottom = '0';
    });

    // Reduce table cell padding and font size
    const cells = element.querySelectorAll('td, th');
    cells.forEach((cell) => {
        (cell as HTMLElement).style.padding = '2px 1px'; // Very tight padding
        (cell as HTMLElement).style.fontSize = '7px'; // Tiny font for bulk data
        (cell as HTMLElement).style.lineHeight = '1.1'; // Tight line height
    });
    
    // Remove the "hidden print:block" class from the footer so it shows in PDF
    const footer = element.querySelector('.print\\:block');
    if (footer) {
      footer.classList.remove('hidden');
      footer.classList.add('block');
      (footer as HTMLElement).style.marginTop = '10px';
      (footer as HTMLElement).style.paddingTop = '5px';
    }

    const opt = {
      margin: [5, 5, 5, 5], // Minimal margins
      filename: `delivery-statement-${startDate}-to-${endDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  // Filter bills based on selected vehicle
  const filteredBills = selectedVehicle 
    ? bills.filter(b => b.vehicle_number === selectedVehicle)
    : bills;

  const safeFormat = (dateStr: string | undefined | null, fmt: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return format(date, fmt);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header - Hidden in Print */}
      <div className="bg-white border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition">
              <ArrowLeft size={20} className="text-slate-500" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">Delivery Statement</h1>
            <p className="text-xs text-slate-500 font-bold">Daily Delivery Report</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Vehicle Filter */}
          <div className="relative">
            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="pl-10 pr-8 py-2 bg-slate-100 border-none rounded-xl font-bold text-sm text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none appearance-none min-w-[180px]"
            >
              <option value="">All Vehicles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.vehicle_number}>{v.vehicle_number}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
            <div className="relative">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-3 pr-2 py-1 bg-transparent border-none font-bold text-sm text-slate-700 focus:ring-0 outline-none w-32"
              />
            </div>
            <span className="text-slate-400 font-bold text-xs">TO</span>
            <div className="relative">
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-2 pr-3 py-1 bg-transparent border-none font-bold text-sm text-slate-700 focus:ring-0 outline-none w-32"
              />
            </div>
          </div>
          
          <button 
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition shadow-lg shadow-emerald-200"
          >
            <FileDown size={18} />
            <span>PDF</span>
          </button>

          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl font-bold text-sm hover:bg-sky-700 transition shadow-lg shadow-sky-200"
          >
            <Printer size={18} />
            <span>PRINT</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div ref={printRef} className="max-w-4xl mx-auto bg-white shadow-sm rounded-none md:rounded-2xl p-8 min-h-[500px] print:shadow-none print:p-0">
          
          {/* Print Header */}
          <div className="print-header text-center mb-8 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black uppercase tracking-wider mb-1">Delivery Statement</h1>
            <div className="flex justify-between items-end mt-4 px-4">
                <div className="text-left">
                  <p className="font-bold text-sm text-gray-500 uppercase">Period</p>
                  <p className="font-bold text-lg">
                    {safeFormat(startDate, 'dd MMM yyyy')} - {safeFormat(endDate, 'dd MMM yyyy')}
                  </p>
                </div>
                {selectedVehicle && (
                    <p className="font-bold text-lg border border-black px-3 py-1 rounded">Vehicle: {selectedVehicle}</p>
                )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 font-bold animate-pulse">Loading data...</div>
          ) : filteredBills.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-bold">No deliveries found for this selection.</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-2 text-left font-black text-sm uppercase w-12">No.</th>
                  <th className="py-2 text-left font-black text-sm uppercase w-24">Date</th>
                  <th className="py-2 text-left font-black text-sm uppercase w-28">Bill No</th>
                  <th className="py-2 text-left font-black text-sm uppercase w-20">Type</th>
                  <th className="py-2 text-left font-black text-sm uppercase">Party Name</th>
                  <th className="py-2 text-left font-black text-sm uppercase">Location</th>
                  <th className="py-2 text-right font-black text-sm uppercase w-24">Total Qty</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill, index) => (
                  <tr key={bill.id} className="border-b border-gray-300">
                    <td className="py-3 text-sm font-bold text-gray-800">{index + 1}</td>
                    <td className="py-3 text-sm font-bold text-gray-800">{safeFormat(bill.bill_date, 'dd/MM')}</td>
                    <td className="py-3 text-sm font-black text-gray-900 font-mono">{bill.bill_no}</td>
                    <td className="py-3 text-xs font-bold text-gray-500 uppercase">{bill.bill_type}</td>
                    <td className="py-3 text-sm font-bold text-gray-800">{bill.customer_name || 'Unknown Party'}</td>
                    <td className="py-3 text-sm font-medium text-gray-600">{bill.customer_address || '-'}</td>
                    <td className="py-3 text-sm font-bold text-gray-900 text-right">{bill.total_qty}</td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="border-t-2 border-black">
                  <td colSpan={6} className="py-3 text-right font-black text-sm uppercase pr-4">Grand Total:</td>
                  <td className="py-3 text-right font-black text-lg">{filteredBills.reduce((sum, b) => sum + Number(b.total_qty), 0)}</td>
                </tr>
              </tbody>
            </table>
          )}
          
          {/* Print Footer */}
          <div className="hidden print:block mt-12 pt-8 border-t border-gray-300">
            <div className="flex justify-between text-xs font-bold text-gray-500">
              <span>Printed: {new Date().toLocaleString()}</span>
              <span>Signature: ____________________</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

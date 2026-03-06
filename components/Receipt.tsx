
import React, { forwardRef, useMemo } from 'react';
import { Bill, BillItem, BillType, Product } from '../types';

interface ReceiptProps {
  bill: Bill | null;
  items: BillItem[];
  products?: Product[]; // New Prop to lookup weights
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ bill, items, products }, ref) => {
  if (!bill) return null;

  const isSmall = bill.bill_type === BillType.SMALL;
  // Orders are printed as Dispatch Bills (Qty Only) UNLESS they have prices set
  const isDispatchOrOrder = bill.bill_type === BillType.DISPATCH || bill.bill_type === BillType.ORDER;

  const customerName = bill.customer_name || 'CASH';
  const totalAmount = bill.total_amount || 0;
  
  // Decide whether to show price columns: 
  // Show if it is a SMALL bill OR if the order has a calculated total amount > 0
  const showPrices = isSmall || (totalAmount > 0);

  // Format Date
  const dateObj = new Date(bill.bill_date);
  const formattedDate = !isNaN(dateObj.getTime()) 
    ? `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth()+1).padStart(2, '0')}-${dateObj.getFullYear()}`
    : bill.bill_date;
    
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  // WEIGHT CALCULATION
  const totalWeight = useMemo(() => {
      if (!products) return 0;
      
      return items.reduce((sum, item) => {
          // Normalize names for comparison (case insensitive, trim)
          const matchedProduct = products.find(p => p.product_name.trim().toLowerCase() === item.product_name.trim().toLowerCase());
          const unitWeight = matchedProduct?.weight || 0;
          return sum + (item.qty * unitWeight);
      }, 0);
  }, [items, products]);

  const weightDisplay = useMemo(() => {
      if (totalWeight <= 0) return null;
      
      const tons = Math.floor(totalWeight / 1000);
      const kgs = (totalWeight % 1000);
      
      // Matches PDF Format: "7 Metric Ton 492 KG"
      if (tons > 0) {
          return `${tons} Metric Ton ${kgs.toFixed(0)} KG`; // Using fixed 0 for cleaner look if it's just integer
      }
      return `${kgs.toFixed(2)} KG`;
  }, [totalWeight]);

  // QR Code Logic 
  const qrCodeDataUrl = useMemo(() => {
    // @ts-ignore
    if (typeof window === 'undefined' || !window.QRious) return null;

    try {
        let qrData = '';
        
        // Logic: Default to TRACKING (Invoice No) unless explicit PAYMENT
        const type = bill.qrCodeType || 'TRACKING';

        if (isSmall) {
            if (type === 'PAYMENT' && totalAmount > 0) {
                // UPI QR for Payment
                const upiId = (bill.payment_upi || '9874682388@ibl').trim();
                const params = new URLSearchParams();
                params.append('pa', upiId); // Payee Address
                params.append('pn', 'Greenzar Food'); // Payee Name
                params.append('am', totalAmount.toFixed(2)); // Amount (Fixed 2 decimals)
                params.append('cu', 'INR'); // Currency
                
                qrData = `upi://pay?${params.toString()}`;
            } else {
                // Default Invoice Value (Tracking)
                qrData = bill.bill_no;
            }
        } else if (isDispatchOrOrder) {
            // Bill Number QR for Status Tracking
            qrData = bill.bill_no;
        } else {
            return null;
        }
        
        if (!qrData) return null;

        // @ts-ignore
        const qr = new window.QRious({
          value: qrData,
          size: 250, // Higher resolution for bigger image
          level: 'M'
        });
        return qr.toDataURL();
    } catch (e) {
        console.error("QR Generation failed", e);
        return null;
    }
  }, [bill?.payment_upi, totalAmount, isSmall, isDispatchOrOrder, bill?.bill_no, bill?.qrCodeType]);

  const qrCaption = useMemo(() => {
      if (isSmall) {
          if (bill.qrCodeType === 'PAYMENT') return 'Scan & Pay';
          return 'Track Invoice';
      }
      return 'Scan to Track';
  }, [isSmall, bill?.qrCodeType]);

  return (
    <div ref={ref} className="bg-white text-black font-sans text-xs w-full print:w-full leading-tight">
      {/* ZERO PADDING for corner-to-corner 72mm fit */}
      <div className="px-0 py-0">
          {/* Header */}
          <div className="text-center mb-1">
            <h1 className="text-lg font-bold uppercase tracking-tight text-black scale-y-110">GREENZAR FOOD & BEVERAGE</h1>
            <p className="text-[10px] mt-1 font-bold text-black">Jhampa, Deganga, North 24 PGS, PIN.-743423</p>
          </div>

          {/* Bill Type - Centered */}
          <div className="text-center font-bold text-sm uppercase text-black my-1 border-b border-black pb-1">
            {isSmall ? 'MEMO BILL' : 'DISPATCH NOTE'}
          </div>

          {/* Bill Info */}
          <div className="flex justify-between font-bold text-[10px] uppercase text-black mb-1 mt-1">
            <div className="flex gap-1 items-end">
               <span>No.</span>
               <span className="text-xs leading-none">{bill.bill_no}</span>
            </div>
            <div className="text-right whitespace-nowrap">
                {formattedDate} {time}
            </div>
          </div>

          {/* Customer Info Section (SIMPLE LINES) */}
          <div className="font-bold text-[10px] uppercase mb-1 border-b border-black pb-1 text-black space-y-0.5">
            <div className="flex gap-1 w-full">
               <span className="w-10">NAME:</span>
               <span className="truncate flex-1">{customerName}</span>
            </div>
            {bill.customer_address && (
              <div className="flex gap-1 w-full">
                 <span className="w-10">ADDR:</span>
                 <span className="truncate flex-1">{bill.customer_address}</span>
              </div>
            )}
            {/* Salesman Info */}
            {bill.salesman_name && (
                <div className="flex gap-1 w-full">
                    <span className="w-10">SALES:</span>
                    <span className="truncate flex-1">{bill.salesman_name}</span>
                </div>
            )}
            
            {/* Salesman Specific Fields */}
            {bill.phone_number && (
              <div className="flex gap-1 w-full">
                 <span className="w-10">PH:</span>
                 <span>{bill.phone_number}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
                {bill.gst_number && <div>GST: {bill.gst_number}</div>}
                {bill.pan_number && <div>PAN: {bill.pan_number}</div>}
            </div>
             {bill.vehicle_number && (
              <div className="flex gap-1 w-full">
                 <span className="w-10">VEH:</span>
                 <span>{bill.vehicle_number}</span>
              </div>
            )}
            {/* Driver Details */}
            {bill.driver_name && (
              <div className="flex gap-1 w-full mt-1 pt-1 border-t border-black">
                 <span className="w-10">DRIVER:</span>
                 <span>{bill.driver_name}</span>
              </div>
            )}
            {bill.driver_contact && (
              <div className="flex gap-1 w-full">
                 <span className="w-10">CONT:</span>
                 <span>{bill.driver_contact}</span>
              </div>
            )}
          </div>

          {/* Table Header (SIMPLE LINE) */}
          <div className="flex font-bold text-[10px] border-b border-black pb-1 mb-1 text-black">
            <div className="flex-1">Item</div>
            <div className="w-6 text-right">Qty</div>
            {/* Conditional Columns */}
            {showPrices && <div className="w-8 text-right">Price</div>}
            {showPrices && <div className="w-10 text-right">Total</div>}
          </div>

          {/* Items */}
          <div className="mb-1">
            {items.map((item, idx) => (
              <div key={idx} className="flex flex-col text-[10px] mb-1 font-bold text-black border-b border-dotted border-black pb-1 last:border-0">
                <div className="flex justify-between">
                    <div className="flex-1 truncate pr-1">{item.product_name}</div>
                    <div className="w-6 text-right">{item.qty}</div>
                    {/* Hide Rate/Total for Dispatch/Order UNLESS they exist */}
                    {showPrices && <div className="w-8 text-right">{item.rate || '-'}</div>}
                    {showPrices && <div className="w-10 text-right">{item.line_total?.toFixed(2) || '-'}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Totals (SIMPLE LINES) */}
          <div className="border-t border-black pt-1 pb-1 flex justify-between font-bold text-xs uppercase border-b border-black mb-1 text-black">
            <div>Gross Qty:- {bill.total_qty}</div>
            <div>Total- ₹ {showPrices ? (bill.total_amount || 0).toFixed(2) : '-'}</div>
          </div>

          {/* WEIGHT ROW (New) */}
          {isDispatchOrOrder && weightDisplay && (
              <div className="font-black text-[10px] text-center uppercase border-b border-black pb-1 mb-2 text-black">
                  Total Weight: {weightDisplay}
              </div>
          )}

          {/* Remark */}
          {bill.remark && (
            <div className="mb-2 text-[10px] font-bold text-black border-b border-black pb-1">
                NOTE: {bill.remark}
            </div>
          )}

          {/* Bottom Section */}
          <div className="flex gap-2 items-center mt-2 flex-col">
             <div className="flex flex-col items-center">
               {/* QR Code */}
               {qrCodeDataUrl ? (
                 <>
                   <img 
                     src={qrCodeDataUrl} 
                     alt="QR" 
                     className="w-28 h-28 border-2 border-black block" 
                   />
                   <span className="text-[9px] font-bold mt-1 text-black uppercase">
                      {qrCaption}
                   </span>
                   {showPrices && bill.qrCodeType === 'PAYMENT' && <span className="text-[10px] font-bold text-black">₹{totalAmount.toFixed(0)}</span>}
                 </>
               ) : (
                  <div className="w-28 h-28 border border-gray-100 flex items-center justify-center text-[8px] text-gray-300">
                    No QR
                  </div>
               )}
             </div>
             <div className="w-full text-[9px] font-bold leading-tight pt-2 text-black text-center">
                For any query, contact our Helpline Number-<br/>
                <span className="text-xs">9476156298</span>
             </div>
          </div>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';

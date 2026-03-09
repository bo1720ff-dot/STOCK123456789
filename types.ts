
export enum BillType {
  SMALL = 'SMALL',
  DISPATCH = 'DISPATCH',
  ORDER = 'ORDER'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  SALESMAN = 'SALESMAN',
  EMPLOYEE = 'EMPLOYEE',
  DRIVER = 'DRIVER'
}

export type OrderStatus = 'PENDING' | 'LOADING' | 'OUT_FOR_DELIVERY' | 'RECEIVED' | 'DELIVERED' | 'APPROVED' | 'CANCELLED';

// Force rebuild
export interface User {
  id?: string;
  username: string;
  role: UserRole;
  name: string;
  password?: string; 
}

export interface Product {
  id: string;
  product_name: string;
  unit: string;
  rate: number;
  weight?: number; // Weight per Case/Unit in KG
  image_url?: string; // Product Image
}

export interface Party {
  id: string;
  party_name: string;
}

export interface SavedAddress {
  id: string;
  address_line: string;
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  driver_name?: string;
  driver_contact?: string;
}

export interface Customer {
  id: string;
  customer_name: string;
  customer_address?: string;
  vehicle_number?: string;
}

export interface BillItem {
  id?: string;
  bill_id?: string;
  product_name: string;
  qty: number;
  rate: number | null; 
  line_total: number | null; 
}

export interface Bill {
  id: string;
  bill_no: string;
  bill_type: BillType;
  total_qty: number;
  total_amount: number | null; 
  total_weight?: number; // NEW: Persisted Total Weight
  bill_date: string;
  customer_name?: string;
  customer_address?: string;
  vehicle_number?: string;
  payment_upi?: string;
  driver_name?: string;
  driver_contact?: string;
  salesman_name?: string; 
  gst_number?: string;
  pan_number?: string;
  aadhar_number?: string;
  phone_number?: string;
  remark?: string;
  status?: OrderStatus;
  qrCodeType?: 'PAYMENT' | 'TRACKING';
  created_at?: string;
  items?: BillItem[]; 
}

export interface DailySummary {
  totalBills: number;
  totalQty: number;
  totalAmount: number;
  smallBillCount: number;
  dispatchBillCount: number;
  orderCount: number;
}

export interface SalesDashboardStats {
  todayCount: number;
  pendingCount: number;
  deliveryCount: number;
  doneCount: number;
}

export interface StockEntry {
  id?: string;
  date: string;
  product_id: string;
  product_name?: string; 
  opening_stock: number;
  day_production: number;
  night_production: number;
  stock_out?: number; 
  closing_stock?: number; 
  remark: string;
}

export interface ProductionLog {
  id: string;
  date: string;
  time: string;
  product_id: string;
  product_name: string;
  qty: number;
  shift: 'Day' | 'Night';
  user_name?: string;
  status?: 'PENDING' | 'APPROVED' | 'DECLINED';
  created_at?: string;
}

export interface DailyReportEntry {
  id?: string;
  date: string;
  product_name: string;
  opening_stock: number;
  production_day: number;
  production_night: number;
  stock_in: number;
  stock_out: number;
  closing_stock: number;
  remarks: string;
  created_at?: string;
}

export interface ActivityLog {
  id: string;
  entity_type: 'ORDER' | 'STOCK' | 'SYSTEM' | 'USER';
  entity_id: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  description: string;
  details?: string;
  performed_by?: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  sender_id?: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// === NEW PRODUCTION MODULE TYPES ===

export type ProdShift = 'DAY' | 'NIGHT' | 'EXTRA';

export interface ProdDashboardRow {
  product_id: string;
  product_name: string;
  date: string;
  opening: number;
  day_production: number;
  night_production: number;
  extra_production: number;
  total_production: number;
  stock_out: number;
  adjustment: number;
  closing_stock: number;
  is_locked: boolean;
}

export interface ProdShiftProduction {
  id?: string;
  product_id: string;
  date: string;
  shift: ProdShift;
  qty: number;
  operator_name: string;
}

export interface ProdStockOut {
  id?: string;
  product_id: string;
  date: string;
  qty: number;
  out_type: 'dispatch' | 'small_bill' | 'damage';
  reference_no: string;
}

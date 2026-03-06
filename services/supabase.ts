
// ... existing imports
import { createClient } from '@supabase/supabase-js';
import { 
  Bill, BillItem, DailySummary, OrderStatus, Product, StockEntry, 
  User, UserRole, Party, SavedAddress, Vehicle, Customer, 
  ProductionLog, SalesDashboardStats, DailyReportEntry, ActivityLog,
  ProdDashboardRow, ProdShift, ProdShiftProduction, ProdStockOut,
  BillType
} from '../types';

/* 
  === SUPABASE DATABASE SETUP ===
  The SQL script to create all tables is located in the file: schema.sql
*/

const getGlobal = () => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof self !== 'undefined') return self;
  if (typeof window !== 'undefined') return window;
  // @ts-ignore
  if (typeof global !== 'undefined') return global;
  return {};
};

const getEnv = (key: string) => {
  const g = getGlobal() as any;
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        if(import.meta.env[key]) return import.meta.env[key];
        // @ts-ignore
        if(import.meta.env[`VITE_${key}`]) return import.meta.env[`VITE_${key}`];
    }
  } catch (e) {}

  try {
    if (g.process && g.process.env) {
        if(g.process.env[key]) return g.process.env[key];
        if(g.process.env[`VITE_${key}`]) return g.process.env[`VITE_${key}`];
    }
  } catch (e) {}
  
  return undefined;
};

const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try { return crypto.randomUUID(); } catch (e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// UPDATED CREDENTIALS
const SUPABASE_URL = getEnv('REACT_APP_SUPABASE_URL') || getEnv('SUPABASE_URL') || 'https://itbuninkgjxdauguompy.supabase.co';
const SUPABASE_KEY = getEnv('REACT_APP_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0YnVuaW5rZ2p4ZGF1Z3VvbXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTM5MTAsImV4cCI6MjA4NzEyOTkxMH0.LUskFPQrhryGGXRuWipz3Ju-BKEH7im0zgJ0daFWI6g';

let isMock = !SUPABASE_URL || !SUPABASE_KEY;
let supabase: any = null;

try {
    if (!isMock) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.error("Supabase Init Failed:", e);
    isMock = true;
    supabase = null;
}

// ... (Mock Data Variables kept same for brevity) ...
let mockUsers: User[] = [
    { id: '2c15a304-7b6a-4cd4-b1bb-11ea87c44831', username: 'debashis', password: '98200', name: 'Debashis Saha', role: UserRole.SALESMAN },
    { id: 'driver-1', username: 'raju', password: '123', name: 'Raju Driver', role: UserRole.DRIVER },
    // ... existing mocks ...
];
let mockProducts: Product[] = [{ id: '1', product_name: 'Green Apple', unit: 'kg', rate: 120, weight: 1, image_url: 'https://via.placeholder.com/150' }];
let mockParties: Party[] = [];
let mockAddresses: SavedAddress[] = [];
let mockVehicles: Vehicle[] = [
    { id: 'v1', vehicle_number: 'WB-01-1234', driver_name: 'Raju Driver', driver_contact: '9876543210' }
];
let mockCustomers: Customer[] = [];
let mockBills: Bill[] = [];
let mockItems: BillItem[] = [];
let mockSettings: Record<string, string> = { 'production_enabled': 'true' };
let mockProductionStatus = true;
let mockOrderConfigStatus = true;
let mockProductionLogs: ProductionLog[] = [];
let mockActivityLogs: ActivityLog[] = [];

// --- SERVICES ---

export const settingsService = {
    get: async (key: string): Promise<string | null> => {
        if (isMock || !supabase) return Promise.resolve(mockSettings[key] || null);
        try {
            const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).single();
            if (error) return null;
            return data?.value || null;
        } catch(e) { return null; }
    },
    set: async (key: string, value: string): Promise<void> => {
        if (isMock || !supabase) {
            mockSettings[key] = value;
            return Promise.resolve();
        }
        const { error } = await supabase.from('app_settings').upsert({ key: key, value: value }, { onConflict: 'key' });
        if (error) throw error;
    }
};

export const systemService = {
    getStatus: async (): Promise<{isOpen: boolean, message: string}> => {
        if (isMock || !supabase) return { isOpen: true, message: '' };
        try {
            const { data: statusData } = await supabase.from('app_settings').select('value').eq('key', 'system_status').single();
            const { data: msgData } = await supabase.from('app_settings').select('value').eq('key', 'system_message').single();
            
            // Default to OPEN if no setting exists
            const isOpen = statusData?.value !== 'CLOSED'; 
            const message = msgData?.value || 'System maintenance in progress.';
            
            return { isOpen, message };
        } catch (e) {
            return { isOpen: true, message: '' };
        }
    },
    setStatus: async (isOpen: boolean, message: string) => {
        if (isMock || !supabase) return;
        await supabase.from('app_settings').upsert({ key: 'system_status', value: isOpen ? 'OPEN' : 'CLOSED' }, { onConflict: 'key' });
        await supabase.from('app_settings').upsert({ key: 'system_message', value: message }, { onConflict: 'key' });
    }
};

export const productionConfigService = {
  get: async (): Promise<boolean> => {
    if (isMock || !supabase) return Promise.resolve(mockProductionStatus);
    try {
        const { data, error } = await supabase.from('production_config').select('is_active').eq('id', 1).single();
        if (error || !data) return true;
        return data.is_active;
    } catch(e) { return true; }
  },
  set: async (isActive: boolean): Promise<void> => {
    if (isMock || !supabase) {
        mockProductionStatus = isActive;
        return Promise.resolve();
    }
    const { error } = await supabase.from('production_config').upsert({ id: 1, is_active: isActive });
    if (error) throw error;
  }
};

export const orderConfigService = {
  get: async (): Promise<boolean> => {
    if (isMock || !supabase) return Promise.resolve(mockOrderConfigStatus);
    try {
        const { data, error } = await supabase.from('order_config').select('is_active').eq('id', 1).single();
        if (error || !data) return true; 
        return data.is_active;
    } catch(e) { return true; }
  },
  set: async (isActive: boolean): Promise<void> => {
    if (isMock || !supabase) {
        mockOrderConfigStatus = isActive;
        return Promise.resolve();
    }
    const { error } = await supabase.from('order_config').upsert({ id: 1, is_active: isActive });
    if (error) throw error;
  }
};

export const userService = {
    authenticate: async (username: string, password: string): Promise<User | null> => {
        // 1. Check for Driver Login (Vehicle Number + 6211)
        if (password === '6211') {
             if (isMock || !supabase) {
                 const vehicle = mockVehicles.find(v => v.vehicle_number.toUpperCase() === username.toUpperCase());
                 if (vehicle) {
                     return {
                         id: vehicle.id,
                         username: vehicle.vehicle_number,
                         name: vehicle.driver_name || vehicle.vehicle_number,
                         role: UserRole.DRIVER,
                         password: '6211'
                     };
                 }
             } else {
                 const { data: vehicle, error } = await supabase.from('vehicles').select('*').eq('vehicle_number', username.toUpperCase()).single();
                 if (vehicle && !error) {
                     return {
                         id: vehicle.id,
                         username: vehicle.vehicle_number,
                         name: vehicle.driver_name || vehicle.vehicle_number,
                         role: UserRole.DRIVER,
                         password: '6211'
                     };
                 }
             }
        }

        // 2. Normal User Login
        if (isMock || !supabase) {
            const user = mockUsers.find(u => u.username.toLowerCase() && u.username.toLowerCase() === username.toLowerCase() && u.password === password);
            return user ? Promise.resolve(user) : Promise.resolve(null);
        }
        const { data, error } = await supabase.from('app_users').select('*').eq('username', username).eq('password', password).single();
        if (error || !data) return null;
        return data as User;
    },
    getAll: async (): Promise<User[]> => {
        if (isMock || !supabase) return Promise.resolve(mockUsers);
        const { data, error } = await supabase.from('app_users').select('*').order('name');
        if (error) throw error;
        return data || [];
    },
    add: async (user: Omit<User, 'id'>): Promise<User> => {
        if (isMock || !supabase) {
            const newUser = { ...user, id: generateUUID() };
            mockUsers.push(newUser);
            return Promise.resolve(newUser);
        }
        const { data, error } = await supabase.from('app_users').insert([user]).select().single();
        if (error) throw error;
        return data;
    },
    delete: async (id: string): Promise<void> => {
        if (isMock || !supabase) {
            mockUsers = mockUsers.filter(u => u.id !== id);
            return Promise.resolve();
        }
        const { error } = await supabase.from('app_users').delete().eq('id', id);
        if (error) throw error;
    },
    importBulk: async (users: any[]): Promise<void> => {
        if (isMock || !supabase) return;
        const cleanData = users.map(u => ({
            id: u.id || undefined,
            username: u.username,
            password: u.password,
            name: u.name,
            role: u.role,
            created_at: u.created_at
        }));
        const { error } = await supabase.from('app_users').upsert(cleanData, { onConflict: 'id' });
        if(error) throw error;
    }
};

export const productService = {
  getAll: async (): Promise<Product[]> => {
    if (isMock || !supabase) return Promise.resolve(mockProducts);
    const { data, error } = await supabase.from('products').select('*').order('product_name');
    if (error) throw error;
    return data || [];
  },
  add: async (product: Omit<Product, 'id'>): Promise<Product> => {
    if (isMock || !supabase) {
      const newProduct = { ...product, id: generateUUID() };
      mockProducts.push(newProduct);
      return Promise.resolve(newProduct);
    }
    const { product_name, unit, rate, weight, image_url } = product;
    const { data, error } = await supabase.from('products').insert([{ 
        product_name, 
        unit, 
        rate, 
        weight: weight || 0,
        image_url 
    }]).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id: string, updates: Partial<Product>): Promise<Product> => {
    if (isMock || !supabase) { return Promise.resolve(mockProducts[0]); }
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id: string): Promise<void> => {
    if (isMock || !supabase) { mockProducts = mockProducts.filter(p => p.id !== id); return Promise.resolve(); }
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },
  importBulk: async (products: any[]): Promise<void> => {
      if (isMock || !supabase) return;
      const cleanData = products.map(p => ({
          id: p.id || undefined,
          product_name: p.product_name,
          unit: p.unit,
          rate: Number(p.rate),
          weight: Number(p.weight),
          image_url: p.image_url
      }));
      const { error } = await supabase.from('products').upsert(cleanData, { onConflict: 'id' });
      if(error) throw error;
  }
};

export const partyService = {
  getAll: async (): Promise<Party[]> => {
    if (isMock || !supabase) return Promise.resolve(mockParties);
    const { data, error } = await supabase.from('parties').select('*').order('party_name');
    if (error) throw error;
    return data || [];
  },
  add: async (party: Omit<Party, 'id'>): Promise<Party> => {
    if (isMock || !supabase) { return Promise.resolve({ ...party, id: '1' }); }
    const { data, error } = await supabase.from('parties').insert([party]).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id: string): Promise<void> => {
    if (isMock || !supabase) return Promise.resolve();
    const { error } = await supabase.from('parties').delete().eq('id', id);
    if (error) throw error;
  },
  importBulk: async (parties: any[]): Promise<void> => {
      if (isMock || !supabase) return;
      const cleanData = parties.map(p => ({
          id: p.id || undefined,
          party_name: p.party_name
      }));
      const { error } = await supabase.from('parties').upsert(cleanData, { onConflict: 'id' });
      if(error) throw error;
  }
};

export const addressService = {
  getAll: async (): Promise<SavedAddress[]> => {
    if (isMock || !supabase) return Promise.resolve(mockAddresses);
    const { data, error } = await supabase.from('addresses').select('*').order('address_line');
    if (error) throw error;
    return data || [];
  },
  add: async (address: Omit<SavedAddress, 'id'>): Promise<SavedAddress> => {
    if (isMock || !supabase) { return Promise.resolve({ ...address, id: '1' }); }
    const { data, error } = await supabase.from('addresses').insert([address]).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id: string): Promise<void> => {
    if (isMock || !supabase) return Promise.resolve();
    const { error } = await supabase.from('addresses').delete().eq('id', id);
    if (error) throw error;
  },
  importBulk: async (addresses: any[]): Promise<void> => {
      if (isMock || !supabase) return;
      const cleanData = addresses.map(a => ({
          id: a.id || undefined,
          address_line: a.address_line
      }));
      const { error } = await supabase.from('addresses').upsert(cleanData, { onConflict: 'id' });
      if(error) throw error;
  }
};

export const vehicleService = {
  getAll: async (): Promise<Vehicle[]> => {
    if (isMock || !supabase) return Promise.resolve(mockVehicles);
    const { data, error } = await supabase.from('vehicles').select('*').order('vehicle_number');
    if (error) throw error;
    return data || [];
  },
  add: async (vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> => {
    if (isMock || !supabase) { return Promise.resolve({ ...vehicle, id: '1' }); }
    const { data, error } = await supabase.from('vehicles').insert([vehicle]).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id: string): Promise<void> => {
      if(isMock || !supabase) return Promise.resolve();
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if(error) throw error;
  },
  importBulk: async (vehicles: any[]): Promise<void> => {
      if (isMock || !supabase) return;
      const cleanData = vehicles.map(v => ({
          id: v.id || undefined,
          vehicle_number: v.vehicle_number,
          driver_name: v.driver_name,
          driver_contact: v.driver_contact
      }));
      const { error } = await supabase.from('vehicles').upsert(cleanData, { onConflict: 'id' });
      if(error) throw error;
  }
};

export const customerService = {
  getAll: async (): Promise<Customer[]> => {
    if (isMock || !supabase) return Promise.resolve(mockCustomers);
    const { data, error } = await supabase.from('customers').select('*').order('customer_name');
    if (error) throw error;
    return data || [];
  },
  add: async (customer: Omit<Customer, 'id'>): Promise<Customer> => {
    if (isMock || !supabase) { return Promise.resolve({ ...customer, id: '1' }); }
    const { data, error } = await supabase.from('customers').insert([customer]).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id: string): Promise<void> => {
    if (isMock || !supabase) return Promise.resolve();
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
  },
  importBulk: async (customers: any[]): Promise<void> => {
      if (isMock || !supabase) return;
      const cleanData = customers.map(c => ({
          id: c.id || undefined,
          customer_name: c.customer_name,
          customer_address: c.customer_address,
          vehicle_number: c.vehicle_number
      }));
      const { error } = await supabase.from('customers').upsert(cleanData, { onConflict: 'id' });
      if(error) throw error;
  }
};

export const billService = {
  getNextBillNumber: async (): Promise<string> => {
    let billNumbers: number[] = [];
    if (isMock || !supabase) {
        billNumbers = mockBills.map(b => parseInt(b.bill_no.replace(/\D/g, '')) || 0);
    } else {
        const { data, error } = await supabase.from('bills').select('bill_no');
        if (!error && data) {
            billNumbers = data.map((b: any) => {
                const numeric = parseInt(b.bill_no.replace(/\D/g, ''));
                return isNaN(numeric) ? 0 : numeric;
            });
        }
    }
    const validNums = billNumbers.filter(n => n >= 4100).sort((a, b) => a - b);
    if (validNums.length === 0) return "4100";
    let expected = 4100;
    for (const num of validNums) {
        if (num === expected) expected++;
        else if (num > expected) return String(expected);
    }
    return String(expected);
  },
  create: async (bill: Omit<Bill, 'id'>, items: BillItem[]): Promise<Bill> => {
    const status: OrderStatus = bill.bill_type === BillType.ORDER ? 'PENDING' : 'APPROVED';
    const { qrCodeType, ...billDbPayload } = bill as any;
    const billWithStatus = { ...billDbPayload, status: status };

    if (isMock || !supabase) {
      const newBill: Bill = { ...billWithStatus, id: generateUUID(), created_at: new Date().toISOString() };
      mockBills.push(newBill);
      items.forEach(item => mockItems.push({ ...item, id: generateUUID(), bill_id: newBill.id }));
      return Promise.resolve(newBill);
    }

    const { data: billData, error: billError } = await supabase.from('bills').insert([billWithStatus]).select().single();
    if (billError) throw billError;
    const itemsWithBillId = items.map(item => ({ ...item, bill_id: billData.id }));
    const { error: itemsError } = await supabase.from('bill_items').insert(itemsWithBillId);
    if (itemsError) throw itemsError;
    return { ...billData, qrCodeType: qrCodeType };
  },
  update: async (billId: string, updates: Partial<Bill>, newItems?: BillItem[]): Promise<Bill> => {
    if (isMock || !supabase) return Promise.resolve(mockBills[0]);
    const { data, error } = await supabase.from('bills').update(updates).eq('id', billId).select().single();
    if (error) throw error;
    if (newItems) {
        await supabase.from('bill_items').delete().eq('bill_id', billId);
        const itemsPayload = newItems.map(item => ({
            bill_id: billId,
            product_name: item.product_name,
            qty: item.qty,
            rate: item.rate,
            line_total: item.line_total
        }));
        const { error: itemError } = await supabase.from('bill_items').insert(itemsPayload);
        if (itemError) throw itemError;
    }
    return data;
  },
  updateStatusByBillNo: async (billNo: string, status: OrderStatus): Promise<Bill> => {
      const normalizedBillNo = billNo.trim().toUpperCase();
      if (isMock || !supabase) return Promise.resolve(mockBills[0]);
      const { data, error } = await supabase.from('bills').update({ status: status }).eq('bill_no', normalizedBillNo).select().single();
      if (error) throw error;
      return data;
  },
  cancelBill: async (billId: string): Promise<void> => {
      const suffix = Math.floor(1000 + Math.random() * 9000); 
      if (isMock || !supabase) return Promise.resolve();
      const { data: bill } = await supabase.from('bills').select('bill_no').eq('id', billId).single();
      const newBillNo = `DEL-${bill?.bill_no}-${suffix}`;
      const { error } = await supabase.from('bills').update({ status: 'CANCELLED', bill_no: newBillNo }).eq('id', billId);
      if (error) throw error;
  },
  deleteBill: async (billId: string): Promise<void> => {
      if (isMock || !supabase) return Promise.resolve();
      await supabase.from('bill_items').delete().eq('bill_id', billId);
      const { error } = await supabase.from('bills').delete().eq('id', billId);
      if (error) throw error;
  },
  getAll: async (): Promise<Bill[]> => {
    if (isMock || !supabase) return Promise.resolve(mockBills);
    const { data, error } = await supabase.from('bills').select('*').order('created_at', { ascending: false }).limit(500); // Added Limit
    if (error) throw error;
    return data || [];
  },
  getOpenOrders: async (): Promise<Bill[]> => {
      if (isMock || !supabase) return Promise.resolve(mockBills.filter(b => b.bill_type === BillType.ORDER && b.status !== 'DELIVERED' && b.status !== 'CANCELLED'));
      const { data, error } = await supabase.from('bills')
        .select('*')
        .eq('bill_type', BillType.ORDER)
        .in('status', ['PENDING', 'LOADING', 'OUT_FOR_DELIVERY', 'RECEIVED', 'APPROVED'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
  },
  getOrdersByDateRange: async (startDate: string, endDate: string): Promise<Bill[]> => {
      if (isMock || !supabase) return Promise.resolve([]);
      const { data, error } = await supabase.from('bills')
        .select('*')
        .eq('bill_type', BillType.ORDER)
        .gte('bill_date', startDate)
        .lte('bill_date', endDate)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
  },
  getRecent: async (limit: number): Promise<Bill[]> => {
    if (isMock || !supabase) return Promise.resolve(mockBills.slice(0,limit));
    const { data, error } = await supabase.from('bills').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  },
  getByBillNo: async (billNo: string): Promise<Bill | null> => {
      const normalized = billNo.trim().toUpperCase();
      if (isMock || !supabase) return Promise.resolve(mockBills.find(b => b.bill_no === normalized) || null);
      const { data: bill, error } = await supabase.from('bills').select('*').eq('bill_no', normalized).single();
      if (error || !bill) return null;
      const { data: items } = await supabase.from('bill_items').select('*').eq('bill_id', bill.id);
      return { ...bill, items: items || [] };
  },
  getDeepBillsByDate: async (date: string): Promise<Bill[]> => {
    if (isMock || !supabase) return Promise.resolve([]);
    const { data: bills, error: billError } = await supabase.from('bills').select('*').eq('bill_date', date).order('created_at', { ascending: false });
    if (billError) throw billError;
    if (!bills || bills.length === 0) return [];
    // Include RECEIVED in the valid bills list for Tickets
    const validBills = bills.filter(b => b.status !== 'PENDING' && b.status !== 'CANCELLED');
    if (validBills.length === 0) return [];
    const billIds = validBills.map(b => b.id);
    const { data: items, error: itemError } = await supabase.from('bill_items').select('*').in('bill_id', billIds);
    if (itemError) throw itemError;
    return validBills.map(b => ({ ...b, items: items?.filter(i => i.bill_id === b.id) || [] }));
  },
  getDeepBillsByDateRange: async (startDate: string, endDate: string): Promise<Bill[]> => {
    if (isMock || !supabase) return Promise.resolve([]);
    const { data: bills, error: billError } = await supabase.from('bills')
      .select('*')
      .gte('bill_date', startDate)
      .lte('bill_date', endDate)
      .order('bill_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (billError) throw billError;
    if (!bills || bills.length === 0) return [];
    
    const validBills = bills.filter(b => b.status !== 'PENDING' && b.status !== 'CANCELLED');
    if (validBills.length === 0) return [];
    
    const billIds = validBills.map(b => b.id);
    const { data: items, error: itemError } = await supabase.from('bill_items').select('*').in('bill_id', billIds);
    if (itemError) throw itemError;
    
    return validBills.map(b => ({ ...b, items: items?.filter(i => i.bill_id === b.id) || [] }));
  },
  getItemsByBillId: async (billId: string): Promise<BillItem[]> => {
    if (isMock || !supabase) return Promise.resolve(mockItems.filter(i => i.bill_id === billId));
    const { data, error } = await supabase.from('bill_items').select('*').eq('bill_id', billId);
    if (error) throw error;
    return data || [];
  },
  getTodaySummary: async (): Promise<DailySummary> => {
    const todayStr = new Date().toISOString().split('T')[0];
    let bills: Bill[] = [];
    if (isMock || !supabase) {
      bills = mockBills.filter(b => b.bill_date === todayStr);
    } else {
      const { data, error } = await supabase.from('bills').select('*').eq('bill_date', todayStr);
      if (error) throw error;
      bills = data || [];
    }
    return bills.reduce((acc, bill) => {
      acc.totalBills += 1;
      acc.totalQty += Number(bill.total_qty);
      if (bill.bill_type === BillType.SMALL) {
        acc.totalAmount += Number(bill.total_amount || 0);
        acc.smallBillCount += 1;
      } else if (bill.bill_type === BillType.DISPATCH) {
        acc.dispatchBillCount += 1;
      } else if (bill.bill_type === BillType.ORDER) {
        acc.orderCount += 1;
      }
      return acc;
    }, { totalBills: 0, totalQty: 0, totalAmount: 0, smallBillCount: 0, dispatchBillCount: 0, orderCount: 0 });
  },
  getSalesDashboardStats: async (salesmanName?: string): Promise<SalesDashboardStats> => {
      const todayStr = new Date().toISOString().split('T')[0];
      let todayBills: Bill[] = [];
      let allBills: Bill[] = [];
      if (isMock || !supabase) {
          allBills = mockBills.filter(b => b.bill_type === BillType.ORDER);
          if (salesmanName) { allBills = allBills.filter(b => b.salesman_name === salesmanName); }
          todayBills = allBills.filter(b => b.bill_date === todayStr);
      } else {
          let queryToday = supabase.from('bills').select('*').eq('bill_type', BillType.ORDER).eq('bill_date', todayStr);
          if (salesmanName) queryToday = queryToday.eq('salesman_name', salesmanName);
          const { data: today, error: err1 } = await queryToday;
          if (err1) throw err1;
          todayBills = today || [];
          let queryAll = supabase.from('bills').select('*').eq('bill_type', BillType.ORDER);
          if (salesmanName) queryAll = queryAll.eq('salesman_name', salesmanName);
          const { data: all, error: err2 } = await queryAll;
          if (err2) throw err2;
          allBills = all || [];
      }
      return {
          todayCount: todayBills.length,
          pendingCount: allBills.filter(b => b.status === 'PENDING' || !b.status).length,
          deliveryCount: allBills.filter(b => b.status === 'OUT_FOR_DELIVERY').length,
          doneCount: allBills.filter(b => b.status === 'DELIVERED').length
      };
  }
};

export const stockService = {
  getByDate: async (date: string): Promise<StockEntry[]> => {
    if (isMock || !supabase) return Promise.resolve([]);
    // Call the RPC function
    const { data, error } = await supabase.rpc('get_daily_stock_status', { target_date: date });
    if (error) {
        console.error("RPC Error:", error);
        return [];
    }
    return data || [];
  },
  getRange: async (startDate: string, endDate: string): Promise<StockEntry[]> => {
    if (isMock || !supabase) return Promise.resolve([]);
    
    // Fetch ALL transactions from ledger
    const { data, error } = await supabase.from('inventory_ledger')
        .select('date, product_id, transaction_type, qty, shift')
        .gte('date', startDate)
        .lte('date', endDate);

    if(error || !data) return [];

    // Aggregate Transactions for Reports
    const aggMap = new Map<string, StockEntry>();

    data.forEach((row: any) => {
        const key = `${row.date}_${row.product_id}`;
        if (!aggMap.has(key)) {
            aggMap.set(key, {
                date: row.date,
                product_id: row.product_id,
                opening_stock: 0,
                day_production: 0,
                night_production: 0,
                stock_out: 0,
                closing_stock: 0,
                remark: ''
            });
        }
        const entry = aggMap.get(key)!;
        const qty = Number(row.qty);
        const type = row.transaction_type;
        const shift = row.shift?.toUpperCase();

        if (type === 'PROD') {
            if (shift === 'NIGHT') {
                entry.night_production += qty;
            } else {
                entry.day_production += qty; 
            }
        } else if (type === 'SALE') {
            // Sales are negative in ledger, convert to positive for 'Stock Out' display
            entry.stock_out = (entry.stock_out || 0) + Math.abs(qty);
        } else if (type === 'ADJ') {
            if (qty > 0) entry.day_production += qty;
            else entry.stock_out = (entry.stock_out || 0) + Math.abs(qty);
        }
    });

    return Array.from(aggMap.values()); 
  },
  getStockOutByDate: async (date: string): Promise<Record<string, number>> => {
     const data = await stockService.getByDate(date);
     const map: Record<string, number> = {};
     data.forEach((r: any) => { map[r.product_name.toLowerCase()] = Number(r.stock_out); });
     return map;
  },
  // NEW METHOD: Get specific bills causing stock out
  getBreakdown: async (date: string, productId: string): Promise<{ bill_no: string, customer: string, qty: number, status: string }[]> => {
      if (isMock || !supabase) return [];
      
      // 1. Get ledger entries for this product/date that are 'SALE' (Out)
      const { data: ledgerEntries, error } = await supabase.from('inventory_ledger')
          .select('reference_id, qty')
          .eq('date', date)
          .eq('product_id', productId)
          .eq('transaction_type', 'SALE');
          
      if (error || !ledgerEntries) return [];

      const result = [];
      
      // 2. Fetch bill details for each reference
      for (const entry of ledgerEntries) {
          if (!entry.reference_id) continue;
          
          const { data: bill } = await supabase.from('bills')
              .select('bill_no, customer_name, status')
              .eq('id', entry.reference_id)
              .single();
              
          if (bill) {
              result.push({
                  bill_no: bill.bill_no,
                  customer: bill.customer_name,
                  qty: Math.abs(entry.qty), // Positive Qty
                  status: bill.status
              });
          } else {
              // Manual adjustment or non-bill stock out
              result.push({
                  bill_no: entry.reference_id, // Might be 'MANUAL' or 'Adjustment'
                  customer: 'System Adjustment',
                  qty: Math.abs(entry.qty),
                  status: 'ADJUSTMENT'
              });
          }
      }
      return result;
  },
  getStockOutByRange: async (startDate: string, endDate: string): Promise<Record<string, number>> => {
     if (isMock || !supabase) return {};
     const { data, error } = await supabase.from('inventory_ledger')
        .select('product_id, qty')
        .eq('transaction_type', 'SALE')
        .gte('date', startDate)
        .lte('date', endDate);
     if (error) return {};
     const prods = await productService.getAll();
     const map: Record<string, number> = {};
     data.forEach((r: any) => {
         const p = prods.find(pr => pr.id === r.product_id);
         if(p) {
             const name = p.product_name.toLowerCase();
             map[name] = (map[name] || 0) + Math.abs(Number(r.qty));
         }
     });
     return map;
  },
  upsert: async () => {},
  getLastEntry: async () => null,
};

export const productionLogService = {
  add: async (log: Omit<ProductionLog, 'id'>): Promise<void> => {
    if (!isMock && supabase) {
        let targetProdId = log.product_id;
        const { data: productCheck } = await supabase.from('products').select('id').eq('id', targetProdId).maybeSingle();
        if (!productCheck) {
             const { data: nameCheck } = await supabase.from('products').select('id').ilike('product_name', log.product_name).maybeSingle();
             if (nameCheck) targetProdId = nameCheck.id;
        }
        const { data: newLog, error } = await supabase.from('production_logs').insert([{ ...log, status: 'APPROVED' }]).select().single();
        if (error) throw error;
        await supabase.from('inventory_ledger').insert({
            date: log.date,
            product_id: targetProdId,
            transaction_type: 'PROD',
            qty: log.qty, 
            shift: log.shift.toUpperCase(),
            reference_id: newLog.id
        });
    }
    return Promise.resolve();
  },
  getByDate: async (date: string): Promise<ProductionLog[]> => {
    if (isMock || !supabase) return Promise.resolve(mockProductionLogs);
    const { data, error } = await supabase.from('production_logs').select('*').eq('date', date).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  getPending: async (): Promise<ProductionLog[]> => {
      if (isMock || !supabase) return Promise.resolve([]);
      const { data, error } = await supabase.from('production_logs').select('*').eq('status', 'PENDING').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
  },
  getByStatus: async (status: string): Promise<ProductionLog[]> => {
      if (isMock || !supabase) return Promise.resolve([]);
      const { data, error } = await supabase.from('production_logs').select('*').eq('status', status).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
  },
  getHistory: async (): Promise<ProductionLog[]> => {
      if (isMock || !supabase) return Promise.resolve([]);
      const { data, error } = await supabase.from('production_logs').select('*').neq('status', 'PENDING').order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      return data || [];
  },
  approveEntry: async (log: ProductionLog): Promise<void> => { return Promise.resolve(); },
  approveAllByDate: async (date: string): Promise<void> => { return Promise.resolve(); },
  declineEntry: async (id: string): Promise<void> => {
    if (isMock || !supabase) return Promise.resolve();
    await supabase.from('production_logs').update({ status: 'DECLINED' }).eq('id', id);
  },
  deleteEntry: async (id: string): Promise<void> => {
    if (isMock || !supabase) return Promise.resolve();
    await supabase.from('inventory_ledger').delete().eq('reference_id', id);
    await supabase.from('production_logs').delete().eq('id', id);
  }
};

export const dailyReportService = {
  getByDate: async (date: string): Promise<DailyReportEntry[]> => {
    if (isMock || !supabase) return Promise.resolve([]);
    try {
        const { data, error } = await supabase.rpc('get_daily_stock_status', { target_date: date });
        if (error) throw error;
        return (data || []).map((row: any) => ({
            product_name: row.product_name,
            date: row.date,
            opening_stock: Number(row.opening_stock),
            production_day: Number(row.day_production),
            production_night: Number(row.night_production),
            stock_in: 0,
            stock_out: Number(row.stock_out),
            closing_stock: Number(row.closing_stock),
            remarks: ''
        }));
    } catch(e) { return []; }
  },
  getPreviousClosing: async (productName: string, currentDate: string): Promise<number> => {
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      const { data } = await supabase.rpc('get_daily_stock_status', { target_date: prevDateStr });
      const row = data.find((r: any) => r.product_name === productName);
      return row ? Number(row.closing_stock) : 0;
  },
  upsert: async (entries: DailyReportEntry[]): Promise<void> => { return Promise.resolve(); }
};

export const productionModuleService = {
    getDashboard: async (date: string): Promise<ProdDashboardRow[]> => {
        if (isMock || !supabase) return [];
        const { data, error } = await supabase.rpc('get_daily_stock_status', { target_date: date });
        if (error) { console.error("Dashboard Load Error", error); return []; }
        return (data || []).map((row: any) => ({
            product_id: row.product_id,
            product_name: row.product_name,
            date: row.date,
            opening: Number(row.opening_stock),
            day_production: Number(row.day_production),
            night_production: Number(row.night_production),
            extra_production: 0, 
            total_production: Number(row.total_production),
            stock_out: Number(row.stock_out),
            adjustment: 0,
            closing_stock: Number(row.closing_stock),
            is_locked: false
        }));
    },
    initializeDay: async (date: string): Promise<void> => { return Promise.resolve(); },
    addProduction: async (entry: Omit<ProdShiftProduction, 'id'>, overwrite = false): Promise<void> => {
        if (isMock || !supabase) return;
        await supabase.from('inventory_ledger').insert({
            date: entry.date,
            product_id: entry.product_id,
            transaction_type: 'PROD',
            qty: entry.qty,
            shift: entry.shift,
            reference_id: 'MANUAL_DASHBOARD'
        });
    },
    updateOpeningStock: async (productId: string, date: string, qty: number): Promise<void> => {},
    addStockOut: async (entry: Omit<ProdStockOut, 'id'>): Promise<void> => {
        if (isMock || !supabase) return;
        await supabase.from('inventory_ledger').insert({
            date: entry.date,
            product_id: entry.product_id,
            transaction_type: 'SALE',
            qty: -(Number(entry.qty)), 
            reference_id: entry.reference_no
        });
    },
    addAdjustment: async (productId: string, date: string, qty: number, reason: string, user: string): Promise<void> => {
        if (isMock || !supabase) return;
        await supabase.from('inventory_ledger').insert({
            date: date,
            product_id: productId,
            transaction_type: 'ADJ',
            qty: qty, 
            reference_id: reason
        });
    },
    lockDay: async (date: string): Promise<void> => { return Promise.resolve(); },
    recalculateDayOpening: async (date: string): Promise<void> => { return Promise.resolve(); },
    rebuildLedger: async () => {
        if (!supabase) return;
        
        // 1. Clear Ledger
        await supabase.from('inventory_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 

        // 2. Insert Approved Production
        const { data: prodLogs } = await supabase.from('production_logs').select('*').eq('status', 'APPROVED');
        const prodEntries = (prodLogs || []).map((log: any) => ({
            date: log.date,
            product_id: log.product_id,
            transaction_type: 'PROD',
            qty: log.qty,
            shift: log.shift === 'Day' ? 'DAY' : 'NIGHT',
            reference_id: log.id
        }));

        // 3. Insert Sales (Bills)
        const { data: bills } = await supabase.from('bills').select('id, bill_date, status').neq('status', 'CANCELLED').neq('status', 'PENDING');
        if (bills && bills.length > 0) {
            const billIds = bills.map((b: any) => b.id);
            const { data: products } = await supabase.from('products').select('id, product_name');
            const productMap = new Map(products?.map((p: any) => [p.product_name.trim().toLowerCase(), p.id]));

            const { data: items } = await supabase.from('bill_items').select('*').in('bill_id', billIds);
            const billMap = new Map(bills.map((b: any) => [b.id, b]));
            
            const saleEntries = [];
            for (const item of (items || [])) {
                const bill: any = billMap.get(item.bill_id);
                if (!bill) continue;
                const pid = productMap.get(item.product_name.trim().toLowerCase());
                if (pid) {
                    saleEntries.push({
                        date: bill.bill_date,
                        product_id: pid,
                        transaction_type: 'SALE',
                        qty: -1 * item.qty, // Negative for Out
                        reference_id: bill.id
                    });
                }
            }
            
            // Merge & Insert
            const all = [...prodEntries, ...saleEntries];
            if (all.length > 0) {
                // Batch insert 500 at a time
                for (let i = 0; i < all.length; i += 500) {
                    await supabase.from('inventory_ledger').insert(all.slice(i, i + 500));
                }
            }
        }
    }
};

export const auditService = {
    getRecentLogs: async (limit: number = 50): Promise<ActivityLog[]> => {
        if (isMock || !supabase) return Promise.resolve(mockActivityLogs);
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error("Audit Log Error:", error);
            return [];
        }
        return data || [];
    }
};

export const backupService = {
    fetchAllTableData: async (tableName: string): Promise<any[]> => {
        if (isMock || !supabase) {
             switch(tableName) {
                case 'bills': return Promise.resolve(mockBills);
                case 'bill_items': return Promise.resolve(mockItems);
                case 'products': return Promise.resolve(mockProducts);
                case 'customers': return Promise.resolve(mockCustomers);
                case 'vehicles': return Promise.resolve(mockVehicles);
                case 'parties': return Promise.resolve(mockParties);
                case 'addresses': return Promise.resolve(mockAddresses);
                case 'app_users': return Promise.resolve(mockUsers);
                case 'production_logs': return Promise.resolve(mockProductionLogs);
                case 'activity_logs': return Promise.resolve(mockActivityLogs);
                case 'app_settings': return Promise.resolve(Object.entries(mockSettings).map(([k,v]) => ({key:k, value:v})));
                default: return Promise.resolve([]);
            }
        }
        
        let allRows: any[] = [];
        let page = 0;
        const pageSize = 1000;
        
        while (true) {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (error) throw error;
            
            if (!data || data.length === 0) break;
            allRows.push(...data);
            
            if (data.length < pageSize) break;
            page++;
        }
        
        return allRows;
    }
};

// --- NEW GENERIC DATABASE SERVICE ---
export const databaseService = {
    // Fetch all data for a specific table
    fetchTableData: async (tableName: string) => {
        if (isMock || !supabase) {
            // Re-use backup mock logic for simplicity in mock mode
            return backupService.fetchAllTableData(tableName);
        }
        const { data, error } = await supabase.from(tableName).select('*').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        return data || [];
    },

    // Update a specific row
    updateRow: async (tableName: string, id: string, updates: any) => {
        if (isMock || !supabase) return; // Mock update logic omitted for brevity
        const { error } = await supabase.from(tableName).update(updates).eq('id', id);
        if (error) throw error;
    },

    // Delete a specific row
    deleteRow: async (tableName: string, id: string) => {
        if (isMock || !supabase) return; // Mock delete logic omitted
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) throw error;
    }
};

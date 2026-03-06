
-- ============================================================================
-- GREENZAR STOCK - SAFE UPDATE SCHEMA
-- ============================================================================
-- RUNNING THIS SCRIPT WILL NOT DELETE YOUR EXISTING DATA.
-- It will only add missing tables (like activity_logs) and update triggers.

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 3. CORE CONFIGURATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Initialize System Lock Settings (Only if missing)
INSERT INTO app_settings (key, value) VALUES 
('system_status', 'OPEN'),
('system_message', 'System is temporarily locked by Admin.')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS production_config (
    id SERIAL PRIMARY KEY,
    is_active BOOLEAN DEFAULT true
);
INSERT INTO production_config (id, is_active) VALUES (1, true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS order_config (
    id SERIAL PRIMARY KEY,
    is_active BOOLEAN DEFAULT true
);
INSERT INTO order_config (id, is_active) VALUES (1, true) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. USER MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SALESMAN', 'EMPLOYEE', 'DRIVER')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- INITIAL SEED USERS (Only inserts if ID doesn't exist)
INSERT INTO app_users (id, username, password, name, role, created_at) VALUES 
('2c15a304-7b6a-4cd4-b1bb-11ea87c44831', 'debashis', '98200', 'Debashis Saha', 'SALESMAN', '2026-02-07 08:21:06.850+00'),
('3c357a7d-3558-4e67-804a-5294dc46e86e', 'surajit', '98700', 'Surajit Mallick', 'SALESMAN', '2026-02-07 08:30:06.793+00'),
('5d258c23-5517-4b1b-a864-f7c8052f3e55', 'manoranjan', '98600', 'Manoranjan Kayal', 'SALESMAN', '2026-02-07 08:28:43.619+00'),
('615fca61-7acc-4560-83d5-3f05498cc5cf', 'mofidul', '6211', 'MD MOFIDUL ISLAM', 'ADMIN', '2026-02-03 06:59:55.525+00'),
('84fca372-9ef9-458a-bd54-b086b1b3fbbd', 'ranjit', '98500', 'Ranjit', 'SALESMAN', '2026-02-07 08:25:50.023+00'),
('99f5444e-6315-4fa8-97a4-ab582c29d8a4', 'azhar', '6211', 'AZHARUDDIN', 'EMPLOYEE', '2026-02-03 07:46:14.221+00'),
('c47728f1-b99c-4dae-842c-845417cb7cac', 'bikramjit', '98300', 'Bikramjit Kundu', 'SALESMAN', '2026-02-07 08:22:40.630+00'),
('c806888c-e848-4a1a-8b93-ce73b87d884a', 'sirajuddin', '6211', 'Siraj Uddin', 'EMPLOYEE', '2026-02-12 05:28:14.508+00'),
('df38be9b-079b-4929-95e1-518adb0a4ffb', 'riyaz', '6211', 'MD RIYAZ MOLLA', 'ADMIN', '2026-02-03 06:58:20.173+00'),
('e2ba10ae-ba9e-4eb3-a370-7d1e2dec1583', 'mintu', '98400', 'Mintu Dutta', 'SALESMAN', '2026-02-07 08:24:12.727+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. MASTER DATA TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL,
    rate NUMERIC DEFAULT 0,
    weight NUMERIC DEFAULT 0,
    image_url TEXT, -- Added Image Support
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure column exists if table was already created
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN
        ALTER TABLE products ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Update role check constraint to include DRIVER
DO $$
BEGIN
    ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
    ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('ADMIN', 'SALESMAN', 'EMPLOYEE', 'DRIVER'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS parties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    party_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    address_line TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_number TEXT NOT NULL,
    driver_name TEXT,
    driver_contact TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_address TEXT,
    vehicle_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 6. BILLING & ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS bills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_no TEXT UNIQUE NOT NULL,
    bill_type TEXT NOT NULL, 
    total_qty NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    total_weight NUMERIC DEFAULT 0,
    bill_date DATE NOT NULL,
    customer_name TEXT,
    customer_address TEXT,
    vehicle_number TEXT,
    payment_upi TEXT,
    driver_name TEXT,
    driver_contact TEXT,
    salesman_name TEXT,
    gst_number TEXT,
    pan_number TEXT,
    aadhar_number TEXT,
    phone_number TEXT,
    remark TEXT,
    status TEXT DEFAULT 'PENDING', 
    "qrCodeType" TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bill_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    qty NUMERIC NOT NULL DEFAULT 0,
    rate NUMERIC DEFAULT 0,
    line_total NUMERIC DEFAULT 0
);

-- ============================================================================
-- 7. PRODUCTION LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS production_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    time TEXT,
    product_id UUID REFERENCES products(id),
    product_name TEXT,
    qty NUMERIC NOT NULL,
    shift TEXT, 
    user_name TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 8. LEDGER INVENTORY SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('PROD', 'SALE', 'ADJ')), 
    qty NUMERIC NOT NULL DEFAULT 0, 
    shift TEXT,
    reference_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_date_prod ON inventory_ledger(date, product_id);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON inventory_ledger(reference_id);

-- ============================================================================
-- 9. ACTIVITY / AUDIT LOGS (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'ORDER', 'STOCK', 'SYSTEM', 'USER'
    entity_id TEXT,
    action_type TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'
    description TEXT NOT NULL,
    details TEXT,
    performed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 10. AUTOMATION TRIGGERS (FIXED)
-- ============================================================================

-- Function: Re-calculates and Inserts Ledger entries for a specific Bill ID
CREATE OR REPLACE FUNCTION refresh_bill_stock(target_bill_id UUID) RETURNS VOID AS $$
DECLARE
    b_rec RECORD;
BEGIN
    -- Get Bill Info
    SELECT * INTO b_rec FROM bills WHERE id = target_bill_id;
    
    -- 1. Delete existing ledger entries for this bill (Sale type) to avoid duplicates
    DELETE FROM inventory_ledger 
    WHERE reference_id = target_bill_id::text 
    AND transaction_type = 'SALE';

    -- 2. If bill is deleted/not found or status is PENDING/CANCELLED, stop here.
    IF b_rec IS NULL OR b_rec.status = 'CANCELLED' OR b_rec.status = 'PENDING' THEN
        RETURN;
    END IF;

    -- 3. Insert fresh ledger entries from bill_items
    -- UPDATE: Included 'RECEIVED' to allow salesman scan to deduct stock immediately
    IF b_rec.status IN ('APPROVED', 'DELIVERED', 'OUT_FOR_DELIVERY', 'LOADING', 'RECEIVED') THEN
        INSERT INTO inventory_ledger (date, product_id, transaction_type, qty, reference_id)
        SELECT 
            b_rec.bill_date,
            p.id,
            'SALE',
            (bi.qty * -1), -- Negative quantity means STOCK OUT
            b_rec.id::text
        FROM bill_items bi
        JOIN products p ON lower(trim(p.product_name)) = lower(trim(bi.product_name))
        WHERE bi.bill_id = target_bill_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Bill Changes
CREATE OR REPLACE FUNCTION trg_bill_change() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM refresh_bill_stock(OLD.id);
        RETURN OLD;
    ELSE
        PERFORM refresh_bill_stock(NEW.id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger first to ensure clean update (Triggers cannot be 'OR REPLACE')
DROP TRIGGER IF EXISTS t_bill_stock_sync ON bills;
CREATE TRIGGER t_bill_stock_sync
AFTER INSERT OR UPDATE OR DELETE ON bills
FOR EACH ROW EXECUTE FUNCTION trg_bill_change();

-- Trigger: Bill Item Changes
CREATE OR REPLACE FUNCTION trg_bill_item_change() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM refresh_bill_stock(OLD.bill_id);
        RETURN OLD;
    ELSE
        PERFORM refresh_bill_stock(NEW.bill_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_bill_item_stock_sync ON bill_items;
CREATE TRIGGER t_bill_item_stock_sync
AFTER INSERT OR UPDATE OR DELETE ON bill_items
FOR EACH ROW EXECUTE FUNCTION trg_bill_item_change();

-- ============================================================================
-- 11. AUDIT LOGGING FUNCTION (ENHANCED FOR ITEMS)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_activity() RETURNS TRIGGER AS $$
DECLARE
    entity_id TEXT;
    entity_type TEXT;
    action_type TEXT;
    description TEXT;
    detail TEXT := '';
    performer TEXT := 'System';
BEGIN
    IF (TG_TABLE_NAME = 'bills') THEN
        entity_type := 'ORDER';
        IF (TG_OP = 'DELETE') THEN
            entity_id := OLD.bill_no;
            action_type := 'DELETE';
            description := 'Order Deleted: ' || OLD.bill_no;
        ELSIF (TG_OP = 'INSERT') THEN
            entity_id := NEW.bill_no;
            action_type := 'CREATE';
            description := 'New Order Created: ' || NEW.bill_no;
            IF NEW.salesman_name IS NOT NULL THEN
                performer := NEW.salesman_name;
            END IF;
        ELSIF (TG_OP = 'UPDATE') THEN
            entity_id := NEW.bill_no;
            -- Check specifically for Status Change
            IF OLD.status IS DISTINCT FROM NEW.status THEN
                action_type := 'STATUS_CHANGE';
                description := 'Order ' || NEW.bill_no || ' status changed to ' || NEW.status;
                -- Try to extract editor from remark
                IF NEW.remark ~ 'Edited by: (.+)' THEN
                    performer := substring(NEW.remark from 'Edited by: (.+)');
                END IF;
            -- Ignore purely total updates here to reduce noise if we are logging items separately
            ELSIF OLD.total_qty IS DISTINCT FROM NEW.total_qty OR OLD.customer_name IS DISTINCT FROM NEW.customer_name THEN
                action_type := 'UPDATE';
                description := 'Order ' || NEW.bill_no || ' details updated';
                IF NEW.remark ~ 'Edited by: (.+)' THEN
                    performer := substring(NEW.remark from 'Edited by: (.+)');
                END IF;
            END IF;
        END IF;
    ELSIF (TG_TABLE_NAME = 'production_logs') THEN
        entity_type := 'STOCK';
        IF (TG_OP = 'INSERT') THEN
            entity_id := NEW.id::text;
            action_type := 'CREATE';
            description := 'Production Input: ' || NEW.product_name || ' (Qty: ' || NEW.qty || ')';
            performer := NEW.user_name;
        ELSIF (TG_OP = 'UPDATE') THEN
            entity_id := NEW.id::text;
            action_type := 'STATUS_CHANGE';
            description := 'Production ' || NEW.status || ': ' || NEW.product_name;
        END IF;
    END IF;

    -- Insert Log
    IF description IS NOT NULL THEN
        INSERT INTO activity_logs (entity_type, entity_id, action_type, description, details, performed_by)
        VALUES (entity_type, entity_id, action_type, description, detail, performer);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_audit_bills ON bills;
CREATE TRIGGER t_audit_bills
AFTER INSERT OR UPDATE OR DELETE ON bills
FOR EACH ROW EXECUTE FUNCTION log_activity();

DROP TRIGGER IF EXISTS t_audit_production ON production_logs;
CREATE TRIGGER t_audit_production
AFTER INSERT OR UPDATE ON production_logs
FOR EACH ROW EXECUTE FUNCTION log_activity();

-- ============================================================================
-- 11.5 NEW TRIGGER FOR LINE ITEMS (GRANULAR LOGGING)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_item_activity() RETURNS TRIGGER AS $$
DECLARE
    target_bill RECORD;
    log_desc TEXT;
    performer TEXT := 'System';
BEGIN
    -- Fetch Parent Bill Info (Bill No and Remark for editor name)
    IF (TG_OP = 'DELETE') THEN
        SELECT * INTO target_bill FROM bills WHERE id = OLD.bill_id;
    ELSE
        SELECT * INTO target_bill FROM bills WHERE id = NEW.bill_id;
    END IF;

    -- Try to extract performer from parent bill remark
    IF target_bill.remark ~ 'Edited by: (.+)' THEN
        performer := substring(target_bill.remark from 'Edited by: (.+)');
    ELSIF target_bill.salesman_name IS NOT NULL THEN
        performer := target_bill.salesman_name;
    END IF;

    IF (TG_OP = 'INSERT') THEN
        log_desc := 'Added item: ' || NEW.product_name || ' (Qty: ' || NEW.qty || ') to Order ' || target_bill.bill_no;
        
        INSERT INTO activity_logs (entity_type, entity_id, action_type, description, details, performed_by)
        VALUES ('ORDER', target_bill.bill_no, 'UPDATE', log_desc, 'Item Added', performer);
        
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.qty <> NEW.qty THEN
            log_desc := 'Updated ' || NEW.product_name || ' Qty: ' || OLD.qty || ' -> ' || NEW.qty || ' (Order ' || target_bill.bill_no || ')';
            
            INSERT INTO activity_logs (entity_type, entity_id, action_type, description, details, performed_by)
            VALUES ('ORDER', target_bill.bill_no, 'UPDATE', log_desc, 'Qty Change', performer);
        END IF;
        
    ELSIF (TG_OP = 'DELETE') THEN
        log_desc := 'Removed item: ' || OLD.product_name || ' from Order ' || target_bill.bill_no;
        
        INSERT INTO activity_logs (entity_type, entity_id, action_type, description, details, performed_by)
        VALUES ('ORDER', target_bill.bill_no, 'UPDATE', log_desc, 'Item Removed', performer);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_audit_bill_items ON bill_items;
CREATE TRIGGER t_audit_bill_items
AFTER INSERT OR UPDATE OR DELETE ON bill_items
FOR EACH ROW EXECUTE FUNCTION log_item_activity();

-- ============================================================================
-- 12. REAL-TIME STOCK CALCULATION FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS get_daily_stock_status;
CREATE OR REPLACE FUNCTION get_daily_stock_status(target_date DATE)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    date DATE,
    opening_stock NUMERIC,
    day_production NUMERIC,
    night_production NUMERIC,
    total_production NUMERIC,
    stock_out NUMERIC,
    closing_stock NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH 
    prev_balance AS (
        SELECT 
            il.product_id, 
            SUM(il.qty) as bal 
        FROM inventory_ledger il 
        WHERE il.date < target_date 
        GROUP BY il.product_id
    ),
    today_moves AS (
        SELECT 
            il.product_id,
            SUM(CASE WHEN transaction_type = 'PROD' AND shift = 'DAY' THEN qty ELSE 0 END) as d_prod,
            SUM(CASE WHEN transaction_type = 'PROD' AND shift = 'NIGHT' THEN qty ELSE 0 END) as n_prod,
            SUM(CASE WHEN transaction_type = 'SALE' THEN ABS(qty) ELSE 0 END) as s_out,
            SUM(qty) as net_change
        FROM inventory_ledger il
        WHERE il.date = target_date
        GROUP BY il.product_id
    )
    SELECT 
        p.id,
        p.product_name,
        target_date,
        COALESCE(pb.bal, 0) as opening_stock,
        COALESCE(tm.d_prod, 0) as day_production,
        COALESCE(tm.n_prod, 0) as night_production,
        (COALESCE(tm.d_prod, 0) + COALESCE(tm.n_prod, 0)) as total_production,
        COALESCE(tm.s_out, 0) as stock_out,
        (COALESCE(pb.bal, 0) + COALESCE(tm.net_change, 0)) as closing_stock
    FROM products p
    LEFT JOIN prev_balance pb ON p.id = pb.product_id
    LEFT JOIN today_moves tm ON p.id = tm.product_id
    ORDER BY p.product_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 13. INITIAL SEED DATA
-- ============================================================================

INSERT INTO products (product_name, unit, rate, weight) VALUES 
('Green Apple', 'case', 120, 1),
('Mango Juice', 'case', 150, 1.2),
('Litchi Drink', 'case', 130, 1)
ON CONFLICT DO NOTHING;

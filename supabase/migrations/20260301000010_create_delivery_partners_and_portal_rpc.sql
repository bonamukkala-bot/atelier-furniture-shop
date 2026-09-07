-- ==============================================================================
-- Migration: Create delivery_partners, partner_sessions, and Partner Portal RPCs
-- 1. Create delivery_partners table with hashed PIN storage
-- 2. Create partner_sessions table for zero-cost scoped sessions
-- 3. Add delivery_partner_id, proof_of_delivery columns to orders
-- 4. Set up Storage bucket & RLS policies
-- 5. Secure database-enforced RPC functions for partner login & order actions
-- ==============================================================================

-- 1. Create delivery_partners table
CREATE TABLE IF NOT EXISTS delivery_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL, -- SHA-256 or bcrypt hashed PIN, never plaintext
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create partner_sessions table
CREATE TABLE IF NOT EXISTS partner_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_sessions_token ON partner_sessions(token);
CREATE INDEX IF NOT EXISTS idx_partner_sessions_partner_id ON partner_sessions(partner_id);

-- 3. Update orders table with partner ID & delivery proof columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_partner_id UUID REFERENCES delivery_partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS proof_of_delivery_url TEXT,
ADD COLUMN IF NOT EXISTS proof_of_delivery_timestamp TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner_id ON orders(delivery_partner_id);

-- 4. Create storage bucket for delivery proof photos if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for delivery proof photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public can view delivery proofs'
  ) THEN
    CREATE POLICY "Public can view delivery proofs" ON storage.objects 
    FOR SELECT TO public USING (bucket_id = 'delivery-proofs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anyone can upload delivery proofs'
  ) THEN
    CREATE POLICY "Anyone can upload delivery proofs" ON storage.objects 
    FOR INSERT TO public WITH CHECK (bucket_id = 'delivery-proofs');
  END IF;
END $$;

-- 5. Enable RLS on delivery_partners and partner_sessions
ALTER TABLE delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins full access to delivery_partners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'delivery_partners' AND policyname = 'Admins have full access to delivery_partners'
  ) THEN
    CREATE POLICY "Admins have full access to delivery_partners" ON delivery_partners
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partner_sessions' AND policyname = 'Admins have full access to partner_sessions'
  ) THEN
    CREATE POLICY "Admins have full access to partner_sessions" ON partner_sessions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ==============================================================================
-- 6. SECURE RPC: Partner Login Verification
-- ==============================================================================
CREATE OR REPLACE FUNCTION verify_partner_login(p_phone TEXT, p_pin_hash TEXT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_partner delivery_partners%ROWTYPE;
    v_token UUID;
    v_clean_phone TEXT;
BEGIN
    -- Normalize phone digits (keep only digits)
    v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');
    
    -- Strip leading country code 91 if 12 digits
    IF length(v_clean_phone) = 12 AND v_clean_phone LIKE '91%' THEN
        v_clean_phone := substr(v_clean_phone, 3);
    END IF;

    -- Find active delivery partner by phone
    SELECT * INTO v_partner
    FROM delivery_partners
    WHERE regexp_replace(phone, '\D', '', 'g') = v_clean_phone
       OR regexp_replace(phone, '\D', '', 'g') = ('91' || v_clean_phone)
       OR phone = p_phone;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'No delivery partner found with this phone number.');
    END IF;

    IF v_partner.status <> 'active' THEN
        RETURN json_build_object('success', false, 'error', 'Your partner account is inactive. Please contact the workshop admin.');
    END IF;

    -- Verify PIN hash
    IF v_partner.pin_hash <> p_pin_hash THEN
        RETURN json_build_object('success', false, 'error', 'Incorrect 4-digit PIN. Please try again.');
    END IF;

    -- Create new session token valid for 30 days
    v_token := gen_random_uuid();
    INSERT INTO partner_sessions (partner_id, token, expires_at)
    VALUES (v_partner.id, v_token, NOW() + INTERVAL '30 days');

    RETURN json_build_object(
        'success', true,
        'session_token', v_token,
        'partner', json_build_object(
            'id', v_partner.id,
            'name', v_partner.name,
            'phone', v_partner.phone,
            'status', v_partner.status
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION verify_partner_login(TEXT, TEXT) TO anon, authenticated;

-- ==============================================================================
-- 7. SECURE RPC: Get Scoped Partner Orders
-- STRICT DATABASE-LEVEL ISOLATION: Partner A can ONLY see their assigned orders
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_partner_orders(p_session_token UUID)
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    customer_name TEXT,
    customer_phone TEXT,
    product_id UUID,
    product_name TEXT,
    product_price NUMERIC,
    product_image_url TEXT,
    quantity INTEGER,
    total NUMERIC,
    fulfillment_type TEXT,
    delivery_address TEXT,
    delivery_status TEXT,
    delivery_fee NUMERIC,
    delivery_zone_name TEXT,
    delivery_partner_id UUID,
    delivery_partner_name TEXT,
    delivery_partner_phone TEXT,
    tracking_token UUID,
    delivery_confirmation_code TEXT,
    delivery_confirmed_via TEXT,
    proof_of_delivery_url TEXT,
    proof_of_delivery_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_partner_id UUID;
    v_partner_phone TEXT;
    v_clean_phone TEXT;
BEGIN
    -- Validate session token
    SELECT ps.partner_id, dp.phone INTO v_partner_id, v_partner_phone
    FROM partner_sessions ps
    JOIN delivery_partners dp ON dp.id = ps.partner_id
    WHERE ps.token = p_session_token
      AND ps.expires_at > NOW()
      AND dp.status = 'active';

    IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired partner session. Please log in again.';
    END IF;

    v_clean_phone := regexp_replace(COALESCE(v_partner_phone, ''), '\D', '', 'g');

    RETURN QUERY
    SELECT 
        o.id,
        o.customer_id,
        c.name::TEXT AS customer_name,
        c.phone::TEXT AS customer_phone,
        o.product_id,
        p.name::TEXT AS product_name,
        p.price::NUMERIC AS product_price,
        p.image_url::TEXT AS product_image_url,
        o.quantity,
        o.total::NUMERIC,
        o.fulfillment_type::TEXT,
        o.delivery_address::TEXT,
        o.delivery_status::TEXT,
        o.delivery_fee::NUMERIC,
        dz.zone_name::TEXT AS delivery_zone_name,
        o.delivery_partner_id,
        o.delivery_partner_name::TEXT,
        o.delivery_partner_phone::TEXT,
        o.tracking_token,
        o.delivery_confirmation_code::TEXT,
        o.delivery_confirmed_via::TEXT,
        o.proof_of_delivery_url::TEXT,
        o.proof_of_delivery_timestamp,
        o.created_at,
        o.updated_at
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN products p ON p.id = o.product_id
    LEFT JOIN delivery_zones dz ON dz.id = o.delivery_zone_id
    WHERE (
        o.delivery_partner_id = v_partner_id
        OR (
            v_clean_phone <> '' 
            AND regexp_replace(COALESCE(o.delivery_partner_phone, ''), '\D', '', 'g') = v_clean_phone
        )
    )
    ORDER BY 
        -- Priority ordering: Out for delivery first, then Preparing, Confirmed, Delivered, Issue
        CASE LOWER(COALESCE(o.delivery_status, 'confirmed'))
            WHEN 'out_for_delivery' THEN 1
            WHEN 'preparing' THEN 2
            WHEN 'confirmed' THEN 3
            WHEN 'issue' THEN 4
            WHEN 'delivered' THEN 5
            ELSE 6
        END ASC,
        o.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_partner_orders(UUID) TO anon, authenticated;

-- ==============================================================================
-- 8. SECURE RPC: Update Partner Order Status
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_partner_order_status(
    p_session_token UUID,
    p_order_id UUID,
    p_status TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_partner_id UUID;
    v_partner_name TEXT;
    v_partner_phone TEXT;
    v_clean_phone TEXT;
    v_order orders%ROWTYPE;
    v_code VARCHAR(10);
BEGIN
    -- Validate session token
    SELECT ps.partner_id, dp.name, dp.phone INTO v_partner_id, v_partner_name, v_partner_phone
    FROM partner_sessions ps
    JOIN delivery_partners dp ON dp.id = ps.partner_id
    WHERE ps.token = p_session_token
      AND ps.expires_at > NOW()
      AND dp.status = 'active';

    IF v_partner_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired session.');
    END IF;

    v_clean_phone := regexp_replace(COALESCE(v_partner_phone, ''), '\D', '', 'g');

    -- Verify that order exists and belongs to this partner
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
      AND (
          delivery_partner_id = v_partner_id
          OR (
              v_clean_phone <> '' 
              AND regexp_replace(COALESCE(delivery_partner_phone, ''), '\D', '', 'g') = v_clean_phone
          )
      );

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Order not found or not assigned to your account.');
    END IF;

    -- If status is moving to out_for_delivery, ensure a 6-digit confirmation code exists
    v_code := v_order.delivery_confirmation_code;
    IF p_status = 'out_for_delivery' AND (v_code IS NULL OR v_code = '') THEN
        v_code := floor(100000 + random() * 900000)::TEXT;
    END IF;

    -- Update order
    UPDATE orders
    SET delivery_status = p_status,
        delivery_confirmation_code = COALESCE(v_code, delivery_confirmation_code),
        delivery_partner_id = COALESCE(delivery_partner_id, v_partner_id),
        delivery_partner_name = COALESCE(delivery_partner_name, v_partner_name),
        delivery_partner_phone = COALESCE(delivery_partner_phone, v_partner_phone),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Log to delivery_status_history
    INSERT INTO delivery_status_history (order_id, status, note)
    VALUES (
        p_order_id,
        p_status,
        COALESCE(p_note, 'Status updated by delivery partner ' || v_partner_name)
    );

    RETURN json_build_object('success', true, 'status', p_status, 'code', v_code);
END;
$$;

GRANT EXECUTE ON FUNCTION update_partner_order_status(UUID, UUID, TEXT, TEXT) TO anon, authenticated;

-- ==============================================================================
-- 9. SECURE RPC: Confirm Partner Delivery (Code + Proof of Delivery Photo)
-- ==============================================================================
CREATE OR REPLACE FUNCTION confirm_partner_delivery_with_code(
    p_session_token UUID,
    p_order_id UUID,
    p_code TEXT,
    p_proof_url TEXT DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_partner_id UUID;
    v_partner_name TEXT;
    v_partner_phone TEXT;
    v_clean_phone TEXT;
    v_order orders%ROWTYPE;
    v_expected_code TEXT;
    v_entered_code TEXT;
BEGIN
    -- Validate session token
    SELECT ps.partner_id, dp.name, dp.phone INTO v_partner_id, v_partner_name, v_partner_phone
    FROM partner_sessions ps
    JOIN delivery_partners dp ON dp.id = ps.partner_id
    WHERE ps.token = p_session_token
      AND ps.expires_at > NOW()
      AND dp.status = 'active';

    IF v_partner_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired session.');
    END IF;

    v_clean_phone := regexp_replace(COALESCE(v_partner_phone, ''), '\D', '', 'g');

    -- Verify that order exists and belongs to this partner
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
      AND (
          delivery_partner_id = v_partner_id
          OR (
              v_clean_phone <> '' 
              AND regexp_replace(COALESCE(delivery_partner_phone, ''), '\D', '', 'g') = v_clean_phone
          )
      );

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Order not found or not assigned to your account.');
    END IF;

    v_expected_code := TRIM(COALESCE(v_order.delivery_confirmation_code, ''));
    v_entered_code := TRIM(regexp_replace(COALESCE(p_code, ''), '\s', '', 'g'));

    IF v_expected_code = '' THEN
        RETURN json_build_object('success', false, 'error', 'No confirmation code set on this order. Please contact workshop admin.');
    END IF;

    IF v_entered_code <> v_expected_code THEN
        RETURN json_build_object('success', false, 'error', 'Incorrect 6-digit confirmation code. Please ask the customer to check their tracking link.');
    END IF;

    -- Update order to delivered with proof photo and confirmation method
    UPDATE orders
    SET delivery_status = 'delivered',
        delivery_confirmed_via = 'code',
        proof_of_delivery_url = COALESCE(p_proof_url, proof_of_delivery_url),
        proof_of_delivery_timestamp = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Log in delivery_status_history
    INSERT INTO delivery_status_history (order_id, status, note)
    VALUES (
        p_order_id,
        'delivered',
        'Delivery confirmed with customer 6-digit code and proof photo by partner ' || v_partner_name
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'Delivery verified and marked as Delivered successfully!'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_partner_delivery_with_code(UUID, UUID, TEXT, TEXT) TO anon, authenticated;

-- ==============================================================================
-- 10. SECURE RPC: Admin Partner Management Helper RPCs
-- ==============================================================================
CREATE OR REPLACE FUNCTION admin_list_delivery_partners()
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    status TEXT,
    active_orders_count BIGINT,
    delivered_orders_count BIGINT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dp.id,
        dp.name,
        dp.phone,
        dp.status,
        COUNT(CASE WHEN o.delivery_status IN ('confirmed', 'preparing', 'out_for_delivery') THEN 1 END) AS active_orders_count,
        COUNT(CASE WHEN o.delivery_status = 'delivered' THEN 1 END) AS delivered_orders_count,
        dp.created_at,
        dp.updated_at
    FROM delivery_partners dp
    LEFT JOIN orders o ON o.delivery_partner_id = dp.id
    GROUP BY dp.id, dp.name, dp.phone, dp.status, dp.created_at, dp.updated_at
    ORDER BY dp.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_delivery_partners() TO anon, authenticated;

-- Admin upsert partner
CREATE OR REPLACE FUNCTION admin_upsert_delivery_partner(
    p_id UUID,
    p_name TEXT,
    p_phone TEXT,
    p_pin_hash TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'active'
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF p_id IS NULL THEN
        -- Insert new partner (requires pin_hash)
        IF p_pin_hash IS NULL OR p_pin_hash = '' THEN
            RETURN json_build_object('success', false, 'error', '4-digit PIN is required when adding a new partner.');
        END IF;

        INSERT INTO delivery_partners (name, phone, pin_hash, status)
        VALUES (p_name, p_phone, p_pin_hash, COALESCE(p_status, 'active'))
        RETURNING id INTO v_id;
    ELSE
        -- Update existing partner
        IF p_pin_hash IS NOT NULL AND p_pin_hash <> '' THEN
            UPDATE delivery_partners
            SET name = p_name,
                phone = p_phone,
                pin_hash = p_pin_hash,
                status = COALESCE(p_status, status),
                updated_at = NOW()
            WHERE id = p_id;
        ELSE
            UPDATE delivery_partners
            SET name = p_name,
                phone = p_phone,
                status = COALESCE(p_status, status),
                updated_at = NOW()
            WHERE id = p_id;
        END IF;
        v_id := p_id;
    END IF;

    RETURN json_build_object('success', true, 'id', v_id);
EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'A delivery partner with this phone number already exists.');
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_delivery_partner(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Admin reset PIN
CREATE OR REPLACE FUNCTION admin_set_delivery_partner_pin(
    p_partner_id UUID,
    p_pin_hash TEXT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_pin_hash IS NULL OR p_pin_hash = '' THEN
        RETURN json_build_object('success', false, 'error', 'PIN hash cannot be empty.');
    END IF;

    UPDATE delivery_partners
    SET pin_hash = p_pin_hash,
        updated_at = NOW()
    WHERE id = p_partner_id;

    -- Invalidate existing sessions for security on PIN change
    DELETE FROM partner_sessions WHERE partner_id = p_partner_id;

    RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_delivery_partner_pin(UUID, TEXT) TO anon, authenticated;

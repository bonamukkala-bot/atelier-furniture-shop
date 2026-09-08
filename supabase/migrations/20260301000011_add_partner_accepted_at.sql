-- ==============================================================================
-- Migration 11: Add partner_accepted_at to orders & accept_partner_order RPC
-- 1. Add partner_accepted_at column to orders table
-- 2. Create accept_partner_order RPC
-- 3. Update update_partner_order_status with server-side acceptance guard
-- 4. Update get_partner_orders RPC to return partner_accepted_at
-- 5. Update get_order_by_tracking_token RPC to return partner_accepted_at
-- ==============================================================================

-- 1. Add partner_accepted_at column to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS partner_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_partner_accepted_at ON orders(partner_accepted_at);

-- 2. SECURE RPC: Accept Partner Order
CREATE OR REPLACE FUNCTION accept_partner_order(
    p_session_token UUID,
    p_order_id UUID
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
BEGIN
    -- Validate active partner session
    SELECT ps.partner_id, dp.name, dp.phone INTO v_partner_id, v_partner_name, v_partner_phone
    FROM partner_sessions ps
    JOIN delivery_partners dp ON dp.id = ps.partner_id
    WHERE ps.token = p_session_token
      AND ps.expires_at > NOW()
      AND dp.status = 'active';

    IF v_partner_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired partner session.');
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

    -- Idempotent timestamp update
    IF v_order.partner_accepted_at IS NULL THEN
        UPDATE orders
        SET partner_accepted_at = NOW(),
            delivery_partner_id = COALESCE(delivery_partner_id, v_partner_id),
            delivery_partner_name = COALESCE(delivery_partner_name, v_partner_name),
            delivery_partner_phone = COALESCE(delivery_partner_phone, v_partner_phone),
            updated_at = NOW()
        WHERE id = p_order_id;

        -- Log in delivery_status_history
        INSERT INTO delivery_status_history (order_id, status, note)
        VALUES (
            p_order_id,
            COALESCE(v_order.delivery_status, 'confirmed'),
            'Order accepted for delivery by partner ' || v_partner_name
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Order accepted successfully.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_partner_order(UUID, UUID) TO anon, authenticated;


-- 3. SECURE RPC: Update Partner Order Status (with Acceptance Guard)
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

    -- Server-side acceptance guard: Order must be accepted before any status transition
    IF v_order.partner_accepted_at IS NULL THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Order must be accepted before delivery status can be updated.'
        );
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


-- 4. SECURE RPC: Get Scoped Partner Orders (Returning partner_accepted_at)
DROP FUNCTION IF EXISTS get_partner_orders(UUID);

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
    partner_accepted_at TIMESTAMP WITH TIME ZONE,
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
        o.partner_accepted_at,
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


-- 5. SECURE RPC: Get Order By Tracking Token (Returning partner_accepted_at)
DROP FUNCTION IF EXISTS get_order_by_tracking_token(UUID);

CREATE OR REPLACE FUNCTION get_order_by_tracking_token(p_token UUID)
RETURNS TABLE (
    id UUID,
    product_id UUID,
    customer_name TEXT,
    delivery_status TEXT,
    delivery_address TEXT,
    delivery_fee NUMERIC,
    delivery_zone_id UUID,
    total NUMERIC,
    payment_status TEXT,
    deposit_amount NUMERIC,
    delivery_partner_name TEXT,
    delivery_partner_phone TEXT,
    tracking_token UUID,
    delivery_confirmation_code TEXT,
    delivery_confirmed_via TEXT,
    partner_accepted_at TIMESTAMP WITH TIME ZONE,
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
        o.id,
        o.product_id,
        c.name::TEXT AS customer_name,
        o.delivery_status::TEXT,
        o.delivery_address::TEXT,
        o.delivery_fee::NUMERIC,
        o.delivery_zone_id,
        o.total::NUMERIC,
        o.payment_status::TEXT,
        o.deposit_amount::NUMERIC,
        o.delivery_partner_name::TEXT,
        o.delivery_partner_phone::TEXT,
        o.tracking_token,
        CASE 
            WHEN o.delivery_status = 'out_for_delivery' THEN o.delivery_confirmation_code::TEXT
            ELSE NULL 
        END AS delivery_confirmation_code,
        o.delivery_confirmed_via::TEXT,
        o.partner_accepted_at,
        o.created_at,
        o.updated_at
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.tracking_token = p_token OR o.id = p_token
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_order_by_tracking_token(UUID) TO anon, authenticated;

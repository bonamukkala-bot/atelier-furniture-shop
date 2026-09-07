-- ==============================================================================
-- Migration 7: Add updated_at to orders and recreate get_order_by_tracking_token RPC
-- ==============================================================================

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

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
        -- Security: Only expose confirmation code if status is 'out_for_delivery'
        CASE 
            WHEN o.delivery_status = 'out_for_delivery' THEN o.delivery_confirmation_code::TEXT
            ELSE NULL 
        END AS delivery_confirmation_code,
        o.delivery_confirmed_via::TEXT,
        o.created_at,
        o.updated_at
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.tracking_token = p_token OR o.id = p_token
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_order_by_tracking_token(UUID) TO anon, authenticated;

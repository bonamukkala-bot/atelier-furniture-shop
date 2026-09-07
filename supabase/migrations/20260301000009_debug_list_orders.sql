-- Temporary debug function to inspect orders
CREATE OR REPLACE FUNCTION debug_list_delivery_orders()
RETURNS TABLE (
    id UUID,
    delivery_status TEXT,
    tracking_token UUID,
    delivery_confirmation_code TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.delivery_status::TEXT,
        o.tracking_token,
        o.delivery_confirmation_code::TEXT
    FROM orders o;
END;
$$;

GRANT EXECUTE ON FUNCTION debug_list_delivery_orders() TO anon, authenticated;

-- ==============================================================================
-- Function: get_delivery_history_by_tracking_token
-- Purpose: Safely fetches delivery status history for an order by its tracking token
--          using SECURITY DEFINER without exposing the table or requiring login.
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_delivery_history_by_tracking_token(p_token UUID)
RETURNS TABLE (
    id UUID,
    order_id UUID,
    status TEXT,
    note TEXT,
    changed_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.order_id,
        h.status,
        h.note,
        h.changed_at
    FROM delivery_status_history h
    JOIN orders o ON o.id = h.order_id
    WHERE o.tracking_token = p_token
    ORDER BY h.changed_at ASC;
END;
$$;

-- Grant execution privileges to anonymous and authenticated roles
GRANT EXECUTE ON FUNCTION get_delivery_history_by_tracking_token(UUID) TO anon, authenticated;

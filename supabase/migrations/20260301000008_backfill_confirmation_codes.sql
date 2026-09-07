-- ==============================================================================
-- Migration 8: Backfill delivery confirmation codes and add auto-generation trigger
-- ==============================================================================

-- 1. Backfill all existing orders where delivery_confirmation_code is NULL
UPDATE orders
SET delivery_confirmation_code = LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0')
WHERE delivery_confirmation_code IS NULL;

-- 2. Database Trigger: Automatically generate 6-digit code when order becomes 'out_for_delivery'
CREATE OR REPLACE FUNCTION set_delivery_confirmation_code_if_needed()
RETURNS TRIGGER AS $$
BEGIN
    IF (LOWER(REPLACE(COALESCE(NEW.delivery_status, ''), ' ', '_')) = 'out_for_delivery') 
       AND (NEW.delivery_confirmation_code IS NULL OR NEW.delivery_confirmation_code = '') THEN
        NEW.delivery_confirmation_code := LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_delivery_confirmation_code ON orders;
CREATE TRIGGER trigger_set_delivery_confirmation_code
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_delivery_confirmation_code_if_needed();

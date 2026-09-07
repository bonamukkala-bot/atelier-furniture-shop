-- ==============================================================================
-- Migration: Add estimated delivery fields
-- 1. Add prep_days to shop_settings (shop-wide preparation / handcrafting time)
-- 2. Add transit_min_days and transit_max_days to delivery_zones
-- ==============================================================================

-- 1. Shop Settings: add prep_days
ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS prep_days INTEGER DEFAULT 3;

UPDATE shop_settings 
SET prep_days = 3 
WHERE prep_days IS NULL;

-- 2. Delivery Zones: add transit_min_days and transit_max_days
ALTER TABLE delivery_zones 
ADD COLUMN IF NOT EXISTS transit_min_days INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS transit_max_days INTEGER DEFAULT 4;

UPDATE delivery_zones 
SET transit_min_days = 2 
WHERE transit_min_days IS NULL;

UPDATE delivery_zones 
SET transit_max_days = 4 
WHERE transit_max_days IS NULL;

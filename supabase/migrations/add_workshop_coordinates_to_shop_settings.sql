-- ==============================================================================
-- Migration: Add workshop coordinates to shop_settings
-- Stores the workshop's fixed origin coordinates (lat/lng) and studio address
-- for distance-based delivery calculations.
-- ==============================================================================

ALTER TABLE shop_settings 
ADD COLUMN IF NOT EXISTS workshop_lat DOUBLE PRECISION DEFAULT 17.4375,
ADD COLUMN IF NOT EXISTS workshop_lng DOUBLE PRECISION DEFAULT 78.3975,
ADD COLUMN IF NOT EXISTS workshop_address TEXT DEFAULT 'Atelier Fine Furniture Workshop, Hyderabad';

-- Populate existing row 1 if columns are NULL
UPDATE shop_settings 
SET 
  workshop_lat = COALESCE(workshop_lat, 17.4375),
  workshop_lng = COALESCE(workshop_lng, 78.3975),
  workshop_address = COALESCE(workshop_address, 'Atelier Fine Furniture Workshop, Hyderabad')
WHERE id = 1;

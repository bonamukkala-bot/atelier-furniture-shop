-- ==============================================================================
-- Migration: Add coordinates and calculated distance to delivery_enquiries
-- Saves resolved geocoded coordinates and straight-line distance (km)
-- from workshop origin for accurate delivery partner dispatch and logistics.
-- ==============================================================================

ALTER TABLE delivery_enquiries 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION;

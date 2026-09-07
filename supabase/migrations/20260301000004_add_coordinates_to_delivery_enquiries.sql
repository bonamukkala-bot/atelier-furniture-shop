-- Add coordinates to delivery_enquiries
ALTER TABLE delivery_enquiries 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION;

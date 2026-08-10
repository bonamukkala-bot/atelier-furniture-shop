-- Create product_images table
CREATE TABLE IF NOT EXISTS product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public to read product images
CREATE POLICY "Public can view product images"
  ON product_images
  FOR SELECT
  TO public
  USING (true);

-- Policy: Allow authenticated users to insert product images
CREATE POLICY "Authenticated can insert product images"
  ON product_images
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow authenticated users to update product images
CREATE POLICY "Authenticated can update product images"
  ON product_images
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to delete product images
CREATE POLICY "Authenticated can delete product images"
  ON product_images
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index on product_id for faster queries
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

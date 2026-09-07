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

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_images' AND policyname = 'Public can view product images'
  ) THEN
    CREATE POLICY "Public can view product images" ON product_images FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_images' AND policyname = 'Authenticated can insert product images'
  ) THEN
    CREATE POLICY "Authenticated can insert product images" ON product_images FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_images' AND policyname = 'Authenticated can update product images'
  ) THEN
    CREATE POLICY "Authenticated can update product images" ON product_images FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_images' AND policyname = 'Authenticated can delete product images'
  ) THEN
    CREATE POLICY "Authenticated can delete product images" ON product_images FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- Create index on product_id for faster queries
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

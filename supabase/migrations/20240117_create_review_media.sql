-- Create review_media table to store references to uploaded review images/videos
CREATE TABLE IF NOT EXISTS public.review_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    media_urls TEXT[] NOT NULL DEFAULT '{}',
    reviewer_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_review_media_review_id ON public.review_media(review_id);
CREATE INDEX IF NOT EXISTS idx_review_media_product_id ON public.review_media(product_id);

-- Enable Row Level Security
ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read review media (public reviews)
CREATE POLICY "Anyone can view review media"
    ON public.review_media
    FOR SELECT
    USING (true);

-- Allow service role to insert (edge functions use service role)
CREATE POLICY "Service role can insert review media"
    ON public.review_media
    FOR INSERT
    WITH CHECK (true);

-- Create storage bucket for review media
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-media', 'review-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to read review media files
CREATE POLICY "Public read access for review media"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'review-media');

-- Allow service role to upload review media
CREATE POLICY "Service role can upload review media"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'review-media');

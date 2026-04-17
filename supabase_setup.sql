-- Drop existing table if running iteratively
DROP TABLE IF EXISTS public.slots CASCADE;

-- Create core table
CREATE TABLE public.slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_name TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    booked_by TEXT DEFAULT NULL,
    booked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone can view slots (Public Read access)
CREATE POLICY "Public slots are viewable by everyone."
ON public.slots FOR SELECT USING (true);

-- Policy 2: Anyone can insert slots (for Teacher/Admin dashboard simplicity)
CREATE POLICY "Anyone can insert a slot."
ON public.slots FOR INSERT WITH CHECK (true);

-- Policy 3: Updates are strictly constrained ATOMICALLY.
-- Notice we do NOT grant general UPDATE access here to prevent manual overrides. 
-- The atomic booking is handled securely via the FUNCTION below which runs as definer.

-- Prevent double booking using an Atomic RPC Function
CREATE OR REPLACE FUNCTION book_slot(
  target_slot_id UUID,
  parent_name TEXT
) 
RETURNS json 
LANGUAGE plpgsql
SECURITY DEFINER -- Ensures the function bypasses RLS for the exact targeted atomic update
AS $$
DECLARE
  updated_row json;
BEGIN
  -- Strict single-table atomic constraint execution.
  UPDATE public.slots
  SET booked_by = parent_name, 
      booked_at = NOW()
  WHERE id = target_slot_id AND booked_by IS NULL
  RETURNING row_to_json(public.slots.*) INTO updated_row;

  -- The implicit rowCount trap (if no rows returned, it failed the WHERE condition lock)
  IF updated_row IS NULL THEN
    RAISE EXCEPTION 'Slot already taken or does not exist.';
  END IF;

  RETURN updated_row;
END;
$$;

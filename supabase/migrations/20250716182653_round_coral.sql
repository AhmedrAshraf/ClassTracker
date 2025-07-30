/*
  # Add avatar color to classes table

  1. Changes
    - Add `avatar_color` column to classes table with default green color
    - Update existing classes to have the default color

  2. Security
    - No changes to RLS policies needed
*/

-- Add avatar_color column to classes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'classes' AND column_name = 'avatar_color'
  ) THEN
    ALTER TABLE classes ADD COLUMN avatar_color text DEFAULT '#34C759';
  END IF;
END $$;

-- Update existing classes to have the default color if they don't have one
UPDATE classes SET avatar_color = '#34C759' WHERE avatar_color IS NULL;
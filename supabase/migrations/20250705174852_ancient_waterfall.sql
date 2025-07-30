/*
  # Update negative participation categories

  1. Changes
    - Remove any existing negative categories
    - Add exactly 5 negative categories as specified
    - Keep existing positive categories unchanged

  2. Categories
    - Talking/Disrupting Class
    - Disrespectful Attitude
    - Off-Task
    - Not Following Instructions/Class Rules
    - Unprepared for Class
*/

-- Remove existing negative categories
DELETE FROM participation_categories WHERE is_positive = false;

-- Insert exactly 5 negative categories
INSERT INTO participation_categories (name, is_positive, color) VALUES
  ('Talking/Disrupting Class', false, '#EF4444'),
  ('Disrespectful Attitude', false, '#DC2626'),
  ('Off-Task', false, '#B91C1C'),
  ('Not Following Instructions/Class Rules', false, '#991B1B'),
  ('Unprepared for Class', false, '#7F1D1D');
/*
  # Add negative participation categories

  1. New Categories
    - Add 5 new negative participation categories:
      - Talking/Disrupting Class
      - Disrespectful Attitude  
      - Off-Task
      - Not Following Instructions/Class Rules
      - Unprepared for Class

  2. Security
    - Categories are readable by all authenticated users
    - No changes to existing RLS policies needed
*/

-- Insert new negative participation categories
INSERT INTO participation_categories (name, is_positive, color) VALUES
  ('Talking/Disrupting Class', false, '#EF4444'),
  ('Disrespectful Attitude', false, '#DC2626'),
  ('Off-Task', false, '#F59E0B'),
  ('Not Following Instructions/Class Rules', false, '#EA580C'),
  ('Unprepared for Class', false, '#D97706');
/*
  # Create Goals and Attendance Tables

  1. New Tables
    - `student_goals`
      - `id` (uuid, primary key)
      - `student_id` (uuid, foreign key to students)
      - `title` (text)
      - `description` (text)
      - `target_points` (integer)
      - `current_points` (integer, default 0)
      - `deadline` (date)
      - `is_completed` (boolean, default false)
      - `reward` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `class_rewards`
      - `id` (uuid, primary key)
      - `class_id` (uuid, foreign key to classes)
      - `title` (text)
      - `description` (text)
      - `points_required` (integer)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
    
    - `attendance_records`
      - `id` (uuid, primary key)
      - `student_id` (uuid, foreign key to students)
      - `date` (date)
      - `status` (text) - 'present', 'absent', 'late', 'excused'
      - `notes` (text, optional)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Student Goals Table
CREATE TABLE IF NOT EXISTS student_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_points integer NOT NULL DEFAULT 0,
  current_points integer NOT NULL DEFAULT 0,
  deadline date,
  is_completed boolean DEFAULT false,
  reward text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage goals for their students"
  ON student_goals
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = student_goals.student_id
      AND classes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = student_goals.student_id
      AND classes.user_id = auth.uid()
    )
  );

-- Class Rewards Table
CREATE TABLE IF NOT EXISTS class_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  points_required integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE class_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage rewards for their classes"
  ON class_rewards
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_rewards.class_id
      AND classes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_rewards.class_id
      AND classes.user_id = auth.uid()
    )
  );

-- Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, date)
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage attendance for their students"
  ON attendance_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = attendance_records.student_id
      AND classes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = attendance_records.student_id
      AND classes.user_id = auth.uid()
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_student_goals_updated_at
  BEFORE UPDATE ON student_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
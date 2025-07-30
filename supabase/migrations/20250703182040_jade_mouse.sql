/*
  # Teacher Participation Tracker Database Schema

  1. Tables
    - `classes` - Store class information
    - `students` - Store student information
    - `participation_logs` - Store participation tracking data
    - `categories` - Store participation categories

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
*/

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  grade_level text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  photo_url text,
  total_positive_points integer DEFAULT 0,
  total_negative_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create participation categories table
CREATE TABLE IF NOT EXISTS participation_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_positive boolean DEFAULT true,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

-- Create participation logs table
CREATE TABLE IF NOT EXISTS participation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES participation_categories(id) ON DELETE CASCADE NOT NULL,
  points integer NOT NULL,
  is_positive boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE participation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE participation_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for classes
CREATE POLICY "Users can view their own classes"
  ON classes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own classes"
  ON classes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own classes"
  ON classes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own classes"
  ON classes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for students
CREATE POLICY "Users can view students in their classes"
  ON students FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = students.class_id
      AND classes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert students in their classes"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = students.class_id
      AND classes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update students in their classes"
  ON students FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = students.class_id
      AND classes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = students.class_id
      AND classes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete students in their classes"
  ON students FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = students.class_id
      AND classes.user_id = auth.uid()
    )
  );

-- Create policies for participation categories (public read, admin write)
CREATE POLICY "Anyone can view participation categories"
  ON participation_categories FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for participation logs
CREATE POLICY "Users can view participation logs for their students"
  ON participation_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = participation_logs.student_id
      AND classes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert participation logs for their students"
  ON participation_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = participation_logs.student_id
      AND classes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update participation logs for their students"
  ON participation_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = participation_logs.student_id
      AND classes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = participation_logs.student_id
      AND classes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete participation logs for their students"
  ON participation_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = participation_logs.student_id
      AND classes.user_id = auth.uid()
    )
  );

-- Insert default participation categories
INSERT INTO participation_categories (name, is_positive, color) VALUES
  ('Excellent Participation', true, '#10B981'),
  ('Good Behavior', true, '#3B82F6'),
  ('Helping Others', true, '#8B5CF6'),
  ('Assignment Completion', true, '#059669'),
  ('Disruption', false, '#EF4444'),
  ('Late Assignment', false, '#F59E0B'),
  ('Unprepared', false, '#DC2626');

-- Create function to update student points
CREATE OR REPLACE FUNCTION update_student_points()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_positive THEN
      UPDATE students 
      SET total_positive_points = total_positive_points + NEW.points,
          updated_at = now()
      WHERE id = NEW.student_id;
    ELSE
      UPDATE students 
      SET total_negative_points = total_negative_points + NEW.points,
          updated_at = now()
      WHERE id = NEW.student_id;
    END IF;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_positive THEN
      UPDATE students 
      SET total_positive_points = total_positive_points - OLD.points,
          updated_at = now()
      WHERE id = OLD.student_id;
    ELSE
      UPDATE students 
      SET total_negative_points = total_negative_points - OLD.points,
          updated_at = now()
      WHERE id = OLD.student_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update student points
CREATE TRIGGER update_student_points_trigger
  AFTER INSERT OR DELETE ON participation_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_student_points();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
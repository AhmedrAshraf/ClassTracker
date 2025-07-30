/*
  # Fix users table setup

  1. Tables
    - Ensure `users` table exists with proper structure
    - `id` (uuid, primary key, references auth.users)
    - `name` (text, required)
    - `email` (text, required)
    - `created_at` (timestamptz, default now)
    - `updated_at` (timestamptz, default now)

  2. Security
    - Enable RLS on `users` table
    - Add policies for users to manage their own data

  3. Triggers
    - Add update trigger only if it doesn't already exist
*/

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies (these will be ignored if they already exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = 'Users can view their own profile'
    ) THEN
        CREATE POLICY "Users can view their own profile" ON public.users
          FOR SELECT USING (auth.uid() = id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = 'Users can insert their own profile'
    ) THEN
        CREATE POLICY "Users can insert their own profile" ON public.users
          FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile" ON public.users
          FOR UPDATE USING (auth.uid() = id);
    END IF;
END $$;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_users_updated_at'
        AND tgrelid = 'public.users'::regclass
    ) THEN
        CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON public.users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
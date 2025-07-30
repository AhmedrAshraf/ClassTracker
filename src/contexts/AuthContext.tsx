import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
          // If there's an auth error, clear any stored session data
          if (error.message?.includes('refresh_token_not_found') || error.message?.includes('Invalid Refresh Token')) {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          }
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        // Clear session on unexpected errors
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        // Handle sign out, token refresh errors, or any auth errors
        if (event === 'SIGNED_OUT') {
          // Clear any remaining session data
          setSession(null);
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED') {
          if (!session) {
            // Token refresh failed, clear session
            setSession(null);
            setUser(null);
          }
        } else if (event === 'SIGNED_IN' && !session) {
          // Sign in event but no session indicates an error
          setSession(null);
          setUser(null);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Unexpected sign in error:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      
      // First, sign up the user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          }
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        return { error };
      }

      // If signup was successful and we have a user, create their profile
      if (data.user) {
        try {
          const { error: profileError } = await supabase
            .from('users')
            .insert([
              {
                id: data.user.id,
                name: name.trim(),
                email: email.trim(),
              }
            ]);

          if (profileError) {
            console.error('Profile creation error:', profileError);
            // Don't return this error as the auth signup was successful
            // The user can still use the app, they just might need to update their profile later
          }
        } catch (profileError) {
          console.error('Unexpected profile creation error:', profileError);
        }
      }

      return { error: null };
    } catch (error) {
      console.error('Unexpected sign up error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    // If there's no active session, the user is already signed out
    if (!session) {
      console.log('No active session found, user already signed out');
      return;
    }

    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        // Check if the error is related to missing or invalid session
        if (error.message?.includes('Auth session missing!') || 
            error.message?.includes('Session from session_id claim in JWT does not exist') ||
            error.message?.includes('session_not_found')) {
          // User is effectively signed out, just log as warning
          console.warn('Sign out: Session already invalid or missing');
          // Clear local state to match server state
          setSession(null);
          setUser(null);
        } else {
          // Log other sign out errors normally
          console.error('Sign out error:', error);
        }
      }
    } catch (error) {
      console.error('Unexpected sign out error:', error);
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
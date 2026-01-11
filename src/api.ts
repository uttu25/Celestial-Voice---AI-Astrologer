import { supabase } from './supabaseClient';
import { User, ChatRecord } from './types';

export const api = {
  // --- REAL AUTHENTICATION ---

  // 1. Sign Up (Real User Registration)
  register: async ({ email, password, name }: any) => {
    try {
      // Validate inputs
      if (!email || !password || !name) {
        throw new Error('All fields are required');
      }

      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: { full_name: name },
          emailRedirectTo: undefined // Disable email confirmation for mobile
        },
      });

      if (error) {
        console.error('Signup error:', error);
        // Handle specific Supabase errors
        if (error.message.includes('already registered')) {
          throw new Error('This email is already registered. Please sign in instead.');
        }
        throw error;
      }

      if (data.user) {
        // Wait a bit for auth to settle
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create the public profile entry with retry logic
        let retries = 3;
        let insertError = null;

        while (retries > 0) {
          const { error: err } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: name,
              email: email,
              chat_count: 0,
              is_premium: false,
            });

          if (!err) {
            insertError = null;
            break;
          }

          // If profile exists, it's okay (duplicate key error)
          if (err.code === '23505') {
            insertError = null;
            break;
          }

          insertError = err;
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (insertError) {
          console.error('Profile creation error:', insertError);
          throw new Error('Failed to create user profile. Please try again.');
        }

        return {
          id: data.user.id,
          email,
          name,
          chatCount: 0,
          isPremium: false,
        } as User;
      }
      return null;
    } catch (err: any) {
      console.error('Registration failed:', err);
      throw err;
    }
  },

  // 2. Login (Real Password Check)
  login: async ({ email, password }: any) => {
    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        // Handle specific errors
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please try again.');
        }
        throw error;
      }
      
      if (data.user) {
        // Wait for session to be fully established
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const profile = await api.getUserProfile(data.user.id);
        if (!profile) {
          throw new Error('Profile not found. Please contact support.');
        }
        return profile;
      }
      return null;
    } catch (err: any) {
      console.error('Login failed:', err);
      throw err;
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  },

  getCurrentSession: async () => {
    try {
      // Use getSession instead of relying on cached session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
        return null;
      }

      if (session?.user) {
        const profile = await api.getUserProfile(session.user.id);
        return profile;
      }
      return null;
    } catch (err) {
      console.error('Get session error:', err);
      return null;
    }
  },

  // --- DATA (Profile & Premium Status) ---
  getUserProfile: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error("Profile fetch error:", error);
        // If profile doesn't exist, it might be a new user
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        name: data.full_name || 'User',
        email: data.email,
        chatCount: data.chat_count || 0,
        isPremium: data.is_premium || false,
      } as User;
    } catch (err) {
      console.error('Get profile error:', err);
      return null;
    }
  },

  updateUser: async (userId: string, updates: Partial<User>) => {
    try {
      const dbUpdates: any = {};
      if (updates.isPremium !== undefined) dbUpdates.is_premium = updates.isPremium;
      if (updates.chatCount !== undefined) dbUpdates.chat_count = updates.chatCount;
      if (updates.name !== undefined) dbUpdates.full_name = updates.name;

      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', userId);

      if (error) {
        console.error('Update user error:', error);
        throw error;
      }

      return api.getUserProfile(userId);
    } catch (err) {
      console.error('Update user failed:', err);
      throw err;
    }
  },

  // --- CHAT HISTORY ---
  saveChat: async (userId: string, record: ChatRecord) => {
    try {
      const { error } = await supabase.from('chat_history').insert({
        user_id: userId,
        transcript: record.transcript,
        summary: record.summary,
        timestamp: record.timestamp,
        language: record.language,
      });

      if (error) {
        console.error('Save chat error:', error);
        throw error;
      }
    } catch (err) {
      console.error('Save chat failed:', err);
      // Don't throw - chat history is not critical
    }
  },

  getHistory: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });
      
      if (error) {
        console.error('Get history error:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        transcript: row.transcript,
        summary: row.summary,
        timestamp: row.timestamp,
        language: row.language,
      }));
    } catch (err) {
      console.error('Get history failed:', err);
      return [];
    }
  },
};

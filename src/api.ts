import { supabase } from './supabaseClient';
import { User, ChatRecord } from './types';

export const api = {
  // --- REAL AUTHENTICATION ---

  // 1. Sign Up (Real User Registration)
  register: async ({ email, password, name }: any) => {
    try {
      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });

      if (error) throw error;

      if (data.user) {
        // Create the public profile entry
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            full_name: name,
            email: email,
            chat_count: 0,
            is_premium: false,
          });

        if (insertError) {
          // If profile exists (rare edge case), ignore error
          if (insertError.code !== '23505') throw insertError;
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
    } catch (err) {
      console.error('Registration failed:', err);
      throw err;
    }
  },

  // 2. Login (Real Password Check)
  login: async ({ email, password }: any) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      if (data.user) {
        return await api.getUserProfile(data.user.id);
      }
      return null;
    } catch (err) {
      console.error('Login failed:', err);
      throw err;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  getCurrentSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return await api.getUserProfile(session.user.id);
    }
    return null;
  },

  // --- DATA (Profile & Premium Status) ---
  getUserProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    // If profile is missing but auth exists, handle gracefully
    if (error) {
      console.warn("Profile fetch error:", error);
      return null;
    }

    return {
      id: data.id,
      name: data.full_name,
      email: data.email,
      chatCount: data.chat_count,
      isPremium: data.is_premium,
    } as User;
  },

  updateUser: async (userId: string, updates: Partial<User>) => {
    const dbUpdates: any = {};
    if (updates.isPremium !== undefined) dbUpdates.is_premium = updates.isPremium;
    if (updates.chatCount !== undefined) dbUpdates.chat_count = updates.chatCount;

    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userId);

    if (error) throw error;
    return api.getUserProfile(userId);
  },

  // --- CHAT HISTORY ---
  saveChat: async (userId: string, record: ChatRecord) => {
    await supabase.from('chat_history').insert({
      user_id: userId,
      transcript: record.transcript,
      summary: record.summary,
      timestamp: record.timestamp,
      language: record.language,
    });
  },

  getHistory: async () => {
    const { data } = await supabase
      .from('chat_history')
      .select('*')
      .order('timestamp', { ascending: true }); // fixed sort column
    
    return (data || []).map((row: any) => ({
      id: row.id,
      transcript: row.transcript,
      summary: row.summary,
      timestamp: row.timestamp,
      language: row.language,
    }));
  },
};

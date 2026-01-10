import { supabase } from '../supabaseClient';
import { User, ChatRecord } from '../types';

export const api = {
  // --- AUTH ---
  register: async ({ email, password, name }: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw error;
    if (data.user) return { id: data.user.id, email, name, chatCount: 0, isPremium: false };
    return null;
  },

  login: async ({ email, password }: any) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) return await api.getUserProfile(data.user.id);
    return null;
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  getCurrentSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return await api.getUserProfile(session.user.id);
    return null;
  },

  // --- DATA (Profile & Premium Status) ---
  getUserProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return {
        id: data.id,
        name: data.full_name,
        email: data.email,
        chatCount: data.chat_count,
        isPremium: data.is_premium, // <--- IMPORTANT: Keeps your payment status
        password: '' 
    } as User;
  },

  updateUser: async (userId: string, updates: Partial<User>) => {
    const dbUpdates: any = {};
    if (updates.isPremium !== undefined) dbUpdates.is_premium = updates.isPremium;
    if (updates.chatCount !== undefined) dbUpdates.chat_count = updates.chatCount;

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single();

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
        language: record.language
    });
  },

  getHistory: async () => {
    const { data } = await supabase.from('chat_history').select('*').order('created_at', { ascending: true });
    return (data || []).map((row: any) => ({
        id: row.id,
        transcript: row.transcript,
        summary: row.summary,
        timestamp: row.timestamp,
        language: row.language
    }));
  }
};

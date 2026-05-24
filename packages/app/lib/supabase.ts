import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Note = {
  id: string;
  file_path: string;
  file_name: string;
  type: string | null;
  domain: string | null;
  status: string | null;
  title: string | null;
  body: string | null;
  frontmatter: Record<string, unknown> | null;
  deadline: string | null;
  created_date: string | null;
  last_contact: string | null;
  tags: string[];
  wikilinks: string[];
  file_mtime: string | null;
  synced_at: string;
  deleted: boolean;
};

export type Prayer = {
  id: string;
  note_id: string;
  person_link: string | null;
  category: string | null;
  status: 'active' | 'answered' | 'archived';
  date_started: string | null;
  date_answered: string | null;
  last_prayed_at: string | null;
  created_at: string;
  updated_at: string;
  notes?: Note;
};

export type Capture = {
  id: string;
  raw_text: string;
  capture_mode: 'voice' | 'text' | 'quick-person' | 'quick-prayer' | 'quick-task' | null;
  classified_as: Record<string, unknown> | null;
  filed_to: string | null;
  created_at: string;
};

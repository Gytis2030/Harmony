import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type TypedSupabaseClient = SupabaseClient<Database>;
export type TableRow<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TableInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TableUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

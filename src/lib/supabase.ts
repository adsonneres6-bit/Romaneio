import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          is_admin: boolean;
          active: boolean;
          created_at: string;
          last_login: string | null;
          referral_code: string | null;
        };
        Insert: {
          id: string;
          name: string;
          phone?: string | null;
          is_admin?: boolean;
          active?: boolean;
          created_at?: string;
          last_login?: string | null;
          referral_code?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          is_admin?: boolean;
          active?: boolean;
          created_at?: string;
          last_login?: string | null;
          referral_code?: string | null;
        };
      };
      licenses: {
        Row: {
          id: string;
          user_id: string;
          days: number;
          is_free_trial: boolean;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          days: number;
          is_free_trial?: boolean;
          created_at?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          days?: number;
          is_free_trial?: boolean;
          created_at?: string;
          expires_at?: string;
        };
      };
      import_history: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          total_orders: number;
          total_groups: number;
          checked_groups: number;
          import_time: string;
          export_time: string | null;
          rows_data: Json;
          groups_data: Json;
          headers_data: Json;
          check_state_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          total_orders?: number;
          total_groups?: number;
          checked_groups?: number;
          import_time?: string;
          export_time?: string | null;
          rows_data?: Json;
          groups_data?: Json;
          headers_data?: Json;
          check_state_data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          total_orders?: number;
          total_groups?: number;
          checked_groups?: number;
          import_time?: string;
          export_time?: string | null;
          rows_data?: Json;
          groups_data?: Json;
          headers_data?: Json;
          check_state_data?: Json;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          amount: number | null;
          status: string;
          transaction_id: string | null;
          payment_method: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount?: number | null;
          status?: string;
          transaction_id?: string | null;
          payment_method?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number | null;
          status?: string;
          transaction_id?: string | null;
          payment_method?: string | null;
          created_at?: string;
        };
      };
      pix_settings: {
        Row: {
          id: string;
          pix_key: string | null;
          receiver_name: string | null;
          city: string | null;
          message: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pix_key?: string | null;
          receiver_name?: string | null;
          city?: string | null;
          message?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pix_key?: string | null;
          receiver_name?: string | null;
          city?: string | null;
          message?: string | null;
          updated_at?: string;
        };
      };
      app_settings: {
        Row: {
          id: string;
          show_license_to_users: boolean;
          updated_at: string;
          tutorial_url: string | null;
          max_devices_per_user: number | null;
          trial_days: number | null;
          referral_bonus_days: number | null;
          referral_require_payment: boolean | null;
        };
        Insert: {
          id?: string;
          show_license_to_users?: boolean;
          updated_at?: string;
          tutorial_url?: string | null;
          max_devices_per_user?: number | null;
          trial_days?: number | null;
          referral_bonus_days?: number | null;
          referral_require_payment?: boolean | null;
        };
        Update: {
          id?: string;
          show_license_to_users?: boolean;
          updated_at?: string;
          tutorial_url?: string | null;
          max_devices_per_user?: number | null;
          trial_days?: number | null;
          referral_bonus_days?: number | null;
          referral_require_payment?: boolean | null;
        };
      };
      active_sessions: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          rows_data: Json;
          groups_data: Json;
          headers_data: Json;
          check_state_data: Json;
          total_orders: number;
          checked_count: number;
          completed: boolean;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id?: string;
          file_name: string;
          rows_data?: Json;
          groups_data?: Json;
          headers_data?: Json;
          check_state_data?: Json;
          total_orders?: number;
          checked_count?: number;
          completed?: boolean;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          rows_data?: Json;
          groups_data?: Json;
          headers_data?: Json;
          check_state_data?: Json;
          total_orders?: number;
          checked_count?: number;
          completed?: boolean;
          updated_at?: string;
          created_at?: string;
        };
      };
      referral_codes: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          created_at?: string;
        };
      };
      referrals: {
        Row: {
          id: string;
          referred_user_id: string;
          referred_by_user_id: string;
          referral_code: string;
          status: string;
          created_at: string;
          bonified_at: string | null;
        };
        Insert: {
          id?: string;
          referred_user_id: string;
          referred_by_user_id: string;
          referral_code: string;
          status?: string;
          created_at?: string;
          bonified_at?: string | null;
        };
        Update: {
          id?: string;
          referred_user_id?: string;
          referred_by_user_id?: string;
          referral_code?: string;
          status?: string;
          created_at?: string;
          bonified_at?: string | null;
        };
      };
      referral_bonuses: {
        Row: {
          id: string;
          referrer_user_id: string;
          referred_user_id: string;
          referral_id: string;
          days_granted: number;
          reason: string;
          trigger_type: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          referrer_user_id: string;
          referred_user_id: string;
          referral_id: string;
          days_granted: number;
          reason: string;
          trigger_type?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          referrer_user_id?: string;
          referred_user_id?: string;
          referral_id?: string;
          days_granted?: number;
          reason?: string;
          trigger_type?: string;
          status?: string;
          created_at?: string;
        };
      };
    };
  };
}

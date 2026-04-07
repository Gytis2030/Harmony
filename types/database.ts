export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          bpm: number | null;
          key_signature: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          bpm?: number | null;
          key_signature?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          bpm?: number | null;
          key_signature?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: 'owner' | 'editor' | 'viewer';
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role: 'owner' | 'editor' | 'viewer';
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: 'owner' | 'editor' | 'viewer';
          created_at?: string;
        };
        Relationships: [];
      };
      project_versions: {
        Row: {
          id: string;
          project_id: string;
          created_by: string;
          label: string;
          notes: string | null;
          snapshot_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          created_by: string;
          label: string;
          notes?: string | null;
          snapshot_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          created_by?: string;
          label?: string;
          notes?: string | null;
          snapshot_json?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      tracks: {
        Row: {
          id: string;
          project_id: string;
          uploaded_by: string;
          version_id: string | null;
          name: string;
          file_path: string;
          file_size_bytes: number | null;
          mime_type: string | null;
          duration_sec: number | null;
          sample_rate: number | null;
          channel_count: number | null;
          offset_sec: number;
          waveform_peaks: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          uploaded_by: string;
          version_id?: string | null;
          name: string;
          file_path: string;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          duration_sec?: number | null;
          sample_rate?: number | null;
          channel_count?: number | null;
          offset_sec?: number;
          waveform_peaks?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          uploaded_by?: string;
          version_id?: string | null;
          name?: string;
          file_path?: string;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          duration_sec?: number | null;
          sample_rate?: number | null;
          channel_count?: number | null;
          offset_sec?: number;
          waveform_peaks?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          project_id: string;
          track_id: string | null;
          author_id: string;
          timestamp_sec: number;
          body: string;
          resolved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          track_id?: string | null;
          author_id: string;
          timestamp_sec?: number;
          body: string;
          resolved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          track_id?: string | null;
          author_id?: string;
          timestamp_sec?: number;
          body?: string;
          resolved?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_project_member: {
        Args: {
          target_project_id: string;
        };
        Returns: boolean;
      };
      find_profile_by_email_for_project: {
        Args: {
          target_project_id: string;
          target_email: string;
        };
        Returns: {
          id: string;
          email: string;
          full_name: string | null;
        }[];
      };
      list_project_members_with_profiles: {
        Args: {
          target_project_id: string;
        };
        Returns: {
          user_id: string;
          role: 'owner' | 'editor' | 'viewer';
          created_at: string;
          full_name: string | null;
          email: string;
        }[];
      };
      update_project_track_offsets_atomic: {
        Args: {
          target_project_id: string;
          offset_updates: Json;
        };
        Returns: {
          id: string;
          offset_sec: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectVersion = Database['public']['Tables']['project_versions']['Row'];
export type Track = Database['public']['Tables']['tracks']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];

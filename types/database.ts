export type Profile = {
  id: string;
  display_name: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
};

export type ProjectVersion = {
  id: string;
  project_id: string;
  name: string;
  created_by: string;
  notes: string | null;
  created_at: string;
};

export type Track = {
  id: string;
  project_id: string;
  file_path: string;
  original_filename: string;
  bpm_detected: number | null;
  offset_ms: number;
  duration_ms: number | null;
  sample_rate: number | null;
  uploaded_by: string;
  created_at: string;
};

export type Comment = {
  id: string;
  project_id: string;
  track_id: string | null;
  author_id: string;
  timestamp_ms: number;
  content: string;
  created_at: string;
};

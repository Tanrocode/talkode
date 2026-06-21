import type { AuthRole } from "@/lib/auth/roles";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessments: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          role_name: string;
          status: Database["public"]["Enums"]["assessment_status"];
          time_limit_minutes: number;
          technologies: Database["public"]["Enums"]["assessment_technology"][];
          frontend_technology: Database["public"]["Enums"]["frontend_technology"];
          backend_technology: Database["public"]["Enums"]["backend_technology"];
          job_description: string;
          codebase_template_id: string | null;
          rubric_source: Database["public"]["Enums"]["rubric_source"];
          rubric_text: string;
          candidate_access_code: string;
          due_at: string | null;
          completion_percent: number;
          median_score: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          role_name: string;
          status?: Database["public"]["Enums"]["assessment_status"];
          time_limit_minutes?: number;
          technologies?: Database["public"]["Enums"]["assessment_technology"][];
          frontend_technology?: Database["public"]["Enums"]["frontend_technology"];
          backend_technology?: Database["public"]["Enums"]["backend_technology"];
          job_description?: string;
          codebase_template_id?: string | null;
          rubric_source?: Database["public"]["Enums"]["rubric_source"];
          rubric_text?: string;
          candidate_access_code?: string;
          due_at?: string | null;
          completion_percent?: number;
          median_score?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          title?: string;
          role_name?: string;
          status?: Database["public"]["Enums"]["assessment_status"];
          time_limit_minutes?: number;
          technologies?: Database["public"]["Enums"]["assessment_technology"][];
          frontend_technology?: Database["public"]["Enums"]["frontend_technology"];
          backend_technology?: Database["public"]["Enums"]["backend_technology"];
          job_description?: string;
          codebase_template_id?: string | null;
          rubric_source?: Database["public"]["Enums"]["rubric_source"];
          rubric_text?: string;
          candidate_access_code?: string;
          due_at?: string | null;
          completion_percent?: number;
          median_score?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_codebase_template_id_fkey";
            columns: ["codebase_template_id"];
            isOneToOne: false;
            referencedRelation: "assessment_codebase_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_codebase_templates: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string;
          frontend_technology: Database["public"]["Enums"]["frontend_technology"];
          backend_technology: Database["public"]["Enums"]["backend_technology"];
          technologies: Database["public"]["Enums"]["assessment_technology"][];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string;
          frontend_technology: Database["public"]["Enums"]["frontend_technology"];
          backend_technology: Database["public"]["Enums"]["backend_technology"];
          technologies?: Database["public"]["Enums"]["assessment_technology"][];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string;
          frontend_technology?: Database["public"]["Enums"]["frontend_technology"];
          backend_technology?: Database["public"]["Enums"]["backend_technology"];
          technologies?: Database["public"]["Enums"]["assessment_technology"][];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_codebase_files: {
        Row: {
          id: string;
          codebase_template_id: string;
          path: string;
          language: string;
          content: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codebase_template_id: string;
          path: string;
          language: string;
          content: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codebase_template_id?: string;
          path?: string;
          language?: string;
          content?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_codebase_files_codebase_template_id_fkey";
            columns: ["codebase_template_id"];
            isOneToOne: false;
            referencedRelation: "assessment_codebase_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_rubric_templates: {
        Row: {
          id: string;
          codebase_template_id: string;
          title: string;
          content: string;
          is_mock: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codebase_template_id: string;
          title: string;
          content: string;
          is_mock?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codebase_template_id?: string;
          title?: string;
          content?: string;
          is_mock?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_rubric_templates_codebase_template_id_fkey";
            columns: ["codebase_template_id"];
            isOneToOne: false;
            referencedRelation: "assessment_codebase_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      candidates: {
        Row: {
          id: string;
          organization_id: string;
          assessment_id: string | null;
          full_name: string;
          role_name: string;
          stage: Database["public"]["Enums"]["candidate_stage"];
          score: number | null;
          risk: Database["public"]["Enums"]["candidate_risk"];
          last_activity_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          assessment_id?: string | null;
          full_name: string;
          role_name: string;
          stage?: Database["public"]["Enums"]["candidate_stage"];
          score?: number | null;
          risk?: Database["public"]["Enums"]["candidate_risk"];
          last_activity_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          assessment_id?: string | null;
          full_name?: string;
          role_name?: string;
          stage?: Database["public"]["Enums"]["candidate_stage"];
          score?: number | null;
          risk?: Database["public"]["Enums"]["candidate_risk"];
          last_activity_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidates_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      recruiter_profiles: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          role: AuthRole;
          status: "active" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          role: AuthRole;
          status?: "active" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          full_name?: string;
          role?: AuthRole;
          status?: "active" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recruiter_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      register_candidate_for_assessment: {
        Args: {
          p_access_code: string;
          p_full_name: string;
        };
        Returns: Array<{
          candidate_id: string;
          assessment_id: string;
          assessment_title: string;
          candidate_name: string;
          time_limit_minutes: number;
          expires_at: string | null;
          technologies: Database["public"]["Enums"]["assessment_technology"][];
          code_files: Json;
          rubric_text: string;
        }>;
      };
    };
    Enums: {
      app_role: AuthRole;
      account_status: "active" | "suspended";
      assessment_status: "draft" | "live" | "reviewing" | "complete";
      candidate_stage: "applied" | "assessment" | "interview" | "offer";
      candidate_risk: "low" | "medium" | "high";
      assessment_technology: "react_javascript" | "python";
      frontend_technology: "react_javascript";
      backend_technology: "python";
      rubric_source: "uploaded" | "generated";
    };
    CompositeTypes: Record<string, never>;
  };
};

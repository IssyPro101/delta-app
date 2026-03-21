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
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      integrations: {
        Row: {
          id: string;
          user_id: string;
          provider: "hubspot" | "fathom";
          status: "connected" | "disconnected" | "error";
          access_token: string;
          refresh_token: string | null;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "hubspot" | "fathom";
          status: "connected" | "disconnected" | "error";
          access_token: string;
          refresh_token?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["integrations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      deals: {
        Row: {
          id: string;
          user_id: string;
          external_id: string;
          name: string;
          stage: string;
          outcome: "open" | "won" | "lost";
          amount: number | null;
          close_date: string | null;
          closed_at: string | null;
          company_name: string;
          owner_name: string | null;
          pipeline_name: string;
          last_activity: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          external_id: string;
          name: string;
          stage: string;
          outcome: "open" | "won" | "lost";
          amount?: number | null;
          close_date?: string | null;
          closed_at?: string | null;
          company_name: string;
          owner_name?: string | null;
          pipeline_name: string;
          last_activity?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "deals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      stage_transitions: {
        Row: {
          id: string;
          user_id: string;
          deal_id: string;
          from_stage: string | null;
          to_stage: string;
          transitioned_at: string;
          time_in_stage_hours: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          deal_id: string;
          from_stage?: string | null;
          to_stage: string;
          transitioned_at: string;
          time_in_stage_hours?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stage_transitions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "stage_transitions_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stage_transitions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          user_id: string;
          deal_id: string | null;
          source: "fathom" | "hubspot";
          event_type:
            | "meeting"
            | "deal_stage_change"
            | "deal_amount_change"
            | "contact_activity"
            | "deal_created"
            | "deal_closed";
          title: string;
          summary: string;
          occurred_at: string;
          raw_payload: Json;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          deal_id?: string | null;
          source: "fathom" | "hubspot";
          event_type:
            | "meeting"
            | "deal_stage_change"
            | "deal_amount_change"
            | "contact_activity"
            | "deal_created"
            | "deal_closed";
          title: string;
          summary: string;
          occurred_at: string;
          raw_payload: Json;
          metadata: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "events_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      insights: {
        Row: {
          id: string;
          user_id: string;
          analyzer: string;
          category: "leak" | "pattern" | "risk";
          severity: "high" | "medium" | "low";
          title: string;
          description: string;
          data: Json;
          affected_deals: string[];
          pipeline_name: string | null;
          is_active: boolean;
          generated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          analyzer: string;
          category: "leak" | "pattern" | "risk";
          severity: "high" | "medium" | "low";
          title: string;
          description: string;
          data: Json;
          affected_deals: string[];
          pipeline_name?: string | null;
          is_active?: boolean;
          generated_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["insights"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "insights_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

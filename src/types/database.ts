import type { Json } from '@/types/json'

export type AppRole = 'super_admin' | 'client_admin' | 'event_manager'

export type GameType = 'photo' | 'video' | 'quiz' | 'music_bingo'
export type PointsType = 'static' | 'range'
export type GameStatus = 'active' | 'draft' | 'archived' | 'ready'
export type EventStatus = 'active' | 'ready' | 'draft' | 'archived'

type OrgRow = {
  id: string
  name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  vat_number: string | null
  address: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_postal: string | null
  address_country: string | null
  tablet_password: string | null
  tablet_slug: string
  subdomain: string
  custom_domain: string | null
  billing_plan: string
  contact_email: string | null
  account_status: string
  internal_notes: string | null
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          role: AppRole
          organization_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          role?: AppRole
          organization_id?: string | null
        }
        Update: {
          full_name?: string | null
          role?: AppRole
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: OrgRow
        Insert: Partial<Omit<OrgRow, 'id' | 'created_at' | 'updated_at'>> & {
          id?: string
        }
        Update: Partial<Omit<OrgRow, 'id' | 'created_at'>>
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          name: string
          email: string
          role: string
          invited_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          email: string
          role?: string
          invited_at?: string
          accepted_at?: string | null
        }
        Update: {
          name?: string
          email?: string
          role?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      game_groups: {
        Row: {
          id: string
          organization_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
        }
        Update: { name?: string }
        Relationships: []
      }
      game_group_items: {
        Row: {
          id: string
          group_id: string
          game_id: string
        }
        Insert: {
          id?: string
          group_id: string
          game_id: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      games: {
        Row: {
          id: string
          organization_id: string
          name: string
          type: GameType
          description: string | null
          cover_url: string | null
          points_type: PointsType
          points_static: number | null
          points_min: number | null
          points_max: number | null
          solution_description: string | null
          solution_image_url: string | null
          status: string
          config: Json
          is_default_for_new_clients: boolean
          is_platform_template: boolean
          source_template_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          type: GameType
          description?: string | null
          cover_url?: string | null
          points_type?: PointsType
          points_static?: number | null
          points_min?: number | null
          points_max?: number | null
          solution_description?: string | null
          solution_image_url?: string | null
          status?: string
          config?: Json
          is_default_for_new_clients?: boolean
          is_platform_template?: boolean
          source_template_id?: string | null
        }
        Update: {
          name?: string
          type?: GameType
          description?: string | null
          cover_url?: string | null
          points_type?: PointsType
          points_static?: number | null
          points_min?: number | null
          points_max?: number | null
          solution_description?: string | null
          solution_image_url?: string | null
          status?: string
          config?: Json
          is_default_for_new_clients?: boolean
          is_platform_template?: boolean
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          id: string
          organization_id: string
          subject: string
          body: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          subject: string
          body?: string | null
          status?: string
        }
        Update: {
          subject?: string
          body?: string | null
          status?: string
        }
        Relationships: []
      }
      support_ticket_replies: {
        Row: {
          id: string
          ticket_id: string
          body: string
          is_staff: boolean
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          body: string
          is_staff?: boolean
        }
        Update: Record<string, never>
        Relationships: []
      }
      events: {
        Row: {
          id: string
          organization_id: string
          name: string
          event_date: string | null
          status: string
          team_count: number
          branding_enabled: boolean
          logo_url: string | null
          brand_colors: Json
          teams_config: Json
          stages_config: Json
          display_layout: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          event_date?: string | null
          status?: string
          team_count?: number
          branding_enabled?: boolean
          logo_url?: string | null
          brand_colors?: Json
          teams_config?: Json
          stages_config?: Json
          display_layout?: string
        }
        Update: {
          name?: string
          event_date?: string | null
          status?: string
          team_count?: number
          branding_enabled?: boolean
          logo_url?: string | null
          brand_colors?: Json
          teams_config?: Json
          stages_config?: Json
          display_layout?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          event_id: string
          name: string | null
          color: string | null
          photo_url: string | null
          score: number
          status: string
          slot_number: number
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name?: string | null
          color?: string | null
          photo_url?: string | null
          score?: number
          status?: string
          slot_number: number
        }
        Update: {
          name?: string | null
          color?: string | null
          photo_url?: string | null
          score?: number
          status?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          id: string
          event_id: string
          team_id: string
          game_id: string
          media_url: string | null
          media_type: string | null
          status: string
          points_awarded: number | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          team_id: string
          game_id: string
          media_url?: string | null
          media_type?: string | null
          status?: string
          points_awarded?: number | null
        }
        Update: {
          media_url?: string | null
          media_type?: string | null
          status?: string
          points_awarded?: number | null
        }
        Relationships: []
      }
      event_state: {
        Row: {
          id: string
          event_id: string
          current_stage_index: number
          current_question_index: number
          timer_seconds: number
          timer_running: boolean
          show_scores: boolean
          show_timer_on_display: boolean
          quiz_state: string
          bingo_state: string
          announcement: string | null
          announcement_target: string | null
          winner_reveal_stage: number
          break_timer_seconds: number | null
          break_timer_running: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          current_stage_index?: number
          current_question_index?: number
          timer_seconds?: number
          timer_running?: boolean
          show_scores?: boolean
          show_timer_on_display?: boolean
          quiz_state?: string
          bingo_state?: string
          announcement?: string | null
          announcement_target?: string | null
          winner_reveal_stage?: number
          break_timer_seconds?: number | null
          break_timer_running?: boolean
        }
        Update: {
          current_stage_index?: number
          current_question_index?: number
          timer_seconds?: number
          timer_running?: boolean
          show_scores?: boolean
          show_timer_on_display?: boolean
          quiz_state?: string
          bingo_state?: string
          announcement?: string | null
          announcement_target?: string | null
          winner_reveal_stage?: number
          break_timer_seconds?: number | null
          break_timer_running?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          event_id: string
          team_id: string | null
          sender: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          team_id?: string | null
          sender: string
          message: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      event_games: {
        Row: {
          id: string
          event_id: string
          game_id: string
        }
        Insert: {
          id?: string
          event_id: string
          game_id: string
        }
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: {
      organization_tenant_public: {
        Row: {
          id: string
          subdomain: string
          custom_domain: string | null
          name: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          accent_color: string
          tablet_slug: string
        }
        Relationships: []
      }
    }
    Functions: {
      verify_tablet_password: {
        Args: { p_org_id: string; p_password: string }
        Returns: boolean
      }
      resolve_tenant_by_host: {
        Args: { p_host: string }
        Returns: Database['public']['Views']['organization_tenant_public']['Row'][]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

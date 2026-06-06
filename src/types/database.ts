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
  email: string | null
  phone: string | null
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
          list_order: number
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
          list_order?: number
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
          list_order?: number
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
          ticket_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          subject: string
          body?: string | null
          status?: string
          ticket_number?: string | null
        }
        Update: {
          subject?: string
          body?: string | null
          status?: string
          updated_at?: string
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
      support_ticket_messages: {
        Row: {
          id: string
          ticket_id: string
          sender_role: 'client' | 'support'
          sender_name: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          sender_role: 'client' | 'support'
          sender_name: string
          body: string
          created_at?: string
        }
        Update: {
          body?: string
        }
        Relationships: []
      }
      support_ticket_reads: {
        Row: {
          id: string
          ticket_id: string
          user_id: string
          viewer_role: 'client' | 'support'
          last_viewed_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          user_id: string
          viewer_role: 'client' | 'support'
          last_viewed_at?: string
        }
        Update: {
          last_viewed_at?: string
        }
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
          display_text_color: string
          list_order: number
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
          display_text_color?: string
          list_order?: number
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
          display_text_color?: string
          list_order?: number
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
          quiz_timer_seconds: number | null
          quiz_timer_running: boolean
          show_scores: boolean
          show_timer_on_display: boolean
          quiz_state: string
          bingo_state: string
          bingo_revealed_track_ids: unknown
          bingo_winner_team_id: string | null
          bingo_announced_winner_ids: unknown
          bingo_bonus_id: string | null
          announcement: string | null
          announcement_target: string | null
          winner_reveal_stage: number
          break_timer_seconds: number | null
          break_timer_running: boolean
          submissions_open: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          current_stage_index?: number
          current_question_index?: number
          timer_seconds?: number
          timer_running?: boolean
          quiz_timer_seconds?: number | null
          quiz_timer_running?: boolean
          show_scores?: boolean
          show_timer_on_display?: boolean
          quiz_state?: string
          bingo_state?: string
          bingo_revealed_track_ids?: unknown
          bingo_winner_team_id?: string | null
          bingo_announced_winner_ids?: unknown
          bingo_bonus_id?: string | null
          announcement?: string | null
          announcement_target?: string | null
          winner_reveal_stage?: number
          break_timer_seconds?: number | null
          break_timer_running?: boolean
          submissions_open?: boolean
        }
        Update: {
          current_stage_index?: number
          current_question_index?: number
          timer_seconds?: number
          timer_running?: boolean
          quiz_timer_seconds?: number | null
          quiz_timer_running?: boolean
          show_scores?: boolean
          show_timer_on_display?: boolean
          quiz_state?: string
          bingo_state?: string
          bingo_revealed_track_ids?: unknown
          bingo_winner_team_id?: string | null
          bingo_announced_winner_ids?: unknown
          bingo_bonus_id?: string | null
          announcement?: string | null
          announcement_target?: string | null
          winner_reveal_stage?: number
          break_timer_seconds?: number | null
          break_timer_running?: boolean
          submissions_open?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      music_catalog: {
        Row: {
          id: string
          organization_id: string
          artist: string
          title: string
          audio_url: string
          clip_url: string | null
          clip_start_seconds: number
          clip_duration_seconds: number
          duration_seconds: number | null
          source_filename: string | null
          parse_confidence: number | null
          license_confirmed_at: string | null
          license_confirmed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          artist?: string
          title?: string
          audio_url: string
          clip_url?: string | null
          clip_start_seconds?: number
          clip_duration_seconds?: number
          duration_seconds?: number | null
          source_filename?: string | null
          parse_confidence?: number | null
          license_confirmed_at?: string | null
          license_confirmed_by?: string | null
        }
        Update: {
          artist?: string
          title?: string
          audio_url?: string
          clip_url?: string | null
          clip_start_seconds?: number
          clip_duration_seconds?: number
          duration_seconds?: number | null
          license_confirmed_at?: string | null
        }
        Relationships: []
      }
      bingo_runs: {
        Row: {
          id: string
          event_id: string
          game_id: string
          stage_index: number
          play_order: Json
          current_play_index: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          game_id: string
          stage_index: number
          play_order?: Json
          current_play_index?: number
          status?: string
        }
        Update: {
          play_order?: Json
          current_play_index?: number
          status?: string
        }
        Relationships: []
      }
      bingo_team_cards: {
        Row: {
          run_id: string
          team_id: string
          cells: Json
        }
        Insert: {
          run_id: string
          team_id: string
          cells: Json
        }
        Update: {
          cells?: Json
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
      support_unread_ticket_count: {
        Args: { p_viewer_role: string }
        Returns: number
      }
      mark_support_ticket_read: {
        Args: { p_ticket_id: string; p_viewer_role: string }
        Returns: undefined
      }
      support_unread_counts_by_ticket: {
        Args: { p_viewer_role: string }
        Returns: { ticket_id: string; unread_count: number }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

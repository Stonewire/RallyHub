import type { Json } from '@/types/json'

export type AppRole = 'super_admin' | 'client_admin' | 'event_manager' | 'facilitator'

export type GameType = 'photo' | 'video' | 'quiz' | 'music_bingo' | 'text'
export type PointsType = 'static' | 'range'
export type GameStatus = 'active' | 'draft' | 'archived' | 'ready'
export type EventStatus = 'active' | 'demo' | 'ready' | 'draft' | 'archived'

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
  billing_period: string
  contact_email: string | null
  email: string | null
  phone: string | null
  account_status: string
  trial_ends_at: string | null
  trial_review_needed: boolean
  educational_status: string
  hide_platform_branding: boolean
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
          username: string
          full_name: string | null
          first_name: string | null
          last_name: string | null
          role: AppRole
          organization_id: string | null
          must_change_password: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string
          full_name?: string | null
          first_name?: string | null
          last_name?: string | null
          role?: AppRole
          organization_id?: string | null
          must_change_password?: boolean
        }
        Update: {
          username?: string
          full_name?: string | null
          first_name?: string | null
          last_name?: string | null
          role?: AppRole
          organization_id?: string | null
          must_change_password?: boolean
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
          invoice_paid: boolean
          invoiced_at: string | null
          wiped_at: string | null
          join_token: string
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
          invoice_paid?: boolean
          invoiced_at?: string | null
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
          invoice_paid?: boolean
          invoiced_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          event_id: string
          organization_id: string
          plan_key: string
          amount: number
          discount: number
          amount_due: number
          status: 'unpaid' | 'paid' | 'comped'
          promo_code_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          organization_id: string
          plan_key: string
          amount: number
          discount?: number
          amount_due: number
          status: 'unpaid' | 'paid' | 'comped'
          promo_code_id?: string | null
          created_at?: string
        }
        Update: {
          status?: 'unpaid' | 'paid' | 'comped'
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          id: string
          code: string
          purpose: 'event' | 'subscription'
          discount_percent: number
          duration_months: number | null
          max_redemptions: number | null
          redemption_count: number
          is_active: boolean
          notes: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          code: string
          purpose: 'event' | 'subscription'
          discount_percent?: number
          duration_months?: number | null
          max_redemptions?: number | null
          redemption_count?: number
          is_active?: boolean
          notes?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          code?: string
          discount_percent?: number
          duration_months?: number | null
          max_redemptions?: number | null
          is_active?: boolean
          notes?: string | null
        }
        Relationships: []
      }
      event_activity_log: {
        Row: {
          id: string
          event_id: string
          organization_id: string
          actor_type: 'team' | 'facilitator' | 'admin' | 'system'
          actor_name: string | null
          actor_id: string | null
          action: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          organization_id: string
          actor_type: 'team' | 'facilitator' | 'admin' | 'system'
          actor_name?: string | null
          actor_id?: string | null
          action: string
          details?: Json | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      promo_code_redemptions: {
        Row: {
          id: string
          promo_code_id: string
          organization_id: string
          purpose: 'event' | 'subscription'
          discount_percent: number
          duration_months: number | null
          status: 'active' | 'used' | 'expired'
          applied_at: string | null
          applied_event_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          promo_code_id: string
          organization_id: string
          purpose: 'event' | 'subscription'
          discount_percent: number
          duration_months?: number | null
          status?: 'active' | 'used' | 'expired'
          applied_at?: string | null
          applied_event_id?: string | null
          created_at?: string
        }
        Update: {
          status?: 'active' | 'used' | 'expired'
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
          quiz_correct_answer_id: string | null
          bingo_state: string
          bingo_revealed_track_ids: unknown
          bingo_winner_team_id: string | null
          bingo_announced_winner_ids: unknown
          bingo_bonus_id: string | null
          bingo_used_bonus_ids: unknown
          announcement: string | null
          announcement_target: string | null
          winner_reveal_stage: number
          winner_sound_targets: string[] | null
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
          quiz_correct_answer_id?: string | null
          bingo_state?: string
          bingo_revealed_track_ids?: unknown
          bingo_winner_team_id?: string | null
          bingo_announced_winner_ids?: unknown
          bingo_bonus_id?: string | null
          bingo_used_bonus_ids?: unknown
          announcement?: string | null
          announcement_target?: string | null
          winner_reveal_stage?: number
          winner_sound_targets?: string[] | null
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
          quiz_correct_answer_id?: string | null
          bingo_state?: string
          bingo_revealed_track_ids?: unknown
          bingo_winner_team_id?: string | null
          bingo_announced_winner_ids?: unknown
          bingo_bonus_id?: string | null
          bingo_used_bonus_ids?: unknown
          announcement?: string | null
          announcement_target?: string | null
          winner_reveal_stage?: number
          winner_sound_targets?: string[] | null
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
          paid_line_bonus_team_ids: Json
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
          paid_line_bonus_team_ids?: Json
        }
        Update: {
          play_order?: Json
          current_play_index?: number
          status?: string
          paid_line_bonus_team_ids?: Json
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
      expire_overdue_trials: {
        Args: Record<string, never>
        Returns: undefined
      }
      log_event_activity: {
        Args: {
          p_event_id: string
          p_actor_type: string
          p_actor_name: string
          p_action: string
          p_actor_id?: string | null
          p_details?: Json | null
        }
        Returns: undefined
      }
      increment_team_score: {
        Args: { p_team_id: string; p_delta: number }
        Returns: undefined
      }
      reset_event_data: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      wipe_event_data: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      delete_organization_cascade: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      verify_tablet_password: {
        Args: { p_org_id: string; p_password: string }
        Returns: string | null
      }
      validate_tablet_session: {
        Args: { p_org_id: string; p_token: string }
        Returns: boolean
      }
      redeem_promo_code: {
        Args: { p_code: string }
        Returns: {
          id: string
          promo_code_id: string
          organization_id: string
          purpose: 'event' | 'subscription'
          discount_percent: number
          duration_months: number | null
          status: 'active' | 'used' | 'expired'
          applied_at: string | null
          applied_event_id: string | null
          created_at: string
        }
      }
      resolve_login_email: {
        Args: { p_identifier: string }
        Returns: string
      }
      get_organization_facilitators: {
        Args: { p_org_id: string }
        Returns: {
          id: string
          username: string
          email: string
          first_name: string | null
          last_name: string | null
          created_at: string
        }[]
      }
      get_organization_users: {
        Args: { p_org_id: string }
        Returns: {
          id: string
          username: string
          email: string
          first_name: string | null
          last_name: string | null
          role: AppRole
          must_change_password: boolean
          created_at: string
        }[]
      }
      clear_must_change_password: {
        Args: Record<string, never>
        Returns: undefined
      }
      remove_organization_user: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: undefined
      }
      get_organization_tenant_public: {
        Args: { p_org_id: string }
        Returns: Database['public']['Views']['organization_tenant_public']['Row'][]
      }
      get_organization_tenant_by_subdomain: {
        Args: { p_subdomain: string }
        Returns: Database['public']['Views']['organization_tenant_public']['Row'][]
      }
      get_organizations_by_tablet_slug: {
        Args: { p_tablet_slug: string }
        Returns: Database['public']['Views']['organization_tenant_public']['Row'][]
      }
      resolve_tenant_by_host: {
        Args: { p_host: string }
        Returns: Database['public']['Views']['organization_tenant_public']['Row'][]
      }
      bootstrap_live_event_access: {
        Args: { p_event_id: string }
        Returns: string
      }
      get_live_event_games: {
        Args: { p_event_id: string }
        Returns: Database['public']['Tables']['games']['Row'][]
      }
      score_current_quiz_question: {
        Args: { p_event_id: string; p_game_id: string; p_question_id: string }
        Returns: undefined
      }
      get_tablet_events_for_org: {
        Args: { p_org_id: string }
        Returns: Database['public']['Tables']['events']['Row'][]
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

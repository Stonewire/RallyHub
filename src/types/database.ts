import type { Json } from '@/types/json'

/** One file attached to a support ticket. Stored as jsonb on the ticket row. */
export type SupportTicketAttachment = {
  /** Object key in the PRIVATE support-attachments bucket. Never a URL. */
  path: string
  name: string
  size: number
  type: string
}

export type AppRole = 'super_admin' | 'client_admin' | 'event_manager' | 'facilitator'

/** Internal RallyHub staff tier; only meaningful on super_admin profiles. */
export type StaffRole =
  | 'owner'
  | 'platform_admin'
  | 'support_agent'
  | 'content_manager'
  | 'finance'

export type GameType = 'photo' | 'video' | 'quiz' | 'music_bingo' | 'text' | 'puzzle'
export type PointsType = 'static' | 'range'
export type GameStatus = 'active' | 'draft' | 'archived' | 'ready'
export type EventStatus = 'active' | 'demo' | 'ready' | 'draft' | 'archived'
/** Internal readiness tracking for a game asset. Separate from GameStatus (publish). */
export type GamePrepStatus = 'draft' | 'in_progress' | 'done' | 'needs_attention'
export type EventTaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'

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
  paddle_customer_id: string | null
  paddle_subscription_id: string | null
  subscription_status: string | null
  subscription_current_period_end: string | null
  contact_email: string | null
  email: string | null
  phone: string | null
  account_status: string
  trial_ends_at: string | null
  trial_review_needed: boolean
  educational_status: string
  hide_platform_branding: boolean
  logo_light_url: string | null
  logo_dark_url: string | null
  brand_heading_font: string | null
  brand_body_font: string | null
  brand_heading_font_url: string | null
  brand_body_font_url: string | null
  internal_notes: string | null
  default_language: string
  is_demo: boolean
  demo_reset_at: string | null
  demo_last_reset_at: string | null
  demo_reset_interval_minutes: number
  demo_generation: number
  demo_user_id: string | null
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
          phone: string | null
          avatar_url: string | null
          role: AppRole
          staff_role: StaffRole | null
          organization_id: string | null
          must_change_password: boolean
          onboarding_completed_tasks: string[]
          onboarding_dismissed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string
          full_name?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          role?: AppRole
          organization_id?: string | null
          must_change_password?: boolean
        }
        Update: {
          username?: string
          full_name?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
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
      organization_deletion_requests: {
        Row: {
          organization_id: string
          requested_by: string | null
          requested_at: string
          scheduled_for: string
          paddle_cancellation_scheduled: boolean
          paddle_cancellation_error: string | null
        }
        Insert: {
          organization_id: string
          requested_by?: string | null
          requested_at?: string
          scheduled_for: string
          paddle_cancellation_scheduled?: boolean
          paddle_cancellation_error?: string | null
        }
        Update: {
          scheduled_for?: string
          paddle_cancellation_scheduled?: boolean
          paddle_cancellation_error?: string | null
        }
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
          prep_status: GamePrepStatus
          config: Json
          is_default_for_new_clients: boolean
          is_platform_template: boolean
          source_template_id: string | null
          list_order: number
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_name: string | null
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
          prep_status?: GamePrepStatus
          config?: Json
          is_default_for_new_clients?: boolean
          is_platform_template?: boolean
          source_template_id?: string | null
          list_order?: number
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
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
          prep_status?: GamePrepStatus
          config?: Json
          is_default_for_new_clients?: boolean
          is_platform_template?: boolean
          list_order?: number
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          id: string
          organization_id: string
          subject: string
          body: string | null
          category: string | null
          status: string
          ticket_number: string | null
          attachments: SupportTicketAttachment[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          subject: string
          body?: string | null
          category?: string | null
          status?: string
          ticket_number?: string | null
          attachments?: SupportTicketAttachment[]
        }
        Update: {
          subject?: string
          body?: string | null
          category?: string | null
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
          slug: string | null
          event_date: string | null
          location: string | null
          status: string
          language: string
          multilingual: boolean
          available_languages: string[]
          team_count: number
          branding_enabled: boolean
          inventory_enabled: boolean
          logo_url: string | null
          brand_colors: Json
          teams_config: Json
          stages_config: Json
          store_config: Json
          checklist_state: Json
          display_layout: string
          display_text_color: string
          list_order: number
          invoice_paid: boolean
          invoiced_at: string | null
          /** Set when the event goes live. What the plan's monthly limit counts. */
          activated_at: string | null
          wiped_at: string | null
          deleted_at: string | null
          join_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          event_date?: string | null
          location?: string | null
          status?: string
          language?: string
          multilingual?: boolean
          available_languages?: string[]
          team_count?: number
          branding_enabled?: boolean
          inventory_enabled?: boolean
          logo_url?: string | null
          brand_colors?: Json
          teams_config?: Json
          stages_config?: Json
          store_config?: Json
          checklist_state?: Json
          display_layout?: string
          display_text_color?: string
          list_order?: number
          invoice_paid?: boolean
          invoiced_at?: string | null
          activated_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          name?: string
          event_date?: string | null
          location?: string | null
          status?: string
          language?: string
          multilingual?: boolean
          available_languages?: string[]
          team_count?: number
          branding_enabled?: boolean
          inventory_enabled?: boolean
          logo_url?: string | null
          brand_colors?: Json
          teams_config?: Json
          stages_config?: Json
          store_config?: Json
          checklist_state?: Json
          display_layout?: string
          display_text_color?: string
          list_order?: number
          invoice_paid?: boolean
          invoiced_at?: string | null
          activated_at?: string | null
          deleted_at?: string | null
        }
        Relationships: []
      }
      event_tasks: {
        Row: {
          id: string
          event_id: string
          organization_id: string
          name: string
          assignee: string | null
          description: string | null
          due_date: string | null
          status: EventTaskStatus
          list_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          organization_id: string
          name: string
          assignee?: string | null
          description?: string | null
          due_date?: string | null
          status?: EventTaskStatus
          list_order?: number
        }
        Update: {
          name?: string
          assignee?: string | null
          description?: string | null
          due_date?: string | null
          status?: EventTaskStatus
          list_order?: number
          updated_at?: string
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
          included_team_count: number
          extra_team_count: number
          extra_team_fee: number
          status: 'unpaid' | 'paid' | 'comped' | 'refunded'
          promo_code_id: string | null
          paddle_transaction_id: string | null
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
          included_team_count?: number
          extra_team_count?: number
          extra_team_fee?: number
          status: 'unpaid' | 'paid' | 'comped' | 'refunded'
          promo_code_id?: string | null
          paddle_transaction_id?: string | null
          created_at?: string
        }
        Update: {
          status?: 'unpaid' | 'paid' | 'comped' | 'refunded'
          paddle_transaction_id?: string | null
          included_team_count?: number
          extra_team_count?: number
          extra_team_fee?: number
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          id: string
          user_id: string
          organization_id: string | null
          document: 'terms' | 'privacy' | 'dpa'
          version: number
          accepted_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id?: string | null
          document: 'terms' | 'privacy' | 'dpa'
          version: number
          accepted_at?: string
        }
        /** Append-only: there is no UPDATE policy, by design. */
        Update: never
        Relationships: []
      }
      subscription_transactions: {
        Row: {
          id: string
          organization_id: string
          paddle_transaction_id: string
          paddle_subscription_id: string | null
          plan_key: string
          billing_period: string
          amount: number
          amount_due: number
          currency: string
          status: 'pending' | 'paid' | 'failed' | 'canceled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          paddle_transaction_id: string
          paddle_subscription_id?: string | null
          plan_key: string
          billing_period: string
          amount: number
          amount_due: number
          currency?: string
          status?: 'pending' | 'paid' | 'failed' | 'canceled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'pending' | 'paid' | 'failed' | 'canceled'
          paddle_subscription_id?: string | null
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
          /** Language this team picked on a multilingual event; null follows the event. */
          language: string | null
          created_at: string
          /** Bumped by takeover_team_slot; devices holding an older value log out. */
          session_epoch: number
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
          language?: string | null
          session_epoch?: number
        }
        Update: {
          name?: string | null
          color?: string | null
          photo_url?: string | null
          score?: number
          status?: string
          language?: string | null
          session_epoch?: number
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
          created_at?: string
        }
        Update: {
          media_url?: string | null
          media_type?: string | null
          status?: string
          points_awarded?: number | null
        }
        Relationships: []
      }
      client_diagnostics: {
        Row: {
          id: string
          created_at: string
          event_id: string | null
          team_id: string | null
          context: string
          platform: string
          message: string
          detail: Json | null
        }
        Insert: {
          id?: string
          event_id?: string | null
          team_id?: string | null
          context: string
          platform: string
          message: string
          detail?: Json | null
        }
        Update: {
          event_id?: string | null
          team_id?: string | null
          context?: string
          platform?: string
          message?: string
          detail?: Json | null
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
          hide_team_points: boolean
          store_open: boolean
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
          hide_team_points?: boolean
          store_open?: boolean
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
          hide_team_points?: boolean
          store_open?: boolean
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
          clip_in_point_seconds: number | null
          clip_duration_seconds: number
          duration_seconds: number | null
          source_filename: string | null
          genre: string | null
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
          clip_in_point_seconds?: number | null
          clip_duration_seconds?: number
          duration_seconds?: number | null
          source_filename?: string | null
          genre?: string | null
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
          clip_in_point_seconds?: number | null
          clip_duration_seconds?: number
          duration_seconds?: number | null
          genre?: string | null
          license_confirmed_at?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          id: string
          organization_id: string
          public_code: string
          name: string
          description: string | null
          points_cost: number
          image_url: string | null
          is_active: boolean
          checklist_items: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          public_code?: string
          name: string
          description?: string | null
          points_cost: number
          image_url?: string | null
          is_active?: boolean
          checklist_items?: string[]
        }
        Update: {
          name?: string
          description?: string | null
          points_cost?: number
          image_url?: string | null
          is_active?: boolean
          checklist_items?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      inventory_groups: {
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
      inventory_group_items: {
        Row: {
          id: string
          group_id: string
          item_id: string
        }
        Insert: {
          id?: string
          group_id: string
          item_id: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      inventory_purchases: {
        Row: {
          id: string
          inventory_item_id: string | null
          organization_id: string
          event_id: string
          team_id: string
          item_name: string
          points_cost: number
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      inventory_orders: {
        Row: {
          id: string
          event_id: string
          team_id: string
          organization_id: string
          status: 'pending' | 'done' | 'cancelled'
          total_points: number
          created_at: string
          completed_at: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      inventory_order_items: {
        Row: {
          id: string
          order_id: string
          inventory_item_id: string | null
          item_name: string
          quantity: number
          points_cost_each: number
          fulfilled: boolean
          completed_at: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      music_playlists: {
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
        Update: {
          name?: string
        }
        Relationships: []
      }
      music_playlist_tracks: {
        Row: {
          playlist_id: string
          track_id: string
          added_at: string
        }
        Insert: {
          playlist_id: string
          track_id: string
        }
        Update: {
          playlist_id?: string
          track_id?: string
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
      event_puzzle_progress: {
        Row: {
          event_id: string
          team_id: string
          game_id: string
          puzzle_type: 'wordle' | 'matching' | 'crossword'
          attempts: number
          wrong_matches: number
          wordle_guesses: Json
          matched_pair_ids: string[]
          filled_cells: Json
          failed_full_checks: number
          completed_at: string | null
          points_awarded: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          event_id: string
          team_id: string
          game_id: string
          puzzle_type: 'wordle' | 'matching' | 'crossword'
          attempts?: number
          wrong_matches?: number
          wordle_guesses?: Json
          matched_pair_ids?: string[]
          filled_cells?: Json
          failed_full_checks?: number
          completed_at?: string | null
          points_awarded?: number | null
        }
        Update: {
          attempts?: number
          wrong_matches?: number
          wordle_guesses?: Json
          matched_pair_ids?: string[]
          filled_cells?: Json
          failed_full_checks?: number
          completed_at?: string | null
          points_awarded?: number | null
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
      get_inventory_item_for_purchase: {
        Args: { p_public_code: string; p_event_id: string }
        Returns: {
          id: string
          name: string
          description: string | null
          points_cost: number
          image_url: string | null
        }[]
      }
      claim_team_with_inventory_access: {
        Args: {
          p_event_id: string
          p_team_id: string
          p_name: string
          p_photo_url?: string | null
        }
        Returns: {
          id: string
          event_id: string
          name: string | null
          color: string | null
          photo_url: string | null
          score: number
          status: string
          slot_number: number
          created_at: string
          inventory_purchase_token: string
        }[]
      }
      takeover_team_slot: {
        Args: {
          p_event_id: string
          p_team_id: string
          p_password: string
        }
        Returns: {
          id: string
          event_id: string
          name: string | null
          color: string | null
          photo_url: string | null
          score: number
          status: string
          slot_number: number
          created_at: string
          session_epoch: number
          inventory_purchase_token: string
        }[]
      }
      get_event_store: {
        Args: { p_event_id: string; p_purchase_token: string }
        Returns: {
          item_id: string
          name: string
          description: string | null
          image_url: string | null
          points_cost: number
          total_stock: number
          per_team_limit: number
          sold: number
          my_team_qty: number
          team_score: number
        }[]
      }
      place_store_order: {
        Args: { p_event_id: string; p_purchase_token: string; p_items: Json }
        Returns: { order_id: string; total_points: number }[]
      }
      get_team_store_orders: {
        Args: { p_event_id: string; p_purchase_token: string }
        Returns: {
          order_id: string
          status: 'pending' | 'done' | 'cancelled'
          total_points: number
          created_at: string
          item_name: string
          quantity: number
          fulfilled: boolean
        }[]
      }
      fulfil_store_order_item: {
        Args: { p_order_item_id: string; p_fulfilled: boolean }
        Returns: undefined
      }
      complete_store_order: {
        Args: { p_order_id: string }
        Returns: {
          team_id: string
          remaining_score: number
          taken_points: number
          order_done: boolean
        }[]
      }
      cancel_store_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      purchase_inventory_item: {
        Args: { p_public_code: string; p_event_id: string; p_purchase_token: string }
        Returns: {
          purchase_id: string
          item_id: string
          team_id: string
          item_name: string
          points_cost: number
          remaining_score: number
        }[]
      }
      get_team_puzzle_progress: {
        Args: { p_event_id: string; p_game_id: string; p_team_token: string }
        Returns: Json
      }
      submit_wordle_guess: {
        Args: {
          p_event_id: string
          p_game_id: string
          p_team_token: string
          p_guess: string
        }
        Returns: Json
      }
      submit_matching_pair: {
        Args: {
          p_event_id: string
          p_game_id: string
          p_team_token: string
          p_left_id: string
          p_right_id: string
        }
        Returns: Json
      }
      update_crossword_fill: {
        Args: {
          p_event_id: string
          p_game_id: string
          p_team_token: string
          p_cells: Json
        }
        Returns: Json
      }
      validate_crossword_grid: {
        Args: {
          p_event_id: string
          p_game_id: string
          p_team_token: string
          p_cells: Json
        }
        Returns: Json
      }
      use_crossword_hint: {
        Args: {
          p_event_id: string
          p_game_id: string
          p_team_token: string
          p_cells: Json
        }
        Returns: Json
      }
      restart_bingo_run_scores: {
        Args: {
          p_event_id: string
          p_game_id: string
          p_stage_index: number
          p_line_points: number
        }
        Returns: undefined
      }
      set_my_onboarding: {
        Args: { p_completed?: string[] | null; p_dismissed?: boolean | null }
        Returns: undefined
      }
      restart_quiz_scores: {
        Args: { p_event_id: string; p_game_id: string }
        Returns: undefined
      }
      install_music_library: {
        Args: { p_target_org_id: string }
        Returns: number
      }
      resolve_event_by_slugs: {
        Args: { p_client_slug: string; p_event_slug: string }
        Returns: string | null
      }
      reveal_quiz_answer: {
        Args: { p_event_id: string; p_game_id: string; p_question_id: string }
        Returns: string
      }
      precheck_event_activation: {
        Args: { p_event_id: string }
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
      /** Self-service account deletion. Refuses super_admin, demo orgs, and the last client_admin of an org. */
      delete_own_account: {
        Args: Record<string, never>
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
      get_offline_event_package: {
        Args: { p_event_id: string }
        Returns: Json
      }
      submit_offline_puzzle_result: {
        Args: {
          p_event_id: string
          p_game_id: string
          p_team_token: string
          p_client_id: string
          p_result: Json
          p_created_at: string
        }
        Returns: Json
      }
      score_current_quiz_question: {
        Args: { p_event_id: string; p_game_id: string; p_question_id: string }
        Returns: undefined
      }
      get_tablet_events_for_org: {
        Args: { p_org_id: string; p_token: string }
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
      permanently_delete_game: {
        Args: { p_game_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

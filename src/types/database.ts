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
        }
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
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

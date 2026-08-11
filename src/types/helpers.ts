import type { Database } from '@/types/database'

export type {
  AppRole,
  EventStatus,
  EventTaskStatus,
  GamePrepStatus,
  GameStatus,
  GameType,
  PointsType,
} from '@/types/database'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

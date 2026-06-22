import { Camera } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { DemoOverlay } from '@/components/live/DemoOverlay'
import { EventNotLiveScreen } from '@/components/live/EventNotLiveScreen'
import { PoweredByRallyHub } from '@/components/live/PoweredByRallyHub'
import { JoinGameView } from '@/components/live/JoinGameView'
import { LivePanelShell } from '@/components/layout/LivePanelShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useChatMessages, useLiveEvent } from '@/hooks/use-live-event'
import {
  countClaimedTeams,
  demoTeamSlots,
  DEMO_MAX_TEAMS,
  isEventDemoStatus,
} from '@/lib/event-demo'
import { unlockAudioFromUserGesture } from '@/lib/sounds'
import {
  displayTextColorForEvent,
  isEventLive,
  PARTICIPANT_TEAM_KEY,
  logoForEvent,
} from '@/lib/live-event'
import { ClientBrandingStyle } from '@/components/branding/ClientBrandingStyle'
import { publishLiveBundlePatch } from '@/lib/live-broadcast'
import { requestTeamMediaPermissions } from '@/lib/media-permissions'
import { slugifyOrgName } from '@/lib/tablet-link'
import { setLiveParticipantMode, supabase } from '@/lib/supabase'
import { uploadAsset } from '@/lib/storage'
import { validateUploadFileSize } from '@/lib/upload-limits'
import type { Tables } from '@/types/helpers'

function teamKey(eventId: string) {
  return `${PARTICIPANT_TEAM_KEY}_${eventId}`
}

export function JoinEventPage() {
  // Participants are anonymous. Force the anon role for all live requests so a
  // logged-in session in the same browser never makes participant writes run as
  // `authenticated` (which Phase 3 RLS rejects for submission inserts). Set during
  // render so it is active before the first data fetch; cleared on unmount.
  setLiveParticipantMode(true)
  useEffect(() => () => setLiveParticipantMode(false), [])

  const { eventId } = useParams<{ eventId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fromTablet = searchParams.get('from') === 'tablet'
  const tabletOrg = searchParams.get('org')?.trim() ?? ''
  const tabletSlug = searchParams.get('slug')?.trim() ?? ''

  const { bundle, loading, error, setBundle } = useLiveEvent(eventId)
  const { messages, chatHistoryReady, sendMessage } = useChatMessages(eventId)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [teamId, setTeamId] = useState<string | null>(() =>
    eventId ? localStorage.getItem(teamKey(eventId)) : null,
  )
  const [claimSlot, setClaimSlot] = useState<Tables<'teams'> | null>(null)
  const [claimName, setClaimName] = useState('')
  const [claimPhoto, setClaimPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [justJoined, setJustJoined] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)

  const myTeam = bundle?.teams.find((t) => t.id === teamId) ?? null
  const hasJoined = Boolean(teamId && (myTeam?.name?.trim() || justJoined))

  useEffect(() => {
    if (!eventId || !bundle) return
    const saved = localStorage.getItem(teamKey(eventId))
    if (!saved) return
    const team = bundle.teams.find((t) => t.id === saved)
    if (team?.name?.trim()) {
      setTeamId(saved)
      setJustJoined(false)
    } else {
      // Team was deleted or name cleared — purge stale ID so the join screen shows
      localStorage.removeItem(teamKey(eventId))
      setTeamId(null)
    }
  }, [eventId, bundle])

  useEffect(() => {
    if (!claimPhoto) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(claimPhoto)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [claimPhoto])

  useEffect(() => {
    if (!bundle?.state.announcement) {
      setAnnouncement(null)
      return
    }
    const t = bundle.state.announcement_target
    if (t === 'participants' || t === 'both') {
      setAnnouncement(bundle.state.announcement)
    }
  }, [bundle?.state.announcement, bundle?.state.announcement_target])

  useEffect(() => {
    if (mediaReady) return
    void requestTeamMediaPermissions().then((granted) => setMediaReady(granted))
  }, [mediaReady])

  if (loading || !bundle) {
    return (
      <LivePanelShell title="Join" titleCentered className="experience-scope">
        <p className="text-muted-foreground text-center text-sm">
          {loading ? 'Loading…' : (error ?? 'Event not found')}
        </p>
      </LivePanelShell>
    )
  }

  const { event, organization } = bundle

  if (!isEventLive(event)) {
    return <EventNotLiveScreen event={event} organization={organization} />
  }

  const logo = logoForEvent(event, organization, displayTextColorForEvent(event))
  const joinTeams = isEventDemoStatus(event.status)
    ? demoTeamSlots(bundle.teams)
    : bundle.teams

  async function claimTeam() {
    if (!claimSlot || !eventId || !claimName.trim()) return
    unlockAudioFromUserGesture('full')
    if (
      isEventDemoStatus(event.status) &&
      countClaimedTeams(joinTeams) >= DEMO_MAX_TEAMS
    ) {
      setClaimError(`Demo events allow up to ${DEMO_MAX_TEAMS} teams.`)
      return
    }
    setUploading(true)
    setClaimError(null)
    try {
      let photoUrl: string | null = claimSlot.photo_url
      if (claimPhoto) {
        photoUrl = await uploadAsset(
          'game-assets',
          `${eventId}/teams/${claimSlot.id}/${Date.now()}.jpg`,
          claimPhoto,
          { mediaKind: 'photo' },
        )
      }
      const trimmed = claimName.trim()
      const { data: updatedTeam, error: updateError } = await supabase
        .from('teams')
        .update({
          name: trimmed,
          photo_url: photoUrl,
          status: 'active',
        })
        .eq('id', claimSlot.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Fan-out to facilitator/display — must not block the join UX.
      if (updatedTeam) {
        void publishLiveBundlePatch(eventId, {
          kind: 'team',
          op: 'UPDATE',
          row: updatedTeam,
        })
      }

      void supabase.rpc('log_event_activity', {
        p_event_id: eventId,
        p_actor_type: 'team',
        p_actor_name: trimmed,
        p_action: 'team_joined',
        p_actor_id: claimSlot.id,
      })

      localStorage.setItem(teamKey(eventId), claimSlot.id)
      setTeamId(claimSlot.id)
      setJustJoined(true)
      setClaimSlot(null)
      setClaimName('')
      setClaimPhoto(null)
      setBundle((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          teams: prev.teams.map((t) =>
            t.id === claimSlot.id
              ? {
                  ...t,
                  name: trimmed,
                  photo_url: photoUrl,
                  status: 'active' as const,
                }
              : t,
          ),
        }
      })
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not join team')
    } finally {
      setUploading(false)
    }
  }

  function clearTeamSession() {
    if (!eventId) return
    localStorage.removeItem(teamKey(eventId))
    setTeamId(null)
    setJustJoined(false)
  }

  if (hasJoined && teamId && (myTeam || justJoined)) {
    const teamForView =
      myTeam ??
      ({
        id: teamId,
        name: 'Team',
        score: 0,
        event_id: event.id,
        slot_number: 0,
        color: null,
        photo_url: null,
        status: 'active',
        created_at: '',
      } as Tables<'teams'>)

    return (
      <>
        <PoweredByRallyHub
          hidden={organization?.hide_platform_branding}
          position="bottom-center"
          theme={displayTextColorForEvent(event) === 'black' ? 'dark' : 'light'}
        />
        <JoinGameView
          bundle={bundle}
          teamId={teamId}
          team={teamForView}
        messages={messages}
        chatHistoryReady={chatHistoryReady}
        onSendMessage={(text) =>
          void sendMessage((teamForView.name ?? 'Team').trim(), text, teamId)
        }
        announcement={announcement}
        onDismissAnnouncement={() => setAnnouncement(null)}
        onExitTeam={clearTeamSession}
        exitMode={fromTablet ? 'tablet' : 'team'}
        tabletOrgSlug={tabletOrg}
        onExitToTablet={
          fromTablet && tabletOrg
            ? () =>
                navigate(
                  tabletSlug
                    ? `/tablet/${encodeURIComponent(slugifyOrgName(tabletOrg) || tabletOrg)}/${encodeURIComponent(tabletSlug)}`
                    : `/tablet?org=${encodeURIComponent(tabletOrg)}`,
                )
            : undefined
        }
        />
      </>
    )
  }

  return (
    <LivePanelShell title={event.name} titleCentered className="experience-scope">
      <ClientBrandingStyle org={organization} />
      {/* Team-slot picker (pre-login) is always light mode → always the dark logo. */}
      <PoweredByRallyHub
        hidden={organization?.hide_platform_branding}
        position="bottom-center"
        theme="dark"
      />
      <DemoOverlay enabled={isEventDemoStatus(event.status)} />
      {logo ? (
        <img src={logo} alt="" className="mx-auto mb-6 max-h-20 object-contain" />
      ) : null}
      <div className="mx-auto grid max-w-lg gap-3 sm:grid-cols-2">
        {joinTeams.map((team) => (
          <button
            key={team.id}
            type="button"
            disabled={Boolean(team.name?.trim())}
            className="xp-team-slot border-border/80 bg-card hover:bg-muted/40 flex flex-col items-center gap-2 border p-4 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (!team.name?.trim()) {
                setClaimSlot(team)
                setClaimName('')
                setClaimPhoto(null)
                setClaimError(null)
              }
            }}
          >
            <div
              className="size-10 rounded-full ring-2 ring-border"
              style={{ background: team.color ?? '#888' }}
            />
            {team.photo_url && team.name ? (
              <img src={team.photo_url} alt={team.name} className="size-12 rounded-full object-cover" />
            ) : null}
            <span className="font-medium">
              {team.name?.trim() || 'Available'}
            </span>
          </button>
        ))}
      </div>
      {claimSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="xp-card border-border/80 max-h-[90dvh] w-full max-w-sm overflow-y-auto space-y-4 bg-card p-6 shadow-lg">
            <h3 className="text-foreground font-semibold">
              Join team {claimSlot.slot_number}
            </h3>
            <div className="space-y-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Photo (optional)</Label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) {
                    setClaimPhoto(null)
                    return
                  }
                  const sizeErr = validateUploadFileSize(f, 'photo')
                  if (sizeErr) {
                    setClaimError(sizeErr)
                    return
                  }
                  setClaimError(null)
                  setClaimPhoto(f)
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="size-4" />
                Take Photo
              </Button>
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="border-border/80 mx-auto max-h-40 rounded-lg border object-contain"
                />
              ) : null}
            </div>
            {claimError ? (
              <p className="text-destructive text-sm" role="alert">
                {claimError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setClaimSlot(null)}>
                Cancel
              </Button>
              <AccentButton
                className="flex-1"
                disabled={uploading || !claimName.trim()}
                onClick={() => void claimTeam()}
              >
                {uploading ? 'Joining…' : 'Join'}
              </AccentButton>
            </div>
          </Card>
        </div>
      ) : null}
    </LivePanelShell>
  )
}

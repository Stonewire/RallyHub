import { Camera } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { BrandBackground } from '@/components/live/BrandBackground'
import { PageScopedManifest } from '@/components/pwa/PageScopedManifest'
import { ParticipantInstallButton } from '@/components/pwa/ParticipantInstallButton'
import { DemoOverlay } from '@/components/live/DemoOverlay'
import { ParticipantPrivacyNotice } from '@/components/legal/ParticipantPrivacyNotice'
import { EventNotLiveScreen } from '@/components/live/EventNotLiveScreen'
import { PoweredByRallyHub } from '@/components/live/PoweredByRallyHub'
import { JoinGameView } from '@/components/live/JoinGameView'
import { PhotoChallengeCapture } from '@/components/live/PhotoChallengeCapture'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useChatMessages, useLiveEvent } from '@/hooks/use-live-event'
import {
  countClaimedTeams,
  demoTeamSlots,
  DEMO_MAX_TEAMS,
  isEventDemoStatus,
} from '@/lib/event-demo'
import { unlockAudioFromUserGesture } from '@/lib/sounds'
import {
  brandColorsForEvent,
  displayTextColorForEvent,
  isEventLive,
  PARTICIPANT_TEAM_KEY,
  logoForEvent,
} from '@/lib/live-event'
import { ClientBrandingStyle } from '@/components/branding/ClientBrandingStyle'
import { reportClientIssue } from '@/lib/client-diagnostics'
import { logEventActivity } from '@/lib/event-log'
import { publishLiveBundlePatch } from '@/lib/live-broadcast'
import { requestTeamMediaPermissions } from '@/lib/media-permissions'
import { slugifyOrgName } from '@/lib/tablet-link'
import { setLiveParticipantMode, supabase } from '@/lib/supabase'
import { uploadParticipantAsset } from '@/lib/storage'
import { hasAcknowledgedParticipantNotice } from '@/lib/legal-acceptance'
import {
  clearCurrentParticipantSession,
  saveCurrentParticipantSession,
} from '@/lib/participant-session'
import { shouldUseNativePhotoCapture } from '@/lib/capture-platform'
import { validateUploadFileSize } from '@/lib/upload-limits'
import { downscalePhoto } from '@/lib/challenge-camera'
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
  useDocumentTitle('Teams', bundle?.event?.name)
  const { messages, chatHistoryReady, sendMessage } = useChatMessages(eventId)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [teamId, setTeamId] = useState<string | null>(() =>
    eventId ? localStorage.getItem(teamKey(eventId)) : null,
  )
  // Acknowledged per device per event. A returning player is not nagged again.
  const [noticeAccepted, setNoticeAccepted] = useState(() =>
    eventId ? hasAcknowledgedParticipantNotice(eventId) : false,
  )
  const [claimSlot, setClaimSlot] = useState<Tables<'teams'> | null>(null)
  const [claimName, setClaimName] = useState('')
  const [nameFocused, setNameFocused] = useState(true)
  const [claimPhoto, setClaimPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [justJoined, setJustJoined] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  // In-app camera for the join team photo (non-iOS); the file input stays as
  // the iOS-native path and the explicit upload fallback.
  const [joinCameraOpen, setJoinCameraOpen] = useState(false)

  const myTeam = bundle?.teams.find((t) => t.id === teamId) ?? null
  const hasJoined = Boolean(teamId && (myTeam?.name?.trim() || justJoined))

  useEffect(() => {
    if (!eventId || !bundle) return
    const saved = localStorage.getItem(teamKey(eventId))
    if (!saved) return
    const team = bundle.teams.find((t) => t.id === saved)
    if (team?.name?.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage, a real external system, to restore the returning device's team
      setTeamId(saved)
      setJustJoined(false)
      saveCurrentParticipantSession(eventId, saved)
    } else {
      // Team was deleted or name cleared — purge stale ID so the join screen shows
      localStorage.removeItem(teamKey(eventId))
      setTeamId(null)
    }
  }, [eventId, bundle])

  useEffect(() => {
    if (!claimPhoto) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the preview when the file is removed
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(claimPhoto)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [claimPhoto])

  useEffect(() => {
    if (!bundle?.state.announcement) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local announcement display from realtime state, a real external system
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
    // No event means no brand to dress this in, so it is the plain canvas with
    // the message at the size of the thing it is telling you: the code you
    // scanned did not lead anywhere.
    return (
      <div className="experience-scope flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
        {loading ? (
          <p className="text-2xl font-black opacity-70">Loading…</p>
        ) : (
          <>
            <p className="text-[clamp(1.75rem,7vw,3rem)] leading-tight font-black text-balance">
              {error ?? 'Event not found'}
            </p>
            <p className="max-w-sm text-base font-semibold opacity-65">
              Check the link or the QR code with whoever is running the event.
            </p>
          </>
        )}
      </div>
    )
  }

  const { event, organization } = bundle

  if (!isEventLive(event)) {
    return <EventNotLiveScreen event={event} organization={organization} />
  }

  // Participants must see what is collected — above all, that they may be
  // photographed or filmed — and get a genuine chance to decline, BEFORE they can
  // enter a name or submit anything.
  if (eventId && !noticeAccepted) {
    return (
      <ParticipantPrivacyNotice
        eventId={eventId}
        organizationName={organization?.name}
        onAccept={() => setNoticeAccepted(true)}
      />
    )
  }

  const logo = logoForEvent(event, organization, displayTextColorForEvent(event))
  const accent = brandColorsForEvent(event, organization)[2]
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
        try {
          photoUrl = await uploadParticipantAsset(
            eventId,
            `${eventId}/teams/${claimSlot.id}/${Date.now()}.jpg`,
            claimPhoto,
            { mediaKind: 'photo' },
          )
        } catch (err) {
          const detail = reportClientIssue('join-team-photo', err, {
            eventId,
            teamId: claimSlot.id,
          })
          throw new Error(`Could not upload team photo (${detail})`, { cause: err })
        }
      }
      const trimmed = claimName.trim()
      const { data: claimResult, error: updateError } = await supabase
        .rpc('claim_team_with_inventory_access', {
          p_event_id: eventId,
          p_team_id: claimSlot.id,
          p_name: trimmed,
          p_photo_url: photoUrl,
        })

      if (updateError) throw updateError
      const claimed = claimResult?.[0]
      if (!claimed) throw new Error('Could not claim this team.')
      const updatedTeam: Tables<'teams'> = {
        id: claimed.id,
        event_id: claimed.event_id,
        name: claimed.name,
        color: claimed.color,
        photo_url: claimed.photo_url,
        score: claimed.score,
        status: claimed.status,
        slot_number: claimed.slot_number,
        created_at: claimed.created_at,
      }

      // Fan-out to facilitator/display — must not block the join UX.
      if (updatedTeam) {
        void publishLiveBundlePatch(eventId, {
          kind: 'team',
          op: 'UPDATE',
          row: updatedTeam,
        })
      }

      void logEventActivity({
        p_event_id: eventId,
        p_actor_type: 'team',
        p_actor_name: trimmed,
        p_action: 'team_joined',
        p_actor_id: claimSlot.id,
      })

      localStorage.setItem(teamKey(eventId), claimSlot.id)
      saveCurrentParticipantSession(eventId, claimSlot.id, claimed.inventory_purchase_token)
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
    clearCurrentParticipantSession(eventId, teamId ?? undefined)
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
          setBundle={setBundle}
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
    <BrandBackground
      event={event}
      organization={organization}
      variant="default"
      className="flex min-h-svh flex-col px-4 pt-4 pb-24 sm:pt-5"
    >
      <ClientBrandingStyle org={organization} />
      {/* A player's icon should reopen this event, not the app root, so this
          page installs itself rather than the default start_url. */}
      <PageScopedManifest />
      <PoweredByRallyHub
        hidden={organization?.hide_platform_branding}
        position="bottom-center"
        theme={displayTextColorForEvent(event) === 'black' ? 'dark' : 'light'}
      />
      <DemoOverlay enabled={isEventDemoStatus(event.status)} />
      {/* Same header as every other player screen: logo, then the event name. */}
      <header className="mb-5 flex flex-col items-center gap-1.5 px-2 text-center">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="max-h-14 max-w-[200px] object-contain drop-shadow-md"
          />
        ) : null}
        <h1 className="text-xl font-bold drop-shadow-sm sm:text-2xl">{event.name}</h1>
      </header>
      <div className="mx-auto grid w-full max-w-lg gap-3 sm:grid-cols-2">
        {joinTeams.map((team) => {
          const taken = Boolean(team.name?.trim())
          return (
            <button
              key={team.id}
              type="button"
              disabled={taken}
              // Same tile as the quest board, so the lobby and the game share
              // one shape: white card, its colour carried by the avatar ring.
              className="xp-game-tile xp-interactive flex flex-col items-center justify-center gap-2.5 bg-white p-4 text-black disabled:cursor-not-allowed disabled:opacity-100"
              onClick={() => {
                if (!taken) {
                  setClaimSlot(team)
                  setClaimName('')
                  setClaimPhoto(null)
                  setClaimError(null)
                }
              }}
            >
              {team.photo_url && taken ? (
                <img
                  src={team.photo_url}
                  alt=""
                  className="size-14 rounded-full object-cover"
                  style={{ boxShadow: `0 0 0 4px ${team.color ?? '#888'}` }}
                />
              ) : (
                <div
                  className="size-14 rounded-full"
                  style={{ background: team.color ?? '#888' }}
                />
              )}
              <span className="xp-wrap-text text-base font-bold">
                {team.name?.trim() || 'Available'}
              </span>
            </button>
          )
        })}
      </div>
      <ParticipantInstallButton className="mt-6" />
      {claimSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="xp-card max-h-[90dvh] w-full max-w-sm space-y-5 overflow-y-auto bg-white p-6 text-black">
            <div className="space-y-2">
              <label htmlFor="team-name" className="block text-sm font-bold">
                Team name
              </label>
              <input
                id="team-name"
                // Opens ready to type, so the keyboard is one tap closer. The
                // lit state is tracked here rather than left to :focus-visible,
                // which a programmatic focus never triggers — the field has to
                // look live even though nobody tapped it.
                autoFocus
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                className="w-full rounded-lg border-2 px-3 py-2.5 text-base outline-none"
                style={
                  nameFocused
                    ? {
                        borderColor: accent,
                        boxShadow: `0 0 0 3px ${accent}40`,
                      }
                    : { borderColor: 'rgba(0,0,0,0.15)' }
                }
                placeholder="Your team name"
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
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
                  void downscalePhoto(f).then((blob) =>
                    setClaimPhoto(new File([blob], f.name, { type: blob.type || f.type })),
                  )
                }}
              />
              {/* The photo is the picture itself: tap the circle to shoot it,
                  and once taken the circle becomes the preview. */}
              <button
                type="button"
                className="mx-auto flex size-28 flex-col items-center justify-center gap-1 overflow-hidden rounded-full border-2 border-dashed border-black/25 bg-black/5 text-black/60 transition-colors hover:bg-black/10"
                onClick={() => {
                  // iOS opens its native camera (excellent); everywhere else the
                  // in-app camera, because tablet browsers turn the camera-input
                  // attribute into a plain file browser (join-photo report,
                  // 30 Jul 2026).
                  if (shouldUseNativePhotoCapture()) {
                    photoInputRef.current?.click()
                    return
                  }
                  setJoinCameraOpen(true)
                }}
                aria-label={photoPreview ? 'Retake team photo' : 'Take team photo'}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="size-full object-cover" />
                ) : (
                  <>
                    <Camera className="size-8" strokeWidth={1.75} />
                    <span className="text-xs font-semibold">Team photo</span>
                  </>
                )}
              </button>
              {!shouldUseNativePhotoCapture() ? (
                <button
                  type="button"
                  className="w-full text-center text-xs text-black/55 underline"
                  onClick={() => photoInputRef.current?.click()}
                >
                  Or upload a photo
                </button>
              ) : null}
            </div>
            {claimError ? (
              <p className="text-sm text-red-600" role="alert">
                {claimError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                className="xp-card flex-1 border border-black/15 bg-white px-4 py-2.5 text-sm font-bold text-black"
                onClick={() => setClaimSlot(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="xp-card flex-1 px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                style={{
                  backgroundColor: accent,
                  color: displayTextColorForEvent(event),
                }}
                disabled={uploading || !claimName.trim()}
                onClick={() => void claimTeam()}
              >
                {uploading ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {joinCameraOpen && eventId ? (
        <PhotoChallengeCapture
          accentColor={brandColorsForEvent(event, organization)[2]}
          eventId={eventId}
          onClose={() => setJoinCameraOpen(false)}
          onFileReady={(file) => {
            // Already full-frame at upload size from the in-app camera.
            setJoinCameraOpen(false)
            setClaimError(null)
            setClaimPhoto(file)
          }}
        />
      ) : null}
    </BrandBackground>
  )
}

import { Camera } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { BrandBackground } from '@/components/live/BrandBackground'
import { PageScopedManifest } from '@/components/pwa/PageScopedManifest'
import { ParticipantInstallButton } from '@/components/pwa/ParticipantInstallButton'
import { DemoOverlay } from '@/components/live/DemoOverlay'
import { ParticipantLanguagePicker } from '@/components/live/ParticipantLanguagePicker'
import { ParticipantPrivacyNotice } from '@/components/legal/ParticipantPrivacyNotice'
import { EventNotLiveScreen } from '@/components/live/EventNotLiveScreen'
import { PoweredByRallyHub } from '@/components/live/PoweredByRallyHub'
import { JoinGameView } from '@/components/live/JoinGameView'
import { PhotoChallengeCapture } from '@/components/live/PhotoChallengeCapture'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useChatMessages, useLiveEvent } from '@/hooks/use-live-event'
import { useWakeLock } from '@/hooks/use-wake-lock'
import {
  countClaimedTeams,
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
import {
  mediaPermissionsAlreadyGranted,
  requestTeamMediaPermissions,
} from '@/lib/media-permissions'
import { slugifyOrgName } from '@/lib/tablet-link'
import { setLiveParticipantMode, supabase } from '@/lib/supabase'
import { uploadParticipantAsset } from '@/lib/storage'
import { hasAcknowledgedParticipantNotice } from '@/lib/legal-acceptance'
import {
  clearCurrentParticipantSession,
  saveCurrentParticipantSession,
} from '@/lib/participant-session'
import { shouldUseNativePhotoCapture } from '@/lib/capture-platform'
import { setParticipantLanguage } from '@/lib/i18n'
import { validateUploadFileSize } from '@/lib/upload-limits'
import { downscalePhoto } from '@/lib/challenge-camera'
import type { Tables } from '@/types/helpers'

function teamKey(eventId: string) {
  return `${PARTICIPANT_TEAM_KEY}_${eventId}`
}

/** The language this device picked on a multilingual event. Kept locally as
 *  well as on the team row, so the picker does not reappear before the team
 *  is claimed, and so a rejoin is already in the right language. */
function languageKey(eventId: string) {
  return `${PARTICIPANT_TEAM_KEY}_${eventId}_language`
}

/** The team session_epoch this device joined at; an older value means a
 *  takeover happened elsewhere and this device must let go. */
function epochKey(eventId: string) {
  return `${PARTICIPANT_TEAM_KEY}_${eventId}_epoch`
}

export function JoinEventPage() {
  // Participants are anonymous. Force the anon role for all live requests so a
  // logged-in session in the same browser never makes participant writes run as
  // `authenticated` (which Phase 3 RLS rejects for submission inserts). Set during
  // render so it is active before the first data fetch; cleared on unmount.
  setLiveParticipantMode(true)
  useEffect(() => () => setLiveParticipantMode(false), [])

  const { t } = useTranslation('live')
  const { eventId } = useParams<{ eventId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fromTablet = searchParams.get('from') === 'tablet'
  const tabletOrg = searchParams.get('org')?.trim() ?? ''
  const tabletSlug = searchParams.get('slug')?.trim() ?? ''

  const { bundle, loading, error, setBundle } = useLiveEvent(eventId)
  useDocumentTitle(t('join.claim.documentTitle'), bundle?.event?.name)
  useWakeLock()

  // Back-button trap. Scanning the join QR from a phone's camera app opens a
  // temporary browser sheet whose history starts empty, so one press of the
  // hardware Back closed the whole event and teams had to walk over and
  // rescan (7 Aug event, Android personal phones). A guard entry is pushed on
  // mount and re-pushed on every popstate, so Back keeps the page alive; all
  // in-game navigation is app state and its own buttons, never history.
  useEffect(() => {
    window.history.pushState({ rhBackTrap: true }, '')
    const onPop = () => {
      window.history.pushState({ rhBackTrap: true }, '')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const { messages, chatHistoryReady, sendMessage } = useChatMessages(eventId)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [teamId, setTeamId] = useState<string | null>(() =>
    eventId ? localStorage.getItem(teamKey(eventId)) : null,
  )
  // Acknowledged per device per event. A returning player is not nagged again.
  const [noticeAccepted, setNoticeAccepted] = useState(() =>
    eventId ? hasAcknowledgedParticipantNotice(eventId) : false,
  )
  // Multilingual events only. Remembered per device so the picker is a
  // one-time step, not something to clear on every refresh.
  const [pickedLanguage, setPickedLanguage] = useState<string | null>(() =>
    eventId ? localStorage.getItem(languageKey(eventId)) : null,
  )
  // Re-pin on every mount: the bundle sets the event language as soon as it
  // loads, and without this a refresh would drop the team back to it.
  useEffect(() => {
    if (pickedLanguage) void setParticipantLanguage(pickedLanguage)
  }, [pickedLanguage])
  const [claimSlot, setClaimSlot] = useState<Tables<'teams'> | null>(null)
  const [claimName, setClaimName] = useState('')
  // Taken-slot takeover (CF2-8): tap a claimed team, enter the org's tablet
  // password, and this device becomes the team's device; the old one logs out
  // via the session_epoch watcher below.
  const [takeoverSlot, setTakeoverSlot] = useState<Tables<'teams'> | null>(null)
  const [takeoverPassword, setTakeoverPassword] = useState('')
  const [takeoverBusy, setTakeoverBusy] = useState(false)
  const [takeoverError, setTakeoverError] = useState<string | null>(null)
  const [signedOutByTakeover, setSignedOutByTakeover] = useState(false)

  // Another device took this team over (session_epoch moved past what this
  // device joined at): let go of the claim and fall back to the lobby.
  useEffect(() => {
    if (!eventId || !teamId || !bundle) return
    const mine = bundle.teams.find((t) => t.id === teamId)
    if (!mine) return
    const stored = Number(localStorage.getItem(epochKey(eventId)) ?? '0')
    if ((mine.session_epoch ?? 0) > stored) {
      localStorage.removeItem(teamKey(eventId))
      localStorage.removeItem(epochKey(eventId))
      clearCurrentParticipantSession(eventId, teamId)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local claim state with the authoritative realtime team row
      setTeamId(null)
       
      setSignedOutByTakeover(true)
    }
  }, [bundle, teamId, eventId])
  const [nameFocused, setNameFocused] = useState(true)
  const [claimPhoto, setClaimPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [justJoined, setJustJoined] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const [permissionGateOpen, setPermissionGateOpen] = useState(false)
  const [permissionRequesting, setPermissionRequesting] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
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

  // Camera permission is requested through the explicit gate below, never
  // passively: a page-load getUserMedia is suppressed by several browsers
  // (silently on iPhone Chrome), which is why teams were prompted per game or
  // never prompted at all (7 Aug event). The gate's Approve tap is a user
  // gesture, which every browser honours with its native prompt.
  useEffect(() => {
    if (mediaReady || !teamId) return
    void mediaPermissionsAlreadyGranted().then((granted) => {
       
      if (granted) setMediaReady(true)
      else setPermissionGateOpen(true)
    })
  }, [mediaReady, teamId])

  async function approveCamera() {
    setPermissionRequesting(true)
    const granted = await requestTeamMediaPermissions()
    setPermissionRequesting(false)
    setMediaReady(granted)
    if (granted) {
      setPermissionGateOpen(false)
      setPermissionDenied(false)
    } else {
      setPermissionDenied(true)
    }
  }

  if (loading || !bundle) {
    // No event means no brand to dress this in, so it is the plain canvas with
    // the message at the size of the thing it is telling you: the code you
    // scanned did not lead anywhere.
    return (
      <div className="experience-scope flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
        {loading ? (
          <p className="text-2xl font-black opacity-70">{t('common:loading')}…</p>
        ) : (
          <>
            <p className="text-[clamp(1.75rem,7vw,3rem)] leading-tight font-black text-balance">
              {error ?? t('join.claim.eventNotFound')}
            </p>
            <p className="max-w-sm text-base font-semibold opacity-65">
              {t('join.claim.eventNotFoundHint')}
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

  // On a multilingual event the language comes first, before the notice: the
  // consent text below is the first thing it has to translate.
  if (eventId && event.multilingual && !pickedLanguage) {
    return (
      <ParticipantLanguagePicker
        languages={event.available_languages}
        onPick={(language) => {
          localStorage.setItem(languageKey(eventId), language)
          setPickedLanguage(language)
          void setParticipantLanguage(language)
        }}
      />
    )
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
  // Demo events show the full team list (P4.1); only claiming is capped, by
  // the guard in claimTeam below and server-side in the claim RPC.
  const joinTeams = bundle.teams

  async function takeoverTeam() {
    if (!takeoverSlot || !eventId || !takeoverPassword.trim()) return
    unlockAudioFromUserGesture('full')
    setTakeoverBusy(true)
    setTakeoverError(null)
    try {
      const { data, error } = await supabase.rpc('takeover_team_slot', {
        p_event_id: eventId,
        p_team_id: takeoverSlot.id,
        p_password: takeoverPassword.trim(),
      })
      if (error) throw error
      const row = data?.[0]
      if (!row) throw new Error(t('join.takeover.couldNotMove'))
      const updatedTeam: Tables<'teams'> = {
        id: row.id,
        event_id: row.event_id,
        name: row.name,
        color: row.color,
        photo_url: row.photo_url,
        score: row.score,
        status: row.status,
        slot_number: row.slot_number,
        language: pickedLanguage,
        created_at: row.created_at,
        session_epoch: row.session_epoch,
      }
      // The epoch bump rides this patch to the old device, which logs itself out.
      void publishLiveBundlePatch(eventId, { kind: 'team', op: 'UPDATE', row: updatedTeam })
      localStorage.setItem(teamKey(eventId), row.id)
      localStorage.setItem(epochKey(eventId), String(row.session_epoch))
      saveCurrentParticipantSession(eventId, row.id, row.inventory_purchase_token)
      setTeamId(row.id)
      setJustJoined(true)
      setSignedOutByTakeover(false)
      setTakeoverSlot(null)
      setTakeoverPassword('')
      setBundle((prev) =>
        prev
          ? { ...prev, teams: prev.teams.map((t) => (t.id === row.id ? updatedTeam : t)) }
          : prev,
      )
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : t('join.takeover.couldNotMove')
      setTakeoverError(msg)
    } finally {
      setTakeoverBusy(false)
    }
  }

  async function claimTeam() {
    if (!claimSlot || !eventId || !claimName.trim()) return
    unlockAudioFromUserGesture('full')
    if (
      isEventDemoStatus(event.status) &&
      countClaimedTeams(joinTeams) >= DEMO_MAX_TEAMS
    ) {
      setClaimError(t('join.claim.demoTeamsLimit', { count: DEMO_MAX_TEAMS }))
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
          throw new Error(t('join.claim.couldNotUploadPhoto', { detail }), { cause: err })
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
      if (!claimed) throw new Error(t('join.claim.couldNotClaimTeam'))
      // Persist the language choice against the team, so a replacement phone
      // picking this slot back up starts in the same language. Best effort:
      // the device already has it locally, so a failure here must not fail
      // the join the player just completed.
      if (pickedLanguage) {
        const { error: languageError } = await supabase
          .from('teams')
          .update({ language: pickedLanguage })
          .eq('id', claimSlot.id)
        if (languageError) {
          reportClientIssue('join-team-language', languageError, {
            eventId,
            teamId: claimSlot.id,
          })
        }
      }
      const updatedTeam: Tables<'teams'> = {
        id: claimed.id,
        event_id: claimed.event_id,
        name: claimed.name,
        color: claimed.color,
        photo_url: claimed.photo_url,
        score: claimed.score,
        status: claimed.status,
        slot_number: claimed.slot_number,
        language: pickedLanguage,
        created_at: claimed.created_at,
        session_epoch: claimSlot.session_epoch ?? 0,
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
      localStorage.setItem(epochKey(eventId), String(claimSlot.session_epoch ?? 0))
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
      setClaimError(err instanceof Error ? err.message : t('join.claim.couldNotJoinTeam'))
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

  // Rendered in both the lobby and the joined branch: joining is exactly when
  // the gate must appear, and a device restored mid-game needs it too.
  const permissionGate =
    permissionGateOpen && teamId ? (
      <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 p-4">
        <div className="xp-card w-full max-w-sm space-y-4 bg-white p-6 text-center text-black">
          <Camera className="mx-auto size-12" style={{ color: accent }} />
          <div className="space-y-1">
            <h2 className="text-xl font-bold">{t('join.permission.title')}</h2>
            <p className="text-sm text-black/70">
              {t('join.permission.body')}
            </p>
          </div>
          {permissionDenied ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {t('join.permission.blockedHint')}
            </p>
          ) : null}
          <button
            type="button"
            className="min-h-14 w-full rounded-xl text-lg font-bold text-black disabled:opacity-60"
            style={{ backgroundColor: accent }}
            disabled={permissionRequesting}
            onClick={() => void approveCamera()}
          >
            {permissionRequesting
              ? t('join.permission.waitingForBrowser')
              : permissionDenied
                ? t('join.permission.tryAgain')
                : t('join.permission.approve')}
          </button>
          <button
            type="button"
            className="text-xs font-medium text-black/50 underline"
            onClick={() => setPermissionGateOpen(false)}
          >
            {t('join.permission.skip')}
          </button>
        </div>
      </div>
    ) : null

  if (hasJoined && teamId && (myTeam || justJoined)) {
    const teamForView =
      myTeam ??
      ({
        id: teamId,
        name: t('join.claim.teamFallback'),
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
        {permissionGate}
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
          void sendMessage((teamForView.name ?? t('join.claim.teamFallback')).trim(), text, teamId)
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
              // Same tile as the quest board, so the lobby and the game share
              // one shape: white card, its colour carried by the avatar ring.
              // Taken teams stay tappable: with the event password a new
              // device can take the team over (lost phone, dead battery).
              className="xp-game-tile xp-interactive flex flex-col items-center justify-center gap-2.5 bg-white p-4 text-black"
              onClick={() => {
                if (taken) {
                  setTakeoverSlot(team)
                  setTakeoverPassword('')
                  setTakeoverError(null)
                } else {
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
                {team.name?.trim() || t('join.claim.available')}
              </span>
            </button>
          )
        })}
      </div>
      <ParticipantInstallButton className="mt-6" />
      {permissionGate}
      {signedOutByTakeover ? (
        <p className="mx-auto mt-4 max-w-sm rounded-lg bg-black/35 px-4 py-2 text-center text-sm font-semibold backdrop-blur-sm">
          {t('join.takeover.signedOut')}
        </p>
      ) : null}
      {takeoverSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="xp-card max-h-[90dvh] w-full max-w-sm space-y-4 overflow-y-auto bg-white p-6 text-black">
            <div className="space-y-1">
              <h2 className="text-lg font-bold">
                {t('join.takeover.moveTitle', { team: takeoverSlot.name?.trim() })}
              </h2>
              <p className="text-sm text-black/70">
                {t('join.takeover.body')}
              </p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              className="w-full rounded-lg border-2 border-black/15 px-3 py-2.5 text-base outline-none focus:border-black/40"
              placeholder={t('join.takeover.passwordPlaceholder')}
              value={takeoverPassword}
              onChange={(e) => setTakeoverPassword(e.target.value)}
            />
            {takeoverError ? (
              <p className="text-sm font-semibold text-red-600" role="alert">
                {takeoverError}
              </p>
            ) : null}
            <div className="flex gap-3">
              <button
                type="button"
                className="min-h-12 flex-1 rounded-lg border-2 border-black/15 text-base font-semibold"
                onClick={() => setTakeoverSlot(null)}
                disabled={takeoverBusy}
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                className="min-h-12 flex-1 rounded-lg text-base font-bold text-black disabled:opacity-50"
                style={{ backgroundColor: accent }}
                disabled={takeoverBusy || !takeoverPassword.trim()}
                onClick={() => void takeoverTeam()}
              >
                {takeoverBusy ? t('join.takeover.moving') : t('join.takeover.moveHere')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {claimSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="xp-card max-h-[90dvh] w-full max-w-sm space-y-5 overflow-y-auto bg-white p-6 text-black">
            <div className="space-y-2">
              <label htmlFor="team-name" className="block text-sm font-bold">
                {t('join.claim.teamNameLabel')}
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
                placeholder={t('join.claim.teamNamePlaceholder')}
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
                aria-label={
                  photoPreview
                    ? t('join.claim.retakeTeamPhoto')
                    : t('join.claim.takeTeamPhoto')
                }
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="size-full object-cover" />
                ) : (
                  <>
                    <Camera className="size-8" strokeWidth={1.75} />
                    <span className="text-xs font-semibold">{t('join.claim.teamPhoto')}</span>
                  </>
                )}
              </button>
              {/* No "upload instead" escape hatch. Team devices shoot their
                  photo, the same rule the photo challenges follow, and iOS never
                  offered one anyway, so the link only ever appeared on Android
                  and desktop. The photo is optional, so nobody is blocked. */}
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
                {t('common:cancel')}
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
                {uploading ? t('join.claim.joining') : t('join.claim.join')}
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

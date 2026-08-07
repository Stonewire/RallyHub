import { ArrowLeft, CheckCircle2, PackageOpen, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PoweredByRallyHub } from '@/components/live/PoweredByRallyHub'
import { LivePanelShell } from '@/components/layout/LivePanelShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ensureLiveEventAccess } from '@/lib/live-event-access'
import { publishLiveBundlePatch } from '@/lib/live-broadcast'
import { getCurrentParticipantSession } from '@/lib/participant-session'
import { setLiveParticipantMode, supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

/** Long enough to read the receipt, short enough not to feel stuck. */
const PURCHASE_RETURN_MS = 2500

type ItemPreview = Pick<
  Tables<'inventory_items'>,
  'id' | 'name' | 'description' | 'points_cost' | 'image_url'
>

type PurchaseResult = {
  purchase_id: string
  item_id: string
  team_id: string
  item_name: string
  points_cost: number
  remaining_score: number
}

function purchaseErrorMessage(reason: unknown, fallback: string) {
  if (reason instanceof Error && reason.message) return reason.message
  if (
    reason &&
    typeof reason === 'object' &&
    'message' in reason &&
    typeof reason.message === 'string' &&
    reason.message.trim()
  ) {
    return reason.message
  }
  return fallback
}

export function InventoryPurchasePage() {
  useEffect(() => {
    // Route transitions run the previous live page's cleanup before this page's
    // effects. Reassert participant mode here so a signed-in facilitator testing
    // on the same device cannot accidentally make the purchase as their admin role.
    setLiveParticipantMode(true)
    return () => setLiveParticipantMode(false)
  }, [])

  const navigate = useNavigate()
  const { publicCode } = useParams<{ publicCode: string }>()
  const [item, setItem] = useState<ItemPreview | null>(null)
  const [team, setTeam] = useState<Tables<'teams'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [purchase, setPurchase] = useState<PurchaseResult | null>(null)
  const session = getCurrentParticipantSession()

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!publicCode) {
        setError('This item QR code is invalid.')
        setLoading(false)
        return
      }
      if (!session) {
        setError('Join your event on this phone first, then scan the item again.')
        setLoading(false)
        return
      }
      if (!session.purchaseToken) {
        setError('Return to your event and claim a team on this phone before purchasing items.')
        setLoading(false)
        return
      }
      try {
        const access = await ensureLiveEventAccess(session.eventId)
        if (!access) throw new Error('Your event could not be opened.')
        const [itemResponse, teamResponse] = await Promise.all([
          supabase.rpc('get_inventory_item_for_purchase', {
            p_public_code: publicCode,
            p_event_id: session.eventId,
          }),
          supabase.from('teams').select('*').eq('id', session.teamId).eq('event_id', session.eventId).maybeSingle(),
        ])
        if (itemResponse.error) throw itemResponse.error
        if (teamResponse.error) throw teamResponse.error
        const preview = itemResponse.data?.[0] ?? null
        if (!preview) throw new Error('This item is unavailable for your event.')
        if (!teamResponse.data?.name?.trim()) throw new Error('Join a team before purchasing an item.')
        if (!cancelled) {
          setItem(preview)
          setTeam(teamResponse.data)
        }
      } catch (reason) {
        if (!cancelled) setError(purchaseErrorMessage(reason, 'Could not load this item.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  // The participant pointer is deliberately read once for this scanned page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicCode])

  async function confirmPurchase() {
    if (!publicCode || !session || !item || !team) return
    setPurchasing(true)
    setError(null)
    try {
      const { data, error: purchaseError } = await supabase.rpc('purchase_inventory_item', {
        p_public_code: publicCode,
        p_event_id: session.eventId,
        p_purchase_token: session.purchaseToken ?? '',
      })
      if (purchaseError) throw purchaseError
      const result = data?.[0]
      if (!result) throw new Error('The purchase was not completed.')
      setPurchase(result)
      setTeam({ ...team, id: result.team_id, score: result.remaining_score })
      void supabase
        .from('teams')
        .select('*')
        .eq('id', result.team_id)
        .single()
        .then(({ data: updatedTeam }) => {
          if (updatedTeam) {
            setTeam(updatedTeam)
            void publishLiveBundlePatch(session.eventId, {
              kind: 'team',
              op: 'UPDATE',
              row: updatedTeam,
            })
          }
        })
    } catch (reason) {
      setError(purchaseErrorMessage(reason, 'Could not purchase this item.'))
    } finally {
      setPurchasing(false)
    }
  }

  const joinLink = session ? `/join/${session.eventId}` : '/'

  // A team scans, buys, and wants to be back in the game. Hold the receipt long
  // enough to read the new balance, then take them back rather than leaving
  // them on a dead-end screen waiting to be told to press a button.
  useEffect(() => {
    if (!purchase || !session) return
    const timer = window.setTimeout(() => navigate(joinLink), PURCHASE_RETURN_MS)
    return () => window.clearTimeout(timer)
  }, [purchase, session, joinLink, navigate])

  return (
    <LivePanelShell title="Inventory" titleCentered className="experience-scope">
      <PoweredByRallyHub position="bottom-center" theme="dark" />
      <div className="mx-auto w-full max-w-md space-y-4 pb-16">
        {/* A back control in every state: teams scanning mid-game must always
            have a way home, most of all when the item cannot be shown. */}
        <Button
          type="button"
          variant="ghost"
          className="text-white/90"
          onClick={() => {
            if (session) navigate(joinLink)
            else if (window.history.length > 1) navigate(-1)
            else navigate('/')
          }}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        {loading ? (
          <Card className="p-8 text-center"><p className="text-muted-foreground text-sm">Opening item…</p></Card>
        ) : purchase && item ? (
          <Card className="space-y-5 p-6 text-center shadow-lg">
            <CheckCircle2 className="mx-auto size-16 text-emerald-500" />
            <div>
              <h1 className="text-2xl font-bold">Purchase confirmed</h1>
              <p className="text-muted-foreground mt-2">You can now collect <strong className="text-foreground">{item.name}</strong> from the facilitator.</p>
            </div>
            <div className="rounded-xl bg-amber-100 px-4 py-3 text-neutral-900">
              <p className="text-sm">{purchase.points_cost} points deducted</p>
              <p className="mt-1 text-xl font-bold">{purchase.remaining_score} points remaining</p>
            </div>
            <Button asChild className="w-full"><Link to={joinLink}>Return to event</Link></Button>
          </Card>
        ) : error && !item ? (
          <Card className="space-y-4 p-6 text-center">
            <PackageOpen className="text-muted-foreground mx-auto size-12" />
            <h1 className="text-xl font-bold">Item unavailable</h1>
            <p className="text-muted-foreground text-sm">{error}</p>
            {session ? <Button asChild className="w-full"><Link to={joinLink}>Return to event</Link></Button> : null}
          </Card>
        ) : item && team ? (
          <Card className="overflow-hidden shadow-lg">
            {item.image_url ? <img src={item.image_url} alt={item.name} className="h-56 w-full object-cover" /> : (
              <div className="bg-muted flex h-44 items-center justify-center"><ShoppingBag className="text-muted-foreground size-16" /></div>
            )}
            <div className="space-y-5 p-6">
              <div>
                <h1 className="text-2xl font-bold">{item.name}</h1>
                {item.description ? <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">{item.description}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-amber-100 p-3 text-neutral-900"><p className="text-xs font-medium uppercase">Item cost</p><p className="mt-1 text-xl font-bold">{item.points_cost}</p><p className="text-xs">points</p></div>
                <div className="bg-muted rounded-xl p-3"><p className="text-muted-foreground text-xs font-medium uppercase">Your balance</p><p className="mt-1 text-xl font-bold">{team.score}</p><p className="text-muted-foreground text-xs">points</p></div>
              </div>
              {error ? <p className="text-destructive text-center text-sm font-medium" role="alert">{error}</p> : null}
              <div className="space-y-2">
                <Button className="w-full" size="lg" disabled={purchasing || team.score < item.points_cost} onClick={() => void confirmPurchase()}>
                  {purchasing ? 'Purchasing…' : team.score < item.points_cost ? 'Not enough points' : `Buy for ${item.points_cost} points`}
                </Button>
                <Button asChild variant="outline" className="w-full"><Link to={joinLink}><ArrowLeft className="size-4" /> Cancel</Link></Button>
              </div>
              <p className="text-muted-foreground text-center text-xs">Points are deducted only after you confirm.</p>
            </div>
          </Card>
        ) : null}
      </div>
    </LivePanelShell>
  )
}

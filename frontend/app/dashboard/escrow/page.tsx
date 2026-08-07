'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
  Inbox,
} from 'lucide-react'

type EscrowStatus = 'active' | 'released'

interface Escrow {
  id: string
  title: string
  from: string
  to: string
  // Stored as cents (integer), not a pre-formatted "$5,000.00" string — a
  // formatted string can't be summed/sorted, which is exactly what the
  // overview cards below need to do. Formatting happens once, at render,
  // via formatUsd().
  amountCents: number
  // ISO date string rather than "Mar 20, 2024" — same reasoning, plus it
  // lets Date math (e.g. "released this month") actually work.
  releaseDate: string
  condition: string
  status: EscrowStatus
}

const STATUS_CONFIG: Record<EscrowStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-primary/20 text-primary' },
  released: { label: 'Released', className: 'bg-secondary/20 text-secondary' },
}

// TODO: replace with real data from your API (e.g. a useGetEscrows() query
// hook, matching the pattern used elsewhere in the app for bookings). This
// is seeded mock data so the page renders something meaningful in the
// meantime, restructured into real numbers/dates rather than pre-formatted
// display strings.
const INITIAL_ESCROWS: Escrow[] = [
  {
    id: 'ESC001',
    title: 'Freelance Project - Web Design',
    from: 'You',
    to: 'Sarah Martinez',
    amountCents: 500_000,
    releaseDate: '2024-03-20',
    condition: 'Delivery of final designs',
    status: 'active',
  },
  {
    id: 'ESC002',
    title: 'Content Creation Agreement',
    from: 'You',
    to: 'Alex Johnson',
    amountCents: 250_000,
    releaseDate: '2024-03-18',
    condition: 'Approval of content',
    status: 'active',
  },
  {
    id: 'ESC003',
    title: 'Completed: Brand Identity',
    from: 'You',
    to: 'Design Team',
    amountCents: 875_000,
    releaseDate: '2024-03-15',
    condition: 'Final approval',
    status: 'released',
  },
]

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { dateStyle: 'medium' })
}

function isThisMonth(iso: string): boolean {
  const date = new Date(iso)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  )
}

export default function EscrowPage() {
  const router = useRouter()

  const [escrows, setEscrows] = useState<Escrow[]>(INITIAL_ESCROWS)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  // Set rather than a single id, same reasoning as the bookings admin
  // page: releasing escrow A shouldn't block or misrepresent the loading
  // state of escrow B if both are triggered close together.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)

  // Derived directly from the actual escrow list, instead of separately
  // hardcoded numbers that can silently drift out of sync with the data
  // rendered right below them (which is what the original had — the cards
  // claimed "5 active" / "12 released" while the list showed 2 and 1).
  const activeEscrows = escrows.filter((e) => e.status === 'active')
  const releasedThisMonth = escrows.filter(
    (e) => e.status === 'released' && isThisMonth(e.releaseDate),
  )
  const activeTotalCents = activeEscrows.reduce((sum, e) => sum + e.amountCents, 0)
  const releasedThisMonthTotalCents = releasedThisMonth.reduce(
    (sum, e) => sum + e.amountCents,
    0,
  )

  async function handleReleaseFunds(id: string) {
    setActionError(null)
    setPendingIds((prev) => new Set(prev).add(id))
    try {
      // TODO: replace with your actual release-funds call (smart contract
      // interaction, server action, or REST endpoint).
      const res = await fetch(`/api/escrow/${id}/release`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message || 'Failed to release funds')
      }

      setEscrows((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: 'released', releaseDate: new Date().toISOString() }
            : e,
        ),
      )
      setConfirmingId(null)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to release funds. Please try again.',
      )
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Escrow Manager</h1>
          <p className="text-muted-foreground mt-1">Secure transactions with smart contracts</p>
        </div>
        <Button
          className="w-full sm:w-auto gap-2"
          onClick={() => router.push('/dashboard/escrow/create')}
        >
          <Plus className="w-4 h-4" />
          Create Escrow
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="ml-auto text-xs font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-2">Active Escrows</p>
          <p className="text-3xl font-bold text-foreground">{activeEscrows.length}</p>
          <p className="text-xs text-secondary mt-2">
            {formatUsd(activeTotalCents)} total value
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-2">Released This Month</p>
          <p className="text-3xl font-bold text-secondary">{releasedThisMonth.length}</p>
          <p className="text-xs text-secondary mt-2">
            {formatUsd(releasedThisMonthTotalCents)} released
          </p>
        </div>
      </div>

      {/* Escrow List */}
      {escrows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox className="w-10 h-10 text-gray-200 mb-4" />
          <p className="text-sm font-medium text-gray-500">No escrows yet</p>
          <Button
            className="mt-4 gap-2"
            onClick={() => router.push('/dashboard/escrow/create')}
          >
            <Plus className="w-4 h-4" />
            Create your first escrow
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {escrows.map((escrow) => {
            const isPending = pendingIds.has(escrow.id)
            const isConfirming = confirmingId === escrow.id
            const statusConfig = STATUS_CONFIG[escrow.status]

            return (
              <div key={escrow.id} className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">{escrow.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {escrow.from} → {escrow.to}
                    </p>
                  </div>
                  <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 border-y border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Amount</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatUsd(escrow.amountCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {escrow.status === 'active' ? 'Release Date' : 'Released'}
                    </p>
                    <p className="text-sm text-foreground">{formatDate(escrow.releaseDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Condition</p>
                    <p className="text-sm text-foreground">{escrow.condition}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  {escrow.status === 'active' &&
                    (isConfirming ? (
                      <>
                        <span className="text-sm text-muted-foreground">
                          Release {formatUsd(escrow.amountCents)} to {escrow.to}?
                        </span>
                        <Button
                          size="sm"
                          className="gap-2"
                          disabled={isPending}
                          onClick={() => handleReleaseFunds(escrow.id)}
                        >
                          {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          {isPending ? 'Releasing…' : 'Confirm'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => setConfirmingId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            setActionError(null)
                            setConfirmingId(escrow.id)
                          }}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Release Funds
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/escrow/${escrow.id}`)}
                        >
                          View Details
                        </Button>
                      </>
                    ))}
                  {escrow.status === 'released' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/dashboard/escrow/${escrow.id}/receipt`)}
                    >
                      View Receipt
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
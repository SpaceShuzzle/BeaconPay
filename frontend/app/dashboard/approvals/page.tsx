'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Clock, Loader2, Inbox } from 'lucide-react'

type ApprovalStatus = 'pending' | 'approved' | 'rejected'

interface Approval {
  id: string
  requester: string
  amount: number
  description: string
  date: string
  status: ApprovalStatus
}

const INITIAL_APPROVALS: Approval[] = [
  {
    id: 'APR001',
    requester: 'Sarah Martinez',
    amount: 2500,
    description: 'Freelance design work - March',
    date: 'Today at 2:30 PM',
    status: 'pending',
  },
  {
    id: 'APR002',
    requester: 'Alex Johnson',
    amount: 1200,
    description: 'Content creation - Monthly retainer',
    date: 'Yesterday',
    status: 'pending',
  },
  {
    id: 'APR003',
    requester: 'Creative Team',
    amount: 8750,
    description: 'Batch payment - Team salary',
    date: '2 days ago',
    status: 'approved',
  },
]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; icon: typeof Check; badgeClass: string }
> = {
  pending: { label: 'Pending', icon: Clock, badgeClass: 'bg-primary/20 text-primary' },
  approved: { label: 'Approved', icon: Check, badgeClass: 'bg-secondary/20 text-secondary' },
  rejected: { label: 'Rejected', icon: X, badgeClass: 'bg-destructive/20 text-destructive' },
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>(INITIAL_APPROVALS)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const pending = approvals.filter((a) => a.status === 'pending')
    const resolved = approvals.filter((a) => a.status !== 'pending')
    const approved = approvals.filter((a) => a.status === 'approved')

    const pendingAmount = pending.reduce((sum, a) => sum + a.amount, 0)
    const approvalRate = resolved.length > 0 ? Math.round((approved.length / resolved.length) * 100) : null

    return {
      pendingCount: pending.length,
      pendingAmount,
      approvalRate,
    }
  }, [approvals])

  async function resolveApproval(id: string, status: 'approved' | 'rejected') {
    setProcessingId(id)
    try {
      // Replace with a real API call, e.g.:
      // await fetch(`/api/approvals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      await new Promise((resolve) => setTimeout(resolve, 500))
      setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    } finally {
      setProcessingId(null)
    }
  }

  const pendingApprovals = approvals.filter((a) => a.status === 'pending')
  const resolvedApprovals = approvals.filter((a) => a.status !== 'pending')

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Approvals</h1>
        <p className="text-muted-foreground mt-1">Review and manage payment approvals</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-2">Pending Review</p>
          <p className="text-2xl font-bold text-foreground">{stats.pendingCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-2">Total Pending Amount</p>
          <p className="text-2xl font-bold text-foreground">
            {currencyFormatter.format(stats.pendingAmount)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-2">Approval Rate</p>
          <p className="text-2xl font-bold text-secondary">
            {stats.approvalRate === null ? '—' : `${stats.approvalRate}%`}
          </p>
        </div>
      </div>

      {/* Approval Queue */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Pending Approvals</h3>
        </div>

        {pendingApprovals.length === 0 && resolvedApprovals.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border">
            {[...pendingApprovals, ...resolvedApprovals].map((approval) => (
              <ApprovalRow
                key={approval.id}
                approval={approval}
                isProcessing={processingId === approval.id}
                onApprove={() => resolveApproval(approval.id, 'approved')}
                onReject={() => resolveApproval(approval.id, 'rejected')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ApprovalRow({
  approval,
  isProcessing,
  onApprove,
  onReject,
}: {
  approval: Approval
  isProcessing: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const { label, icon: StatusIcon, badgeClass } = STATUS_CONFIG[approval.status]

  return (
    <div className="p-6 hover:bg-background/50 transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{approval.requester}</p>
          <p className="text-sm text-muted-foreground mt-1">{approval.description}</p>
          <p className="text-xs text-muted-foreground mt-2">{approval.date}</p>
        </div>

        <div className="text-right flex flex-col items-end gap-3 shrink-0">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {currencyFormatter.format(approval.amount)}
            </p>
            <Badge className={`mt-1 gap-1 ${badgeClass}`}>
              <StatusIcon className="w-3 h-3" />
              {label}
            </Badge>
          </div>

          {approval.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-2"
                onClick={onApprove}
                disabled={isProcessing}
                aria-label={`Approve request from ${approval.requester} for ${currencyFormatter.format(approval.amount)}`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={onReject}
                disabled={isProcessing}
                aria-label={`Reject request from ${approval.requester} for ${currencyFormatter.format(approval.amount)}`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div className="rounded-full bg-muted p-3">
        <Inbox className="w-6 h-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">No approvals yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Payment requests will show up here as they come in.
        </p>
      </div>
    </div>
  )
}
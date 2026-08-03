'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react'

const escrows = [
  {
    id: 'ESC001',
    title: 'Freelance Project - Web Design',
    from: 'You',
    to: 'Sarah Martinez',
    amount: '$5,000.00',
    releaseDate: 'Mar 20, 2024',
    condition: 'Delivery of final designs',
    status: 'active',
  },
  {
    id: 'ESC002',
    title: 'Content Creation Agreement',
    from: 'You',
    to: 'Alex Johnson',
    amount: '$2,500.00',
    releaseDate: 'Mar 18, 2024',
    condition: 'Approval of content',
    status: 'active',
  },
  {
    id: 'ESC003',
    title: 'Completed: Brand Identity',
    from: 'You',
    to: 'Design Team',
    amount: '$8,750.00',
    releaseDate: 'Mar 15, 2024',
    condition: 'Final approval',
    status: 'released',
  },
]

export default function EscrowPage() {
  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Escrow Manager</h1>
          <p className="text-muted-foreground mt-1">Secure transactions with smart contracts</p>
        </div>
        <Button className="w-full sm:w-auto gap-2">
          <Plus className="w-4 h-4" />
          Create Escrow
        </Button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-2">Active Escrows</p>
          <p className="text-3xl font-bold text-foreground">5</p>
          <p className="text-xs text-secondary mt-2">$24,500.00 total value</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-2">Released This Month</p>
          <p className="text-3xl font-bold text-secondary">12</p>
          <p className="text-xs text-secondary mt-2">$87,250.00 released</p>
        </div>
      </div>

      {/* Escrow List */}
      <div className="space-y-4">
        {escrows.map((escrow) => (
          <div key={escrow.id} className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">{escrow.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {escrow.from} → {escrow.to}
                </p>
              </div>
              <Badge
                className={
                  escrow.status === 'active'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary/20 text-secondary'
                }
              >
                {escrow.status === 'active' ? 'Active' : 'Released'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 border-y border-border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount</p>
                <p className="text-lg font-bold text-foreground">{escrow.amount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Release Date</p>
                <p className="text-sm text-foreground">{escrow.releaseDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Condition</p>
                <p className="text-sm text-foreground">{escrow.condition}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              {escrow.status === 'active' && (
                <>
                  <Button size="sm" className="gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Release Funds
                  </Button>
                  <Button size="sm" variant="outline">
                    View Details
                  </Button>
                </>
              )}
              {escrow.status === 'released' && (
                <Button size="sm" variant="outline">
                  View Receipt
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

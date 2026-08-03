'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Clock } from 'lucide-react'

const approvals = [
  {
    id: 'APR001',
    requester: 'Sarah Martinez',
    amount: '$2,500.00',
    description: 'Freelance design work - March',
    date: 'Today at 2:30 PM',
    status: 'pending',
  },
  {
    id: 'APR002',
    requester: 'Alex Johnson',
    amount: '$1,200.00',
    description: 'Content creation - Monthly retainer',
    date: 'Yesterday',
    status: 'pending',
  },
  {
    id: 'APR003',
    requester: 'Creative Team',
    amount: '$8,750.00',
    description: 'Batch payment - Team salary',
    date: '2 days ago',
    status: 'approved',
  },
]

export default function ApprovalsPage() {
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
          <p className="text-2xl font-bold text-foreground">8</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-2">Total Pending Amount</p>
          <p className="text-2xl font-bold text-foreground">$12,450.00</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-2">Approval Rate</p>
          <p className="text-2xl font-bold text-secondary">94%</p>
        </div>
      </div>

      {/* Approval Queue */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Pending Approvals</h3>
        </div>

        <div className="divide-y divide-border">
          {approvals.map((approval) => (
            <div key={approval.id} className="p-6 hover:bg-background/50 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{approval.requester}</p>
                  <p className="text-sm text-muted-foreground mt-1">{approval.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">{approval.date}</p>
                </div>

                <div className="text-right flex flex-col items-end gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{approval.amount}</p>
                    <Badge className="mt-1 bg-primary/20 text-primary">Pending</Badge>
                  </div>

                  {approval.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-2">
                        <Check className="w-4 h-4" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-2">
                        <X className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {approval.status === 'approved' && (
                    <Badge className="bg-secondary/20 text-secondary">Approved</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

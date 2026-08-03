'use client'

import { Badge } from '@/components/ui/badge'
import { ArrowRight, ExternalLink } from 'lucide-react'

const transactions = [
  {
    id: 'TXN001',
    recipient: 'Sarah Martinez',
    amount: '$2,500.00',
    date: 'Today at 2:30 PM',
    status: 'completed',
    type: 'payment',
  },
  {
    id: 'TXN002',
    recipient: 'Creative Team Batch',
    amount: '$8,750.00',
    date: 'Yesterday',
    status: 'completed',
    type: 'batch',
  },
  {
    id: 'TXN003',
    recipient: 'Alex Johnson',
    amount: '$1,200.00',
    date: '2 days ago',
    status: 'pending',
    type: 'escrow',
  },
  {
    id: 'TXN004',
    recipient: 'Design Partners Inc',
    amount: '$5,450.00',
    date: '3 days ago',
    status: 'completed',
    type: 'payment',
  },
  {
    id: 'TXN005',
    recipient: 'Emma Wilson',
    amount: '$3,300.00',
    date: '5 days ago',
    status: 'failed',
    type: 'payment',
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-secondary/20 text-secondary hover:bg-secondary/30">Completed</Badge>
    case 'pending':
      return <Badge className="bg-primary/20 text-primary hover:bg-primary/30">Pending</Badge>
    case 'failed':
      return <Badge className="bg-destructive/20 text-destructive hover:bg-destructive/30">Failed</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

function getTypeIcon(type: string) {
  return <ArrowRight className="w-4 h-4 text-muted-foreground" />
}

export function RecentTransactions() {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
      </div>

      <div className="divide-y divide-border">
        {transactions.map((tx) => (
          <div key={tx.id} className="p-6 hover:bg-background/50 transition cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-muted/80 transition">
                  {getTypeIcon(tx.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{tx.recipient}</p>
                  <p className="text-xs text-muted-foreground mt-1">{tx.date}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{tx.amount}</p>
                  <div className="mt-1">{getStatusBadge(tx.status)}</div>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-background/50 text-center border-t border-border">
        <a href="/dashboard/payments" className="text-sm text-primary hover:text-primary/80 font-medium transition">
          View all transactions →
        </a>
      </div>
    </div>
  )
}

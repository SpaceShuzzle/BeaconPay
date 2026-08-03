'use client'

import { Button } from '@/components/ui/button'
import { DashboardCard } from '@/components/dashboard-card'
import { PaymentOverview } from '@/components/payment-overview'
import { RecentTransactions } from '@/components/recent-transactions'
import { Plus, Send, Clock } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here&apos;s your payment overview.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button className="flex-1 sm:flex-none gap-2">
            <Plus className="w-4 h-4" />
            New Payment
          </Button>
          <Button variant="outline" className="flex-1 sm:flex-none gap-2">
            <Send className="w-4 h-4" />
            Send Batch
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardCard
          title="Total Volume"
          value="$124,580.00"
          subtitle="This month"
          trend={{ value: 12.5, positive: true }}
        />
        <DashboardCard
          title="Pending Approvals"
          value="8"
          subtitle="Awaiting action"
          trend={{ value: 3, positive: false }}
        />
        <DashboardCard
          title="Active Escrows"
          value="5"
          subtitle="Secured transactions"
          trend={{ value: 0, positive: true }}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Overview - Larger Section */}
        <div className="lg:col-span-2">
          <PaymentOverview />
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-3 h-10">
              <Send className="w-4 h-4" />
              Send Payment
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-10">
              <Clock className="w-4 h-4" />
              Schedule Transfer
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-10">
              <Plus className="w-4 h-4" />
              Create Escrow
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <RecentTransactions />
      </div>
    </div>
  )
}

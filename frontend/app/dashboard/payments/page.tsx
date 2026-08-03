'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Download, Filter } from 'lucide-react'

const payments = [
  { id: 'PAY001', recipient: 'Sarah Martinez', amount: '$2,500.00', date: 'Today', status: 'completed' },
  { id: 'PAY002', recipient: 'Alex Johnson', amount: '$1,200.00', date: 'Yesterday', status: 'pending' },
  { id: 'PAY003', recipient: 'Design Team', amount: '$8,750.00', date: 'Mar 15', status: 'completed' },
  { id: 'PAY004', recipient: 'Emma Wilson', amount: '$3,300.00', date: 'Mar 14', status: 'completed' },
  { id: 'PAY005', recipient: 'Marketing Inc', amount: '$5,000.00', date: 'Mar 13', status: 'failed' },
]

export default function PaymentsPage() {
  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground mt-1">Manage and track all your payments</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button className="flex-1 sm:flex-none gap-2">
            <Plus className="w-4 h-4" />
            New Payment
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search payments..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filter
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Recipient</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-border hover:bg-background/50 transition">
                  <td className="px-6 py-4 text-sm text-foreground">{payment.recipient}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{payment.amount}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{payment.date}</td>
                  <td className="px-6 py-4">
                    <Badge
                      className={
                        payment.status === 'completed'
                          ? 'bg-secondary/20 text-secondary'
                          : payment.status === 'pending'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-destructive/20 text-destructive'
                      }
                    >
                      {payment.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

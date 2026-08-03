'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Eye, FileText, Search } from 'lucide-react'

const receipts = [
  {
    id: 'RCP001',
    recipient: 'Sarah Martinez',
    amount: '$2,500.00',
    date: 'Mar 16, 2024',
    transactionId: '0x7a3b...9f2c',
    status: 'confirmed',
  },
  {
    id: 'RCP002',
    recipient: 'Creative Team Batch',
    amount: '$8,750.00',
    date: 'Mar 15, 2024',
    transactionId: '0x5c1e...3a7b',
    status: 'confirmed',
  },
  {
    id: 'RCP003',
    recipient: 'Alex Johnson',
    amount: '$1,200.00',
    date: 'Mar 14, 2024',
    transactionId: '0x9d2f...4b8a',
    status: 'confirmed',
  },
  {
    id: 'RCP004',
    recipient: 'Design Partners Inc',
    amount: '$5,450.00',
    date: 'Mar 13, 2024',
    transactionId: '0x2e4c...8f1d',
    status: 'confirmed',
  },
]

export default function ReceiptsPage() {
  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Digital Receipts</h1>
        <p className="text-muted-foreground mt-1">Download and manage your payment receipts</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search receipts..."
          className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Receipts Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Recipient</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Transaction ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id} className="border-b border-border hover:bg-background/50 transition">
                  <td className="px-6 py-4 text-sm text-foreground">{receipt.recipient}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{receipt.amount}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{receipt.date}</td>
                  <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{receipt.transactionId}</td>
                  <td className="px-6 py-4">
                    <Badge className="bg-secondary/20 text-secondary">Confirmed</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">View</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">PDF</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Download */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Bulk Export</h3>
            <p className="text-sm text-muted-foreground mt-1">Download all receipts as a ZIP archive</p>
          </div>
          <Button className="gap-2">
            <Download className="w-4 h-4" />
            Export All
          </Button>
        </div>
      </div>
    </div>
  )
}

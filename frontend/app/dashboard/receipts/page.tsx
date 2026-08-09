'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Eye, Search, Copy, Check, Loader2, Inbox } from 'lucide-react'

type ReceiptStatus = 'confirmed' | 'pending' | 'failed'

interface Receipt {
  id: string
  recipient: string
  amount: number
  date: string
  transactionId: string
  status: ReceiptStatus
}

const RECEIPTS: Receipt[] = [
  {
    id: 'RCP001',
    recipient: 'Sarah Martinez',
    amount: 2500,
    date: 'Mar 16, 2024',
    transactionId: '0x7a3b...9f2c',
    status: 'confirmed',
  },
  {
    id: 'RCP002',
    recipient: 'Creative Team Batch',
    amount: 8750,
    date: 'Mar 15, 2024',
    transactionId: '0x5c1e...3a7b',
    status: 'confirmed',
  },
  {
    id: 'RCP003',
    recipient: 'Alex Johnson',
    amount: 1200,
    date: 'Mar 14, 2024',
    transactionId: '0x9d2f...4b8a',
    status: 'confirmed',
  },
  {
    id: 'RCP004',
    recipient: 'Design Partners Inc',
    amount: 5450,
    date: 'Mar 13, 2024',
    transactionId: '0x2e4c...8f1d',
    status: 'confirmed',
  },
]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const STATUS_CONFIG: Record<ReceiptStatus, { label: string; badgeClass: string }> = {
  confirmed: { label: 'Confirmed', badgeClass: 'bg-secondary/20 text-secondary' },
  pending: { label: 'Pending', badgeClass: 'bg-primary/20 text-primary' },
  failed: { label: 'Failed', badgeClass: 'bg-destructive/20 text-destructive' },
}

export default function ReceiptsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredReceipts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return RECEIPTS

    return RECEIPTS.filter((receipt) =>
      [receipt.recipient, receipt.transactionId, receipt.date, currencyFormatter.format(receipt.amount)]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [searchQuery])

  async function handleView(receipt: Receipt) {
    setViewingId(receipt.id)
    try {
      // TODO: replace with real navigation/modal, e.g.:
      // router.push(`/receipts/${receipt.id}`)
      await new Promise((resolve) => setTimeout(resolve, 300))
    } finally {
      setViewingId(null)
    }
  }

  async function handleDownload(receipt: Receipt) {
    setDownloadingId(receipt.id)
    try {
      // TODO: replace with a real download, e.g.:
      // const res = await fetch(`/api/receipts/${receipt.id}/pdf`)
      // const blob = await res.blob()
      // triggerBrowserDownload(blob, `receipt-${receipt.id}.pdf`)
      await new Promise((resolve) => setTimeout(resolve, 600))
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleExportAll() {
    setIsExporting(true)
    try {
      // TODO: replace with a real bulk export, e.g.:
      // const res = await fetch('/api/receipts/export')
      // const blob = await res.blob()
      // triggerBrowserDownload(blob, 'receipts.zip')
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } finally {
      setIsExporting(false)
    }
  }

  async function handleCopyTransactionId(receipt: Receipt) {
    try {
      await navigator.clipboard.writeText(receipt.transactionId)
      setCopiedId(receipt.id)
      setTimeout(() => setCopiedId((current) => (current === receipt.id ? null : current)), 1500)
    } catch {
      // Clipboard API unavailable (unsupported browser/context) — fail silently,
      // the transaction ID is still visible and selectable in the table.
    }
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Digital Receipts</h1>
        <p className="text-muted-foreground mt-1">Download and manage your payment receipts</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by recipient, date, or transaction ID..."
          aria-label="Search receipts"
          className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Receipts Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {filteredReceipts.length === 0 ? (
          <EmptyState hasQuery={searchQuery.trim().length > 0} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-foreground">Recipient</th>
                  <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-foreground">Amount</th>
                  <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-foreground">Date</th>
                  <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-foreground">Transaction ID</th>
                  <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                  <th scope="col" className="px-6 py-4 text-right text-sm font-semibold text-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((receipt) => {
                  const { label, badgeClass } = STATUS_CONFIG[receipt.status]

                  return (
                    <tr key={receipt.id} className="border-b border-border hover:bg-background/50 transition">
                      <td className="px-6 py-4 text-sm text-foreground">{receipt.recipient}</td>
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {currencyFormatter.format(receipt.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{receipt.date}</td>
                      <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>{receipt.transactionId}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyTransactionId(receipt)}
                            aria-label={`Copy transaction ID for ${receipt.recipient}`}
                            className="text-muted-foreground hover:text-foreground transition"
                          >
                            {copiedId === receipt.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={badgeClass}>{label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleView(receipt)}
                            disabled={viewingId === receipt.id}
                            aria-label={`View receipt for ${receipt.recipient}`}
                          >
                            {viewingId === receipt.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleDownload(receipt)}
                            disabled={downloadingId === receipt.id}
                            aria-label={`Download PDF receipt for ${receipt.recipient}`}
                          >
                            {downloadingId === receipt.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">PDF</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Download */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Bulk Export</h3>
            <p className="text-sm text-muted-foreground mt-1">Download all receipts as a ZIP archive</p>
          </div>
          <Button className="gap-2" onClick={handleExportAll} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Exporting...' : 'Export All'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div className="rounded-full bg-muted p-3">
        {hasQuery ? (
          <Search className="w-6 h-6 text-muted-foreground" />
        ) : (
          <Inbox className="w-6 h-6 text-muted-foreground" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {hasQuery ? 'No matching receipts' : 'No receipts yet'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {hasQuery
            ? 'Try a different recipient, date, or transaction ID.'
            : 'Payment receipts will show up here once you have transactions.'}
        </p>
      </div>
    </div>
  )
}
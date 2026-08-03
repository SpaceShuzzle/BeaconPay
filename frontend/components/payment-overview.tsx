'use client'

import { BarChart3 } from 'lucide-react'

export function PaymentOverview() {
  const mockData = [
    { day: 'Mon', value: 40, max: 100 },
    { day: 'Tue', value: 55, max: 100 },
    { day: 'Wed', value: 35, max: 100 },
    { day: 'Thu', value: 75, max: 100 },
    { day: 'Fri', value: 85, max: 100 },
    { day: 'Sat', value: 45, max: 100 },
    { day: 'Sun', value: 60, max: 100 },
  ]

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Payment Volume</h3>
          <p className="text-sm text-muted-foreground mt-1">This week&apos;s activity</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Simple Bar Chart */}
      <div className="flex items-end justify-between gap-2 h-48">
        {mockData.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full bg-muted rounded-t-lg overflow-hidden flex items-end justify-center h-32">
              <div
                className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t-lg transition-all hover:from-primary/80"
                style={{ height: `${item.value}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground font-medium">{item.day}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Average Daily Volume</p>
          <p className="text-lg font-semibold text-foreground">$17,798</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Peak Day</p>
          <p className="text-lg font-semibold text-foreground">Friday</p>
        </div>
      </div>
    </div>
  )
}

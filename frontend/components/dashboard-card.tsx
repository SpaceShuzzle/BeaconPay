'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

interface DashboardCardProps {
  title: string
  value: string
  subtitle: string
  trend?: {
    value: number
    positive: boolean
  }
}

export function DashboardCard({ title, value, subtitle, trend }: DashboardCardProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <p className="text-sm text-muted-foreground mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{value}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              trend.positive ? 'bg-secondary/20 text-secondary' : 'bg-destructive/20 text-destructive'
            }`}
          >
            {trend.positive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-xs font-medium">{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

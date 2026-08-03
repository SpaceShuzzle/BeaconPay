'use client'

import { Bell, Search, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DashboardHeader() {
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sm:px-8">
      <div className="flex items-center gap-4 flex-1">
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-4 h-4" />
        </Button>
        
        <div className="hidden sm:flex items-center gap-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search payments..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
        </Button>

        <Button variant="outline" size="sm" className="gap-2">
          <div className="w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center">
            <span className="text-xs font-semibold">U</span>
          </div>
          <span className="hidden sm:inline text-sm">Account</span>
        </Button>
      </div>
    </header>
  )
}

'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, Bell, Lock, Wallet, Users, Zap } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {/* Account Settings */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Account
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Email Address</label>
            <p className="text-sm text-muted-foreground mt-1">john@example.com</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Display Name</label>
            <p className="text-sm text-muted-foreground mt-1">John Doe</p>
          </div>
          <Button variant="outline" size="sm">
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Wallet Settings */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Wallet & Blockchain
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Stellar Account</label>
              <p className="text-sm text-muted-foreground mt-1">GAXZ...6XQJ</p>
            </div>
            <Badge className="bg-secondary/20 text-secondary">Connected</Badge>
          </div>
          <Button variant="outline" size="sm">
            Manage Wallets
          </Button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Payment Confirmations</p>
              <p className="text-xs text-muted-foreground mt-1">Get notified when payments complete</p>
            </div>
            <input type="checkbox" className="w-5 h-5" defaultChecked />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Approval Requests</p>
              <p className="text-xs text-muted-foreground mt-1">Get notified of pending approvals</p>
            </div>
            <input type="checkbox" className="w-5 h-5" defaultChecked />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Weekly Summary</p>
              <p className="text-xs text-muted-foreground mt-1">Receive weekly activity reports</p>
            </div>
            <input type="checkbox" className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Security
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <Button variant="outline" size="sm" className="w-full justify-start">
            Change Password
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            Enable Two-Factor Authentication
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            Manage API Keys
          </Button>
        </div>
      </div>

      {/* Team Collaboration */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">You have 3 team members with access to this account</p>
          <Button variant="outline" size="sm">
            Manage Team
          </Button>
        </div>
      </div>

      {/* Billing */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Billing
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Plan</label>
              <p className="text-sm text-muted-foreground mt-1">Premium - $29/month</p>
            </div>
            <Badge className="bg-primary/20 text-primary">Active</Badge>
          </div>
          <Button variant="outline" size="sm">
            Manage Subscription
          </Button>
        </div>
      </div>
    </div>
  )
}

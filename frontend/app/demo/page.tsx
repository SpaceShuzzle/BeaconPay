'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Play } from 'lucide-react'

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-foreground">
            BeaconPay
          </Link>
          <Link href="/auth/signin">
            <Button size="sm">Sign In</Button>
          </Link>
        </div>
      </header>

      {/* Demo Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <Badge className="inline-flex mb-4 bg-secondary/20 text-secondary hover:bg-secondary/30">
            <Play className="w-3 h-3 mr-1" />
            Interactive Demo
          </Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">See BeaconPay in action</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore the platform features with our interactive demo
          </p>
        </div>

        {/* Demo Sections */}
        <div className="space-y-8">
          {/* Dashboard Demo */}
          <section className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Dashboard Overview</h2>
              <p className="text-muted-foreground mb-6">
                Get instant insights into your payment activity with real-time analytics
              </p>
              <div className="bg-background/50 rounded-lg h-96 flex items-center justify-center border border-border/50">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">Dashboard preview coming soon</p>
                  <Button className="gap-2">
                    Explore Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Batch Payments Demo */}
          <section className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Batch Payments</h2>
              <p className="text-muted-foreground mb-6">
                Send multiple payments in a single transaction to save on fees
              </p>
              <div className="bg-background/50 rounded-lg h-96 flex items-center justify-center border border-border/50">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">Batch payment interface preview</p>
                  <Button className="gap-2">
                    Try Batch Payments
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Approvals Demo */}
          <section className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Multi-Sig Approvals</h2>
              <p className="text-muted-foreground mb-6">
                Require multiple approvals for payment verification and compliance
              </p>
              <div className="bg-background/50 rounded-lg h-96 flex items-center justify-center border border-border/50">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">Approval workflow preview</p>
                  <Button className="gap-2">
                    View Approvals
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to get started?</h2>
          <Link href="/auth/signup">
            <Button size="lg" className="gap-2">
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight,
  Play,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  Clock,
  type LucideIcon,
} from 'lucide-react'

interface DemoSectionProps {
  id: string
  icon: LucideIcon
  title: string
  description: string
}

// Every section currently renders the same "not built yet" placeholder —
// once real screenshots/embeds exist for a given feature, swap this
// component's body for the actual demo content for that section only,
// rather than changing all three at once.
function DemoSection({ id, icon: Icon, title, description }: DemoSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-24 bg-card rounded-2xl border border-border overflow-hidden"
    >
      <div className="p-8">
        <div className="flex items-start gap-4 mb-2">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          </div>
        </div>
        <p className="text-muted-foreground mb-6 ml-15 pl-0">{description}</p>
        <div className="bg-background/50 rounded-lg h-96 flex items-center justify-center border border-border/50">
          <div className="text-center px-6">
            <Badge className="inline-flex mb-4 bg-muted text-muted-foreground hover:bg-muted">
              <Clock className="w-3 h-3 mr-1" />
              Coming soon
            </Badge>
            <p className="text-muted-foreground mb-4">
              We&apos;re still building this preview. Create a free account to try{' '}
              {title.toLowerCase()} for real today.
            </p>
            <Link href="/auth/signup">
              <Button className="gap-2">
                Create Free Account
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

const SECTIONS: DemoSectionProps[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard Overview',
    description: 'Get instant insights into your payment activity with real-time analytics',
  },
  {
    id: 'batch-payments',
    icon: Layers,
    title: 'Batch Payments',
    description: 'Send multiple payments in a single transaction to save on fees',
  },
  {
    id: 'approvals',
    icon: ShieldCheck,
    title: 'Multi-Sig Approvals',
    description: 'Require multiple approvals for payment verification and compliance',
  },
]

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

      {/* Section nav — lets visitors jump straight to the part they care
          about instead of scrolling past three large, similarly-shaped
          blocks to find it. */}
      <nav className="sticky top-16 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-6 overflow-x-auto">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground whitespace-nowrap transition-colors"
            >
              {section.title}
            </a>
          ))}
        </div>
      </nav>

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
          {SECTIONS.map((section) => (
            <DemoSection key={section.id} {...section} />
          ))}
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
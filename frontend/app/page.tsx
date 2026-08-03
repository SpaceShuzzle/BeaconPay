'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Zap, Share2, Lock, BarChart3, Sparkles, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">BeaconPay</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition">
              How it works
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition">
              Pricing
            </a>
          </div>
          <Link href="/auth/signin">
            <Button size="sm" className="gap-2">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 border border-secondary/30 mb-6">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span className="text-sm text-secondary">Powered by Stellar</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6 leading-tight">
            Collaborative payments
            <br />
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              reimagined
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Send batch payments, get instant approvals, and manage escrow with blockchain security. The platform creators trust.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="gap-2">
                Enter Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 text-foreground">
          Premium features, built for teams
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Batch Payments */}
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Batch Payments</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Send multiple payments in one transaction. Reduce fees and save time with intelligent batching.
            </p>
          </div>

          {/* Instant Approvals */}
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-secondary/50 transition">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Instant Approvals</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Real-time approval workflows with multi-sig validation. Keep everyone in sync.
            </p>
          </div>

          {/* Escrow Manager */}
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-accent/50 transition">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Smart Escrow</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Secure transactions with blockchain-backed escrow. Release funds when conditions are met.
            </p>
          </div>

          {/* Social Preview */}
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Share2 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Social Preview</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create shareable payment previews for your audience. Build community engagement.
            </p>
          </div>

          {/* AI Payment Builder */}
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-secondary/50 transition">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">AI Payment Builder</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Describe your payment needs in natural language. Our AI generates transactions instantly.
            </p>
          </div>

          {/* Receipt Management */}
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-accent/50 transition">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
              <BarChart3 className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Digital Receipts</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Automated receipts with PDF export. Keep audit trails for compliance and accounting.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-3xl border border-primary/20 p-12 sm:p-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
            Ready to revolutionize payments?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join creators and teams using BeaconPay to collaborate with confidence.
          </p>
          <Link href="/auth/signin">
            <Button size="lg" className="gap-2">
              Create Account
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="w-3 h-3 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">BeaconPay</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 BeaconPay. Building the future of fintech collaboration.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

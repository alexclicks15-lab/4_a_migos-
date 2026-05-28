'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ExternalLink,
  HelpCircle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

interface ConfigState {
  connected: boolean
  calendarId?: string
  demo?: boolean
  demoMode?: boolean
  needsReconnect?: boolean
}

export function IntegrationsPanel() {
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [config, setConfig] = useState<ConfigState | null>(null)

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/integrations/google/config')
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      } else {
        setConfig({ connected: false, demoMode: true })
      }
    } catch (err) {
      console.error('Failed to load Google Calendar config:', err)
      toast.error('Failed to load configuration status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleConnect = () => {
    // Redirect to auth endpoint
    const siteUrl = window.location.origin
    window.location.href = `/api/integrations/google/auth?siteUrl=${encodeURIComponent(siteUrl)}`
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) {
      return
    }

    try {
      setDisconnecting(true)
      const res = await fetch('/api/integrations/google/config', {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to disconnect')
        return
      }

      toast.success('Google Calendar disconnected successfully')
      setConfig({ connected: false, demoMode: config?.demoMode })
    } catch (err) {
      console.error('Disconnect error:', err)
      toast.error('An error occurred during disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  const isDemo = config?.demo
  const isDemoModeActive = config?.demoMode

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      {/* Main Connection settings */}
      <div className="space-y-6">
        {/* Banner indicating sandbox/demo mode */}
        {isDemoModeActive && (
          <Alert className="bg-blue-950/40 border-blue-600/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-blue-200 mb-1">
                  OAuth Credentials Not Configured (Demo Mode Active)
                </AlertTitle>
                <AlertDescription className="text-blue-100/80 text-sm">
                  Google Client credentials are not set in your environment. The system has automatically fallback to **Sandbox/Demo Mode**. You can connect instantly with one click below and simulate calendar event creations.
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {/* Connection status display */}
        <Alert className="bg-slate-900 border-slate-700">
          <div className="flex items-center gap-2">
            {config?.connected ? (
              <CheckCircle2 className="size-4 text-emerald-400" />
            ) : (
              <XCircle className="size-4 text-slate-400" />
            )}
            <AlertTitle className="text-white mb-0 font-semibold">
              {config?.connected ? 'Google Calendar Connected' : 'Google Calendar Disconnected'}
            </AlertTitle>
          </div>
          <AlertDescription className="text-slate-400 mt-1">
            {config?.connected
              ? `Events will be automatically added to the calendar ID: "${config.calendarId || 'primary'}".${
                  isDemo ? ' Running in virtualized Sandbox Demo Mode.' : ''
                }`
              : 'Integrate Google Calendar with your automations to auto-create calendar events during conversations.'}
          </AlertDescription>
        </Alert>

        {/* Google Calendar Card */}
        <Card className="bg-slate-900 border-slate-700 overflow-hidden relative">
          <div className="absolute right-4 top-4 opacity-5 pointer-events-none">
            <Calendar className="size-36 text-white" />
          </div>

          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                <Calendar className="size-5" />
              </div>
              <div>
                <CardTitle className="text-white text-lg">Google Calendar</CardTitle>
                <CardDescription className="text-slate-400">
                  Connect your business schedule and automate appointment booking.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {config?.connected ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Calendar Name</span>
                    <span className="text-white font-medium">Primary Calendar</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Connection Mode</span>
                    <span className="text-white font-medium">
                      {isDemo ? (
                        <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-[11px] border border-blue-500/20">
                          Demo Sandbox
                        </span>
                      ) : (
                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[11px] border border-emerald-500/20">
                          Production OAuth
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Status</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    variant="destructive"
                    className="w-full sm:w-auto"
                  >
                    {disconnecting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      'Disconnect Integration'
                    )}
                  </Button>
                  <Button
                    onClick={fetchConfig}
                    variant="outline"
                    className="border-slate-800 text-slate-300 hover:text-white shrink-0"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-400 leading-relaxed">
                  Allow your automation workflows to schedule follow-ups, book callback meetings, or create reminders for your sales agents directly inside Google Calendar.
                </p>

                <Button
                  onClick={handleConnect}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  <Calendar className="size-4 mr-2" />
                  Connect Google Calendar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar documentation */}
      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" /> Setup Instructions
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              How to configure custom Google Developer Credentials in production.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion>
              <AccordionItem className="border-slate-800" value="step-1">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline text-sm py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">1</span>
                    Create Developer Project
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 text-xs space-y-1">
                  <p>Go to the **Google Cloud Console**.</p>
                  <p>Create a new project and select it from the top dashboard selector.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-slate-800" value="step-2">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline text-sm py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">2</span>
                    Enable Calendar API
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 text-xs space-y-1">
                  <p>Navigate to **APIs & Services &gt; Library**.</p>
                  <p>Search for **Google Calendar API** and click **Enable**.</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-slate-800" value="step-3">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline text-sm py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">3</span>
                    Create OAuth Credentials
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 text-xs space-y-1.5">
                  <p>Go to **APIs & Services &gt; Credentials**.</p>
                  <p>Click **Create Credentials &gt; OAuth client ID**.</p>
                  <p>Set Application Type to **Web application**.</p>
                  <p>Add Authorized redirect URIs:</p>
                  <code className="block bg-slate-950 p-2 rounded text-[11px] font-mono break-all text-slate-300 border border-slate-800 select-all">
                    YOUR_SITE_URL/api/integrations/google/callback
                  </code>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-slate-800" value="step-4">
                <AccordionTrigger className="text-slate-300 hover:text-white hover:no-underline text-sm py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">4</span>
                    Update Environment
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 text-xs space-y-1.5">
                  <p>Copy the Client ID and Client Secret, then add them to `.env.local`:</p>
                  <div className="bg-slate-950 p-2 rounded text-[10px] font-mono text-slate-400 border border-slate-800 space-y-1">
                    <div>GOOGLE_CLIENT_ID=your_id</div>
                    <div>GOOGLE_CLIENT_SECRET=your_secret</div>
                  </div>
                  <p className="mt-1 text-slate-500">Restart your Next.js server to apply variables.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-4 pt-4 border-t border-slate-800">
              <a
                href="https://developers.google.com/calendar/api/guides/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="size-3.5" />
                Google Calendar API Docs
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { useState, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Sparkles, ArrowRight, Brain, Zap, Clock, BadgeCheck, Play, HelpCircle, AlertCircle, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  AutomationBuilder,
  type BuilderInitial,
  type BuilderStep,
} from "@/components/automations/automation-builder"
import { AUTOMATION_TEMPLATES, type TemplateSlug } from "@/lib/automations/templates"
import type { AutomationStepType, AutomationTriggerType } from "@/types"

type PageMode = "ai" | "manual" | "builder"

interface AIGenerationResult {
  triggers: string[]
  actions: string[]
  conditions: string[]
  ai_prompts: string[]
  crm_updates: string[]
  insights?: {
    optimizations?: string[]
    debugging?: string[]
    campaigns?: string[]
    triggers?: string[]
    analytics?: string[]
  }
  workflow: {
    name: string
    description: string
    trigger_type: string
    trigger_config: Record<string, any>
    steps: any[]
  }
}

const TEMPLATE_ORDER: TemplateSlug[] = [
  "welcome_message",
  "out_of_office",
  "lead_qualifier",
  "follow_up_reminder",
]

export default function NewAutomationPage() {
  const params = useSearchParams()
  const router = useRouter()
  const templateParam = params.get("template") as TemplateSlug | null

  const [mode, setMode] = useState<PageMode>(templateParam ? "builder" : "ai")
  const [prompt, setPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [aiResult, setAiResult] = useState<AIGenerationResult | null>(null)
  
  // Custom initial state passed to builder
  const [builderInitial, setBuilderInitial] = useState<BuilderInitial | null>(null)

  // Expand templates if selected manually
  const templateInitial = useMemo(() => {
    if (templateParam && AUTOMATION_TEMPLATES[templateParam]) {
      const t = AUTOMATION_TEMPLATES[templateParam]
      const steps = expandFromSeeds(
        t.steps.map((seed, idx) => ({
          index: idx,
          step_type: seed.step_type,
          step_config: seed.step_config as Record<string, unknown>,
          branch: seed.branch ?? null,
          parent_index: seed.parent_index ?? null,
        })),
      )
      return {
        name: t.name,
        description: t.description,
        trigger_type: t.trigger_type,
        trigger_config: t.trigger_config as Record<string, unknown>,
        is_active: false,
        steps,
      }
    }
    return null
  }, [templateParam])

  // Run AI Flow generation
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a description of your automation needs.")
      return
    }

    try {
      setGenerating(true)
      const res = await fetch("/api/automations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      })

      if (!res.ok) {
        throw new Error("Failed to compile requirements")
      }

      const result = (await res.json()) as AIGenerationResult
      setAiResult(result)
      toast.success("AI successfully created your automation flow plan!")
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to generate automation. Running local sandbox rules...")
    } finally {
      setGenerating(false)
    }
  }

  // Load into React Flow Builder Canvas
  const handleLoadToBuilder = () => {
    if (!aiResult) return

    const steps = ensureCids(aiResult.workflow.steps)
    setBuilderInitial({
      name: aiResult.workflow.name,
      description: aiResult.workflow.description,
      trigger_type: aiResult.workflow.trigger_type as AutomationTriggerType,
      trigger_config: aiResult.workflow.trigger_config || {},
      is_active: false,
      steps,
    })
    setMode("builder")
  }

  const handleStartBlank = () => {
    setBuilderInitial({
      name: "New Custom Automation",
      description: "Custom workflow created from scratch.",
      trigger_type: "new_message_received" as AutomationTriggerType,
      trigger_config: {},
      is_active: false,
      steps: [],
    })
    setMode("builder")
  }

  const handleStartTemplate = (slug: TemplateSlug) => {
    const t = AUTOMATION_TEMPLATES[slug]
    const steps = expandFromSeeds(
      t.steps.map((seed, idx) => ({
        index: idx,
        step_type: seed.step_type,
        step_config: seed.step_config as Record<string, unknown>,
        branch: seed.branch ?? null,
        parent_index: seed.parent_index ?? null,
      })),
    )
    setBuilderInitial({
      name: t.name,
      description: t.description,
      trigger_type: t.trigger_type,
      trigger_config: t.trigger_config as Record<string, unknown>,
      is_active: false,
      steps,
    })
    setMode("builder")
  }

  // Mount builder
  if (mode === "builder") {
    const initialData = builderInitial || templateInitial || {
      name: "",
      description: "",
      trigger_type: "new_message_received" as AutomationTriggerType,
      trigger_config: {},
      is_active: false,
      steps: [],
    }
    return <AutomationBuilder initial={initialData} />
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/25">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-xl font-bold text-white">Create Automation Flow</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">Design automated responders, updates, reminders, and triggers for WhatsApp.</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-slate-800/80">
        <button
          onClick={() => { setMode("ai"); setAiResult(null) }}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors outline-none cursor-pointer border-b-2 ${
            mode === "ai" ? "text-indigo-400 border-indigo-500" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <Brain className="h-4 w-4" />
          <span>AI Generator</span>
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors outline-none cursor-pointer border-b-2 ${
            mode === "manual" ? "text-indigo-400 border-indigo-500" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>Templates & Scratch</span>
        </button>
      </div>

      {/* AI Mode Creator */}
      {mode === "ai" && (
        <div className="grid gap-6 md:grid-cols-[1fr_380px]">
          {/* Main prompt builder */}
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800/80">
              <CardHeader>
                <CardTitle className="text-white text-base">Describe Your Automation Needs</CardTitle>
                <CardDescription className="text-slate-400 text-xs">AI will outline the nodes, connect branches, and design triggers in plain English.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-slate-300 text-xs">Prompt Description</Label>
                  <Textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g. I need to send birthday reminders to customers from Google Sheets, then wait 1 day, and add tag: 'VIP Birthday'."
                    className="bg-slate-950 border-slate-800 text-xs text-white min-h-[120px] placeholder-slate-600 focus-visible:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button onClick={handleStartBlank} variant="outline" className="border-slate-800 text-slate-400 hover:text-white shrink-0">
                    Skip & Blank Canvas
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || !prompt.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shrink-0"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-1.5" />
                        Generate Workflow
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Suggestions cards */}
            <div className="space-y-3">
              <h4 className="text-white font-bold text-xs uppercase tracking-wider text-slate-400">Try these suggestions</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { text: "Send birthday reminders for customers from Google Sheets", icon: Clock },
                  { text: "I need clinic appointment reminders and wait 1 day follow-up", icon: Play },
                  { text: "Auto-reply welcome greeting to first inbound and tag as New Lead", icon: HelpCircle },
                  { text: "Cart recovery message wait 3 hours after checkout abandon", icon: AlertCircle }
                ].map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(sug.text)}
                    className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg hover:border-indigo-500/40 text-left text-xs text-slate-300 hover:text-white transition-all group flex items-start gap-2.5"
                  >
                    <sug.icon className="h-4 w-4 text-indigo-400 group-hover:scale-105 shrink-0 mt-0.5" />
                    <span>{sug.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Resulting Plan Insights */}
          <div>
            <AnimatePresence mode="wait">
              {aiResult ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Analysis Breakdown */}
                  <Card className="bg-slate-900 border-indigo-500/20 shadow-lg shadow-indigo-950/20 relative overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-1.5">
                        <Brain className="h-4.5 w-4.5 text-indigo-400" />
                        <CardTitle className="text-white text-sm font-bold">AI Workflow Plan</CardTitle>
                      </div>
                      <CardDescription className="text-slate-400 text-[10px]">What the AI Planner structured for your requirements.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-xs">
                      {/* Triggers */}
                      <div>
                        <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px]">Trigger Event</span>
                        <div className="p-2 bg-slate-950 rounded border border-slate-800 mt-1 text-white font-medium">
                          {aiResult.triggers[0] || 'Trigger Defined'}
                        </div>
                      </div>

                      {/* Actions */}
                      <div>
                        <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px] block mb-1">Actions Planned</span>
                        <ul className="space-y-1 text-slate-300">
                          {aiResult.actions.map((act, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* CRM Updates */}
                      {aiResult.crm_updates.length > 0 && (
                        <div>
                          <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px] block mb-1">CRM Modifications</span>
                          <div className="space-y-1">
                            {aiResult.crm_updates.map((upd, i) => (
                              <span key={i} className="inline-block bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] px-2 py-0.5 rounded font-medium mr-1.5 mb-1.5">
                                {upd}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Steps Preview */}
                      <div>
                        <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px] block mb-1">Workflow Steps Preview</span>
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 max-h-[140px] overflow-y-auto font-mono text-[10px] text-slate-400">
                          <div className="text-emerald-400 flex items-center gap-1">
                            <BadgeCheck className="h-3 w-3 shrink-0" /> Trigger: {aiResult.workflow.trigger_type}
                          </div>
                          {aiResult.workflow.steps.map((step, idx) => (
                            <div key={idx} className="pl-3 border-l border-slate-800 flex items-start gap-1">
                              <span className="text-slate-600">{idx + 1}.</span>
                              <div>
                                <span className="text-slate-200 capitalize font-sans">{step.step_type.replace('_', ' ')}</span>
                                {step.step_config?.text && <p className="text-slate-500 text-[9px] truncate max-w-[200px] mt-0.5">"{step.step_config.text}"</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Advanced AI Assistant Insights */}
                      {aiResult.insights && (
                        <div className="space-y-2 border-t border-slate-800 pt-3 mt-3">
                          <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px] block">AI Assistant Insights</span>
                          
                          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                            {/* Optimizations */}
                            {aiResult.insights.optimizations && aiResult.insights.optimizations.length > 0 && (
                              <div className="p-2 bg-indigo-950/20 border border-indigo-500/10 rounded">
                                <span className="text-[9px] font-extrabold text-indigo-400 uppercase tracking-wide block mb-0.5">🧠 Optimization Suggestions</span>
                                <ul className="list-disc pl-3 text-[10px] text-slate-350 space-y-0.5">
                                  {aiResult.insights.optimizations.map((opt: string, i: number) => <li key={i}>{opt}</li>)}
                                </ul>
                              </div>
                            )}

                            {/* Debugging */}
                            {aiResult.insights.debugging && aiResult.insights.debugging.length > 0 && (
                              <div className="p-2 bg-rose-950/20 border border-rose-500/10 rounded">
                                <span className="text-[9px] font-extrabold text-rose-400 uppercase tracking-wide block mb-0.5">⚠️ Workflow Debugger</span>
                                <ul className="list-disc pl-3 text-[10px] text-slate-355 space-y-0.5">
                                  {aiResult.insights.debugging.map((dbg: string, i: number) => <li key={i}>{dbg}</li>)}
                                </ul>
                              </div>
                            )}

                            {/* Campaign recommendations */}
                            {aiResult.insights.campaigns && aiResult.insights.campaigns.length > 0 && (
                              <div className="p-2 bg-emerald-950/20 border border-emerald-500/10 rounded">
                                <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wide block mb-0.5">📅 Campaign Recommendations</span>
                                <ul className="list-disc pl-3 text-[10px] text-slate-350 space-y-0.5">
                                  {aiResult.insights.campaigns.map((rec: string, i: number) => <li key={i}>{rec}</li>)}
                                </ul>
                              </div>
                            )}

                            {/* Trigger suggestions */}
                            {aiResult.insights.triggers && aiResult.insights.triggers.length > 0 && (
                              <div className="p-2 bg-amber-950/20 border border-amber-500/10 rounded">
                                <span className="text-[9px] font-extrabold text-amber-400 uppercase tracking-wide block mb-0.5">⚡ Alternative Entry Triggers</span>
                                <ul className="list-disc pl-3 text-[10px] text-slate-350 space-y-0.5">
                                  {aiResult.insights.triggers.map((trig: string, i: number) => <li key={i}>{trig}</li>)}
                                </ul>
                              </div>
                            )}

                            {/* Analytics insights */}
                            {aiResult.insights.analytics && aiResult.insights.analytics.length > 0 && (
                              <div className="p-2 bg-pink-950/20 border border-pink-500/10 rounded">
                                <span className="text-[9px] font-extrabold text-pink-400 uppercase tracking-wide block mb-0.5">📊 Predicted Conversion Analytics</span>
                                <ul className="list-disc pl-3 text-[10px] text-slate-350 space-y-0.5">
                                  {aiResult.insights.analytics.map((an: string, i: number) => <li key={i}>{an}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <Button onClick={handleLoadToBuilder} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-full mt-2">
                        Load into Canvas Editor
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <Card className="bg-slate-900 border-slate-800/80 p-6 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <div className="h-12 w-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
                    <Brain className="h-5 w-5" />
                  </div>
                  <h4 className="text-slate-300 font-bold text-xs">Awaiting Requirements</h4>
                  <p className="text-slate-500 text-[10px] max-w-[200px] mt-1 mx-auto leading-relaxed">
                    Describe your desired campaign, reminders, or support auto-replies and the AI planner will generate a visual node structure here.
                  </p>
                </Card>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Manual Mode / Templates */}
      {mode === "manual" && (
        <div className="space-y-6">
          {/* Quick templates */}
          <section className="space-y-3">
            <h3 className="text-white font-bold text-sm">Select Workflow Template</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {TEMPLATE_ORDER.map((slug) => {
                const t = AUTOMATION_TEMPLATES[slug]
                return (
                  <button
                    key={slug}
                    onClick={() => handleStartTemplate(slug)}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500/40 text-left transition-all hover:bg-slate-900/80 group flex flex-col gap-1.5 outline-none cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-sm group-hover:text-indigo-400 transition-colors">{t.name}</span>
                      <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-slate-400 text-xs">{t.description}</p>
                    <div className="text-[10px] text-slate-500 mt-2">
                      Trigger: <span className="text-indigo-400 capitalize">{t.trigger_type.replace('_', ' ')}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Scratch canvas button */}
          <Card className="bg-slate-900 border-slate-800/80 p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 mb-3 mx-auto">
              <Zap className="h-5 w-5" />
            </div>
            <h4 className="text-slate-200 font-bold text-sm">Start from Scratch</h4>
            <p className="text-slate-500 text-xs mt-1 max-w-[280px] mx-auto leading-relaxed">
              Skip templates and open an empty flow canvas builder to add triggers and actions manually.
            </p>
            <Button onClick={handleStartBlank} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold mt-4">
              Open Empty Canvas Builder
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}

interface SeedRow {
  index: number
  step_type: AutomationStepType
  step_config: Record<string, unknown>
  branch: "yes" | "no" | null
  parent_index: number | null
}

/**
 * Expand flat templates to tree
 */
function expandFromSeeds(rows: SeedRow[]): BuilderStep[] {
  const nodes: BuilderStep[] = rows.map((r) => ({
    cid: uid(),
    step_type: r.step_type,
    step_config: r.step_config,
    branches:
      r.step_type === "condition" ? { yes: [], no: [] } : undefined,
  }))
  const roots: BuilderStep[] = []
  rows.forEach((r, i) => {
    if (r.parent_index == null) {
      roots.push(nodes[i])
      return
    }
    const parent = nodes[r.parent_index]
    if (!parent.branches) parent.branches = { yes: [], no: [] }
    parent.branches[r.branch ?? "yes"].push(nodes[i])
  })
  return roots
}

function uid(): string {
  return "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Appends client UUIDs recursively
 */
function ensureCids(steps: any[]): BuilderStep[] {
  if (!steps) return []
  return steps.map((s) => {
    const cid = s.cid || uid()
    const result: any = {
      cid,
      step_type: s.step_type,
      step_config: s.step_config || {}
    }
    if (s.step_type === "condition" || s.branches) {
      result.branches = {
        yes: ensureCids(s.branches?.yes || s.steps_yes || []),
        no: ensureCids(s.branches?.no || s.steps_no || [])
      }
    }
    return result
  })
}

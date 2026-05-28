"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Settings2, ShieldCheck, FileSpreadsheet, Layers, History, BarChart2, Cpu } from 'lucide-react'
import { AIAnalyticsDashboard } from '@/components/ai-agent/analytics-dashboard'
import { AIAgentConfig } from '@/components/ai-agent/agent-config'
import { AIIntentsManager } from '@/components/ai-agent/intents-manager'
import { AITrainingManager } from '@/components/ai-agent/training-manager'
import { AIMemoryInspector } from '@/components/ai-agent/memory-inspector'
import { AILogsViewer } from '@/components/ai-agent/logs-viewer'
import { AIKnowledgeBase } from '@/components/ai-agent/knowledge-base'
import { AIFollowupsManager } from '@/components/ai-agent/followups-manager'
import { AIProvidersManager } from '@/components/ai-agent/providers-manager'
import { Clock } from 'lucide-react'

type TabType = 'overview' | 'config' | 'providers' | 'knowledge' | 'intents' | 'followups' | 'training' | 'memory' | 'logs'

export default function AIAgentPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const TABS = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart2 },
    { id: 'config' as const, label: 'Agent Config', icon: Settings2 },
    { id: 'providers' as const, label: 'Providers & Routing', icon: Cpu },
    { id: 'knowledge' as const, label: 'Knowledge Base (RAG)', icon: FileSpreadsheet },
    { id: 'intents' as const, label: 'Intents & Actions', icon: ShieldCheck },
    { id: 'followups' as const, label: 'Smart Follow-ups', icon: Clock },
    { id: 'training' as const, label: 'Training Data', icon: Layers },
    { id: 'memory' as const, label: 'Memory Inspector', icon: Brain },
    { id: 'logs' as const, label: 'Audit Logs', icon: History }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AIAnalyticsDashboard />
      case 'config':
        return <AIAgentConfig />
      case 'providers':
        return <AIProvidersManager />
      case 'knowledge':
        return <AIKnowledgeBase />
      case 'intents':
        return <AIIntentsManager />
      case 'followups':
        return <AIFollowupsManager />
      case 'training':
        return <AITrainingManager />
      case 'memory':
        return <AIMemoryInspector />
      case 'logs':
        return <AILogsViewer />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Brain className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-xl font-bold text-white">AI Agent Connector</h1>
            <span className="text-[9px] font-extrabold tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase">Beta Co-pilot</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Configure natural language understanding, CRM updates, custom workflows, and automated responses.</p>
        </div>
      </div>

      {/* Tab Navigation Menu */}
      <div className="border-b border-slate-800/80 flex overflow-x-auto scrollbar-none gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors outline-none cursor-pointer ${
                isActive ? 'text-purple-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content Display Container */}
      <div className="bg-slate-900/20 rounded-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Settings, MessageSquare, Tag, User, Palette, Calendar, CreditCard, Users, Building } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { TagManager } from '@/components/settings/tag-manager';
import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { IntegrationsPanel } from '@/components/settings/integrations-panel';
import { WorkspaceSettings } from '@/components/settings/workspace-settings';

const TAB_VALUES = [
  'profile',
  'workspace',
  'whatsapp',
  'templates',
  'tags',
  'appearance',
  'integrations',
] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null): v is TabValue {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The URL is the single source of truth for the active tab — no
  // local state, no sync effect. A previous revision duplicated this
  // into `useState` + a sync effect, which tripped React 19's
  // set-state-in-effect rule and was also redundant.
  const queryTab = searchParams.get('tab');
  const tab: TabValue = isTabValue(queryTab) ? queryTab : 'profile';

  const onChange = (next: string) => {
    if (next === 'team' || next === 'billing') {
      router.push(`/settings/${next}`);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your workspace, profile, WhatsApp® integration, billing, and team permissions.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onChange}>
        <TabsList className="bg-slate-900 border border-slate-700 flex flex-wrap h-auto p-1 gap-1">
          <TabsTrigger
            value="profile"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <User className="size-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="workspace"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Building className="size-4" />
            Workspace
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Users className="size-4" />
            Team
          </TabsTrigger>
          <TabsTrigger
            value="billing"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <CreditCard className="size-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger
            value="whatsapp"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Settings className="size-4" />
            WhatsApp Config
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <MessageSquare className="size-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger
            value="tags"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Tag className="size-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Palette className="size-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Calendar className="size-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

         <TabsContent value="profile" className="space-y-6">
          <ProfileForm />
          <PasswordForm />
          <SessionsCard />
        </TabsContent>

        <TabsContent value="workspace">
          <WorkspaceSettings />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppConfig />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateManager />
        </TabsContent>

        <TabsContent value="tags">
          <TagManager />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearancePanel />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

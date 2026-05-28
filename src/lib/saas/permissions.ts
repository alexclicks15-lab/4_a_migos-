export type UserRole = 'owner' | 'admin' | 'manager' | 'sales_agent' | 'support_agent' | 'viewer';

export interface PermissionMatrix {
  canManageBilling: boolean;
  canInviteUsers: boolean;
  canManageTeam: boolean;
  canCreateWorkflows: boolean;
  canEditCRM: boolean;
  canViewAnalytics: boolean;
  canConfigureWhatsApp: boolean;
  canViewAudits: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, PermissionMatrix> = {
  owner: {
    canManageBilling: true,
    canInviteUsers: true,
    canManageTeam: true,
    canCreateWorkflows: true,
    canEditCRM: true,
    canViewAnalytics: true,
    canConfigureWhatsApp: true,
    canViewAudits: true,
  },
  admin: {
    canManageBilling: true,
    canInviteUsers: true,
    canManageTeam: true,
    canCreateWorkflows: true,
    canEditCRM: true,
    canViewAnalytics: true,
    canConfigureWhatsApp: true,
    canViewAudits: true,
  },
  manager: {
    canManageBilling: false,
    canInviteUsers: true,
    canManageTeam: true,
    canCreateWorkflows: true,
    canEditCRM: true,
    canViewAnalytics: true,
    canConfigureWhatsApp: false,
    canViewAudits: false,
  },
  sales_agent: {
    canManageBilling: false,
    canInviteUsers: false,
    canManageTeam: false,
    canCreateWorkflows: false,
    canEditCRM: true,
    canViewAnalytics: true,
    canConfigureWhatsApp: false,
    canViewAudits: false,
  },
  support_agent: {
    canManageBilling: false,
    canInviteUsers: false,
    canManageTeam: false,
    canCreateWorkflows: false,
    canEditCRM: false, // support only responds, doesn't edit CRM structure/details
    canViewAnalytics: true,
    canConfigureWhatsApp: false,
    canViewAudits: false,
  },
  viewer: {
    canManageBilling: false,
    canInviteUsers: false,
    canManageTeam: false,
    canCreateWorkflows: false,
    canEditCRM: false,
    canViewAnalytics: true,
    canConfigureWhatsApp: false,
    canViewAudits: false,
  },
};

/**
 * Checks if a user role has a specific permission.
 * If the user is a super admin (checked separately via profiles), they bypass all permission checks.
 */
export function hasPermission(
  role: UserRole | 'super_admin' | null | undefined,
  permission: keyof PermissionMatrix
): boolean {
  if (role === 'super_admin') return true;
  if (!role || !ROLE_PERMISSIONS[role as UserRole]) return false;
  return ROLE_PERMISSIONS[role as UserRole][permission];
}

/**
 * Returns role readable name.
 */
export function getRoleName(role: string | null | undefined): string {
  if (!role) return 'None';
  if (role === 'super_admin') return 'Super Admin';
  return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

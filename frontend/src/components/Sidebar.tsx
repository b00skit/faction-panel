import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Users, Settings, Layers, Database, History, RefreshCw, Camera, BarChart3, FileText, Sparkles, Bell, GitFork, Columns3 } from 'lucide-react';
import { FactionPage } from '../types';
import { DynamicIcon } from './DynamicIcon';

interface SidebarProps {
  shortname: string;
  canViewAdmin: boolean;
  canViewGroups: boolean;
  canViewRecords: boolean;
  canViewAuditLogs: boolean;
  canViewSnapshots?: boolean;
  canViewGtawSync?: boolean;
  canViewStatistics?: boolean;
  canViewForms?: boolean;
  canViewSandboxRoster?: boolean;
  canViewFactionHierarchy?: boolean;
  canViewNotifications?: boolean;
  canViewKanban?: boolean;
  canViewPages?: boolean;
  factionPages?: FactionPage[];
  user: any | null;
  siteVersion?: string;
  customFooterText?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  shortname, 
  canViewAdmin, 
  canViewGroups, 
  canViewRecords, 
  canViewAuditLogs,
  canViewSnapshots = false,
  canViewGtawSync = false,
  canViewStatistics = false,
  canViewForms = false,
  canViewSandboxRoster = false,
  canViewFactionHierarchy = false,
  canViewNotifications = false,
  canViewKanban = false,
  canViewPages = false,
  factionPages = [],
  user, 
  siteVersion = '1.0.0', 
  customFooterText 
}) => {
  const customSidebarPages = (factionPages || []).filter((page) => page.show_in_sidebar);

  return (
    <aside className="sidebar border-r border-border bg-card flex flex-col sticky top-[var(--nav-h)] h-[calc(100vh-var(--nav-h))]">
      <div className="py-2 space-y-0.5 overflow-y-auto">
        <NavLink 
          to={`/${shortname}/roster`}
          className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
        >
          <Users size={14} />
          Personnel Roster
        </NavLink>

        {canViewKanban && (
          <NavLink 
            to={`/${shortname}/kanban`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Columns3 size={14} />
            Faction Kanban
          </NavLink>
        )}

        {canViewSandboxRoster && (
          <NavLink 
            to={`/${shortname}/sandbox-roster`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Sparkles size={14} />
            Sandbox Roster
          </NavLink>
        )}

        {canViewFactionHierarchy && (
          <NavLink 
            to={`/${shortname}/diagrams`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <GitFork size={14} />
            Faction Diagrams
          </NavLink>
        )}

        {canViewForms && (
          <NavLink 
            to={`/${shortname}/forms`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <FileText size={14} />
            Faction Forms
          </NavLink>
        )}

        {canViewRecords && (
          <NavLink 
            to={`/${shortname}/records`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Database size={14} />
            Faction Records
          </NavLink>
        )}

        {canViewStatistics && (
          <NavLink 
            to={`/${shortname}/statistics`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <BarChart3 size={14} />
            Faction Statistics
          </NavLink>
        )}

        {canViewGroups && (
          <NavLink 
            to={`/${shortname}/groups`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Layers size={14} />
            Group Management
          </NavLink>
        )}

        {canViewNotifications && (
          <NavLink 
            to={`/${shortname}/notifications`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Bell size={14} />
            Faction Notifications
          </NavLink>
        )}

        {canViewAuditLogs && (
          <NavLink 
            to={`/${shortname}/audit-logs`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <History size={14} />
            Audit Logs
          </NavLink>
        )}

        {canViewSnapshots && (
          <NavLink 
            to={`/${shortname}/snapshots`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Camera size={14} />
            Faction Snapshots
          </NavLink>
        )}

        {canViewGtawSync && (
          <NavLink 
            to={`/${shortname}/gtaw-sync`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <RefreshCw size={14} />
            GTA:W Sync
          </NavLink>
        )}

        {canViewPages && (
          <NavLink 
            to={`/${shortname}/pages/manage`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <FileText size={14} />
            Faction Pages
          </NavLink>
        )}

        {canViewAdmin && (
          <NavLink 
            to={`/${shortname}/admin`}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Settings size={14} />
            Administration
          </NavLink>
        )}

        {/* Custom Faction Pages separated by horizontal line if any exist */}
        {customSidebarPages.length > 0 && (
          <>
            <div className="my-2 border-t border-border" />
            {customSidebarPages.map((page) => (
              <NavLink 
                key={page.id}
                to={`/${shortname}/pages/${page.slug}`}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              >
                <DynamicIcon name={page.icon} size={14} />
                {page.name}
              </NavLink>
            ))}
          </>
        )}
      </div>

      <div className="mt-auto p-4 border-t border-border">
        <div className="text-[9px] text-muted font-bold tracking-widest uppercase opacity-40">
          {customFooterText || <Link to="/changelog" className="hover:text-accent transition-colors">{`Antelope v${siteVersion}`}</Link>}
        </div>
      </div>
    </aside>
  );
};

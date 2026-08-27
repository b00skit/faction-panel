import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Handlebars from 'handlebars';
import DOMPurify from 'dompurify';
import api from '../api';
import { FactionPage, Role, Group } from '../types';
import Loading from './Loading';
import { DynamicIcon, AVAILABLE_ICONS } from './DynamicIcon';
import { setupHandlebarsAndDOMPurify, renderCustomPage, executeExtractedScripts } from '../utils/handlebarsHelpers';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Shield,
  Check,
  X,
  Code,
  Sparkles,
  HelpCircle,
  Users,
  Layers,
  Database,
} from 'lucide-react';
import toast from 'react-hot-toast';

setupHandlebarsAndDOMPurify();

interface FactionPagesProps {
  shortname: string;
  user: any;
  permissions: string[];
  fetchFactionData?: () => void;
}

export const FactionPages: React.FC<FactionPagesProps> = ({ shortname, user, permissions, fetchFactionData }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [pages, setPages] = useState<FactionPage[]>([]);
  const [contextData, setContextData] = useState<any>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [availableDatabases, setAvailableDatabases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingPage, setEditingPage] = useState<FactionPage | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [showCheatsheet, setShowCheatsheet] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    icon: string;
    show_in_sidebar: boolean;
    is_published: boolean;
    sort_order: number;
    content: string;
    allowed_databases: (number | string)[] | null;
  }>({
    name: '',
    slug: '',
    icon: 'FileText',
    show_in_sidebar: true,
    is_published: true,
    sort_order: 0,
    content: '',
    allowed_databases: null,
  });

  // Icon search state
  const [iconSearch, setIconSearch] = useState('');

  // Live preview HTML state
  const [previewHtml, setPreviewHtml] = useState('');

  // Permissions Modal State
  const [showPermsModal, setShowPermsModal] = useState(false);
  const [selectedPageForPerms, setSelectedPageForPerms] = useState<FactionPage | null>(null);
  const [pagePerms, setPagePerms] = useState<any[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  const canCreate = user?.is_superadmin || permissions.includes('create_faction_pages') || permissions.includes('modify_faction_pages');
  const canModify = user?.is_superadmin || permissions.includes('modify_faction_pages');

  const fetchPages = async () => {
    try {
      const [pagesRes, contextRes, rolesRes, groupsRes, recordsRes] = await Promise.all([
        api.get(`/factions/${shortname}/pages`),
        api.get(`/factions/${shortname}/pages/context-data`),
        api.get(`/factions/${shortname}/roles`),
        api.get(`/factions/${shortname}/groups`),
        api.get(`/factions/${shortname}/records`).catch(() => ({ data: [] })),
      ]);

      setPages(pagesRes.data);
      setContextData(contextRes.data);
      setRoles(rolesRes.data);
      setGroups(groupsRes.data);
      setAvailableDatabases(recordsRes.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load faction pages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shortname) {
      fetchPages();
    }
  }, [shortname]);

  // Check query string for edit parameter
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && pages.length > 0) {
      const target = pages.find((p) => String(p.id) === editId);
      if (target) {
        handleOpenModal(target);
      }
    }
  }, [searchParams, pages]);

  const [previewScripts, setPreviewScripts] = useState<string[]>([]);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Handle live preview rendering whenever content or active tab changes
  useEffect(() => {
    if (activeTab === 'preview') {
      const { html, scripts } = renderCustomPage(formData.content || '', contextData || {});
      setPreviewHtml(html);
      setPreviewScripts(scripts);
    }
  }, [activeTab, formData.content, contextData]);

  // Execute scripts in preview tab once rendered
  useEffect(() => {
    if (activeTab === 'preview' && previewHtml && previewScripts.length > 0) {
      executeExtractedScripts(previewScripts);
      const timer = setTimeout(() => {
        executeExtractedScripts(previewScripts);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, previewHtml, previewScripts]);

  const handleOpenModal = async (page?: FactionPage) => {
    if (page) {
      setEditingPage(page);
      setFormData({
        name: page.name,
        slug: page.slug,
        icon: page.icon || 'FileText',
        show_in_sidebar: page.show_in_sidebar,
        is_published: page.is_published,
        sort_order: page.sort_order || 0,
        content: page.content || '',
        allowed_databases: page.allowed_databases ?? null,
      });
      try {
        const ctxRes = await api.get(`/factions/${shortname}/pages/context-data?page=${page.slug}`);
        setContextData(ctxRes.data);
      } catch (e) {
        console.error('Failed to fetch context for page:', e);
      }
    } else {
      setEditingPage(null);
      setFormData({
        name: '',
        slug: '',
        icon: 'FileText',
        show_in_sidebar: true,
        is_published: true,
        sort_order: pages.length * 10,
        allowed_databases: null,
        content: `<!-- Custom Faction Page Template -->
<div class="p-6 bg-card border border-border rounded-lg space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-text">{{faction.name}} Dashboard</h1>
    <span class="text-xs text-muted font-mono">{{current_date}}</span>
  </div>
  <p class="text-sm text-muted">Welcome, {{user.username}}! Member of {{faction.name}}.</p>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
    <div class="p-3 bg-bg border border-border rounded text-center">
      <div class="text-xs text-muted">Members</div>
      <div class="text-lg font-bold text-accent">{{faction.members_count}}</div>
    </div>
    <div class="p-3 bg-bg border border-border rounded text-center">
      <div class="text-xs text-muted">Ranks/Roles</div>
      <div class="text-lg font-bold text-accent">{{faction.roles_count}}</div>
    </div>
    <div class="p-3 bg-bg border border-border rounded text-center">
      <div class="text-xs text-muted">Groups</div>
      <div class="text-lg font-bold text-accent">{{faction.groups_count}}</div>
    </div>
    <div class="p-3 bg-bg border border-border rounded text-center">
      <div class="text-xs text-muted">Record DBs</div>
      <div class="text-lg font-bold text-accent">{{faction.records_count}}</div>
    </div>
  </div>

  <h2 class="text-lg font-bold text-text mt-6">Record Databases</h2>
  {{#each record_databases}}
    <div class="p-3 bg-bg border border-border rounded mb-2">
      <div class="font-bold text-sm text-text">{{name}} ({{entries_count}} entries)</div>
      <div class="text-xs text-muted">{{description}}</div>
    </div>
  {{/each}}
</div>`,
      });
    }
    setActiveTab('editor');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPage(null);
    if (searchParams.get('edit')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('edit');
      setSearchParams(newParams);
    }
  };

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Page name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingPage) {
        await api.put(`/factions/${shortname}/pages/${editingPage.id}`, formData);
        toast.success('Faction page updated');
      } else {
        await api.post(`/factions/${shortname}/pages`, formData);
        toast.success('Faction page created');
      }
      handleCloseModal();
      fetchPages();
      if (fetchFactionData) fetchFactionData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (page: FactionPage) => {
    if (!window.confirm(`Are you sure you want to delete "${page.name}"?`)) return;

    try {
      await api.delete(`/factions/${shortname}/pages/${page.id}`);
      toast.success('Faction page deleted');
      fetchPages();
      if (fetchFactionData) fetchFactionData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete page');
    }
  };

  const handleOpenPermsModal = async (page: FactionPage) => {
    setSelectedPageForPerms(page);
    setShowPermsModal(true);
    try {
      const res = await api.get(`/factions/${shortname}/pages/${page.id}/permissions`);
      setPagePerms(res.data);
    } catch (err: any) {
      toast.error('Failed to load page permissions');
    }
  };

  const handleToggleRolePerm = (roleId: number) => {
    setPagePerms((prev) => {
      const existingIdx = prev.findIndex((p) => p.role_id === roleId);
      if (existingIdx >= 0) {
        return prev.filter((_, idx) => idx !== existingIdx);
      } else {
        return [...prev, { role_id: roleId, group_id: null, permissions: ['view_page'] }];
      }
    });
  };

  const handleToggleGroupPerm = (groupId: number) => {
    setPagePerms((prev) => {
      const existingIdx = prev.findIndex((p) => p.group_id === groupId);
      if (existingIdx >= 0) {
        return prev.filter((_, idx) => idx !== existingIdx);
      } else {
        return [...prev, { role_id: null, group_id: groupId, permissions: ['view_page'] }];
      }
    });
  };

  const handleSavePerms = async () => {
    if (!selectedPageForPerms) return;
    setSavingPerms(true);
    try {
      await api.put(`/factions/${shortname}/pages/${selectedPageForPerms.id}/permissions`, {
        permissions: pagePerms,
      });
      toast.success('Page permissions updated');
      setShowPermsModal(false);
      fetchPages();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update permissions');
    } finally {
      setSavingPerms(false);
    }
  };

  const insertSnippet = (snippet: string) => {
    setFormData((prev) => ({
      ...prev,
      content: prev.content + '\n' + snippet,
    }));
    toast.success('Snippet appended');
  };

  if (loading) {
    return <Loading fullScreen={false} message="Loading Faction Pages..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <FileText className="text-accent" size={20} /> Faction Pages Management
          </h1>
          <p className="text-xs text-muted">Create custom HTML & Handlebars pages with dynamic record data and permissions.</p>
        </div>

        {canCreate && (
          <button
            onClick={() => handleOpenModal()}
            className="px-3.5 py-2 bg-accent text-white font-bold uppercase tracking-wider text-xs rounded hover:bg-accent/90 transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> Create Faction Page
          </button>
        )}
      </div>

      {/* Pages List */}
      {pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-lg text-center">
          <FileText size={40} className="text-muted/50 mb-3" />
          <h3 className="text-base font-bold text-text mb-1">No Faction Pages Created</h3>
          <p className="text-xs text-muted max-w-sm mb-4">
            Build custom organizational pages, SOPs, dispatches, and equipment logs with Handlebars templates.
          </p>
          {canCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="px-3.5 py-1.5 bg-accent text-white font-bold uppercase tracking-wider text-xs rounded hover:bg-accent/90 transition-colors inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Create First Page
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page) => (
            <div
              key={page.id}
              className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between hover:border-accent/50 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-accent/10 border border-accent/20 rounded text-accent">
                      <DynamicIcon name={page.icon} size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-text text-sm flex items-center gap-1.5">
                        {page.name}
                      </h3>
                      <span className="text-[11px] text-muted font-mono">/{page.slug}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {page.show_in_sidebar && (
                      <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-bold uppercase tracking-wider rounded">
                        Sidebar
                      </span>
                    )}
                    {page.is_published ? (
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase tracking-wider rounded">
                        Published
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold uppercase tracking-wider rounded">
                        Draft
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between mt-4 text-xs">
                <button
                  onClick={() => navigate(`/${shortname}/pages/${page.slug}`)}
                  className="text-accent hover:underline font-bold flex items-center gap-1"
                >
                  <Eye size={13} /> View Page
                </button>

                <div className="flex items-center gap-1">
                  {canModify && (
                    <button
                      onClick={() => handleOpenPermsModal(page)}
                      className="p-1.5 text-muted hover:text-accent rounded hover:bg-bg transition-colors"
                      title="Page View Permissions"
                    >
                      <Shield size={14} />
                    </button>
                  )}
                  {canModify && (
                    <button
                      onClick={() => handleOpenModal(page)}
                      className="p-1.5 text-muted hover:text-text rounded hover:bg-bg transition-colors"
                      title="Edit Page"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {canModify && (
                    <button
                      onClick={() => handleDeletePage(page)}
                      className="p-1.5 text-muted hover:text-red-400 rounded hover:bg-bg transition-colors"
                      title="Delete Page"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Page Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000] overflow-y-auto">
          <div className="bg-card border border-border rounded-xl w-full max-w-5xl my-8 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-bg">
              <div className="flex items-center gap-2">
                <FileText className="text-accent" size={18} />
                <h2 className="font-bold text-text text-base">
                  {editingPage ? `Edit Faction Page: ${editingPage.name}` : 'Create New Faction Page'}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {/* Editor / Preview Tabs */}
                <div className="flex bg-card p-0.5 rounded border border-border text-xs font-bold uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => setActiveTab('editor')}
                    className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                      activeTab === 'editor' ? 'bg-accent text-white' : 'text-muted hover:text-text'
                    }`}
                  >
                    <Code size={13} /> Code Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                      activeTab === 'preview' ? 'bg-accent text-white' : 'text-muted hover:text-text'
                    }`}
                  >
                    <Eye size={13} /> Live Preview
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1 text-muted hover:text-text rounded transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePage} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto border-b border-border bg-card">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1">
                      Page Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          name,
                          slug: editingPage ? prev.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                        }));
                      }}
                      placeholder="e.g. Standard Operating Procedures"
                      className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1">
                      URL Slug
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="e.g. sop"
                      className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text font-mono focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1">
                      Choose Icon
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-bg border border-border rounded text-accent">
                        <DynamicIcon name={formData.icon} size={18} />
                      </div>
                      <select
                        value={formData.icon}
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                        className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                      >
                        {AVAILABLE_ICONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {icon}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text">
                    <input
                      type="checkbox"
                      checked={formData.show_in_sidebar}
                      onChange={(e) => setFormData({ ...formData, show_in_sidebar: e.target.checked })}
                      className="rounded bg-bg border-border text-accent focus:ring-0"
                    />
                    Show in Faction Sidebar
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text">
                    <input
                      type="checkbox"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                      className="rounded bg-bg border-border text-accent focus:ring-0"
                    />
                    Published / Visible to Members
                  </label>
                </div>

                {/* Database Access Configuration */}
                <div className="bg-bg border border-border rounded-lg p-3.5 space-y-3 mt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                        <Database size={13} className="text-accent" /> Data Access & Record Databases
                      </h4>
                      <p className="text-[11px] text-muted">
                        Select which record databases are loaded and accessible by this page to prevent data leaks.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, allowed_databases: null }))}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                          formData.allowed_databases === null
                            ? 'bg-accent text-white'
                            : 'bg-card text-muted hover:text-text border border-border'
                        }`}
                      >
                        All Databases (Auto)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            allowed_databases:
                              prev.allowed_databases !== null
                                ? prev.allowed_databases
                                : availableDatabases.map((d: any) => d.id),
                          }))
                        }
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                          formData.allowed_databases !== null
                            ? 'bg-accent text-white'
                            : 'bg-card text-muted hover:text-text border border-border'
                        }`}
                      >
                        Specific Databases Only
                      </button>
                    </div>
                  </div>

                  {formData.allowed_databases !== null && (
                    <div className="pt-2 border-t border-border space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted font-bold">
                          {formData.allowed_databases.length} of {availableDatabases.length} databases selected
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                allowed_databases: availableDatabases.map((d: any) => d.id),
                              }))
                            }
                            className="text-accent hover:underline font-bold"
                          >
                            Select All
                          </button>
                          <span className="text-muted">&bull;</span>
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, allowed_databases: [] }))}
                            className="text-muted hover:text-text font-bold"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      {availableDatabases.length === 0 ? (
                        <p className="text-xs text-muted italic">No record databases found in this faction.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                          {availableDatabases.map((db: any) => {
                            const isChecked = formData.allowed_databases?.some(
                              (id) => String(id) === String(db.id) || String(id) === String(db.name)
                            );
                            return (
                              <label
                                key={db.id}
                                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors text-xs ${
                                  isChecked
                                    ? 'bg-accent/10 border-accent/40 text-text'
                                    : 'bg-card border-border text-muted hover:border-accent/20'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(isChecked)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setFormData((prev) => {
                                        const current = prev.allowed_databases || [];
                                        const next = checked
                                          ? [...current, db.id]
                                          : current.filter(
                                              (id) => String(id) !== String(db.id) && String(id) !== String(db.name)
                                            );
                                        return { ...prev, allowed_databases: next };
                                      });
                                    }}
                                    className="rounded bg-bg border-border text-accent focus:ring-0"
                                  />
                                  <span className="font-bold truncate" title={db.name}>
                                    {db.name}
                                  </span>
                                </div>
                                {db.record_shortcode && (
                                  <span className="text-[10px] font-mono text-muted bg-bg px-1.5 py-0.5 rounded border border-border ml-1 flex-shrink-0">
                                    {db.record_shortcode}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Main Workspace (Editor / Preview + Drawer) */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                <div className="flex-1 flex flex-col min-h-0 p-4 bg-bg overflow-auto">
                  {activeTab === 'editor' ? (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                          <Code size={13} className="text-accent" /> Custom HTML / Handlebars Content
                        </span>

                        <button
                          type="button"
                          onClick={() => setShowCheatsheet(!showCheatsheet)}
                          className="text-xs text-accent hover:underline font-bold flex items-center gap-1"
                        >
                          <HelpCircle size={13} /> {showCheatsheet ? 'Hide Variable Cheatsheet' : 'Show Variable Cheatsheet'}
                        </button>
                      </div>

                      <textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Write custom HTML & Handlebars markup here..."
                        className="w-full flex-1 bg-card border border-border rounded p-4 font-mono text-xs text-text focus:outline-none focus:border-accent resize-none min-h-[320px]"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                      <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-400" /> Live Rendered Preview (Sanitized via DOMPurify)
                      </div>
                      <div
                        ref={previewContainerRef}
                        className="faction-page-rendered prose max-w-none text-text p-6 bg-card border border-border rounded-lg min-h-[300px]"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>
                  )}
                </div>

                {/* Variable Cheatsheet Drawer */}
                {showCheatsheet && activeTab === 'editor' && (
                  <div className="w-80 border-l border-border bg-card p-4 overflow-y-auto text-xs space-y-4">
                    <h3 className="font-bold text-text uppercase tracking-wider text-xs border-b border-border pb-2 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-accent" /> Available Variables
                    </h3>

                    <div>
                      <div className="font-bold text-text mb-1">Faction Info</div>
                      <div className="space-y-1 font-mono text-[11px]">
                        <button type="button" onClick={() => insertSnippet('{{faction.name}}')} className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block">{"{{faction.name}}"}</button>
                        <button type="button" onClick={() => insertSnippet('{{faction.members_count}}')} className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block">{"{{faction.members_count}}"}</button>
                        <button type="button" onClick={() => insertSnippet('{{faction.roles_count}}')} className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block">{"{{faction.roles_count}}"}</button>
                        <button type="button" onClick={() => insertSnippet('{{faction.groups_count}}')} className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block">{"{{faction.groups_count}}"}</button>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-text mb-1">Current User Info</div>
                      <div className="space-y-1 font-mono text-[11px]">
                        <button type="button" onClick={() => insertSnippet('{{user.username}}')} className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block">{"{{user.username}}"}</button>
                        <button type="button" onClick={() => insertSnippet('{{user.display_name}}')} className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block">{"{{user.display_name}}"}</button>
                        <button type="button" onClick={() => insertSnippet('{{user.email}}')} className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block">{"{{user.email}}"}</button>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-text mb-1">Ranks / Roles</div>
                      <div className="space-y-1 font-mono text-[11px]">
                        <button type="button" onClick={() => insertSnippet(`{{#each roles}}
  <span style="color: {{color}}">{{name}} ({{members_count}} members)</span>
{{/each}}`)} className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block">Loop Roles</button>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-text mb-1">Groups</div>
                      <div className="space-y-1 font-mono text-[11px]">
                        <button type="button" onClick={() => insertSnippet(`{{#each groups}}
  <div>{{name}} - {{members_count}} members</div>
{{/each}}`)} className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block">Loop Groups</button>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-text mb-1">Record Databases & Helpers</div>
                      <div className="space-y-1 font-mono text-[11px]">
                        <button type="button" onClick={() => insertSnippet('{{json records}}')} className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block">{"{{json records}}"}</button>
                        {contextData?.record_databases?.map((db: any) => (
                          <button
                            key={db.id}
                            type="button"
                            onClick={() =>
                              insertSnippet(`{{#each (getRecordEntries "${db.name}")}}
  <div class="p-2 border border-border mb-1 text-xs">
    Entry ID: {{id}}
  </div>
{{/each}}`)
                            }
                            className="w-full text-left p-1.5 bg-bg hover:bg-accent/10 border border-border rounded text-accent transition-colors block truncate"
                            title={`Loop ${db.name}`}
                          >
                            Loop: {db.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-bg">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-card hover:bg-card-hover border border-border text-muted hover:text-text font-bold uppercase tracking-wider text-xs rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-accent text-white font-bold uppercase tracking-wider text-xs rounded hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={14} /> {saving ? 'Saving...' : editingPage ? 'Update Page' : 'Create Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Per-Page View Permissions Modal */}
      {showPermsModal && selectedPageForPerms && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-bg">
              <div className="flex items-center gap-2">
                <Shield className="text-accent" size={18} />
                <h3 className="font-bold text-text text-base">
                  View Permissions: {selectedPageForPerms.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPermsModal(false)}
                className="p-1 text-muted hover:text-text rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-muted">
                Configure which ranks/roles or groups can view this specific custom page. If no specific roles/groups are selected, anyone with the general <code>view_faction_pages</code> permission can view it.
              </p>

              {/* Roles Section */}
              <div>
                <h4 className="text-xs font-bold text-text uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users size={14} className="text-accent" /> Faction Ranks / Roles
                </h4>
                <div className="space-y-1.5">
                  {roles.map((role) => {
                    const isGranted = pagePerms.some((p) => p.role_id === role.id);
                    return (
                      <label
                        key={role.id}
                        className="flex items-center justify-between p-2 bg-bg border border-border rounded cursor-pointer hover:border-accent/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: role.color || 'var(--accent)' }}
                          />
                          <span className="text-xs font-bold text-text">{role.name}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isGranted}
                          onChange={() => handleToggleRolePerm(role.id)}
                          className="rounded bg-bg border-border text-accent focus:ring-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Groups Section */}
              {groups.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-text uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers size={14} className="text-accent" /> Faction Groups
                  </h4>
                  <div className="space-y-1.5">
                    {groups.map((group) => {
                      const isGranted = pagePerms.some((p) => p.group_id === group.id);
                      return (
                        <label
                          key={group.id}
                          className="flex items-center justify-between p-2 bg-bg border border-border rounded cursor-pointer hover:border-accent/40 transition-colors"
                        >
                          <span className="text-xs font-bold text-text">{group.name}</span>
                          <input
                            type="checkbox"
                            checked={isGranted}
                            onChange={() => handleToggleGroupPerm(group.id)}
                            className="rounded bg-bg border-border text-accent focus:ring-0"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-bg">
              <button
                type="button"
                onClick={() => setShowPermsModal(false)}
                className="px-4 py-2 bg-card hover:bg-card-hover border border-border text-muted hover:text-text font-bold uppercase tracking-wider text-xs rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePerms}
                disabled={savingPerms}
                className="px-4 py-2 bg-accent text-white font-bold uppercase tracking-wider text-xs rounded hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check size={14} /> {savingPerms ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

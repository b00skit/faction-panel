import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import api from '../api';
import echo from '../echo';
import Loading from './Loading';
import { BottomTabBar, TabItem } from './BottomTabBar';
import { 
  Plus, MoreVertical, Trash2, Edit2, Settings, Shield, Check, X, 
  MessageSquare, User, Tag, ChevronDown, ListTodo, FileText, 
  CheckSquare, Bookmark, ShieldAlert, Users, Trash, Award,
  Circle, Square, Triangle, Hexagon, Star, Heart, Flame, Target,
  ArrowUp, ArrowDown, ArrowRight
} from 'lucide-react';
import { KanbanProject, KanbanCard, KanbanCardType, KanbanLabel, KanbanStatus, KanbanPriority } from '../types';

interface FactionKanbanProps {
  user: any;
  permissions: string[];
}

export const FactionKanban: React.FC<FactionKanbanProps> = ({ user, permissions }) => {
  const { shortname } = useParams<{ shortname: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<KanbanProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [cardTypes, setCardTypes] = useState<KanbanCardType[]>([]);

  // Modals
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showCardTypesModal, setShowCardTypesModal] = useState(false);
  const [showPrioritiesModal, setShowPrioritiesModal] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [activePriorityDetailsDropdownOpen, setActivePriorityDetailsDropdownOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [selectedCardDetails, setSelectedCardDetails] = useState<KanbanCard | null>(null);
  const [assigneesList, setAssigneesList] = useState<any[]>([]);

  // Priority State
  const [priorities, setPriorities] = useState<KanbanPriority[]>([]);
  const [newPriority, setNewPriority] = useState({ name: '', color: '#3b82f6', icon: 'ArrowUp', order: 0, is_default: false });

  // Form States
  const [newProject, setNewProject] = useState({ name: '', color: '#3b82f6', description: '' });
  const [projectSettings, setProjectSettings] = useState({ id: 0, name: '', color: '', description: '' });
  
  // Card Types Form States
  const [newCardType, setNewCardType] = useState({
    name: '',
    color: '#3b82f6',
    icon: 'CheckSquare',
    settings: {
      description: true,
      subtasks: true,
      color: true,
      icon: true,
      comments: true,
      assignee: true,
      priority: true,
    }
  });

  // Project permissions form state
  const [projectPermissions, setProjectPermissions] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [showAddPermission, setShowAddPermission] = useState(false);

  // Labels Form State
  const [newLabel, setNewLabel] = useState({ name: '', color: '#10b981' });

  // Column Quick Create State
  const [newColumnName, setNewColumnName] = useState('');
  const [showNewColumnInput, setShowNewColumnInput] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState<number | null>(null);
  const [editingColumnName, setEditingColumnName] = useState('');

  // Card Quick Create State
  const [activeQuickCreateColId, setActiveQuickCreateColId] = useState<number | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardTypeId, setNewCardTypeId] = useState<number>(0);

  // Card Details Edit States
  const [cardDescription, setCardDescription] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');

  // Dropdown Open States
  const [showGlobalSettingsDropdown, setShowGlobalSettingsDropdown] = useState(false);
  const [globalMenuPosition, setGlobalMenuPosition] = useState<{ left: number }>({ left: 0 });
  const [activeCardTypeDropdownColId, setActiveCardTypeDropdownColId] = useState<number | null>(null);
  const [activeCardTypeDetailsDropdownOpen, setActiveCardTypeDetailsDropdownOpen] = useState(false);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const isGlobalMod = user?.is_superadmin || permissions.includes('global_kanban_moderation');
  const projectPerms = activeProject?.user_permissions || {
    view_project: false,
    add_card: false,
    modify_card: false,
    view_card_details: false,
    manage_statuses: false,
    manage_labels: false,
    modify_project: false,
  };

  const fetchProjects = async (selectId: number | null = null) => {
    try {
      const res = await api.get(`/factions/${shortname}/kanban/projects`);
      setProjects(res.data);
      if (res.data.length > 0) {
        if (selectId && res.data.find((p: any) => p.id === selectId)) {
          setActiveProjectId(selectId);
        } else if (!activeProjectId || !res.data.find((p: any) => p.id === activeProjectId)) {
          setActiveProjectId(res.data[0].id);
        }
      } else {
        setActiveProjectId(null);
      }
    } catch (err) {
      toast.error('Failed to fetch Kanban projects');
    }
  };

  const fetchCardTypes = async () => {
    try {
      const res = await api.get('/kanban/card-types');
      setCardTypes(res.data);
      if (res.data.length > 0 && newCardTypeId === 0) {
        setNewCardTypeId(res.data[0].id);
      }
    } catch (err) {
      toast.error('Failed to fetch card types');
    }
  };

  const fetchPriorities = async () => {
    try {
      const res = await api.get('/kanban/priorities');
      setPriorities(res.data);
    } catch (err) {
      toast.error('Failed to fetch priorities');
    }
  };

  // Close custom dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowGlobalSettingsDropdown(false);
      setActiveCardTypeDropdownColId(null);
      setActiveCardTypeDetailsDropdownOpen(false);
      setActivePriorityDetailsDropdownOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (shortname) {
      setLoading(true);
      Promise.all([fetchProjects(), fetchCardTypes(), fetchPriorities()]).finally(() => setLoading(false));
    }
  }, [shortname]);

  // WebSocket Live Updates
  useEffect(() => {
    if (!activeProject?.faction_id) return;
    const channelName = `private-faction.${activeProject.faction_id}.kanban`;
    
    const handler = (e: any) => {
      fetchProjects(activeProjectId);
      setSelectedCard(current => {
        if (current && e.card_id === current.id) {
          fetchCardDetails(current.id);
        }
        return current;
      });
    };

    echo.private(`faction.${activeProject.faction_id}.kanban`)
      .listen('.kanban.updated', handler);

    return () => {
      echo.leave(`faction.${activeProject.faction_id}.kanban`);
    };
  }, [activeProjectId, activeProject?.faction_id]);

  // Project Permission Helpers
  const fetchPermissionData = async (project: KanbanProject) => {
    try {
      const [permRes, groupRes, roleRes] = await Promise.all([
        api.get(`/kanban/projects/${project.id}/permissions`),
        api.get(`/factions/${shortname}/groups`),
        api.get(`/factions/${shortname}/roles`)
      ]);
      setProjectPermissions(permRes.data);
      setGroups(groupRes.data);
      setRoles(roleRes.data);
    } catch (err) {
      toast.error('Failed to load project permissions');
    }
  };

  const fetchAssignees = async (project: KanbanProject) => {
    try {
      const res = await api.get(`/kanban/projects/${project.id}/assignees`);
      setAssigneesList(res.data);
    } catch (err) {
      toast.error('Failed to fetch assignees');
    }
  };

  const fetchCardDetails = async (cardId: number) => {
    try {
      const res = await api.get(`/kanban/cards/${cardId}`);
      setSelectedCard(current => {
        if (current && current.id === cardId) {
          setSelectedCardDetails(res.data);
          setCardDescription(res.data.description || '');
        }
        return current;
      });
    } catch (err) {
      toast.error('Failed to fetch card details');
      setSelectedCard(null);
    }
  };

  useEffect(() => {
    if (selectedCard) {
      fetchCardDetails(selectedCard.id);
    } else {
      setSelectedCardDetails(null);
    }
  }, [selectedCard]);

  // Project CRUD
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadToast = toast.loading('Creating project...');
    try {
      const res = await api.post(`/factions/${shortname}/kanban/projects`, newProject);
      toast.success('Project created successfully', { id: loadToast });
      setShowCreateProjectModal(false);
      setNewProject({ name: '', color: '#3b82f6', description: '' });
      fetchProjects(res.data.id);
    } catch (err) {
      toast.error('Failed to create project', { id: loadToast });
    }
  };

  const handleUpdateProjectSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadToast = toast.loading('Updating project...');
    try {
      await api.put(`/kanban/projects/${projectSettings.id}`, {
        name: projectSettings.name,
        color: projectSettings.color,
        description: projectSettings.description,
      });
      toast.success('Project updated successfully', { id: loadToast });
      setShowProjectSettingsModal(false);
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to update project', { id: loadToast });
    }
  };

  const handleDeleteProject = async (project: KanbanProject) => {
    if (!window.confirm(`Are you sure you want to delete project "${project.name}"?`)) return;
    const loadToast = toast.loading('Deleting project...');
    try {
      await api.delete(`/kanban/projects/${project.id}`);
      toast.success('Project deleted successfully', { id: loadToast });
      fetchProjects();
    } catch (err) {
      toast.error('Failed to delete project', { id: loadToast });
    }
  };

  const handleReorderProjects = async (reorderedItems: TabItem[]) => {
    const originalProjects = [...projects];
    setProjects(reorderedItems as KanbanProject[]);
    try {
      await api.put(`/factions/${shortname}/kanban/projects/reorder`, {
        project_order: reorderedItems.map(p => p.id)
      });
    } catch (err) {
      setProjects(originalProjects);
      toast.error('Failed to save project order');
    }
  };

  // Card Type CRUD
  const handleCreateCardType = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadToast = toast.loading('Creating card type...');
    try {
      await api.post('/kanban/card-types', newCardType);
      toast.success('Card type created successfully', { id: loadToast });
      setNewCardType({
        name: '',
        color: '#3b82f6',
        icon: 'CheckSquare',
        settings: { description: true, subtasks: true, color: true, icon: true, comments: true, assignee: true }
      });
      fetchCardTypes();
    } catch (err) {
      toast.error('Failed to create card type', { id: loadToast });
    }
  };

  const handleDeleteCardType = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this card type?')) return;
    const loadToast = toast.loading('Deleting...');
    try {
      await api.delete(`/kanban/card-types/${id}`);
      toast.success('Card type deleted', { id: loadToast });
      fetchCardTypes();
    } catch (err) {
      toast.error('Failed to delete card type', { id: loadToast });
    }
  };

  // Priority CRUD
  const handleCreatePriority = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadToast = toast.loading('Creating priority...');
    try {
      await api.post('/kanban/priorities', newPriority);
      toast.success('Priority created successfully', { id: loadToast });
      setNewPriority({ name: '', color: '#3b82f6', icon: 'ArrowUp', order: 0, is_default: false });
      fetchPriorities();
    } catch (err) {
      toast.error('Failed to create priority', { id: loadToast });
    }
  };

  const handleDeletePriority = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this priority?')) return;
    const loadToast = toast.loading('Deleting...');
    try {
      await api.delete(`/kanban/priorities/${id}`);
      toast.success('Priority deleted', { id: loadToast });
      fetchPriorities();
    } catch (err) {
      toast.error('Failed to delete priority', { id: loadToast });
    }
  };

  const handleToggleDefaultPriority = async (priority: KanbanPriority) => {
    const loadToast = toast.loading('Updating...');
    try {
      await api.put(`/kanban/priorities/${priority.id}`, {
        is_default: true
      });
      toast.success('Default priority updated', { id: loadToast });
      fetchPriorities();
    } catch (err) {
      toast.error('Failed to update default priority', { id: loadToast });
    }
  };

  // Column CRUD
  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim() || !activeProjectId) return;
    const loadToast = toast.loading('Adding column...');
    try {
      await api.post(`/kanban/projects/${activeProjectId}/statuses`, {
        name: newColumnName,
      });
      toast.success('Column added', { id: loadToast });
      setNewColumnName('');
      setShowNewColumnInput(false);
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to add column', { id: loadToast });
    }
  };

  const handleUpdateColumnName = async (statusId: number) => {
    if (!editingColumnName.trim()) return;
    const loadToast = toast.loading('Saving...');
    try {
      await api.put(`/kanban/statuses/${statusId}`, {
        name: editingColumnName,
      });
      toast.success('Column updated', { id: loadToast });
      setEditingColumnId(null);
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to rename column', { id: loadToast });
    }
  };

  const handleDeleteColumn = async (statusId: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete column "${name}"? All cards inside it will be permanently deleted.`)) return;
    const loadToast = toast.loading('Deleting column...');
    try {
      await api.delete(`/kanban/statuses/${statusId}`);
      toast.success('Column deleted', { id: loadToast });
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to delete column', { id: loadToast });
    }
  };

  // Labels CRUD
  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.name.trim() || !activeProjectId) return;
    const loadToast = toast.loading('Creating label...');
    try {
      await api.post(`/kanban/projects/${activeProjectId}/labels`, newLabel);
      toast.success('Label created', { id: loadToast });
      setNewLabel({ name: '', color: '#10b981' });
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to create label', { id: loadToast });
    }
  };

  const handleDeleteLabel = async (labelId: number) => {
    if (!window.confirm('Delete this label?')) return;
    const loadToast = toast.loading('Deleting label...');
    try {
      await api.delete(`/kanban/labels/${labelId}`);
      toast.success('Label deleted', { id: loadToast });
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to delete label', { id: loadToast });
    }
  };

  // Card CRUD & Movement
  const handleQuickCreateCard = async (statusId: number) => {
    if (!newCardTitle.trim() || !activeProjectId) return;
    const loadToast = toast.loading('Creating card...');
    try {
      await api.post(`/kanban/projects/${activeProjectId}/cards`, {
        title: newCardTitle,
        status_id: statusId,
        card_type_id: newCardTypeId,
      });
      toast.success('Card created', { id: loadToast });
      setNewCardTitle('');
      setActiveQuickCreateColId(null);
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to create card', { id: loadToast });
    }
  };

  const handleUpdateCardFields = async (fields: any) => {
    if (!selectedCardDetails) return;
    const cardId = selectedCardDetails.id;
    try {
      const res = await api.put(`/kanban/cards/${cardId}`, fields);
      setSelectedCard(current => {
        if (current && current.id === cardId) {
          setSelectedCardDetails(res.data);
        }
        return current;
      });
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to update card details');
    }
  };

  const handleDeleteCard = async () => {
    if (!selectedCardDetails) return;
    if (!window.confirm('Are you sure you want to delete this card?')) return;
    const loadToast = toast.loading('Deleting card...');
    try {
      await api.delete(`/kanban/cards/${selectedCardDetails.id}`);
      toast.success('Card deleted successfully', { id: loadToast });
      setSelectedCard(null);
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to delete card', { id: loadToast });
    }
  };

  const handleMoveCardColumn = async (targetStatusId: number) => {
    if (!selectedCardDetails) return;
    const targetStatus = activeProject?.statuses?.find((s: any) => s.id === targetStatusId);
    if (!targetStatus) return;

    // Build temporary order array
    const targetCards = targetStatus.cards || [];
    const targetOrder = [...targetCards.map((c: any) => c.id), selectedCardDetails.id];

    const loadToast = toast.loading('Moving card...');
    try {
      await api.post(`/kanban/cards/${selectedCardDetails.id}/move`, {
        status_id: targetStatusId,
        card_order: targetOrder,
      });
      toast.success('Card moved', { id: loadToast });
      fetchCardDetails(selectedCardDetails.id);
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to move card', { id: loadToast });
    }
  };

  // Subtasks
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !selectedCardDetails) return;
    try {
      await api.post(`/kanban/cards/${selectedCardDetails.id}/subtasks`, {
        title: newSubtaskTitle,
      });
      setNewSubtaskTitle('');
      fetchCardDetails(selectedCardDetails.id);
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to add subtask');
    }
  };

  const handleToggleSubtask = async (subtask: any) => {
    try {
      await api.put(`/kanban/subtasks/${subtask.id}`, {
        is_completed: !subtask.is_completed,
      });
      if (selectedCardDetails) {
        fetchCardDetails(selectedCardDetails.id);
        fetchProjects(activeProjectId);
      }
    } catch (err) {
      toast.error('Failed to update subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    try {
      await api.delete(`/kanban/subtasks/${subtaskId}`);
      if (selectedCardDetails) {
        fetchCardDetails(selectedCardDetails.id);
        fetchProjects(activeProjectId);
      }
    } catch (err) {
      toast.error('Failed to delete subtask');
    }
  };

  // Comments
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedCardDetails) return;
    try {
      await api.post(`/kanban/cards/${selectedCardDetails.id}/comments`, {
        comment: newCommentText,
      });
      setNewCommentText('');
      fetchCardDetails(selectedCardDetails.id);
      fetchProjects(activeProjectId);
    } catch (err) {
      toast.error('Failed to add comment');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.delete(`/kanban/comments/${commentId}`);
      if (selectedCardDetails) {
        fetchCardDetails(selectedCardDetails.id);
        fetchProjects(activeProjectId);
      }
    } catch (err) {
      toast.error('Failed to delete comment');
    }
  };

  // Project Permissions
  const handleToggleProjectPermission = async (groupId: number | null, roleId: number | null, permKey: string) => {
    if (!activeProject) return;
    const entry = projectPermissions.find(p => p.group_id === groupId && p.role_id === roleId);
    let newPerms: string[] = [];

    if (entry) {
      newPerms = entry.permissions.includes(permKey)
        ? entry.permissions.filter((p: string) => p !== permKey)
        : [...entry.permissions, permKey];
    } else {
      newPerms = [permKey];
    }

    const loadToast = toast.loading('Updating permission...');
    try {
      const res = await api.put(`/kanban/projects/${activeProject.id}/permissions`, {
        group_id: groupId,
        role_id: roleId,
        permissions: newPerms
      });
      setProjectPermissions(prev => {
        const index = prev.findIndex(p => p.group_id === groupId && p.role_id === roleId);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = res.data;
          return updated;
        }
        return [...prev, res.data];
      });
      toast.success('Permission updated', { id: loadToast });
    } catch (err) {
      toast.error('Failed to update permission', { id: loadToast });
    }
  };

  const handleRemovePermissionEntry = async (id: number) => {
    if (!activeProject) return;
    const loadToast = toast.loading('Removing permission...');
    try {
      await api.delete(`/kanban/projects/${activeProject.id}/permissions/${id}`);
      setProjectPermissions(prev => prev.filter(p => p.id !== id));
      toast.success('Permission entry removed', { id: loadToast });
    } catch (err) {
      toast.error('Failed to remove permission', { id: loadToast });
    }
  };

  const handleAddPermissionTarget = async (groupId: number | null, roleId: number | null) => {
    if (projectPermissions.some(p => p.group_id === groupId && p.role_id === roleId)) {
      toast.error('This target already has an entry');
      return;
    }
    const loadToast = toast.loading('Adding target...');
    try {
      const res = await api.put(`/kanban/projects/${activeProject!.id}/permissions`, {
        group_id: groupId,
        role_id: roleId,
        permissions: ['view_project']
      });
      setProjectPermissions(prev => [...prev, res.data]);
      toast.success('Target added', { id: loadToast });
      setShowAddPermission(false);
    } catch (err) {
      toast.error('Failed to add target', { id: loadToast });
    }
  };

  // Lucide helper maps for card type icons
  const getCardTypeIcon = (iconName: string, size = 14, className = "") => {
    switch (iconName) {
      case 'Circle': return <Circle size={size} className={className} />;
      case 'Square': return <Square size={size} className={className} />;
      case 'Triangle': return <Triangle size={size} className={className} />;
      case 'Hexagon': return <Hexagon size={size} className={className} />;
      case 'Star': return <Star size={size} className={className} />;
      case 'Heart': return <Heart size={size} className={className} />;
      case 'Flame': return <Flame size={size} className={className} />;
      case 'Target': return <Target size={size} className={className} />;
      case 'CheckSquare': return <CheckSquare size={size} className={className} />;
      case 'Bookmark': return <Bookmark size={size} className={className} />;
      case 'ShieldAlert': return <ShieldAlert size={size} className={className} />;
      case 'ArrowUp': return <ArrowUp size={size} className={className} />;
      case 'ArrowDown': return <ArrowDown size={size} className={className} />;
      case 'ArrowRight': return <ArrowRight size={size} className={className} />;
      default: return <ListTodo size={size} className={className} />;
    }
  };

  if (loading) return <Loading message="Loading Kanban Boards..." />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg text-text h-full relative">
      
      {/* Top Controls Bar */}
      {activeProject && (
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-card/40 backdrop-blur-md sticky top-0 z-40">
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
              {activeProject.name}
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-accent/15 text-accent border border-accent/20">
                Faction Kanban Board
              </span>
            </h1>
            <p className="text-[10px] text-muted font-bold tracking-wider uppercase">
              {activeProject.description || 'No description defined.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Board View */}
      {activeProject && (
        <main className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex items-start gap-4 scrollbar-thin select-none">
          <>
            {activeProject.statuses?.map((col: any) => (
              <div 
                key={col.id}
                className="flex flex-col bg-card/40 backdrop-blur-md rounded-xl border border-border/80 w-72 shrink-0 max-h-full flex shadow-sm relative group/col"
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-border flex items-center justify-between shrink-0">
                  {editingColumnId === col.id ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <input
                        type="text"
                        value={editingColumnName}
                        onChange={(e) => setEditingColumnName(e.target.value)}
                        className="bg-bg text-text text-xs border border-accent rounded px-2 py-1 font-bold uppercase tracking-wide focus:outline-none w-full"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateColumnName(col.id);
                          if (e.key === 'Escape') setEditingColumnId(null);
                        }}
                      />
                      <button 
                        onClick={() => handleUpdateColumnName(col.id)} 
                        className="p-1 text-success hover:bg-success/10 rounded"
                      >
                        <Check size={13} />
                      </button>
                      <button 
                        onClick={() => setEditingColumnId(null)} 
                        className="p-1 text-danger hover:bg-danger/10 rounded"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 
                        onClick={() => {
                          if (projectPerms.manage_statuses) {
                            setEditingColumnId(col.id);
                            setEditingColumnName(col.name);
                          }
                        }}
                        className={`text-xs font-black uppercase tracking-widest text-text truncate max-w-[180px] ${projectPerms.manage_statuses ? 'cursor-pointer hover:text-accent' : ''}`}
                      >
                        {col.name}
                      </h3>
                      
                      {projectPerms.manage_statuses && (
                        <button 
                          onClick={() => handleDeleteColumn(col.id, col.name)}
                          className="text-muted hover:text-danger opacity-0 group-hover/col:opacity-100 transition-opacity cursor-pointer p-1 hover:bg-danger/5 rounded"
                          title="Delete Column"
                        >
                          <Trash size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Cards List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-270px)] scrollbar-thin">
                  {col.cards?.map((card: any) => {
                    const cardType = card.card_type || cardTypes.find((t: any) => t.id === card.card_type_id);
                    const completedSubtasks = card.subtasks?.filter((s: any) => s.is_completed).length || 0;
                    const totalSubtasks = card.subtasks?.length || 0;

                    return (
                      <div
                        key={card.id}
                        onClick={() => {
                          if (projectPerms.view_card_details) {
                            setSelectedCard(card);
                            fetchAssignees(activeProject);
                          } else {
                            toast.error('You do not have access to view card details');
                          }
                        }}
                        className="bg-card/75 border-l-4 rounded-lg p-3 shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5 flex flex-col gap-2 items-start"
                        style={{ borderLeftColor: cardType?.color || '#cbd5e1' }}
                      >
                        {/* Card Icon & Labels Row */}
                        <div className="flex items-center gap-1.5 flex-wrap w-full">
                          {/* Card Type Icon Perfect Square: w-4 h-4 with size 8 */}
                          {cardType && (
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center text-white shrink-0 shadow-sm"
                              style={{ backgroundColor: cardType.color }}
                            >
                              {getCardTypeIcon(cardType.icon, 8)}
                            </div>
                          )}

                          {/* Card Priority Badge */}
                          {cardType?.settings.priority && card.priority && (
                            <span
                              className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded-md flex items-center gap-0.5 shrink-0"
                              style={{ backgroundColor: `${card.priority.color}15`, color: card.priority.color, border: `1px solid ${card.priority.color}25` }}
                            >
                              {getCardTypeIcon(card.priority.icon, 8)}
                              {card.priority.name}
                            </span>
                          )}

                          {/* Card Labels */}
                          {card.labels?.map((label: any) => (
                            <span
                              key={label.id}
                              className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${label.color}15`, color: label.color, border: `1px solid ${label.color}25` }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>

                        {/* Title - directly below the icon */}
                        <h4 className="text-xs font-bold text-text-light leading-snug w-full">
                          {card.title}
                        </h4>

                        {/* Card Footer Indicators */}
                        <div className="flex items-center justify-between mt-1 text-[9px] text-muted font-bold tracking-wider w-full">
                          <div className="flex items-center gap-2">
                            {card.description && (
                              <div className="flex items-center gap-0.5" title="Has description">
                                <FileText size={10} />
                              </div>
                            )}
                            {totalSubtasks > 0 && (
                              <div className="flex items-center gap-0.5 text-accent" title="Subtasks">
                                <ListTodo size={10} />
                                <span>{completedSubtasks}/{totalSubtasks}</span>
                              </div>
                            )}
                            {card.comments?.length > 0 && (
                              <div className="flex items-center gap-0.5" title="Comments">
                                <MessageSquare size={10} />
                                <span>{card.comments.length}</span>
                              </div>
                            )}
                          </div>

                          {/* Assignees Avatars */}
                          <div className="flex -space-x-1 overflow-hidden">
                            {card.assignees?.slice(0, 3).map((user: any) => (
                              <div
                                key={user.id}
                                className="w-4 h-4 rounded-full border border-card bg-surface flex items-center justify-center text-[7px] font-black text-text-light select-none overflow-hidden shrink-0"
                                title={user.username}
                              >
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                                ) : (
                                  user.username.slice(0, 2).toUpperCase()
                                )}
                              </div>
                            ))}
                            {card.assignees?.length > 3 && (
                              <div className="w-4 h-4 rounded-full border border-card bg-surface flex items-center justify-center text-[7px] font-black text-muted shrink-0">
                                +{card.assignees.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Column Add Card */}
                {projectPerms.add_card && (
                  <div className="p-2 shrink-0">
                    {activeQuickCreateColId === col.id ? (
                      <div className="bg-bg/60 p-2 rounded-lg border border-border flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Card Title..."
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          className="bg-card text-text text-xs border border-border rounded px-2.5 py-1.5 focus:outline-none w-full font-bold"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5 w-full">
                          
                          {/* Custom Card Type Selector */}
                          <div className="relative flex-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCardTypeDropdownColId(activeCardTypeDropdownColId === col.id ? null : col.id);
                              }}
                              className="bg-card text-text text-[10px] font-bold border border-border rounded px-2 py-1.5 focus:outline-none w-full uppercase tracking-wider flex items-center justify-between gap-1"
                            >
                              {(() => {
                                const selectedType = cardTypes.find(t => t.id === newCardTypeId);
                                if (selectedType) {
                                  return (
                                    <span className="flex items-center gap-1 min-w-0">
                                      <span 
                                        className="w-3.5 h-3.5 rounded flex items-center justify-center text-white font-bold shrink-0 animate-pulse-subtle"
                                        style={{ backgroundColor: selectedType.color }}
                                      >
                                        {getCardTypeIcon(selectedType.icon, 8)}
                                      </span>
                                      <span className="truncate max-w-[80px]">{selectedType.name}</span>
                                    </span>
                                  );
                                }
                                return 'Type';
                              })()}
                              <ChevronDown size={10} className="text-muted shrink-0" />
                            </button>

                            {activeCardTypeDropdownColId === col.id && (
                              <div className="absolute left-0 right-0 bottom-full mb-1 bg-card border border-border rounded-lg shadow-2xl z-[999] p-1 max-h-40 overflow-y-auto">
                                {cardTypes.map((type) => (
                                  <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => {
                                      setNewCardTypeId(type.id);
                                      setActiveCardTypeDropdownColId(null);
                                    }}
                                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted hover:text-text hover:bg-surface rounded transition-colors text-left"
                                  >
                                    <span 
                                      className="w-3.5 h-3.5 rounded flex items-center justify-center text-white font-bold shrink-0"
                                      style={{ backgroundColor: type.color }}
                                    >
                                      {getCardTypeIcon(type.icon, 8)}
                                    </span>
                                    <span className="truncate">{type.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleQuickCreateCard(col.id)}
                            className="px-2.5 py-1.5 bg-accent hover:bg-accent/90 text-white rounded text-[10px] font-bold uppercase tracking-wider shrink-0"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setActiveQuickCreateColId(null)}
                            className="p-1.5 text-muted hover:text-text hover:bg-surface rounded shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveQuickCreateColId(col.id);
                          if (cardTypes.length > 0 && newCardTypeId === 0) {
                            setNewCardTypeId(cardTypes[0].id);
                          }
                        }}
                        className="w-full py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-accent hover:bg-accent/5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        <Plus size={12} /> Add Card
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add Status/Column Column */}
            {projectPerms.manage_statuses && (
              <div className="w-72 shrink-0 bg-card/20 rounded-xl border border-dashed border-border/80 p-3.5 flex flex-col gap-2">
                {showNewColumnInput ? (
                  <form onSubmit={handleCreateColumn} className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Column Name..."
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      className="bg-card border border-border rounded px-3 py-2 text-xs font-bold focus:outline-none w-full text-text uppercase tracking-wider"
                      autoFocus
                    />
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg"
                      >
                        Add Column
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewColumnInput(false)}
                        className="px-3 py-1.5 bg-surface text-text text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-surface-hover"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowNewColumnInput(true)}
                    className="w-full py-2.5 border border-dashed border-border/85 rounded-lg text-muted hover:text-accent hover:border-accent hover:bg-accent/5 transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> Add Column
                  </button>
                )}
              </div>
            )}
          </>
        </main>
      )}

      {/* Bottom Tabs Bar */}
      <BottomTabBar
        items={projects}
        activeId={activeProjectId}
        onSelect={(id) => {
          setActiveProjectId(id);
          setActiveQuickCreateColId(null);
          setEditingColumnId(null);
        }}
        onReorder={handleReorderProjects}
        canReorder={isGlobalMod}
        canCreate={isGlobalMod || permissions.includes('create_project')}
        onCreateClick={() => setShowCreateProjectModal(true)}
        createTooltip="Create Project"
        extraButtons={
          isGlobalMod ? (
            <div className="relative flex items-center shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showGlobalSettingsDropdown) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setGlobalMenuPosition({ left: rect.left + rect.width / 2 });
                  }
                  setShowGlobalSettingsDropdown(!showGlobalSettingsDropdown);
                }}
                className={`p-2 transition-colors ${showGlobalSettingsDropdown ? 'text-accent' : 'text-muted hover:text-accent'}`}
                title="Global Settings"
              >
                <Settings size={16} />
              </button>
              {showGlobalSettingsDropdown && (
                <div
                  className="fixed bottom-[var(--tab-h)] mb-2 bg-card border border-border rounded-lg shadow-2xl p-1 z-[999] min-w-[150px]"
                  style={{
                    left: globalMenuPosition.left,
                    transform: 'translateX(-50%)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setShowGlobalSettingsDropdown(false);
                      setShowCardTypesModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors text-left"
                  >
                    <Settings size={12} /> Card Types
                  </button>
                  <button
                    onClick={() => {
                      setShowGlobalSettingsDropdown(false);
                      setShowPrioritiesModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors text-left"
                  >
                    <Flame size={12} /> Priorities
                  </button>
                </div>
              )}
            </div>
          ) : null
        }
        renderContextMenu={activeProject ? (item, closeMenu) => {
          const isProjectOwner = item.created_by === user?.id;
          const perms = item.user_permissions || { modify_project: false, manage_labels: false };
          const canSettings = isGlobalMod || isProjectOwner || perms.modify_project;
          const canLabels = isGlobalMod || isProjectOwner || perms.manage_labels;
          const canPermissions = isGlobalMod || isProjectOwner;

          if (!canSettings && !canLabels && !canPermissions) return null;

          return (
            <div className="flex flex-col gap-0.5">
              {canSettings && (
                <button
                  onClick={() => {
                    closeMenu();
                    setProjectSettings({ id: item.id, name: item.name, color: item.color || '#3b82f6', description: item.description || '' });
                    setShowProjectSettingsModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors text-left"
                >
                  <Settings size={12} /> Project Settings
                </button>
              )}
              {canLabels && (
                <button
                  onClick={() => {
                    closeMenu();
                    setShowLabelsModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors text-left"
                >
                  <Tag size={12} /> Project Labels
                </button>
              )}
              {canPermissions && (
                <button
                  onClick={() => {
                    closeMenu();
                    fetchPermissionData(item as KanbanProject);
                    setShowPermissionsModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors text-left"
                >
                  <Shield size={12} /> Permissions
                </button>
              )}
              {canPermissions && (
                <button
                  onClick={() => {
                    closeMenu();
                    handleDeleteProject(item as KanbanProject);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-danger/70 hover:text-danger hover:bg-danger/5 rounded transition-colors text-left"
                >
                  <Trash2 size={12} /> Remove Project
                </button>
              )}
            </div>
          );
        } : undefined}
      />

      {/* CREATE PROJECT MODAL */}
      <AnimatePresence>
        {showCreateProjectModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleCreateProject}
              className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Plus size={14} /> Create Kanban Project
                </h3>
                <button type="button" onClick={() => setShowCreateProjectModal(false)} className="text-muted hover:text-text">
                  <X size={14} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-accent text-text"
                    placeholder="e.g. Investigations Board"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                    Project Theme Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newProject.color}
                      onChange={(e) => setNewProject({ ...newProject, color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={newProject.color}
                      onChange={(e) => setNewProject({ ...newProject, color: e.target.value })}
                      className="w-full bg-surface border border-border rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-accent text-text uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                    Description
                  </label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-accent text-text min-h-[60px]"
                    placeholder="Describe the purpose of this project..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-border bg-surface/30">
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateProjectModal(false)}
                  className="px-4 py-2 bg-surface hover:bg-surface-hover text-text border border-border rounded-lg text-[10px] font-bold uppercase tracking-widest"
                >
                  Cancel
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* PROJECT SETTINGS / LABELS MODAL */}
      <AnimatePresence>
        {showProjectSettingsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
            >
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Settings size={14} /> Project Settings: {projectSettings.name}
                </h3>
                <button type="button" onClick={() => setShowProjectSettingsModal(false)} className="text-muted hover:text-text">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* General Settings */}
                <form onSubmit={handleUpdateProjectSettings} className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted border-b border-border/40 pb-1">
                    General Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                        Project Name
                      </label>
                      <input
                        type="text"
                        required
                        value={projectSettings.name}
                        onChange={(e) => setProjectSettings({ ...projectSettings, name: e.target.value })}
                        className="w-full bg-surface border border-border rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-accent text-text"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                        Theme Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={projectSettings.color}
                          onChange={(e) => setProjectSettings({ ...projectSettings, color: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={projectSettings.color}
                          onChange={(e) => setProjectSettings({ ...projectSettings, color: e.target.value })}
                          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-accent text-text uppercase"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                      Description
                    </label>
                    <textarea
                      value={projectSettings.description}
                      onChange={(e) => setProjectSettings({ ...projectSettings, description: e.target.value })}
                      className="w-full bg-surface border border-border rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-accent text-text min-h-[60px]"
                      placeholder="Describe the purpose of this project..."
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white rounded text-[10px] font-bold uppercase tracking-wider"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROJECT LABELS MODAL */}
      <AnimatePresence>
        {showLabelsModal && activeProject && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
            >
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Tag size={14} className="text-accent" /> Project Labels: {activeProject.name}
                </h3>
                <button type="button" onClick={() => setShowLabelsModal(false)} className="text-muted hover:text-text">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                  Manage tags and labels that can be attached to cards on this board.
                </p>

                {/* Add Label Form */}
                <form onSubmit={handleCreateLabel} className="flex gap-2 items-end bg-surface/40 p-4 rounded-xl border border-border/60">
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                      Label Text
                    </label>
                    <input
                      type="text"
                      required
                      value={newLabel.name}
                      onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                      className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none text-text"
                      placeholder="e.g. HIGH PRIORITY"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                      Color
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={newLabel.color}
                        onChange={(e) => setNewLabel({ ...newLabel, color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-success hover:bg-success/90 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                  >
                    <Plus size={12} /> Add
                  </button>
                </form>

                {/* Labels List */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted border-b border-border/40 pb-1">
                    Configured Labels
                  </h4>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {activeProject?.labels?.map((label) => (
                      <div
                        key={label.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border"
                        style={{ backgroundColor: `${label.color}10`, color: label.color, borderColor: `${label.color}25` }}
                      >
                        <span>{label.name}</span>
                        <button
                          onClick={() => handleDeleteLabel(label.id)}
                          className="text-[10px] hover:text-danger transition-colors cursor-pointer ml-1 p-0.5 rounded hover:bg-danger/10"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    {activeProject?.labels?.length === 0 && (
                      <p className="text-[10px] text-muted font-bold tracking-wider uppercase py-2">
                        No labels defined yet for this project.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROJECT PERMISSIONS MODAL */}
      <AnimatePresence>
        {showPermissionsModal && activeProject && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Shield size={14} /> Permissions: {activeProject.name}
                </h3>
                <button type="button" onClick={() => setShowPermissionsModal(false)} className="text-muted hover:text-text">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                  Configure role/group overrides for accessing and managing this Kanban project.
                </p>

                {/* Add Target Selector */}
                {showAddPermission ? (
                  <div className="bg-surface/50 p-4 rounded-xl border border-border/80 flex flex-col gap-3">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-muted">
                      Add Permission Target
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                          Select Role
                        </label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) handleAddPermissionTarget(null, parseInt(e.target.value));
                          }}
                          className="w-full bg-card border border-border rounded px-3 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none"
                          defaultValue=""
                        >
                          <option value="">-- Choose Role --</option>
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                          Select Group
                        </label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) handleAddPermissionTarget(parseInt(e.target.value), null);
                          }}
                          className="w-full bg-card border border-border rounded px-3 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none"
                          defaultValue=""
                        >
                          <option value="">-- Choose Group --</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowAddPermission(false)}
                        className="px-3 py-1.5 bg-surface text-text hover:bg-surface-hover rounded text-[10px] font-bold uppercase tracking-wider"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddPermission(true)}
                    className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Role/Group Override
                  </button>
                )}

                {/* Permissions Grid */}
                <div className="space-y-3 pt-2">
                  {projectPermissions.map((entry) => {
                    const group = groups.find(g => g.id === entry.group_id);
                    const role = roles.find(r => r.id === entry.role_id);
                    const targetName = group ? `Group: ${group.name}` : (role ? `Role: ${role.name}` : 'Public Guest access');

                    return (
                      <div key={entry.id} className="border border-border/80 rounded-xl p-4 bg-card/20 space-y-3 relative group/override">
                        <div className="flex justify-between items-center pb-2 border-b border-border/40">
                          <span className="text-xs font-black uppercase tracking-wider text-text flex items-center gap-1.5">
                            {group ? <Users size={12} className="text-accent" /> : <Award size={12} className="text-success" />}
                            {targetName}
                          </span>
                          <button
                            onClick={() => handleRemovePermissionEntry(entry.id)}
                            className="text-muted hover:text-danger p-1 hover:bg-danger/5 rounded transition-colors"
                          >
                            <Trash size={12} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wider">
                          {[
                            { key: 'view_project', name: 'View Project' },
                            { key: 'add_card', name: 'Add Cards' },
                            { key: 'modify_card', name: 'Modify Cards' },
                            { key: 'view_card_details', name: 'View Card Details' },
                            { key: 'manage_statuses', name: 'Manage Statuses/Columns' },
                            { key: 'manage_labels', name: 'Manage Labels/Tags' },
                          ].map((perm) => {
                            const active = entry.permissions.includes(perm.key);
                            return (
                              <label
                                key={perm.key}
                                className={`flex items-center gap-2 p-2 rounded border cursor-pointer select-none transition-all ${
                                  active 
                                    ? 'bg-accent/5 border-accent text-accent' 
                                    : 'border-border/60 hover:bg-surface text-muted'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => handleToggleProjectPermission(entry.group_id, entry.role_id, perm.key)}
                                  className="hidden"
                                />
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${active ? 'border-accent bg-accent text-white' : 'border-border'}`}>
                                  {active && <Check size={10} />}
                                </div>
                                {perm.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {projectPermissions.length === 0 && (
                    <p className="text-center py-6 text-xs text-muted font-bold tracking-wider uppercase border border-dashed border-border rounded-xl">
                      No explicit permissions overrides configured.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CARD TYPES DEFINITIONS MODAL */}
      <AnimatePresence>
        {showCardTypesModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Settings size={14} /> Global Card Types
                </h3>
                <button type="button" onClick={() => setShowCardTypesModal(false)} className="text-muted hover:text-text">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Add Card Type Form */}
                <form onSubmit={handleCreateCardType} className="bg-surface/50 p-4 rounded-xl border border-border/80 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted">
                    Create New Card Type
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                        Type Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newCardType.name}
                        onChange={(e) => setNewCardType({ ...newCardType, name: e.target.value })}
                        className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                        placeholder="e.g. Hotfix"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                        Left Outline Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newCardType.color}
                          onChange={(e) => setNewCardType({ ...newCardType, color: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={newCardType.color}
                          onChange={(e) => setNewCardType({ ...newCardType, color: e.target.value })}
                          className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs font-bold uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-2">
                      Select Icon Shape
                    </label>
                    <div className="flex flex-wrap gap-2 bg-card p-3 rounded-lg border border-border/80">
                      {['Circle', 'Square', 'Triangle', 'Hexagon', 'Star', 'Heart', 'Flame', 'Target', 'CheckSquare', 'Bookmark', 'ShieldAlert'].map((iconName) => {
                        const isSelected = newCardType.icon === iconName;
                        return (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => setNewCardType({ ...newCardType, icon: iconName })}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                              isSelected
                                ? 'bg-accent text-white border-accent scale-105 shadow-md'
                                : 'bg-card border-border hover:bg-surface text-muted hover:text-text'
                            }`}
                            title={iconName}
                          >
                            {getCardTypeIcon(iconName, 14)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Field Toggle Matrix */}
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-2">
                      Enabled Features
                    </label>
                    <div className="grid grid-cols-3 gap-2 text-[9px] font-bold uppercase tracking-wider">
                      {[
                        { key: 'description', label: 'Description' },
                        { key: 'subtasks', label: 'Sub-tasks' },
                        { key: 'color', label: 'Custom Card Color' },
                        { key: 'icon', label: 'Card Type Icon' },
                        { key: 'comments', label: 'Comments section' },
                        { key: 'assignee', label: 'Assignees list' },
                        { key: 'priority', label: 'Priority setting' },
                      ].map((feat) => {
                        const val = (newCardType.settings as any)[feat.key];
                        return (
                          <label key={feat.key} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={val}
                              onChange={(e) => setNewCardType({
                                ...newCardType,
                                settings: { ...newCardType.settings, [feat.key]: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 rounded bg-card border-border accent-accent"
                            />
                            <span>{feat.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-success hover:bg-success/90 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Card Type
                    </button>
                  </div>
                </form>

                {/* Card Types List */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted border-b border-border/40 pb-1">
                    Existing Card Types
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {cardTypes.map((type) => (
                      <div key={type.id} className="border border-border/80 rounded-xl p-3.5 bg-card/25 flex items-start justify-between">
                        <div className="flex gap-2">
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm"
                            style={{ backgroundColor: type.color }}
                          >
                            {getCardTypeIcon(type.icon, 10)}
                          </div>
                          <div>
                            <h5 className="text-xs font-black uppercase tracking-wider text-text">
                              {type.name}
                            </h5>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[8px] text-muted font-bold tracking-wide uppercase">
                              {Object.entries(type.settings).map(([k, v]) => v && (
                                <span key={k} className="bg-surface px-1 py-0.5 rounded border border-border/60">
                                  {k}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCardType(type.id)}
                          className="text-muted hover:text-danger p-1 hover:bg-danger/5 rounded transition-colors"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRIORITIES DEFINITIONS MODAL */}
      <AnimatePresence>
        {showPrioritiesModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Flame size={14} className="text-accent animate-pulse" /> Priorities Definitions (Global)
                </h3>
                <button type="button" onClick={() => setShowPrioritiesModal(false)} className="text-muted hover:text-text">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* Add Priority Form */}
                <form onSubmit={handleCreatePriority} className="bg-surface/50 p-4 rounded-xl border border-border/80 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted">
                    Create New Priority
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                        Priority Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newPriority.name}
                        onChange={(e) => setNewPriority({ ...newPriority, name: e.target.value })}
                        className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                        placeholder="e.g. Critical"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                        Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newPriority.color}
                          onChange={(e) => setNewPriority({ ...newPriority, color: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={newPriority.color}
                          onChange={(e) => setNewPriority({ ...newPriority, color: e.target.value })}
                          className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs font-bold uppercase"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                        Sort Order
                      </label>
                      <input
                        type="number"
                        required
                        value={newPriority.order}
                        onChange={(e) => setNewPriority({ ...newPriority, order: parseInt(e.target.value) || 0 })}
                        className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
                        Select Icon
                      </label>
                      <div className="flex flex-wrap gap-1.5 bg-card p-2 rounded-lg border border-border/80">
                        {['ArrowUp', 'ArrowDown', 'ArrowRight', 'Flame', 'Circle', 'Square', 'Target'].map((iconName) => {
                          const isSelected = newPriority.icon === iconName;
                          return (
                            <button
                              key={iconName}
                              type="button"
                              onClick={() => setNewPriority({ ...newPriority, icon: iconName })}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'bg-accent text-white border-accent scale-105 shadow-md'
                                  : 'bg-card border-border hover:bg-surface text-muted hover:text-text'
                              }`}
                              title={iconName}
                            >
                              {getCardTypeIcon(iconName, 12)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer text-[9px] font-bold uppercase tracking-wider select-none pr-2">
                      <input
                        type="checkbox"
                        checked={newPriority.is_default}
                        onChange={(e) => setNewPriority({ ...newPriority, is_default: e.target.checked })}
                        className="w-3.5 h-3.5 rounded bg-card border-border accent-accent"
                      />
                      <span>Set as Default</span>
                    </label>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-success hover:bg-success/90 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Priority
                    </button>
                  </div>
                </form>

                {/* Priorities List */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted border-b border-border/40 pb-1">
                    Existing Priorities
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {priorities.map((priority) => (
                      <div key={priority.id} className="border border-border/80 rounded-xl p-3.5 bg-card/25 flex items-start justify-between">
                        <div className="flex gap-2.5">
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm"
                            style={{ backgroundColor: priority.color }}
                          >
                            {getCardTypeIcon(priority.icon, 10)}
                          </div>
                          <div>
                            <h5 className="text-xs font-black uppercase tracking-wider text-text flex items-center gap-1.5">
                              {priority.name}
                              {priority.is_default && (
                                <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent">
                                  Default
                                </span>
                              )}
                            </h5>
                            <div className="flex items-center gap-2 mt-1 text-[8px] text-muted font-bold tracking-wide uppercase">
                              <span>Order: {priority.order}</span>
                              {!priority.is_default && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleDefaultPriority(priority)}
                                  className="text-accent hover:underline lowercase font-bold"
                                >
                                  (set default)
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeletePriority(priority.id)}
                          className="text-muted hover:text-danger p-1 hover:bg-danger/5 rounded transition-colors"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CARD DETAILS MODAL */}
      <AnimatePresence>
        {selectedCardDetails && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-surface/10">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: selectedCardDetails.card_type?.color || 'var(--accent)' }}
                  >
                    {getCardTypeIcon(selectedCardDetails.card_type?.icon || 'ListTodo', 14)}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={selectedCardDetails.title}
                      onChange={(e) => handleUpdateCardFields({ title: e.target.value })}
                      className="bg-transparent border-b border-transparent hover:border-border focus:border-accent font-black uppercase text-xs text-text py-0.5 px-1 focus:outline-none tracking-widest max-w-[400px]"
                      disabled={!projectPerms.modify_card}
                    />
                    <p className="text-[9px] text-muted font-bold tracking-wider uppercase mt-0.5 px-1">
                      in column: <span className="text-text-light">{selectedCardDetails.status?.name}</span>
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => { setSelectedCard(null); setSelectedCardDetails(null); }} className="text-muted hover:text-text p-1.5 rounded-lg hover:bg-surface">
                  <X size={16} />
                </button>
              </div>

              {/* Body Layout */}
              <div className="flex-1 overflow-y-auto p-5 grid grid-cols-3 gap-6">
                
                {/* Left Columns (Details/Subtasks/Comments) - Span 2 */}
                <div className="col-span-2 space-y-6">
                  
                  {/* Description */}
                  {selectedCardDetails.card_type?.settings.description && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                        <FileText size={12} /> Description
                      </h4>
                      {projectPerms.modify_card ? (
                        <div className="space-y-2">
                          <textarea
                            value={cardDescription}
                            onChange={(e) => setCardDescription(e.target.value)}
                            placeholder="Add a detailed description..."
                            className="w-full bg-surface border border-border rounded-xl p-3 text-xs focus:outline-none focus:border-accent text-text h-24 font-medium"
                          />
                          {cardDescription !== (selectedCardDetails.description || '') && (
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => handleUpdateCardFields({ description: cardDescription })}
                                className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white rounded text-[10px] font-bold uppercase tracking-wider"
                              >
                                Save Description
                              </button>
                              <button
                                onClick={() => setCardDescription(selectedCardDetails.description || '')}
                                className="px-3 py-1.5 bg-surface text-text hover:bg-surface-hover border border-border rounded text-[10px] font-bold uppercase tracking-wider"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs bg-surface/30 p-3 rounded-xl border border-border font-medium text-text-light whitespace-pre-wrap">
                          {selectedCardDetails.description || 'No description provided.'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Subtasks */}
                  {selectedCardDetails.card_type?.settings.subtasks && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                        <ListTodo size={12} /> Checklist / Sub-Tasks
                      </h4>

                      {/* Progress Bar */}
                      {selectedCardDetails.subtasks && selectedCardDetails.subtasks.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9px] font-bold text-muted uppercase tracking-wider">
                            <span>Progress</span>
                            <span>
                              {Math.round(
                                (selectedCardDetails.subtasks.filter((s: any) => s.is_completed).length /
                                  selectedCardDetails.subtasks.length) * 100
                              )}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden border border-border/50">
                            <div
                              className="h-full bg-accent transition-all duration-300"
                              style={{
                                width: `${
                                  (selectedCardDetails.subtasks.filter((s: any) => s.is_completed).length /
                                    selectedCardDetails.subtasks.length) * 100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Subtasks List */}
                      <div className="space-y-1.5">
                        {selectedCardDetails.subtasks?.map((subtask) => (
                          <div
                            key={subtask.id}
                            className="flex items-center justify-between gap-3 p-2 rounded-lg bg-surface/40 hover:bg-surface/60 border border-border/40 group/sub"
                          >
                            <label className="flex items-center gap-2 cursor-pointer flex-1 select-none">
                              <input
                                type="checkbox"
                                checked={subtask.is_completed}
                                onChange={() => handleToggleSubtask(subtask)}
                                className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-0"
                                disabled={!projectPerms.modify_card}
                              />
                              <span className={`text-xs font-semibold ${subtask.is_completed ? 'line-through text-muted' : 'text-text-light'}`}>
                                {subtask.title}
                              </span>
                            </label>
                            {projectPerms.modify_card && (
                              <button
                                onClick={() => handleDeleteSubtask(subtask.id)}
                                className="text-muted hover:text-danger opacity-0 group-hover/sub:opacity-100 transition-opacity p-0.5 rounded hover:bg-danger/10 cursor-pointer"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add Subtask Inline */}
                      {projectPerms.modify_card && (
                        <form onSubmit={handleAddSubtask} className="flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Add item..."
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider"
                          >
                            Add
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Comments */}
                  {selectedCardDetails.card_type?.settings.comments && (
                    <div className="space-y-3 border-t border-border pt-4">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                        <MessageSquare size={12} /> Comments
                      </h4>

                      {/* Add Comment */}
                      <form onSubmit={handleAddComment} className="flex gap-2 items-start">
                        <textarea
                          required
                          placeholder="Write a comment..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          className="flex-1 bg-surface border border-border rounded-xl p-3 text-xs focus:outline-none focus:border-accent text-text h-16 font-medium"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0"
                        >
                          Post
                        </button>
                      </form>

                      {/* Comments Thread */}
                      <div className="space-y-3 pt-2">
                        {selectedCardDetails.comments?.map((comment) => {
                          const isCommentAuthor = comment.user_id === user?.id;
                          const canDeleteComment = isCommentAuthor || isGlobalMod || activeProject?.created_by === user?.id;

                          return (
                            <div key={comment.id} className="flex gap-3 bg-surface/20 border border-border/40 p-3 rounded-xl">
                              <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-[9px] font-black text-text uppercase overflow-hidden shrink-0">
                                {comment.user?.avatar_url ? (
                                  <img src={comment.user.avatar_url} alt={comment.user.username} className="w-full h-full object-cover" />
                                ) : (
                                  comment.user?.username.slice(0, 2)
                                )}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-baseline">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-text-light">
                                    {comment.user?.username || 'System'}
                                  </span>
                                  <span className="text-[8px] text-muted font-bold uppercase tracking-wider">
                                    {new Date(comment.created_at).toLocaleDateString()} at {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-text font-medium leading-relaxed whitespace-pre-wrap">
                                  {comment.comment}
                                </p>
                              </div>
                              {canDeleteComment && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-muted hover:text-danger p-1 hover:bg-danger/5 rounded self-start shrink-0"
                                >
                                  <X size={11} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {selectedCardDetails.comments?.length === 0 && (
                          <p className="text-center py-4 text-[10px] text-muted font-bold tracking-wider uppercase border border-dashed border-border/50 rounded-xl">
                            No comments yet. Write a message above.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                </div>

                {/* Right Column (Sidebar Configuration) - Span 1 */}
                <div className="space-y-5 border-l border-border pl-6">
                  
                  {/* Status / Column Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                      Move Status Column
                    </label>
                    <select
                      value={selectedCardDetails.status_id}
                      onChange={(e) => handleMoveCardColumn(parseInt(e.target.value))}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none"
                      disabled={!projectPerms.modify_card}
                    >
                      {activeProject?.statuses?.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Card Type Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                      Card Type
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (projectPerms.modify_card) {
                            setActiveCardTypeDetailsDropdownOpen(!activeCardTypeDetailsDropdownOpen);
                          }
                        }}
                        className="bg-surface text-text text-xs font-bold border border-border rounded-lg px-3 py-2 focus:outline-none w-full uppercase tracking-wider flex items-center justify-between gap-2 text-left"
                        disabled={!projectPerms.modify_card}
                      >
                        {(() => {
                          const currentType = selectedCardDetails.card_type || cardTypes.find(t => t.id === selectedCardDetails.card_type_id);
                          if (currentType) {
                            return (
                              <span className="flex items-center gap-2">
                                <span 
                                  className="w-4 h-4 rounded flex items-center justify-center text-white font-bold shrink-0 shadow-sm animate-pulse-subtle"
                                  style={{ backgroundColor: currentType.color }}
                                >
                                  {getCardTypeIcon(currentType.icon, 8)}
                                </span>
                                {currentType.name}
                              </span>
                            );
                          }
                          return 'Select Card Type';
                        })()}
                        <ChevronDown size={14} className="text-muted shrink-0" />
                      </button>

                      {activeCardTypeDetailsDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-2xl z-[999] p-1 max-h-40 overflow-y-auto">
                          {cardTypes.map((type) => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => {
                                handleUpdateCardFields({ card_type_id: type.id });
                                setActiveCardTypeDetailsDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:text-text hover:bg-surface rounded transition-colors text-left"
                            >
                              <span 
                                className="w-4 h-4 rounded flex items-center justify-center text-white font-bold shrink-0"
                                style={{ backgroundColor: type.color }}
                              >
                                {getCardTypeIcon(type.icon, 8)}
                              </span>
                              {type.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Priority Selector */}
                  {selectedCardDetails.card_type?.settings.priority && (
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                        Priority
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (projectPerms.modify_card) {
                              setActivePriorityDetailsDropdownOpen(!activePriorityDetailsDropdownOpen);
                            }
                          }}
                          className="bg-surface text-text text-xs font-bold border border-border rounded-lg px-3 py-2 focus:outline-none w-full uppercase tracking-wider flex items-center justify-between gap-2 text-left"
                          disabled={!projectPerms.modify_card}
                        >
                          {(() => {
                            const currentPriority = selectedCardDetails.priority || priorities.find(p => p.id === selectedCardDetails.priority_id);
                            if (currentPriority) {
                              return (
                                <span className="flex items-center gap-2">
                                  <span 
                                    className="w-4 h-4 rounded flex items-center justify-center text-white font-bold shrink-0 shadow-sm"
                                    style={{ backgroundColor: currentPriority.color }}
                                  >
                                    {getCardTypeIcon(currentPriority.icon, 8)}
                                  </span>
                                  {currentPriority.name}
                                </span>
                              );
                            }
                            return 'Select Priority';
                          })()}
                          <ChevronDown size={14} className="text-muted shrink-0" />
                        </button>

                        {activePriorityDetailsDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-2xl z-[999] p-1 max-h-40 overflow-y-auto">
                            {priorities.map((priority) => (
                              <button
                                key={priority.id}
                                type="button"
                                onClick={() => {
                                  handleUpdateCardFields({ priority_id: priority.id });
                                  setActivePriorityDetailsDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:text-text hover:bg-surface rounded transition-colors text-left"
                              >
                                <span 
                                  className="w-4 h-4 rounded flex items-center justify-center text-white font-bold shrink-0"
                                  style={{ backgroundColor: priority.color }}
                                >
                                  {getCardTypeIcon(priority.icon, 8)}
                                </span>
                                {priority.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Assignees Selection */}
                  {selectedCardDetails.card_type?.settings.assignee && (
                    <div className="space-y-2">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                        <Users size={11} /> Assignees
                      </label>
                      <div className="border border-border rounded-xl bg-surface/30 p-2.5 max-h-40 overflow-y-auto space-y-1.5 scrollbar-thin">
                        {assigneesList.map((userObj) => {
                          const isAssigned = selectedCardDetails.assignees?.some((a: any) => a.id === userObj.id);
                          return (
                            <label
                              key={userObj.id}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold cursor-pointer select-none transition-colors ${
                                isAssigned 
                                  ? 'bg-accent/5 border border-accent/25 text-accent' 
                                  : 'hover:bg-surface border border-transparent text-muted hover:text-text'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => {
                                  const currentIds = selectedCardDetails.assignees?.map((a: any) => a.id) || [];
                                  const nextIds = isAssigned 
                                    ? currentIds.filter((id: number) => id !== userObj.id)
                                    : [...currentIds, userObj.id];
                                  handleUpdateCardFields({ assignees: nextIds });
                                }}
                                className="hidden"
                                disabled={!projectPerms.modify_card}
                              />
                              <div className="w-4 h-4 rounded-full bg-surface border border-border flex items-center justify-center text-[7px] font-black text-text uppercase overflow-hidden shrink-0">
                                {userObj.avatar_url ? (
                                  <img src={userObj.avatar_url} alt={userObj.username} className="w-full h-full object-cover" />
                                ) : (
                                  userObj.username.slice(0, 2)
                                )}
                              </div>
                              <span className="truncate">{userObj.username}</span>
                            </label>
                          );
                        })}
                        {assigneesList.length === 0 && (
                          <p className="text-[9px] text-muted font-bold uppercase tracking-wider py-2">
                            No eligible assignees found.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Labels / Tags Checklist */}
                  <div className="space-y-2">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                      <Tag size={11} /> Labels / Tags
                    </label>
                    <div className="border border-border rounded-xl bg-surface/30 p-2.5 max-h-40 overflow-y-auto space-y-1.5 scrollbar-thin">
                      {activeProject?.labels?.map((label) => {
                        const isAttached = selectedCardDetails.labels?.some((l: any) => l.id === label.id);
                        return (
                          <label
                            key={label.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer select-none transition-colors border`}
                            style={{
                              backgroundColor: isAttached ? `${label.color}15` : 'transparent',
                              borderColor: isAttached ? `${label.color}35` : 'transparent',
                              color: isAttached ? label.color : 'var(--text-muted)'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isAttached}
                              onChange={() => {
                                const currentIds = selectedCardDetails.labels?.map((l: any) => l.id) || [];
                                const nextIds = isAttached 
                                  ? currentIds.filter((id: number) => id !== label.id)
                                  : [...currentIds, label.id];
                                handleUpdateCardFields({ labels: nextIds });
                              }}
                              className="hidden"
                              disabled={!projectPerms.modify_card}
                            />
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                            <span className="truncate">{label.name}</span>
                          </label>
                        );
                      })}
                      {activeProject?.labels?.length === 0 && (
                        <p className="text-[9px] text-muted font-bold uppercase tracking-wider py-2">
                          No labels created for project settings.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Custom Card Color */}
                  {selectedCardDetails.card_type?.settings.color && (
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                        Card Custom Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedCardDetails.color || '#cbd5e1'}
                          onChange={(e) => handleUpdateCardFields({ color: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                          disabled={!projectPerms.modify_card}
                        />
                        <button
                          onClick={() => handleUpdateCardFields({ color: null })}
                          className="px-2 py-1.5 bg-surface hover:bg-surface-hover border border-border text-[9px] font-bold uppercase tracking-wider rounded-lg text-muted hover:text-text"
                          disabled={!projectPerms.modify_card}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Delete Card */}
                  {projectPerms.modify_card && (
                    <div className="pt-4 border-t border-border">
                      <button
                        onClick={handleDeleteCard}
                        className="w-full py-2 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/25 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        <Trash2 size={13} /> Delete Card
                      </button>
                    </div>
                  )}

                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
    Plus, Trash2, Edit3, Settings, Users, Shield, Award, Crown, Check, X, 
    GitFork, Save, Eye, Edit, ListOrdered, Grid, Maximize2, Trash, Link2, Link2Off,
    MoreVertical, ChevronLeft, ChevronRight, GripVertical
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { HierarchyPermissionsModal } from './HierarchyPermissionsModal';
import { useConfirm } from './ConfirmationProvider';

interface FactionHierarchyProps {
    user: any;
    shortname: string;
    permissions: string[];
    isDark: boolean;
    rosters: any[];
}

export default function FactionHierarchy({ user, shortname, permissions, isDark, rosters }: FactionHierarchyProps) {
    const [hierarchies, setHierarchies] = useState<any[]>([]);
    const [activeTabId, setActiveTabId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [showTabSettingsModal, setShowTabSettingsModal] = useState(false);
    const [showCreateTabModal, setShowCreateTabModal] = useState(false);
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);
    const [showNodeEditModal, setShowNodeEditModal] = useState(false);
    
    // Bottom tab bar context menu and scroll states
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
    const [menuPosition, setMenuPosition] = useState({ left: 0 });
    const scrollRef = useRef<HTMLUListElement>(null);

    const handleScroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 200;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };
    
    // Edit tab/hierarchy states
    const [tabName, setTabName] = useState('');
    const [tabColor, setTabColor] = useState('#2563eb');
    const [tabRosterId, setTabRosterId] = useState<number | null>(null);
    
    // Edit node/card states
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [nodeTitle, setNodeTitle] = useState('');
    const [nodeColor, setNodeColor] = useState('');
    const [nodeSlots, setNodeSlots] = useState<any[]>([]);
    
    // Auto-link roster configuration states
    const [nodeRosterSyncEnabled, setNodeRosterSyncEnabled] = useState(false);
    const [nodeRosterSyncSectionId, setNodeRosterSyncSectionId] = useState<number | null>(null);
    const [nodeRosterSyncRowStart, setNodeRosterSyncRowStart] = useState<number | ''>('');
    const [nodeRosterSyncRowEnd, setNodeRosterSyncRowEnd] = useState<number | ''>('');
    const [nodeRosterSyncKeyCol, setNodeRosterSyncKeyCol] = useState('rank');
    const [nodeRosterSyncValueCol, setNodeRosterSyncValueCol] = useState('name');
    
    // Auto-link styling overrides
    const [nodeRosterSyncLabelColor, setNodeRosterSyncLabelColor] = useState('');
    const [nodeRosterSyncLabelBold, setNodeRosterSyncLabelBold] = useState(false);
    const [nodeRosterSyncValueColor, setNodeRosterSyncValueColor] = useState('');
    const [nodeRosterSyncValueBold, setNodeRosterSyncValueBold] = useState(false);
    
    const [editMode, setEditMode] = useState(false);
    const confirm = useConfirm();

    // Fetch all hierarchies
    const fetchHierarchies = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/factions/${shortname}/hierarchies`);
            setHierarchies(res.data);
            if (res.data.length > 0 && activeTabId === null) {
                setActiveTabId(res.data[0].id);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to load hierarchies');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHierarchies();
    }, [shortname]);

    const activeHierarchy = hierarchies.find(h => h.id === activeTabId) || null;
    const canCreateHierarchy = user?.is_superadmin || permissions.includes('create_hierarchy');
    const canManageTabs = user?.is_superadmin || permissions.includes('global_hierarchy_moderation');

    // Helper: get all members from a roster
    const getRosterMembers = (rosterId: number) => {
        const roster = rosters.find(r => r.id === rosterId);
        if (!roster) return [];
        
        const columns = roster.columns || [];
        const nameCol = columns.find((c: any) => c.id === 'name' || c.name.toLowerCase().includes('name'));
        const rankCol = columns.find((c: any) => c.id === 'rank' || c.name.toLowerCase().includes('rank') || c.name.toLowerCase().includes('role'));
        const nameKey = nameCol ? nameCol.id : 'name';
        const rankKey = rankCol ? rankCol.id : 'rank';

        const members: any[] = [];
        const extract = (section: any) => {
            if (section.contents) {
                section.contents.forEach((c: any) => {
                    const name = c.content?.[nameKey] || '-';
                    const rank = c.content?.[rankKey] || '-';
                    members.push({ id: c.id, name, rank, content: c.content });
                });
            }
            if (section.children) {
                section.children.forEach(extract);
            }
        };
        (roster.root_sections || roster.rootSections)?.forEach(extract);
        return members;
    };

    const rosterMembers = activeHierarchy?.roster_id ? getRosterMembers(activeHierarchy.roster_id) : [];
    const activeRoster = activeHierarchy?.roster_id ? rosters.find(r => r.id === activeHierarchy.roster_id) : null;

    const getRosterSectionsList = (roster: any) => {
        if (!roster) return [];
        const list: any[] = [];
        const processSection = (s: any, depth = 0) => {
            list.push({ id: s.id, name: '— '.repeat(depth) + s.name });
            if (s.children && Array.isArray(s.children)) {
                s.children.forEach(child => processSection(child, depth + 1));
            }
        };
        (roster.root_sections || roster.rootSections || []).forEach((s: any) => processSection(s, 0));
        return list;
    };

    const sectionsList = activeRoster ? getRosterSectionsList(activeRoster) : [];
    const columnsList = activeRoster ? (activeRoster.columns || []) : [];

    // Create a new tab
    const handleCreateTab = async (e: React.FormEvent) => {
        e.preventDefault();
        const loadToast = toast.loading('Creating hierarchy...');
        try {
            const res = await api.post(`/factions/${shortname}/hierarchies`, {
                name: tabName,
                color: tabColor,
                roster_id: tabRosterId,
            });
            toast.success('Hierarchy created', { id: loadToast });
            await fetchHierarchies();
            setActiveTabId(res.data.id);
            setShowCreateTabModal(false);
            setTabName('');
            setTabColor('#2563eb');
            setTabRosterId(null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create hierarchy', { id: loadToast });
        }
    };

    // Update active tab settings
    const handleUpdateTabSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeHierarchy) return;

        const loadToast = toast.loading('Updating settings...');
        try {
            const res = await api.put(`/hierarchies/${activeHierarchy.id}`, {
                name: tabName,
                color: tabColor,
                roster_id: tabRosterId,
            });
            toast.success('Hierarchy updated', { id: loadToast });
            await fetchHierarchies();
            setShowTabSettingsModal(false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update hierarchy', { id: loadToast });
        }
    };

    // Open tab settings modal
    const openTabSettings = () => {
        if (!activeHierarchy) return;
        setTabName(activeHierarchy.name);
        setTabColor(activeHierarchy.color);
        setTabRosterId(activeHierarchy.roster_id);
        setShowTabSettingsModal(true);
    };

    // Delete active hierarchy
    const handleDeleteHierarchy = async () => {
        if (!activeHierarchy) return;

        const isConfirmed = await confirm({
            title: 'Delete Hierarchy',
            message: `Are you sure you want to delete the hierarchy "${activeHierarchy.name}"? This action cannot be undone.`,
        });

        if (isConfirmed) {
            const loadToast = toast.loading('Deleting hierarchy...');
            try {
                await api.delete(`/hierarchies/${activeHierarchy.id}`);
                toast.success('Hierarchy deleted', { id: loadToast });
                const remaining = hierarchies.filter(h => h.id !== activeHierarchy.id);
                setHierarchies(remaining);
                setActiveTabId(remaining.length > 0 ? remaining[0].id : null);
                setShowTabSettingsModal(false);
            } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to delete hierarchy', { id: loadToast });
            }
        }
    };

    // Reorder tabs (drag and drop)
    const handleReorder = async (newOrder: any[]) => {
        setHierarchies(newOrder);
        try {
            await api.put(`/factions/${shortname}/hierarchies/reorder`, {
                hierarchy_order: newOrder.map(h => h.id),
            });
            toast.success('Tabs reordered');
        } catch (err) {
            toast.error('Failed to save reorder');
            console.error('Failed to reorder hierarchies', err);
        }
    };

    // Node updates
    const handleAddNode = async (parentId: number | null) => {
        if (!activeHierarchy) return;

        const loadToast = toast.loading('Adding division...');
        try {
            const res = await api.post(`/hierarchies/${activeTabId}/nodes`, {
                parent_id: parentId,
                title: 'New Division',
                color: activeHierarchy.color,
                slots: [
                    {
                        id: uniqid('slot_'),
                        roster_content_id: null,
                        label: 'Position',
                        value: 'VACANT',
                    }
                ]
            });
            toast.success('Division added', { id: loadToast });
            fetchHierarchies(); // Reload tree
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to add node', { id: loadToast });
        }
    };

    const handleDeleteNode = async (nodeId: number) => {
        const isConfirmed = await confirm({
            title: 'Delete Division',
            message: 'Are you sure you want to delete this division and all its child divisions? This cannot be undone.',
        });

        if (isConfirmed) {
            const loadToast = toast.loading('Deleting division...');
            try {
                await api.delete(`/hierarchy-nodes/${nodeId}`);
                toast.success('Division removed', { id: loadToast });
                fetchHierarchies(); // Reload tree
            } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to delete node', { id: loadToast });
            }
        }
    };

    // Save edited node details
    const handleSaveNode = async () => {
        if (!selectedNode) return;
        const loadToast = toast.loading('Saving card...');

        const cleanedSlots = nodeSlots.map(slot => {
            const cleaned = { ...slot };
            delete cleaned.roster_content; // Remove temporary object before sending
            return cleaned;
        });

        const syncConfig = {
            enabled: nodeRosterSyncEnabled,
            section_id: nodeRosterSyncEnabled ? nodeRosterSyncSectionId : null,
            row_start: nodeRosterSyncEnabled && nodeRosterSyncRowStart !== '' ? parseInt(nodeRosterSyncRowStart.toString()) : null,
            row_end: nodeRosterSyncEnabled && nodeRosterSyncRowEnd !== '' ? parseInt(nodeRosterSyncRowEnd.toString()) : null,
            key_col: nodeRosterSyncEnabled ? nodeRosterSyncKeyCol : 'rank',
            value_col: nodeRosterSyncEnabled ? nodeRosterSyncValueCol : 'name',
            label_color: nodeRosterSyncEnabled ? (nodeRosterSyncLabelColor || null) : null,
            label_bold: nodeRosterSyncEnabled ? nodeRosterSyncLabelBold : false,
            value_color: nodeRosterSyncEnabled ? (nodeRosterSyncValueColor || null) : null,
            value_bold: nodeRosterSyncEnabled ? nodeRosterSyncValueBold : false,
        };

        try {
            await api.put(`/hierarchy-nodes/${selectedNode.id}`, {
                title: nodeTitle,
                color: nodeColor,
                slots: nodeRosterSyncEnabled ? [] : cleanedSlots,
                roster_sync_config: syncConfig,
            });
            toast.success('Card updated', { id: loadToast });
            setShowNodeEditModal(false);
            fetchHierarchies(); // Reload tree to fetch updated slot info
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update card', { id: loadToast });
        }
    };

    const openNodeEdit = (node: any) => {
        setSelectedNode(node);
        setNodeTitle(node.title || '');
        setNodeColor(node.color || activeHierarchy?.color || '#2563eb');
        setNodeSlots(node.slots ? JSON.parse(JSON.stringify(node.slots)) : []); // Deep clone

        const syncConfig = node.roster_sync_config || {};
        setNodeRosterSyncEnabled(!!syncConfig.enabled);
        setNodeRosterSyncSectionId(syncConfig.section_id || null);
        setNodeRosterSyncRowStart(syncConfig.row_start || '');
        setNodeRosterSyncRowEnd(syncConfig.row_end || '');
        setNodeRosterSyncKeyCol(syncConfig.key_col || 'rank');
        setNodeRosterSyncValueCol(syncConfig.value_col || 'name');
        setNodeRosterSyncLabelColor(syncConfig.label_color || '');
        setNodeRosterSyncLabelBold(syncConfig.label_bold !== false);
        setNodeRosterSyncValueColor(syncConfig.value_color || '');
        setNodeRosterSyncValueBold(syncConfig.value_bold !== false);

        setShowNodeEditModal(true);
    };

    // Add slot helper in modal
    const addNodeSlot = () => {
        setNodeSlots([
            ...nodeSlots,
            {
                id: uniqid('slot_'),
                roster_content_id: null,
                label: 'Position',
                value: 'VACANT',
            }
        ]);
    };

    const removeNodeSlot = (slotId: string) => {
        setNodeSlots(nodeSlots.filter(s => s.id !== slotId));
    };

    const handleSlotMemberLink = (slotId: string, memberIdStr: string) => {
        const memberId = memberIdStr ? parseInt(memberIdStr) : null;
        setNodeSlots(nodeSlots.map(s => {
            if (s.id === slotId) {
                const member = rosterMembers.find(m => m.id === memberId);
                return {
                    ...s,
                    roster_content_id: memberId,
                    label: member ? member.rank : s.label,
                    value: member ? member.name : 'VACANT',
                };
            }
            return s;
        }));
    };

    const uniqid = (prefix: string) => prefix + Math.random().toString(36).substring(2, 9);

    if (loading && hierarchies.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-bg text-text">
                <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-xs font-black uppercase tracking-widest text-muted">Loading Hierarchies...</p>
            </div>
        );
    }

    // Node Tree component rendering recursively
    const renderNodeTree = (node: any): React.ReactNode => {
        const slots = node.slots || [];
        const children = node.children || [];
        
        const hasManagePerm = activeHierarchy?.user_permissions?.manage_nodes || false;
        const hasEditPerm = activeHierarchy?.user_permissions?.edit_nodes || false;
        const isEditable = editMode && (hasManagePerm || hasEditPerm);

        return (
            <div className="flex flex-col items-center select-none" key={node.id}>
                {/* Node Box Card */}
                <div 
                    className="w-72 bg-card rounded-xl border border-border shadow-lg flex flex-col overflow-hidden transition-all duration-300 hover:shadow-2xl group relative"
                    style={{ borderTop: `4px solid ${node.color || activeHierarchy?.color}` }}
                >
                    {/* Header bar / Title */}
                    <div className="px-4 py-3 bg-surface/40 flex justify-between items-center border-b border-border">
                        <div className="text-[10px] font-black uppercase tracking-wider text-text truncate max-w-[170px]">
                            {node.title || 'Untitled Division'}
                        </div>
                        {isEditable && (
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => openNodeEdit(node)}
                                    className="p-1 hover:bg-surface text-muted hover:text-accent rounded transition-colors"
                                    title="Edit Card Details"
                                >
                                    <Edit3 size={12} />
                                </button>
                                {hasManagePerm && (
                                    <>
                                        <button 
                                            onClick={() => handleAddNode(node.id)}
                                            className="p-1 hover:bg-surface text-muted hover:text-accent rounded transition-colors"
                                            title="Add Branch Division"
                                        >
                                            <Plus size={12} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteNode(node.id)}
                                            className="p-1 hover:bg-danger/10 text-muted hover:text-danger rounded transition-colors"
                                            title="Delete Division"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Member Slots */}
                    <div className="p-3 divide-y divide-border/40">
                        {slots.map((slot: any) => {
                            const isVacant = !slot.roster_content_id && slot.value?.toLowerCase() === 'vacant';
                            const isConnected = !!slot.roster_content_id;
                            
                            const labelBold = slot.label_bold !== false; // defaults to true/bold
                            const valueBold = slot.value_bold !== false; // defaults to true/bold

                            return (
                                <div key={slot.id} className="py-2 flex items-center justify-between text-[10px] first:pt-0 last:pb-0">
                                    {/* Position label */}
                                    <div 
                                        className={`uppercase tracking-wider max-w-[100px] truncate ${
                                            labelBold ? 'font-black' : 'font-medium'
                                        } ${!slot.label_color ? 'text-muted' : ''}`}
                                        style={slot.label_color ? { color: slot.label_color } : {}}
                                    >
                                        {slot.label || 'Position'}
                                    </div>
                                    {/* Member name */}
                                    <div 
                                        className={`flex items-center gap-1.5 uppercase tracking-widest ${
                                            valueBold ? 'font-bold' : 'font-medium'
                                        } ${!slot.value_color ? (isVacant ? 'text-muted/60 italic' : 'text-text') : ''}`}
                                        style={slot.value_color ? { color: slot.value_color } : {}}
                                    >
                                        {isConnected && <Link2 size={10} className="text-accent shrink-0" />}
                                        <span>
                                            {slot.value || 'VACANT'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        {slots.length === 0 && (
                            <div className="py-3 text-center text-[9px] text-muted uppercase tracking-widest font-black opacity-30">
                                Empty Card
                            </div>
                        )}
                    </div>
                </div>

                {/* Draw connecting vertical line to children */}
                {children.length > 0 && (
                    <div className="w-px h-6 bg-border" />
                )}

                {/* Draw horizontal lines and recurse children */}
                {children.length > 0 && (
                    <div className="flex gap-8 relative pt-6">
                        {/* Horizontal connector line drawn with borders on children */}
                        {children.map((child: any) => (
                            <div 
                                key={child.id} 
                                className="relative pt-6 flex flex-col items-center before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-px before:h-6 before:bg-border after:content-[''] after:absolute after:top-0 after:left-0 after:right-0 after:h-px after:bg-border first:after:left-1/2 last:after:right-1/2 only:after:hidden"
                            >
                                {renderNodeTree(child)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div 
            className="flex flex-col h-full relative" 
            onClick={() => setActiveMenuId(null)}
        >
            <main className="flex-1 overflow-auto p-6 pb-16 space-y-6 flex flex-col min-h-0 bg-bg text-text">
                {/* Top Header bar */}
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <GitFork className="text-accent" size={28} />
                            Faction Hierarchy
                        </h1>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1 opacity-60">
                            Design and visualize organization structures and chart divisions
                        </p>
                    </div>

                    {/* Edit / View Toggles */}
                    {activeHierarchy && (activeHierarchy.user_permissions?.edit_nodes || activeHierarchy.user_permissions?.manage_nodes) && (
                        <div className="flex gap-3">
                            <button
                                onClick={() => setEditMode(!editMode)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                                    editMode 
                                        ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                                        : 'border border-border bg-surface hover:bg-accent/10 hover:text-accent hover:border-accent'
                                }`}
                            >
                                {editMode ? <Eye size={14} /> : <Edit size={14} />}
                                {editMode ? 'Exit Editor' : 'Edit Diagram'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Tree Workspace canvas area */}
                <div className="flex-1 overflow-auto border border-border rounded-2xl bg-card/40 relative flex items-start justify-center p-12 min-h-[400px]">
                    {activeHierarchy ? (
                        <div className="min-w-max flex flex-col items-center">
                            {activeHierarchy.nodes_tree && activeHierarchy.nodes_tree.length > 0 ? (
                                activeHierarchy.nodes_tree.map((node: any) => renderNodeTree(node))
                            ) : (
                                <div className="text-center p-20 space-y-4">
                                    <GitFork className="text-muted/30 mx-auto" size={48} />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted opacity-50">
                                        No divisions defined.
                                    </p>
                                    {editMode && activeHierarchy.user_permissions?.manage_nodes && (
                                        <button
                                            onClick={() => handleAddNode(null)}
                                            className="px-6 py-2.5 bg-accent text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition"
                                        >
                                            Create Main Division
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center p-20 space-y-4">
                            <GitFork className="text-muted/20 mx-auto" size={56} />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted opacity-40">
                                Create a hierarchy tab to begin charting structures.
                            </p>
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Tabs Bar */}
            <div className="tabs-bar bg-card border-t border-border flex items-center px-2.5 h-[var(--tab-h)] sticky bottom-0 z-[210]">
                <Reorder.Group 
                    ref={scrollRef}
                    axis="x" 
                    values={hierarchies} 
                    onReorder={handleReorder}
                    className="flex items-center flex-1 overflow-x-auto overflow-y-hidden scrollbar-none gap-1 h-full"
                >
                    {hierarchies.map((h: any) => {
                        const hPerms = h.user_permissions || {};
                        const canModerateH = canManageTabs || hPerms.modify_hierarchy;

                        return (
                            <Reorder.Item 
                                key={h.id} 
                                value={h}
                                className="flex items-center group relative h-full shrink-0 animate-none"
                            >
                                <div 
                                    onClick={() => {
                                        setActiveTabId(h.id);
                                        setEditMode(false);
                                    }}
                                    className={`tab pl-4 py-2 cursor-pointer transition-all text-[10px] font-bold uppercase h-full flex items-center gap-1.5 relative border-t-2 ${
                                        canModerateH ? 'pr-1' : 'pr-4'
                                    } ${
                                        activeTabId === h.id 
                                            ? 'border-accent text-accent bg-accent/5' 
                                            : 'border-transparent text-muted hover:text-text hover:bg-surface'
                                    }`}
                                    style={activeTabId === h.id ? { borderTopColor: h.color } : {}}
                                >
                                    <div className="w-1.5 h-1.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: h.color }} />
                                    <span>{h.name}</span>

                                    {canModerateH && (
                                        <div className="flex items-center">
                                            <div className={`transition-opacity flex items-center ${activeMenuId === h.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                 <button 
                                                    type="button"
                                                    className={`text-muted hover:text-accent cursor-pointer p-0.5 rounded hover:bg-accent/10 ${activeMenuId === h.id ? 'text-accent bg-accent/10' : ''}`} 
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (activeMenuId === h.id) {
                                                            setActiveMenuId(null);
                                                        } else {
                                                            setActiveTabId(h.id);
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setMenuPosition({ left: rect.left + rect.width / 2 });
                                                            setActiveMenuId(h.id);
                                                        }
                                                    }} 
                                                 >
                                                    <MoreVertical size={12} />
                                                 </button>
                                            </div>

                                            {activeMenuId === h.id && (
                                                <div 
                                                    className="fixed bottom-[var(--tab-h)] mb-2 bg-card border border-border rounded-lg shadow-2xl p-1 z-[999] min-w-[140px]"
                                                    style={{ 
                                                        left: menuPosition.left,
                                                        transform: 'translateX(-50%)'
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {hPerms.modify_hierarchy && (
                                                        <button 
                                                            onClick={() => {
                                                                setActiveMenuId(null);
                                                                openTabSettings();
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                                        >
                                                            <Settings size={12} /> Edit Settings
                                                        </button>
                                                    )}
                                                    {(hPerms.modify_hierarchy || user?.is_superadmin) && (
                                                        <button 
                                                            onClick={() => {
                                                                setActiveMenuId(null);
                                                                setShowPermissionsModal(true);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                                        >
                                                            <Shield size={12} /> Permissions
                                                        </button>
                                                    )}
                                                    {hPerms.modify_hierarchy && (
                                                        <button 
                                                            onClick={() => {
                                                                setActiveMenuId(null);
                                                                handleDeleteHierarchy();
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-danger/70 hover:text-danger hover:bg-danger/5 rounded transition-colors"
                                                        >
                                                            <Trash2 size={12} /> Remove Hierarchy
                                                        </button>
                                                    )}
                                                    <div className="border-t border-border mt-1 pt-1">
                                                        <div className="px-3 py-1.5 text-[8px] font-black uppercase text-muted/50 tracking-widest flex items-center gap-2">
                                                            <GripVertical size={10} /> Drag to reorder
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Reorder.Item>
                        );
                    })}
                </Reorder.Group>

                {canCreateHierarchy && (
                    <div className="relative flex items-center gap-1 ml-2 shrink-0">
                        <button 
                            onClick={() => {
                                setTabName('');
                                setTabColor('#2563eb');
                                setTabRosterId(null);
                                setShowCreateTabModal(true);
                            }}
                            className="p-2 text-muted hover:text-accent transition-colors"
                            title="Create New Hierarchy"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                )}

                {hierarchies.length > 5 && (
                    <div className="flex border-l border-border pl-2 gap-1 h-full items-center">
                        <button 
                            onClick={() => handleScroll('left')} 
                            className="p-1.5 text-muted hover:text-text cursor-pointer"
                            title="Scroll Left"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button 
                            onClick={() => handleScroll('right')} 
                            className="p-1.5 text-muted hover:text-text cursor-pointer"
                            title="Scroll Right"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Create Tab Modal */}
            {showCreateTabModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[500]">
                    <form onSubmit={handleCreateTab} className="bg-card rounded-2xl max-w-md w-full border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                                <Plus className="text-accent" size={20} />
                                Create Hierarchy
                            </h2>
                            <button type="button" onClick={() => setShowCreateTabModal(false)} className="text-muted hover:text-text">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Hierarchy Name</label>
                                <input
                                    type="text"
                                    required
                                    value={tabName}
                                    onChange={e => setTabName(e.target.value)}
                                    placeholder="e.g. Sheriff's Office Chart"
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-[11px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Tab Accent Color</label>
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="color"
                                        value={tabColor}
                                        onChange={e => setTabColor(e.target.value)}
                                        className="w-10 h-10 border border-border rounded-xl cursor-pointer bg-transparent"
                                    />
                                    <input
                                        type="text"
                                        value={tabColor}
                                        onChange={e => setTabColor(e.target.value)}
                                        className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Link to Personnel Roster (Optional)</label>
                                <select
                                    value={tabRosterId || ''}
                                    onChange={e => setTabRosterId(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent transition-colors"
                                >
                                    <option value="">Standalone / Unlinked</option>
                                    {rosters.filter(r => !r.is_sandbox).map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border bg-surface/30 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowCreateTabModal(false)}
                                className="px-6 py-2.5 border border-border hover:bg-surface rounded-xl text-[10px] font-black uppercase tracking-widest transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition"
                            >
                                Create
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tab Settings Modal */}
            {showTabSettingsModal && activeHierarchy && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[500]">
                    <form onSubmit={handleUpdateTabSettings} className="bg-card rounded-2xl max-w-md w-full border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                                <Settings className="text-accent" size={20} />
                                Hierarchy Settings: {activeHierarchy.name}
                            </h2>
                            <button type="button" onClick={() => setShowTabSettingsModal(false)} className="text-muted hover:text-text">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Hierarchy Name</label>
                                <input
                                    type="text"
                                    required
                                    value={tabName}
                                    onChange={e => setTabName(e.target.value)}
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-[11px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Tab Accent Color</label>
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="color"
                                        value={tabColor}
                                        onChange={e => setTabColor(e.target.value)}
                                        className="w-10 h-10 border border-border rounded-xl cursor-pointer bg-transparent"
                                    />
                                    <input
                                        type="text"
                                        value={tabColor}
                                        onChange={e => setTabColor(e.target.value)}
                                        className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Link to Personnel Roster</label>
                                <select
                                    value={tabRosterId || ''}
                                    onChange={e => setTabRosterId(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent transition-colors"
                                >
                                    <option value="">Standalone / Unlinked</option>
                                    {rosters.filter(r => !r.is_sandbox).map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border bg-surface/30 flex justify-between items-center">
                            <button
                                type="button"
                                onClick={handleDeleteHierarchy}
                                className="px-6 py-2.5 border border-danger/20 hover:bg-danger/10 text-danger rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowTabSettingsModal(false)}
                                    className="px-6 py-2.5 border border-border hover:bg-surface rounded-xl text-[10px] font-black uppercase tracking-widest transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Node Edit Card Modal */}
            {showNodeEditModal && selectedNode && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[500] overflow-y-auto">
                    <div className="bg-card rounded-2xl max-w-xl w-full border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                                <Edit className="text-accent" size={20} />
                                Edit Division Card
                            </h2>
                            <button type="button" onClick={() => setShowNodeEditModal(false)} className="text-muted hover:text-text">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                            {/* Card configuration */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Card Title</label>
                                    <input
                                        type="text"
                                        value={nodeTitle}
                                        onChange={e => setNodeTitle(e.target.value)}
                                        placeholder="e.g. Technology Bureau"
                                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-[11px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Card Top Color</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={nodeColor}
                                            onChange={e => setNodeColor(e.target.value)}
                                            className="w-10 h-10 border border-border rounded-xl cursor-pointer bg-transparent"
                                        />
                                        <input
                                            type="text"
                                            value={nodeColor}
                                            onChange={e => setNodeColor(e.target.value)}
                                            className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card Slots / Auto-Link toggle */}
                            {activeHierarchy?.roster_id && (
                                <div className="flex bg-surface border border-border rounded-xl p-1 mb-6">
                                    <button
                                        type="button"
                                        onClick={() => setNodeRosterSyncEnabled(false)}
                                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                            !nodeRosterSyncEnabled 
                                                ? 'bg-card text-text shadow-sm' 
                                                : 'text-muted hover:text-text'
                                        }`}
                                    >
                                        Manual Card Slots
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNodeRosterSyncEnabled(true)}
                                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                            nodeRosterSyncEnabled 
                                                ? 'bg-card text-text shadow-sm' 
                                                : 'text-muted hover:text-text'
                                        }`}
                                    >
                                        Auto-Linked Roster Section
                                    </button>
                                </div>
                            )}

                            {/* Card Slots configuration */}
                            {!nodeRosterSyncEnabled ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted">Card Personnel Slots</h3>
                                        <button
                                            type="button"
                                            onClick={addNodeSlot}
                                            className="px-3 py-1.5 border border-border bg-surface hover:bg-accent/15 hover:border-accent hover:text-accent rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                                        >
                                            <Plus size={12} /> Add Slot
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {nodeSlots.map((slot, index) => {
                                            const isConnected = !!slot.roster_content_id;
                                            return (
                                                <div key={slot.id} className="p-4 bg-surface border border-border rounded-xl space-y-4 relative">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[9px] font-black uppercase text-accent tracking-widest bg-accent/10 px-2 py-0.5 rounded">
                                                            Slot #{index + 1}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeNodeSlot(slot.id)}
                                                            className="p-1 hover:bg-danger/10 text-muted hover:text-danger rounded transition-colors"
                                                        >
                                                            <Trash size={14} />
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5">Role / Label (Key)</label>
                                                            <input
                                                                type="text"
                                                                value={slot.label || ''}
                                                                onChange={e => setNodeSlots(nodeSlots.map(s => s.id === slot.id ? { ...s, label: e.target.value } : s))}
                                                                placeholder="e.g. Captain"
                                                                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors"
                                                            />
                                                            {/* Styling for Label */}
                                                            <div className="flex gap-2 items-center mt-2">
                                                                <input
                                                                    type="color"
                                                                    value={slot.label_color || '#ffffff'}
                                                                    onChange={e => setNodeSlots(nodeSlots.map(s => s.id === slot.id ? { ...s, label_color: e.target.value } : s))}
                                                                    className="w-6 h-6 border border-border rounded cursor-pointer bg-transparent"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setNodeSlots(nodeSlots.map(s => s.id === slot.id ? { ...s, label_color: '' } : s))}
                                                                    className="text-[8px] font-bold text-muted hover:text-text uppercase tracking-widest border border-border px-1.5 py-0.5 rounded"
                                                                >
                                                                    Clear Color
                                                                </button>
                                                                <label className="flex items-center gap-1.5 text-[8px] font-black uppercase text-muted tracking-widest cursor-pointer select-none ml-auto">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={slot.label_bold !== false}
                                                                        onChange={e => setNodeSlots(nodeSlots.map(s => s.id === slot.id ? { ...s, label_bold: e.target.checked } : s))}
                                                                        className="rounded border-border text-accent focus:ring-0"
                                                                    />
                                                                    Bold
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5">Member / Value</label>
                                                            <input
                                                                type="text"
                                                                value={slot.value || ''}
                                                                onChange={e => setNodeSlots(nodeSlots.map(s => s.id === slot.id ? { ...s, value: e.target.value } : s))}
                                                                placeholder="e.g. Chase Delgado or VACANT"
                                                                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors"
                                                            />
                                                            {/* Styling for Value */}
                                                            <div className="flex gap-2 items-center mt-2">
                                                                <input
                                                                    type="color"
                                                                    value={slot.value_color || '#ffffff'}
                                                                    onChange={e => setNodeSlots(nodeSlots.map(s => s.id === slot.id ? { ...s, value_color: e.target.value } : s))}
                                                                    className="w-6 h-6 border border-border rounded cursor-pointer bg-transparent"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setNodeSlots(nodeSlots.map(s => s.id === slot.id ? { ...s, value_color: '' } : s))}
                                                                    className="text-[8px] font-bold text-muted hover:text-text uppercase tracking-widest border border-border px-1.5 py-0.5 rounded"
                                                                >
                                                                    Clear Color
                                                                </button>
                                                                <label className="flex items-center gap-1.5 text-[8px] font-black uppercase text-muted tracking-widest cursor-pointer select-none ml-auto">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={slot.value_bold !== false}
                                                                        onChange={e => setNodeSlots(nodeSlots.map(s => s.id === slot.id ? { ...s, value_bold: e.target.checked } : s))}
                                                                        className="rounded border-border text-accent focus:ring-0"
                                                                    />
                                                                    Bold
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Linking with Personnel Roster */}
                                                    {activeHierarchy?.roster_id && (
                                                        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-1.5 text-[8px] font-black text-muted uppercase tracking-widest">
                                                                {isConnected ? (
                                                                    <>
                                                                        <Link2 size={12} className="text-accent" />
                                                                        <span className="text-accent">Linked to Roster Member</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Link2Off size={12} />
                                                                        <span>Not Linked to Roster</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 max-w-[240px]">
                                                                <select
                                                                    value={slot.roster_content_id || ''}
                                                                    onChange={e => handleSlotMemberLink(slot.id, e.target.value)}
                                                                    className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest outline-none focus:border-accent transition-colors"
                                                                >
                                                                    <option value="">-- Standalone (Local Value) --</option>
                                                                    {rosterMembers.map(m => (
                                                                        <option key={m.id} value={m.id}>
                                                                            {m.rank} - {m.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {nodeSlots.length === 0 && (
                                            <div className="p-8 text-center text-[10px] text-muted font-bold uppercase tracking-[0.2em] border border-dashed border-border rounded-xl opacity-40">
                                                No slots defined. Add slots to display members inside the division.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="p-4 bg-surface border border-border rounded-xl space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-accent">Auto-Link Settings</h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5 font-bold">Roster Section</label>
                                                <select
                                                    required={nodeRosterSyncEnabled}
                                                    value={nodeRosterSyncSectionId || ''}
                                                    onChange={e => setNodeRosterSyncSectionId(e.target.value ? parseInt(e.target.value) : null)}
                                                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent transition-colors"
                                                >
                                                    <option value="">-- Select Section --</option>
                                                    {sectionsList.map((s: any) => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5 font-bold">Row Start (Index)</label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        placeholder="1"
                                                        value={nodeRosterSyncRowStart}
                                                        onChange={e => setNodeRosterSyncRowStart(e.target.value !== '' ? parseInt(e.target.value) : '')}
                                                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5 font-bold">Row End (Index)</label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        placeholder="e.g. 5"
                                                        value={nodeRosterSyncRowEnd}
                                                        onChange={e => setNodeRosterSyncRowEnd(e.target.value !== '' ? parseInt(e.target.value) : '')}
                                                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/30">
                                            <div>
                                                <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5 font-bold">Key (Label) Column</label>
                                                <select
                                                    value={nodeRosterSyncKeyCol}
                                                    onChange={e => setNodeRosterSyncKeyCol(e.target.value)}
                                                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent transition-colors"
                                                >
                                                    <option value="rank">Rank / Role (Default)</option>
                                                    <option value="name">Name</option>
                                                    {columnsList.filter((c: any) => c.id !== 'rank' && c.id !== 'name').map((c: any) => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5 font-bold">Value Column</label>
                                                <select
                                                    value={nodeRosterSyncValueCol}
                                                    onChange={e => setNodeRosterSyncValueCol(e.target.value)}
                                                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent transition-colors"
                                                >
                                                    <option value="name">Name (Default)</option>
                                                    <option value="rank">Rank / Role</option>
                                                    {columnsList.filter((c: any) => c.id !== 'name' && c.id !== 'rank').map((c: any) => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/30">
                                            <div>
                                                <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5 font-bold">Key Styling</label>
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        type="color"
                                                        value={nodeRosterSyncLabelColor || '#ffffff'}
                                                        onChange={e => setNodeRosterSyncLabelColor(e.target.value)}
                                                        className="w-6 h-6 border border-border rounded cursor-pointer bg-transparent"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setNodeRosterSyncLabelColor('')}
                                                        className="text-[8px] font-bold text-muted hover:text-text uppercase tracking-widest border border-border px-1.5 py-0.5 rounded"
                                                    >
                                                        Clear
                                                    </button>
                                                    <label className="flex items-center gap-1.5 text-[8px] font-black uppercase text-muted tracking-widest cursor-pointer select-none ml-auto">
                                                        <input
                                                            type="checkbox"
                                                            checked={nodeRosterSyncLabelBold}
                                                            onChange={e => setNodeRosterSyncLabelBold(e.target.checked)}
                                                            className="rounded border-border text-accent focus:ring-0"
                                                        />
                                                        Bold
                                                    </label>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5 font-bold">Value Styling</label>
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        type="color"
                                                        value={nodeRosterSyncValueColor || '#ffffff'}
                                                        onChange={e => setNodeRosterSyncValueColor(e.target.value)}
                                                        className="w-6 h-6 border border-border rounded cursor-pointer bg-transparent"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setNodeRosterSyncValueColor('')}
                                                        className="text-[8px] font-bold text-muted hover:text-text uppercase tracking-widest border border-border px-1.5 py-0.5 rounded"
                                                    >
                                                        Clear
                                                    </button>
                                                    <label className="flex items-center gap-1.5 text-[8px] font-black uppercase text-muted tracking-widest cursor-pointer select-none ml-auto">
                                                        <input
                                                            type="checkbox"
                                                            checked={nodeRosterSyncValueBold}
                                                            onChange={e => setNodeRosterSyncValueBold(e.target.checked)}
                                                            className="rounded border-border text-accent focus:ring-0"
                                                        />
                                                        Bold
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-border bg-surface/30 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowNodeEditModal(false)}
                                className="px-6 py-2.5 border border-border hover:bg-surface rounded-xl text-[10px] font-black uppercase tracking-widest transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveNode}
                                className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2"
                            >
                                <Save size={14} /> Save Card
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hierarchy Level Permissions Modal */}
            {showPermissionsModal && activeHierarchy && (
                <HierarchyPermissionsModal
                    hierarchy={activeHierarchy}
                    shortname={shortname}
                    onClose={() => {
                        setShowPermissionsModal(false);
                        fetchHierarchies(); // Eager reload
                    }}
                />
            )}
        </div>
    );
}

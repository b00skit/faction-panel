import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
    Plus, Minus, Trash2, Edit3, Settings, Users, Shield, Award, Crown, Check, X, 
    GitFork, Save, Eye, Edit, ListOrdered, Grid, Maximize2, Trash, Link2, Link2Off,
    MoreVertical, ChevronLeft, ChevronRight, GripVertical,
    Star, Briefcase, Heart, Target, Key
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
    users: Users,
    crown: Crown,
    shield: Shield,
    award: Award,
    star: Star,
    briefcase: Briefcase,
    heart: Heart,
    target: Target,
    key: Key
};
import api from '../api';
import toast from 'react-hot-toast';
import Loading from './Loading';
import { HierarchyPermissionsModal } from './HierarchyPermissionsModal';
import { useConfirm } from './ConfirmationProvider';
import { useDiagramRealtime } from '../hooks/useDiagramRealtime';

interface FactionHierarchyProps {
    user: any;
    shortname: string;
    permissions: string[];
    isDark: boolean;
    rosters: any[];
    factionId?: number;
}

export default function FactionHierarchy({ user, shortname, permissions, isDark, rosters, factionId }: FactionHierarchyProps) {
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
    const [tabRosterIds, setTabRosterIds] = useState<number[]>([]);
    
    // Edit node/card states
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [nodeTitle, setNodeTitle] = useState('');
    const [nodeColor, setNodeColor] = useState('');
    const [nodeSlots, setNodeSlots] = useState<any[]>([]);
    const [nodeCardStyle, setNodeCardStyle] = useState<'standard' | 'spotlight' | 'highlighted'>('standard');
    const [nodeImageUrl, setNodeImageUrl] = useState('');
    const [nodeIcon, setNodeIcon] = useState('users');
    
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

    // Node creation positioning state
    const [nodePosition, setNodePosition] = useState<'left' | 'right' | 'below'>('below');
    const [activeAddMenuNodeId, setActiveAddMenuNodeId] = useState<number | null>(null);

    // Pan & Zoom states
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef(1);
    const positionRef = useRef({ x: 0, y: 0 });

    // Sync refs for event handlers to prevent stale closure issues
    useEffect(() => {
        scaleRef.current = scale;
        positionRef.current = position;
    }, [scale, position]);

    const clampPosition = useCallback((x: number, y: number, targetScale: number) => {
        if (!containerRef.current || !canvasRef.current) return { x, y };

        const containerRect = containerRef.current.getBoundingClientRect();
        const canvasRect = canvasRef.current.getBoundingClientRect();
        
        const currentScale = scaleRef.current;
        const unscaledW = currentScale > 0 ? canvasRect.width / currentScale : canvasRect.width;
        const unscaledH = currentScale > 0 ? canvasRect.height / currentScale : canvasRect.height;
        
        const rectW = unscaledW * targetScale;
        const rectH = unscaledH * targetScale;

        const padding = 200;
        const cW = containerRect.width;
        const cH = containerRect.height;

        const maxX = cW - padding;
        const minX = padding - rectW;
        const maxY = cH - padding;
        const minY = padding - rectH;

        return {
            x: Math.max(minX, Math.min(maxX, x)),
            y: Math.max(minY, Math.min(maxY, y))
        };
    }, []);

    const centerCanvas = useCallback(() => {
        if (!containerRef.current || !canvasRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const canvasRect = canvasRef.current.getBoundingClientRect();
        
        const currentScale = scaleRef.current;
        const unscaledW = currentScale > 0 ? canvasRect.width / currentScale : canvasRect.width;
        
        // Center horizontally, position 40px from top
        const x = (containerRect.width - unscaledW) / 2;
        const y = 40;
        
        setPosition({ x, y });
        setScale(1);
    }, []);

    // Recenter canvas on tab change
    useEffect(() => {
        const timer = setTimeout(() => {
            centerCanvas();
        }, 100);
        return () => clearTimeout(timer);
    }, [activeTabId, centerCanvas]);

    // Handle global mouse dragging events
    useEffect(() => {
        if (!isDragging) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            const newX = e.clientX - dragStart.current.x;
            const newY = e.clientY - dragStart.current.y;
            setPosition(clampPosition(newX, newY, scaleRef.current));
        };

        const handleGlobalMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isDragging, clampPosition]);

    // Handle mouse wheel zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const currentScale = scaleRef.current;
            const currentPos = positionRef.current;

            const zoomIntensity = 0.06;
            const delta = e.deltaY < 0 ? 1 : -1;
            const newScale = Math.max(0.2, Math.min(2.0, currentScale + delta * zoomIntensity));

            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const canvasX = (mouseX - currentPos.x) / currentScale;
            const canvasY = (mouseY - currentPos.y) / currentScale;

            const newX = mouseX - canvasX * newScale;
            const newY = mouseY - canvasY * newScale;

            setScale(newScale);
            setPosition(clampPosition(newX, newY, newScale));
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', onWheel);
        };
    }, [clampPosition]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0 && e.button !== 1) return; // Left or middle click

        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('a')) {
            return;
        }

        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - positionRef.current.x,
            y: e.clientY - positionRef.current.y
        };
    };

    // Inline editing states for slots
    const [editingSlotKey, setEditingSlotKey] = useState<{
        nodeId: number;
        slotId: string;
        field: 'label' | 'value';
    } | null>(null);
    const [inlineEditValue, setInlineEditValue] = useState<string>('');

    // Fetch all hierarchies
    const fetchHierarchies = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const res = await api.get(`/factions/${shortname}/hierarchies`);
            setHierarchies(res.data);
            setActiveTabId(prev => {
                if (res.data.length > 0 && prev === null) {
                    return res.data[0].id;
                }
                return prev;
            });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to load hierarchies');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [shortname]);

    useEffect(() => {
        fetchHierarchies(true);
    }, [shortname, fetchHierarchies]);

    const activeHierarchy = hierarchies.find(h => h.id === activeTabId) || null;
    const rosterIds = activeHierarchy?.roster_ids || [];

    useDiagramRealtime({
        factionId,
        rosterIds,
        onDiagramUpdated: useCallback(() => {
            fetchHierarchies(false);
        }, [fetchHierarchies]),
    });

    const canCreateHierarchy = user?.is_superadmin || permissions.includes('create_hierarchy');
    const canManageTabs = user?.is_superadmin || permissions.includes('global_hierarchy_moderation');

    // Helper: resolve a raw cell value recursively if it's a cross-roster link object
    const resolveRawCellValue = (val: any, rosterList: any[]): string => {
        if (!val) return '';
        if (typeof val === 'object') {
            if (val.row_id && val.col_id) {
                // Find row in all rosters
                for (const r of rosterList) {
                    const findRow = (section: any): any => {
                        if (section.contents) {
                            const found = section.contents.find((c: any) => c.id === val.row_id);
                            if (found) return found;
                        }
                        if (section.children) {
                            for (const child of section.children) {
                                const found = findRow(child);
                                if (found) return found;
                            }
                        }
                        return null;
                    };
                    const rootSecs = r.root_sections || r.rootSections || [];
                    for (const sec of rootSecs) {
                        const found = findRow(sec);
                        if (found) {
                            const rawCell = found.content?.[val.col_id];
                            return resolveRawCellValue(rawCell, rosterList);
                        }
                    }
                }
                return '-';
            }
            return JSON.stringify(val);
        }
        return String(val);
    };

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
                    const rawName = c.content?.[nameKey] ?? '';
                    const rawRank = c.content?.[rankKey] ?? '';
                    const name = resolveRawCellValue(rawName, rosters) || '-';
                    const rank = resolveRawCellValue(rawRank, rosters) || '-';
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

    const getRosterBySectionId = (sectionId: number) => {
        for (const roster of rosters) {
            const findSection = (section: any): boolean => {
                if (section.id === sectionId) return true;
                if (section.children) {
                    for (const child of section.children) {
                        if (findSection(child)) return true;
                    }
                }
                return false;
            };
            const rootSecs = roster.root_sections || roster.rootSections || [];
            for (const sec of rootSecs) {
                if (findSection(sec)) return roster;
            }
        }
        return null;
    };

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

    const rosterMembers = activeHierarchy?.roster_ids && activeHierarchy.roster_ids.length > 0
        ? activeHierarchy.roster_ids.flatMap((id: number) => getRosterMembers(id))
        : [];

    const sectionsList = activeHierarchy?.roster_ids && activeHierarchy.roster_ids.length > 0
        ? activeHierarchy.roster_ids.flatMap((id: number) => {
            const roster = rosters.find(r => r.id === id);
            return roster ? getRosterSectionsList(roster).map((s: any) => ({ ...s, name: `${roster.name} - ${s.name}` })) : [];
        })
        : [];

    const selectedSectionRoster = nodeRosterSyncSectionId ? getRosterBySectionId(nodeRosterSyncSectionId) : null;
    const columnsList = selectedSectionRoster
        ? (selectedSectionRoster.columns || [])
        : (activeHierarchy?.roster_ids && activeHierarchy.roster_ids.length > 0
            ? (rosters.find(r => r.id === activeHierarchy.roster_ids[0])?.columns || [])
            : []);

    // Create a new tab
    const handleCreateTab = async (e: React.FormEvent) => {
        e.preventDefault();
        const loadToast = toast.loading('Creating diagram...');
        try {
            const res = await api.post(`/factions/${shortname}/hierarchies`, {
                name: tabName,
                color: tabColor,
                roster_ids: tabRosterIds,
            });
            toast.success('Diagram created', { id: loadToast });
            setShowCreateTabModal(false);
            setTabName('');
            setTabColor('#2563eb');
            setTabRosterIds([]);
            await fetchHierarchies();
            setActiveTabId(res.data.id);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create diagram', { id: loadToast });
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
                roster_ids: tabRosterIds,
            });
            toast.success('Diagram updated', { id: loadToast });
            await fetchHierarchies();
            setShowTabSettingsModal(false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update diagram', { id: loadToast });
        }
    };

    // Open tab settings modal
    const openTabSettings = () => {
        if (!activeHierarchy) return;
        setTabName(activeHierarchy.name);
        setTabColor(activeHierarchy.color);
        setTabRosterIds(activeHierarchy.roster_ids || []);
        setShowTabSettingsModal(true);
    };

    // Delete active hierarchy
    const handleDeleteHierarchy = async () => {
        if (!activeHierarchy) return;

        const isConfirmed = await confirm({
            title: 'Delete Diagram',
            message: `Are you sure you want to delete the diagram "${activeHierarchy.name}"? This action cannot be undone.`,
        });

        if (isConfirmed) {
            const loadToast = toast.loading('Deleting diagram...');
            try {
                await api.delete(`/hierarchies/${activeHierarchy.id}`);
                toast.success('Diagram deleted', { id: loadToast });
                const remaining = hierarchies.filter(h => h.id !== activeHierarchy.id);
                setHierarchies(remaining);
                setActiveTabId(remaining.length > 0 ? remaining[0].id : null);
                setShowTabSettingsModal(false);
            } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to delete diagram', { id: loadToast });
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
    const handleAddNode = async (parentId: number | null, position: 'left' | 'right' | 'below' = 'below') => {
        if (!activeHierarchy) return;

        const loadToast = toast.loading('Adding card...');
        try {
            const res = await api.post(`/hierarchies/${activeTabId}/nodes`, {
                parent_id: parentId,
                title: 'New Card',
                color: activeHierarchy.color,
                position: position,
                slots: [
                    {
                        id: uniqid('slot_'),
                        roster_content_id: null,
                        label: 'Position',
                        value: 'VACANT',
                    }
                ]
            });
            toast.success('Card added', { id: loadToast });
            fetchHierarchies(); // Reload tree
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to add node', { id: loadToast });
        }
    };

    const handleDeleteNode = async (nodeId: number) => {
        const isConfirmed = await confirm({
            title: 'Delete Card',
            message: 'Are you sure you want to delete this card and all its child cards? This cannot be undone.',
        });

        if (isConfirmed) {
            const loadToast = toast.loading('Deleting card...');
            try {
                await api.delete(`/hierarchy-nodes/${nodeId}`);
                toast.success('Card removed', { id: loadToast });
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
                card_style: nodeCardStyle,
                image_url: nodeCardStyle === 'spotlight' ? (nodeImageUrl || null) : null,
                icon: nodeCardStyle === 'spotlight' ? (nodeIcon || 'users') : null,
                slots: nodeRosterSyncEnabled ? [] : cleanedSlots,
                roster_sync_config: syncConfig,
                position: selectedNode.parent_id ? nodePosition : 'below',
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
        setNodeCardStyle(node.card_style || 'standard');
        setNodeImageUrl(node.image_url || '');
        setNodeIcon(node.icon || 'users');
        setNodePosition(node.position || 'below');

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

    const handleCancelInlineEdit = () => {
        setEditingSlotKey(null);
        setInlineEditValue('');
    };

    const saveNodeSlots = async (node: any, updatedSlots: any[]) => {
        const loadToast = toast.loading('Saving inline edit...');
        
        const cleanedSlots = updatedSlots.map(slot => {
            const cleaned = { ...slot };
            delete cleaned.roster_content; // Remove temporary object before sending
            return cleaned;
        });

        const syncConfig = node.roster_sync_config || {};

        try {
            await api.put(`/hierarchy-nodes/${node.id}`, {
                title: node.title,
                color: node.color,
                slots: cleanedSlots,
                roster_sync_config: syncConfig,
            });
            toast.success('Saved', { id: loadToast });
            fetchHierarchies(); // Reload tree to fetch updated slot info
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save edit', { id: loadToast });
        }
    };

    const handleSaveInlineText = async (node: any, slot: any, field: 'label' | 'value') => {
        const trimmed = inlineEditValue.trim();
        // If the value hasn't changed, just close it
        if (trimmed === slot[field]) {
            handleCancelInlineEdit();
            return;
        }

        const updatedSlots = (node.slots || []).map((s: any) => {
            if (s.id === slot.id) {
                return {
                    ...s,
                    [field]: trimmed,
                };
            }
            return s;
        });

        await saveNodeSlots(node, updatedSlots);
        handleCancelInlineEdit();
    };

    const uniqid = (prefix: string) => prefix + Math.random().toString(36).substring(2, 9);

    if (loading && hierarchies.length === 0) {
        return <Loading message="Loading Diagrams..." />;
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
                    className="w-72 bg-card rounded-xl border border-border shadow-lg flex flex-col transition-all duration-300 hover:shadow-2xl group relative"
                    style={{ 
                        borderTop: `4px solid ${node.color || activeHierarchy?.color}`,
                        zIndex: activeAddMenuNodeId === node.id ? 50 : 1
                    }}
                >
                    {/* Header bar / Title */}
                    <div className="px-4 py-3 bg-surface/40 flex justify-between items-center border-b border-border rounded-t-xl">
                        <div className="text-[10px] font-black uppercase tracking-wider text-text truncate max-w-[170px]">
                            {node.title || 'Untitled Card'}
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
                                        <div className="relative">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (activeAddMenuNodeId === node.id) {
                                                        setActiveAddMenuNodeId(null);
                                                    } else {
                                                        setActiveAddMenuNodeId(node.id);
                                                    }
                                                }}
                                                className={`p-1 hover:bg-surface rounded transition-colors ${activeAddMenuNodeId === node.id ? 'text-accent bg-surface' : 'text-muted hover:text-accent'}`}
                                                title="Add Child Card"
                                            >
                                                <Plus size={12} />
                                            </button>
                                            {activeAddMenuNodeId === node.id && (
                                                <div 
                                                    className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-2xl p-1 z-[999] min-w-[120px]"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button 
                                                        onClick={() => {
                                                            setActiveAddMenuNodeId(null);
                                                            handleAddNode(node.id, 'left');
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                                    >
                                                        Add Left Card
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setActiveAddMenuNodeId(null);
                                                            handleAddNode(node.id, 'below');
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                                    >
                                                        Add Below Card
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setActiveAddMenuNodeId(null);
                                                            handleAddNode(node.id, 'right');
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                                    >
                                                        Add Right Card
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteNode(node.id)}
                                            className="p-1 hover:bg-danger/10 text-muted hover:text-danger rounded transition-colors"
                                            title="Delete Card"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Member Slots */}
                    <div className="p-3">
                        {node.card_style === 'spotlight' ? (
                            <div className="flex flex-col space-y-2 pt-1 pb-1">
                                {slots.length > 0 ? (
                                    <>
                                        {/* Spotlight Executive (First Slot) */}
                                        <div className="text-center pb-1">
                                            {node.image_url ? (
                                                <img 
                                                    src={node.image_url} 
                                                    className="w-14 h-14 rounded-full border border-border object-cover mb-2.5 mx-auto shadow-sm" 
                                                    alt="Spotlight Profile" 
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mb-2.5 mx-auto">
                                                    {React.createElement(ICON_MAP[node.icon || 'users'] || Users, { size: 20, className: 'text-accent' })}
                                                </div>
                                            )}
                                            {/* Render spotlight label */}
                                            <div className="flex justify-center mb-1.5">
                                                {editingSlotKey?.nodeId === node.id && editingSlotKey?.slotId === slots[0].id && editingSlotKey?.field === 'label' ? (
                                                    <input
                                                        type="text"
                                                        value={inlineEditValue}
                                                        onChange={e => setInlineEditValue(e.target.value)}
                                                        onBlur={() => handleSaveInlineText(node, slots[0], 'label')}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleSaveInlineText(node, slots[0], 'label');
                                                            if (e.key === 'Escape') handleCancelInlineEdit();
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="bg-surface border border-accent rounded px-1.5 py-0.5 text-[9px] w-[100px] outline-none font-bold uppercase text-text text-center"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <div 
                                                        onClick={(e) => {
                                                            if (isEditable && !slots[0]?.roster_content_id) {
                                                                e.stopPropagation();
                                                                 setEditingSlotKey({ nodeId: node.id, slotId: slots[0].id, field: 'label' });
                                                                setInlineEditValue(slots[0].label || '');
                                                            }
                                                        }}
                                                        className={`uppercase tracking-widest text-[9px] px-2.5 py-0.5 rounded-full ${
                                                            slots[0].label_bold !== false ? 'font-black' : 'font-medium'
                                                        } ${!slots[0].label_color ? 'text-accent bg-accent/10 border border-accent/20' : ''} ${isEditable && !slots[0]?.roster_content_id ? 'cursor-pointer hover:opacity-80 transition-all' : ''}`}
                                                        style={slots[0].label_color ? { color: slots[0].label_color, backgroundColor: `${slots[0].label_color}15`, borderColor: `${slots[0].label_color}30`, borderWidth: '1px' } : {}}
                                                        title={isEditable && !slots[0]?.roster_content_id ? 'Click to edit' : undefined}
                                                    >
                                                        {slots[0].label || 'Position'}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Render spotlight value */}
                                            <div className="flex justify-center">
                                                {editingSlotKey?.nodeId === node.id && editingSlotKey?.slotId === slots[0].id && editingSlotKey?.field === 'value' ? (
                                                    <input
                                                        type="text"
                                                        value={inlineEditValue}
                                                        onChange={e => setInlineEditValue(e.target.value)}
                                                        onBlur={() => handleSaveInlineText(node, slots[0], 'value')}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleSaveInlineText(node, slots[0], 'value');
                                                            if (e.key === 'Escape') handleCancelInlineEdit();
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="bg-surface border border-accent rounded px-1.5 py-0.5 text-[9px] w-[150px] outline-none font-bold uppercase text-text text-center"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <div 
                                                        onClick={(e) => {
                                                            if (isEditable && !slots[0]?.roster_content_id) {
                                                                e.stopPropagation();
                                                                setEditingSlotKey({ nodeId: node.id, slotId: slots[0].id, field: 'value' });
                                                                setInlineEditValue(slots[0].value || '');
                                                            }
                                                        }}
                                                        className={`text-xs uppercase tracking-widest flex items-center justify-center gap-1 ${
                                                            slots[0].value_bold !== false ? 'font-black' : 'font-semibold'
                                                        } ${!slots[0].value_color ? (slots[0].value?.toLowerCase() === 'vacant' ? 'text-muted/60 italic' : 'text-text') : ''} ${isEditable && !slots[0]?.roster_content_id ? 'cursor-pointer hover:bg-surface/60 rounded px-2 py-0.5 transition-colors' : ''}`}
                                                        style={slots[0].value_color ? { color: slots[0].value_color } : {}}
                                                        title={isEditable && !slots[0]?.roster_content_id ? 'Click to edit' : undefined}
                                                    >
                                                        <span>{slots[0].value || 'VACANT'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Subsequent slots listed below */}
                                        {slots.length > 1 && (
                                            <div className="mt-2.5 pt-2.5 border-t border-border/40 divide-y divide-border/30">
                                                {slots.slice(1).map((slot: any) => {
                                                    const isVacant = !slot.roster_content_id && slot.value?.toLowerCase() === 'vacant';
                                                    const isConnected = !!slot.roster_content_id;
                                                    const labelBold = slot.label_bold !== false;
                                                    const valueBold = slot.value_bold !== false;
                                                    const isEditingLabel = editingSlotKey?.nodeId === node.id && editingSlotKey?.slotId === slot.id && editingSlotKey?.field === 'label';
                                                    const isEditingValue = editingSlotKey?.nodeId === node.id && editingSlotKey?.slotId === slot.id && editingSlotKey?.field === 'value';
                                                    return (
                                                        <div key={slot.id} className="py-2 flex items-center justify-between text-[10px] first:pt-0 last:pb-0 gap-2">
                                                            {isEditingLabel ? (
                                                                <input
                                                                    type="text"
                                                                    value={inlineEditValue}
                                                                    onChange={e => setInlineEditValue(e.target.value)}
                                                                    onBlur={() => handleSaveInlineText(node, slot, 'label')}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleSaveInlineText(node, slot, 'label');
                                                                        if (e.key === 'Escape') handleCancelInlineEdit();
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="bg-surface border border-accent rounded px-1.5 py-0.5 text-[9px] w-[90px] outline-none font-bold uppercase text-text"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <div 
                                                                    onClick={(e) => {
                                                                        if (isEditable && !slot.roster_content_id) {
                                                                            e.stopPropagation();
                                                                            setEditingSlotKey({ nodeId: node.id, slotId: slot.id, field: 'label' });
                                                                            setInlineEditValue(slot.label || '');
                                                                        }
                                                                    }}
                                                                    className={`uppercase tracking-wider max-w-[100px] truncate ${
                                                                        labelBold ? 'font-black' : 'font-medium'
                                                                    } ${!slot.label_color ? 'text-muted' : ''} ${isEditable && !slot.roster_content_id ? 'cursor-pointer hover:bg-surface/60 rounded px-1 -mx-1 transition-colors' : ''}`}
                                                                    style={slot.label_color ? { color: slot.label_color } : {}}
                                                                    title={isEditable && !slot.roster_content_id ? 'Click to edit' : undefined}
                                                                >
                                                                    {slot.label || 'Position'}
                                                                </div>
                                                            )}
                                                            {isEditingValue ? (
                                                                <input
                                                                    type="text"
                                                                    value={inlineEditValue}
                                                                    onChange={e => setInlineEditValue(e.target.value)}
                                                                    onBlur={() => handleSaveInlineText(node, slot, 'value')}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleSaveInlineText(node, slot, 'value');
                                                                        if (e.key === 'Escape') handleCancelInlineEdit();
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="bg-surface border border-accent rounded px-1.5 py-0.5 text-[9px] w-[140px] outline-none font-bold uppercase text-text text-right"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <div 
                                                                    onClick={(e) => {
                                                                        if (isEditable && !slot.roster_content_id) {
                                                                            e.stopPropagation();
                                                                            setEditingSlotKey({ nodeId: node.id, slotId: slot.id, field: 'value' });
                                                                            setInlineEditValue(slot.value || '');
                                                                        }
                                                                    }}
                                                                    className={`flex items-center gap-1.5 uppercase tracking-widest ${
                                                                        valueBold ? 'font-bold' : 'font-medium'
                                                                    } ${!slot.value_color ? (isVacant ? 'text-muted/60 italic' : 'text-text') : ''} ${isEditable && !slot.roster_content_id ? 'cursor-pointer hover:bg-surface/60 rounded px-1 -mx-1 transition-colors' : ''}`}
                                                                    style={slot.value_color ? { color: slot.value_color } : {}}
                                                                    title={isEditable && !slot.roster_content_id ? 'Click to edit' : undefined}
                                                                >
                                                                    <span>{slot.value || 'VACANT'}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="py-3 text-center text-[9px] text-muted uppercase tracking-widest font-black opacity-30">
                                        Empty Spotlight Card
                                    </div>
                                )}
                            </div>
                        ) : node.card_style === 'highlighted' ? (
                            <div className="flex flex-col pt-1 pb-1">
                                {slots.length > 0 ? (
                                    <>
                                        {/* Highlighted Supervisor Slot */}
                                        <div className="bg-accent/5 border border-accent/10 rounded-lg p-2 flex items-center justify-between gap-2 mb-2">
                                            {editingSlotKey?.nodeId === node.id && editingSlotKey?.slotId === slots[0].id && editingSlotKey?.field === 'label' ? (
                                                <input
                                                    type="text"
                                                    value={inlineEditValue}
                                                    onChange={e => setInlineEditValue(e.target.value)}
                                                    onBlur={() => handleSaveInlineText(node, slots[0], 'label')}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveInlineText(node, slots[0], 'label');
                                                        if (e.key === 'Escape') handleCancelInlineEdit();
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-surface border border-accent rounded px-1.5 py-0.5 text-[9px] w-[90px] outline-none font-bold uppercase text-text"
                                                    autoFocus
                                                />
                                            ) : (
                                                <div 
                                                    onClick={(e) => {
                                                        if (isEditable && !slots[0]?.roster_content_id) {
                                                            e.stopPropagation();
                                                            setEditingSlotKey({ nodeId: node.id, slotId: slots[0].id, field: 'label' });
                                                            setInlineEditValue(slots[0].label || '');
                                                        }
                                                    }}
                                                    className={`uppercase tracking-wider max-w-[100px] truncate ${
                                                        slots[0].label_bold !== false ? 'font-black' : 'font-bold'
                                                    } ${!slots[0].label_color ? 'text-accent' : ''} ${isEditable && !slots[0]?.roster_content_id ? 'cursor-pointer hover:bg-surface/60 rounded px-1 -mx-1 transition-colors' : ''}`}
                                                    style={slots[0].label_color ? { color: slots[0].label_color } : {}}
                                                    title={isEditable && !slots[0]?.roster_content_id ? 'Click to edit' : undefined}
                                                >
                                                    {slots[0].label || 'Supervisor'}
                                                </div>
                                            )}
                                            {editingSlotKey?.nodeId === node.id && editingSlotKey?.slotId === slots[0].id && editingSlotKey?.field === 'value' ? (
                                                <input
                                                    type="text"
                                                    value={inlineEditValue}
                                                    onChange={e => setInlineEditValue(e.target.value)}
                                                    onBlur={() => handleSaveInlineText(node, slots[0], 'value')}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveInlineText(node, slots[0], 'value');
                                                        if (e.key === 'Escape') handleCancelInlineEdit();
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-surface border border-accent rounded px-1.5 py-0.5 text-[9px] w-[140px] outline-none font-bold uppercase text-text text-right"
                                                    autoFocus
                                                />
                                            ) : (
                                                <div 
                                                    onClick={(e) => {
                                                        if (isEditable && !slots[0]?.roster_content_id) {
                                                            e.stopPropagation();
                                                            setEditingSlotKey({ nodeId: node.id, slotId: slots[0].id, field: 'value' });
                                                            setInlineEditValue(slots[0].value || '');
                                                        }
                                                    }}
                                                    className={`flex items-center gap-1.5 uppercase tracking-widest text-[11px] ${
                                                        slots[0].value_bold !== false ? 'font-black' : 'font-bold'
                                                    } ${!slots[0].value_color ? (slots[0].value?.toLowerCase() === 'vacant' ? 'text-muted/60 italic' : 'text-text') : ''} ${isEditable && !slots[0]?.roster_content_id ? 'cursor-pointer hover:bg-surface/60 rounded px-1 -mx-1 transition-colors' : ''}`}
                                                    style={slots[0].value_color ? { color: slots[0].value_color } : {}}
                                                    title={isEditable && !slots[0]?.roster_content_id ? 'Click to edit' : undefined}
                                                >
                                                    <span>{slots[0].value || 'VACANT'}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Smaller Assistants / Team Slots */}
                                        {slots.length > 1 && (
                                            <div className="space-y-1 divide-y divide-border/20">
                                                {slots.slice(1).map((slot: any) => {
                                                    const isVacant = !slot.roster_content_id && slot.value?.toLowerCase() === 'vacant';
                                                    const isConnected = !!slot.roster_content_id;
                                                    const labelBold = slot.label_bold !== false;
                                                    const valueBold = slot.value_bold !== false;
                                                    const isEditingLabel = editingSlotKey?.nodeId === node.id && editingSlotKey?.slotId === slot.id && editingSlotKey?.field === 'label';
                                                    const isEditingValue = editingSlotKey?.nodeId === node.id && editingSlotKey?.slotId === slot.id && editingSlotKey?.field === 'value';
                                                    return (
                                                        <div key={slot.id} className="py-1.5 flex items-center justify-between text-[9px] first:pt-0 last:pb-0 gap-2">
                                                            {isEditingLabel ? (
                                                                <input
                                                                    type="text"
                                                                    value={inlineEditValue}
                                                                    onChange={e => setInlineEditValue(e.target.value)}
                                                                    onBlur={() => handleSaveInlineText(node, slot, 'label')}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleSaveInlineText(node, slot, 'label');
                                                                        if (e.key === 'Escape') handleCancelInlineEdit();
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="bg-surface border border-accent rounded px-1.5 py-0.5 text-[8.5px] w-[80px] outline-none font-bold uppercase text-text"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <div 
                                                                    onClick={(e) => {
                                                                        if (isEditable && !slot.roster_content_id) {
                                                                            e.stopPropagation();
                                                                            setEditingSlotKey({ nodeId: node.id, slotId: slot.id, field: 'label' });
                                                                            setInlineEditValue(slot.label || '');
                                                                        }
                                                                    }}
                                                                    className={`uppercase tracking-wider max-w-[100px] truncate text-[9px] ${
                                                                        labelBold ? 'font-bold' : 'font-normal'
                                                                    } ${!slot.label_color ? 'text-muted/80' : ''} ${isEditable && !slot.roster_content_id ? 'cursor-pointer hover:bg-surface/60 rounded px-1 -mx-1 transition-colors' : ''}`}
                                                                    style={slot.label_color ? { color: slot.label_color } : {}}
                                                                    title={isEditable && !slot.roster_content_id ? 'Click to edit' : undefined}
                                                                >
                                                                    {slot.label || 'Position'}
                                                                </div>
                                                            )}
                                                            {isEditingValue ? (
                                                                <input
                                                                    type="text"
                                                                    value={inlineEditValue}
                                                                    onChange={e => setInlineEditValue(e.target.value)}
                                                                    onBlur={() => handleSaveInlineText(node, slot, 'value')}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleSaveInlineText(node, slot, 'value');
                                                                        if (e.key === 'Escape') handleCancelInlineEdit();
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="bg-surface border border-accent rounded px-1.5 py-0.5 text-[8.5px] w-[130px] outline-none font-bold uppercase text-text text-right"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <div 
                                                                    onClick={(e) => {
                                                                        if (isEditable && !slot.roster_content_id) {
                                                                            e.stopPropagation();
                                                                            setEditingSlotKey({ nodeId: node.id, slotId: slot.id, field: 'value' });
                                                                            setInlineEditValue(slot.value || '');
                                                                        }
                                                                    }}
                                                                    className={`flex items-center gap-1 uppercase tracking-widest text-[9.5px] ${
                                                                        valueBold ? 'font-bold' : 'font-medium'
                                                                    } ${!slot.value_color ? (isVacant ? 'text-muted/50 italic' : 'text-text/90') : ''} ${isEditable && !slot.roster_content_id ? 'cursor-pointer hover:bg-surface/60 rounded px-1 -mx-1 transition-colors' : ''}`}
                                                                    style={slot.value_color ? { color: slot.value_color } : {}}
                                                                    title={isEditable && !slot.roster_content_id ? 'Click to edit' : undefined}
                                                                >
                                                                    <span>{slot.value || 'VACANT'}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="py-3 text-center text-[9px] text-muted uppercase tracking-widest font-black opacity-30">
                                        Empty Card
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Standard layout */
                            <div className="divide-y divide-border/40">
                                {slots.map((slot: any) => {
                                    const isVacant = !slot.roster_content_id && slot.value?.toLowerCase() === 'vacant';
                                    const isConnected = !!slot.roster_content_id;
                                    const labelBold = slot.label_bold !== false;
                                    const valueBold = slot.value_bold !== false;
                                    const isEditingLabel = editingSlotKey?.nodeId === node.id && editingSlotKey?.slotId === slot.id && editingSlotKey?.field === 'label';
                                    const isEditingValue = editingSlotKey?.nodeId === node.id && editingSlotKey?.slotId === slot.id && editingSlotKey?.field === 'value';
                                    return (
                                        <div key={slot.id} className="py-2 flex items-center justify-between text-[10px] first:pt-0 last:pb-0 gap-2">
                                            {isEditingLabel ? (
                                                <input
                                                    type="text"
                                                    value={inlineEditValue}
                                                    onChange={e => setInlineEditValue(e.target.value)}
                                                    onBlur={() => handleSaveInlineText(node, slot, 'label')}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveInlineText(node, slot, 'label');
                                                        if (e.key === 'Escape') handleCancelInlineEdit();
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-surface border border-accent rounded px-1.5 py-0.5 text-[9px] w-[90px] outline-none font-bold uppercase text-text"
                                                    autoFocus
                                                />
                                            ) : (
                                                <div 
                                                    onClick={(e) => {
                                                        if (isEditable && !slot.roster_content_id) {
                                                            e.stopPropagation();
                                                            setEditingSlotKey({ nodeId: node.id, slotId: slot.id, field: 'label' });
                                                            setInlineEditValue(slot.label || '');
                                                        }
                                                    }}
                                                    className={`uppercase tracking-wider max-w-[100px] truncate ${
                                                        labelBold ? 'font-black' : 'font-medium'
                                                    } ${!slot.label_color ? 'text-muted' : ''} ${isEditable && !slot.roster_content_id ? 'cursor-pointer hover:bg-surface/60 rounded px-1 -mx-1 transition-colors' : ''}`}
                                                    style={slot.label_color ? { color: slot.label_color } : {}}
                                                    title={isEditable && !slot.roster_content_id ? 'Click to edit' : undefined}
                                                >
                                                    {slot.label || 'Position'}
                                                </div>
                                            )}
                                            {isEditingValue ? (
                                                <input
                                                    type="text"
                                                    value={inlineEditValue}
                                                    onChange={e => setInlineEditValue(e.target.value)}
                                                    onBlur={() => handleSaveInlineText(node, slot, 'value')}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveInlineText(node, slot, 'value');
                                                        if (e.key === 'Escape') handleCancelInlineEdit();
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-surface border border-accent rounded px-1.5 py-0.5 text-[9px] w-[140px] outline-none font-bold uppercase text-text text-right"
                                                    autoFocus
                                                />
                                            ) : (
                                                <div 
                                                    onClick={(e) => {
                                                        if (isEditable && !slot.roster_content_id) {
                                                            e.stopPropagation();
                                                            setEditingSlotKey({ nodeId: node.id, slotId: slot.id, field: 'value' });
                                                            setInlineEditValue(slot.value || '');
                                                        }
                                                    }}
                                                    className={`flex items-center gap-1.5 uppercase tracking-widest ${
                                                        valueBold ? 'font-bold' : 'font-medium'
                                                    } ${!slot.value_color ? (isVacant ? 'text-muted/60 italic' : 'text-text') : ''} ${isEditable && !slot.roster_content_id ? 'cursor-pointer hover:bg-surface/60 rounded px-1 -mx-1 transition-colors' : ''}`}
                                                    style={slot.value_color ? { color: slot.value_color } : {}}
                                                    title={isEditable && !slot.roster_content_id ? 'Click to edit' : undefined}
                                                >
                                                    <span>{slot.value || 'VACANT'}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {slots.length === 0 && (
                                    <div className="py-3 text-center text-[9px] text-muted uppercase tracking-widest font-black opacity-30">
                                        Empty Card
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Filter and group children */}
                {(() => {
                    const leftChildren = children.filter((c: any) => c.position === 'left');
                    const rightChildren = children.filter((c: any) => c.position === 'right');
                    const belowChildren = children.filter((c: any) => c.position === 'below' || !c.position);

                    const maxRows = Math.max(leftChildren.length, rightChildren.length);
                    const rows = [];
                    for (let i = 0; i < maxRows; i++) {
                        rows.push({
                            left: leftChildren[i] || null,
                            right: rightChildren[i] || null
                        });
                    }

                    const hasChildren = children.length > 0;
                    const hasSides = maxRows > 0;
                    const hasBelow = belowChildren.length > 0;

                    return (
                        <>
                            {/* Draw connecting vertical line to children */}
                            {hasChildren && (
                                <div className="w-px h-6 bg-border flex-none" />
                            )}

                            {/* Render side-branching left/right rows */}
                            {hasSides && (
                                <div className="flex flex-col items-center w-full relative flex-none">
                                    {rows.map((row, index) => {
                                        const isLastRow = index === rows.length - 1;
                                        return (
                                            <div key={index} className="flex items-stretch justify-center relative w-full">
                                                {/* Left Column */}
                                                <div className="flex-1 min-w-[320px] flex items-start justify-end pr-8 relative">
                                                    {row.left && (
                                                        <>
                                                            <div className="absolute right-0 top-[36px] w-8 h-px bg-border" />
                                                            {renderNodeTree(row.left)}
                                                        </>
                                                    )}
                                                </div>

                                                {/* Center Column (Trunk) */}
                                                <div className={`w-px flex-none relative ${(!hasBelow && isLastRow) ? 'bg-transparent' : 'bg-border h-full'}`}>
                                                    {(!hasBelow && isLastRow) ? (
                                                        <div className="absolute top-0 left-0 w-px h-[36px] bg-border" />
                                                    ) : null}
                                                </div>

                                                {/* Right Column */}
                                                <div className="flex-1 min-w-[320px] flex items-start justify-start pl-8 relative">
                                                    {row.right && (
                                                        <>
                                                            <div className="absolute left-0 top-[36px] w-8 h-px bg-border" />
                                                            {renderNodeTree(row.right)}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Draw vertical line from rows to below children */}
                            {hasSides && hasBelow && (
                                <div className="w-px h-6 bg-border flex-none" />
                            )}

                            {/* Render below children horizontally */}
                            {hasBelow && (
                                <div className="flex gap-8 relative flex-none">
                                    {belowChildren.map((child: any) => (
                                        <div 
                                            key={child.id} 
                                            className="relative pt-6 flex flex-col items-center before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-px before:h-6 before:bg-border after:content-[''] after:absolute after:top-0 after:left-0 after:right-0 after:h-px after:bg-border first:after:left-1/2 last:after:right-1/2 only:after:hidden"
                                        >
                                            {renderNodeTree(child)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>
        );
    };

    return (
        <div 
            className="flex flex-col h-full relative" 
            onClick={() => {
                setActiveMenuId(null);
                setActiveAddMenuNodeId(null);
                handleCancelInlineEdit();
            }}
        >
            <main className="flex-1 overflow-auto p-6 pb-16 space-y-6 flex flex-col min-h-0 bg-bg text-text">
                {/* Top Header bar */}
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                                <GitFork className="text-accent" size={28} />
                                Faction Diagrams
                            </h1>
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1 opacity-60">
                                Design and visualize organization structures and chart diagrams
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
                <div 
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    className={`flex-1 overflow-hidden border border-border rounded-2xl bg-card/40 relative min-h-[400px] ${
                        isDragging ? 'cursor-grabbing' : 'cursor-grab'
                    }`}
                >
                    {activeHierarchy ? (
                        <>
                            <div 
                                ref={canvasRef}
                                style={{
                                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                    transformOrigin: '0 0',
                                    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                                }}
                                className="absolute top-0 left-0 min-w-max flex flex-col items-center p-12 select-none"
                            >
                                {activeHierarchy.nodes_tree && activeHierarchy.nodes_tree.length > 0 ? (
                                    activeHierarchy.nodes_tree.map((node: any) => renderNodeTree(node))
                                ) : (
                                    <div className="text-center p-20 space-y-4">
                                        <GitFork className="text-muted/30 mx-auto" size={48} />
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted opacity-50">
                                            No diagram cards defined.
                                        </p>
                                        {editMode && activeHierarchy.user_permissions?.manage_nodes && (
                                            <button
                                                onClick={() => handleAddNode(null)}
                                                className="px-6 py-2.5 bg-accent text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition"
                                            >
                                                Create Main Card
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Floating control panel */}
                            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-card/90 border border-border p-1.5 rounded-xl shadow-lg z-30 select-none">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newScale = Math.max(0.2, scale - 0.1);
                                        setScale(newScale);
                                        setPosition(prev => clampPosition(prev.x, prev.y, newScale));
                                    }}
                                    className="p-2 hover:bg-surface text-text rounded-lg transition-colors cursor-pointer"
                                    title="Zoom Out"
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="text-[10px] font-black w-12 text-center uppercase tracking-wider text-muted">
                                    {Math.round(scale * 100)}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newScale = Math.min(2.0, scale + 0.1);
                                        setScale(newScale);
                                        setPosition(prev => clampPosition(prev.x, prev.y, newScale));
                                    }}
                                    className="p-2 hover:bg-surface text-text rounded-lg transition-colors cursor-pointer"
                                    title="Zoom In"
                                >
                                    <Plus size={14} />
                                </button>
                                <div className="w-px h-4 bg-border mx-1" />
                                <button
                                    type="button"
                                    onClick={() => centerCanvas()}
                                    className="p-2 hover:bg-surface text-text rounded-lg transition-colors cursor-pointer"
                                    title="Recenter view"
                                >
                                    <Maximize2 size={14} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center p-20 space-y-4 absolute inset-0 flex flex-col justify-center items-center">
                            <GitFork className="text-muted/20 mx-auto" size={56} />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted opacity-40">
                                Create a diagram to begin charting structures.
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
                                        handleCancelInlineEdit();
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
                                                            <Trash2 size={12} /> Remove Diagram
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
                                setTabRosterIds([]);
                                setShowCreateTabModal(true);
                            }}
                            className="p-2 text-muted hover:text-accent transition-colors cursor-pointer"
                            title="Create New Diagram"
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
                                Create Diagram
                            </h2>
                            <button type="button" onClick={() => setShowCreateTabModal(false)} className="text-muted hover:text-text">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Diagram Name</label>
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
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Link to Personnel Rosters (Optional)</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-xl p-3 bg-surface">
                                    {rosters.filter(r => !r.is_sandbox).length === 0 ? (
                                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider block py-2 px-1">No rosters available</span>
                                    ) : (
                                        rosters.filter(r => !r.is_sandbox).map(r => {
                                            const isChecked = tabRosterIds.includes(r.id);
                                            return (
                                                <label key={r.id} className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-wider text-text cursor-pointer select-none py-1 hover:text-accent transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {
                                                            if (isChecked) {
                                                                setTabRosterIds(tabRosterIds.filter(id => id !== r.id));
                                                            } else {
                                                                setTabRosterIds([...tabRosterIds, r.id]);
                                                            }
                                                        }}
                                                        className="rounded border-border text-accent focus:ring-0 bg-card cursor-pointer"
                                                    />
                                                    {r.name}
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
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
                                Diagram Settings: {activeHierarchy.name}
                            </h2>
                            <button type="button" onClick={() => setShowTabSettingsModal(false)} className="text-muted hover:text-text">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Diagram Name</label>
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
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Link to Personnel Rosters</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-xl p-3 bg-surface">
                                    {rosters.filter(r => !r.is_sandbox).length === 0 ? (
                                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider block py-2 px-1">No rosters available</span>
                                    ) : (
                                        rosters.filter(r => !r.is_sandbox).map(r => {
                                            const isChecked = tabRosterIds.includes(r.id);
                                            return (
                                                <label key={r.id} className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-wider text-text cursor-pointer select-none py-1 hover:text-accent transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {
                                                            if (isChecked) {
                                                                setTabRosterIds(tabRosterIds.filter(id => id !== r.id));
                                                            } else {
                                                                setTabRosterIds([...tabRosterIds, r.id]);
                                                            }
                                                        }}
                                                        className="rounded border-border text-accent focus:ring-0 bg-card cursor-pointer"
                                                    />
                                                    {r.name}
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
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
                                Edit Diagram Card
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

                            {selectedNode.parent_id && (
                                <div className="pt-4 border-t border-border/40">
                                    <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block mb-2 px-1">Card Position (Relative to Parent)</label>
                                    <select
                                        value={nodePosition}
                                        onChange={e => setNodePosition(e.target.value as any)}
                                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent transition-colors"
                                    >
                                        <option value="left">Left</option>
                                        <option value="below">Below</option>
                                        <option value="right">Right</option>
                                    </select>
                                    <p className="text-[9.5px] text-muted leading-relaxed px-1 mt-1.5 text-muted/80">
                                        LEFT or RIGHT positions the card directly to the side of the parent's center trunk line.
                                        BELOW centers the card at the bottom of the trunk line, below any side-positioned cards.
                                    </p>
                                </div>
                            )}

                            {/* Card Layout Style Section */}
                            <div className="space-y-3 pt-4 border-t border-border/40">
                                <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] block px-1">Card Layout Style</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <select
                                            value={nodeCardStyle}
                                            onChange={e => setNodeCardStyle(e.target.value as any)}
                                            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent transition-colors"
                                        >
                                            <option value="standard">Standard</option>
                                            <option value="spotlight">Spotlight</option>
                                            <option value="highlighted">Highlighted + Others</option>
                                        </select>
                                        <p className="text-[9.5px] text-muted leading-relaxed px-1">
                                            {nodeCardStyle === 'standard' && "STANDARD: A clean, uniform list view where all slots are rendered equally. Best for regular staff lists."}
                                            {nodeCardStyle === 'spotlight' && "SPOTLIGHT: Focuses on a single leader or director (first slot) with a centered profile layout and large font size."}
                                            {nodeCardStyle === 'highlighted' && "HIGHLIGHTED + OTHERS: Emphasizes the primary/senior role (first slot) with a larger highlighted layout, and lists assistants or other staff below in a smaller font."}
                                        </p>
                                    </div>
                                    
                                    {/* HTML Live Preview Box */}
                                    <div className="bg-surface/50 border border-border rounded-xl p-3 flex flex-col justify-center items-center min-h-[120px] relative overflow-hidden">
                                        <span className="absolute top-2 right-2 text-[8px] font-black text-muted uppercase tracking-widest opacity-60">Live Preview</span>
                                        <div className="w-full max-w-[240px] mt-4">
                                            {nodeCardStyle === 'standard' && (
                                                <div className="w-full bg-card rounded-xl border border-border shadow-md overflow-hidden" style={{ borderTop: `4px solid ${nodeColor || '#2563eb'}` }}>
                                                    <div className="px-4 py-2 bg-surface/40 border-b border-border text-[9px] font-black uppercase text-text">Standard Team</div>
                                                    <div className="p-3 space-y-1.5">
                                                        <div className="flex justify-between items-center text-[9px]">
                                                            <span className="font-black text-muted uppercase tracking-wider">OFFICER</span>
                                                            <span className="font-bold text-text uppercase tracking-widest">JOHN DOE</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[9px] border-t border-border/20 pt-1.5">
                                                            <span className="font-black text-muted uppercase tracking-wider">OFFICER</span>
                                                            <span className="font-bold text-text uppercase tracking-widest">JANE SMITH</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {nodeCardStyle === 'spotlight' && (
                                                <div className="w-full bg-card rounded-xl border border-border shadow-md overflow-hidden text-center p-4" style={{ borderTop: `4px solid ${nodeColor || '#2563eb'}` }}>
                                                    {nodeImageUrl ? (
                                                        <img src={nodeImageUrl} className="w-10 h-10 rounded-full border border-border object-cover mb-2 mx-auto shadow-sm" alt="Preview Spotlight" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mb-2 mx-auto">
                                                            {React.createElement(ICON_MAP[nodeIcon] || Users, { size: 16, className: 'text-accent' })}
                                                        </div>
                                                    )}
                                                    <div className="text-[9px] font-black text-accent uppercase tracking-widest bg-accent/10 px-2.5 py-0.5 rounded-full inline-block mb-1">DIRECTOR</div>
                                                    <div className="text-xs font-black text-text uppercase tracking-widest">CHASE DELGADO</div>
                                                </div>
                                            )}
                                            {nodeCardStyle === 'highlighted' && (
                                                <div className="w-full bg-card rounded-xl border border-border shadow-md overflow-hidden" style={{ borderTop: `4px solid ${nodeColor || '#2563eb'}` }}>
                                                    <div className="px-4 py-2 bg-surface/40 border-b border-border text-[9px] font-black uppercase text-text">Highlighted + Others</div>
                                                    <div className="p-3">
                                                        <div className="bg-accent/5 p-2 rounded-lg border border-accent/10 mb-2 flex justify-between items-center">
                                                            <span className="text-[10px] font-black text-accent uppercase tracking-wider">PRIMARY ROLE</span>
                                                            <span className="text-xs font-black text-text uppercase tracking-widest">JANE DOE</span>
                                                        </div>
                                                        <div className="space-y-1 pl-1">
                                                            <div className="flex justify-between items-center text-[8px]">
                                                                <span className="font-bold text-muted uppercase tracking-wider">OTHER STAFF</span>
                                                                <span className="font-bold text-text uppercase tracking-widest">JOHN SMITH</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[8px] border-t border-border/20 pt-1">
                                                                <span className="font-bold text-muted uppercase tracking-wider">OTHER STAFF</span>
                                                                <span className="font-bold text-text uppercase tracking-widest">BOB JOHNSON</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Spotlight Customization Section */}
                            {nodeCardStyle === 'spotlight' && (
                                <div className="space-y-3 pt-4 border-t border-border/40 animate-in fade-in duration-200">
                                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-accent block px-1">Spotlight Customization</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5">Spotlight Image URL</label>
                                            <input
                                                type="text"
                                                value={nodeImageUrl}
                                                onChange={e => setNodeImageUrl(e.target.value)}
                                                placeholder="e.g. https://example.com/avatar.jpg"
                                                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-[10px] font-bold outline-none focus:border-accent transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-black text-muted uppercase tracking-[0.2em] block mb-1.5 px-0.5">Custom Spotlight Icon</label>
                                            <div className="grid grid-cols-5 gap-1.5 p-1.5 bg-surface border border-border rounded-xl">
                                                {Object.keys(ICON_MAP).map(iconKey => {
                                                    const Icon = ICON_MAP[iconKey];
                                                    const isSelected = nodeIcon === iconKey;
                                                    return (
                                                        <button
                                                            key={iconKey}
                                                            type="button"
                                                            onClick={() => setNodeIcon(iconKey)}
                                                            className={`p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                                                isSelected 
                                                                    ? 'bg-accent/10 text-accent border border-accent/20' 
                                                                    : 'text-muted hover:text-text hover:bg-card/50 border border-transparent'
                                                            }`}
                                                            title={iconKey.toUpperCase()}
                                                        >
                                                            <Icon size={14} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Card Slots / Auto-Link toggle */}
                            {activeHierarchy?.roster_ids && activeHierarchy.roster_ids.length > 0 && (
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
                                                                placeholder={isConnected ? "Linked to Roster Member" : "e.g. Captain"}
                                                                disabled={isConnected}
                                                                title={isConnected ? "Linked to roster. Edit via roster page." : undefined}
                                                                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:bg-surface/50 disabled:cursor-not-allowed"
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
                                                                placeholder={isConnected ? "Linked to Roster Member" : "e.g. Chase Delgado or VACANT"}
                                                                disabled={isConnected}
                                                                title={isConnected ? "Linked to roster. Edit via roster page." : undefined}
                                                                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:bg-surface/50 disabled:cursor-not-allowed"
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
                                                    {activeHierarchy?.roster_ids && activeHierarchy.roster_ids.length > 0 && (
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

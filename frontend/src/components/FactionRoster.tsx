import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { Roster as RosterType } from '../types';
import { Plus, Pencil, MoreVertical, Layout, GripVertical, ChevronLeft, ChevronRight, Trash2, ShieldAlert, Shield, Settings2, Database, Menu, Flag, FileCode2, Calculator, Minus, X, Clock, Sparkles } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { SyncGridRow } from './SyncGridRow';
import RosterLayoutModal from './RosterLayoutModal';
import SectionLayoutModal from './SectionLayoutModal';
import GlobalVariablesModal from './GlobalVariablesModal';
import FlagManagerModal from './FlagManagerModal';
import { RosterPermissionsModal } from './RosterPermissionsModal';
import { ColumnsModal } from './ColumnsModal';
import { RosterTemplateModal } from './RosterTemplateModal';
import { CountManagerModal } from './CountManagerModal';
import { hexToRgb } from '../utils';
import { useRosterRealtime } from '../hooks/useRosterRealtime';

interface FactionRosterProps {
    user: any;
    isDark: boolean;
    activeDivision: any;
    totalMembers: number;
    rosters: any[];
    setRosters: (rosters: any[]) => void;
    activeDivId: number | null;
    setActiveDivId: (id: number | null) => void;
    permissions: string[];
    shortname: string | undefined;
    fetchRosters: () => Promise<void>;
    datasets: any[];
    recordData: any[];
    flags: any[];
    onlineUsers?: any[];
    isSandbox?: boolean;
    mainRosters?: any[];
}

const FactionRoster: React.FC<FactionRosterProps> = ({ 
    user,
    isDark,
    activeDivision, 
    totalMembers, 
    rosters, 
    setRosters, 
    activeDivId, 
    setActiveDivId, 
    permissions, 
    shortname, 
    fetchRosters, 
    datasets, 
    recordData, 
    flags,
    onlineUsers = [],
    isSandbox = false,
    mainRosters = []
}) => {
  const navigate = useNavigate();
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

  const targetRosters = isSandbox ? [...rosters, ...mainRosters] : rosters;
  const activeFlagsList = isSandbox ? [] : flags;

  const [showSandboxIntro, setShowSandboxIntro] = useState(false);
  useEffect(() => {
    if (isSandbox && !localStorage.getItem('sandbox-intro-dismissed')) {
      setShowSandboxIntro(true);
    } else {
      setShowSandboxIntro(false);
    }
  }, [isSandbox]);
  const canCreate = isSandbox ? true : permissions.includes('create_roster');
  const canModifyVariables = isSandbox ? false : permissions.includes('modify_roster_variables');
  const canModifyFlags = isSandbox ? false : permissions.includes('modify_roster_flags');
  const isGlobalMod = permissions.includes('global_roster_moderation');
  
  const rosterPerms = activeDivision?.user_roster_permissions || {};
  const canModerate = isGlobalMod || rosterPerms.modify_roster || rosterPerms.add_sections || rosterPerms.remove_sections || rosterPerms.manage_columns || rosterPerms.manage_layout;
  const canAddSections = isGlobalMod || rosterPerms.add_sections;

  const [scaling, setScaling] = useState(() => {
    const saved = localStorage.getItem('roster-scaling');
    const val = saved ? parseInt(saved) : 100;
    return Math.min(130, Math.max(80, val));
  });

  useEffect(() => {
    localStorage.setItem('roster-scaling', scaling.toString());
  }, [scaling]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState<any | null>(null);
  const [showSectionColumnsModal, setShowSectionColumnsModal] = useState<any | null>(null);
  const [showSectionLayoutModal, setShowSectionLayoutModal] = useState<any | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState<RosterType | null>(null);
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const [showFlagsModal, setShowFlagsModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showLayoutModal, setShowLayoutModal] = useState<RosterType | null>(null);
  const [showCountsModal, setShowCountsModal] = useState<any | null>(null);
  const [showRosterContextMenu, setShowRosterContextMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [globalEditingRowId, setGlobalEditingRowId] = useState<number | null>(null);
  const [globalSaveTrigger, setGlobalSaveTrigger] = useState(0);

  // Real-time integration (Reverb)
  const { presenceUsers } = useRosterRealtime({
    factionId: activeDivision?.faction_id,
    rosterId: activeDivision?.id,
    onRowUpdated: (updatedRow) => {
        setRosters(prevRosters => {
            return prevRosters.map(roster => {
                if (roster.id !== activeDivision?.id) return roster;
                
                const updateSection = (sections: any[]): any[] => {
                    return sections.map(section => {
                        const newContents = (section.contents || []).map((content: any) => 
                            content.id === updatedRow.id ? { ...content, ...updatedRow } : content
                        );
                        
                        const newChildren = section.children ? updateSection(section.children) : section.children;
                        
                        return { ...section, contents: newContents, children: newChildren };
                    });
                };

                return {
                    ...roster,
                    root_sections: updateSection(roster.root_sections || [])
                };
            });
        });
    },
    onRowAdded: () => {
        // For now, simpler to re-fetch on add/delete to ensure correct ordering/placement
        fetchRosters();
    },
    onRowDeleted: () => {
        fetchRosters();
    },
    onRosterUpdated: () => {
        fetchRosters();
    }
  });

  const allContents = useMemo(() => {
    const contents: any[] = [];
    rosters.forEach(r => {
        if (!r) return;
        const getSectionContents = (sec: any): any[] => {
            if (!sec) return [];
            let items = (sec.contents || []).map((c: any) => ({ ...c, roster_id: r.id }));
            if (sec.children && Array.isArray(sec.children)) {
                sec.children.forEach((child: any) => {
                    items = [...items, ...getSectionContents(child)];
                });
            }
            return items;
        };
        (r.root_sections || []).forEach((s: any) => {
            contents.push(...getSectionContents(s));
        });
    });
    return contents;
  }, [rosters]);

  const allColumns = useMemo(() => {
    const colsMap = new Map<string, any>();
    rosters.forEach(r => {
        if (!r) return;
        (r.columns || []).forEach((c: any) => {
            colsMap.set(c.id, c);
        });
        const checkSections = (sections: any[]) => {
            sections.forEach(s => {
                (s.columns || []).forEach((c: any) => {
                    colsMap.set(c.id, c);
                });
                if (s.children) checkSections(s.children);
            });
        };
        checkSections(r.root_sections || []);
    });
    return colsMap;
  }, [rosters]);

  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0 });
  
  const [newRoster, setNewRoster] = useState({ id: null as number | null, name: '', shortname: '', color: '#3b82f6' });
  
  const [sectionData, setSectionData] = useState({
    id: null as number | null,
    roster_id: null as number | null,
    name: '',
    shortname: '',
    color: '',
    image_url: '',
    type: 'section' as 'master' | 'section' | 'subsection' | 'content',
    data_source: 'manual' as 'manual' | 'dynamic',
    parent_id: null as number | null,
    columns: null as any[] | null,
    use_roster_columns: true,
    children: [] as any[],
    layout_settings: null as any,
    section_options: null as any,
    subsections_per_row: 1,
    content_html: '' as string | null
  });
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const loadToast = toast.loading(newRoster.id ? 'Saving roster...' : 'Creating roster...');
    try {
      if (newRoster.id) {
        await api.put(`/rosters/${newRoster.id}`, newRoster);
        toast.success('Roster updated', { id: loadToast });
      } else {
        await api.post(`/factions/${shortname}/rosters`, {
          ...newRoster,
          is_sandbox: isSandbox
        });
        toast.success('Roster created', { id: loadToast });
      }
      await fetchRosters();
      setShowCreateModal(false);
      setNewRoster({ id: null, name: '', shortname: '', color: '#3b82f6' });
    } catch (err) {
      toast.error('Failed to save roster', { id: loadToast });
      console.error('Failed to save roster', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReorderRows = async (sectionId: number, newOrder: any[]) => {
    // Optimistically update local state
    const newRosters = [...rosters];
    let found = false;

    const updateSectionContents = (sections: any[]) => {
      for (const s of sections) {
        if (s.id === sectionId) {
          s.contents = newOrder;
          found = true;
          return true;
        }
        if (s.children && updateSectionContents(s.children)) return true;
      }
      return false;
    };

    for (const r of newRosters) {
      if (updateSectionContents(r.root_sections || [])) break;
    }

    if (found) {
        setRosters(newRosters);
    }

    // Persist to backend
    try {
      await api.put(`/sections/${sectionId}/contents/reorder`, {
        content_ids: newOrder.map(c => c.id)
      });
    } catch (err) {
        toast.error('Failed to save row order');
        fetchRosters(); // Revert on failure
    }
  };

  const handleEditRoster = (roster: any) => {
    setNewRoster({
      id: roster.id,
      name: roster.name,
      shortname: roster.shortname,
      color: roster.color
    });
    setShowCreateModal(true);
    setActiveMenuId(null);
  };

  const handleReorder = async (newOrder: any[]) => {
    setRosters(newOrder);
    try {
        await api.put(`/factions/${shortname}/rosters/reorder`, {
            roster_ids: newOrder.map(r => r.id)
        });
        toast.success('Order saved');
    } catch (err) {
        toast.error('Failed to save order');
        console.error('Failed to reorder rosters', err);
    }
  };

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const loadToast = toast.loading(sectionData.id ? 'Saving section...' : 'Creating section...');
    try {
      if (sectionData.id) {
        await api.put(`/sections/${sectionData.id}`, sectionData);
        toast.success('Section updated', { id: loadToast });
      } else {
        const rosterId = sectionData.roster_id || activeDivId;
        await api.post(`/rosters/${rosterId}/sections`, sectionData);
        toast.success('Section created', { id: loadToast });
      }
      await fetchRosters();
      setShowSectionModal(false);
      setSectionData({ 
        id: null, 
        roster_id: null,
        name: '', 
        shortname: '', 
        color: '', 
        image_url: '',
        type: 'section', 
        data_source: 'manual',
        parent_id: null, 
        columns: null, 
        use_roster_columns: true,
        children: [], 
        layout_settings: null, 
        section_options: null,
        subsections_per_row: 1,
        content_html: '' 
      });
    } catch (err) {
      toast.error('Failed to save section', { id: loadToast });
      console.error('Failed to save section', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const roster = rosters.find(r => r.id === id);
    if (!roster) return;

    toast((t) => (
      <div className="flex flex-col gap-1 text-left">
        <p className="font-bold">Delete roster "{roster.name}"?</p>
        <p className="text-[10px] opacity-80 uppercase tracking-tighter">This action cannot be undone and will delete all sections and contents.</p>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1 bg-surface hover:bg-bg border border-border rounded text-[9px] font-bold uppercase transition">Cancel</button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              const loadToast = toast.loading('Deleting roster...');
              try {
                await api.delete(`/rosters/${id}`);
                toast.success('Roster deleted', { id: loadToast });
                await fetchRosters();
                setActiveMenuId(null);
              } catch (err) {
                toast.error('Failed to delete roster', { id: loadToast });
                console.error('Failed to delete roster', err);
              }
            }}
            className="px-2 py-1 bg-danger text-white hover:bg-danger/90 rounded text-[9px] font-bold uppercase transition shadow-lg shadow-danger/20"
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const handleDeleteSection = async (id: number) => {
    toast((t) => (
      <div className="flex flex-col gap-1 text-left">
        <p className="font-bold">Delete this section?</p>
        <p className="text-[10px] opacity-80 uppercase tracking-tighter">This action cannot be undone and will delete all content within this section.</p>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1 bg-surface hover:bg-bg border border-border rounded text-[9px] font-bold uppercase transition">Cancel</button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              const loadToast = toast.loading('Deleting section...');
              try {
                await api.delete(`/sections/${id}`);
                toast.success('Section deleted', { id: loadToast });
                await fetchRosters();
                setShowSectionModal(false);
              } catch (err) {
                toast.error('Failed to delete section', { id: loadToast });
                console.error('Failed to delete section', err);
              }
            }}
            className="px-2 py-1 bg-danger text-white hover:bg-danger/90 rounded text-[9px] font-bold uppercase transition shadow-lg shadow-danger/20"
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const handleAddChildSection = (parentId: number) => {
    let parentRosterId = activeDivId;
    if (activeDivision?.root_sections) {
      const findParent = (sections: any[]): any => {
        for (const s of sections) {
          if (s.id === parentId) return s;
          if (s.children) {
            const found = findParent(s.children);
            if (found) return found;
          }
        }
        return null;
      };
      const parent = findParent(activeDivision.root_sections);
      if (parent) parentRosterId = parent.roster_id;
    }

    setSectionData({
        id: null,
        roster_id: parentRosterId,
        name: '',
        shortname: '',
        color: '',
        image_url: '',
        type: 'section',
        data_source: 'manual',
        parent_id: parentId,
        columns: null,
        use_roster_columns: true,
        children: [],
        layout_settings: null,
        section_options: null,
        subsections_per_row: 1,
        content_html: ''
    });
    setShowSectionModal(true);
  };

  const handleEditSection = (section: any) => {
    setSectionData({
        id: section.id,
        roster_id: section.roster_id,
        name: section.name,
        shortname: section.shortname,
        color: section.color || '',
        image_url: section.image_url || '',
        type: section.type,
        data_source: section.data_source || 'manual',
        parent_id: section.parent_id,
        columns: section.columns,
        use_roster_columns: section.use_roster_columns !== undefined ? !!section.use_roster_columns : true,
        children: Array.isArray(section.children) ? section.children : [],
        layout_settings: section.layout_settings,
        section_options: section.section_options || {},
        subsections_per_row: section.subsections_per_row || 1,
        content_html: section.content_html || ''
    });
    setShowSectionModal(true);
  };

  const calculateCount = (count: any, scope: 'roster' | 'section', targetSection?: any): string => {
    // Helper to get all contents for a section recursively
    const getSectionContents = (sec: any): any[] => {
        let items = [...(sec.contents || [])];
        if (sec.children && Array.isArray(sec.children)) {
            sec.children.forEach((child: any) => {
                items = [...items, ...getSectionContents(child)];
            });
        }
        return items;
    };

    const getSingleValue = (c: any): number => {
        // New Formula Evaluation Logic with Bracket Support
        if (c.conditions && Array.isArray(c.conditions)) {
            let result = 0;
            const stack: { result: number; operator: string }[] = [];
            let isFirst = true;

            const applyOp = (base: number, next: number, op: string): number => {
                if (op === '+') return base + next;
                if (op === '-') return base - next;
                if (op === '*') return base * next;
                if (op === '/') return next === 0 ? 0 : base / next;
                if (op === 'AND') return Math.min(base, next);
                if (op === 'OR') return Math.max(base, next);
                return next;
            };

            c.conditions.forEach((cond: any, idx: number) => {
                // 1. Handle Opening Brackets
                const openCount = parseInt(cond.brackets_open || 0);
                for (let i = 0; i < openCount; i++) {
                    stack.push({ result, operator: isFirst ? '+' : cond.operator || '+' });
                    result = 0;
                    isFirst = true;
                }

                let condMatchedValue = 0;

                if (cond.type === 'value') {
                    condMatchedValue = parseFloat(cond.settings?.value || 0);
                } else if (cond.type === 'count') {
                    // Support referencing other counters by ID
                    const otherCounts = scope === 'roster' ? (activeDivision.counts || []) : (targetSection?.counts || []);
                    const targetCount = otherCounts.find((item: any) => String(item.id) === String(cond.settings?.count_id));
                    if (targetCount) {
                        condMatchedValue = Number(calculateCount(targetCount, scope, targetSection));
                    }
                } else {
                    // ... (rest of the pool determination and filtering logic)
                    let condPool: any[] = [];
                    const condScope = cond.scope || 'default';

                    if (condScope === 'roster') {
                        condPool = allContents.filter(item => item.roster_id === activeDivId);
                    } else if (condScope === 'specific_sections') {
                        const sIds = (cond.section_ids || []).map((id: any) => Number(id));
                        condPool = allContents.filter(item => sIds.includes(Number(item.section_id)));
                    } else if (condScope === 'section') {
                        condPool = targetSection ? getSectionContents(targetSection) : allContents.filter(item => item.roster_id === activeDivId);
                    } else {
                        // Default legacy behavior
                        if (scope === 'roster') {
                            condPool = allContents.filter(item => item.roster_id === activeDivId);
                        } else {
                            condPool = targetSection ? getSectionContents(targetSection) : [];
                        }
                    }

                    if (cond.settings?.exclude_spacers) {
                        condPool = condPool.filter(item => item.type !== 'spacer');
                    }

                    // 2. Filter the pool by the condition rule
                    const matchedRows = condPool.filter(row => {
                        const content = row.content || {};

                        if (cond.type === 'rows') {
                            if (!cond.settings?.target_col) return true;
                            
                            // 1. Find the column ID in THIS roster that matches the target column name
                            const targetColName = cond.settings.target_col; // Now storing name as ID
                            const rosterCols = rosters.find((r: any) => r.id === (row.roster_id || activeDivId))?.columns || [];
                            
                            // Find section-specific columns if the section doesn't use roster columns
                            let currentCols = rosterCols;
                            const findSection = (sections: any[]): any => {
                                for (const s of sections) {
                                    if (s.id === row.section_id) return s;
                                    if (s.children) {
                                        const found = findSection(s.children);
                                        if (found) return found;
                                    }
                                }
                                return null;
                            };
                            const roster = rosters.find((r: any) => r.id === (row.roster_id || activeDivId));
                            const section = roster ? findSection(roster.root_sections || []) : null;
                            if (section && !section.use_roster_columns && section.columns) {
                                currentCols = section.columns;
                            }

                            const col = currentCols.find((c: any) => c.name === targetColName || c.id === targetColName);
                            if (!col) return false;

                            const rawVal = col.type === 'autofill' ? (col.autofill_value || '') : content[col.id];
                            
                            const disregardEmpty = cond.settings.disregard_empty !== undefined ? cond.settings.disregard_empty : true;
                            if (rawVal === null || rawVal === undefined || rawVal === '') {
                                return disregardEmpty ? false : true;
                            }

                            // Resolve ID to label if it matches a dataset option
                            let label = rawVal.toString();
                            if (col && col.dataset_id) {
                                const dataset = datasets.find(d => d.id === col.dataset_id);
                                const option = dataset?.options?.find((o: any) => String(o.id) === String(rawVal));
                                if (option) label = option.value;
                            }

                            const val = label.trim().toLowerCase();
                            const matchVal = (cond.settings.match_value || '').toString().trim().toLowerCase();
                            
                            if (cond.settings.match_type === 'exists') return !!val;
                            if (cond.settings.match_type === 'equals') return val === matchVal;
                            if (cond.settings.match_type === 'not_equals') return val !== matchVal;
                            if (cond.settings.match_type === 'contains') return val.includes(matchVal);
                            if (cond.settings.match_type === 'is_null') return !rawVal || rawVal === '';
                            return true;
                        }

                        if (cond.type === 'flags') {
                            if (!cond.settings?.flag_id) return false;
                            const flag = activeFlagsList.find(f => f.id === cond.settings.flag_id);
                            if (!flag) return false;
                            
                            const rosterCols = rosters.find((r: any) => r.id === (row.roster_id || activeDivId))?.columns || [];
                            return rosterCols.some((col: any) => {
                                if (!(col.flags || []).includes(flag.id)) return false;
                                const val = (col.type === 'autofill' ? (col.autofill_value || '') : (content[col.id] || '')).toString().toLowerCase().trim();
                                if (!val) return false;
                                return (flag.rules || []).some((rule: any) => {
                                    if (rule.type === 'equals') return val === (rule.value || '').toString().toLowerCase().trim();
                                    if (rule.type === 'contains') return val.includes((rule.value || '').toString().toLowerCase().trim());
                                    if (rule.type === 'exists_elsewhere') {
                                        if (val === '' || val === '-' || val.startsWith('?')) return false;
                                        const otherPool = rule.scope === 'global' ? allContents : allContents.filter(item => item.roster_id === row.roster_id);
                                        return otherPool.some(item => item.id !== row.id && Object.entries(item.content || {}).some(([k, v]) => {
                                            if (k.endsWith('_cb') || k.endsWith('_tags')) return false;
                                            const otherVal = (v || '').toString().toLowerCase().trim();
                                            return otherVal === val && otherVal !== '' && otherVal !== '-' && !otherVal.startsWith('?');
                                        }));
                                    }
                                    return false;
                                });
                            });
                        }

                        if (cond.type === 'checkboxes') {
                            if (!cond.settings?.target_col || !cond.settings?.checkbox_label) return false;
                            
                            // Find matching column by name
                            const targetColName = cond.settings.target_col;
                            const rosterCols = rosters.find((r: any) => r.id === (row.roster_id || activeDivId))?.columns || [];
                            const col = rosterCols.find((c: any) => c.name === targetColName || c.id === targetColName);
                            if (!col) return false;

                            const rowCheckboxes = row.content?.[`${col.id}_cb`] || [];
                            const rowTags = row.content?.[`${col.id}_tags`] || [];
                            return rowCheckboxes.includes(cond.settings.checkbox_label) || rowTags.includes(cond.settings.checkbox_label);
                        }

                        if (cond.type === 'tags') {
                            if (!cond.settings?.target_col || !cond.settings?.checkbox_label) return false;
                            
                            // Find matching column by name
                            const targetColName = cond.settings.target_col;
                            const rosterCols = rosters.find((r: any) => r.id === (row.roster_id || activeDivId))?.columns || [];
                            const col = rosterCols.find((c: any) => c.name === targetColName || c.id === targetColName);
                            if (!col) return false;

                            const rowTags = row.content?.[`${col.id}_tags`] || [];
                            return rowTags.includes(cond.settings.checkbox_label);
                        }

                        return false;
                    });
                    if (cond.settings?.count_unique && cond.settings?.target_col) {
                        const targetColName = cond.settings.target_col;
                        const values = matchedRows.map(r => {
                            const rosterCols = rosters.find((re: any) => re.id === (r.roster_id || activeDivId))?.columns || [];
                            let currentCols = rosterCols;
                            const findSection = (sections: any[]): any => {
                                for (const s of sections) {
                                    if (s.id === r.section_id) return s;
                                    if (s.children) {
                                        const found = findSection(s.children);
                                        if (found) return found;
                                    }
                                }
                                return null;
                            };
                            const roster = rosters.find((re: any) => re.id === (r.roster_id || activeDivId));
                            const section = roster ? findSection(roster.root_sections || []) : null;
                            if (section && !section.use_roster_columns && section.columns) {
                                currentCols = section.columns;
                            }

                            const col = currentCols.find((c: any) => c.name === targetColName || c.id === targetColName);
                            if (!col) return null;

                            const rawVal = col.type === 'autofill' ? (col.autofill_value || '') : r.content?.[col.id];
                            if (rawVal === null || rawVal === undefined || rawVal === '') return null;

                            let label = rawVal.toString();
                            if (col && col.dataset_id) {
                                const dataset = datasets.find(d => d.id === col.dataset_id);
                                const option = dataset?.options?.find((o: any) => String(o.id) === String(rawVal));
                                if (option) label = option.value;
                            }
                            return label.trim().toLowerCase();
                        }).filter(val => val !== null && val !== '');
                        
                        condMatchedValue = new Set(values).size;
                    } else {
                        condMatchedValue = matchedRows.length;
                    }
                }

                // 3. Combine using operator sequentially
                if (isFirst) {
                    result = condMatchedValue;
                    isFirst = false;
                } else {
                    result = applyOp(result, condMatchedValue, cond.operator || '+');
                }

                // 4. Handle Closing Brackets
                const closeCount = parseInt(cond.brackets_close || 0);
                for (let i = 0; i < closeCount; i++) {
                    if (stack.length > 0) {
                        const { result: prevResult, operator: prevOp } = stack.pop()!;
                        result = applyOp(prevResult, result, prevOp);
                        isFirst = false;
                    }
                }
            });

            return Math.max(0, result);
        }

        // Legacy Logic Fallback
        let pool: any[] = [];
        if (scope === 'roster') {
            pool = allContents.filter(c => c.roster_id === activeDivId);
        } else {
            pool = getSectionContents(targetSection);
        }

        if (c.type === 'sum') {
            const otherCounts = scope === 'roster' ? (activeDivision.counts || []) : (targetSection.counts || []);
            const toSum = otherCounts.filter((item: any) => c.settings.sum_ids?.includes(item.id));
            return toSum.reduce((acc: number, cur: any) => acc + Number(calculateCount(cur, scope, targetSection)), 0);
        }

        return pool.filter(row => {
            const content = row.content || {};
            
            if (c.type === 'rows') {
                if (!c.settings.target_col) return true;
                const rosterCols = rosters.find((r: any) => r.id === (row.roster_id || activeDivId))?.columns || [];
                const col = rosterCols.find((colItem: any) => colItem.id === c.settings.target_col);
                const rawVal = col?.type === 'autofill' ? (col.autofill_value || '') : content[c.settings.target_col];
                if (rawVal === null || rawVal === undefined || rawVal === '') {
                    return c.settings.disregard_empty ? false : true;
                }

                // Resolve ID to label if it matches a dataset option
                let label = rawVal.toString();
                if (col && col.dataset_id) {
                    const dataset = datasets.find(d => d.id === col.dataset_id);
                    const option = dataset?.options?.find((o: any) => String(o.id) === String(rawVal));
                    if (option) label = option.value;
                }

                const val = label.trim();
                
                if (c.settings.match_type === 'exists') return !!val;
                if (c.settings.match_type === 'equals') return val.toLowerCase() === (c.settings.match_value || '').toString().toLowerCase().trim();
                if (c.settings.match_type === 'contains') return val.toLowerCase().includes((c.settings.match_value || '').toString().toLowerCase().trim());
                return true;
            }

            if (c.type === 'flags') {
                if (!c.settings.flag_id) return false;
                const flag = activeFlagsList.find(f => f.id === c.settings.flag_id);
                if (!flag) return false;
                
                const rosterCols = rosters.find((r: any) => r.id === (row.roster_id || activeDivId))?.columns || [];
                return rosterCols.some((col: any) => {
                    if (!(col.flags || []).includes(flag.id)) return false;
                    const val = (content[col.id] || '').toString().toLowerCase().trim();
                    if (!val) return false;
                    return (flag.rules || []).some((rule: any) => {
                        if (rule.type === 'equals') return val === (rule.value || '').toString().toLowerCase().trim();
                        if (rule.type === 'contains') return val.includes((rule.value || '').toString().toLowerCase().trim());
                        if (rule.type === 'exists_elsewhere') {
                            if (val === '' || val === '-' || val.startsWith('?')) return false;
                            const otherPool = rule.scope === 'global' ? allContents : allContents.filter(item => item.roster_id === row.roster_id);
                            return otherPool.some(item => item.id !== row.id && Object.entries(item.content || {}).some(([k, v]) => {
                                if (k.endsWith('_cb') || k.endsWith('_tags')) return false;
                                const otherVal = (v || '').toString().toLowerCase().trim();
                                return otherVal === val && otherVal !== '' && otherVal !== '-' && !otherVal.startsWith('?');
                            }));
                        }
                        return false;
                    });
                });
            }

            if (c.type === 'checkboxes') {
                if (!c.settings.target_col || !c.settings.checkbox_label) return false;
                const rowCheckboxes = row.content?.[`${c.settings.target_col}_cb`] || [];
                const rowTags = row.content?.[`${c.settings.target_col}_tags`] || [];
                return rowCheckboxes.includes(c.settings.checkbox_label) || rowTags.includes(c.settings.checkbox_label);
            }

            if (c.type === 'tags') {
                if (!c.settings.target_col || !c.settings.checkbox_label) return false;
                const rowTags = row.content?.[`${c.settings.target_col}_tags`] || [];
                return rowTags.includes(c.settings.checkbox_label);
            }

            return false;
        }).length;
    };

    const formatValue = (val: number, shouldRound?: boolean): string => {
        if (shouldRound) return String(Math.round(val));
        if (Number.isInteger(val)) return String(val);
        return parseFloat(val.toFixed(2)).toString();
    };

    const primaryValue = getSingleValue(count);
    if (count.secondary_count_id) {
        const secondaryCount = (scope === 'roster' ? activeDivision.counts : targetSection?.counts)?.find((item: any) => String(item.id) === String(count.secondary_count_id));
        if (secondaryCount) {
            const secondaryValue = getSingleValue(secondaryCount);
            if (count.show_percentage) {
                const percentage = secondaryValue === 0 ? 0 : (primaryValue / secondaryValue) * 100;
                return `${formatValue(primaryValue, count.should_round)} (${formatValue(percentage, count.should_round)}%)`;
            }
            return `${formatValue(primaryValue, count.should_round)} / ${formatValue(secondaryValue, secondaryCount.should_round)}`;
        }
    }
    return formatValue(primaryValue, count.should_round);
  };

  const handleUpdateRowLocal = (rowId: number, data: any) => {
    const updateSections = (sections: any[]): { sections: any[]; found: boolean } => {
      let found = false;
      const newSections = sections.map(s => {
        if (s.contents) {
          const idx = s.contents.findIndex((c: any) => c.id === rowId);
          if (idx !== -1) {
            found = true;
            const newContents = [...s.contents];
            newContents[idx] = {
              ...newContents[idx],
              content: data.content,
              color: data.color,
              updated_at: new Date().toISOString()
            };
            return { ...s, contents: newContents };
          }
        }
        if (s.children && s.children.length > 0) {
          const res = updateSections(s.children);
          if (res.found) {
            found = true;
            return { ...s, children: res.sections };
          }
        }
        return s;
      });
      return { sections: newSections, found };
    };

    let foundGlobal = false;
    const newRosters = rosters.map(r => {
      if (!r.root_sections) return r;
      const res = updateSections(r.root_sections);
      if (res.found) {
        foundGlobal = true;
        return { ...r, root_sections: res.sections };
      }
      return r;
    });

    if (foundGlobal) {
      setRosters(newRosters);
    }
  };

  return (
    <div 
        className="flex flex-col h-full relative" 
        onClick={() => setActiveMenuId(null)}
        style={{
            '--accent': activeDivision?.color,
            '--accent-rgb': activeDivision?.color?.startsWith('#') ? hexToRgb(activeDivision.color) : undefined
        } as React.CSSProperties}
    >
      <main className="main flex-1 overflow-auto p-5 pb-16" style={{ zoom: scaling / 100 }}>
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeDivId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center"
          >
            {activeDivision ? (
              <div className="div-top-section w-full flex flex-col items-center">
                <div className="div-hero w-full flex items-center p-1.5 pl-10 border border-border border-b-0 bg-card rounded-t-lg relative gap-2.5 h-[34px]">
                  <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg" style={{ backgroundColor: activeDivision.color }} />
                  <div className="flex-1 text-center text-text font-extrabold text-[15px] uppercase tracking-tighter">
                    {activeDivision.name}
                  </div>
                  
                  <div className="flex items-center gap-6 pr-4 h-full shrink-0">
                    {/* Online Viewers */}
                    <div className="flex items-center -space-x-1.5">
                        {(() => {
                            const activeViewers = presenceUsers;
                            const displayViewers = activeViewers.slice(0, 3);
                            const remainingCount = activeViewers.length - 3;
                            
                            return (
                                <>
                                    {displayViewers.map(u => (
                                        <div 
                                            key={u.id} 
                                            className="relative group/avatar"
                                        >
                                            <div 
                                                className="w-[18px] h-[18px] rounded-full border-[1.5px] bg-card overflow-hidden transition-transform group-hover/avatar:-translate-y-0.5 shadow-sm"
                                                style={{ borderColor: u.color || 'var(--border)' }}
                                            >
                                                <img 
                                                    src={`https://ui-avatars.com/api/?name=${u.username}&background=random&color=fff&size=40`} 
                                                    alt={u.username}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-1.5 py-0.5 bg-black text-white text-[7px] font-bold uppercase rounded opacity-0 group-hover/avatar:opacity-100 transition-opacity whitespace-nowrap z-[100] pointer-events-none shadow-xl border border-white/10">
                                                {u.username}
                                            </div>
                                        </div>
                                    ))}
                                    {remainingCount > 0 && (
                                        <div 
                                            className="w-[18px] h-[18px] rounded-full border-[1.5px] border-border bg-surface flex items-center justify-center shadow-sm relative z-10 group/more"
                                            title={`${remainingCount} more users viewing`}
                                        >
                                            <span className="text-[7px] font-black text-muted">+{remainingCount}</span>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-1.5 py-0.5 bg-black text-white text-[7px] font-bold uppercase rounded opacity-0 group-hover/more:opacity-100 transition-opacity whitespace-nowrap z-[100] pointer-events-none shadow-xl border border-white/10">
                                                {activeViewers.slice(3).map(u => u.username).join(', ')}
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>

                    {/* Integrated Roster Counts */}
                    <div className="flex items-center gap-5">
                        {[0, 1, 2].map(colIdx => {
                            const colCounts = (activeDivision.counts || [])
                                .filter((c: any) => (c.column_idx || 0) === colIdx && !c.is_hidden)
                                .slice(0, 2);
                            if (colCounts.length === 0) return null;
                            return (
                                <div key={colIdx} className="flex flex-col justify-center gap-1.5 min-w-[70px]">
                                    {colCounts.map((count: any) => (
                                        <div key={count.id} className="flex items-center justify-between gap-3 group/count">
                                            <div className="flex flex-col">
                                                <span className="text-[7px] font-black text-muted uppercase tracking-widest leading-none mb-0.5">{count.name}</span>
                                                <span className="text-[10px] font-black tabular-nums leading-none" style={{ color: count.color }}>
                                                    {calculateCount(count, 'roster')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>

                    {canModerate && (
                        <div className="flex items-center gap-1 ml-4">
                            <button 
                                onClick={() => setEditMode(!editMode)}
                                className={`px-2 py-1 rounded transition-colors flex items-center gap-1.5 ${editMode ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'hover:bg-surface text-muted hover:text-accent'}`}
                                title={editMode ? 'Exit Editing Mode' : 'Enter Editing Mode'}
                            >
                                <span className="text-[9px] font-black uppercase tracking-widest">Edit</span>
                                <Pencil size={11} />
                            </button>
                            {canAddSections && (
                                <button 
                                    onClick={() => {
                                        setSectionData({ 
                                            id: null, 
                                            roster_id: activeDivId, 
                                            name: '', 
                                            shortname: '', 
                                            color: '', 
                                            image_url: '',
                                            type: 'section', 
                                            parent_id: null, 
                                            columns: null, 
                                            use_roster_columns: true, 
                                            children: [], 
                                            layout_settings: null, 
                                            subsections_per_row: 1, 
                                            content_html: '' 
                                        });
                                        setShowSectionModal(true);
                                    }}
                                    className="px-2 py-1 hover:bg-surface rounded text-muted hover:text-accent transition-colors flex items-center gap-1"
                                >
                                    <span className="text-[9px] font-black uppercase tracking-widest">section</span>
                                    <Plus size={12} />
                                </button>
                            )}
                        </div>
                    )}
                  </div>
                </div>

                {activeDivision.root_sections?.filter((s: any) => s.type === 'master').map((section: any) => (
                    <SectionCard 
                        key={section.id} 
                        section={section} 
                        user={user}
                        canModerate={isGlobalMod}
                        permissions={rosterPerms}
                        onEdit={handleEditSection}
                        onManageCounts={isSandbox ? undefined : (s) => setShowCountsModal({ target: s, type: 'section' })}
                        calculateCount={calculateCount}
                        columns={section.use_roster_columns ? (rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns) : (section.columns || rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns)}
                        rosterColumns={rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns}
                        datasets={datasets}
                        recordData={recordData}
                        allContents={allContents}
                        allColumns={allColumns}
                        flags={activeFlagsList}
                        editMode={editMode}
                        rosterColor={activeDivision.color}
                        onRefresh={fetchRosters}
                        onUpdateRowLocal={handleUpdateRowLocal}
                        onReorderRows={handleReorderRows}
                        globalEditingRowId={globalEditingRowId}
                        setGlobalEditingRowId={setGlobalEditingRowId}
                        globalSaveTrigger={globalSaveTrigger}
                    />
                ))}

                <div className="sections-container w-full space-y-4">
                  {activeDivision.layout_settings?.rows?.map((row: any, rowIdx: number) => (
                    <SyncGridRow
                      key={rowIdx} 
                      columns={row.columns || 2}
                      className="grid gap-4 w-full items-start"
                    >
                      {({ syncedHeights: rowSyncedHeights, onRowHeightSync: rowOnRowHeightSync }) => (
                        <>
                          {row.section_ids?.map((sId: number) => {
                            const section = activeDivision.root_sections?.find((s: any) => s.id === sId);
                            if (!section || section.type === 'master') return null;
                            return (
                              <SectionCard 
                                key={section.id} 
                                section={section} 
                                user={user}
                                canModerate={isGlobalMod}
                                permissions={rosterPerms}
                                onAddChild={handleAddChildSection}
                                onEdit={handleEditSection}
                                onManageCounts={isSandbox ? undefined : (s) => setShowCountsModal({ target: s, type: 'section' })}
                                calculateCount={calculateCount}
                                columns={section.use_roster_columns ? (rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns) : (section.columns || rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns)}
                                rosterColumns={rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns}
                                datasets={datasets}
                                recordData={recordData}
                                allContents={allContents}
                                allColumns={allColumns}
                                flags={activeFlagsList}
                                editMode={editMode}
                                rosterColor={activeDivision.color}
                                onRefresh={fetchRosters}
                                onUpdateRowLocal={handleUpdateRowLocal}
                                onReorderRows={handleReorderRows}                                globalEditingRowId={globalEditingRowId}
                                setGlobalEditingRowId={setGlobalEditingRowId}
                                globalSaveTrigger={globalSaveTrigger}
                                syncedHeights={rowSyncedHeights}
                                onRowHeightSync={rowOnRowHeightSync}
                              />
                            );
                          })}
                        </>
                      )}
                    </SyncGridRow>
                  ))}

                  <div className="unassigned-sections-container">
                    {activeDivision.layout_settings?.layout_mode === 'columns' ? (
                      <div 
                        className="grid gap-4 w-full items-start"
                        style={{ gridTemplateColumns: `repeat(${activeDivision.default_sections_per_row || 2}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: activeDivision.default_sections_per_row || 2 }).map((_, colIdx) => (
                          <div key={colIdx} className="flex flex-col gap-4">
                            {(activeDivision.root_sections || []).filter((s: any) => {
                                if (s.type === 'master') return false;
                                const inCustomRow = activeDivision.layout_settings?.rows?.some((r: any) => r.section_ids?.includes(s.id));
                                return !inCustomRow;
                            }).filter((_: any, idx: number) => idx % (activeDivision.default_sections_per_row || 2) === colIdx).map((section: any) => (
                                <SectionCard 
                                    key={section.id} 
                                    section={section} 
                                    user={user}
                                    canModerate={isGlobalMod}
                                    permissions={rosterPerms}
                                    onAddChild={handleAddChildSection}
                                    onEdit={handleEditSection}
                                    onManageCounts={isSandbox ? undefined : (s) => setShowCountsModal({ target: s, type: 'section' })}
                                    calculateCount={calculateCount}
                                    columns={section.use_roster_columns ? (rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns) : (section.columns || rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns)}
                                    rosterColumns={rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns}
                                    datasets={datasets}
                                    recordData={recordData}
                                    allContents={allContents}
                                    allColumns={allColumns}
                                    flags={activeFlagsList}
                                    editMode={editMode}
                                    rosterColor={activeDivision.color}
                                    onRefresh={fetchRosters}
                                    onUpdateRowLocal={handleUpdateRowLocal}
                                    onReorderRows={handleReorderRows}
                                    globalEditingRowId={globalEditingRowId}
                                    setGlobalEditingRowId={setGlobalEditingRowId}
                                    globalSaveTrigger={globalSaveTrigger}
                                />
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <SyncGridRow 
                        columns={activeDivision.default_sections_per_row || 2}
                        className="grid gap-4 w-full items-start"
                      >
                        {({ syncedHeights: rowSyncedHeights, onRowHeightSync: rowOnRowHeightSync }) => (
                            <>
                                {activeDivision.root_sections?.filter((s: any) => {
                                    if (s.type === 'master') return false;
                                    const inCustomRow = activeDivision.layout_settings?.rows?.some((r: any) => r.section_ids?.includes(s.id));
                                    return !inCustomRow;
                                }).map((section: any) => (
                                    <SectionCard 
                                        key={section.id} 
                                        section={section} 
                                        user={user}
                                        canModerate={isGlobalMod}
                                        permissions={rosterPerms}
                                        onAddChild={handleAddChildSection}
                                        onEdit={handleEditSection}
                                        onManageCounts={isSandbox ? undefined : (s) => setShowCountsModal({ target: s, type: 'section' })}
                                        calculateCount={calculateCount}
                                        columns={section.use_roster_columns ? (rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns) : (section.columns || rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns)}
                                        rosterColumns={rosters.find((r: any) => r.id === (section.roster_id || activeDivId))?.columns}
                                        datasets={datasets}
                                        recordData={recordData}
                                        allContents={allContents}
                                        allColumns={allColumns}
                                        flags={activeFlagsList}
                                        editMode={editMode}
                                        rosterColor={activeDivision.color}
                                        onRefresh={fetchRosters}
                                        onUpdateRowLocal={handleUpdateRowLocal}
                                        onReorderRows={handleReorderRows}                                    globalEditingRowId={globalEditingRowId}
                                        setGlobalEditingRowId={setGlobalEditingRowId}
                                        globalSaveTrigger={globalSaveTrigger}
                                        syncedHeights={rowSyncedHeights}
                                        onRowHeightSync={rowOnRowHeightSync}
                                    />
                                ))}
                            </>
                        )}
                      </SyncGridRow>
                    )}
                  </div>
                </div>

                {(!activeDivision.root_sections || activeDivision.root_sections.length === 0) && (
                    <div className="w-full flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-b-lg bg-card/50">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">No sections defined</p>
                        {canModerate && (
                            <button 
                                onClick={() => {
                                    setSectionData({ 
                                        id: null, 
                                        roster_id: activeDivId, 
                                        name: '', 
                                        shortname: '', 
                                        color: '', 
                                        image_url: '',
                                        type: 'section', 
                                        parent_id: null, 
                                        columns: null, 
                                        use_roster_columns: true,
                                        children: [], 
                                        layout_settings: null, 
                                        subsections_per_row: 1,
                                        content_html: ''
                                    });
                                    setShowSectionModal(true);
                                }}
                                className="mt-4 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded font-bold text-[10px] uppercase tracking-widest transition-all"
                            >
                                Add First Section
                            </button>
                        )}
                    </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-muted text-center">
                <ShieldAlert size={48} className="opacity-10 mb-4" />
                <p className="uppercase tracking-widest text-sm font-black mb-2">No rosters defined yet</p>
                {canCreate && (
                  <p className="text-[10px] font-bold opacity-60 max-w-xs leading-relaxed uppercase tracking-tighter">
                    You have permission to manage rosters. <br />
                    Press the <span className="text-accent font-black">+</span> at the bottom of the page to start.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Compact Accessibility Controls - OUTSIDE main scaled container */}
      <div className="fixed bottom-12 right-6 z-[300] flex items-center gap-2">
          {globalEditingRowId !== null && (
              <button 
                  onClick={() => setGlobalSaveTrigger(prev => prev + 1)}
                  className="h-9 px-4 bg-accent text-white rounded-lg shadow-[0_0_20px_rgba(var(--accent-rgb),0.4)] flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-accent/90 active:scale-95 transition-all animate-in slide-in-from-right-4 duration-300 relative overflow-hidden group/save"
              >
                  <div className="absolute inset-0 bg-white/20 group-hover/save:translate-x-full -translate-x-full transition-transform duration-500 skew-x-12" />
                  <div className="absolute inset-0 bg-accent animate-pulse opacity-50 blur-xl -z-10" />
                  <Plus size={14} className="rotate-45" />
                  Save & Finish Editing
              </button>
          )}
          <div className="flex items-center bg-card border border-border rounded-lg shadow-xl overflow-hidden h-9">
              <button 
                  onClick={() => setScaling(Math.max(80, scaling - 5))}
                  className="w-9 h-full flex items-center justify-center hover:bg-surface text-muted hover:text-accent transition-colors border-r border-border active:scale-95"
                  title="Zoom Out"
              >
                  <Minus size={14} />
              </button>
              <div className="w-12 h-full flex items-center justify-center font-black text-[10px] text-text tabular-nums select-none bg-surface/30">
                  {scaling}%
              </div>
              <button 
                  onClick={() => setScaling(Math.min(130, scaling + 5))}
                  className="w-9 h-full flex items-center justify-center hover:bg-surface text-muted hover:text-accent transition-colors border-l border-border active:scale-95"
                  title="Zoom In"
              >
                  <Plus size={14} />
              </button>
          </div>
      </div>

      <div className="tabs-bar bg-card border-t border-border flex items-center px-2.5 h-[var(--tab-h)] sticky bottom-0 z-[210]">
        <Reorder.Group 
            ref={scrollRef}
            axis="x" 
            values={rosters} 
            onReorder={handleReorder}
            className="flex items-center flex-1 overflow-x-auto overflow-y-hidden scrollbar-none gap-1 h-full"
        >
          {rosters.map((roster: any) => (
            <Reorder.Item 
                key={roster.id} 
                value={roster}
                className="flex items-center group relative h-full shrink-0"
            >
              <div 
                onClick={() => setActiveDivId(roster.id)}
                className={`tab pl-4 py-2 cursor-pointer transition-all text-[10px] font-bold uppercase h-full flex items-center gap-1.5 relative border-t-2 ${
                  canModerate ? 'pr-1' : 'pr-4'
                } ${
                  activeDivId === roster.id 
                    ? 'border-accent text-accent bg-accent/5' 
                    : 'border-transparent text-muted hover:text-text hover:bg-surface'
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: roster.color }} />
                <span>{roster.name}</span>

                {canModerate && (
                    <div className="flex items-center">
                        <div className={`transition-opacity flex items-center ${activeMenuId === roster.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                             <button 
                                type="button"
                                className={`text-muted hover:text-accent cursor-pointer p-0.5 rounded hover:bg-accent/10 ${activeMenuId === roster.id ? 'text-accent bg-accent/10' : ''}`} 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (activeMenuId === roster.id) {
                                        setActiveMenuId(null);
                                    } else {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setMenuPosition({ left: rect.left + rect.width / 2 });
                                        setActiveMenuId(roster.id);
                                    }
                                }} 
                             >
                                <MoreVertical size={12} />
                             </button>
                        </div>

                        {activeMenuId === roster.id && (
                            <div 
                                className="fixed bottom-[var(--tab-h)] mb-2 bg-card border border-border rounded-lg shadow-2xl p-1 z-[999] min-w-[140px]"
                                style={{ 
                                    left: menuPosition.left,
                                    transform: 'translateX(-50%)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {(isGlobalMod || roster.user_roster_permissions?.modify_roster) && (
                                    <button 
                                        onClick={() => handleEditRoster(roster)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                    >
                                        <Settings2 size={12} /> Edit Roster
                                    </button>
                                )}
                                {(isGlobalMod || roster.user_roster_permissions?.manage_columns) && (
                                    <button 
                                        onClick={() => {
                                            setShowColumnsModal(roster);
                                            setActiveMenuId(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                    >
                                        <Settings2 size={12} /> Manage Columns
                                    </button>
                                )}
                                {(isGlobalMod || roster.user_roster_permissions?.manage_layout) && (
                                    <button 
                                        onClick={() => {
                                            setShowLayoutModal(roster);
                                            setActiveMenuId(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                    >
                                        <Layout size={12} /> Manage Layout
                                    </button>
                                )}
                                {!isSandbox && (isGlobalMod || roster.user_roster_permissions?.modify_roster) && (
                                    <button 
                                        onClick={() => {
                                            setShowCountsModal({ target: roster, type: 'roster' });
                                            setActiveMenuId(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                    >
                                        <Calculator size={12} /> Manage Counts
                                    </button>
                                )}
                                {!isSandbox && (isGlobalMod || roster.user_roster_permissions?.modify_roster) && (
                                    <button 
                                        onClick={() => {
                                            setShowPermissionsModal(roster);
                                            setActiveMenuId(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                    >
                                        <Shield size={12} /> Permissions
                                    </button>
                                )}
                                {!isSandbox && (isGlobalMod || roster.user_roster_permissions?.revision_history) && (
                                    <button 
                                        onClick={() => {
                                            setActiveMenuId(null);
                                            navigate(`/${shortname}/rosters/${roster.id}/revisions`);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                    >
                                        <Clock size={12} /> View Revision History
                                    </button>
                                )}
                                {(isGlobalMod || roster.user_roster_permissions?.modify_roster) && (
                                    <button 
                                        onClick={() => handleDelete(roster.id)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-danger/70 hover:text-danger hover:bg-danger/5 rounded transition-colors"
                                    >
                                        <Trash2 size={12} /> Remove Roster
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
          ))}

          {canCreate && (
            <div className="relative flex items-center gap-1 ml-2 shrink-0">
                <button 
                    onClick={() => {
                        setNewRoster({ id: null, name: '', shortname: '', color: '#3b82f6' });
                        setShowCreateModal(true);
                    }}
                    className="p-2 text-muted hover:text-accent transition-colors"
                    title="Create New Roster"
                >
                    <Plus size={16} />
                </button>
                {!isSandbox && canModifyVariables && (
                    <div className="relative">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!showRosterContextMenu) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMenuPosition({ left: rect.left + rect.width / 2 });
                                }
                                setShowRosterContextMenu(!showRosterContextMenu);
                            }}
                            className={`p-2 transition-colors ${showRosterContextMenu ? 'text-accent' : 'text-muted hover:text-accent'}`}
                            title="Global Options"
                        >
                            <Menu size={16} />
                        </button>
                        {showRosterContextMenu && (
                            <div 
                                className="fixed bottom-[var(--tab-h)] mb-2 bg-card border border-border rounded-lg shadow-2xl p-1 z-[999] min-w-[160px]"
                                onClick={(e) => e.stopPropagation()}
                                style={{ 
                                    left: menuPosition.left,
                                    transform: 'translateX(-50%)' 
                                }}
                            >
                                <button 
                                    onClick={() => {
                                        setShowVariablesModal(true);
                                        setShowRosterContextMenu(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                >
                                    <Database size={12} /> Global Variables
                                </button>
                                {canModifyFlags && (
                                    <button
                                        onClick={() => {
                                            setShowFlagsModal(true);
                                            setShowRosterContextMenu(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface rounded transition-colors"
                                    >
                                        <Flag size={12} /> Flag Manager
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowTemplateModal(true);
                                        setShowRosterContextMenu(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-accent hover:text-accent-light hover:bg-accent/5 rounded transition-colors"
                                >
                                    <FileCode2 size={12} /> Roster Template
                                </button>
                                </div>                        )}
                    </div>
                )}
            </div>
          )}
        </Reorder.Group>

        {rosters.length > 5 && (
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

      {/* Modals */}
      {showSandboxIntro && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300">
          <div className="bg-gradient-to-b from-card to-card/95 border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(139,92,246,0.15)] max-w-md w-full p-6 relative overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Ambient Background Glow */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col items-center text-center relative z-10">
              {/* Animated Icon Container */}
              <div className="w-16 h-16 bg-violet-500/10 border border-violet-500/30 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(139,92,246,0.1)] group hover:scale-105 transition-transform duration-300">
                <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
              </div>

              <h2 className="text-2xl font-black tracking-tight mb-2 uppercase bg-gradient-to-r from-violet-600 via-violet-500 to-indigo-600 dark:from-violet-200 dark:via-violet-400 dark:to-indigo-300 bg-clip-text text-transparent">
                Sandbox Rosters
              </h2>
              <div className="h-0.5 w-12 bg-violet-500/30 rounded-full mb-6" />

              <p className="text-xs text-muted leading-relaxed uppercase tracking-wider mb-6 font-medium max-w-sm">
                Welcome to your private design suite. Sandbox rosters allow you to model structures, draft layouts, and play with data configurations in complete isolation.
              </p>

              {/* Feature Cards Grid */}
              <div className="space-y-3 w-full text-left mb-8">
                <div className="p-3 bg-surface/30 border border-border/40 rounded-xl flex items-start gap-3">
                  <div className="p-1 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-text">Creator-Only Access</h4>
                    <p className="text-[9px] text-muted uppercase tracking-tighter leading-normal mt-0.5">These rosters are strictly private. No other users can see or access them.</p>
                  </div>
                </div>

                <div className="p-3 bg-surface/30 border border-border/40 rounded-xl flex items-start gap-3">
                  <div className="p-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-text">No Auditing & Revisions</h4>
                    <p className="text-[9px] text-muted uppercase tracking-tighter leading-normal mt-0.5">Changes are excluded from system-wide audit logs and revision tracking history.</p>
                  </div>
                </div>

                <div className="p-3 bg-surface/30 border border-border/40 rounded-xl flex items-start gap-3">
                  <div className="p-1 bg-violet-500/10 border border-violet-500/20 rounded-lg text-violet-400 mt-0.5">
                    <Layout className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-text">Dynamic Reference Mapping</h4>
                    <p className="text-[9px] text-muted uppercase tracking-tighter leading-normal mt-0.5">Cross-link sections to import records from main live rosters directly.</p>
                  </div>
                </div>
              </div>

              {/* Close / Action Button */}
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('sandbox-intro-dismissed', 'true');
                  setShowSandboxIntro(false);
                }}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] flex items-center justify-center text-[10px] font-black uppercase tracking-widest active:scale-[0.98] transition-all duration-200"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}

      {showColumnsModal && (
        <ColumnsModal 
          target={showColumnsModal} 
          type="roster"
          shortname={shortname!}
          onClose={() => setShowColumnsModal(null)} 
          onSave={() => {
            setShowColumnsModal(null);
            fetchRosters();
          }} 
        />
      )}

      {showSectionColumnsModal && (
        <ColumnsModal 
          target={showSectionColumnsModal} 
          parentColumns={rosters.find((r: any) => r.id === (showSectionColumnsModal.roster_id || activeDivId))?.columns}
          type="section"
          shortname={shortname!}
          onClose={() => setShowSectionColumnsModal(null)} 
          onSave={() => {
            setShowSectionColumnsModal(null);
            fetchRosters();
          }} 
        />
      )}

      {showPermissionsModal && (
        <RosterPermissionsModal
          roster={showPermissionsModal}
          shortname={shortname}
          onClose={() => setShowPermissionsModal(null)}
        />
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
          <div className="bg-card p-6 rounded-lg max-w-sm w-full border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-text">
                {newRoster.id ? <Settings2 size={18} /> : <Plus size={18} />} 
                {newRoster.id ? 'Edit Roster' : 'Create New Roster'}
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Roster Name</label>
                <input 
                  value={newRoster.name} 
                  onChange={e => setNewRoster({ ...newRoster, name: e.target.value })} 
                  className="w-full bg-surface border border-border p-3 rounded text-sm text-text focus:border-accent outline-none transition" 
                  required 
                  placeholder="e.g. Central Patrol Division" 
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Short Name (Max 6 Chars)</label>
                <input 
                  value={newRoster.shortname} 
                  onChange={e => setNewRoster({ ...newRoster, shortname: e.target.value.slice(0, 6).toUpperCase() })} 
                  className="w-full bg-surface border border-border p-3 rounded text-sm text-text focus:border-accent outline-none transition uppercase" 
                  required 
                  placeholder="e.g. CPD" 
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Roster Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={newRoster.color} 
                    onChange={e => setNewRoster({ ...newRoster, color: e.target.value })} 
                    className="w-10 h-10 bg-surface border border-border rounded p-1 cursor-pointer" 
                  />
                  <input 
                    value={newRoster.color} 
                    onChange={e => setNewRoster({ ...newRoster, color: e.target.value })} 
                    className="flex-1 bg-surface border border-border p-2 rounded text-sm text-text focus:border-accent outline-none transition font-mono" 
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 bg-surface hover:bg-bg border border-border text-text rounded font-bold text-xs uppercase tracking-widest transition">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded font-bold text-xs uppercase tracking-widest transition disabled:opacity-50">
                  {isSaving ? 'Saving...' : (newRoster.id ? 'Save Changes' : 'Create Roster')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
          <div className="bg-card p-6 rounded-lg max-w-lg w-full border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-text">
                {sectionData.id ? 'Edit Section' : 'Add New Section'}
            </h2>
            <form onSubmit={handleSectionSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Section Name</label>
                <input 
                  value={sectionData.name} 
                  onChange={e => setSectionData({ ...sectionData, name: e.target.value })} 
                  className="w-full bg-surface border border-border p-3 rounded text-sm text-text focus:border-accent outline-none transition" 
                  required 
                  placeholder="e.g. Division Leadership" 
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Section Logo URL (Optional)</label>
                <input 
                  value={sectionData.image_url || ''} 
                  onChange={e => setSectionData({ ...sectionData, image_url: e.target.value })} 
                  className="w-full bg-surface border border-border p-3 rounded text-sm text-text focus:border-accent outline-none transition" 
                  placeholder="e.g. https://example.com/logo.png" 
                />
                <p className="text-[8px] text-muted mt-1 uppercase font-bold tracking-widest">Displays as a small logo next to the name.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Short Name (Max 6)</label>
                    <input 
                      value={sectionData.shortname} 
                      onChange={e => setSectionData({ ...sectionData, shortname: e.target.value.slice(0, 6).toUpperCase() })} 
                      className="w-full bg-surface border border-border p-3 rounded text-sm text-text focus:border-accent outline-none transition uppercase" 
                      required 
                      placeholder="e.g. DIVLDR" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Custom Color (Optional)</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={sectionData.color || '#3b82f6'} 
                        onChange={e => setSectionData({ ...sectionData, color: e.target.value })} 
                        className="w-10 h-10 bg-surface border border-border rounded p-1 cursor-pointer" 
                      />
                      <input 
                        value={sectionData.color} 
                        onChange={e => setSectionData({ ...sectionData, color: e.target.value })} 
                        className="flex-1 bg-surface border border-border p-2 rounded text-sm text-text focus:border-accent outline-none transition font-mono" 
                        placeholder="Inherit"
                      />
                    </div>
                  </div>
              </div>

              <div>
                <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-3">Data Source Type</label>
                <div className="flex gap-2">
                  {[
                    { id: 'manual', name: 'Manual Entry', description: 'Manually add and manage rows.', icon: Pencil },
                    { id: 'dynamic', name: 'Dynamic Logic', description: 'Auto-populated from other sources.', icon: Database }
                  ].map((ds) => (
                    <button
                      key={ds.id}
                      type="button"
                      onClick={() => setSectionData({ ...sectionData, data_source: ds.id as any })}
                      className={`flex-1 p-3 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                        sectionData.data_source === ds.id 
                          ? 'border-accent bg-accent/5' 
                          : 'border-border hover:border-accent/50 hover:bg-surface'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${sectionData.data_source === ds.id ? 'bg-accent text-white' : 'bg-surface text-muted'}`}>
                        <ds.icon size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${sectionData.data_source === ds.id ? 'text-text' : 'text-muted'}`}>
                          {ds.name}
                        </span>
                        <span className="text-[8px] font-medium text-muted leading-tight uppercase tracking-tighter mt-0.5">
                          {ds.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-3">Select Section Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      id: 'master',
                      name: 'Master Section',
                      description: 'Hero section for high-level leadership.',
                      icon: Shield,
                      disabled: !sectionData.id && activeDivision?.root_sections?.some((s: any) => s.type === 'master') && !sectionData.parent_id,
                      preview: (color: string) => (
                        <div className="w-full border border-border bg-card rounded overflow-hidden">
                          <div className="h-1" style={{ backgroundColor: color }} />
                          <div className="p-1 border-b border-border bg-border/20" />
                          <div className="p-2 space-y-1">
                            <div className="h-1 w-full bg-border/40 rounded" />
                            <div className="h-1 w-3/4 bg-border/20 rounded" />
                          </div>
                        </div>
                      )
                    },
                    {
                      id: 'section',
                      name: 'Header Section',
                      description: 'Standard table for members and roster data with alternative look, usually for command.',
                      icon: Layout,
                      preview: (color: string) => (
                        <div className="w-full border border-border bg-card rounded overflow-hidden">
                          <div className="flex h-2 items-stretch border-b border-border bg-surface">
                            <div className="w-1" style={{ backgroundColor: color }} />
                          </div>
                          <div className="p-2 grid grid-cols-2 gap-1">
                            <div className="h-3 border border-border bg-border/10 rounded" />
                            <div className="h-3 border border-border bg-border/10 rounded" />
                          </div>
                        </div>
                      )
                    },
                    {
                      id: 'subsection',
                      name: 'Section',
                      description: 'Standard Table for members and roster data.',
                      icon: Menu,
                      preview: (color: string) => (
                        <div className="w-full border border-border bg-card rounded overflow-hidden">
                          <div className="p-1 border-b border-border bg-border/20" />
                          <div className="p-2 space-y-1">
                            <div className="h-0.5 w-full bg-border/40 rounded" />
                            <div className="h-0.5 w-full bg-border/20 rounded" />
                            <div className="h-0.5 w-full bg-border/20 rounded" />
                          </div>
                        </div>
                      )
                    },
                    {
                      id: 'content',
                      name: 'HTML Section',
                      description: 'Custom HTML/CSS content block.',
                      icon: FileCode2,
                      preview: (color: string) => (
                        <div className="w-full border border-border bg-card rounded overflow-hidden">
                          <div className="p-1 border-b border-border bg-border/20" />
                          <div className="p-2 flex flex-col items-center justify-center">
                              <div className="h-1 w-full bg-accent/20 rounded mb-1" style={{ backgroundColor: color + '33' }} />
                              <div className="h-1 w-2/3 bg-accent/10 rounded" style={{ backgroundColor: color + '1a' }} />
                          </div>
                        </div>
                      )
                    }
                  ].map((t) => {
                    const isSelected = sectionData.type === t.id;
                    const isDisabled = t.disabled || (sectionData.parent_id && t.id === 'master');
                    
                    if (isDisabled && !isSelected) return null;

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => !isDisabled && setSectionData({ ...sectionData, type: t.id as any })}
                        className={`text-left p-3 rounded-lg border-2 transition-all group flex flex-col gap-3 ${
                          isSelected 
                            ? 'border-accent bg-accent/5' 
                            : isDisabled 
                              ? 'border-border/50 opacity-40 cursor-not-allowed' 
                              : 'border-border hover:border-accent/50 hover:bg-surface'
                        }`}
                        disabled={isDisabled}
                      >
                        <div className="flex items-center gap-2">
                          <t.icon size={14} className={isSelected ? 'text-accent' : 'text-muted'} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-text' : 'text-muted'}`}>
                            {t.name}
                          </span>
                        </div>
                        
                        {t.preview(sectionData.color || activeDivision?.color || '#3b82f6')}
                        
                        <p className="text-[9px] font-medium text-muted leading-tight uppercase tracking-tighter">
                          {t.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {sectionData.type === 'content' && (
                <div>
                    <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">HTML Content</label>
                    <textarea 
                        value={sectionData.content_html || ''} 
                        onChange={e => setSectionData({ ...sectionData, content_html: e.target.value })} 
                        className="w-full bg-surface border border-border p-3 rounded text-sm text-text focus:border-accent outline-none transition font-mono min-h-[150px]" 
                        placeholder="<div>Styling HTML goes here...</div>"
                    />
                    <p className="text-[8px] text-muted mt-1 uppercase font-bold tracking-widest">You can use standard HTML and inline CSS.</p>
                </div>
              )}

              {sectionData.data_source === 'dynamic' && (
                <div className="space-y-4 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <Database size={14} className="text-accent" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-accent">Dynamic Logic Configuration</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[9px] text-muted font-black uppercase tracking-[0.2em] mb-1.5 opacity-60">Source Type</label>
                            <select 
                                value={sectionData.section_options?.dynamic_config?.source_type || ''} 
                                onChange={e => {
                                    const config = { ...(sectionData.section_options?.dynamic_config || {}), source_type: e.target.value, source_id: '' };
                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: config } });
                                }}
                                className="w-full bg-surface border border-border p-2 rounded text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent transition"
                            >
                                <option value="">Select Source</option>
                                <option value="database">Database</option>
                                <option value="section">Another Section</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] text-muted font-black uppercase tracking-[0.2em] mb-1.5 opacity-60">Source Target</label>
                            <select 
                                value={sectionData.section_options?.dynamic_config?.source_id || ''} 
                                onChange={e => {
                                    const config = { ...(sectionData.section_options?.dynamic_config || {}), source_id: e.target.value };
                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: config } });
                                }}
                                className="w-full bg-surface border border-border p-2 rounded text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent transition"
                                disabled={!sectionData.section_options?.dynamic_config?.source_type}
                            >
                                <option value="">Select Target</option>
                                {sectionData.section_options?.dynamic_config?.source_type === 'database' && recordData.map(db => (
                                    <option key={db.id} value={db.id}>{db.name}</option>
                                ))}
                                {sectionData.section_options?.dynamic_config?.source_type === 'section' && targetRosters.flatMap(r => {
                                    const flatten = (sections: any[]): any[] => {
                                        let res: any[] = [];
                                        sections.forEach(s => {
                                            if (s.id !== sectionData.id) res.push({ id: s.id, name: `${r.shortname} - ${s.name}` });
                                            if (s.children) res.push(...flatten(s.children));
                                        });
                                        return res;
                                    };
                                    return flatten(r.root_sections || []);
                                }).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-accent/20 pb-1">
                            <label className="text-[9px] text-muted font-black uppercase tracking-[0.2em] opacity-60">Logic Rules</label>
                            <button 
                                type="button"
                                onClick={() => {
                                    const config = sectionData.section_options?.dynamic_config || {};
                                    const rules = [...(config.rules || []), { type: 'not_in_roster', roster_id: 'all', match_field: '', target_field: '' }];
                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, rules } } });
                                }}
                                className="text-[8px] font-black uppercase tracking-widest text-accent hover:text-accent/80 transition-colors"
                            >
                                + Add Rule
                            </button>
                        </div>
                        
                        {(sectionData.section_options?.dynamic_config?.rules || []).map((rule: any, idx: number) => (
                            <div key={idx} className="p-3 bg-card border border-border rounded-lg space-y-3 relative group/rule">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        const config = sectionData.section_options?.dynamic_config || {};
                                        const rules = config.rules.filter((_: any, i: number) => i !== idx);
                                        setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, rules } } });
                                    }}
                                    className="absolute top-2 right-2 p-1 text-muted hover:text-danger opacity-0 group-hover/rule:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={10} />
                                </button>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[8px] text-muted font-black uppercase tracking-widest mb-1">Rule Type</label>
                                        <select 
                                            value={rule.type} 
                                            onChange={e => {
                                                const config = sectionData.section_options?.dynamic_config || {};
                                                const rules = [...config.rules];
                                                rules[idx] = { ...rules[idx], type: e.target.value };
                                                setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, rules } } });
                                            }}
                                            className="w-full bg-surface border border-border p-1.5 rounded text-[9px] font-bold uppercase outline-none focus:border-accent"
                                        >
                                            <optgroup label="Relationship Rules">
                                                <option value="not_in_roster">Not in Roster</option>
                                                <option value="in_roster">In Roster</option>
                                            </optgroup>
                                            <optgroup label="Value Rules">
                                                <option value="equals">Equals</option>
                                                <option value="not_equals">Not Equals</option>
                                                <option value="contains">Contains</option>
                                                <option value="not_contains">Not Contains</option>
                                                <option value="starts_with">Starts With</option>
                                                <option value="ends_with">Ends With</option>
                                                <option value="matches_regex">Matches Regex</option>
                                                <option value="in_list">In List (Comma Sep)</option>
                                                <option value="not_in_list">Not In List (Comma Sep)</option>
                                                <option value="exists">Is Not Empty</option>
                                                <option value="not_exists">Is Empty</option>
                                            </optgroup>
                                            <optgroup label="Comparison Rules">
                                                <option value="is_numeric">Is Numeric</option>
                                                <option value="greater_than">Greater Than</option>
                                                <option value="less_than">Less Than</option>
                                                <option value="between">Between (min,max)</option>
                                                <option value="date_after">Date After</option>
                                                <option value="date_before">Date Before</option>
                                                <option value="date_between">Date Between (start,end)</option>
                                                <option value="is_today">Is Today</option>
                                                <option value="is_past">Is Past</option>
                                                <option value="is_future">Is Future</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[8px] text-muted font-black uppercase tracking-widest mb-1">Target / Value</label>
                                        {(rule.type === 'not_in_roster' || rule.type === 'in_roster') ? (
                                            <select 
                                                value={rule.roster_id} 
                                                onChange={e => {
                                                    const config = sectionData.section_options?.dynamic_config || {};
                                                    const rules = [...config.rules];
                                                    rules[idx] = { ...rules[idx], roster_id: e.target.value };
                                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, rules } } });
                                                }}
                                                className="w-full bg-surface border border-border p-1.5 rounded text-[9px] font-bold uppercase outline-none focus:border-accent"
                                            >
                                                <option value="all">All Rosters</option>
                                                {targetRosters.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input 
                                                value={rule.value || ''} 
                                                onChange={e => {
                                                    const config = sectionData.section_options?.dynamic_config || {};
                                                    const rules = [...config.rules];
                                                    rules[idx] = { ...rules[idx], value: e.target.value };
                                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, rules } } });
                                                }}
                                                placeholder={rule.type?.includes('between') ? "val1,val2" : "Value to match..."}
                                                className="w-full bg-surface border border-border p-1.5 rounded text-[9px] font-bold outline-none focus:border-accent" 
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[8px] text-muted font-black uppercase tracking-widest mb-1">Source Field</label>
                                        <select 
                                            value={rule.match_field} 
                                            onChange={e => {
                                                const config = sectionData.section_options?.dynamic_config || {};
                                                const rules = [...config.rules];
                                                rules[idx] = { ...rules[idx], match_field: e.target.value };
                                                setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, rules } } });
                                            }}
                                            disabled={!sectionData.section_options?.dynamic_config?.source_id}
                                            className="w-full bg-surface border border-border p-1.5 rounded text-[9px] font-bold outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value="">Select Field...</option>
                                            {(() => {
                                                const sourceType = sectionData.section_options?.dynamic_config?.source_type;
                                                const sourceId = sectionData.section_options?.dynamic_config?.source_id;
                                                if (sourceType === 'database') {
                                                    return recordData.find(db => String(db.id) === String(sourceId))?.database_structure?.map((f: any) => (
                                                        <option key={f.id} value={f.id}>{f.name}</option>
                                                    ));
                                                }
                                                if (sourceType === 'section') {
                                                    const findSectionAndCols = (sections: any[]): any => {
                                                        for (const s of sections) {
                                                            if (String(s.id) === String(sourceId)) {
                                                                const roster = targetRosters.find(r => r.id === s.roster_id);
                                                                return s.use_roster_columns ? roster?.columns : s.columns;
                                                            }
                                                            if (s.children) {
                                                                const found = findSectionAndCols(s.children);
                                                                if (found) return found;
                                                            }
                                                        }
                                                        return null;
                                                    };
                                                    let cols = null;
                                                    for (const r of targetRosters) {
                                                        cols = findSectionAndCols(r.root_sections || []);
                                                        if (cols) break;
                                                    }
                                                    return cols?.map((c: any) => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ));
                                                }
                                                return null;
                                            })()}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[8px] text-muted font-black uppercase tracking-widest mb-1">{(rule.type === 'not_in_roster' || rule.type === 'in_roster') ? 'Roster Field' : 'Logic'}</label>
                                        {(rule.type === 'not_in_roster' || rule.type === 'in_roster') ? (
                                            <select 
                                                value={rule.target_field} 
                                                onChange={e => {
                                                    const config = sectionData.section_options?.dynamic_config || {};
                                                    const rules = [...config.rules];
                                                    rules[idx] = { ...rules[idx], target_field: e.target.value };
                                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, rules } } });
                                                }}
                                                disabled={!rule.roster_id}
                                                className="w-full bg-surface border border-border p-1.5 rounded text-[9px] font-bold outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <option value="">Select Field...</option>
                                                {(() => {
                                                    if (rule.roster_id === 'all') {
                                                        const allCols = targetRosters.flatMap(r => r.columns || []);
                                                        const uniqueCols = Array.from(new Map(allCols.map(c => [c.name, c])).values());
                                                        return uniqueCols.map((c: any) => (
                                                            <option key={c.name} value={c.id}>{c.name}</option>
                                                        ));
                                                    }
                                                    return targetRosters.find(r => String(r.id) === String(rule.roster_id))?.columns?.map((c: any) => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ));
                                                })()}
                                            </select>
                                        ) : (
                                            <div className="text-[7px] text-muted italic pt-2 uppercase font-black">Filtered automatically</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-accent/20 pb-1">
                            <div className="flex flex-col">
                                <label className="text-[9px] text-muted font-black uppercase tracking-[0.2em] opacity-60">Data Mapping</label>
                                <p className="text-[6px] text-muted uppercase font-bold tracking-tighter">Use {'{field_id}'} for template mapping</p>
                            </div>
                            <p className="text-[7px] text-accent font-black uppercase">Map source fields to roster columns</p>
                        </div>
                        
                        <div className="bg-card border border-border rounded-lg overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-surface/50 border-b border-border">
                                    <tr>
                                        <th className="px-3 py-2 text-[8px] font-black uppercase text-muted tracking-widest">Roster Column</th>
                                        <th className="px-3 py-2 text-[8px] font-black uppercase text-muted tracking-widest">Source Field / Template</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {(sectionData.columns || rosters.find(r => r.id === (sectionData.roster_id || activeDivId))?.columns || []).map((col: any) => (
                                        <tr key={col.id} className="hover:bg-surface/30">
                                            <td className="px-3 py-2">
                                                <span className="text-[9px] font-bold text-text uppercase">{col.name}</span>
                                                <span className="text-[7px] text-muted block font-mono">{col.id}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex gap-1">
                                                    <div className="flex-1">
                                                        <input 
                                                            value={sectionData.section_options?.dynamic_config?.mappings?.[col.id] || ''}
                                                            onChange={e => {
                                                                const config = sectionData.section_options?.dynamic_config || {};
                                                                const mappings = { ...(config.mappings || {}), [col.id]: e.target.value };
                                                                setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, mappings } } });
                                                            }}
                                                            disabled={!sectionData.section_options?.dynamic_config?.source_id}
                                                            placeholder="Field ID or {template}"
                                                            className="w-full bg-surface border border-border p-1 rounded text-[9px] font-bold outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </div>
                                                    <select 
                                                        className="bg-bg border border-border text-[8px] font-black uppercase p-1 rounded outline-none w-20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        disabled={!sectionData.section_options?.dynamic_config?.source_id}
                                                        onChange={e => {
                                                            if (!e.target.value) return;
                                                            const config = sectionData.section_options?.dynamic_config || {};
                                                            let current = config.mappings?.[col.id] || '';
                                                            const toAdd = e.target.value.startsWith('__') ? `{${e.target.value}}` : e.target.value;
                                                            const newVal = current ? `${current} ${toAdd}` : toAdd;
                                                            const mappings = { ...(config.mappings || {}), [col.id]: newVal };
                                                            setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, mappings } } });
                                                            e.target.value = "";
                                                        }}
                                                    >
                                                        <option value="">Quick Add</option>
                                                        <optgroup label="Source Fields">
                                                            {(() => {
                                                                const sourceType = sectionData.section_options?.dynamic_config?.source_type;
                                                                const sourceId = sectionData.section_options?.dynamic_config?.source_id;
                                                                if (sourceType === 'database') {
                                                                    return recordData.find(db => String(db.id) === String(sourceId))?.database_structure?.map((f: any) => (
                                                                        <option key={f.id} value={f.id}>{f.name}</option>
                                                                    ));
                                                                }
                                                                if (sourceType === 'section') {
                                                                     const findSectionAndCols = (sections: any[]): any => {
                                                                         for (const s of sections) {
                                                                             if (String(s.id) === String(sourceId)) {
                                                                                 const roster = targetRosters.find(r => r.id === s.roster_id);
                                                                                 return s.use_roster_columns ? roster?.columns : s.columns;
                                                                             }
                                                                             if (s.children) {
                                                                                 const found = findSectionAndCols(s.children);
                                                                                 if (found) return found;
                                                                             }
                                                                         }
                                                                         return null;
                                                                     };
                                                                     let cols = null;
                                                                     for (const r of targetRosters) {
                                                                         cols = findSectionAndCols(r.root_sections || []);
                                                                         if (cols) break;
                                                                     }
                                                                    return cols?.map((c: any) => (
                                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                                    ));
                                                                }
                                                                return null;
                                                            })()}
                                                        </optgroup>
                                                        <optgroup label="System Fields">
                                                            <option value="__created_at">Date Created</option>
                                                            <option value="__updated_at">Date Updated</option>
                                                        </optgroup>
                                                        <optgroup label="Transformations">
                                                            <option value="|upper">Uppercase</option>
                                                            <option value="|lower">Lowercase</option>
                                                            <option value="|capitalize">Capitalize</option>
                                                            <option value="|first">First Letter Only</option>
                                                        </optgroup>
                                                    </select>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-accent/20 pb-1">
                            <label className="text-[9px] text-muted font-black uppercase tracking-[0.2em] opacity-60">Sorting</label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[8px] text-muted font-black uppercase tracking-widest mb-1.5">Sort By Field</label>
                                <select 
                                    value={sectionData.section_options?.dynamic_config?.sort_field || ''} 
                                    onChange={e => {
                                        const config = sectionData.section_options?.dynamic_config || {};
                                        setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, sort_field: e.target.value } } });
                                    }}
                                    disabled={!sectionData.section_options?.dynamic_config?.source_id}
                                    className="w-full bg-surface border border-border p-2 rounded text-[9px] font-bold outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed" 
                                >
                                    <option value="">No Sorting</option>
                                    {(() => {
                                        const sourceType = sectionData.section_options?.dynamic_config?.source_type;
                                        const sourceId = sectionData.section_options?.dynamic_config?.source_id;
                                        if (sourceType === 'database') {
                                            return recordData.find(db => String(db.id) === String(sourceId))?.database_structure?.map((f: any) => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                            ));
                                        }
                                        if (sourceType === 'section') {
                                            const findSectionAndCols = (sections: any[]): any => {
                                                for (const s of sections) {
                                                    if (String(s.id) === String(sourceId)) {
                                                        const roster = targetRosters.find(r => r.id === s.roster_id);
                                                        return s.use_roster_columns ? roster?.columns : s.columns;
                                                    }
                                                    if (s.children) {
                                                        const found = findSectionAndCols(s.children);
                                                        if (found) return found;
                                                    }
                                                }
                                                return null;
                                            };
                                            let cols = null;
                                            for (const r of targetRosters) {
                                                cols = findSectionAndCols(r.root_sections || []);
                                                if (cols) break;
                                            }
                                            return cols?.map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ));
                                        }
                                        return null;
                                    })()}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[8px] text-muted font-black uppercase tracking-widest mb-1.5">Sort Order</label>
                                <select 
                                    value={sectionData.section_options?.dynamic_config?.sort_order || 'asc'} 
                                    onChange={e => {
                                        const config = sectionData.section_options?.dynamic_config || {};
                                        setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, sort_order: e.target.value } } });
                                    }}
                                    disabled={!sectionData.section_options?.dynamic_config?.sort_field}
                                    className="w-full bg-surface border border-border p-2 rounded text-[9px] font-bold outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="asc">Ascending</option>
                                    <option value="desc">Descending</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-accent/20 pb-1">
                            <label className="text-[9px] text-muted font-black uppercase tracking-[0.2em] opacity-60">Auto Customization</label>
                            <button 
                                type="button"
                                onClick={() => {
                                    const config = sectionData.section_options?.dynamic_config || {};
                                    const custom = config.customization || { rules: [] };
                                    const rules = [...(custom.rules || []), { target_column: '', action: 'add_tag', label: '', condition_field: '', condition_operator: 'equals', condition_value: '' }];
                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, customization: { ...custom, rules } } } });
                                }}
                                className="text-[8px] font-black uppercase tracking-widest text-accent hover:text-accent/80 transition-colors"
                            >
                                + Add Custom Rule
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            {(sectionData.section_options?.dynamic_config?.customization?.rules || []).map((rule: any, idx: number) => (
                                <div key={idx} className="p-3 bg-card border border-border rounded-lg space-y-3 relative group/custom">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const config = sectionData.section_options?.dynamic_config || {};
                                            const rules = config.customization.rules.filter((_: any, i: number) => i !== idx);
                                            setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, customization: { ...config.customization, rules } } } });
                                        }}
                                        className="absolute top-2 right-2 p-1 text-muted hover:text-danger opacity-0 group-hover/custom:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={10} />
                                    </button>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-[7px] text-muted font-black uppercase mb-1">Target Column</label>
                                            <select 
                                                value={rule.target_column}
                                                onChange={e => {
                                                    const config = sectionData.section_options?.dynamic_config || {};
                                                    const rules = [...config.customization.rules];
                                                    rules[idx] = { ...rules[idx], target_column: e.target.value };
                                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, customization: { ...config.customization, rules } } } });
                                                }}
                                                className="w-full bg-surface border border-border p-1 rounded text-[8px] font-bold outline-none"
                                            >
                                                <option value="">Select...</option>
                                                {(sectionData.columns || rosters.find(r => r.id === (sectionData.roster_id || activeDivId))?.columns || []).map((col: any) => (
                                                    <option key={col.id} value={col.id}>{col.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[7px] text-muted font-black uppercase mb-1">Action</label>
                                            <select 
                                                value={rule.action}
                                                onChange={e => {
                                                    const config = sectionData.section_options?.dynamic_config || {};
                                                    const rules = [...config.customization.rules];
                                                    rules[idx] = { ...rules[idx], action: e.target.value };
                                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, customization: { ...config.customization, rules } } } });
                                                }}
                                                className="w-full bg-surface border border-border p-1 rounded text-[8px] font-bold outline-none"
                                            >
                                                <option value="add_tag">Add Tag</option>
                                                <option value="add_checkbox">Add Checkbox</option>
                                                <option value="set_value">Set Value</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[7px] text-muted font-black uppercase mb-1">Label/Value</label>
                                            <input 
                                                value={rule.label}
                                                onChange={e => {
                                                    const config = sectionData.section_options?.dynamic_config || {};
                                                    const rules = [...config.customization.rules];
                                                    rules[idx] = { ...rules[idx], label: e.target.value };
                                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, customization: { ...config.customization, rules } } } });
                                                }}
                                                placeholder="e.g. Probation"
                                                className="w-full bg-surface border border-border p-1 rounded text-[8px] font-bold outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-border/50">
                                        <p className="text-[7px] font-black uppercase text-muted mb-2">Condition (Optional)</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <select 
                                                value={rule.condition_field}
                                                onChange={e => {
                                                    const config = sectionData.section_options?.dynamic_config || {};
                                                    const rules = [...config.customization.rules];
                                                    rules[idx] = { ...rules[idx], condition_field: e.target.value };
                                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, customization: { ...config.customization, rules } } } });
                                                }}
                                                disabled={!sectionData.section_options?.dynamic_config?.source_id}
                                                className="w-full bg-surface border border-border p-1 rounded text-[8px] font-bold outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <option value="">Select Field...</option>
                                                {(() => {
                                                    const sourceType = sectionData.section_options?.dynamic_config?.source_type;
                                                    const sourceId = sectionData.section_options?.dynamic_config?.source_id;
                                                    if (sourceType === 'database') {
                                                        return recordData.find(db => String(db.id) === String(sourceId))?.database_structure?.map((f: any) => (
                                                            <option key={f.id} value={f.id}>{f.name}</option>
                                                        ));
                                                    }
                                                    if (sourceType === 'section') {
                                                        const findSectionAndCols = (sections: any[]): any => {
                                                            for (const s of sections) {
                                                                if (String(s.id) === String(sourceId)) {
                                                                    const roster = targetRosters.find(r => r.id === s.roster_id);
                                                                    return s.use_roster_columns ? roster?.columns : s.columns;
                                                                }
                                                                if (s.children) {
                                                                    const found = findSectionAndCols(s.children);
                                                                    if (found) return found;
                                                                }
                                                            }
                                                            return null;
                                                        };
                                                        let cols = null;
                                                        for (const r of targetRosters) {
                                                            cols = findSectionAndCols(r.root_sections || []);
                                                            if (cols) break;
                                                        }
                                                        return cols?.map((c: any) => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ));
                                                    }
                                                    return null;
                                                })()}
                                            </select>
                                            <select 
                                                value={rule.condition_operator}
                                                onChange={e => {
                                                    const config = sectionData.section_options?.dynamic_config || {};
                                                    const rules = [...config.customization.rules];
                                                    rules[idx] = { ...rules[idx], condition_operator: e.target.value };
                                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, customization: { ...config.customization, rules } } } });
                                                }}
                                                className="w-full bg-surface border border-border p-1 rounded text-[8px] font-bold outline-none"
                                            >
                                                <option value="equals">Equals</option>
                                                <option value="not_equals">Not Equals</option>
                                                <option value="contains">Contains</option>
                                                <option value="not_contains">Not Contains</option>
                                                <option value="starts_with">Starts With</option>
                                                <option value="ends_with">Ends With</option>
                                                <option value="exists">Exists</option>
                                                <option value="not_exists">Not Exists</option>
                                                <option value="is_numeric">Is Numeric</option>
                                                <option value="greater_than">Greater Than</option>
                                                <option value="less_than">Less Than</option>
                                                <option value="is_today">Is Today</option>
                                                <option value="is_past">Is Past</option>
                                                <option value="is_future">Is Future</option>
                                            </select>
                                            <input 
                                                value={rule.condition_value}
                                                onChange={e => {
                                                    const config = sectionData.section_options?.dynamic_config || {};
                                                    const rules = [...config.customization.rules];
                                                    rules[idx] = { ...rules[idx], condition_value: e.target.value };
                                                    setSectionData({ ...sectionData, section_options: { ...sectionData.section_options, dynamic_config: { ...config, customization: { ...config.customization, rules } } } });
                                                }}
                                                placeholder="Value"
                                                className="w-full bg-surface border border-border p-1 rounded text-[8px] font-bold outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              )}

              {sectionData.id && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <label className="block text-[9px] text-muted font-black uppercase tracking-[0.2em] mb-2 opacity-50">Management Actions</label>
                  <div className="flex flex-wrap gap-2">
                    <button 
                        type="button" 
                        onClick={() => {
                            setShowSectionColumnsModal(sectionData);
                            setShowSectionModal(false);
                        }} 
                        className="flex-1 px-3 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded font-bold text-[9px] uppercase tracking-widest transition flex items-center justify-center gap-1.5 min-w-[100px]"
                    >
                        <Settings2 size={11} /> Columns
                    </button>
                    {sectionData.type !== 'subsection' && (
                        <button 
                            type="button" 
                            onClick={() => {
                                setShowSectionLayoutModal(sectionData);
                                setShowSectionModal(false);
                            }} 
                            className="flex-1 px-3 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded font-bold text-[9px] uppercase tracking-widest transition flex items-center justify-center gap-1.5 min-w-[100px]"
                        >
                            <Layout size={11} /> Layout
                        </button>
                    )}
                    {sectionData.type !== 'master' && (
                        <button 
                            type="button" 
                            onClick={() => handleDeleteSection(sectionData.id!)} 
                            className="px-3 py-2 bg-danger/10 hover:bg-danger/20 text-danger rounded font-bold text-[9px] uppercase tracking-widest transition min-w-[80px]"
                        >
                            Delete
                        </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowSectionModal(false)} className="flex-1 px-4 py-3 bg-surface hover:bg-bg border border-border text-text rounded font-bold text-xs uppercase tracking-widest transition">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded font-bold text-xs uppercase tracking-widest transition disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVariablesModal && (
          <GlobalVariablesModal 
            shortname={shortname} 
            onClose={() => setShowVariablesModal(false)} 
          />
      )}

      {showFlagsModal && (
          <FlagManagerModal 
            shortname={shortname} 
            onClose={() => setShowFlagsModal(false)} 
          />
      )}

      {showLayoutModal && (
          <RosterLayoutModal 
            roster={showLayoutModal}
            onClose={() => setShowLayoutModal(null)}
            onSave={() => {
                setShowLayoutModal(null);
                fetchRosters();
            }}
          />
      )}

      {showSectionLayoutModal && (
          <SectionLayoutModal 
            section={showSectionLayoutModal}
            rosterId={showSectionLayoutModal.roster_id || activeDivId}
            onClose={() => setShowSectionLayoutModal(null)}
            onSave={() => {
                setShowSectionLayoutModal(null);
                fetchRosters();
            }}
          />
      )}

      {showTemplateModal && (
          <RosterTemplateModal 
            shortname={shortname!}
            onClose={() => setShowTemplateModal(false)}
          />
      )}

      {showCountsModal && (
          <CountManagerModal 
            target={showCountsModal.target}
            type={showCountsModal.type}
            shortname={shortname!}
            columns={(() => {
                const rosterId = showCountsModal.type === 'roster' ? showCountsModal.target.id : (showCountsModal.target.roster_id || activeDivId);
                const roster = rosters.find(r => r.id === rosterId);
                if (!roster) return [];
                
                // Get roster columns
                let cols = [...(roster.columns || [])];
                
                // Get all section-specific columns
                const getSectionCols = (sections: any[]) => {
                    sections.forEach(s => {
                        if (!s.use_roster_columns && s.columns) {
                            cols.push(...s.columns);
                        }
                        if (s.children) getSectionCols(s.children);
                    });
                };
                getSectionCols(roster.root_sections || []);
                
                return cols;
            })()}
            flags={activeFlagsList}
            allSections={(() => {
                const rosterId = showCountsModal.type === 'roster' ? showCountsModal.target.id : (showCountsModal.target.roster_id || activeDivId);
                const roster = rosters.find(r => r.id === rosterId);
                if (!roster) return [];
                const flatten = (sections: any[]): any[] => {
                    let res: any[] = [];
                    sections.forEach(s => {
                        res.push({ id: s.id, name: s.name });
                        if (s.children) res.push(...flatten(s.children));
                    });
                    return res;
                };
                return flatten(roster.root_sections || []);
            })()}
            onClose={() => setShowCountsModal(null)}
            onSave={() => {
                setShowCountsModal(null);
                fetchRosters();
            }}
          />
      )}
    </div>
  );
};

export default FactionRoster;

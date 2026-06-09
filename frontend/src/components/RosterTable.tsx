import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { RosterContent, RosterColumn } from '../types';
import { motion, Reorder } from 'motion/react';
import { Plus, Trash2, Check, X, Pencil, Tag, ExternalLink, GripVertical, SeparatorHorizontal, Settings2 } from 'lucide-react';
import * as LucideIcons from '../icons';
import api from '../api';
import toast from 'react-hot-toast';
import { hexToRgb } from '../utils';
import { LinkedDataModal } from './LinkedDataModal';

const CellScaler: React.FC<{ children: React.ReactNode, className?: string, tooltipContent?: React.ReactNode, forceShowTooltip?: boolean, disabled?: boolean }> = ({ children, className, tooltipContent, forceShowTooltip, disabled }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [hovered, setHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const scrollingText = localStorage.getItem('roster-scrolling-text') === 'true';
    const isOverflowing = scale < 1;

    const updateScale = useCallback(() => {
        if (!containerRef.current || !contentRef.current) return;
        const containerWidth = containerRef.current.offsetWidth - 2;
        const contentWidth = contentRef.current.scrollWidth;
        if (contentWidth > containerWidth && containerWidth > 0) {
            setScale(containerWidth / contentWidth);
        } else {
            setScale(1);
        }
    }, []);

    useLayoutEffect(() => {
        updateScale();
    }, [children, updateScale]);

    useEffect(() => {
        const observer = new ResizeObserver(updateScale);
        if (containerRef.current) observer.observe(containerRef.current);
        if (contentRef.current) observer.observe(contentRef.current);
        return () => observer.disconnect();
    }, [updateScale]);

    const handleMouseEnter = (e: React.MouseEvent) => {
        if (disabled) return;
        if (!isOverflowing && !forceShowTooltip) return;
        setHovered(true);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 6 });
    };

    const handleMouseLeave = () => setHovered(false);

    const fullText = contentRef.current?.textContent ?? '';
    const renderTooltip = () => {
        if (disabled || !hovered || (!isOverflowing && !forceShowTooltip)) return null;
        if (tooltipContent) {
            return createPortal(
                <div
                    className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full"
                    style={{ left: tooltipPos.x, top: tooltipPos.y }}
                >
                    {tooltipContent}
                </div>,
                document.body
            );
        }
        if (fullText) {
            return createPortal(
                <div
                    className="fixed z-[9999] px-2 py-1 bg-card border border-border rounded shadow-lg text-xs font-medium pointer-events-none -translate-x-1/2 -translate-y-full"
                    style={{ left: tooltipPos.x, top: tooltipPos.y }}
                >
                    {fullText}
                </div>,
                document.body
            );
        }
        return null;
    };

    if (scrollingText && isOverflowing) {
        const overflow = (containerRef.current?.offsetWidth ?? 0) - (contentRef.current?.scrollWidth ?? 0);
        const duration = Math.max(1.5, Math.abs(overflow) / 40);
        return (
            <>
                <div
                    ref={containerRef}
                    className={`w-full h-full flex items-center justify-center overflow-hidden ${className}`}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div
                        ref={contentRef}
                        className="whitespace-nowrap"
                        style={{
                            transform: hovered ? `translateX(${overflow}px)` : 'translateX(0)',
                            transition: hovered ? `transform ${duration}s linear` : 'transform 0.3s ease-in-out',
                        }}
                    >
                        {children}
                    </div>
                </div>
                {renderTooltip()}
            </>
        );
    }

    return (
        <>
            <div
                ref={containerRef}
                className={`w-full h-full flex items-center justify-center overflow-visible ${className}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div
                    ref={contentRef}
                    className="flex flex-col items-center justify-center whitespace-nowrap"
                    style={{
                        transform: isOverflowing ? `scale(${scale})` : undefined,
                        transformOrigin: 'center',
                        width: 'max-content'
                    }}
                >
                    {children}
                </div>
            </div>
            {renderTooltip()}
        </>
    );
};

interface RosterTableProps {
  sectionId: number;
  contents: RosterContent[];
  allContents?: RosterContent[];
  user?: any;
  columns?: RosterColumn[];
  datasets?: any[];
  recordData?: any[];
  isLeadership?: boolean;
  accentColor?: string;
  editMode?: boolean;
  canModerate?: boolean;
  permissions?: any;
  flags?: any[];
  allColumns?: Map<string, any>;
  onUpdateRow?: (id: number, data: any, force?: boolean, lastUpdatedAt?: string | null) => void;
  onDeleteRow?: (id: number) => void;
  onBulkDeleteRow?: (ids: number[]) => void;
  onAddRow?: () => void;
  onAddSpacer?: () => void;
  onRefresh?: () => void;
  onReorderRows?: (newOrder: any[]) => void;
  globalEditingRowId?: number | null;
  setGlobalEditingRowId?: (id: number | null) => void;
  saveTrigger?: number;
  syncedHeights?: { [key: number]: number };
  onRowHeightSync?: (index: number, height: number, hasCheckbox: boolean) => void;
  isDynamic?: boolean;
}

const getResolvedDisplayValue = (
    rowId: number,
    colId: string,
    rawValue: any,
    col: any,
    datasets: any[],
    recordData: any[],
    resolvedLinks: Map<string, any>
) => {
    if (rawValue === null || rawValue === undefined || rawValue === '') return '';

    if (col?.type?.includes('linked_roster_data')) {
        const resolved = resolvedLinks.get(`${rowId}_${colId}`);
        if (resolved) return resolved;
        if (rawValue && typeof rawValue === 'object' && rawValue.roster_id && rawValue.row_id && rawValue.col_id) {
            return '-';
        }
        return String(rawValue);
    }

    if (col?.dataset_id) {
        const boundDataset = datasets.find(d => d.id === col.dataset_id);
        if (boundDataset) {
            let option = boundDataset.options?.find((o: any) => String(o.id) === String(rawValue));
            if (!option && boundDataset.record_database_id) {
                const db = recordData.find(d => d.id === boundDataset.record_database_id);
                if (db && db.entries) {
                    const entry = db.entries.find((e: any) => {
                        if (String(e.entry_id) === String(rawValue)) return true;
                        let fieldId = col.database_field_id || db.database_structure?.[0]?.id;
                        const displayVal = (fieldId === 'id') ? String(e.entry_id) : e.data?.[fieldId];
                        return String(displayVal) === String(rawValue);
                    });
                    if (entry) {
                        return String(entry.data?.[col.database_field_id || ''] || entry.entry_id);
                    }
                }
            }
            if (option) return option.value;
        }
    }

    if (typeof rawValue === 'object') return '-';
    return String(rawValue);
};

export const RosterTable: React.FC<RosterTableProps> = ({ 
  sectionId,
  contents, 
  allContents,
  user,
  columns, 
  datasets = [],
  recordData = [],
  isLeadership, 
  accentColor, 
  editMode,
  canModerate,
  permissions,
  flags = [],
  allColumns,
  onUpdateRow,
  onDeleteRow,
  onBulkDeleteRow,
  onAddRow,
  onAddSpacer,
  onRefresh,
  onReorderRows,
  globalEditingRowId,
  setGlobalEditingRowId,
  saveTrigger,
  syncedHeights,
  onRowHeightSync,
  isDynamic = false
}) => {
  const { shortname } = useParams<{ shortname: string }>();
  const canEditDefined = !isDynamic && (canModerate || permissions?.edit_defined_fields);
  const canEditPredefined = !isDynamic && (canModerate || permissions?.edit_predefined);
  const canEditAny = canEditDefined || canEditPredefined;

  const activeCols = columns && columns.length > 0 ? columns : [
    { id: 'rank', name: 'Rank', type: 'dropdown', checkboxes: ['Acting'] },
    { id: 'name', name: 'Name', type: 'text', checkboxes: ['LOA'] },
    { id: 'position', name: 'Position', type: 'text', checkboxes: [] },
    { id: 'callsign', name: 'Callsign', type: 'text', checkboxes: [] }
  ];

  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [savingRows, setSavingRows] = useState<Map<number, string>>(new Map());
  const tableRef = useRef<HTMLTableElement>(null);
  const lastProcessedSaveTrigger = useRef(0);
  const [editData, setEditData] = useState<any>({});
  const [activeTagMenu, setActiveTagMenu] = useState<{ rowId: number, colId: string } | null>(null);
  const [linkedDataModal, setLinkedDataModal] = useState<{ rowId: number, colId: string, initialData?: any } | null>(null);
  const [resolvedLinks, setResolvedLinks] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    // Resolve links when contents or editData change
    const linksToResolve: any[] = [];
    const collectLinks = (rows: RosterContent[]) => {
        rows.forEach(row => {
            activeCols.forEach(col => {
                if (col.type?.includes('linked_roster_data')) {
                    const val = (editingRowId === row.id && editingColId === col.id) ? editData[col.id] : row.content?.[col.id];
                    if (val && typeof val === 'object' && val.roster_id && val.row_id && val.col_id) {
                        linksToResolve.push({ rowId: row.id, colId: col.id, config: val });
                    }
                }
            });
        });
    };
    collectLinks(contents);

    if (linksToResolve.length > 0) {
        const fetchLinks = async () => {
            try {
                const res = await api.post('/rosters/resolve-links', { links: linksToResolve.map(l => l.config) });
                const newResolved = new Map(resolvedLinks);
                res.data.results.forEach((val: any, idx: number) => {
                    const link = linksToResolve[idx];
                    newResolved.set(`${link.rowId}_${link.colId}`, val);
                });
                setResolvedLinks(newResolved);
            } catch (err) {
                console.error('Failed to resolve links', err);
            }
        };
        fetchLinks();
    }
  }, [contents, editData, activeCols, editingRowId, editingColId]);

  useEffect(() => {
    if (globalEditingRowId !== editingRowId) {
        setEditingRowId(null);
        setEditingColId(null);
        setRowColor(null);
        setLastUpdatedAt(null);
        setEditData({});
    }
  }, [globalEditingRowId]);

  const [rowColor, setRowColor] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!onRowHeightSync || !tableRef.current) return;

    const observer = new ResizeObserver((entries) => {
        entries.forEach(entry => {
            const tr = entry.target as HTMLTableRowElement;
            const idx = parseInt(tr.getAttribute('data-row-index') || '-1');
            const hasCheckbox = tr.getAttribute('data-has-checkbox') === 'true';
            
            if (idx !== -1) {
                onRowHeightSync(idx, entry.contentRect.height, hasCheckbox);
            }
        });
    });

    const rows = tableRef.current.querySelectorAll('tbody tr.rt-tr');
    rows.forEach(r => observer.observe(r));

    return () => observer.disconnect();
  }, [contents, onRowHeightSync, editingRowId, editData, syncedHeights]);

  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [rowCountToAdd, setRowCountToAdd] = useState(1);
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null);
  const [showBulkColorPicker, setShowBulkColorPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<'top' | 'bottom'>('top');
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const [tagMenuCoords, setTagMenuCoords] = useState({ top: 0, left: 0 });
  const [tagPickerPosition, setTagPickerPosition] = useState<'top' | 'bottom'>('bottom');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenColorPicker = (e: React.MouseEvent, rowId: number) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const isTop = spaceBelow < 250;
    const pickerHalfWidth = 90; // Half of 180px min-width
    
    setPickerPosition(isTop ? 'top' : 'bottom');
    
    let left = rect.left + (rect.width / 2) - pickerHalfWidth;
    
    // Boundary check: Right edge
    if (left + (pickerHalfWidth * 2) > window.innerWidth - 20) {
        left = window.innerWidth - (pickerHalfWidth * 2) - 20;
    }
    // Boundary check: Left edge
    if (left < 20) {
        left = 20;
    }

    setMenuCoords({
        top: isTop ? rect.top : rect.bottom,
        left: left
    });
    setShowColorPicker(showColorPicker === rowId ? null : rowId);
    setShowBulkColorPicker(false);
  };

  const handleOpenTagMenu = (e: React.MouseEvent, rowId: number, colId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const isTop = spaceBelow < 200; // Tag picker is smaller than color picker, say 200px
    
    setTagPickerPosition(isTop ? 'top' : 'bottom');
    
    let left = rect.left;
    if (left + 140 > window.innerWidth) {
        left = window.innerWidth - 140;
    }
    if (left < 10) {
        left = 10;
    }

    setTagMenuCoords({
        top: isTop ? rect.top : rect.bottom,
        left: left
    });
    
    setActiveTagMenu(activeTagMenu?.rowId === rowId && activeTagMenu?.colId === colId ? null : { rowId, colId });
  };

  const handleOpenBulkColorPicker = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const isTop = spaceBelow < 250;
    const pickerHalfWidth = 100; // Half of 200px min-width

    setPickerPosition(isTop ? 'top' : 'bottom');
    
    let left = rect.left + (rect.width / 2) - pickerHalfWidth;

    // Boundary check: Right edge
    if (left + (pickerHalfWidth * 2) > window.innerWidth - 20) {
        left = window.innerWidth - (pickerHalfWidth * 2) - 20;
    }
    // Boundary check: Left edge
    if (left < 20) {
        left = 20;
    }

    setMenuCoords({
        top: isTop ? rect.top : rect.bottom,
        left: left
    });
    setShowBulkColorPicker(!showBulkColorPicker);
    setShowColorPicker(null);
  };

  const handleBulkColorUpdate = async (color: string | null) => {
    if (selectedRowIds.length === 0) return;
    
    const loadToast = toast.loading(`Applying color to ${selectedRowIds.length} rows...`);
    try {
        const updates = selectedRowIds.map(id => ({
            id,
            color
        }));
        
        await api.put(`/sections/${sectionId}/contents/batch`, { contents: updates });
        toast.success('Bulk color applied', { id: loadToast });
        setSelectedRowIds([]);
        setShowBulkColorPicker(false);
        onRefresh?.();
    } catch (err) {
        toast.error('Failed to apply bulk color', { id: loadToast });
    }
  };

  const defaultRowColors = [
    { name: 'None', value: null },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Green', value: '#10b981' },
    { name: 'Emerald', value: '#059669' },
    { name: 'Teal', value: '#06b6d4' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Violet', value: '#8b5cf6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
  ];

  const baseResolvedValuesCache = React.useMemo(() => {
    const cache = new Map<string, string>();
    const safeAllContents = allContents || [];

    safeAllContents.forEach(row => {
      if (!row || !row.content) return;
      
      Object.entries(row.content).forEach(([colId, rawValue]) => {
        const col = allColumns?.get(colId) || activeCols.find(c => c.id === colId);
        const resolved = getResolvedDisplayValue(
          row.id,
          colId,
          rawValue,
          col,
          datasets,
          recordData,
          resolvedLinks
        );
        cache.set(`${row.id}_${colId}`, resolved.toLowerCase().trim());
      });
    });

    return cache;
  }, [allContents, allColumns, activeCols, datasets, recordData, resolvedLinks]);

  const resolvedValuesCache = React.useMemo(() => {
    const cache = new Map(baseResolvedValuesCache);
    
    if (editingRowId !== null) {
      Object.entries(editData).forEach(([colId, rawValue]) => {
        const col = allColumns?.get(colId) || activeCols.find(c => c.id === colId);
        const resolved = getResolvedDisplayValue(
          editingRowId,
          colId,
          rawValue,
          col,
          datasets,
          recordData,
          resolvedLinks
        );
        cache.set(`${editingRowId}_${colId}`, resolved.toLowerCase().trim());
      });
    }
    
    return cache;
  }, [baseResolvedValuesCache, editingRowId, editData, allColumns, activeCols, datasets, recordData, resolvedLinks]);

  const evaluateFlag = React.useCallback((row: RosterContent, col: RosterColumn, flag: any) => {
    // If the user does not have edit access to the roster, do not evaluate flags at all.
    const hasEditAccess = canModerate || permissions?.edit_defined_fields || permissions?.edit_predefined;
    if (!hasEditAccess) return false;

    if (!flag.rules || flag.rules.length === 0) return false;

    // If this is a hidden column and the user cannot view hidden data, do not evaluate flags on it.
    const isHidden = col.type && col.type.includes('hidden');
    const canViewHidden = canModerate || permissions?.view_hidden_data;
    if (isHidden && !canViewHidden) return false;

    const value = resolvedValuesCache.get(`${row.id}_${col.id}`) || '';
    if (value === '') return false;

    // Determine current raw value for orphaned_database_link
    const isThisRowEditing = editingRowId === row.id;
    const currentRowContent = isThisRowEditing ? { ...(row.content || {}), ...editData } : (row.content || {});
    const rawValue = currentRowContent[col.id];

    const boundDataset = col.dataset_id ? datasets.find(d => d.id === col.dataset_id) : null;

    return flag.rules.some((rule: any) => {
        switch (rule.type) {
            case 'equals':
                return value === (rule.value || '').toString().toLowerCase().trim();
            case 'not_equals':
                return value !== (rule.value || '').toString().toLowerCase().trim();
            case 'contains':
                return value.includes((rule.value || '').toString().toLowerCase().trim());
            case 'in_dataset':
                const dataset = datasets.find(d => Number(d.id) === Number(rule.dataset_id));
                return dataset?.options?.some((opt: any) => (opt.value || '').toString().toLowerCase().trim() === value);
            case 'not_in_dataset':
                const datasetNot = datasets.find(d => Number(d.id) === Number(rule.dataset_id));
                return !datasetNot?.options?.some((opt: any) => (opt.value || '').toString().toLowerCase().trim() === value);
            case 'exists_elsewhere':
                if (value === '' || value === '-' || value.startsWith('?')) return false;

                let pool: any[] = [];
                const safeAllContents = allContents || [];
                
                if (rule.scope === 'global') {
                    pool = safeAllContents;
                } else if (rule.scope === 'roster') {
                    const currentRosterId = row.roster_id || safeAllContents.find(c => Number(c.id) === Number(row.id))?.roster_id;
                    if (!currentRosterId) return false;
                    pool = safeAllContents.filter(c => Number(c.roster_id) === Number(currentRosterId));
                } else {
                    pool = contents;
                }

                const excludedRosterIds = (flag.excluded_roster_ids || []).map((id: any) => Number(id));
                const excludedSectionIds = (col.flag_settings?.[flag.id]?.excluded_section_ids || []).map((id: any) => Number(id));

                return pool.some(c => {
                    if (Number(c.id) === Number(row.id)) return false;
                    if (c.roster_id && excludedRosterIds.includes(Number(c.roster_id))) return false;
                    if (c.section_id && excludedSectionIds.includes(Number(c.section_id))) return false;

                    if (rule.target_col) {
                        const otherVal = resolvedValuesCache.get(`${c.id}_${rule.target_col}`) || '';
                        return otherVal === value && otherVal !== '' && otherVal !== '-' && !otherVal.startsWith('?');
                    }
                    
                    const targetContent = c.content || {};
                    return Object.keys(targetContent)
                        .filter(targetColId => !targetColId.endsWith('_cb') && !targetColId.endsWith('_tags'))
                        .some(targetColId => {
                            const otherVal = resolvedValuesCache.get(`${c.id}_${targetColId}`) || '';
                            return otherVal === value && otherVal !== '' && otherVal !== '-' && !otherVal.startsWith('?');
                        });
                });
            case 'orphaned_database_link':
                if (!boundDataset?.record_database_id) return false;

                if (!rule.flag_regardless_of_manual_addition) {
                    if (!rawValue || (isNaN(Number(rawValue)) && !String(rawValue).startsWith('temp_') && !String(rawValue).startsWith('opt_'))) return false;
                } else {
                    if (!rawValue) return false;
                }

                let option = boundDataset?.options?.find((o: any) => String(o.id) === String(rawValue));
                if (!option && boundDataset?.record_database_id) {
                    const db = recordData.find(d => d.id === boundDataset.record_database_id);
                    if (db && db.entries) {
                        const entry = db.entries.find((e: any) => {
                            if (String(e.entry_id) === String(rawValue)) return true;
                            let fieldId = col.database_field_id || db.database_structure?.[0]?.id;
                            const displayVal = (fieldId === 'id') ? String(e.entry_id) : e.data?.[fieldId];
                            return String(displayVal) === String(rawValue);
                        });

                        if (entry) {
                            option = { id: entry.entry_id, value: entry.data?.[col.database_field_id || ''] || entry.entry_id };
                        }
                    }
                }
                return !option;
            default:
                return false;
        }
    });
  }, [datasets, contents, allContents, editingRowId, editData, recordData, canModerate, permissions, resolvedLinks, resolvedValuesCache]);

  const handleBulkAdd = () => {
    const count = Math.min(Math.max(1, rowCountToAdd), 20);
    for(let i = 0; i < count; i++) {
        onAddRow?.();
    }
    setRowCountToAdd(1);
  };

  const handleBulkDelete = () => {
    if (selectedRowIds.length === 0) return;
    
    if (onBulkDeleteRow) {
        toast((t) => (
            <div className="flex flex-col gap-1 text-left">
                <p className="font-bold text-xs uppercase">Delete {selectedRowIds.length} rows?</p>
                <p className="text-[9px] opacity-80 uppercase tracking-tighter">This action cannot be undone.</p>
                <div className="flex gap-2 justify-end mt-2">
                    <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1 bg-surface hover:bg-bg border border-border rounded text-[9px] font-bold uppercase transition">Cancel</button>
                    <button 
                        onClick={async () => {
                            toast.dismiss(t.id);
                            await onBulkDeleteRow(selectedRowIds);
                            setSelectedRowIds([]);
                        }}
                        className="px-2 py-1 bg-danger text-white hover:bg-danger/90 rounded text-[9px] font-bold uppercase transition shadow-lg shadow-danger/20"
                    >
                        Delete All
                    </button>
                </div>
            </div>
        ), { duration: 6000, position: 'top-center' });
        return;
    }

    toast((t) => (
        <div className="flex flex-col gap-1 text-left">
            <p className="font-bold text-xs uppercase">Delete {selectedRowIds.length} rows?</p>
            <p className="text-[9px] opacity-80 uppercase tracking-tighter">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1 bg-surface hover:bg-bg border border-border rounded text-[9px] font-bold uppercase transition">Cancel</button>
                <button 
                    onClick={async () => {
                        toast.dismiss(t.id);
                        const loadToast = toast.loading(`Deleting ${selectedRowIds.length} rows...`);
                        try {
                            for (const id of selectedRowIds) {
                                await onDeleteRow?.(id);
                            }
                            setSelectedRowIds([]);
                            toast.success('Bulk deletion complete', { id: loadToast });
                        } catch (err) {
                            toast.error('Partial failure during bulk delete', { id: loadToast });
                        }
                    }}
                    className="px-2 py-1 bg-danger text-white hover:bg-danger/90 rounded text-[9px] font-bold uppercase transition shadow-lg shadow-danger/20"
                >
                    Delete All
                </button>
            </div>
        </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const toggleSelectRow = (id: number) => {
    setSelectedRowIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.length === contents.length) {
        setSelectedRowIds([]);
    } else {
        setSelectedRowIds(contents.map(c => c.id));
    }
  };

  useEffect(() => {
    if (editingRowId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingRowId, editingColId]);

  const handleStartEdit = (row: RosterContent, colId: string) => {
    if (!canEditAny) return;

    const isDifferentRow = editingRowId !== row.id;

    // If another row is being edited, save it first
    if (isDifferentRow && editingRowId) {
        const rowIdToSave = editingRowId;
        const dataToSave = { 
            content: { ...editData }, 
            color: rowColor 
        };
        const updatedAt = lastUpdatedAt;
        
        onUpdateRow?.(rowIdToSave, dataToSave, false, updatedAt);
        api.post(`/contents/${rowIdToSave}/unlock`).catch(() => {});
    }

    // Only reset data and lock if we are switching to a NEW row
    if (isDifferentRow) {
        setEditData(row.content || {});
        setRowColor(row.color || null);
        setLastUpdatedAt(row.updated_at || null);
        
        // Passive locking - only once per row session
        api.post(`/contents/${row.id}/lock`, { col_id: colId }).catch(() => {});
    }

    setGlobalEditingRowId?.(row.id);
    setEditingRowId(row.id);
    setEditingColId(colId);
  };

  const handleSaveEdit = useCallback(async (rowId: number, colorOverride?: string | null) => {
    // Only save if this is the row we are actually editing
    if (editingRowId !== rowId) return;

    const dataToSave = { 
        content: { ...editData }, 
        color: colorOverride !== undefined ? colorOverride : rowColor 
    };
    const colId = editingColId;
    const updatedAt = lastUpdatedAt;

    // Clear editing state first to prevent double-saves or race conditions
    setGlobalEditingRowId?.(null);
    setEditingRowId(null);
    setEditingColId(null);
    setLastUpdatedAt(null);
    setActiveTagMenu(null);
    setShowColorPicker(null);

    if (colId) {
        setSavingRows(prev => new Map(prev).set(rowId, colId));
    }

    try {
        await onUpdateRow?.(rowId, dataToSave, false, updatedAt);
    } catch (err: any) {
        console.error('Failed to save row', err);
    } finally {
        setSavingRows(prev => {
            const next = new Map(prev);
            next.delete(rowId);
            return next;
        });
        // We don't reset editData to {} here immediately, 
        // handleStartEdit will handle re-initialization for the next row.
        setRowColor(null);
    }
  }, [editingRowId, editData, rowColor, editingColId, lastUpdatedAt, onUpdateRow, setGlobalEditingRowId]);

  useEffect(() => {
    if (saveTrigger && saveTrigger > lastProcessedSaveTrigger.current) {
        lastProcessedSaveTrigger.current = saveTrigger;
        if (editingRowId) {
            handleSaveEdit(editingRowId);
        }
    }
  }, [saveTrigger, editingRowId, handleSaveEdit]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.color-picker-window')) return;
        
        if (showColorPicker !== null) {
            handleSaveEdit(showColorPicker);
        }
        
        setShowBulkColorPicker(false);
        setShowColorPicker(null);
    };
    if (showBulkColorPicker || showColorPicker !== null) {
        const timer = setTimeout(() => {
            window.addEventListener('click', handleGlobalClick);
        }, 0);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('click', handleGlobalClick);
        };
    }
  }, [showBulkColorPicker, showColorPicker, handleSaveEdit]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.tag-menu-window') || target.closest('.tag-pencil-button')) return;
        setActiveTagMenu(null);
    };
    if (activeTagMenu !== null) {
        const timer = setTimeout(() => {
            window.addEventListener('click', handleGlobalClick);
        }, 0);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('click', handleGlobalClick);
        };
    }
  }, [activeTagMenu]);

  const handleCancelEdit = async () => {
    const id = editingRowId;
    setGlobalEditingRowId?.(null);
    setEditingRowId(null);
    setEditingColId(null);
    setRowColor(null);
    setLastUpdatedAt(null);
    setEditData({});
    setActiveTagMenu(null);
    setShowColorPicker(null);

    if (id) {
        api.post(`/contents/${id}/unlock`).catch(() => {});
    }
  };
  
  // REMOVED handleRowBlur auto-save as it causes race conditions during same-row navigation

  const updateField = (colId: string, value: any) => {
    let newData = { ...editData, [colId]: value };

    // Auto-apply checkboxes/tags if this column is linked to a database
    const col = activeCols.find(c => c.id === colId);
    if (col && col.dataset_id) {
        const dataset = datasets.find(d => d.id === col.dataset_id);
        if (dataset && dataset.record_database_id) {
            const db = recordData.find(d => d.id === dataset.record_database_id);
            if (db && db.entries) {
                // Find matching entry
                const fieldId = col.database_field_id || db.database_structure?.[0]?.id;
                const entry = db.entries.find((e: any) => {
                    if (String(e.entry_id) === String(value)) return true;
                    const entryValue = (fieldId === 'id') ? String(e.entry_id) : e.data?.[fieldId];
                    return String(entryValue) === String(value);
                });

                if (entry) {
                    // Re-evaluate checkboxes
                    if (col.checkboxes && col.checkboxes.length > 0) {
                        const cbKey = `${col.id}_cb`;
                        const currentCbs = [...(newData[cbKey] || [])];
                        let changed = false;

                        col.checkboxes.forEach((cb: any) => {
                            if (typeof cb === 'object' && (cb.auto_apply || cb.auto_apply_field)) {
                                const db_column = cb.auto_apply_field || cb.auto_apply?.db_column;
                                const match_value = cb.auto_apply_value !== undefined ? cb.auto_apply_value : cb.auto_apply?.match_value;
                                
                                const dbVal = (db_column === 'id') ? String(entry.entry_id) : entry.data?.[db_column];
                                
                                let isMatch = false;
                                if (match_value) {
                                    isMatch = dbVal && dbVal.toString().toLowerCase().includes((match_value || '').toString().toLowerCase());
                                } else {
                                    isMatch = !!dbVal;
                                }
                                
                                const label = cb?.label;
                                if (!label) return;
                                
                                if (isMatch && !currentCbs.includes(label)) {
                                    currentCbs.push(label);
                                    changed = true;
                                } else if (!isMatch && currentCbs.includes(label)) {
                                    const idx = currentCbs.indexOf(label);
                                    currentCbs.splice(idx, 1);
                                    changed = true;
                                }
                            }
                        });

                        if (changed) newData[cbKey] = currentCbs;
                    }

                    // Re-evaluate tags
                    if (col.tags && col.tags.length > 0) {
                        const tagKey = `${col.id}_tags`;
                        const currentTags = [...(newData[tagKey] || [])];
                        let changed = false;

                        col.tags.forEach((tag: any) => {
                            if (typeof tag === 'object' && (tag.auto_apply || tag.auto_apply_field)) {
                                const db_column = tag.auto_apply_field || tag.auto_apply?.db_column;
                                const match_value = tag.auto_apply_value !== undefined ? tag.auto_apply_value : tag.auto_apply?.match_value;
                                
                                const dbVal = (db_column === 'id') ? String(entry.entry_id) : entry.data?.[db_column];
                                
                                let isMatch = false;
                                if (match_value) {
                                    isMatch = dbVal && dbVal.toString().toLowerCase().includes((match_value || '').toString().toLowerCase());
                                } else {
                                    isMatch = !!dbVal;
                                }
                                
                                const label = tag?.label;
                                if (!label) return;

                                if (isMatch && !currentTags.includes(label)) {
                                    currentTags.push(label);
                                    changed = true;
                                } else if (!isMatch && currentTags.includes(label)) {
                                    const idx = currentTags.indexOf(label);
                                    currentTags.splice(idx, 1);
                                    changed = true;
                                }
                            }
                        });

                        if (changed) newData[tagKey] = currentTags;
                    }
                }
            }
        }
    }

    setEditData(newData);
  };

  const toggleCheckbox = (colId: string, cb: string) => {
    setHasTyped(false);
    const key = `${colId}_cb`;
    const current = editData[key] || [];
    const next = current.includes(cb) ? current.filter((c: string) => c !== cb) : [...current, cb];
    setEditData({ ...editData, [key]: next });
  };

  const toggleTag = (colId: string, tag: string) => {
    setHasTyped(false);
    const key = `${colId}_tags`;
    const current = editData[key] || [];
    const next = current.includes(tag) ? current.filter((t: string) => t !== tag) : [...current, tag];
    setEditData({ ...editData, [key]: next });
  };

  const isColEditable = (col: RosterColumn) => {
    const isHidden = col.type.includes('hidden');
    const canViewHidden = canModerate || permissions?.view_hidden_data;
    
    if (isHidden && !canViewHidden) return false;
    if (col.type === 'autofill') return false;

    if (editMode && canEditPredefined) return true;
    if (col.type.startsWith('predefined_') || col.type.includes('predefined')) {
        return canEditPredefined;
    }
    if (col.type === 'linked_roster_data') return canEditDefined;
    return canEditDefined;
  };

  const [focusedColId, setFocusedColId] = useState<string | null>(null);
  const [hasTyped, setHasTyped] = useState(false);

  const inlineCheckboxes = localStorage.getItem('roster-inline-checkboxes') === 'true';

  const renderCell = (row: RosterContent, col: RosterColumn) => {

    const isEditing = editingRowId === row.id;
    const isSaving = savingRows.has(row.id);
    let value = col.type === 'autofill' ? (col.autofill_value || '') : (isEditing ? editData[col.id] : (row.content?.[col.id] || ''));
    
    // Fallback: If value is an object but the column type is not linked, it's stale data
    if (value && typeof value === 'object' && col.type !== 'linked_roster_data') {
        value = '';
    }

    const checked = isEditing ? (editData[`${col.id}_cb`] || []) : (row.content?.[`${col.id}_cb`] || []);
    const appliedTags = isEditing ? (editData[`${col.id}_tags`] || []) : (row.content?.[`${col.id}_tags`] || []);

    const isLocked = !isEditing && row.editing_by && Number(row.editing_by) !== Number(user?.id) && row.editing_at && (new Date().getTime() - new Date(row.editing_at).getTime() < 60000);

    const isHiddenType = col.type.includes('hidden');
    const canViewHidden = canModerate || permissions?.view_hidden_data;
    
    const showValue = !isHiddenType || canViewHidden;

    const boundDataset = col.dataset_id ? datasets.find(d => d.id === col.dataset_id) : null;
    const datasetOptions = boundDataset?.options || [];
    
    let effectiveOptions = boundDataset 
      ? datasetOptions.map((o: any) => ({ id: o.id, label: o.value || '', color: o.color, bold: o.is_bold })) 
      : (col.options || []).map((o: any, idx: number) => ({ ...o, id: o.id || `manual_${idx}` }));

    // If dynamic dataset, pull from recordData
    if (boundDataset?.record_database_id) {
        const db = recordData.find(d => d.id === boundDataset.record_database_id);
        if (db && db.entries) {
            effectiveOptions = db.entries.map((entry: any) => {
                let fieldId = col.database_field_id;
                // Fallback to first field if no specific field is set or if it's pointing to a template name
                if (!fieldId || ['table', 'compact', 'cards', 'detailed', 'rows'].includes(fieldId)) {
                    fieldId = db.database_structure?.[0]?.id;
                }

                const field = db.database_structure?.find((f: any) => f.id === fieldId);
                
                let label = '';
                if (fieldId === 'id') label = String(entry.entry_id);
                else if (fieldId === 'created_at') label = new Date(entry.created_at).toLocaleDateString();
                else {
                    // Try ID first, then fallback to Name (for legacy data)
                    const rawLabel = entry.data?.[fieldId || ''] || entry.data?.[field?.name || ''] || `Entry #${entry.entry_id}`;
                    label = String(rawLabel);
                }
                
                return { id: entry.entry_id, label, color: null, bold: false, entryId: entry.entry_id, dbShortcode: db.record_shortcode || db.id };
            });
        }
    }

    const activeFlags = flags.filter(f => (col.flags || []).some(flagId => Number(flagId) === Number(f.id)) && evaluateFlag(row, col, f));

    const getRowName = () => {
        const nameCol = activeCols.find(c => c.id === 'name' || c.name.toLowerCase() === 'name');
        const nameColId = nameCol?.id || 'name';
        const nameValue = editingRowId === row.id ? (editData[nameColId] || editData.name) : (row.content?.[nameColId] || row.content?.name);
        return typeof nameValue === 'string' ? nameValue : '';
    };
    const rowName = getRowName();

    const isValueId = value && (!isNaN(Number(value)) || String(value).startsWith('temp_') || String(value).startsWith('opt_'));
    const selectedOpt = effectiveOptions.find(o => 
        String(o.id) === String(value) || (!isValueId && o.label === value)
    );

    let displayEditValue = value;
    if (isEditing && col.dataset_id && selectedOpt) {
        if (!hasTyped) {
            displayEditValue = selectedOpt.label;
        }
    }

    const getCellDisplayValue = () => {
        // Always return redacted placeholder for hidden columns when user lacks permission
        if (!showValue) return '??????';

        if (col.type?.includes('database_data') && col.source_column_id) {
            const sourceCol = activeCols.find(c => c.id === col.source_column_id);
            let sourceValue = isEditing ? editData[sourceCol?.id || ''] : (row.content?.[sourceCol?.id || ''] || '');
            if (sourceCol?.type?.includes('linked_roster_data')) {
                sourceValue = resolvedLinks.get(`${row.id}_${sourceCol.id}`) || '';
            }
            if (sourceValue) {
                const sourceDataset = datasets.find(d => d.id === sourceCol?.dataset_id);
                const db = recordData.find(d => d.id === sourceDataset?.record_database_id);
                if (db && db.entries) {
                    const entry = db.entries.find((e: any) => {
                        if (String(e.entry_id) === String(sourceValue)) return true;
                        let fieldId = sourceCol?.database_field_id;
                        if (!fieldId || ['table', 'compact', 'cards', 'detailed', 'rows'].includes(fieldId)) {
                            fieldId = db.database_structure?.[0]?.id;
                        }
                        const label = (fieldId === 'id') ? String(e.entry_id) : 
                                     (fieldId === 'created_at') ? new Date(e.created_at).toLocaleDateString() :
                                     e.data?.[fieldId || ''];
                        return String(label) === String(sourceValue);
                    });
                    if (entry) {
                        const fieldId = col.data_field_id;
                        if (fieldId === 'id') return String(entry.entry_id);
                        if (fieldId === 'created_at') return new Date(entry.created_at).toLocaleDateString();
                        return String(entry.data?.[fieldId || ''] || '-');
                    }
                }
            }
            if (!canEditAny && row.content?.[col.id]) return String(row.content[col.id]);
            return '-';
        }
        if (col.type?.includes('linked_roster_data')) {
            const resolvedValue = resolvedLinks.get(`${row.id}_${col.id}`);
            if (resolvedValue) return resolvedValue;
            if (row.content?.[col.id] && typeof row.content[col.id] !== 'object') {
                return String(row.content[col.id]);
            }
            return '-';
        }
        return selectedOpt?.label || String(value) || '-';
    };
    const cellDisplayValue = getCellDisplayValue();

    const legendItems: { icon: React.ReactNode, label: string }[] = [];

    // Only populate legend items when the user is allowed to see the cell value.
    // Flags/tags/checkboxes on hidden columns must not be exposed via the tooltip.
    if (showValue) {
        activeFlags.forEach(f => {
            const IconComponent = (LucideIcons as any)[f.icon] || LucideIcons.HelpCircle;
            legendItems.push({
                icon: <IconComponent size={10} style={{ color: f.color }} />,
                label: f.name
            });
        });

        appliedTags.forEach((tagLabel: string) => {
            const tagDef = col.tags?.find(t => (typeof t === 'string' ? t : t?.label) === tagLabel);
            const tagColor = (tagDef && typeof tagDef !== 'string') ? tagDef.color : '#fff';
            const tagIconName = (tagDef && typeof tagDef !== 'string') ? tagDef.icon : null;
            
            let icon;
            if (tagIconName && (LucideIcons as any)[tagIconName]) {
                const IconComponent = (LucideIcons as any)[tagIconName];
                icon = <IconComponent size={10} style={{ color: tagColor || 'inherit' }} />;
            } else {
                icon = <span className="w-1.5 h-1.5 rounded-[1px]" style={{ backgroundColor: tagColor || '#fff' }} />;
            }
            legendItems.push({
                icon,
                label: tagLabel
            });
        });

        checked.forEach((cbLabel: string) => {
            const cbDef = col.checkboxes?.find(cb => (typeof cb === 'string' ? cb : cb?.label) === cbLabel);
            const cbColor = (cbDef && typeof cbDef !== 'string') ? cbDef.color : null;
            legendItems.push({
                icon: <LucideIcons.Check size={10} style={{ color: cbColor || 'var(--accent)' }} />,
                label: cbLabel
            });
        });
    }

    // Suppress the tooltip entirely for hidden cells — never expose any value via hover
    const tooltipContent = showValue ? (
        <div className="p-3 bg-card border border-border rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col gap-2 min-w-[150px] text-left">
            <div className="text-[11px] font-black uppercase tracking-wider text-text">
                {rowName.toUpperCase() || 'MEMBER'}
            </div>
            <div className="border-t border-border/80 my-0.5" />
            <div className="text-[9px] text-muted font-bold uppercase tracking-tight">
                {cellDisplayValue}
            </div>
            {legendItems.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1 pt-1.5 border-t border-border/30">
                    {legendItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[8px] font-black uppercase text-muted/80">
                            <span className="shrink-0 flex items-center justify-center w-3 h-3">
                                {item.icon}
                            </span>
                            <span className="text-muted/40 font-normal">-</span>
                            <span className="tracking-tight">{item.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    ) : null;

    if (isSaving && col.id === savingRows.get(row.id)) {
        return (
            <div className="flex items-center justify-center h-full w-full rt-cell-content">
                <div className="px-2 py-0.5 bg-accent/10 border border-accent/20 rounded animate-pulse flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-accent animate-bounce" />
                    <span className="text-[7px] font-black text-accent uppercase tracking-widest">Saving</span>
                </div>
            </div>
        );
    }

    if (isLocked && col.id === (row.editing_col || activeCols[0].id)) {
        return (
            <div className="flex items-center justify-center h-full w-full rt-cell-content">
                <div className="px-2 py-0.5 bg-danger/10 border border-danger/20 rounded flex items-center gap-1.5 group/lock relative">
                    <div className="w-1 h-1 rounded-full bg-danger" />
                    <span className="text-[7px] font-black text-danger uppercase tracking-widest">Editing</span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-black text-white text-[7px] font-bold uppercase rounded opacity-0 group-hover/lock:opacity-100 transition-opacity whitespace-nowrap z-[100]">
                        {row.editor?.username || 'Another user'} is editing
                    </div>
                </div>
            </div>
        );
    }


    // Handle Database Data Column Type
    if (col.type?.includes('database_data') && col.source_column_id) {
        const sourceCol = activeCols.find(c => c.id === col.source_column_id);
        let sourceValue = isEditing ? editData[sourceCol?.id || ''] : (row.content?.[sourceCol?.id || ''] || '');
        if (sourceCol?.type === 'linked_roster_data') {
            sourceValue = resolvedLinks.get(`${row.id}_${sourceCol.id}`) || '';
        }
        
        if (sourceValue) {
            // Find the database linked to the source column's dataset
            const sourceDataset = datasets.find(d => d.id === sourceCol?.dataset_id);
            const db = recordData.find(d => d.id === sourceDataset?.record_database_id);
            
            if (db && db.entries) {
                // Find entry that matches sourceValue (by the source column's referenced field)
                const entry = db.entries.find((e: any) => {
                    if (String(e.entry_id) === String(sourceValue)) return true;
                    let fieldId = sourceCol?.database_field_id;
                    if (!fieldId || ['table', 'compact', 'cards', 'detailed', 'rows'].includes(fieldId)) {
                        fieldId = db.database_structure?.[0]?.id;
                    }

                    const label = (fieldId === 'id') ? String(e.entry_id) : 
                                 (fieldId === 'created_at') ? new Date(e.created_at).toLocaleDateString() :
                                 e.data?.[fieldId || ''];
                    
                    return String(label) === String(sourceValue);
                });

                if (entry) {
                    const fieldId = col.data_field_id;
                    let displayValue = '-';
                    if (fieldId === 'id') displayValue = entry.entry_id;
                    else if (fieldId === 'created_at') displayValue = new Date(entry.created_at).toLocaleDateString();
                    else displayValue = entry.data?.[fieldId || ''] || '-';

                    return (
                        <div className="flex flex-col items-center justify-center h-full gap-0.5 py-1 transition-all whitespace-nowrap opacity-60 italic relative group/cell rt-cell-content">
                            <CellScaler tooltipContent={tooltipContent} forceShowTooltip={legendItems.length > 0} disabled={isEditing}>
                                <span className="text-[10px] uppercase font-bold text-accent">
                                    {displayValue}
                                </span>
                            </CellScaler>
                            <Link 
                                to={`/${shortname}/records?database=${db.record_shortcode || db.id}&record=${entry.entry_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute -bottom-1 -right-1 p-1 bg-card border border-border rounded text-muted hover:text-accent opacity-0 group-hover/cell:opacity-100 transition-all z-10 shadow-sm"
                            >
                                <ExternalLink size={8} />
                            </Link>
                        </div>
                    );
                }
            }
        }

        if (!canEditAny && row.content?.[col.id]) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-0.5 py-1 transition-all whitespace-nowrap opacity-60 italic relative group/cell rt-cell-content">
                    <CellScaler tooltipContent={tooltipContent} forceShowTooltip={legendItems.length > 0} disabled={isEditing}>
                        <span className="text-[10px] uppercase font-bold text-accent">
                            {String(row.content[col.id])}
                        </span>
                    </CellScaler>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center h-full gap-0.5 py-1 transition-all whitespace-nowrap opacity-20 rt-cell-content">
                <CellScaler tooltipContent={tooltipContent} forceShowTooltip={legendItems.length > 0} disabled={isEditing}>
                    <span className="text-[10px] uppercase font-bold">-</span>
                </CellScaler>
            </div>
        );
    }

    if (col.type?.includes('linked_roster_data')) {
        let resolvedValue = resolvedLinks.get(`${row.id}_${col.id}`);
        if (!resolvedValue && !canEditAny && row.content?.[col.id] && typeof row.content[col.id] !== 'object') {
            resolvedValue = String(row.content[col.id]);
        }
        if (!resolvedValue) resolvedValue = '-';

        if (isEditing) {
            return (
                <div className="flex flex-col items-center justify-center h-full w-full gap-1 rt-cell-content">
                    <span className="text-[10px] uppercase font-medium opacity-60 italic">{resolvedValue}</span>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setLinkedDataModal({ rowId: row.id, colId: col.id, initialData: value });
                        }}
                        className="px-2 py-0.5 bg-accent/10 hover:bg-accent/20 text-accent text-[7px] font-black uppercase tracking-widest rounded border border-accent/20 transition-all"
                    >
                        Options
                    </button>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center h-full w-full rt-cell-content">
                <CellScaler tooltipContent={tooltipContent} forceShowTooltip={legendItems.length > 0} disabled={isEditing}>
                    <span className="text-[10px] uppercase font-medium">{resolvedValue}</span>
                </CellScaler>
            </div>
        );
    }

    const textStyle: React.CSSProperties = {
      color: selectedOpt?.color || 'inherit',
      fontWeight: selectedOpt?.bold ? 'bold' : 'normal',
    };

    const hasOrphanedFlag = activeFlags.some(f => (f.rules || []).some((r: any) => r.type === 'orphaned_database_link'));

    if (isEditing && isColEditable(col)) {
      if (col.type === 'dropdown' || col.type === 'predefined_dropdown' || col.type === 'hidden_dropdown' || col.type === 'predefined_hidden_dropdown') {
        return (
          <div 
            className={`flex flex-col items-center justify-center h-full w-full gap-0.5 relative group/cell overflow-visible rt-cell-content ${hasOrphanedFlag ? 'ring-1 ring-danger ring-inset bg-danger/5' : ''}`}
            title={hasOrphanedFlag ? 'Linked database record no longer exists' : undefined}
          >
            <select 
              value={selectedOpt?.id || value} 
              onChange={e => updateField(col.id, e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            >
              <option value="">- Select -</option>
              {effectiveOptions.map((opt: any) => (
                <option key={opt.id} value={opt.id} style={{ color: opt.color || 'inherit' }}>{opt.label}</option>
              ))}
            </select>
            <CellScaler tooltipContent={tooltipContent} forceShowTooltip={legendItems.length > 0} className="relative z-20 pointer-events-none" disabled={isEditing}>
                <div className="flex items-center gap-1 overflow-visible">
                    <div className="text-[10px] uppercase font-medium transition-colors" style={textStyle}>
                    {selectedOpt?.label || value || <span className="opacity-20 italic">Select...</span>}
                    </div>
                    {activeFlags.length > 0 && (
                        <div className="flex items-center gap-0.5 pointer-events-auto">
                            {activeFlags.map(f => (
                                <div key={f.id} className="group/flag-icon relative flex items-center justify-center">
                                    {React.createElement((LucideIcons as any)[f.icon] || LucideIcons.HelpCircle, { 
                                        size: 10, 
                                        style: { color: f.color } 
                                    })}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-black/90 border border-white/10 rounded text-[7px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover/flag-icon:opacity-100 transition-all pointer-events-none z-[9999] shadow-2xl text-white backdrop-blur-sm">
                                        {f.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {col.tags && col.tags.length > 0 && (
                        <button 
                            onClick={(e) => handleOpenTagMenu(e, row.id, col.id)}
                            className={`p-1 rounded hover:bg-accent/10 transition-colors relative z-20 pointer-events-auto tag-pencil-button ${activeTagMenu?.rowId === row.id && activeTagMenu?.colId === col.id ? 'text-accent' : 'text-muted'}`}
                        >
                            <Pencil size={10} />
                        </button>
                    )}
                    {inlineCheckboxes && col.checkboxes && col.checkboxes.length > 0 && (
                        <div className="flex flex-wrap gap-1 relative z-20 pointer-events-auto">
                            {col.checkboxes.map((cb, cbIdx) => {
                                if (!cb) return null;
                                const label = typeof cb === 'string' ? cb : cb?.label;
                                if (!label) return null;
                                const color = typeof cb === 'string' ? null : cb.color;
                                const isChecked = checked.includes(label);

                                return (
                                    <button
                                        key={label + cbIdx}
                                        onClick={() => toggleCheckbox(col.id, label)}
                                        className={`text-[6px] font-black px-1 rounded border transition-colors uppercase ${
                                            isChecked ? (color ? '' : 'bg-accent border-accent text-white') : 'bg-transparent border-border text-muted hover:border-accent'
                                        }`}
                                        style={isChecked && color ? { backgroundColor: color, borderColor: color, color: '#fff' } : {}}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                {!inlineCheckboxes && col.checkboxes && col.checkboxes.length > 0 && (
                <div className="flex flex-wrap gap-1 relative z-20 pointer-events-auto">
                    {col.checkboxes.map((cb, cbIdx) => {
                    if (!cb) return null;
                    const label = typeof cb === 'string' ? cb : cb?.label;
                    if (!label) return null;
                    const color = typeof cb === 'string' ? null : cb.color;
                    const isChecked = checked.includes(label);

                    return (
                        <button
                        key={label + cbIdx}

                        onClick={() => toggleCheckbox(col.id, label)}
                        className={`text-[6px] font-black px-1 rounded border transition-colors uppercase ${
                            isChecked ? (color ? '' : 'bg-accent border-accent text-white') : 'bg-transparent border-border text-muted hover:border-accent'
                        }`}
                        style={isChecked && color ? { backgroundColor: color, borderColor: color, color: '#fff' } : {}}
                        >
                        {label}
                        </button>
                    );
                    })}
                </div>
                )}
            </CellScaler>
            {activeTagMenu?.rowId === row.id && activeTagMenu?.colId === col.id && createPortal(
                <div 
                    className="fixed bg-card border border-border rounded-lg shadow-xl z-[10000] p-2 min-w-[120px] animate-in fade-in slide-in-from-top-1 tag-menu-window cursor-default"
                    style={{
                        top: tagMenuCoords.top,
                        left: tagMenuCoords.left,
                        transform: `${tagPickerPosition === 'top' ? 'translateY(-100%) translateY(-5px)' : 'translateY(5px)'}`
                    }}
                >
                    <div className="text-[8px] font-black uppercase text-muted mb-2 tracking-widest border-b border-border/50 pb-1">Manage Tags</div>
                    <div className="space-y-1">
                        {col.tags?.map(tagDef => {
                            const tagLabel = typeof tagDef === 'string' ? tagDef : tagDef?.label;
                            const color = typeof tagDef === 'string' ? null : tagDef.color;
                            const iconName = typeof tagDef === 'string' ? null : tagDef.icon;
                            const isTagged = appliedTags.includes(tagLabel);
                            return (
                                <button 
                                    key={tagLabel}
                                    onClick={() => toggleTag(col.id, tagLabel)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[9px] font-bold uppercase transition-colors ${isTagged ? 'bg-accent/10 text-accent' : 'hover:bg-accent/5 text-muted'}`}
                                >
                                    {iconName && (LucideIcons as any)[iconName] ? (
                                        React.createElement((LucideIcons as any)[iconName], {
                                            size: 10,
                                            style: { color: color || 'inherit' }
                                        })
                                    ) : (
                                        <div className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: color || '#fff' }} />
                                    )}
                                    {tagLabel}
                                    {isTagged && <Check size={8} className="ml-auto" />}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
          </div>
        );
      }

      const sourceForSuggestions = (allContents && allContents.length > 0) ? allContents : contents;
      const existingValues = sourceForSuggestions
        .map(c => c.content?.[col.id])
        .filter(v => v && typeof v === 'string' && v.trim() !== '');
      
      const uniqueExisting = Array.from(new Set(existingValues));
      const suggestionPool = [...effectiveOptions];
      
      uniqueExisting.forEach(val => {
        if (typeof val === 'string' && !suggestionPool.some(opt => (opt.label || '').toString().toLowerCase() === val.toLowerCase())) {
          suggestionPool.push({ label: val, color: 'inherit', bold: false });
        }
      });

      const searchTerm = (value || '').toString().toLowerCase();
      const filteredSuggestions = (focusedColId === col.id && searchTerm.length >= 1 && hasTyped) 
        ? suggestionPool.filter(opt => 
            (opt.label || '').toString().toLowerCase().includes(searchTerm)
          ).slice(0, 8) 
        : [];

      return (
        <div 
            className={`flex flex-col items-center justify-center h-full w-full gap-0.5 relative overflow-visible rt-cell-content cursor-text ${hasOrphanedFlag ? 'ring-1 ring-danger ring-inset bg-danger/5' : ''}`}
            onClick={() => inputRef.current?.focus()}
            title={hasOrphanedFlag ? 'Linked database record no longer exists' : undefined}
        >
          <CellScaler tooltipContent={tooltipContent} forceShowTooltip={legendItems.length > 0} disabled={isEditing}>
            <div className="relative w-full flex flex-row items-center justify-center px-1 overflow-visible">
                <input 
                ref={col.id === editingColId ? inputRef : null}
                value={displayEditValue} 
                autoComplete="off"
                onChange={e => {
                    setHasTyped(true);
                    updateField(col.id, e.target.value);
                }}
                onKeyDown={e => e.key === 'Enter' && handleSaveEdit(row.id)}
                onClick={(e) => {
                    e.stopPropagation();
                    setFocusedColId(col.id);
                }}
                onFocus={() => {
                    setHasTyped(false);
                    setFocusedColId(col.id);
                    setEditingColId(col.id);
                }}
                onBlur={(e) => {
                    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.rt-tr')) {
                        return;
                    }
                    setTimeout(() => setFocusedColId(null), 200);
                }} 
                className="flex-1 bg-transparent border-none text-[10px] text-center uppercase font-medium outline-none focus:ring-0 p-0 text-text placeholder:opacity-10"
                style={textStyle}
                placeholder="..."
                />
                {value && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            updateField(col.id, '');
                            inputRef.current?.focus();
                        }}
                        className="p-0.5 hover:bg-accent/10 rounded text-muted hover:text-danger transition-colors ml-0.5"
                        title="Clear Field"
                    >
                        <X size={8} />
                    </button>
                )}
                {activeFlags.length > 0 && (
                    <div className="flex items-center gap-0.5 ml-1">
                        {activeFlags.map(f => (
                            <div key={f.id} className="group/flag-icon relative flex items-center justify-center">
                                {React.createElement((LucideIcons as any)[f.icon] || LucideIcons.HelpCircle, { 
                                    size: 10, 
                                    style: { color: f.color } 
                                })}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-black/90 border border-white/10 rounded text-[7px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover/flag-icon:opacity-100 transition-all pointer-events-none z-[9999] shadow-2xl text-white backdrop-blur-sm">
                                    {f.name}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {col.tags && col.tags.length > 0 && (
                    <button 
                        onClick={(e) => handleOpenTagMenu(e, row.id, col.id)}
                        className={`shrink-0 p-1 rounded hover:bg-accent/10 transition-colors ml-1 tag-pencil-button ${activeTagMenu?.rowId === row.id && activeTagMenu?.colId === col.id ? 'text-accent' : 'text-muted'}`}
                    >
                        <Pencil size={10} />
                    </button>
                )}
                {inlineCheckboxes && col.checkboxes && col.checkboxes.length > 0 && (
                    <div className="flex flex-wrap gap-1 ml-1">
                    {col.checkboxes.map((cb, cbIdx) => {
                        if (!cb) return null;
                        const label = typeof cb === 'string' ? cb : cb?.label;
                        if (!label) return null;
                        const color = typeof cb === 'string' ? null : cb.color;
                        const isChecked = checked.includes(label);

                        return (
                        <button
                            key={label + cbIdx}
                            onClick={() => toggleCheckbox(col.id, label)}
                            className={`text-[6px] font-black px-1 rounded border transition-colors uppercase ${
                            isChecked ? (color ? '' : 'bg-accent border-accent text-white') : 'bg-transparent border-border text-muted hover:border-accent'
                            }`}
                            style={isChecked && color ? { backgroundColor: color, borderColor: color, color: '#fff' } : {}}
                        >
                            {label}
                        </button>
                        );
                    })}
                    </div>
                )}
                </div>
                {!inlineCheckboxes && col.checkboxes && col.checkboxes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                {col.checkboxes.map((cb, cbIdx) => {
                    if (!cb) return null;
                    const label = typeof cb === 'string' ? cb : cb?.label;
                    if (!label) return null;
                    const color = typeof cb === 'string' ? null : cb.color;
                    const isChecked = checked.includes(label);

                    return (
                    <button
                        key={label + cbIdx}

                        onClick={() => toggleCheckbox(col.id, label)}
                        className={`text-[6px] font-black px-1 rounded border transition-colors uppercase ${
                        isChecked ? (color ? '' : 'bg-accent border-accent text-white') : 'bg-transparent border-border text-muted hover:border-accent'
                        }`}
                        style={isChecked && color ? { backgroundColor: color, borderColor: color, color: '#fff' } : {}}
                    >
                        {label}
                    </button>
                    );
                })}
                </div>
                )}
                </CellScaler>

          {filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-card border border-border rounded-lg shadow-[0_10px_40px_-5px_rgba(0,0,0,0.5)] z-[9999] overflow-hidden min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-100">
                    <div className="px-2 py-1 bg-surface/50 text-[7px] font-black text-muted/50 uppercase tracking-widest border-b border-border/30 mb-0.5">Suggestions</div>
                    <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                        {filteredSuggestions.map((opt: any) => (
                            <button 
                                key={opt.id || opt.label}
                                onMouseDown={(e) => {
                                    e.preventDefault(); 
                                    e.stopPropagation();
                                    updateField(col.id, opt.label);
                                    setFocusedColId(null);
                                }}
                                className="w-full text-left px-2 py-2 hover:bg-accent/10 rounded flex items-center justify-between transition-colors group/opt"
                            >
                                <span className={`text-[9px] uppercase tracking-tight ${opt.bold ? 'font-black' : 'font-bold'}`} style={{ color: opt.color || 'inherit' }}>
                                    {opt.label}
                                </span>
                                <div className="w-1 h-1 rounded-full bg-accent/20 group-hover/opt:bg-accent transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {activeTagMenu?.rowId === row.id && activeTagMenu?.colId === col.id && createPortal(
                <div 
                    className="fixed bg-card border border-border rounded-lg shadow-xl z-[10000] p-2 min-w-[120px] animate-in fade-in slide-in-from-top-1 tag-menu-window cursor-default"
                    style={{
                        top: tagMenuCoords.top,
                        left: tagMenuCoords.left,
                        transform: `${tagPickerPosition === 'top' ? 'translateY(-100%) translateY(-5px)' : 'translateY(5px)'}`
                    }}
                >
                    <div className="text-[8px] font-black uppercase text-muted mb-2 tracking-widest border-b border-border/50 pb-1">Manage Tags</div>
                    <div className="space-y-1">
                        {col.tags?.map(tagDef => {
                            const tagLabel = typeof tagDef === 'string' ? tagDef : tagDef?.label;
                            const color = typeof tagDef === 'string' ? null : tagDef.color;
                            const iconName = typeof tagDef === 'string' ? null : tagDef.icon;
                            const isTagged = appliedTags.includes(tagLabel);
                            return (
                                <button 
                                    key={tagLabel}
                                    onClick={() => toggleTag(col.id, tagLabel)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[9px] font-bold uppercase transition-colors ${isTagged ? 'bg-accent/10 text-accent' : 'hover:bg-accent/5 text-muted'}`}
                                >
                                    {iconName && (LucideIcons as any)[iconName] ? (
                                        React.createElement((LucideIcons as any)[iconName], {
                                            size: 10,
                                            style: { color: color || 'inherit' }
                                        })
                                    ) : (
                                        <div className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: color || '#fff' }} />
                                    )}
                                    {tagLabel}
                                    {isTagged && <Check size={8} className="ml-auto" />}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
      );
    }

    return (
      <div 
        className={`flex flex-col items-center justify-center h-full gap-0.5 py-1 transition-all whitespace-nowrap overflow-visible relative group/cell rt-cell-content ${canEditAny && col.type !== 'autofill' ? 'cursor-pointer hover:bg-accent/5' : ''} ${hasOrphanedFlag ? 'ring-1 ring-danger ring-inset bg-danger/5' : ''}`}
        title={hasOrphanedFlag ? 'Linked database record no longer exists' : undefined}
        onClick={() => canEditAny && col.type !== 'autofill' && handleStartEdit(row, col.id)}
      >
        <CellScaler tooltipContent={tooltipContent} forceShowTooltip={showValue && legendItems.length > 0} disabled={isEditing}>
            <div className="flex items-center gap-1.5 px-1 overflow-visible">
                <span 
                    className={`text-[10px] uppercase font-medium transition-all ${!showValue ? 'blur-[3px] select-none opacity-50 font-black tracking-widest rt-cell-hidden-value' : ''}`} 
                    style={textStyle}
                >
                    {showValue ? (selectedOpt?.label || value || '-') : '??????'}
                </span>
                {activeFlags.length > 0 && (
                    <div className="flex items-center gap-0.5">
                        {activeFlags.map(f => (
                            <div key={f.id} className="group/flag-icon relative flex items-center justify-center">
                                {React.createElement((LucideIcons as any)[f.icon] || LucideIcons.HelpCircle, { 
                                    size: 10, 
                                    style: { color: f.color } 
                                })}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-black/90 border border-white/10 rounded text-[7px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover/flag-icon:opacity-100 transition-all pointer-events-none z-[9999] shadow-2xl text-white backdrop-blur-sm">
                                    {f.name}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {appliedTags.length > 0 && (
                    <div className="flex items-center gap-0.5">
                        {(col.tags || []).map((tagDef: any) => {
                            const tagLabel = typeof tagDef === 'string' ? tagDef : tagDef?.label;
                            if (!appliedTags.includes(tagLabel)) return null;

                            const color = (typeof tagDef !== 'string') ? tagDef.color : '#fff';
                            const iconName = (typeof tagDef !== 'string') ? tagDef.icon : null;
                            
                            return (
                                <div 
                                    key={tagLabel} 
                                    className="group/tag-icon relative flex items-center justify-center"
                                >
                                    {iconName && (LucideIcons as any)[iconName] ? (
                                        React.createElement((LucideIcons as any)[iconName], {
                                            size: 10,
                                            style: { color: color || 'inherit' },
                                            className: "opacity-80"
                                        })
                                    ) : (
                                        <div className="w-1.5 h-1.5 rounded-[1px] opacity-80" style={{ backgroundColor: color || '#fff' }} />
                                    )}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-black/90 border border-white/10 rounded text-[7px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover/tag-icon:opacity-100 transition-all pointer-events-none z-[9999] shadow-2xl text-white backdrop-blur-sm">
                                        {tagLabel}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {inlineCheckboxes && checked.length > 0 && (
                    <div className="flex gap-0.5">
                        {(col.checkboxes || []).map((cbDef: any, cbIdx: number) => {
                            if (!cbDef) return null;
                            const cbLabel = typeof cbDef === 'string' ? cbDef : cbDef?.label;
                            if (!cbLabel || !checked.includes(cbLabel)) return null;

                            const color = (typeof cbDef !== 'string') ? cbDef.color : null;
                            
                            return (
                                <span 
                                    key={cbLabel + cbIdx} 
                                    className="text-[6px] text-accent font-black tracking-widest bg-accent/10 px-1 rounded uppercase"
                                    style={color ? { color: color, backgroundColor: `${color}1A` } : {}}
                                >
                                    {cbLabel}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>
            {!inlineCheckboxes && checked.length > 0 && (
              <div className="flex gap-0.5">
                {(col.checkboxes || []).map((cbDef: any, cbIdx: number) => {
                  if (!cbDef) return null;
                  const cbLabel = typeof cbDef === 'string' ? cbDef : cbDef?.label;
                  if (!cbLabel || !checked.includes(cbLabel)) return null;

                  const color = (typeof cbDef !== 'string') ? cbDef.color : null;
                  
                  return (
                    <span 
                      key={cbLabel + cbIdx} 
                      className="text-[6px] text-accent font-black tracking-widest bg-accent/10 px-1 rounded uppercase"
                      style={color ? { color: color, backgroundColor: `${color}1A` } : {}}
                    >
                      {cbLabel}
                    </span>
                  );
                })}
              </div>
            )}
        </CellScaler>
        {selectedOpt?.entryId && (
            <Link 
                to={`/${shortname}/records?database=${selectedOpt.dbShortcode}&record=${selectedOpt.entryId}`}
                onClick={(e) => e.stopPropagation()}
                className="absolute -bottom-1 -right-1 p-1 bg-card border border-border rounded text-muted hover:text-accent opacity-0 group-hover/cell:opacity-100 transition-all z-10 shadow-sm"
            >
                <ExternalLink size={8} />
            </Link>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`rt-wrap ${editingRowId ? 'z-[5000]' : 'overflow-x-auto'}`}
      style={{ 
        '--accent': accentColor,
        '--accent-rgb': accentColor?.startsWith('#') ? hexToRgb(accentColor) : undefined
      } as React.CSSProperties}
    >
      <table ref={tableRef} className={`rt-table ${isLeadership ? 'bg-border/5' : ''}`}>
        <colgroup>
          <col className="w-[32px]" />
          {activeCols.map((col) => (
            <col key={col.id} style={{ width: `${100 / activeCols.length}%` }} />
          ))}
          <col className="w-[32px]" />
        </colgroup>
        <thead>
          <tr>
            <th className="rt-th" style={{ borderLeft: `3px solid ${accentColor}` }}>
                {editMode ? (
                    <div className="flex items-center justify-center">
                        <input 
                            type="checkbox" 
                            checked={selectedRowIds.length === contents.length && contents.length > 0}
                            onChange={toggleSelectAll}
                            className="w-3 h-3 rounded border-border bg-bg text-accent focus:ring-accent accent-accent cursor-pointer"
                        />
                    </div>
                ) : '#'}
            </th>
            {activeCols.map((col) => (
              <th key={col.id} className="rt-th text-center">{col.name}</th>
            ))}
            <th className="rt-th"></th>
          </tr>
        </thead>
        <Reorder.Group 
          as="tbody" 
          axis="y" 
          values={contents} 
          onReorder={onReorderRows || (() => {})}
        >
          {contents.map((row, idx) => {
            const isEditing = editingRowId === row.id;
            const isSaving = savingRows.has(row.id);
            const isSpacer = row.type === 'spacer';
            const effectiveRowColor = (isEditing || isSaving) ? rowColor : row.color;
            const hasCheckbox = activeCols.some(col => {
                const checked = (isEditing || isSaving) ? (editData[`${col.id}_cb`] || []) : (row.content?.[`${col.id}_cb`] || []);
                return checked.length > 0;
            });

            const syncedHeight = syncedHeights?.[idx];

            const cellStyle: React.CSSProperties = {
                backgroundColor: effectiveRowColor ? `${effectiveRowColor}33` : undefined,
                height: syncedHeight ? `${syncedHeight}px` : undefined
            };

            const isLocked = !isEditing && row.editing_by && Number(row.editing_by) !== Number(user?.id) && row.editing_at && (new Date().getTime() - new Date(row.editing_at).getTime() < 60000);

            return (
              <Reorder.Item 
                as="tr"
                key={row.id} 
                value={row}
                dragListener={editMode && canEditPredefined && !editingRowId}
                className={`rt-tr group/row ${isEditing ? 'bg-accent/5 z-[5000] relative' : ''} ${selectedRowIds.includes(row.id) ? 'bg-accent/5' : ''} ${editMode && canEditPredefined && !editingRowId ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{ height: syncedHeight ? `${syncedHeight}px` : undefined }}
                data-row-index={idx}
                data-has-checkbox={hasCheckbox}
              >
                <td 
                  className="rt-td text-muted opacity-50 relative cursor-default" 
                  style={{ 
                    borderLeft: `3px solid ${effectiveRowColor || accentColor}`,
                    ...cellStyle
                  }}
                  onClick={() => editMode && toggleSelectRow(row.id)}
                >
                  <div className="flex items-center justify-center w-full h-full gap-1 px-1">
                    {editMode && canEditPredefined && (
                        <GripVertical size={10} className="opacity-20 group-hover/row:opacity-100 transition-opacity shrink-0" />
                    )}
                    <div className="relative flex items-center justify-center flex-1">
                      {editMode ? (
                          <>
                              <input 
                                  type="checkbox" 
                                  checked={selectedRowIds.includes(row.id)}
                                  readOnly
                                  className={`w-3 h-3 rounded border-border bg-bg text-accent focus:ring-accent accent-accent transition-opacity ${selectedRowIds.includes(row.id) ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'}`}
                              />
                              <span className={`absolute inset-0 flex items-center justify-center transition-opacity ${selectedRowIds.includes(row.id) ? 'opacity-0' : 'group-hover/row:opacity-0 opacity-100'}`}>
                                  {idx + 1}
                              </span>
                          </>
                      ) : (
                          idx + 1
                      )}
                    </div>
                  </div>
                </td>
                {isSpacer ? (
                    <td 
                        colSpan={activeCols.length}
                        className={`rt-td p-0 h-[34px] relative transition-colors ${isEditing ? 'bg-accent/5 ring-1 ring-inset ring-accent/30 z-[5001]' : 'hover:bg-surface/50'}`}
                        style={{ 
                            ...cellStyle,
                            backgroundColor: effectiveRowColor ? `${effectiveRowColor}33` : 'rgba(255,255,255,0.02)',
                        }}
                        onClick={() => !isEditing && canEditPredefined && handleStartEdit(row, 'spacer_text')}
                    >
                        {isSaving ? (
                            <div className="flex items-center justify-center h-full w-full">
                                <div className="px-2 py-0.5 bg-accent/10 border border-accent/20 rounded animate-pulse flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-accent animate-bounce" />
                                    <span className="text-[7px] font-black text-accent uppercase tracking-widest">Saving</span>
                                </div>
                            </div>
                        ) : (isLocked && (row.editing_col === 'spacer_text' || !row.editing_col)) ? (
                             <div className="flex items-center justify-center h-full w-full">
                                <div className="px-2 py-0.5 bg-danger/10 border border-danger/20 rounded flex items-center gap-1.5 group/lock relative">
                                    <div className="w-1 h-1 rounded-full bg-danger" />
                                    <span className="text-[7px] font-black text-danger uppercase tracking-widest">Editing</span>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-black text-white text-[7px] font-bold uppercase rounded opacity-0 group-hover/lock:opacity-100 transition-opacity whitespace-nowrap z-[100]">
                                        {row.editor?.username || 'Another user'} is editing
                                    </div>
                                </div>
                            </div>
                        ) : isEditing ? (
                            <div className="flex items-center justify-center w-full h-full px-4 gap-2">
                                <input 
                                    ref={inputRef}
                                    value={editData['spacer_text'] || ''}
                                    onChange={e => updateField('spacer_text', e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveEdit(row.id)}
                                    className="flex-1 bg-transparent border-none text-[10px] text-center uppercase font-black outline-none focus:ring-0 p-0 text-text placeholder:opacity-20"
                                    placeholder="Spacer Text (Optional)"
                                />
                                <div className="flex items-center gap-1 bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                                    <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                                    <span className="text-[7px] font-black text-accent uppercase tracking-widest">Editing</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center w-full h-full px-4">
                                <span className={`text-[10px] uppercase font-black tracking-[0.2em] ${effectiveRowColor ? 'text-text drop-shadow-sm' : 'opacity-60 italic'}`}>
                                    {row.content?.['spacer_text'] || ''}
                                </span>
                            </div>
                        )}
                    </td>
                ) : (
                    <>
                        {activeCols.map((col) => (
                        <td 
                            key={col.id} 
                            className={`rt-td p-0 h-[34px] relative hover:z-[100] transition-colors ${isEditing && editingColId === col.id ? 'bg-accent/5 ring-1 ring-inset ring-accent/30 z-[5001]' : 'hover:bg-surface/50'}`}
                            style={{ 
                                zIndex: isEditing && editingColId === col.id ? 5001 : 0,
                                ...cellStyle
                            }}
                            onClick={() => isColEditable(col) && (editingRowId !== row.id || editingColId !== col.id) && handleStartEdit(row, col.id)}
                        >
                            {renderCell(row, col)}
                        </td>
                        ))}
                    </>
                )}
                <td className="rt-td p-0" style={cellStyle}>
                <div className="flex items-center justify-center gap-1">
                  {isEditing ? (
                    <div className="flex flex-col items-center gap-1 relative">
                        <button 
                            onClick={e => handleOpenColorPicker(e, row.id)}
                            className="p-1 hover:bg-surface rounded transition-colors text-muted hover:text-accent"
                            title="Row Color"
                        >
                            <div className="w-2.5 h-2.5 rounded-full border border-border" style={{ backgroundColor: rowColor || 'transparent' }} />
                        </button>
                        
                        {showColorPicker === row.id && createPortal(
                            <motion.div
                                drag
                                dragMomentum={false}
                                onClick={(e) => e.stopPropagation()}
                                className={`fixed bg-card border border-border rounded-xl shadow-2xl p-3 z-[10000] min-w-[180px] cursor-default color-picker-window`}
                                style={{ 
                                    top: menuCoords.top, 
                                    left: menuCoords.left,
                                    transform: `${pickerPosition === 'top' ? 'translateY(-100%) translateY(-10px)' : 'translateY(10px)'}`
                                }}
                            >
                                <div className="flex items-center justify-between mb-2 border-b border-border/50 pb-1 cursor-grab active:cursor-grabbing">
                                    <div className="text-[8px] font-black uppercase text-muted tracking-widest">Row Color</div>
                                    <GripVertical size={10} className="text-muted/30" />
                                </div>
                                <div className="grid grid-cols-4 gap-1.5 mb-3">
                                    {defaultRowColors.map(c => (
                                        <button 
                                            key={c.name}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRowColor(c.value);
                                            }}
                                            className={`w-full aspect-square rounded-md border transition-all ${rowColor === c.value ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : 'border-border hover:border-accent'}`}
                                            style={{ backgroundColor: c.value || 'transparent' }}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <input 
                                        type="color" 
                                        value={rowColor || '#ffffff'} 
                                        onChange={e => setRowColor(e.target.value)}
                                        className="w-8 h-8 bg-surface border border-border rounded p-1 cursor-pointer" 
                                    />
                                    <input 
                                        value={rowColor || ''} 
                                        onChange={e => setRowColor(e.target.value)}
                                        className="flex-1 bg-surface border border-border px-2 py-1 text-[10px] text-text rounded focus:border-accent outline-none font-mono uppercase" 
                                        placeholder="Hex (#...)"
                                    />
                                </div>
                            </motion.div>,
                            document.body
                        )}
                        <div className="flex flex-col gap-0.5">
                            <button onClick={() => handleSaveEdit(row.id)} className="p-0.5 text-green-500 hover:bg-green-500/10 rounded transition-colors" title="Save"><Check size={10} /></button>
                            <button 
                                onClick={() => {
                                    setEditData({});
                                    toast.success('Row cleared (unsaved)');
                                }} 
                                className="p-0.5 text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors" 
                                title="Clear Row"
                            >
                                <Trash2 size={10} />
                            </button>
                            <button onClick={handleCancelEdit} className="p-0.5 text-danger hover:bg-danger/10 rounded transition-colors" title="Cancel"><X size={10} /></button>
                        </div>
                    </div>
                  ) : (
                    <>
                      {editMode && (
                        <button onClick={() => onDeleteRow?.(row.id)} className="p-1 text-danger/50 hover:text-danger hover:bg-danger/10 rounded opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </Reorder.Item>
            );
          })}
        </Reorder.Group>
        <tbody>
          {editMode && (
            <tr>
              <td 
                colSpan={activeCols.length + 2} 
                className="rt-td p-2 h-auto"
              >
                <div className="flex items-center justify-between gap-4 relative">
                    <div className="flex items-center gap-2">
                        {selectedRowIds.length > 0 && (
                            <div className="flex items-center gap-2 relative">
                                <div className="relative">
                                    <button 
                                        onClick={handleOpenBulkColorPicker}
                                        className="flex items-center gap-2 px-3 py-1 bg-accent/10 hover:bg-accent/20 text-accent text-[9px] font-black uppercase tracking-widest rounded-lg transition-all border border-accent/20"
                                        title="Apply color to all selected rows"
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full border border-accent/30 bg-accent/50" />
                                        Bulk Color
                                    </button>

                                    {showBulkColorPicker && createPortal(
                                        <motion.div 
                                            drag
                                            dragMomentum={false}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`fixed bg-card border border-border rounded-xl shadow-2xl p-4 z-[10000] min-w-[200px] cursor-default color-picker-window`}
                                            style={{
                                                top: menuCoords.top,
                                                left: menuCoords.left,
                                                transform: `${pickerPosition === 'top' ? 'translateY(-100%) translateY(-10px)' : 'translateY(10px)'}`
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2 cursor-grab active:cursor-grabbing">
                                                <div className="text-[10px] font-black uppercase text-muted tracking-widest">Apply Bulk Color</div>
                                                <GripVertical size={10} className="text-muted/30" />
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 mb-4">
                                                {defaultRowColors.map(c => (
                                                    <button 
                                                        key={c.name}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleBulkColorUpdate(c.value);
                                                        }}
                                                        className="w-full aspect-square rounded-lg border border-border hover:border-accent transition-all hover:scale-105"
                                                        style={{ backgroundColor: c.value || 'transparent' }}
                                                        title={c.name}
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-[8px] text-muted font-bold uppercase tracking-widest text-center">
                                                Applying to <span className="text-accent">{selectedRowIds.length}</span> rows
                                            </p>
                                        </motion.div>,
                                        document.body
                                    )}
                                </div>
                                <button 
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-2 px-3 py-1 bg-danger/10 hover:bg-danger/20 text-danger text-[9px] font-black uppercase tracking-widest rounded-lg transition-all border border-danger/20"
                                >
                                    <Trash2 size={12} /> Delete Selected ({selectedRowIds.length})
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-bg border border-border rounded-lg overflow-hidden h-7">
                            <input 
                                type="number" 
                                min="1" 
                                max="20"
                                value={rowCountToAdd}
                                onChange={e => setRowCountToAdd(parseInt(e.target.value) || 1)}
                                className="w-10 bg-transparent text-center text-[10px] font-bold outline-none border-r border-border"
                            />
                            <button 
                                onClick={handleBulkAdd}
                                className="px-3 py-1 text-accent hover:bg-accent/10 text-[9px] font-black uppercase tracking-widest transition-all h-full"
                            >
                                Add Rows
                            </button>
                        </div>
                        <button 
                            onClick={() => onAddRow?.()}
                            className="flex items-center gap-1.5 px-3 py-1 bg-accent/10 hover:bg-accent/20 text-accent text-[9px] font-black uppercase tracking-widest rounded-lg transition-all border border-accent/20"
                        >
                            <Plus size={12} /> Add One
                        </button>
                        <button 
                            onClick={() => onAddSpacer?.()}
                            className="flex items-center gap-1.5 px-3 py-1 bg-muted/10 hover:bg-muted/20 text-muted text-[9px] font-black uppercase tracking-widest rounded-lg transition-all border border-border"
                        >
                            <SeparatorHorizontal size={12} /> Add Spacer
                        </button>
                    </div>
                </div>
              </td>
            </tr>
          )}
          {contents.length === 0 && !editMode && (
             <tr>
                <td colSpan={activeCols.length + 2} className="rt-td text-muted italic opacity-40 text-center py-4 uppercase text-[9px] tracking-widest">
                    No data available in this section
                </td>
            </tr>
          )}
        </tbody>
      </table>

      {linkedDataModal && (
          <LinkedDataModal 
            isOpen={true}
            shortname={shortname!}
            initialData={linkedDataModal.initialData}
            onClose={() => setLinkedDataModal(null)}
            onSave={(data) => {
                updateField(linkedDataModal.colId, data);
                setLinkedDataModal(null);
            }}
          />
      )}
    </div>
  );
};

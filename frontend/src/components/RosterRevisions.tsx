import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, History, User, RefreshCw, Info, Settings2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../api';
import toast from 'react-hot-toast';
import Loading from './Loading';
import { SyncGridRow } from './SyncGridRow';
import { createPortal } from 'react-dom';
import { findRecordDatabase } from '../utils';

interface RevisionIndex {
    id: number;
    roster_id: number;
    user_id: number | null;
    description: string;
    created_at: string;
    updated_at: string;
    user?: {
        username: string;
        avatar_url: string | null;
    };
}

interface RosterRevisionsProps {
    datasets?: any[];
    recordData?: any[];
    user?: any;
}

const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : undefined;
};

const isArrayEqual = (a: any[], b: any[]) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
};

const isValueEqual = (a: any, b: any) => {
    if (a === b) return true;
    if (!a && !b) return true;
    if (typeof a === 'object' && typeof b === 'object') {
        if (a.roster_id && a.row_id && a.col_id && b.roster_id && b.row_id && b.col_id) {
            return String(a.roster_id) === String(b.roster_id) &&
                   String(a.row_id) === String(b.row_id) &&
                   String(a.col_id) === String(b.col_id);
        }
        return JSON.stringify(a) === JSON.stringify(b);
    }
    return String(a) === String(b);
};

interface FlattenedSnapshot {
    sections: Map<string, any>;
    rows: Map<string, any>;
    rowsBySection: Map<string, any[]>;
}

const flattenSnapshot = (snapshot: any): FlattenedSnapshot => {
    const sections = new Map<string, any>();
    const rows = new Map<string, any>();
    const rowsBySection = new Map<string, any[]>();

    if (!snapshot) return { sections, rows, rowsBySection };

    const traverse = (sList: any[], parentKey?: string) => {
        sList.forEach((sData, idx) => {
            const sKey = sData.section?.id ? String(sData.section.id) : (sData.old_id ? String(sData.old_id) : `sec_${idx}`);
            sections.set(sKey, {
                ...sData.section,
                old_id: sData.old_id,
                parentKey,
                children: sData.children || [],
                contents: sData.contents || []
            });

            const secRows: any[] = [];
            if (sData.contents) {
                sData.contents.forEach((rData: any, rIdx: number) => {
                    const rKey = rData.id ? String(rData.id) : `sec_${sKey}_row_${rIdx}`;
                    const rowObj = {
                        ...rData,
                        rowKey: rKey,
                        sectionKey: sKey
                    };
                    rows.set(rKey, rowObj);
                    secRows.push(rowObj);
                });
            }
            rowsBySection.set(sKey, secRows);

            if (sData.children && sData.children.length > 0) {
                traverse(sData.children, sKey);
            }
        });
    };

    if (snapshot.sections) {
        traverse(snapshot.sections);
    }

    return { sections, rows, rowsBySection };
};

interface RevisionRosterTableProps {
    sectionId: number;
    contents: any[];
    columns: any[];
    accentColor: string;
    syncedHeights?: { [key: number]: number };
    onRowHeightSync?: (index: number, height: number, hasCheckbox: boolean) => void;
    renderCell: (row: any, col: any, isRowDeleted: boolean, isRowAdded: boolean) => React.ReactNode;
    diffs: any;
}

const RevisionRosterTable: React.FC<RevisionRosterTableProps> = ({
    contents,
    columns,
    syncedHeights,
    onRowHeightSync,
    renderCell,
    diffs
}) => {
    const tableRef = useRef<HTMLTableElement>(null);

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
    }, [contents, onRowHeightSync]);

    return (
        <div className="overflow-x-auto w-full">
            <table ref={tableRef} className="w-full border-collapse">
                <thead>
                    <tr className="bg-surface/20 border-b border-border">
                        {columns.map(col => (
                            <th key={col.id} className="text-left py-2.5 px-4 text-[9px] font-black uppercase tracking-widest text-muted">
                                {col.name}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {contents.map((row: any, rIdx: number) => {
                        if (row.type === 'spacer') {
                            return (
                                <tr key={`spacer-${rIdx}`} className="h-6 border-b border-border/50 bg-surface/5">
                                    <td colSpan={columns.length} className="py-1 px-4 text-[9px] font-black uppercase tracking-widest text-muted/40 text-center italic">
                                        — Spacer Row —
                                    </td>
                                </tr>
                            );
                        }

                        const isDeleted = row.isDeleted;
                        const isAdded = diffs?.addedRows.has(row.rowKey);
                        
                        let rowBgColor = row.color ? `${row.color}15` : undefined;
                        let borderLeftClass = '';
                        let rowOpacityClass = '';
                        let textDecorationClass = '';

                        if (isDeleted) {
                            rowBgColor = 'rgba(239, 68, 68, 0.05)';
                            borderLeftClass = 'border-l-2 border-l-danger';
                            rowOpacityClass = 'opacity-60';
                            textDecorationClass = 'line-through text-muted/60';
                        } else if (isAdded) {
                            rowBgColor = 'rgba(16, 185, 129, 0.05)';
                            borderLeftClass = 'border-l-2 border-l-emerald-500';
                        }

                        const hasCheckbox = columns.some(col => {
                            const checked = row.content?.[`${col.id}_cb`] || [];
                            return checked.length > 0;
                        });

                        return (
                            <tr 
                                key={row.rowKey}
                                data-row-index={rIdx}
                                data-has-checkbox={hasCheckbox ? 'true' : 'false'}
                                className={`rt-tr border-b border-border last:border-0 hover:bg-surface/10 transition-colors ${borderLeftClass} ${rowOpacityClass} ${textDecorationClass}`}
                                style={{ 
                                    backgroundColor: rowBgColor,
                                    height: syncedHeights?.[rIdx] ? `${syncedHeights[rIdx]}px` : undefined
                                }}
                            >
                                {columns.map(col => renderCell(row, col, isDeleted, isAdded))}
                            </tr>
                        );
                    })}
                    {contents.length === 0 && (
                        <tr>
                            <td colSpan={columns.length} className="py-8 text-center text-[10px] text-muted font-bold uppercase tracking-widest">
                                No rows in this section
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export const RosterRevisions: React.FC<RosterRevisionsProps> = ({ datasets = [], recordData = [], user }) => {
    const { shortname, rosterId } = useParams<{ shortname: string; rosterId: string }>();
    const navigate = useNavigate();

    const [revisions, setRevisions] = useState<RevisionIndex[]>([]);
    const [rosterInfo, setRosterInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRevision, setSelectedRevision] = useState<RevisionIndex | null>(null);
    const [snapshotLoading, setSnapshotLoading] = useState(false);
    const [snapshotData, setSnapshotData] = useState<any>(null);
    const [prevSnapshotData, setPrevSnapshotData] = useState<any>(null);
    const [restoring, setRestoring] = useState(false);
    const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
    const [hoveredDiff, setHoveredDiff] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);

    const diffs = useMemo(() => {
        if (!snapshotData) return null;

        const currFlat = flattenSnapshot(snapshotData);
        const prevFlat = flattenSnapshot(prevSnapshotData);

        const addedSections = new Set<string>();
        const deletedSections: any[] = [];
        const modifiedSections = new Map<string, { field: string; prev: any; curr: any }[]>();

        // Compare sections
        currFlat.sections.forEach((sec, key) => {
            if (!prevFlat.sections.has(key)) {
                addedSections.add(key);
            } else {
                const prevSec = prevFlat.sections.get(key);
                const secDiffs: { field: string; prev: any; curr: any }[] = [];
                ['name', 'color', 'type', 'subsections_per_row', 'use_roster_columns'].forEach(field => {
                    if (!isValueEqual(sec[field], prevSec[field])) {
                        secDiffs.push({ field, prev: prevSec[field], curr: sec[field] });
                    }
                });
                if (secDiffs.length > 0) {
                    modifiedSections.set(key, secDiffs);
                }
            }
        });

        // Deleted sections
        prevFlat.sections.forEach((sec, key) => {
            if (!currFlat.sections.has(key)) {
                deletedSections.push(sec);
            }
        });

        const rowPairs = new Map<string, any>(); // currRowKey -> prevRow
        const addedRows = new Set<string>();
        const deletedRows = new Map<string, any[]>(); // sectionKey -> rows deleted
        const modifiedCells = new Map<string, { field: string; prev: any; curr: any }>();
        const modifiedRowColors = new Map<string, { prev: string | null; curr: string | null }>();

        // Align rows section by section to support similarity-based matching and index fallback
        currFlat.sections.forEach((currSec, secKey) => {
            const prevSec = prevFlat.sections.get(secKey);
            const currSecRows = currFlat.rowsBySection.get(secKey) || [];
            const prevSecRows = prevSec ? (prevFlat.rowsBySection.get(secKey) || []) : [];

            const unmatchedPrev = [...prevSecRows];
            const unmatchedCurr: any[] = [];

            // 1. Try matching by database ID first (handles reordering / edits with persistent IDs)
            currSecRows.forEach(currRow => {
                let matchIdx = -1;
                if (currRow.id) {
                    matchIdx = unmatchedPrev.findIndex(p => p.id && String(p.id) === String(currRow.id));
                }
                
                if (matchIdx !== -1) {
                    const prevRow = unmatchedPrev[matchIdx];
                    rowPairs.set(currRow.rowKey, prevRow);
                    unmatchedPrev.splice(matchIdx, 1);
                } else {
                    unmatchedCurr.push(currRow);
                }
            });

            // 2. Fallback to similarity-based matching (handles reordering / restores / older snapshots without ID)
            const unmatchedCurrCopy = [...unmatchedCurr];
            unmatchedCurrCopy.forEach(currRow => {
                let bestMatchIdx = -1;
                let maxMatches = -1;

                const sec = currFlat.sections.get(currRow.sectionKey);
                const columns = sec?.use_roster_columns 
                    ? (snapshotData.roster?.columns || []) 
                    : (sec?.columns || snapshotData.roster?.columns || []);

                unmatchedPrev.forEach((prevRow, pIdx) => {
                    let matches = 0;
                    columns.forEach((col: any) => {
                        const currVal = currRow.content?.[col.id];
                        const prevVal = prevRow.content?.[col.id];
                        if (isValueEqual(currVal, prevVal)) {
                            matches++;
                        }
                    });

                    if (matches > maxMatches) {
                        maxMatches = matches;
                        bestMatchIdx = pIdx;
                    }
                });

                // Pair only if there is a resemblance (at least 1 matching column value)
                if (bestMatchIdx !== -1 && maxMatches > 0) {
                    const prevRow = unmatchedPrev[bestMatchIdx];
                    rowPairs.set(currRow.rowKey, prevRow);
                    unmatchedPrev.splice(bestMatchIdx, 1);
                    
                    const cIdx = unmatchedCurr.findIndex(c => c.rowKey === currRow.rowKey);
                    if (cIdx !== -1) unmatchedCurr.splice(cIdx, 1);
                }
            });

            // 3. Final fallback to index-based matching for completely unmatched rows
            const minLen = Math.min(unmatchedCurr.length, unmatchedPrev.length);
            for (let i = 0; i < minLen; i++) {
                rowPairs.set(unmatchedCurr[i].rowKey, unmatchedPrev[i]);
            }

            // 4. Mark remaining unmatched rows as added or deleted
            if (unmatchedCurr.length > minLen) {
                for (let i = minLen; i < unmatchedCurr.length; i++) {
                    addedRows.add(unmatchedCurr[i].rowKey);
                }
            }

            if (unmatchedPrev.length > minLen) {
                deletedRows.set(secKey, unmatchedPrev.slice(minLen));
            }
        });

        // Compute modifications (cell content, tags, checkboxes, row colors) for paired rows
        currFlat.rows.forEach((row, key) => {
            if (rowPairs.has(key)) {
                const prevRow = rowPairs.get(key);
                
                // Track row color modification
                if (row.color !== prevRow.color) {
                    modifiedRowColors.set(key, { prev: prevRow.color, curr: row.color });
                }

                const sec = currFlat.sections.get(row.sectionKey);
                const columns = sec?.use_roster_columns 
                    ? (snapshotData.roster?.columns || []) 
                    : (sec?.columns || snapshotData.roster?.columns || []);

                columns.forEach((col: any) => {
                    const cellKey = `${key}_${col.id}`;
                    const currVal = row.content?.[col.id];
                    const prevVal = prevRow.content?.[col.id];
                    const currCb = row.content?.[`${col.id}_cb`] || [];
                    const prevCb = prevRow.content?.[`${col.id}_cb`] || [];
                    const currTags = row.content?.[`${col.id}_tags`] || [];
                    const prevTags = prevRow.content?.[`${col.id}_tags`] || [];

                    if (!isValueEqual(currVal, prevVal)) {
                        console.log('Cell modified (value):', cellKey, 'currVal:', currVal, 'prevVal:', prevVal);
                        modifiedCells.set(cellKey, { field: 'value', prev: prevVal, curr: currVal });
                    } else if (!isArrayEqual(currCb, prevCb)) {
                        console.log('Cell modified (checkboxes):', cellKey, 'currCb:', currCb, 'prevCb:', prevCb);
                        modifiedCells.set(cellKey, { field: 'checkboxes', prev: prevCb, curr: currCb });
                    } else if (!isArrayEqual(currTags, prevTags)) {
                        console.log('Cell modified (tags):', cellKey, 'currTags:', currTags, 'prevTags:', prevTags);
                        modifiedCells.set(cellKey, { field: 'tags', prev: prevTags, curr: currTags });
                    }
                });
            }
        });

        return {
            addedSections,
            deletedSections,
            modifiedSections,
            addedRows,
            deletedRows,
            modifiedCells,
            modifiedRowColors,
            currFlat,
            prevFlat
        };
    }, [snapshotData, prevSnapshotData]);

    const handleSelectRevision = async (revision: RevisionIndex, listToUse: RevisionIndex[] = revisions) => {
        setSelectedRevision(revision);
        setSnapshotLoading(true);
        setSnapshotData(null);
        setPrevSnapshotData(null);
        try {
            const idx = listToUse.findIndex(r => r.id === revision.id);
            const prevRevision = idx !== -1 && idx < listToUse.length - 1 ? listToUse[idx + 1] : null;

            const [currRes, prevRes] = await Promise.all([
                api.get(`/rosters/${rosterId}/revisions/${revision.id}`),
                prevRevision ? api.get(`/rosters/${rosterId}/revisions/${prevRevision.id}`) : Promise.resolve(null)
            ]);

            setSnapshotData(currRes.data.snapshot);
            if (prevRes) {
                setPrevSnapshotData(prevRes.data.snapshot);
            }
        } catch (err) {
            toast.error('Failed to load version snapshot');
        } finally {
            setSnapshotLoading(false);
        }
    };

    const fetchRevisions = async () => {
        try {
            setLoading(true);
            const [revsRes, rostersRes] = await Promise.all([
                api.get(`/rosters/${rosterId}/revisions`),
                api.get(`/factions/${shortname}/rosters`)
            ]);

            const revData = revsRes.data;
            setRevisions(revData);

            const activeRoster = (rostersRes.data || []).find((r: any) => String(r.id) === String(rosterId));
            setRosterInfo(activeRoster);

            if (revData.length > 0) {
                const grouped = groupRevisionsByDate(revData);
                const dates = Object.keys(grouped);
                if (dates.length > 0) {
                    setExpandedDates({ [dates[0]]: true });
                }
                handleSelectRevision(revData[0], revData);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to load revision history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (rosterId) {
            fetchRevisions();
        }
    }, [rosterId]);

    const handleRestore = async () => {
        if (!selectedRevision) return;

        const formattedTime = new Date(selectedRevision.created_at).toLocaleString();
        if (!window.confirm(`Are you sure you want to restore the roster to the state from ${formattedTime}? This will wipe and replace all current sections, columns, layout configurations, and data rows.`)) {
            return;
        }

        setRestoring(true);
        const loadToast = toast.loading('Restoring roster version...');
        try {
            await api.post(`/rosters/${rosterId}/revisions/${selectedRevision.id}/restore`);
            toast.success('Roster version restored successfully', { id: loadToast });
            navigate(`/${shortname}/roster?roster=${rosterInfo?.shortname || rosterId}`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to restore version', { id: loadToast });
        } finally {
            setRestoring(false);
        }
    };

    const groupRevisionsByDate = (revList: RevisionIndex[]) => {
        const groups: Record<string, RevisionIndex[]> = {};
        revList.forEach(rev => {
            const dateStr = new Date(rev.created_at).toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            if (!groups[dateStr]) {
                groups[dateStr] = [];
            }
            groups[dateStr].push(rev);
        });
        return groups;
    };

    const toggleDate = (dateStr: string) => {
        setExpandedDates(prev => ({
            ...prev,
            [dateStr]: !prev[dateStr]
        }));
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleCellMouseEnter = (e: React.MouseEvent, type: 'added' | 'deleted' | 'modified', metadata: any) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top;

        let tooltipContent: React.ReactNode = null;
        const formatVal = (v: any) => {
            if (v === null || v === undefined || v === '') return <span className="italic text-muted/60">Empty</span>;
            if (Array.isArray(v)) {
                if (v.length === 0) return <span className="italic text-muted/60">None</span>;
                return v.join(', ');
            }
            return String(v);
        };

        if (type === 'modified') {
            const { prev, curr } = metadata;
            tooltipContent = (
                <>
                    <span className="text-accent font-black uppercase text-[8px] tracking-wider mb-0.5">Cell Changed</span>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-muted text-[9px]">From: <span className="text-text font-semibold">{formatVal(prev)}</span></span>
                        <span className="text-muted text-[9px]">To: <span className="text-emerald-400 font-semibold">{formatVal(curr)}</span></span>
                    </div>
                    <div className="mt-1 border-t border-border/50 pt-1 text-[8px] text-muted uppercase">
                        By {selectedRevision?.user?.username || 'System'} at {new Date(selectedRevision?.created_at || '').toLocaleTimeString()}
                    </div>
                </>
            );
        } else if (type === 'added') {
            tooltipContent = (
                <>
                    <span className="text-emerald-400 font-black uppercase text-[8px] tracking-wider mb-0.5">Row Added</span>
                    <span className="text-muted text-[9px]">This row was created in this version.</span>
                    <div className="mt-1 border-t border-border/50 pt-1 text-[8px] text-muted uppercase">
                        By {selectedRevision?.user?.username || 'System'} at {new Date(selectedRevision?.created_at || '').toLocaleTimeString()}
                    </div>
                </>
            );
        } else if (type === 'deleted') {
            tooltipContent = (
                <>
                    <span className="text-danger font-black uppercase text-[8px] tracking-wider mb-0.5">Row Deleted</span>
                    <span className="text-muted text-[9px]">This row was removed in this version.</span>
                    <div className="mt-1 border-t border-border/50 pt-1 text-[8px] text-muted uppercase">
                        By {selectedRevision?.user?.username || 'System'} at {new Date(selectedRevision?.created_at || '').toLocaleTimeString()}
                    </div>
                </>
            );
        }

        setHoveredDiff({ x, y, content: tooltipContent });
    };

    const renderCell = useCallback((row: any, col: any, isRowDeleted: boolean, isRowAdded: boolean) => {
        const cellKey = `${row.rowKey}_${col.id}`;
        const cellDiff = diffs?.modifiedCells.get(cellKey);
        const isModified = !!cellDiff && !isRowAdded && !isRowDeleted;

        const val = row.content ? row.content[col.id] : '';
        const checkedCbs = row.content ? (row.content[`${col.id}_cb`] || []) : [];
        const tags = row.content ? (row.content[`${col.id}_tags`] || []) : [];

        const boundDataset = col.dataset_id ? datasets.find(d => d.id === col.dataset_id) : null;
        const datasetOptions = boundDataset?.options || [];
        let effectiveOptions = boundDataset 
          ? datasetOptions.map((o: any) => ({ id: o.id, label: o.value || '', color: o.color })) 
          : (col.options || []).map((o: any, idx: number) => ({ ...o, id: o.id || `manual_${idx}` }));

        if (boundDataset?.record_database_id) {
            const db = findRecordDatabase(recordData, boundDataset.record_database_id);
            if (db && db.entries) {
                effectiveOptions = db.entries.map((entry: any) => {
                    let fieldId = col.database_field_id;
                    if (!fieldId || ['table', 'compact', 'cards', 'detailed', 'rows'].includes(fieldId)) {
                        fieldId = db.database_structure?.[0]?.id;
                    }
                    const field = db.database_structure?.find((f: any) => f.id === fieldId);
                    let label = '';
                    if (fieldId === 'id') label = String(entry.entry_id);
                    else if (fieldId === 'created_at') label = new Date(entry.created_at).toLocaleDateString();
                    else {
                        const rawLabel = entry.data?.[fieldId || ''] || entry.data?.[field?.name || ''] || `Entry #${entry.entry_id}`;
                        label = String(rawLabel);
                    }
                    return { id: entry.entry_id, label, color: null };
                });
            }
        }

        const isValueId = val && (!isNaN(Number(val)) || String(val).startsWith('temp_') || String(val).startsWith('opt_'));
        const selectedOpt = effectiveOptions.find(o => 
            String(o.id) === String(val) || (!isValueId && o.label === val)
        );

        const displayVal = selectedOpt 
            ? selectedOpt.label 
            : (val === null || val === undefined 
                ? '' 
                : (typeof val === 'object'
                    ? (val.row_id && val.col_id ? '🔗 Linked Cell' : JSON.stringify(val))
                    : String(val)
                  )
              );

        const handleMouseEnter = (e: React.MouseEvent) => {
            if (isRowDeleted) {
                handleCellMouseEnter(e, 'deleted', { val });
            } else if (isRowAdded) {
                handleCellMouseEnter(e, 'added', { val });
            } else if (isModified) {
                let formattedPrev = cellDiff.prev;
                let formattedCurr = cellDiff.curr;

                const resolveLabel = (v: any) => {
                    if (v && typeof v === 'object' && v.roster_id && v.row_id && v.col_id) {
                        return 'Linked Roster Data';
                    }
                    const isValId = v && (!isNaN(Number(v)) || String(v).startsWith('temp_') || String(v).startsWith('opt_'));
                    const opt = effectiveOptions.find(o => 
                        String(o.id) === String(v) || (!isValId && o.label === v)
                    );
                    return opt ? opt.label : v;
                };

                if (cellDiff.field === 'value') {
                    formattedPrev = resolveLabel(cellDiff.prev);
                    formattedCurr = resolveLabel(cellDiff.curr);
                }

                handleCellMouseEnter(e, 'modified', {
                    prev: formattedPrev,
                    curr: formattedCurr
                });
            }
        };

        const handleMouseLeave = () => {
            setHoveredDiff(null);
        };

        const cellColor = selectedOpt?.color;

        let cellHighlightClass = '';
        if (isModified) {
            cellHighlightClass = 'bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 shadow-sm shadow-amber-500/5 cursor-help';
        } else if (isRowAdded) {
            cellHighlightClass = 'cursor-help';
        } else if (isRowDeleted) {
            cellHighlightClass = 'cursor-help';
        }

        return (
            <td 
                key={col.id} 
                className="rt-td py-2 px-4 text-xs h-[34px] transition-colors relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className={`flex items-center gap-1.5 flex-wrap ${cellHighlightClass}`}>
                    <span 
                        className="text-[11px] font-bold text-text truncate max-w-[180px]"
                        style={{ color: cellColor || undefined }}
                    >
                        {displayVal}
                    </span>
                    {checkedCbs.map((cb: string) => (
                        <span key={cb} className="px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                            {cb}
                        </span>
                    ))}
                    {tags.map((tag: string) => (
                        <span key={tag} className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-accent/10 text-accent border border-accent/20">
                            {tag}
                        </span>
                    ))}
                </div>
            </td>
        );
    }, [diffs, datasets, recordData, selectedRevision]);

    const renderSection = (secData: any, syncedHeights?: { [key: number]: number }, onRowHeightSync?: (index: number, height: number, hasCheckbox: boolean) => void, isChild = false, isDeletedSection = false) => {
        const section = secData.section;
        const secId = section?.id || secData.old_id;

        const effectiveColor = section?.color || rosterInfo?.color || 'var(--accent)';

        const isSecAdded = diffs?.addedSections.has(String(secId)) && !isDeletedSection;
        const isSecModified = diffs?.modifiedSections.has(String(secId)) && !isDeletedSection;
        const secDiffDetails = diffs?.modifiedSections.get(String(secId));

        const currentRows = secData.contents || [];
        const deletedRowsForSec = diffs?.deletedRows.get(String(secId)) || [];
        const allRows = [
            ...currentRows.map((r: any, rIdx: number) => {
                const rKey = r.id ? String(r.id) : `sec_${secId}_row_${rIdx}`;
                return {
                    ...r,
                    rowKey: rKey,
                    isDeleted: isDeletedSection
                };
            }),
            ...deletedRowsForSec.map((r: any) => ({ ...r, isDeleted: true }))
        ];
        allRows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const rosterCols = snapshotData?.roster?.columns || [];
        const secCols = section?.use_roster_columns ? rosterCols : (section?.columns || rosterCols);

        const handleSecHeaderMouseEnter = (e: React.MouseEvent) => {
            if (isDeletedSection) {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredDiff({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    content: (
                        <>
                            <span className="text-danger font-black uppercase text-[8px] tracking-wider mb-0.5">Section Deleted</span>
                            <span className="text-muted text-[9px]">This entire section was deleted.</span>
                            <div className="mt-1 border-t border-border/50 pt-1 text-[8px] text-muted uppercase">
                                By {selectedRevision?.user?.username || 'System'} at {new Date(selectedRevision?.created_at || '').toLocaleTimeString()}
                            </div>
                        </>
                    )
                });
            } else if (isSecAdded) {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredDiff({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    content: (
                        <>
                            <span className="text-emerald-400 font-black uppercase text-[8px] tracking-wider mb-0.5">Section Created</span>
                            <span className="text-muted text-[9px]">This section was added in this version.</span>
                            <div className="mt-1 border-t border-border/50 pt-1 text-[8px] text-muted uppercase">
                                By {selectedRevision?.user?.username || 'System'} at {new Date(selectedRevision?.created_at || '').toLocaleTimeString()}
                            </div>
                        </>
                    )
                });
            } else if (isSecModified) {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredDiff({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    content: (
                        <>
                            <span className="text-amber-400 font-black uppercase text-[8px] tracking-wider mb-0.5">Section Settings Modified</span>
                            <div className="flex flex-col gap-0.5 text-[9px]">
                                {secDiffDetails?.map((d, i) => (
                                    <div key={i} className="text-muted">
                                        <span className="capitalize font-semibold text-text">{d.field}</span>: {' '}
                                        <span className="line-through opacity-60">{String(d.prev)}</span> → <span className="text-emerald-400 font-semibold">{String(d.curr)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-1 border-t border-border/50 pt-1 text-[8px] text-muted uppercase">
                                By {selectedRevision?.user?.username || 'System'} at {new Date(selectedRevision?.created_at || '').toLocaleTimeString()}
                            </div>
                        </>
                    )
                });
            }
        };

        const handleSecHeaderMouseLeave = () => {
            setHoveredDiff(null);
        };

        if (section?.type === 'master' || section?.type === 'subsection') {
            return (
                <div 
                    key={`sec-${secId}`}
                    className={`${section.type === 'master' ? 'div-leadership' : 'unit-section'} w-full border bg-card ${!isChild ? 'mb-4' : ''} relative ${isDeletedSection ? 'border-dashed border-danger/40 opacity-65 bg-danger/5' : 'border-border'} ${isSecAdded ? 'border-l-2 border-l-emerald-500' : ''} ${isSecModified ? 'border-l-2 border-l-amber-500' : ''}`}
                    style={{ 
                        '--accent': effectiveColor,
                        '--accent-rgb': effectiveColor.startsWith('#') ? hexToRgb(effectiveColor) : undefined
                    } as React.CSSProperties}
                >
                    <div 
                        className="section-header h-[28px] px-2 border-b border-border bg-border/20 flex justify-between items-center cursor-help"
                        onMouseEnter={handleSecHeaderMouseEnter}
                        onMouseLeave={handleSecHeaderMouseLeave}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                {section.image_url && (
                                    <img src={section.image_url} alt="" className="w-3 h-3 object-contain" />
                                )}
                                <span className="text-[10px] font-bold text-text uppercase">{section.name}</span>
                            </div>
                            {isSecAdded && (
                                <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[7px] font-black uppercase tracking-widest rounded">
                                    Added
                                </span>
                            )}
                            {isSecModified && (
                                <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[7px] font-black uppercase tracking-widest rounded">
                                    Modified
                                </span>
                            )}
                            {isDeletedSection && (
                                <span className="px-1.5 py-0.5 bg-danger/10 border border-danger/20 text-danger text-[7px] font-black uppercase tracking-widest rounded">
                                    Deleted
                                </span>
                            )}
                        </div>
                    </div>

                    {(allRows.length > 0 || !secData.children || secData.children.length === 0) && (
                        <RevisionRosterTable
                            sectionId={secId}
                            contents={allRows}
                            columns={secCols}
                            accentColor={effectiveColor}
                            syncedHeights={syncedHeights}
                            onRowHeightSync={onRowHeightSync}
                            renderCell={renderCell}
                            diffs={diffs}
                        />
                    )}

                    {secData.children && secData.children.length > 0 && (
                        <div className="sections-container w-full divide-y divide-border border-t border-border">
                            {secData.children.map((child: any) => renderSection(child, undefined, undefined, true, isDeletedSection))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div 
                key={`sec-${secId}`}
                className={`bureau-card border rounded-lg bg-card shadow-[var(--sh)] flex flex-col ${!isChild ? 'mb-4' : ''} relative ${isDeletedSection ? 'border-dashed border-danger/40 opacity-65 bg-danger/5' : 'border-border'} ${isSecAdded ? 'border-l-2 border-l-emerald-500' : ''} ${isSecModified ? 'border-l-2 border-l-amber-500' : ''}`}
                style={{ 
                    '--accent': effectiveColor,
                    '--accent-rgb': effectiveColor.startsWith('#') ? hexToRgb(effectiveColor) : undefined
                } as React.CSSProperties}
            >
                <div 
                    className="bureau-card-top flex h-[28px] items-stretch border-b border-border bg-surface shrink-0 rounded-t-lg overflow-hidden cursor-help"
                    onMouseEnter={handleSecHeaderMouseEnter}
                    onMouseLeave={handleSecHeaderMouseLeave}
                >
                    <div className="w-[5px] shrink-0" style={{ backgroundColor: effectiveColor }} />
                    <div className="flex-1 flex items-center px-2 gap-1.5 overflow-hidden">
                        <div className="flex items-center gap-2">
                            {section?.image_url && (
                                <img src={section.image_url} alt="" className="w-3.5 h-3.5 object-contain" />
                            )}
                            <span className="font-bold text-[11px] text-text uppercase truncate">
                                {section?.name}
                            </span>
                        </div>
                        {isSecAdded && (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[7px] font-black uppercase tracking-widest rounded leading-none">
                                Added
                            </span>
                        )}
                        {isSecModified && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[7px] font-black uppercase tracking-widest rounded leading-none">
                                Modified
                            </span>
                        )}
                        {isDeletedSection && (
                            <span className="px-1.5 py-0.5 bg-danger/10 border border-danger/20 text-danger text-[7px] font-black uppercase tracking-widest rounded leading-none">
                                Deleted
                            </span>
                        )}
                    </div>
                </div>

                {section?.type !== 'content' && (allRows.length > 0 || !secData.children || secData.children.length === 0) && (
                    <RevisionRosterTable
                        sectionId={secId}
                        contents={allRows}
                        columns={secCols}
                        accentColor={effectiveColor}
                        syncedHeights={syncedHeights}
                        onRowHeightSync={onRowHeightSync}
                        renderCell={renderCell}
                        diffs={diffs}
                    />
                )}

                <div className="sections-container w-full divide-y divide-border">
                    {section?.type === 'content' && (
                        <div className="p-4 bg-card/30">
                            <div 
                                className="prose prose-invert max-w-none text-[11px] leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: section.content_html || '' }}
                            />
                        </div>
                    )}

                    {section?.layout_settings?.rows?.map((row: any, rowIdx: number) => (
                        <SyncGridRow
                            key={`row-${rowIdx}`}
                            columns={row.columns || 1}
                            className="grid w-full items-start divide-x divide-border"
                        >
                            {({ syncedHeights: rowSyncedHeights, onRowHeightSync: rowOnRowHeightSync }) => (
                                <>
                                    {row.section_ids?.map((sId: number) => {
                                        const childData = secData.children?.find((c: any) => {
                                            const childId = c.section?.id || c.old_id;
                                            return String(childId) === String(sId);
                                        });
                                        if (!childData) return <div key={`empty-${sId}`} className="border-r border-border last:border-r-0" />;
                                        return renderSection(childData, rowSyncedHeights, rowOnRowHeightSync, true, isDeletedSection);
                                    })}
                                </>
                            )}
                        </SyncGridRow>
                    ))}

                    {(secData.children?.filter((c: any) => {
                        const childId = c.section?.id || c.old_id;
                        return !section?.layout_settings?.rows?.some((r: any) => r.section_ids?.includes(childId));
                    }).length ?? 0) > 0 && (
                        <SyncGridRow 
                            columns={section?.subsections_per_row || 1}
                            className="grid w-full items-start divide-x divide-border"
                        >
                            {({ syncedHeights: rowSyncedHeights, onRowHeightSync: rowOnRowHeightSync }) => (
                                <>
                                    {secData.children?.filter((c: any) => {
                                        const childId = c.section?.id || c.old_id;
                                        const inCustomRow = section?.layout_settings?.rows?.some((r: any) => r.section_ids?.includes(childId));
                                        return !inCustomRow;
                                    }).map((childData: any) => {
                                        const childId = childData.section?.id || childData.old_id;
                                        return renderSection(childData, rowSyncedHeights, rowOnRowHeightSync, true, isDeletedSection);
                                    })}
                                </>
                            )}
                        </SyncGridRow>
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <Loading message="Loading Revision History..." />;

    const groupedRevisions = groupRevisionsByDate(revisions);

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(`/${shortname}/roster?roster=${rosterInfo?.shortname}`)}
                        className="p-2 bg-card hover:bg-surface border border-border text-muted hover:text-text rounded-xl transition"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
                            <History className="text-accent" size={22} />
                            Revision History: <span style={{ color: rosterInfo?.color }}>{rosterInfo?.name}</span>
                        </h1>
                        <p className="text-[9px] text-muted font-black uppercase tracking-widest mt-0.5">Browse past versions and restore layout & cells</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* PREVIEW CONTAINER */}
                <div className="flex-1 bg-surface/20 border border-border rounded-2xl flex flex-col overflow-hidden">
                    {selectedRevision ? (
                        <>
                            {/* Version Info Header */}
                            <div className="p-4 border-b border-border bg-card flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                                        <Clock size={16} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-text">
                                            Version from {new Date(selectedRevision.created_at).toLocaleString()}
                                        </div>
                                        <div className="text-[9px] font-bold text-muted uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                                            <User size={10} /> By {selectedRevision.user?.username || 'System'} • {selectedRevision.description}
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleRestore}
                                    disabled={restoring}
                                    className="px-4 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition flex items-center gap-2 shadow-lg shadow-accent/20"
                                >
                                    <RefreshCw size={12} className={restoring ? 'animate-spin' : ''} />
                                    Restore This Version
                                </button>
                            </div>

                            {/* Read-only Roster Grid */}
                            <div className="flex-1 p-6 overflow-y-auto space-y-6">
                                {snapshotLoading ? (
                                    <div className="h-full flex flex-col items-center justify-center">
                                        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted">Retrieving Snapshot data...</p>
                                    </div>
                                ) : snapshotData ? (
                                    <>
                                        {/* Roster structural parameters banner */}
                                        <div className="p-4 bg-card border border-border rounded-xl flex flex-wrap gap-6 items-center justify-between text-[9px] font-black uppercase tracking-widest">
                                            <div className="flex items-center gap-2 text-accent">
                                                <Settings2 size={14} />
                                                <span>Roster Parameters Snapshot</span>
                                            </div>
                                            <div className="flex gap-4 items-center">
                                                <span className="text-muted">Shortname: <span className="text-text font-mono">{snapshotData.roster?.shortname}</span></span>
                                                <span className="text-muted">Default Rows Layout: <span className="text-text">{snapshotData.roster?.default_sections_per_row || 1} Per Row</span></span>
                                                <span className="text-muted">Columns count: <span className="text-text">{(snapshotData.roster?.columns || []).length} Columns</span></span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {/* 1. Master Sections */}
                                            {snapshotData.sections?.filter((s: any) => s.section?.type === 'master').map((secData: any) => 
                                                renderSection(secData)
                                            )}

                                            {/* 2. Custom Layout Rows */}
                                            {snapshotData.roster?.layout_settings?.rows?.map((row: any, rowIdx: number) => (
                                                <SyncGridRow
                                                    key={`row-${rowIdx}`}
                                                    columns={row.columns || 2}
                                                    className="grid gap-4 w-full items-start"
                                                >
                                                    {({ syncedHeights, onRowHeightSync }) => (
                                                        <>
                                                            {row.section_ids?.map((sId: number) => {
                                                                const secData = snapshotData.sections?.find((s: any) => {
                                                                    const secId = s.section?.id || s.old_id;
                                                                    return String(secId) === String(sId);
                                                                });
                                                                if (!secData || secData.section?.type === 'master') return <div key={`empty-${sId}`} />;
                                                                return renderSection(secData, syncedHeights, onRowHeightSync);
                                                            })}
                                                        </>
                                                    )}
                                                </SyncGridRow>
                                            ))}

                                            {/* 3. Unassigned Sections */}
                                            {(() => {
                                                const unassigned = snapshotData.sections?.filter((s: any) => {
                                                    if (s.section?.type === 'master') return false;
                                                    const secId = s.section?.id || s.old_id;
                                                    const inCustomRow = snapshotData.roster?.layout_settings?.rows?.some((r: any) =>
                                                        r.section_ids?.some((id: any) => String(id) === String(secId))
                                                    );
                                                    return !inCustomRow;
                                                }) || [];

                                                if (unassigned.length === 0) return null;

                                                const colsCount = snapshotData.roster?.default_sections_per_row || 2;

                                                if (snapshotData.roster?.layout_settings?.layout_mode === 'columns') {
                                                    return (
                                                        <div
                                                            className="grid gap-4 w-full items-start"
                                                            style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))` }}
                                                        >
                                                            {Array.from({ length: colsCount }).map((_, colIdx) => (
                                                                <div key={colIdx} className="flex flex-col gap-4">
                                                                    {unassigned
                                                                        .filter((_, idx) => idx % colsCount === colIdx)
                                                                        .map((secData: any) => 
                                                                            renderSection(secData)
                                                                        )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <SyncGridRow
                                                        columns={colsCount}
                                                        className="grid gap-4 w-full items-start"
                                                    >
                                                        {({ syncedHeights, onRowHeightSync }) => (
                                                            <>
                                                                {unassigned.map((secData: any) => 
                                                                    renderSection(secData, syncedHeights, onRowHeightSync)
                                                                )}
                                                            </>
                                                        )}
                                                    </SyncGridRow>
                                                );
                                            })()}

                                            {/* 4. Deleted Sections */}
                                            {diffs?.deletedSections && diffs.deletedSections.length > 0 && (
                                                <div className="mt-8 border-t border-dashed border-danger/30 pt-6">
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-danger mb-4 flex items-center gap-2">
                                                        <ShieldAlert size={14} /> Deleted Sections ({diffs.deletedSections.length})
                                                    </h3>
                                                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                                                        {diffs.deletedSections.map((sec: any) => 
                                                            renderSection({ section: sec, contents: [], children: [] }, undefined, undefined, false, true)
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-muted/40">
                                        Failed to parse snapshot
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted">
                            <History size={48} className="opacity-10 mb-4" />
                            <h3 className="text-sm font-bold uppercase tracking-widest">No revision selected</h3>
                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-tight mt-1">Select a version from the timeline on the right to view its details</p>
                        </div>
                    )}
                </div>

                {/* TIMELINE SIDEBAR */}
                <div className="w-80 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border bg-surface/30">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2">
                            <Clock size={14} /> Version History
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                        {revisions.length === 0 ? (
                            <div className="py-20 text-center text-[10px] text-muted font-black uppercase tracking-widest opacity-40">
                                No revisions found
                            </div>
                        ) : (
                            Object.entries(groupedRevisions).map(([dateStr, items]) => {
                                const isExpanded = !!expandedDates[dateStr];
                                return (
                                    <div key={dateStr} className="space-y-2 border-b border-border/30 pb-3 last:border-0 last:pb-0">
                                        <button 
                                            onClick={() => toggleDate(dateStr)}
                                            className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted hover:text-text transition-colors py-1 px-1 bg-surface/20 rounded"
                                        >
                                            <span>{dateStr}</span>
                                            <span className="text-[8px] opacity-60">
                                                {isExpanded ? '▼' : '►'} ({items.length})
                                            </span>
                                        </button>

                                        <AnimatePresence initial={false}>
                                            {isExpanded && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="overflow-hidden space-y-1.5 pl-1"
                                                >
                                                    {items.map((item) => {
                                                        const isSelected = selectedRevision?.id === item.id;
                                                        return (
                                                            <div 
                                                                key={item.id}
                                                                onClick={() => handleSelectRevision(item)}
                                                                className={`p-3 rounded-xl cursor-pointer border text-left transition-all ${
                                                                    isSelected 
                                                                        ? 'bg-accent/10 border-accent text-accent shadow-sm' 
                                                                        : 'bg-surface/30 hover:bg-surface/70 border-border/50 text-text'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] font-black tracking-tight flex items-center gap-1.5">
                                                                        <Clock size={10} />
                                                                        {formatTime(item.created_at)}
                                                                    </span>
                                                                    {item.user && (
                                                                        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-surface/50 border border-border/30">
                                                                            {item.user.username}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] font-bold text-muted hover:text-text truncate mt-1.5">
                                                                    {item.description}
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="p-4 border-t border-border bg-surface/20 text-[9px] font-black uppercase tracking-widest text-muted/60 flex items-center gap-2">
                        <Info size={12} className="text-accent" />
                        <span>Reverting restores the layout configuration and data rows exactly.</span>
                    </div>
                </div>
            </div>

            {/* Premium Hover Portal Tooltip */}
            {hoveredDiff && createPortal(
                <div
                    className="fixed z-[9999] px-3 py-2 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl text-[10px] font-medium pointer-events-none -translate-x-1/2 -translate-y-full flex flex-col gap-1 min-w-[200px] select-none text-text animate-in fade-in slide-in-from-bottom-2 duration-150"
                    style={{ left: hoveredDiff.x, top: hoveredDiff.y - 8 }}
                >
                    {hoveredDiff.content}
                </div>,
                document.body
            )}
        </div>
    );
};

export default RosterRevisions;

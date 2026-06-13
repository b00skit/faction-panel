import React from 'react';
import { MoreHorizontal, Plus, Calculator, Database } from 'lucide-react';
import { RosterSection } from '../types';
import { RosterTable } from './RosterTable';
import { SyncGridRow } from './SyncGridRow';
import api from '../api';
import toast from 'react-hot-toast';
import { hexToRgb } from '../utils';

interface SectionCardProps {
  section: RosterSection;
  user?: any;
  canModerate?: boolean;
  permissions?: any;
  columns?: any[];
  rosterColumns?: any[];
  datasets?: any[];
  recordData?: any[];
  flags?: any[];
  allContents?: any[];
  allColumns?: Map<string, any>;
  editMode?: boolean;
  rosterColor?: string;
  onAddChild?: (parentId: number) => void;
  onEdit?: (section: RosterSection) => void;
  onManageCounts?: (section: RosterSection) => void;
  calculateCount?: (count: any, scope: 'roster' | 'section', targetSection?: any) => string;
  onRefresh?: () => void;
  onUpdateRowLocal?: (id: number, data: any) => void;
  onReorderRows?: (sectionId: number, newOrder: any[]) => void;
  globalEditingRowId?: number | null;
  setGlobalEditingRowId?: (id: number | null) => void;
  globalSaveTrigger?: number;
  syncedHeights?: { [key: number]: number };
  onRowHeightSync?: (index: number, height: number, hasCheckbox: boolean) => void;
  isChild?: boolean;
}

const MemoizedHtml = React.memo(({ html }: { html: string }) => {
  return (
    <div 
        className="prose prose-invert max-w-none text-[11px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}, (prev, next) => prev.html === next.html);

export const SectionCard: React.FC<SectionCardProps> = ({ 
  section, 
  user,
  canModerate, 
  permissions,
  columns, 
  rosterColumns,
  datasets,
  recordData,
  flags,
  allContents,
  allColumns,
  editMode,
  rosterColor,
  onAddChild, 
  onEdit,
  onManageCounts,
  calculateCount,
  onRefresh,
  onUpdateRowLocal,
  onReorderRows,
  globalEditingRowId,
  setGlobalEditingRowId,
  globalSaveTrigger,
  syncedHeights,
  onRowHeightSync,
  isChild = false
}) => {
  const sectionColumns = section.use_roster_columns ? rosterColumns : (section.columns || rosterColumns);
  const hasHiddenColumns = (sectionColumns || []).some((col: any) => col.type?.includes('hidden'));
  const canViewHidden = canModerate || permissions?.view_hidden_data;
  const hasEditPermissions = canModerate || permissions?.edit_defined_fields || permissions?.edit_predefined;
  const isSectionRestricted = hasEditPermissions && !canViewHidden && hasHiddenColumns;

  const canEditSection = (canModerate || permissions?.add_sections) && !isSectionRestricted;
  const canAddChildSection = (canModerate || permissions?.add_sections) && !isSectionRestricted;

  const renderCounts = (target: any) => {
    if (!target.counts || target.counts.length === 0) return null;
    
    return (
        <div className="flex items-center gap-4 pl-3 border-l border-border/50">
            {target.counts.filter((c: any) => !c.is_hidden).map((count: any) => {
                const value = calculateCount?.(count, 'section', target);
                return (
                    <div key={count.id} className="flex items-center gap-2 group/count">
                        <div className="flex flex-col items-end">
                            <span className="text-[7px] font-black text-muted uppercase tracking-widest leading-none mb-0.5">{count.name}</span>
                            <span className="text-[10px] font-black tabular-nums leading-none" style={{ color: count.color }}>
                                {value}
                            </span>
                        </div>
                        {count.tag && (
                            <div className="px-1.5 py-0.5 bg-surface border border-border rounded text-[7px] font-black uppercase tracking-tighter text-muted group-hover/count:text-text transition-colors">
                                {count.tag}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
  };

  const processHtmlInner = React.useCallback((html: string) => {
      if (!html) return '';
      let processed = html;
      
      // Search for counts in this section and its parents to resolve variables
      const findCounts = (s: any): any[] => {
          let c = [...(s.counts || [])];
          return c;
      };

      const availableCounts = findCounts(section);
      availableCounts.forEach((count: any) => {
          if (count.variable_name) {
              const value = calculateCount?.(count, 'section', section) || '0';
              const regex = new RegExp(`{${count.variable_name}}`, 'g');
              processed = processed.replace(regex, String(value));
          }
      });
      return processed;
  }, [section, calculateCount]);

  const [processedHtml, setProcessedHtml] = React.useState(() => 
    section.type === 'content' ? processHtmlInner(section.content_html || '') : ''
  );

  React.useEffect(() => {
    if (section.type === 'content') {
        const newHtml = processHtmlInner(section.content_html || '');
        if (newHtml !== processedHtml) {
            setProcessedHtml(newHtml);
        }
    }
  }, [section.content_html, section.counts, allContents, processHtmlInner, section.type]);

  const renderChild = (child: RosterSection, syncProps?: { syncedHeights?: { [key: number]: number }, onRowHeightSync?: (index: number, height: number, hasCheckbox: boolean) => void }) => {
    return (
        <SectionCard 
            key={child.id}
            section={child}
            user={user}
            canModerate={canModerate}
            permissions={permissions}
            columns={child.use_roster_columns ? rosterColumns : (child.columns || rosterColumns)}
            rosterColumns={rosterColumns}
            datasets={datasets}
            recordData={recordData}
            flags={flags}
            allContents={allContents}
            allColumns={allColumns}
            editMode={editMode}
            rosterColor={effectiveColor}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onManageCounts={onManageCounts}
            calculateCount={calculateCount}
            onRefresh={onRefresh}
            onUpdateRowLocal={onUpdateRowLocal}
            onReorderRows={onReorderRows}
            globalEditingRowId={globalEditingRowId}
            setGlobalEditingRowId={setGlobalEditingRowId}
            globalSaveTrigger={globalSaveTrigger}
            syncedHeights={syncProps?.syncedHeights}
            onRowHeightSync={syncProps?.onRowHeightSync}
            isChild={true}
        />
    );
  };

  const handleAddRow = async (sectionId: number) => {
    const loadToast = toast.loading('Adding row...');
    try {
      await api.post(`/sections/${sectionId}/contents`, { type: 'predefined', content: {} });
      toast.success('Row added', { id: loadToast });
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to add row', { id: loadToast });
      console.error('Failed to add row', err);
    }
  };

  const handleAddSpacer = async (sectionId: number) => {
    const loadToast = toast.loading('Adding spacer...');
    try {
      await api.post(`/sections/${sectionId}/contents`, { type: 'spacer', content: {} });
      toast.success('Spacer added', { id: loadToast });
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to add spacer', { id: loadToast });
      console.error('Failed to add spacer', err);
    }
  };

  const handleUpdateRow = async (id: number, data: any, force = false, lastUpdatedAt?: string | null) => {
    // Optimistically update local state
    onUpdateRowLocal?.(id, data);
    
    try {
      await api.put(`/contents/${id}`, { 
        ...data,
        color: data.color, // Explicitly include color to ensure it's not lost
        force,
        last_updated_at: lastUpdatedAt
      });
      onRefresh?.();
      return true;
    } catch (err: any) {
      if (err.response?.status === 409) {
        const conflictData = err.response.data;
        
        // Suppress if the conflict is from the same user (e.g. another tab)
        if (conflictData.updated_by_id && user?.id && Number(conflictData.updated_by_id) === Number(user.id)) {
            return await handleUpdateRow(id, data, true);
        }

        toast((t) => (
          <div className="flex flex-col gap-2 min-w-[250px]">
            <p className="font-bold text-danger uppercase text-[10px] tracking-widest">Conflict Detected</p>
            <p className="text-[9px] opacity-80 uppercase leading-tight">
                {conflictData.updated_by} updated this row while you were editing.
            </p>
            <div className="flex gap-2 justify-end mt-1">
                <button 
                    onClick={() => {
                        toast.dismiss(t.id);
                        onRefresh?.();
                    }}
                    className="px-2 py-1 bg-surface border border-border rounded text-[8px] font-black uppercase"
                >
                    Discard & Refresh
                </button>
                <button 
                    onClick={async () => {
                        toast.dismiss(t.id);
                        await handleUpdateRow(id, data, true);
                    }}
                    className="px-2 py-1 bg-danger text-white rounded text-[8px] font-black uppercase"
                >
                    Force Overwrite
                </button>
            </div>
          </div>
        ), { duration: Infinity, position: 'top-center' });
        return false;
      }
      toast.error('Failed to save changes');
      console.error('Failed to update row', err);
      // Revert optimistic update on error by refreshing
      onRefresh?.();
      throw err;
    }
  };

  const performDeleteRow = async (id: number, silent = false) => {
    let loadToast = null;
    if (!silent) loadToast = toast.loading('Deleting row...');
    
    try {
      await api.delete(`/contents/${id}`);
      if (!silent && loadToast) toast.success('Row deleted', { id: loadToast });
      return true;
    } catch (err) {
      if (!silent && loadToast) toast.error('Failed to delete row', { id: loadToast });
      console.error('Failed to delete row', err);
      return false;
    }
  };

  const handleDeleteRow = async (id: number) => {
    toast((t) => (
      <div className="flex flex-col gap-1 text-left">
        <p className="font-bold">Delete this row?</p>
        <p className="text-[10px] opacity-80 uppercase tracking-tighter">This action cannot be undone.</p>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1 bg-surface hover:bg-bg border border-border rounded text-[9px] font-bold uppercase transition">Cancel</button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              const success = await performDeleteRow(id);
              if (success) onRefresh?.();
            }}
            className="px-2 py-1 bg-danger text-white hover:bg-danger/90 rounded text-[9px] font-bold uppercase transition shadow-lg shadow-danger/20"
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const handleBulkDeleteRows = async (ids: number[]) => {
    const loadToast = toast.loading(`Deleting ${ids.length} rows...`);
    try {
        let successCount = 0;
        for (const id of ids) {
            const success = await performDeleteRow(id, true);
            if (success) successCount++;
        }
        toast.success(`Successfully deleted ${successCount} rows`, { id: loadToast });
        onRefresh?.();
    } catch (err) {
        toast.error('Bulk deletion encountered an error', { id: loadToast });
    }
  };

  const isDynamic = section.data_source === 'dynamic';
  const effectiveColor = section.color || rosterColor || 'var(--accent)';

  if (section.type === 'master' || section.type === 'subsection') {
    return (
      <div 
        className={`${section.type === 'master' ? 'div-leadership' : 'unit-section'} w-full border border-border bg-card ${!isChild ? 'mb-2' : ''} group relative`}
        style={{ 
          '--accent': effectiveColor,
          '--accent-rgb': effectiveColor.startsWith('#') ? hexToRgb(effectiveColor) : undefined
        } as React.CSSProperties}
      >
        <div className="section-header h-[24px] px-2 border-b border-border bg-border/20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                {section.image_url && (
                    <img src={section.image_url} alt="" className="w-3 h-3 object-contain" />
                )}
                <span className="text-[9px] font-bold text-text uppercase">{section.name}</span>
            </div>
            {isDynamic && (
                <div className="px-1.5 py-0.5 bg-accent/10 border border-accent/20 rounded flex items-center gap-1 animate-pulse">
                    <Database size={8} className="text-accent" />
                    <span className="text-[7px] font-black uppercase text-accent tracking-tighter">Dynamic</span>
                </div>
            )}
            {renderCounts(section)}
          </div>
          <div className="flex items-center gap-2">
            {canEditSection && onManageCounts && (
                <button 
                    onClick={() => onManageCounts?.(section)}
                    className="p-1 hover:bg-surface rounded text-muted hover:text-accent transition-colors"
                    title="Manage Section Counts"
                >
                    <Calculator size={11} className="opacity-60" />
                </button>
            )}
            {canEditSection && (
                <button 
                    onClick={() => onEdit?.(section)}
                    className="p-1 hover:bg-surface rounded text-muted hover:text-text"
                >
                    <MoreHorizontal size={12} />
                </button>
            )}
          </div>
        </div>
        
        {/* Rows for master/subsection/dynamic */}
        {(section.contents?.length > 0 || (editMode && !isDynamic) || !section.children || section.children.length === 0) && (
            <RosterTable 
                sectionId={section.id}
                contents={section.contents || []} 
                allContents={allContents}
                user={user}
                isLeadership={section.type === 'master'} 
                accentColor={effectiveColor} 
                columns={columns} 
                datasets={datasets}
                recordData={recordData}
                flags={flags}
                allColumns={allColumns}
                editMode={editMode && !isDynamic}
                canModerate={canModerate && !isDynamic}
                permissions={isDynamic ? { 
                    ...permissions, 
                    manage_columns: false, 
                    add_sections: false, 
                    remove_sections: false, 
                    modify_roster: false,
                    edit_defined_fields: false,
                    edit_predefined: false
                } : permissions}
                onAddRow={isDynamic ? undefined : () => handleAddRow(section.id)}
                onAddSpacer={isDynamic ? undefined : () => handleAddSpacer(section.id)}
                onUpdateRow={isDynamic ? undefined : handleUpdateRow}
                onDeleteRow={isDynamic ? undefined : handleDeleteRow}
                onBulkDeleteRow={isDynamic ? undefined : handleBulkDeleteRows}
                onRefresh={onRefresh}
                onReorderRows={isDynamic ? undefined : (newOrder) => onReorderRows?.(section.id, newOrder)}
                globalEditingRowId={globalEditingRowId}
                setGlobalEditingRowId={setGlobalEditingRowId}
                saveTrigger={globalSaveTrigger}
                syncedHeights={syncedHeights}
                onRowHeightSync={onRowHeightSync}
                isDynamic={isDynamic}
                isRestricted={isSectionRestricted}
            />
        )}

        {/* Children for master/subsection (Recursive) */}
        {section.children && section.children.length > 0 && (
            <div className="sections-container w-full divide-y divide-border border-t border-border">
                {section.children.map(child => renderChild(child))}
            </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`bureau-card border border-border rounded-lg bg-card shadow-[var(--sh)] flex flex-col ${!isChild ? 'mb-2' : ''} group relative`}
      style={{ 
        '--accent': effectiveColor,
        '--accent-rgb': effectiveColor.startsWith('#') ? hexToRgb(effectiveColor) : undefined
      } as React.CSSProperties}
    >
      <div className="bureau-card-top flex h-[24px] items-stretch border-b border-border bg-surface shrink-0 rounded-t-lg overflow-hidden">
        <div className="w-[5px] shrink-0" style={{ backgroundColor: effectiveColor }} />
        <div className="flex-1 flex items-center px-2 justify-center gap-1.5 overflow-hidden">
          <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {section.image_url && (
                    <img src={section.image_url} alt="" className="w-3.5 h-3.5 object-contain" />
                )}
                <span className="font-bold text-[11px] text-text uppercase truncate">
                    {section.name}
                </span>
              </div>
              {renderCounts(section)}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {canEditSection && (
                <>
                    {onManageCounts && (
                        <button 
                            onClick={() => onManageCounts?.(section)}
                            className="px-1.5 py-0.5 hover:bg-bg rounded text-muted hover:text-accent flex items-center gap-1 transition-colors"
                            title="Manage Section Counts"
                        >
                            <span className="text-[7px] font-black uppercase tracking-widest">counts</span>
                        </button>
                    )}
                    {canAddChildSection && (
                        <button 
                            onClick={() => onAddChild?.(section.id)}
                            className="px-1.5 py-0.5 hover:bg-bg rounded text-muted hover:text-accent flex items-center gap-1 transition-colors"
                        >
                            <span className="text-[7px] font-black uppercase tracking-widest">section</span>
                            <Plus size={8} />
                        </button>
                    )}
                    <button 
                        onClick={() => onEdit?.(section)}
                        className="p-0.5 hover:bg-bg rounded text-muted hover:text-text"
                    >
                        <MoreHorizontal size={10} />
                    </button>
                </>
            )}
          </div>
        </div>
      </div>

      {/* Main Section Content / Rows */}
      {section.type !== 'content' && (section.contents?.length > 0 || (editMode && !isDynamic) || !section.children || section.children.length === 0) && (
        <RosterTable 
          sectionId={section.id}
          contents={section.contents || []} 
          allContents={allContents}
          user={user}
          accentColor={effectiveColor} 
          columns={columns} 
          datasets={datasets}
          recordData={recordData}
          flags={flags}
          allColumns={allColumns}
          editMode={editMode && !isDynamic}
          canModerate={canModerate && !isDynamic}
          permissions={isDynamic ? { 
            ...permissions, 
            manage_columns: false, 
            add_sections: false, 
            remove_sections: false, 
            modify_roster: false,
            edit_defined_fields: false,
            edit_predefined: false
          } : permissions}
          onAddRow={isDynamic ? undefined : () => handleAddRow(section.id)}
          onAddSpacer={isDynamic ? undefined : () => handleAddSpacer(section.id)}
          onUpdateRow={isDynamic ? undefined : handleUpdateRow}
          onDeleteRow={isDynamic ? undefined : handleDeleteRow}
          onBulkDeleteRow={isDynamic ? undefined : handleBulkDeleteRows}
          onRefresh={onRefresh}
          onReorderRows={isDynamic ? undefined : (newOrder) => onReorderRows?.(section.id, newOrder)}
          globalEditingRowId={globalEditingRowId}
          setGlobalEditingRowId={setGlobalEditingRowId}
          saveTrigger={globalSaveTrigger}
          syncedHeights={syncedHeights}
          onRowHeightSync={onRowHeightSync}
          isDynamic={isDynamic}
          isRestricted={isSectionRestricted}
        />
      )}

      {/* Sub-sections / Children */}
      <div className="sections-container w-full divide-y divide-border">
        {section.type === 'content' && (
            <div className="p-4 bg-card/30">
                <MemoizedHtml html={processedHtml} />
            </div>
        )}

        {section.layout_settings?.rows?.map((row: any, rowIdx: number) => (
          <SyncGridRow
            key={`row-${rowIdx}`}
            columns={row.columns || 1}
            className="grid w-full items-start divide-x divide-border"
          >
            {({ syncedHeights: rowSyncedHeights, onRowHeightSync: rowOnRowHeightSync }) => (
                <>
                    {row.section_ids?.map((sId: number) => {
                        const child = section.children?.find((s: any) => s.id === sId);
                        if (!child) return <div key={`empty-${sId}`} className="border-r border-border last:border-r-0" />;
                        return renderChild(child, { syncedHeights: rowSyncedHeights, onRowHeightSync: rowOnRowHeightSync });
                    })}
                </>
            )}
          </SyncGridRow>
        ))}

        {/* Fallback for children not in custom rows */}
        {(section.children?.filter((s: any) => !section.layout_settings?.rows?.some((r: any) => r.section_ids?.includes(s.id))).length ?? 0) > 0 && (
            <SyncGridRow 
                columns={section.subsections_per_row || 1}
                className="grid w-full items-start divide-x divide-border"
            >
                {({ syncedHeights: rowSyncedHeights, onRowHeightSync: rowOnRowHeightSync }) => (
                    <>
                        {section.children?.filter((s: any) => {
                            const inCustomRow = section.layout_settings?.rows?.some((r: any) => r.section_ids?.includes(s.id));
                            return !inCustomRow;
                        }).map((child: any) => renderChild(child, { syncedHeights: rowSyncedHeights, onRowHeightSync: rowOnRowHeightSync }))}
                    </>
                )}
            </SyncGridRow>
        )}
      </div>
    </div>
  );
};

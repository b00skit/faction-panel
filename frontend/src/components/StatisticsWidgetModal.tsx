import React, { useState } from 'react';
import { X, Plus, Trash2, Save, BarChart3, Settings2, Sigma, PieChart, Table as TableIcon, Filter, Columns, Hash, Target } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { StatisticsWidget, Roster, FactionRecordDatabase } from '../types';

interface StatisticsWidgetModalProps {
    modelId: number;
    widget?: StatisticsWidget;
    rosters: Roster[];
    datasets: any[];
    recordData: FactionRecordDatabase[];
    onClose: () => void;
    onSave: () => void;
}

export const StatisticsWidgetModal: React.FC<StatisticsWidgetModalProps> = ({ 
    modelId, 
    widget, 
    rosters, 
    datasets, 
    recordData,
    onClose, 
    onSave 
}) => {
    const [name, setName] = useState(widget?.name || '');
    const [type, setType] = useState<'pie' | 'bar' | 'line' | 'table' | 'stat' | 'radar'>(widget?.type || 'pie');
    const [width, setWidth] = useState(widget?.width || 6);
    const [config, setConfig] = useState<any>(widget?.configuration || {
        mode: widget?.configuration?.group_by ? 'grouped' : 'series',
        series: [],
        group_by: {
            source_type: 'roster',
            source_id: '',
            column: ''
        },
        filters: []
    });

    const [isSaving, setIsSaving] = useState(false);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);

    const updateGroupBy = (fields: any) => {
        setConfig({
            ...config,
            group_by: { ...config.group_by, ...fields }
        });
    };

    const addGlobalFilter = () => {
        setConfig({
            ...config,
            filters: [
                ...(config.filters || []),
                { id: `filter_${Date.now()}`, target_col: '', match_type: 'exists', match_value: '' }
            ]
        });
    };

    const updateGlobalFilter = (idx: number, fields: any) => {
        const newFilters = [...(config.filters || [])];
        newFilters[idx] = { ...newFilters[idx], ...fields };
        setConfig({ ...config, filters: newFilters });
    };

    const removeGlobalFilter = (idx: number) => {
        setConfig({ ...config, filters: config.filters.filter((_: any, i: number) => i !== idx) });
    };

    const handleSave = async () => {
        if (!name) return toast.error('Name is required');
        setIsSaving(true);
        const loadToast = toast.loading('Saving widget...');
        try {
            const payload = {
                name,
                type,
                width,
                configuration: config
            };
            if (widget) {
                await api.put(`/statistics-widgets/${widget.id}`, payload);
            } else {
                await api.post(`/statistics/${modelId}/widgets`, payload);
            }
            toast.success('Widget saved', { id: loadToast });
            onSave();
        } catch (err) {
            toast.error('Failed to save widget', { id: loadToast });
        } finally {
            setIsSaving(false);
        }
    };

    const addSeries = () => {
        const newSeries = {
            id: `series_${Date.now()}`,
            name: 'New Data Point',
            color: '#3b82f6',
            source_type: 'roster',
            source_id: rosters[0]?.id || null,
            operation: 'count',
            target_col: null,
            logic_groups: [
                {
                    id: `group_${Date.now()}`,
                    operator: 'AND',
                    math_operator: '+',
                    operation: 'count',
                    target_col: null,
                    conditions: []
                }
            ]
        };
        setConfig({ ...config, series: [...(config.series || []), newSeries] });
        setEditingIdx((config.series || []).length);
    };

    const updateSeries = (idx: number, fields: any) => {
        const newSeries = [...(config.series || [])];
        newSeries[idx] = { ...newSeries[idx], ...fields };
        setConfig({ ...config, series: newSeries });
    };

    const removeSeries = (idx: number) => {
        setConfig({ ...config, series: config.series.filter((_: any, i: number) => i !== idx) });
        if (editingIdx === idx) setEditingIdx(null);
    };

    const addLogicGroup = (seriesIdx: number) => {
        const newSeries = [...config.series];
        newSeries[seriesIdx].logic_groups = [
            ...(newSeries[seriesIdx].logic_groups || []),
            {
                id: `group_${Date.now()}`,
                operator: 'AND',
                math_operator: '+',
                operation: 'count',
                target_col: null,
                conditions: []
            }
        ];
        setConfig({ ...config, series: newSeries });
    };

    const removeLogicGroup = (seriesIdx: number, groupIdx: number) => {
        const newSeries = [...config.series];
        newSeries[seriesIdx].logic_groups = newSeries[seriesIdx].logic_groups.filter((_: any, i: number) => i !== groupIdx);
        setConfig({ ...config, series: newSeries });
    };

    const updateLogicGroup = (seriesIdx: number, groupIdx: number, fields: any) => {
        const newSeries = [...config.series];
        newSeries[seriesIdx].logic_groups[groupIdx] = { ...newSeries[seriesIdx].logic_groups[groupIdx], ...fields };
        setConfig({ ...config, series: newSeries });
    };

    const addCondition = (seriesIdx: number, groupIdx: number) => {
        const newSeries = [...config.series];
        newSeries[seriesIdx].logic_groups[groupIdx].conditions = [
            ...(newSeries[seriesIdx].logic_groups[groupIdx].conditions || []),
            {
                id: `cond_${Date.now()}`,
                target_col: '',
                match_type: 'exists',
                match_value: ''
            }
        ];
        setConfig({ ...config, series: newSeries });
    };

    const updateCondition = (seriesIdx: number, groupIdx: number, condIdx: number, fields: any) => {
        const newSeries = [...config.series];
        newSeries[seriesIdx].logic_groups[groupIdx].conditions[condIdx] = { 
            ...newSeries[seriesIdx].logic_groups[groupIdx].conditions[condIdx], 
            ...fields 
        };
        setConfig({ ...config, series: newSeries });
    };

    const getColumns = (sourceType: string, sourceId: any) => {
        if (sourceType === 'roster' || sourceType === 'section') {
            const roster = rosters.find(r => r.id === parseInt(sourceId));
            if (roster) return roster.columns || [];
            
            // If it's a section, we might need to find the roster it belongs to or use its own columns
            const findSection = (sections: any[]): any => {
                for (const s of sections) {
                    if (s.id === parseInt(sourceId)) return s;
                    if (s.children) {
                        const found = findSection(s.children);
                        if (found) return found;
                    }
                }
                return null;
            };

            for (const r of rosters) {
                const s = findSection(r.root_sections || []);
                if (s) return s.use_roster_columns ? r.columns : s.columns;
            }
        } else if (sourceType === 'database') {
            const db = recordData.find(d => d.id === parseInt(sourceId));
            return db?.database_structure || [];
        }
        return [];
    };

    const getNumericColumns = (sourceType: string, sourceId: any) => {
        return getColumns(sourceType, sourceId).filter((c: any) => 
            ['number', 'integer', 'float'].includes(c.type?.toLowerCase()) || 
            c.name.toLowerCase().includes('count') ||
            c.name.toLowerCase().includes('amount') ||
            c.name.toLowerCase().includes('value')
        );
    };

    const getAllSections = () => {
        const sections: any[] = [];
        const processSections = (list: any[]) => {
            list.forEach(s => {
                sections.push(s);
                if (s.children) processSections(s.children);
            });
        };
        rosters.forEach(r => {
            if (r.root_sections) processSections(r.root_sections);
        });
        return sections;
    };

    const sections = getAllSections();

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[700]">
            <div className="bg-card w-full max-w-5xl h-[90vh] rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
                <div className="p-6 border-b border-border bg-surface/30 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-2">
                            <BarChart3 className="text-accent" size={24} />
                            {widget ? 'Configure' : 'Add'} Widget
                        </h2>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">
                            Configure individual data visualization
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors">
                        <X size={20} className="text-muted" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-surface/5">
                    <div className="grid grid-cols-12 gap-8">
                        <div className="col-span-3">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5">Widget Name</label>
                            <input 
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text font-bold focus:border-accent outline-none transition"
                                placeholder="Widget title"
                            />
                        </div>
                        <div className="col-span-6">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5">Chart Type</label>
                            <div className="grid grid-cols-6 gap-2">
                                {[
                                    { id: 'pie', icon: PieChart, label: 'Pie' },
                                    { id: 'bar', icon: BarChart3, label: 'Bar' },
                                    { id: 'line', icon: BarChart3, label: 'Line' },
                                    { id: 'table', icon: TableIcon, label: 'Table' },
                                    { id: 'stat', icon: Hash, label: 'Stat' },
                                    { id: 'radar', icon: Target, label: 'Radar' },
                                ].map(t => (
                                    <button 
                                        type="button"
                                        key={t.id}
                                        onClick={() => setType(t.id as any)}
                                        className={`flex flex-col items-center justify-center py-2 rounded-xl border-2 transition-all gap-1 ${type === t.id ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-surface text-muted hover:border-accent/30'}`}
                                    >
                                        <t.icon size={16} />
                                        <span className="text-[9px] font-black uppercase">{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-3">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5">Width (Grid 12)</label>
                            <div className="grid grid-cols-3 gap-1">
                                {[4, 6, 12].map(w => (
                                    <button 
                                        type="button"
                                        key={w}
                                        onClick={() => setWidth(w)}
                                        className={`py-2 rounded-xl border-2 font-black text-xs transition-all ${width === w ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-surface text-muted hover:border-accent/30'}`}
                                    >
                                        {w === 4 ? '1/3' : w === 6 ? '1/2' : 'Full'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-border pt-8 space-y-6">
                        <div className="flex bg-surface/50 p-1 rounded-xl border border-border w-fit">
                            <button 
                                type="button"
                                onClick={() => setConfig({ ...config, mode: 'series' })}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${config.mode === 'series' ? 'bg-card text-accent shadow-sm' : 'text-muted hover:text-text'}`}
                            >
                                Manual Series
                            </button>
                            <button 
                                type="button"
                                onClick={() => setConfig({ ...config, mode: 'grouped' })}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${config.mode === 'grouped' ? 'bg-card text-accent shadow-sm' : 'text-muted hover:text-text'}`}
                            >
                                Automatic Grouping
                            </button>
                        </div>

                        {config.mode === 'grouped' ? (
                            <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-3 gap-6 bg-surface/30 p-6 rounded-2xl border border-border/50">
                                    <div>
                                        <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Source Type</label>
                                        <select 
                                            value={config.group_by.source_type}
                                            onChange={e => updateGroupBy({ source_type: e.target.value, source_id: '', column: '' })}
                                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase"
                                        >
                                            <option value="roster">Roster</option>
                                            <option value="section">Section</option>
                                            <option value="database">Database</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Select Source</label>
                                        <select 
                                            value={config.group_by.source_id || ''}
                                            onChange={e => updateGroupBy({ source_id: e.target.value, column: '' })}
                                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase"
                                        >
                                            <option value="">Select Source...</option>
                                            {config.group_by.source_type === 'roster' 
                                                ? rosters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                                                : config.group_by.source_type === 'section'
                                                ? sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                                : recordData.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                                            }
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Group By Column</label>
                                        <select 
                                            value={config.group_by.column || ''}
                                            onChange={e => updateGroupBy({ column: e.target.value })}
                                            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase"
                                        >
                                            <option value="">Select Column...</option>
                                            {getColumns(config.group_by.source_type, config.group_by.source_id).map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {config.group_by.source_type === 'roster' && config.group_by.source_id && (
                                    <div className="bg-surface/30 p-6 rounded-2xl border border-border/50 space-y-4">
                                        <div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-text">Section Scoping</h3>
                                            <p className="text-[9px] text-muted font-bold uppercase mt-1 text-accent">Leave empty to include ALL sections</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {sections.filter(s => s.roster_id === parseInt(config.group_by.source_id)).map(s => (
                                                <button 
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const current = config.section_ids || [];
                                                        const newVal = current.includes(s.id) ? current.filter((id: number) => id !== s.id) : [...current, s.id];
                                                        setConfig({ ...config, section_ids: newVal });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all truncate max-w-[200px] ${config.section_ids?.includes(s.id) ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-card border-border text-muted hover:border-accent/50'}`}
                                                >
                                                    {s.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-text">Global Filters</h3>
                                            <p className="text-[9px] text-muted font-bold uppercase mt-1">Restrict data before grouping</p>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={addGlobalFilter}
                                            className="px-3 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[8px] font-black uppercase tracking-widest border border-accent/20 transition-all flex items-center gap-1.5"
                                        >
                                            <Plus size={10} /> Add Filter
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {(config.filters || []).map((filter: any, fIdx: number) => (
                                            <div key={filter.id} className="bg-surface/30 border border-border/50 rounded-xl p-3 flex items-center gap-3">
                                                <div className="flex-1 grid grid-cols-3 gap-2">
                                                    <select 
                                                        value={filter.target_col}
                                                        onChange={e => updateGlobalFilter(fIdx, { target_col: e.target.value })}
                                                        className="bg-card border border-border rounded-lg px-2 py-1.5 text-[10px] font-bold"
                                                    >
                                                        <option value="">Column...</option>
                                                        {getColumns(config.group_by.source_type, config.group_by.source_id).map((c: any) => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                    {(() => {
                                                        const col = getColumns(config.group_by.source_type, config.group_by.source_id).find((c: any) => String(c.id) === String(filter.target_col) || c.name === filter.target_col);
                                                        return (
                                                            <select 
                                                                value={filter.match_type}
                                                                onChange={e => updateGlobalFilter(fIdx, { match_type: e.target.value })}
                                                                className="bg-card border border-border rounded-lg px-2 py-1.5 text-[10px]"
                                                            >
                                                                <option value="exists">Exists</option>
                                                                <option value="equals">=</option>
                                                                <option value="not_equals">!=</option>
                                                                <option value="contains">Contains</option>
                                                                <option value="is_null">Empty</option>
                                                                {((col?.checkboxes && col.checkboxes.length > 0) || col?.type === 'checkboxes') && (
                                                                    <option value="contains_checkbox">Contains Checkbox</option>
                                                                )}
                                                                {((col?.tags && col.tags.length > 0) || col?.type === 'tags') && (
                                                                    <option value="contains_tag">Contains Tag</option>
                                                                )}
                                                            </select>
                                                        );
                                                    })()}
                                                    {(() => {
                                                        const col = getColumns(config.group_by.source_type, config.group_by.source_id).find((c: any) => String(c.id) === String(filter.target_col) || c.name === filter.target_col);
                                                        if (['contains_checkbox', 'contains_tag'].includes(filter.match_type)) {
                                                            const labels = filter.match_type === 'contains_checkbox'
                                                                ? (col?.checkboxes || []).filter(Boolean).map((cb: any) => typeof cb === 'string' ? cb : cb.label)
                                                                : (col?.tags || []).filter(Boolean).map((t: any) => typeof t === 'string' ? t : t.label);
                                                            const uniqueLabels = Array.from(new Set(labels));
                                                            return (
                                                                <select
                                                                    value={filter.match_value || ''}
                                                                    onChange={e => updateGlobalFilter(fIdx, { match_value: e.target.value })}
                                                                    className="bg-card border border-border rounded-lg px-2 py-1.5 text-[10px] font-bold"
                                                                >
                                                                    <option value="">Select Option...</option>
                                                                    {uniqueLabels.map(l => (
                                                                        <option key={String(l)} value={String(l)}>{String(l)}</option>
                                                                    ))}
                                                                </select>
                                                            );
                                                        }
                                                        return (
                                                            <input 
                                                                value={filter.match_value || ''}
                                                                onChange={e => updateGlobalFilter(fIdx, { match_value: e.target.value })}
                                                                className="bg-card border border-border rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-accent"
                                                                placeholder="Value..."
                                                                disabled={['exists', 'is_null'].includes(filter.match_type)}
                                                            />
                                                        );
                                                    })()}
                                                </div>
                                                <button type="button" onClick={() => removeGlobalFilter(fIdx)} className="text-muted hover:text-danger p-1">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-text">Data Series</h3>
                                        <p className="text-[9px] text-muted font-bold uppercase mt-1">Add metrics to visualize manually</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={addSeries}
                                        className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 border border-accent/20 shadow-sm"
                                    >
                                        <Plus size={14} /> Add Series
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {(config.series || []).map((series: any, idx: number) => (
                                        <div key={series.id} className={`bg-card border rounded-2xl transition-all ${editingIdx === idx ? 'border-accent ring-1 ring-accent/20 shadow-xl' : 'border-border'}`}>
                                            <div className="p-4 flex items-center gap-4">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: series.color }} />
                                                <div className="flex-1">
                                                    <input 
                                                        value={series.name}
                                                        onChange={e => updateSeries(idx, { name: e.target.value })}
                                                        className="bg-transparent border-none p-0 font-black text-sm text-text focus:ring-0 uppercase tracking-widest"
                                                        placeholder="Series Name"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                                                        className={`p-2 rounded-lg ${editingIdx === idx ? 'bg-accent text-white' : 'text-muted hover:bg-surface border border-transparent hover:border-border'}`}
                                                    >
                                                        <Settings2 size={16} />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => removeSeries(idx)}
                                                        className="p-2 text-muted hover:text-danger rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {editingIdx === idx && (
                                                <div className="px-6 pb-6 border-t border-border/50 pt-6 space-y-6">
                                                    <div className="grid grid-cols-4 gap-6">
                                                        <div>
                                                            <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Source Type</label>
                                                            <select 
                                                                value={series.source_type}
                                                                onChange={e => updateSeries(idx, { 
                                                                    source_type: e.target.value, 
                                                                    source_id: null, 
                                                                    logic_groups: [], 
                                                                    count_config: null,
                                                                    count_parent_id: null,
                                                                    count_parent_type: 'roster'
                                                                })}
                                                                className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase"
                                                            >
                                                                <option value="roster">Roster</option>
                                                                <option value="section">Section</option>
                                                                <option value="database">Database</option>
                                                                <option value="count">Existing Count</option>
                                                            </select>
                                                        </div>

                                                        {series.source_type === 'count' ? (
                                                            <>
                                                                <div>
                                                                    <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Count Parent</label>
                                                                    <div className="flex gap-1">
                                                                        <select 
                                                                            value={series.count_parent_type || 'roster'}
                                                                            onChange={e => updateSeries(idx, { count_parent_type: e.target.value, count_parent_id: '', count_config: null })}
                                                                            className="bg-surface border border-border rounded-lg px-2 py-1.5 text-[9px] font-black uppercase"
                                                                        >
                                                                            <option value="roster">Roster</option>
                                                                            <option value="section">Section</option>
                                                                        </select>
                                                                        <select 
                                                                            value={series.count_parent_id || ''}
                                                                            onChange={e => updateSeries(idx, { count_parent_id: e.target.value, count_config: null })}
                                                                            className="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-[9px] font-black uppercase"
                                                                        >
                                                                            <option value="">Select...</option>
                                                                            {series.count_parent_type === 'section'
                                                                                ? sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                                                                : rosters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                                                                            }
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Select Count</label>
                                                                    <select 
                                                                        value={series.count_config?.id || ''}
                                                                        onChange={e => {
                                                                            const parent = series.count_parent_type === 'section' 
                                                                                ? sections.find(s => s.id === parseInt(series.count_parent_id))
                                                                                : rosters.find(r => r.id === parseInt(series.count_parent_id));
                                                                            const count = parent?.counts?.find((c: any) => c.id === e.target.value);
                                                                            updateSeries(idx, { count_config: count });
                                                                        }}
                                                                        className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase"
                                                                    >
                                                                        <option value="">Select Count...</option>
                                                                        {(series.count_parent_type === 'section' 
                                                                            ? sections.find(s => s.id === parseInt(series.count_parent_id))
                                                                            : rosters.find(r => r.id === parseInt(series.count_parent_id))
                                                                        )?.counts?.map((c: any) => (
                                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div>
                                                                    <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Select Source</label>
                                                                    <select 
                                                                        value={series.source_id || ''}
                                                                        onChange={e => updateSeries(idx, { source_id: e.target.value, logic_groups: [] })}
                                                                        className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase"
                                                                    >
                                                                        <option value="">Select Source...</option>
                                                                        {series.source_type === 'roster' 
                                                                            ? rosters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                                                                            : series.source_type === 'section'
                                                                            ? sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                                                            : recordData.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                                                                        }
                                                                    </select>
                                                                </div>
                                                                 <div>
                                                                    <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Operation</label>
                                                                    <select 
                                                                        value={series.operation || 'count'}
                                                                        onChange={e => updateSeries(idx, { operation: e.target.value })}
                                                                        className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase"
                                                                    >
                                                                        <option value="count">Count Entries</option>
                                                                        <option value="count_unique">Count Unique Values</option>
                                                                        <option value="sum">Sum Value</option>
                                                                        <option value="avg">Average Value</option>
                                                                        <option value="min">Minimum Value</option>
                                                                        <option value="max">Maximum Value</option>
                                                                    </select>
                                                                </div>
                                                                {series.operation && series.operation !== 'count' && (
                                                                    <div>
                                                                        <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Target Column</label>
                                                                        <select 
                                                                            value={series.target_col || ''}
                                                                            onChange={e => updateSeries(idx, { target_col: e.target.value })}
                                                                            className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase"
                                                                        >
                                                                            <option value="">Select Column...</option>
                                                                            {(series.operation === 'count_unique' ? getColumns(series.source_type, series.source_id) : getNumericColumns(series.source_type, series.source_id)).map((c: any) => (
                                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        <div>
                                                            <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Color</label>
                                                            <div className="flex gap-2">
                                                                <input 
                                                                    type="color"
                                                                    value={series.color}
                                                                    onChange={e => updateSeries(idx, { color: e.target.value })}
                                                                    className="h-8 w-10 bg-surface border border-border rounded-lg p-1 cursor-pointer"
                                                                />
                                                                <input 
                                                                    value={series.color}
                                                                    onChange={e => updateSeries(idx, { color: e.target.value })}
                                                                    className="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-[10px] text-text font-mono uppercase"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {series.source_id && (
                                                        <div className="space-y-6">
                                                            <div className="flex justify-between items-center">
                                                                <label className="block text-[9px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
                                                                    <Filter size={12} /> Logic Groups & Filters
                                                                </label>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => addLogicGroup(idx)}
                                                                    className="px-3 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[8px] font-black uppercase tracking-widest border border-accent/20 transition-all flex items-center gap-1.5"
                                                                >
                                                                    <Plus size={10} /> Add Group
                                                                </button>
                                                            </div>

                                                            <div className="space-y-4">
                                                                {(series.logic_groups || []).map((group: any, gIdx: number) => (
                                                                    <div key={group.id} className="bg-surface/30 border border-border/50 rounded-2xl overflow-hidden">
                                                                        <div className="px-4 py-2 bg-surface/50 border-b border-border/50 flex items-center justify-between">
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="text-[8px] font-black uppercase text-muted">Match</span>
                                                                                    <select 
                                                                                        value={group.operator}
                                                                                        onChange={e => updateLogicGroup(idx, gIdx, { operator: e.target.value })}
                                                                                        className="bg-card border border-border rounded px-1.5 py-0.5 text-[9px] font-black uppercase"
                                                                                    >
                                                                                        <option value="AND">AND</option>
                                                                                        <option value="OR">OR</option>
                                                                                    </select>
                                                                                </div>
                                                                                <div className="w-px h-3 bg-border" />
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="text-[8px] font-black uppercase text-muted">Math</span>
                                                                                    <select 
                                                                                        value={group.math_operator}
                                                                                        onChange={e => updateLogicGroup(idx, gIdx, { math_operator: e.target.value })}
                                                                                        className="bg-card border border-border rounded px-1.5 py-0.5 text-[9px] font-black uppercase"
                                                                                    >
                                                                                        <option value="+">+</option>
                                                                                        <option value="-">-</option>
                                                                                    </select>
                                                                                </div>
                                                                                <div className="w-px h-3 bg-border" />
                                                                                 <div className="flex items-center gap-1.5">
                                                                                    <span className="text-[8px] font-black uppercase text-muted">Op</span>
                                                                                    <select 
                                                                                        value={group.operation || 'count'}
                                                                                        onChange={e => updateLogicGroup(idx, gIdx, { operation: e.target.value })}
                                                                                        className="bg-card border border-border rounded px-1.5 py-0.5 text-[9px] font-black uppercase"
                                                                                    >
                                                                                        <option value="count">Count</option>
                                                                                        <option value="count_unique">Count Unique</option>
                                                                                        <option value="sum">Sum</option>
                                                                                        <option value="avg">Avg</option>
                                                                                    </select>
                                                                                </div>
                                                                                {group.operation && group.operation !== 'count' && (
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="text-[8px] font-black uppercase text-muted">Col</span>
                                                                                        <select 
                                                                                            value={group.target_col || ''}
                                                                                            onChange={e => updateLogicGroup(idx, gIdx, { target_col: e.target.value })}
                                                                                            className="bg-card border border-border rounded px-1.5 py-0.5 text-[9px] font-black uppercase"
                                                                                        >
                                                                                            <option value="">Select...</option>
                                                                                            {(group.operation === 'count_unique' ? getColumns(series.source_type, series.source_id) : getNumericColumns(series.source_type, series.source_id)).map((c: any) => (
                                                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <button 
                                                                                    type="button"
                                                                                    onClick={() => addCondition(idx, gIdx)}
                                                                                    className="text-[8px] font-black uppercase text-accent hover:underline"
                                                                                >
                                                                                    Add Filter
                                                                                </button>
                                                                                <button 
                                                                                    type="button"
                                                                                    onClick={() => removeLogicGroup(idx, gIdx)}
                                                                                    className="text-muted hover:text-danger p-1"
                                                                                >
                                                                                    <Trash2 size={12} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="p-4 space-y-2">
                                                                            {(group.conditions || []).map((cond: any, cIdx: number) => {
                                                                                const isInRoster = cond.match_type === 'in_roster';
                                                                                return (
                                                                                    <div key={cond.id} className="flex flex-col gap-2 bg-surface/10 p-3 rounded-xl border border-border/30">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="flex-1 grid grid-cols-3 gap-2">
                                                                                                <select 
                                                                                                    value={cond.target_col}
                                                                                                    onChange={e => updateCondition(idx, gIdx, cIdx, { target_col: e.target.value })}
                                                                                                    className="bg-card border border-border rounded-lg px-2 py-1.5 text-[10px] font-bold"
                                                                                                >
                                                                                                    <option value="">Select Column...</option>
                                                                                                    {getColumns(series.source_type, series.source_id).map((c: any) => (
                                                                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                                                                    ))}
                                                                                                </select>
                                                                                                {(() => {
                                                                                                    const col = getColumns(series.source_type, series.source_id).find((c: any) => String(c.id) === String(cond.target_col) || c.name === cond.target_col);
                                                                                                    return (
                                                                                                        <select 
                                                                                                            value={cond.match_type}
                                                                                                            onChange={e => updateCondition(idx, gIdx, cIdx, { match_type: e.target.value })}
                                                                                                            className="bg-card border border-border rounded-lg px-2 py-1.5 text-[10px]"
                                                                                                        >
                                                                                                            <option value="exists">Exists</option>
                                                                                                            <option value="equals">=</option>
                                                                                                            <option value="not_equals">!=</option>
                                                                                                            <option value="contains">Contains</option>
                                                                                                            <option value="is_null">Is Empty</option>
                                                                                                            <option value="in_roster">Is In Roster</option>
                                                                                                            {((col?.checkboxes && col.checkboxes.length > 0) || col?.type === 'checkboxes') && (
                                                                                                                <option value="contains_checkbox">Contains Checkbox</option>
                                                                                                            )}
                                                                                                            {((col?.tags && col.tags.length > 0) || col?.type === 'tags') && (
                                                                                                                <option value="contains_tag">Contains Tag</option>
                                                                                                            )}
                                                                                                        </select>
                                                                                                    );
                                                                                                })()}
                                                                                                {(() => {
                                                                                                    const col = getColumns(series.source_type, series.source_id).find((c: any) => String(c.id) === String(cond.target_col) || c.name === cond.target_col);
                                                                                                    if (['contains_checkbox', 'contains_tag'].includes(cond.match_type)) {
                                                                                                        const labels = cond.match_type === 'contains_checkbox'
                                                                                                            ? (col?.checkboxes || []).filter(Boolean).map((cb: any) => typeof cb === 'string' ? cb : cb.label)
                                                                                                            : (col?.tags || []).filter(Boolean).map((t: any) => typeof t === 'string' ? t : t.label);
                                                                                                        const uniqueLabels = Array.from(new Set(labels));
                                                                                                        return (
                                                                                                            <select
                                                                                                                value={cond.match_value || ''}
                                                                                                                onChange={e => updateCondition(idx, gIdx, cIdx, { match_value: e.target.value })}
                                                                                                                className="bg-card border border-border rounded-lg px-2 py-1.5 text-[10px] font-bold"
                                                                                                            >
                                                                                                                <option value="">Select Option...</option>
                                                                                                                {uniqueLabels.map(l => (
                                                                                                                    <option key={String(l)} value={String(l)}>{String(l)}</option>
                                                                                                                ))}
                                                                                                            </select>
                                                                                                        );
                                                                                                    }
                                                                                                    return (
                                                                                                        <input 
                                                                                                            value={isInRoster ? 'Joined to Roster' : cond.match_value || ''}
                                                                                                            onChange={e => updateCondition(idx, gIdx, cIdx, { match_value: e.target.value })}
                                                                                                            className="bg-card border border-border rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-accent"
                                                                                                            placeholder="Value..."
                                                                                                            disabled={isInRoster || ['exists', 'is_null'].includes(cond.match_type)}
                                                                                                        />
                                                                                                    );
                                                                                                })()}
                                                                                            </div>
                                                                                            <button 
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    const newConditions = group.conditions.filter((_: any, i: number) => i !== cIdx);
                                                                                                    updateLogicGroup(idx, gIdx, { conditions: newConditions });
                                                                                                }}
                                                                                                className="p-1.5 text-muted hover:text-danger rounded-lg transition-colors"
                                                                                            >
                                                                                                <X size={14} />
                                                                                            </button>
                                                                                        </div>

                                                                                        {isInRoster && (
                                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-surface/30 rounded-lg border border-border/40 text-[9px] animate-in fade-in duration-200">
                                                                                                <div>
                                                                                                    <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1">Target Roster</label>
                                                                                                    <select
                                                                                                        value={cond.relation_roster_id || ''}
                                                                                                        onChange={e => updateCondition(idx, gIdx, cIdx, { relation_roster_id: e.target.value, relation_roster_col: '', relation_column: '' })}
                                                                                                        className="w-full bg-card border border-border rounded px-2 py-1 text-[9px] font-bold"
                                                                                                    >
                                                                                                        <option value="">Select Roster...</option>
                                                                                                        {rosters.map(r => (
                                                                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                                                                        ))}
                                                                                                    </select>
                                                                                                </div>
                                                                                                <div>
                                                                                                    <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1">Roster Join Column</label>
                                                                                                    <select
                                                                                                        value={cond.relation_roster_col || ''}
                                                                                                        onChange={e => updateCondition(idx, gIdx, cIdx, { relation_roster_col: e.target.value })}
                                                                                                        className="w-full bg-card border border-border rounded px-2 py-1 text-[9px] font-bold"
                                                                                                        disabled={!cond.relation_roster_id}
                                                                                                    >
                                                                                                        <option value="">Select Join Column...</option>
                                                                                                        {getColumns('roster', cond.relation_roster_id).map((c: any) => (
                                                                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                                                                        ))}
                                                                                                    </select>
                                                                                                </div>
                                                                                                <div className="md:col-span-2 border-t border-border/20 pt-2 mt-1">
                                                                                                    <p className="font-black uppercase tracking-wider text-accent mb-2">Optional Roster Column Filter</p>
                                                                                                    <div className="grid grid-cols-3 gap-2">
                                                                                                        <div>
                                                                                                            <label className="block text-[7px] font-black uppercase text-muted mb-0.5">Roster Column</label>
                                                                                                            <select
                                                                                                                value={cond.relation_column || ''}
                                                                                                                onChange={e => updateCondition(idx, gIdx, cIdx, { relation_column: e.target.value })}
                                                                                                                className="w-full bg-card border border-border rounded px-2 py-1 text-[9px] font-bold"
                                                                                                                disabled={!cond.relation_roster_id}
                                                                                                            >
                                                                                                                <option value="">No filter...</option>
                                                                                                                {getColumns('roster', cond.relation_roster_id).map((c: any) => (
                                                                                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                                                                                ))}
                                                                                                            </select>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            <label className="block text-[7px] font-black uppercase text-muted mb-0.5">Match Type</label>
                                                                                                            <select
                                                                                                                value={cond.relation_match_type || 'equals'}
                                                                                                                onChange={e => updateCondition(idx, gIdx, cIdx, { relation_match_type: e.target.value })}
                                                                                                                className="w-full bg-card border border-border rounded px-2 py-1 text-[9px]"
                                                                                                                disabled={!cond.relation_column}
                                                                                                            >
                                                                                                                <option value="exists">Exists</option>
                                                                                                                <option value="equals">=</option>
                                                                                                                <option value="not_equals">!=</option>
                                                                                                                <option value="contains">Contains</option>
                                                                                                                <option value="is_null">Is Empty</option>
                                                                                                            </select>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            <label className="block text-[7px] font-black uppercase text-muted mb-0.5">Match Value</label>
                                                                                                            <input
                                                                                                                value={cond.relation_value || ''}
                                                                                                                onChange={e => updateCondition(idx, gIdx, cIdx, { relation_value: e.target.value })}
                                                                                                                className="w-full bg-card border border-border rounded px-2 py-1 text-[9px] outline-none"
                                                                                                                placeholder="Value..."
                                                                                                                disabled={!cond.relation_column || ['exists', 'is_null'].includes(cond.relation_match_type)}
                                                                                                            />
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                            {group.conditions.length === 0 && (
                                                                                <div className="py-4 text-center border-2 border-dashed border-border/30 rounded-xl">
                                                                                    <p className="text-[9px] font-black uppercase text-muted/50">No filters in this group</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {(!series.logic_groups || series.logic_groups.length === 0) && (
                                                                    <div className="py-8 border-2 border-dashed border-border/50 rounded-3xl flex flex-col items-center justify-center opacity-40">
                                                                        <Filter size={24} className="mb-2" />
                                                                        <p className="text-[9px] font-black uppercase tracking-widest">No logic groups defined</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {(config.series || []).length === 0 && (
                                        <div className="py-12 border border-dashed border-border rounded-3xl flex flex-col items-center justify-center opacity-40">
                                            <BarChart3 size={32} className="mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">No data series defined</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-border bg-surface/30 flex justify-end gap-3 shrink-0">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-surface hover:bg-bg border border-border text-text rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:shadow-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-10 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50"
                    >
                        <Save size={14} />
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
};

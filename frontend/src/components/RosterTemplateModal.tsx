import React, { useState, useEffect } from 'react';
import { X, Save, Columns, Layout, Settings2, Plus, Trash2, GripVertical, FileCode2, Check } from 'lucide-react';
import { Reorder } from 'motion/react';
import api from '../api';
import toast from 'react-hot-toast';
import Loading from './Loading';

interface RosterTemplateModalProps {
    shortname: string;
    onClose: () => void;
}

export const RosterTemplateModal: React.FC<RosterTemplateModalProps> = ({ shortname, onClose }) => {
    const [activeTab, setActiveTab] = useState<'columns' | 'layout' | 'options'>('columns');
    const [template, setTemplate] = useState<any>({
        columns: [],
        layout_settings: { rows: [] },
        default_sections_per_row: 2,
        roster_options: {}
    });
    const [factionId, setFactionId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);

    const [datasets, setDatasets] = useState<any[]>([]);
    const [flags, setFlags] = useState<any[]>([]);
    const [recordDatabases, setRecordDatabases] = useState<any[]>([]);

    const [addingItem, setAddingItem] = useState<{ idx: number, type: 'checkbox' | 'tag' } | null>(null);
    const [newItem, setNewItem] = useState({ label: '', color: '#3b82f6', auto_apply_field: '', auto_apply_value: '' });

    const normalizeItems = (items: any[]) => {
        return (items || []).map((item, idx) => {
            if (typeof item === 'string') {
                return { id: `item_${Date.now()}_${idx}_${Math.random()}`, label: item };
            }
            if (!item.id) {
                return { ...item, id: `item_${Date.now()}_${idx}_${Math.random()}` };
            }
            return item;
        });
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [factionRes, datasetsRes, flagsRes, recordsRes] = await Promise.all([
                    api.get(`/factions/${shortname}`),
                    api.get(`/factions/${shortname}/datasets`),
                    api.get(`/factions/${shortname}/flags`),
                    api.get(`/factions/${shortname}/records`)
                ]);
                
                const faction = factionRes.data.faction;
                setFactionId(faction.id);
                if (faction.roster_template) {
                    const normalizedCols = (faction.roster_template.columns || []).map((col: any) => ({
                        ...col,
                        checkboxes: normalizeItems(col.checkboxes),
                        tags: normalizeItems(col.tags)
                    }));
                    setTemplate({
                        ...faction.roster_template,
                        columns: normalizedCols
                    });
                } else {
                    // Default starting template
                    setTemplate({
                        columns: [
                            { id: 'rank', name: 'Rank', type: 'dropdown', options: [], checkboxes: normalizeItems(['Acting']) },
                            { id: 'name', name: 'Name', type: 'text', checkboxes: normalizeItems(['LOA']) },
                            { id: 'position', name: 'Position', type: 'text', checkboxes: [] },
                            { id: 'callsign', name: 'Callsign', type: 'text', checkboxes: [] }
                        ],
                        layout_settings: { rows: [] },
                        default_sections_per_row: 2,
                        roster_options: {}
                    });
                }

                setDatasets(datasetsRes.data);
                setFlags(flagsRes.data);
                setRecordDatabases(recordsRes.data);
            } catch (err) {
                console.error('Failed to fetch template data', err);
                toast.error('Failed to load roster template');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [shortname]);

    const handleSave = async () => {
        if (!factionId) return;
        setIsSaving(true);
        const loadToast = toast.loading('Saving template...');
        try {
            await api.put(`/factions/${factionId}`, {
                roster_template: template
            });
            toast.success('Roster template saved', { id: loadToast });
            onClose();
        } catch (err) {
            toast.error('Failed to save template', { id: loadToast });
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const addColumn = () => {
        const newCols = [...template.columns, { 
            id: `col_${Date.now()}`, 
            name: 'New Column', 
            type: 'text', 
            options: [], 
            checkboxes: [] 
        }];
        setTemplate({ ...template, columns: newCols });
        setEditingColumnIndex(newCols.length - 1);
    };

    const updateColumn = (index: number, fields: any) => {
        const newCols = [...template.columns];
        newCols[index] = { ...newCols[index], ...fields };
        setTemplate({ ...template, columns: newCols });
    };

    const removeColumn = (index: number) => {
        setTemplate({ ...template, columns: template.columns.filter((_: any, i: number) => i !== index) });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
            <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-lg border border-border shadow-2xl flex flex-col overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center bg-surface/30">
                    <div>
                        <h2 className="text-xl font-bold text-text flex items-center gap-2">
                            <FileCode2 className="text-accent" size={24} />
                            Roster Template
                        </h2>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">
                            Define the default configuration for new rosters in this faction
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors">
                        <X size={20} className="text-muted" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 pt-4 gap-6 border-b border-border bg-surface/10">
                    <button 
                        onClick={() => setActiveTab('columns')}
                        className={`pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'columns' ? 'text-accent' : 'text-muted hover:text-text'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Columns size={12} /> Default Columns
                        </div>
                        {activeTab === 'columns' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
                    </button>
                    <button 
                        onClick={() => setActiveTab('layout')}
                        className={`pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'layout' ? 'text-accent' : 'text-muted hover:text-text'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Layout size={12} /> Default Layout
                        </div>
                        {activeTab === 'layout' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
                    </button>
                    <button 
                        onClick={() => setActiveTab('options')}
                        className={`pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'options' ? 'text-accent' : 'text-muted hover:text-text'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Settings2 size={12} /> Default Options
                        </div>
                        {activeTab === 'options' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-surface/5">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loading fullScreen={false} message="Fetching Template Configuration..." />
                        </div>
                    ) : (
                        <>
                            {activeTab === 'columns' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-text">Columns Configuration</h3>
                                        <button 
                                            onClick={addColumn}
                                            className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-[10px] font-bold uppercase tracking-widest transition flex items-center gap-2"
                                        >
                                            <Plus size={14} /> Add Column
                                        </button>
                                    </div>

                                    <Reorder.Group axis="y" values={template.columns} onReorder={(newCols) => setTemplate({ ...template, columns: newCols })} className="space-y-2">
                                        {template.columns.map((col: any, idx: number) => (
                                            <Reorder.Item key={col.id} value={col}>
                                                <div className={`bg-card border rounded-lg transition-all ${editingColumnIndex === idx ? 'border-accent ring-1 ring-accent/20' : 'border-border'}`}>
                                                    <div className="p-3 flex items-center gap-4">
                                                        <div className="cursor-grab active:cursor-grabbing text-muted opacity-30">
                                                            <GripVertical size={16} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-accent/50 w-4">#{idx + 1}</span>
                                                                <input 
                                                                    value={col.name}
                                                                    onChange={(e) => updateColumn(idx, { name: e.target.value })}
                                                                    className="bg-transparent border-none p-0 font-bold text-sm text-text focus:ring-0 w-full"
                                                                    placeholder="Column Name"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <select 
                                                                value={col.type}
                                                                onChange={(e) => updateColumn(idx, { type: e.target.value })}
                                                                className="bg-surface border border-border rounded px-2 py-1 text-[10px] font-bold uppercase text-muted outline-none focus:border-accent"
                                                            >
                                                                <option value="text">Text</option>
                                                                <option value="dropdown">Dropdown</option>
                                                                <option value="predefined_text">Predefined Text</option>
                                                                <option value="predefined_dropdown">Predefined Dropdown</option>
                                                                <option value="hidden_text">Hidden Text</option>
                                                                <option value="hidden_dropdown">Hidden Dropdown</option>
                                                                <option value="database_data">Database Data Column</option>
                                                                <option value="hidden_database_data">Hidden Database Data Column</option>
                                                                <option value="linked_roster_data">Linked Roster Column</option>
                                                                <option value="hidden_linked_roster_data">Hidden Linked Roster Column</option>
                                                                <option value="autofill">Auto-Fill</option>
                                                            </select>
                                                            <button 
                                                                onClick={() => setEditingColumnIndex(editingColumnIndex === idx ? null : idx)}
                                                                className={`p-1.5 rounded transition-colors ${editingColumnIndex === idx ? 'bg-accent text-white' : 'text-muted hover:bg-surface'}`}
                                                            >
                                                                <Settings2 size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={() => removeColumn(idx)}
                                                                className="p-1.5 text-muted hover:text-danger hover:bg-danger/5 rounded transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                        </div>

                                                        {editingColumnIndex === idx && (
                                                        <div className="px-10 pb-6 space-y-6 animate-in slide-in-from-top-2 duration-200 border-t border-border mt-1 pt-4">
                                                            <div className="grid grid-cols-2 gap-6">
                                                                <div className="space-y-4">
                                                                    <div>
                                                                        <label className="block text-[8px] font-black uppercase tracking-widest text-accent mb-1.5">Column ID (System)</label>
                                                                        <input 
                                                                            value={col.id}
                                                                            onChange={(e) => updateColumn(idx, { id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                                                            className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text outline-none focus:border-accent font-mono"
                                                                        />
                                                                    </div>

                                                                    {col.type === 'autofill' && (
                                                                        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-2">
                                                                            <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Auto-Fill Value</label>
                                                                            <input 
                                                                              value={col.autofill_value || ''} 
                                                                              onChange={(e) => updateColumn(idx, { autofill_value: e.target.value })}
                                                                              className="w-full bg-surface border border-border px-3 py-2 rounded text-xs text-text focus:border-accent outline-none" 
                                                                              placeholder="Enter static value for every row..."
                                                                            />
                                                                            <p className="text-[9px] text-muted font-medium italic opacity-60">
                                                                                This value will be automatically filled for every row in the roster and cannot be modified by users.
                                                                            </p>
                                                                        </div>
                                                                    )}

                                                                    {(col.type.includes('dropdown') || col.type.includes('text')) && !col.type?.includes('database_data') && (
                                                                        <div>
                                                                            <label className="block text-[8px] font-black uppercase tracking-widest text-accent mb-1.5">Data Source</label>
                                                                            <div className="flex gap-2">
                                                                                <button 
                                                                                    onClick={() => updateColumn(idx, { use_dataset: false })}
                                                                                    className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase border transition-all ${!col.use_dataset ? 'bg-accent border-accent text-white' : 'bg-surface border-border text-muted'}`}
                                                                                >Manual</button>
                                                                                <button 
                                                                                    onClick={() => updateColumn(idx, { use_dataset: true })}
                                                                                    className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase border transition-all ${col.use_dataset ? 'bg-accent border-accent text-white' : 'bg-surface border-border text-muted'}`}
                                                                                >Dataset</button>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {col.use_dataset && (
                                                                        <div className="space-y-4 p-3 bg-surface/50 border border-border rounded-lg">
                                                                            <div>
                                                                                <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1">Target Dataset</label>
                                                                                <select 
                                                                                    value={col.dataset_id || ''}
                                                                                    onChange={(e) => updateColumn(idx, { dataset_id: parseInt(e.target.value) })}
                                                                                    className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text outline-none focus:border-accent"
                                                                                >
                                                                                    <option value="">Select Dataset</option>
                                                                                    {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                                                </select>
                                                                            </div>
                                                                            {col.dataset_id && datasets.find(d => d.id === col.dataset_id)?.record_database_id && (
                                                                                <div>
                                                                                    <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1">Database Field (For Dynamic Dataset)</label>
                                                                                    <select 
                                                                                        value={col.database_field_id || ''}
                                                                                        onChange={(e) => updateColumn(idx, { database_field_id: e.target.value })}
                                                                                        className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text outline-none focus:border-accent"
                                                                                    >
                                                                                        <option value="">Default Field</option>
                                                                                        <option value="id">Entry ID</option>
                                                                                        <option value="created_at">Date Created</option>
                                                                                        {recordDatabases.find(db => db.id === datasets.find(d => d.id === col.dataset_id)?.record_database_id)?.database_structure?.map((f: any) => (
                                                                                            <option key={f.id} value={f.id}>{f.name}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {col.type?.includes('database_data') && (
                                                                        <div className="space-y-4 p-3 bg-accent/5 border border-accent/20 rounded-lg">
                                                                            <div>
                                                                                <label className="block text-[8px] font-black uppercase tracking-widest text-accent mb-1">Source Column</label>
                                                                                <select 
                                                                                    value={col.source_column_id || ''}
                                                                                    onChange={(e) => updateColumn(idx, { source_column_id: e.target.value })}
                                                                                    className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text outline-none focus:border-accent"
                                                                                >
                                                                                    <option value="">Select Source...</option>
                                                                                    {template.columns.filter((c: any, i: number) => i !== idx && c.use_dataset).map((c: any) => (
                                                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-[8px] font-black uppercase tracking-widest text-accent mb-1">Data Field to Display</label>
                                                                                <select 
                                                                                    value={col.data_field_id || ''}
                                                                                    onChange={(e) => updateColumn(idx, { data_field_id: e.target.value })}
                                                                                    className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text outline-none focus:border-accent"
                                                                                >
                                                                                    <option value="">Select Field...</option>
                                                                                    <option value="id">Entry ID</option>
                                                                                    <option value="created_at">Date Created</option>
                                                                                    {col.source_column_id && (() => {
                                                                                        const src = template.columns.find((c: any) => c.id === col.source_column_id);
                                                                                        const ds = datasets.find(d => d.id === src?.dataset_id);
                                                                                        const db = recordDatabases.find(r => r.id === ds?.record_database_id);
                                                                                        return db?.database_structure?.map((f: any) => (
                                                                                            <option key={f.id} value={f.id}>{f.name}</option>
                                                                                        ));
                                                                                    })()}
                                                                                </select>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="space-y-6">
                                                                    <div>
                                                                        <label className="block text-[8px] font-black uppercase tracking-widest text-accent mb-2">Column Flags (Dynamic Icons)</label>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {flags.map(f => (
                                                                                <button 
                                                                                    key={f.id}
                                                                                    onClick={() => {
                                                                                        const current = col.flags || [];
                                                                                        const next = current.includes(f.id) ? current.filter((id: number) => id !== f.id) : [...current, f.id];
                                                                                        updateColumn(idx, { flags: next });
                                                                                    }}
                                                                                    className={`px-2 py-1.5 border rounded flex items-center gap-1.5 transition-all ${col.flags?.includes(f.id) ? 'bg-accent/10 border-accent text-accent' : 'bg-surface border-border text-muted hover:border-accent/30'}`}
                                                                                >
                                                                                    <div style={{ color: f.color }}>
                                                                                        <Settings2 size={10} />
                                                                                    </div>
                                                                                    <span className="text-[8px] font-bold uppercase">{f.name}</span>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {col.type !== 'autofill' && (
                                                                        <div className="space-y-6">
                                                                            <div>
                                                                                <label className="block text-[8px] font-black uppercase tracking-widest text-accent mb-2">Checkboxes (Tags)</label>
                                                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                                                    {col.checkboxes?.map((cb: any, cidx: number) => {
                                                                                        const label = typeof cb === 'string' ? cb : cb?.label;
                                                                                        const color = typeof cb === 'string' ? null : cb.color;
                                                                                        const autoField = typeof cb === 'string' ? null : cb.auto_apply_field;

                                                                                        return (
                                                                                            <div key={cidx} className="group/item relative flex items-center bg-surface border border-border rounded pl-2 pr-0.5 py-0.5 gap-1 transition-all hover:border-accent/30">
                                                                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color || '#3b82f6' }} />
                                                                                                <span className="text-[8px] font-bold uppercase">{label}</span>
                                                                                                {autoField && <div className="text-[6px] font-black text-accent bg-accent/10 px-1 rounded">AUTO</div>}
                                                                                                <button onClick={() => updateColumn(idx, { checkboxes: col.checkboxes.filter((_: any, i: number) => i !== cidx) })} className="p-1 hover:text-danger opacity-0 group-hover/item:opacity-100 transition-all"><X size={10} /></button>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                    <button 
                                                                                        onClick={() => {
                                                                                            setAddingItem({ idx, type: 'checkbox' });
                                                                                            setNewItem({ label: '', color: '#3b82f6', auto_apply_field: '' });
                                                                                        }} 
                                                                                        className="px-2 py-1 border border-dashed border-border rounded text-[8px] font-bold uppercase text-muted hover:border-accent transition-all"
                                                                                    >+ Add</button>
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-[8px] font-black uppercase tracking-widest text-accent mb-2">Right-Side Tags</label>
                                                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                                                    {col.tags?.map((tag: any, tidx: number) => {
                                                                                        const label = typeof tag === 'string' ? tag : tag?.label;
                                                                                        const color = typeof tag === 'string' ? null : tag.color;
                                                                                        const autoField = typeof tag === 'string' ? null : tag.auto_apply_field;

                                                                                        return (
                                                                                            <div key={tidx} className="group/item relative flex items-center bg-accent/5 border border-accent/20 rounded pl-2 pr-0.5 py-0.5 gap-1 transition-all hover:border-accent/50">
                                                                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color || '#3b82f6' }} />
                                                                                                <span className="text-[8px] font-bold uppercase text-accent">{label}</span>
                                                                                                {autoField && <div className="text-[6px] font-black text-white bg-accent px-1 rounded">AUTO</div>}
                                                                                                <button onClick={() => updateColumn(idx, { tags: col.tags.filter((_: any, i: number) => i !== tidx) })} className="p-1 hover:text-danger text-accent opacity-0 group-hover/item:opacity-100 transition-all"><X size={10} /></button>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                    <button 
                                                                                        onClick={() => {
                                                                                            setAddingItem({ idx, type: 'tag' });
                                                                                            setNewItem({ label: '', color: '#3b82f6', auto_apply_field: '' });
                                                                                        }} 
                                                                                        className="px-2 py-1 border border-dashed border-accent/30 rounded text-[8px] font-bold uppercase text-accent/50 hover:border-accent transition-all"
                                                                                    >+ Add</button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                {addingItem?.idx === idx && (
                                                                    <div className="col-span-2 p-4 bg-surface/80 border border-accent/30 rounded-lg animate-in fade-in zoom-in-95 duration-200">
                                                                        <div className="flex items-center justify-between mb-4">
                                                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
                                                                                Add New {addingItem.type === 'checkbox' ? 'Checkbox' : 'Tag'}
                                                                            </h4>
                                                                            <button onClick={() => setAddingItem(null)} className="text-muted hover:text-text"><X size={14} /></button>
                                                                        </div>
                                                                        <div className="grid grid-cols-4 gap-4">
                                                                            <div className="col-span-1">
                                                                                <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Label</label>
                                                                                <input 
                                                                                    value={newItem.label}
                                                                                    onChange={e => setNewItem({ ...newItem, label: e.target.value })}
                                                                                    className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text outline-none focus:border-accent"
                                                                                    placeholder="e.g. LOA"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Color</label>
                                                                                <div className="flex gap-2">
                                                                                    <input 
                                                                                        type="color"
                                                                                        value={newItem.color}
                                                                                        onChange={e => setNewItem({ ...newItem, color: e.target.value })}
                                                                                        className="h-9 w-12 bg-surface border border-border rounded p-1 cursor-pointer"
                                                                                    />
                                                                                    <input 
                                                                                        value={newItem.color}
                                                                                        onChange={e => setNewItem({ ...newItem, color: e.target.value })}
                                                                                        className="flex-1 bg-surface border border-border rounded px-3 py-2 text-xs text-text outline-none focus:border-accent font-mono uppercase"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Auto-Apply (DB Field)</label>
                                                                                <select 
                                                                                    value={newItem.auto_apply_field}
                                                                                    onChange={e => setNewItem({ ...newItem, auto_apply_field: e.target.value })}
                                                                                    disabled={!col.use_dataset && col.type !== 'database_data'}
                                                                                    className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text outline-none focus:border-accent disabled:opacity-20 transition-opacity"
                                                                                >
                                                                                    <option value="">No Auto-Apply</option>
                                                                                    {(() => {
                                                                                        const dsId = col.use_dataset ? col.dataset_id : (template.columns.find((c: any) => c.id === col.source_column_id)?.dataset_id);
                                                                                        const ds = datasets.find(d => d.id === dsId);
                                                                                        const db = recordDatabases.find(r => r.id === ds?.record_database_id);
                                                                                        return db?.database_structure?.map((f: any) => (
                                                                                            <option key={f.id} value={f.id}>{f.name}</option>
                                                                                        ));
                                                                                    })()}
                                                                                </select>
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1.5">Match Value (Optional)</label>
                                                                                <input 
                                                                                    value={newItem.auto_apply_value}
                                                                                    onChange={e => setNewItem({ ...newItem, auto_apply_value: e.target.value })}
                                                                                    disabled={!newItem.auto_apply_field}
                                                                                    className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text outline-none focus:border-accent disabled:opacity-20 transition-opacity"
                                                                                    placeholder="Leave empty for 'exists'"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="mt-4 flex justify-end">
                                                                            <button 
                                                                                onClick={() => {
                                                                                    if (!newItem.label) return;
                                                                                    const listName = addingItem.type === 'checkbox' ? 'checkboxes' : 'tags';
                                                                                    const itemWithId = { ...newItem, id: `item_${Date.now()}_${Math.random()}` };
                                                                                    updateColumn(idx, { [listName]: [...(col[listName] || []), itemWithId] });
                                                                                    setAddingItem(null);
                                                                                }}
                                                                                className="px-6 py-1.5 bg-accent hover:bg-accent/90 text-white rounded text-[10px] font-bold uppercase tracking-widest transition shadow-lg shadow-accent/20"
                                                                            >Add {addingItem.type}</button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        )}
                                                        </div>
                                                        </Reorder.Item>
                                                        ))}
                                                        </Reorder.Group>
                                                        </div>
                                                        )}
                            {activeTab === 'layout' && (
                                <div className="space-y-8 max-w-2xl mx-auto">
                                    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-4">Grid Settings</label>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <span className="text-xs font-bold text-text">Default Sections Per Row</span>
                                                    <p className="text-[10px] text-muted leading-tight">New rosters will start with this number of sections horizontally.</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {[1, 2, 3, 4].map(num => (
                                                        <button 
                                                            key={num}
                                                            onClick={() => setTemplate({ ...template, default_sections_per_row: num })}
                                                            className={`flex-1 py-3 rounded-lg border font-black transition-all ${template.default_sections_per_row === num ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-surface border-border text-muted hover:border-accent/50'}`}
                                                        >
                                                            {num}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-border/50">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-4">Initial Layout Rows</label>
                                            <p className="text-xs text-muted mb-4">You can pre-define specific rows that every new roster should have (e.g., a "Master" row). Currently, new rosters start empty of sections, but you can define the grid behavior here.</p>
                                            
                                            <div className="p-8 border border-dashed border-border rounded-lg bg-surface/30 flex flex-col items-center justify-center text-center">
                                                <Layout size={32} className="text-muted opacity-20 mb-3" />
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Section row templates coming soon</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'options' && (
                                <div className="space-y-6 max-w-2xl mx-auto">
                                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                                        <div className="p-4 bg-surface/50 border-b border-border">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Default Roster Options</h3>
                                        </div>
                                        <div className="p-12 text-center space-y-3">
                                            <Settings2 size={32} className="mx-auto text-muted opacity-20" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Default roster options coming soon</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-surface/30 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-surface hover:bg-bg border border-border text-text rounded font-bold text-xs uppercase tracking-[0.2em] transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-8 py-2 bg-accent hover:bg-accent/90 text-white rounded font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50"
                    >
                        <Save size={14} />
                        {isSaving ? 'Saving...' : 'Save Template'}
                    </button>
                </div>
            </div>
        </div>
    );
};

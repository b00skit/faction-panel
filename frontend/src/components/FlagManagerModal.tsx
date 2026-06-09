import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Flag, GripVertical, Info, Search, Check, AlertCircle, ShieldAlert, RefreshCw } from 'lucide-react';
import * as LucideIcons from '../icons';
import { ALL_ICONS } from '../icons';
import api from '../api';
import toast from 'react-hot-toast';

interface FlagRule {
    type: 'equals' | 'not_equals' | 'contains' | 'in_dataset' | 'not_in_dataset' | 'exists_elsewhere' | 'orphaned_database_link';
    value?: string;
    dataset_id?: number;
    scope?: 'section' | 'roster' | 'global';
    target_col?: string;
    flag_regardless_of_manual_addition?: boolean;
}

interface RosterFlag {
    id?: number;
    name: string;
    icon: string;
    color: string;
    rules: FlagRule[];
    excluded_roster_ids?: number[];
}

interface FlagManagerModalProps {
    shortname: string;
    onClose: () => void;
}

const ICON_LIST = ALL_ICONS;

const FlagManagerModal: React.FC<FlagManagerModalProps> = ({ shortname, onClose }) => {
    const [flags, setFlags] = useState<RosterFlag[]>([]);
    const [datasets, setDatasets] = useState<any[]>([]);
    const [rosters, setRosters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFlag, setSelectedFlag] = useState<RosterFlag | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newFlagName, setNewFlagName] = useState('');
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [isRecalculatingAll, setIsRecalculatingAll] = useState(false);

    const fetchData = async () => {
        try {
            const [flagsRes, datasetsRes, factionRes] = await Promise.all([
                api.get(`/factions/${shortname}/flags`),
                api.get(`/factions/${shortname}/datasets`),
                api.get(`/factions/${shortname}`)
            ]);
            setFlags(flagsRes.data);
            setDatasets(datasetsRes.data);
            setRosters(factionRes.data.rosters || []);
            if (selectedFlag) {
                const updated = flagsRes.data.find((f: any) => f.id === selectedFlag.id);
                if (updated) setSelectedFlag(updated);
            }
        } catch (err) {
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [shortname]);

    const handleCreateFlag = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFlagName.trim()) return;

        try {
            const res = await api.post(`/factions/${shortname}/flags`, { 
                name: newFlagName,
                icon: 'Flag',
                color: '#3b82f6',
                rules: []
            });
            setFlags([...flags, res.data]);
            setSelectedFlag(res.data);
            setNewFlagName('');
            setIsCreating(false);
            toast.success('Flag created');
        } catch (err) {
            toast.error('Failed to create flag');
        }
    };

    const handleSaveFlag = async () => {
        if (!selectedFlag || !selectedFlag.id) return;
        setIsSaving(true);
        const loadToast = toast.loading('Saving flag...');
        try {
            await api.put(`/flags/${selectedFlag.id}`, selectedFlag);
            toast.success('Flag saved', { id: loadToast });
            fetchData();
        } catch (err) {
            toast.error('Failed to save flag', { id: loadToast });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRecalculate = async () => {
        if (!selectedFlag || !selectedFlag.id) return;
        setIsRecalculating(true);
        const loadToast = toast.loading('Recalculating flag...');
        try {
            const res = await api.post(`/flags/${selectedFlag.id}/recalculate`);
            toast.success(`Recalculated — ${res.data.modified ?? 0} row(s) updated`, { id: loadToast });
        } catch (err) {
            toast.error('Failed to recalculate flag', { id: loadToast });
        } finally {
            setIsRecalculating(false);
        }
    };

    const handleRecalculateAll = async () => {
        if (flags.length === 0) return;
        setIsRecalculatingAll(true);
        const loadToast = toast.loading('Recalculating all flags...');
        let totalModified = 0;
        try {
            for (const flag of flags) {
                if (!flag.id) continue;
                try {
                    const res = await api.post(`/flags/${flag.id}/recalculate`);
                    totalModified += (res.data.modified ?? 0);
                } catch (e) {
                    console.error(`Failed to recalculate flag ${flag.name}`, e);
                }
            }
            toast.success(`All flags recalculated — ${totalModified} row(s) updated`, { id: loadToast });
        } catch (err) {
            toast.error('Failed to complete recalculation', { id: loadToast });
        } finally {
            setIsRecalculatingAll(false);
        }
    };

    const handleDeleteFlag = async (id: number) => {
        const flag = flags.find(f => f.id === id);
        if (!flag) return;

        toast((t) => (
            <div className="flex flex-col gap-1 text-left">
                <p className="font-bold">Delete flag "{flag.name}"?</p>
                <p className="text-[10px] opacity-80 uppercase tracking-tighter">This will remove the flag from all columns where it is currently enabled.</p>
                <div className="flex gap-2 justify-end mt-2">
                    <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1 bg-surface hover:bg-bg border border-border rounded text-[9px] font-bold uppercase transition">Cancel</button>
                    <button 
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const loadToast = toast.loading('Deleting flag...');
                            try {
                                await api.delete(`/flags/${id}`);
                                setFlags(flags.filter(f => f.id !== id));
                                if (selectedFlag?.id === id) setSelectedFlag(null);
                                toast.success('Flag deleted', { id: loadToast });
                            } catch (err) {
                                toast.error('Failed to delete flag', { id: loadToast });
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

    const addRule = () => {
        if (!selectedFlag) return;
        const newRule: FlagRule = { type: 'equals', value: '' };
        setSelectedFlag({
            ...selectedFlag,
            rules: [...(selectedFlag.rules || []), newRule]
        });
    };

    const updateRule = (index: number, field: keyof FlagRule, value: any) => {
        if (!selectedFlag) return;
        const newRules = [...selectedFlag.rules];
        newRules[index] = { ...newRules[index], [field]: value };
        setSelectedFlag({ ...selectedFlag, rules: newRules });
    };

    const removeRule = (index: number) => {
        if (!selectedFlag) return;
        const newRules = selectedFlag.rules.filter((_, i) => i !== index);
        setSelectedFlag({ ...selectedFlag, rules: newRules });
    };

    const renderIcon = (iconName: string, size = 16, color?: string) => {
        const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
        return <IconComponent size={size} style={{ color }} />;
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[700]">
            <div className="bg-card rounded-2xl max-w-5xl w-full border border-border shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border flex justify-between items-center bg-surface/30">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <Flag className="text-accent" />
                            Flag Manager
                        </h2>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Define conditional formatting rules for personnel entries</p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-text transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Left Panel: List of Flags */}
                    <div className="w-1/4 border-r border-border flex flex-col bg-surface/10">
                        <div className="p-4 flex justify-between items-center border-b border-border bg-surface/30">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Active Flags</span>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={handleRecalculateAll} 
                                    disabled={isRecalculatingAll}
                                    title="Recalculate all flags for this faction"
                                    className="p-1.5 hover:bg-accent hover:text-white rounded transition-all text-muted disabled:opacity-50"
                                >
                                    <RefreshCw size={14} className={isRecalculatingAll ? 'animate-spin' : ''} />
                                </button>
                                <button onClick={() => setIsCreating(true)} className="p-1.5 hover:bg-accent hover:text-white rounded transition-all text-muted">
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {isCreating && (
                                <form onSubmit={handleCreateFlag} className="p-2 bg-accent/5 border border-accent/20 rounded-xl mb-2">
                                    <input 
                                        autoFocus
                                        value={newFlagName}
                                        onChange={e => setNewFlagName(e.target.value)}
                                        placeholder="Flag name..."
                                        className="w-full bg-surface border border-border p-2 rounded text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent"
                                    />
                                    <div className="flex gap-1 mt-2">
                                        <button type="submit" className="flex-1 bg-accent text-white text-[8px] font-bold uppercase py-1 rounded">Create</button>
                                        <button type="button" onClick={() => setIsCreating(false)} className="flex-1 bg-surface text-muted text-[8px] font-bold uppercase py-1 rounded">Cancel</button>
                                    </div>
                                </form>
                            )}
                            {flags.map(f => (
                                <div 
                                    key={f.id}
                                    onClick={() => setSelectedFlag(f)}
                                    className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${selectedFlag?.id === f.id ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-muted hover:border-accent/30'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        {renderIcon(f.icon, 14, f.color)}
                                        <span className="font-bold text-xs uppercase tracking-tight">{f.name}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteFlag(f.id!); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-danger transition-opacity"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                            {flags.length === 0 && !loading && (
                                <div className="py-10 text-center text-[10px] text-muted uppercase tracking-widest font-bold opacity-40">No flags defined</div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Flag Editor */}
                    <div className="flex-1 flex flex-col">
                        {selectedFlag ? (
                            <>
                                <div className="p-4 border-b border-border bg-surface/30 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col gap-1">
                                            <input 
                                                value={selectedFlag.name}
                                                onChange={e => setSelectedFlag({ ...selectedFlag, name: e.target.value })}
                                                className="bg-transparent border-none font-black uppercase tracking-tight text-lg outline-none focus:text-accent p-0"
                                            />
                                            <div className="flex items-center gap-2">
                                                <div className="relative group/icon">
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-surface border border-border rounded text-[9px] font-black uppercase cursor-pointer">
                                                        {renderIcon(selectedFlag.icon, 10, selectedFlag.color)}
                                                        <span>Icon</span>
                                                    </div>
                                                    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-2xl p-2 z-[800] grid grid-cols-6 gap-1 opacity-0 pointer-events-none group-hover/icon:opacity-100 group-hover/icon:pointer-events-auto transition-all w-64 max-h-64 overflow-y-auto">
                                                        {ICON_LIST.map(icon => (
                                                            <button 
                                                                key={icon}
                                                                onClick={() => setSelectedFlag({ ...selectedFlag, icon })}
                                                                className={`p-2 rounded hover:bg-accent/10 flex items-center justify-center ${selectedFlag.icon === icon ? 'bg-accent/20 text-accent' : 'text-muted'}`}
                                                            >
                                                                {renderIcon(icon, 14)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-surface border border-border rounded">
                                                    <input 
                                                        type="color" 
                                                        value={selectedFlag.color} 
                                                        onChange={e => setSelectedFlag({ ...selectedFlag, color: e.target.value })}
                                                        className="w-4 h-4 bg-transparent border-none cursor-pointer p-0"
                                                    />
                                                    <span className="text-[9px] font-black uppercase">{selectedFlag.color}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={addRule}
                                            className="px-3 py-1.5 bg-surface hover:bg-bg border border-border text-[10px] font-black uppercase tracking-widest rounded-lg transition"
                                        >
                                            Add Rule
                                        </button>
                                        <button 
                                            onClick={handleRecalculate}
                                            disabled={isRecalculating}
                                            title="Recalculate this flag across all roster rows"
                                            className="px-3 py-1.5 bg-surface hover:bg-bg border border-border text-[10px] font-black uppercase tracking-widest rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <RefreshCw size={12} className={isRecalculating ? 'animate-spin' : ''} />
                                            {isRecalculating ? 'Recalculating...' : 'Recalculate'}
                                        </button>
                                        <button 
                                            onClick={handleSaveFlag}
                                            disabled={isSaving}
                                            className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Save size={12} /> {isSaving ? 'Saving...' : 'Save Flag'}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    <div className="flex items-center gap-2 p-3 bg-accent/5 border border-accent/10 rounded-xl text-accent">
                                        <Info size={14} />
                                        <p className="text-[9px] font-bold uppercase tracking-widest">
                                            The flag will appear if <span className="underline decoration-2 underline-offset-2">ANY</span> of the following rules are met.
                                        </p>
                                    </div>

                                    {/* Exclude Rosters Section */}
                                    {selectedFlag.rules?.some(r => r.type === 'exists_elsewhere') && (
                                        <div className="p-4 bg-surface border border-border rounded-2xl space-y-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <ShieldAlert size={14} className="text-muted" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-text">Exclude Rosters</span>
                                            </div>
                                            <p className="text-[9px] text-muted font-bold uppercase tracking-tight leading-none italic mb-2">
                                                Selected rosters will be ignored during "Exists Elsewhere" checks.
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {rosters.map(r => {
                                                    const isExcluded = (selectedFlag.excluded_roster_ids || []).includes(r.id);
                                                    return (
                                                        <button 
                                                            key={r.id}
                                                            onClick={() => {
                                                                const current = selectedFlag.excluded_roster_ids || [];
                                                                const next = isExcluded 
                                                                    ? current.filter(id => id !== r.id)
                                                                    : [...current, r.id];
                                                                setSelectedFlag({ ...selectedFlag, excluded_roster_ids: next });
                                                            }}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[9px] font-bold uppercase transition-all ${isExcluded ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-card border-border text-muted hover:border-accent/30'}`}
                                                        >
                                                            <div className={`w-1.5 h-1.5 rounded-full ${isExcluded ? 'bg-danger' : 'bg-muted opacity-30'}`} style={!isExcluded ? { backgroundColor: r.color } : {}} />
                                                            <span className="truncate">{r.name}</span>
                                                            {isExcluded && <X size={10} className="ml-auto" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {selectedFlag.rules?.map((rule, idx) => (
                                        <div key={idx} className="flex flex-col gap-3 p-4 bg-surface border border-border rounded-2xl group animate-in fade-in slide-in-from-top-1">
                                            <div className="flex items-center justify-between border-b border-border pb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-black text-accent">{idx + 1}</div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">Rule Logic</span>
                                                </div>
                                                <button onClick={() => removeRule(idx)} className="text-muted hover:text-danger p-1 rounded hover:bg-danger/10 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            
                                            <div className="grid grid-cols-12 gap-3 items-end">
                                                <div className="col-span-4">
                                                    <label className="block text-[8px] font-black uppercase text-muted/50 mb-1 tracking-widest">Condition</label>
                                                    <select 
                                                        value={rule.type}
                                                        onChange={e => updateRule(idx, 'type', e.target.value)}
                                                        className="w-full bg-card border border-border p-2 rounded-lg text-[10px] font-bold uppercase outline-none focus:border-accent"
                                                    >
                                                        <option value="equals">Equals</option>
                                                        <option value="not_equals">Does Not Equal</option>
                                                        <option value="contains">Contains</option>
                                                        <option value="in_dataset">In Dataset</option>
                                                        <option value="not_in_dataset">Not In Dataset</option>
                                                        <option value="exists_elsewhere">Exists Elsewhere</option>
                                                        <option value="orphaned_database_link">Orphaned Database Link</option>
                                                    </select>
                                                </div>

                                                <div className="col-span-8">
                                                    {rule.type === 'in_dataset' || rule.type === 'not_in_dataset' ? (
                                                        <>
                                                            <label className="block text-[8px] font-black uppercase text-muted/50 mb-1 tracking-widest">Target Dataset</label>
                                                            <select 
                                                                value={rule.dataset_id}
                                                                onChange={e => updateRule(idx, 'dataset_id', parseInt(e.target.value))}
                                                                className="w-full bg-card border border-border p-2 rounded-lg text-[10px] font-bold uppercase outline-none focus:border-accent"
                                                            >
                                                                <option value="">- Select Dataset -</option>
                                                                {datasets.map(d => (
                                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                                ))}
                                                            </select>
                                                        </>
                                                    ) : rule.type === 'exists_elsewhere' ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[8px] font-black uppercase text-muted/50 mb-1 tracking-widest">Scope</label>
                                                                <select 
                                                                    value={rule.scope}
                                                                    onChange={e => updateRule(idx, 'scope', e.target.value)}
                                                                    className="w-full bg-card border border-border p-2 rounded-lg text-[10px] font-bold uppercase outline-none focus:border-accent"
                                                                >
                                                                    <option value="section">This Section</option>
                                                                    <option value="roster">This Roster</option>
                                                                    <option value="global">All Rosters</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[8px] font-black uppercase text-muted/50 mb-1 tracking-widest">Column ID (Optional)</label>
                                                                <input 
                                                                    value={rule.target_col}
                                                                    onChange={e => updateRule(idx, 'target_col', e.target.value)}
                                                                    placeholder="e.g. name"
                                                                    className="w-full bg-card border border-border p-2 rounded-lg text-[10px] font-bold outline-none focus:border-accent"
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : rule.type === 'orphaned_database_link' ? (
                                                        <div className="flex items-center gap-3 h-full pt-1">
                                                            <button 
                                                                onClick={() => updateRule(idx, 'flag_regardless_of_manual_addition', !rule.flag_regardless_of_manual_addition)}
                                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[9px] font-black uppercase transition-all ${rule.flag_regardless_of_manual_addition ? 'bg-accent/10 border-accent text-accent' : 'bg-card border-border text-muted hover:border-accent/30'}`}
                                                            >
                                                                {rule.flag_regardless_of_manual_addition ? <Check size={12} /> : <div className="w-3 h-3" />}
                                                                Flag Regardless of Manual Addition
                                                            </button>
                                                            <div className="flex items-center gap-1.5 text-muted group/hint cursor-help relative">
                                                                <Info size={12} />
                                                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-black/90 text-[8px] font-bold text-white rounded-lg opacity-0 group-hover/hint:opacity-100 pointer-events-none transition-all z-10 leading-relaxed uppercase">
                                                                    If enabled, any value that is not a valid link to a database record will be flagged (including plain text).
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <label className="block text-[8px] font-black uppercase text-muted/50 mb-1 tracking-widest">Comparison Value</label>
                                                            <input 
                                                                value={rule.value}
                                                                onChange={e => updateRule(idx, 'value', e.target.value)}
                                                                placeholder="Value to match..."
                                                                className="w-full bg-card border border-border p-2 rounded-lg text-[10px] font-bold outline-none focus:border-accent"
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {(!selectedFlag.rules || selectedFlag.rules.length === 0) && (
                                        <div className="py-20 flex flex-col items-center justify-center border border-dashed border-border rounded-2xl bg-surface/30">
                                            <AlertCircle size={32} className="text-muted opacity-20 mb-4" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted opacity-40">No rules added to this flag</p>
                                            <button 
                                                onClick={addRule}
                                                className="mt-4 text-[9px] font-black uppercase tracking-widest text-accent hover:underline"
                                            >
                                                Add your first rule
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted uppercase text-[10px] tracking-widest opacity-40 space-y-4">
                                <Flag size={48} />
                                <span>Select or create a flag to manage its rules</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlagManagerModal;

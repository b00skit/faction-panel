import React, { useState } from 'react';
import { X, Plus, Trash2, Save, BarChart3, Settings2, Play, BookOpen, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { StatisticsWidget, Roster, FactionRecordDatabase } from '../types';
import { useParams } from 'react-router-dom';

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
    recordData,
    onClose, 
    onSave 
}) => {
    const { shortname } = useParams<{ shortname: string }>();
    const [name, setName] = useState(widget?.name || '');
    const [type, setType] = useState<'pie' | 'bar' | 'line' | 'table' | 'stat' | 'radar'>(widget?.type || 'pie');
    const [width, setWidth] = useState(widget?.width || 6);
    const [config, setConfig] = useState<any>(widget?.configuration || {
        mode: 'series',
        series: [],
        formula: '',
        group_by_column: ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [testResults, setTestResults] = useState<Record<string, any>>({});
    const [testingFormula, setTestingFormula] = useState<string | null>(null);

    const testFormula = async (formulaKey: string, formulaStr: string) => {
        if (!formulaStr) {
            toast.error('Please enter a formula to test');
            return;
        }
        setTestingFormula(formulaKey);
        try {
            const res = await api.post(`/factions/${shortname}/formulas/evaluate`, { formula: formulaStr });
            if (res.data.success) {
                setTestResults(prev => ({
                    ...prev,
                    [formulaKey]: {
                        success: true,
                        value: res.data.result
                    }
                }));
                toast.success('Formula evaluated successfully!');
            } else {
                setTestResults(prev => ({
                    ...prev,
                    [formulaKey]: {
                        success: false,
                        error: res.data.message
                    }
                }));
            }
        } catch (err: any) {
            const errMsg = err.response?.data?.message || err.message || 'Unknown error';
            setTestResults(prev => ({
                ...prev,
                [formulaKey]: {
                    success: false,
                    error: errMsg
                }
            }));
            toast.error(`Evaluation failed: ${errMsg}`);
        } finally {
            setTestingFormula(null);
        }
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
            formula: ''
        };
        setConfig({ ...config, series: [...(config.series || []), newSeries] });
    };

    const updateSeries = (idx: number, fields: any) => {
        const newSeries = [...(config.series || [])];
        newSeries[idx] = { ...newSeries[idx], ...fields };
        setConfig({ ...config, series: newSeries });
    };

    const removeSeries = (idx: number) => {
        const newSeries = config.series.filter((_: any, i: number) => i !== idx);
        setConfig({ ...config, series: newSeries });
    };

    const formatTestResult = (res: any) => {
        if (!res) return null;
        if (!res.success) {
            return (
                <div className="mt-2 text-[10px] text-red-400 font-mono bg-red-950/30 border border-red-900/50 rounded-lg p-2.5 flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>Error: {res.error}</span>
                </div>
            );
        }

        let valStr = '';
        if (typeof res.value === 'object' && res.value !== null) {
            if (Array.isArray(res.value)) {
                valStr = `Array [${res.value.length} items]`;
            } else if (res.value.class) {
                valStr = `${res.value.class} Model`;
            } else {
                valStr = JSON.stringify(res.value);
            }
        } else {
            valStr = String(res.value);
        }

        return (
            <div className="mt-2 text-[10px] text-green-400 font-mono bg-green-950/30 border border-green-900/50 rounded-lg p-2.5 flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>Result: <strong className="text-white">{valStr}</strong></span>
            </div>
        );
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied code example');
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[700]">
            <div className="bg-card w-full max-w-6xl h-[90vh] rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-border bg-surface/30 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-2">
                            <BarChart3 className="text-accent" size={24} />
                            {widget ? 'Configure' : 'Add'} Widget
                        </h2>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">
                            Configure formula-based data visualization
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors">
                        <X size={20} className="text-muted" />
                    </button>
                </div>

                {/* Content split screen */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* Left: Configuration Form */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-surface/5">
                        <div className="grid grid-cols-12 gap-8">
                            <div className="col-span-4">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5">Widget Name</label>
                                <input 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text font-bold focus:border-accent outline-none transition"
                                    placeholder="Widget title"
                                />
                            </div>
                            <div className="col-span-5">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5">Chart Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'pie', label: 'Pie Chart' },
                                        { id: 'bar', label: 'Bar Chart' },
                                        { id: 'stat', label: 'Single Stat' },
                                    ].map(t => (
                                        <button 
                                            type="button"
                                            key={t.id}
                                            onClick={() => setType(t.id as any)}
                                            className={`flex flex-col items-center justify-center py-2.5 rounded-xl border-2 transition-all gap-1 ${type === t.id ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-surface text-muted hover:border-accent/30'}`}
                                        >
                                            <span className="text-[10px] font-black uppercase">{t.label}</span>
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
                                            className={`py-2.5 rounded-xl border-2 font-black text-xs transition-all ${width === w ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-surface text-muted hover:border-accent/30'}`}
                                        >
                                            {w === 4 ? '1/3' : w === 6 ? '1/2' : 'Full'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Mode Selector */}
                        <div className="border-t border-border pt-6 space-y-6">
                            <div className="flex bg-surface/50 p-1 rounded-xl border border-border w-fit">
                                <button 
                                    type="button"
                                    onClick={() => setConfig({ ...config, mode: 'series' })}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${config.mode === 'series' ? 'bg-card text-accent shadow-sm' : 'text-muted hover:text-text'}`}
                                >
                                    Manual Series Formulas
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setConfig({ ...config, mode: 'grouped' })}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${config.mode === 'grouped' ? 'bg-card text-accent shadow-sm' : 'text-muted hover:text-text'}`}
                                >
                                    Automatic Grouping Formula
                                </button>
                            </div>

                            {config.mode === 'grouped' ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="bg-surface/30 p-6 rounded-2xl border border-border/50 space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5">Query/Rows Formula</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    value={config.formula || ''}
                                                    onChange={e => setConfig({ ...config, formula: e.target.value })}
                                                    className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text font-mono focus:border-accent outline-none transition"
                                                    placeholder="e.g. roster_rows(1)"
                                                />
                                                <button 
                                                    type="button"
                                                    disabled={testingFormula === 'grouped'}
                                                    onClick={() => testFormula('grouped', config.formula)}
                                                    className="px-4 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent rounded-xl font-black text-[10px] uppercase tracking-widest transition flex items-center gap-1.5"
                                                >
                                                    <Play size={12} />
                                                    {testingFormula === 'grouped' ? 'Testing...' : 'Test'}
                                                </button>
                                            </div>
                                            {formatTestResult(testResults['grouped'])}
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5">Group By Column Name</label>
                                            <input 
                                                value={config.group_by_column || ''}
                                                onChange={e => setConfig({ ...config, group_by_column: e.target.value })}
                                                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text font-bold focus:border-accent outline-none transition"
                                                placeholder="e.g. Status"
                                            />
                                            <span className="text-[8px] text-muted font-bold uppercase tracking-wider mt-1 block">Specify the column name (e.g. Rank, Status) to split slices by.</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-text">Data Series</h3>
                                            <p className="text-[9px] text-muted font-bold uppercase mt-1">Specify custom slice names and formulas</p>
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
                                            <div key={series.id} className="bg-card border border-border rounded-2xl p-4 space-y-4">
                                                <div className="flex flex-wrap items-center gap-4">
                                                    <input 
                                                        type="color"
                                                        value={series.color}
                                                        onChange={e => updateSeries(idx, { color: e.target.value })}
                                                        className="h-8 w-10 bg-surface border border-border rounded-lg p-1 cursor-pointer"
                                                    />
                                                    <div className="flex-1 min-w-[200px]">
                                                        <input 
                                                            value={series.name}
                                                            onChange={e => updateSeries(idx, { name: e.target.value })}
                                                            className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text font-black uppercase tracking-wider"
                                                            placeholder="Series Label"
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        onClick={() => removeSeries(idx)}
                                                        className="p-2 text-muted hover:text-danger rounded-lg transition-colors border border-transparent hover:bg-surface/50"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>

                                                <div className="flex gap-2">
                                                    <input 
                                                        value={series.formula}
                                                        onChange={e => updateSeries(idx, { formula: e.target.value })}
                                                        className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text font-mono focus:border-accent outline-none"
                                                        placeholder="Formula e.g. roster_count(1, 'Status', 'Active')"
                                                    />
                                                    <button 
                                                        type="button"
                                                        disabled={testingFormula === series.id}
                                                        onClick={() => testFormula(series.id, series.formula)}
                                                        className="px-3 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent rounded-xl font-black text-[9px] uppercase tracking-widest transition flex items-center gap-1"
                                                    >
                                                        <Play size={10} />
                                                        {testingFormula === series.id ? 'Testing...' : 'Test'}
                                                    </button>
                                                </div>
                                                {formatTestResult(testResults[series.id])}
                                            </div>
                                        ))}

                                        {(config.series || []).length === 0 && (
                                            <div className="py-12 border border-dashed border-border rounded-3xl flex flex-col items-center justify-center opacity-40">
                                                <BarChart3 size={32} className="mb-2" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">No data series defined</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Documentation & Cheat Sheet */}
                    <div className="w-80 border-l border-border bg-surface/10 overflow-y-auto p-5 space-y-6">
                        <div className="flex items-center gap-2 border-b border-border pb-3 shrink-0">
                            <BookOpen className="text-accent" size={16} />
                            <h3 className="text-xs font-black uppercase tracking-wider text-text">Formula Cheat Sheet</h3>
                        </div>

                        {/* Functions Reference */}
                        <div className="space-y-4">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-muted">Core Functions</h4>
                            
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between items-center">
                                        <code className="text-[10px] text-accent font-mono">roster_count(id, col, val)</code>
                                        <button onClick={() => copyToClipboard("roster_count(1, 'Status', 'Active')")} className="text-muted hover:text-text"><Copy size={10} /></button>
                                    </div>
                                    <p className="text-[9px] text-muted mt-0.5">Counts rows in Roster. Filters are optional name-value pairs.</p>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center">
                                        <code className="text-[10px] text-accent font-mono">roster_rows(id)</code>
                                        <button onClick={() => copyToClipboard("roster_rows(1)")} className="text-muted hover:text-text"><Copy size={10} /></button>
                                    </div>
                                    <p className="text-[9px] text-muted mt-0.5">Returns a collection of Roster rows.</p>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center">
                                        <code className="text-[10px] text-accent font-mono">database_count(id, col, val)</code>
                                        <button onClick={() => copyToClipboard("database_count(1, 'status', 'Active')")} className="text-muted hover:text-text"><Copy size={10} /></button>
                                    </div>
                                    <p className="text-[9px] text-muted mt-0.5">Counts rows in Record Database.</p>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center">
                                        <code className="text-[10px] text-accent font-mono">database_rows(id)</code>
                                        <button onClick={() => copyToClipboard("database_rows(1)")} className="text-muted hover:text-text"><Copy size={10} /></button>
                                    </div>
                                    <p className="text-[9px] text-muted mt-0.5">Returns rows of a Record Database.</p>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center">
                                        <code className="text-[10px] text-accent font-mono">sum(coll, property)</code>
                                        <button onClick={() => copyToClipboard("sum(roster_rows(1), 'col_hours')")} className="text-muted hover:text-text"><Copy size={10} /></button>
                                    </div>
                                    <p className="text-[9px] text-muted mt-0.5">Sums a property in a collection.</p>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center">
                                        <code className="text-[10px] text-accent font-mono">count(coll)</code>
                                        <button onClick={() => copyToClipboard("count(roster_rows(1))")} className="text-muted hover:text-text"><Copy size={10} /></button>
                                    </div>
                                    <p className="text-[9px] text-muted mt-0.5">Returns number of items in collection.</p>
                                </div>
                            </div>
                        </div>

                        {/* Rosters ID Mapping */}
                        <div className="space-y-3 pt-4 border-t border-border/50">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-muted">Your Rosters</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {rosters.map(r => (
                                    <div key={r.id} className="text-[9px] font-mono bg-card/50 border border-border/30 rounded p-1.5">
                                        <div className="flex justify-between font-bold">
                                            <span className="text-text truncate max-w-[120px]">{r.name}</span>
                                            <span className="text-accent shrink-0">ID: {r.id}</span>
                                        </div>
                                        <div className="text-muted text-[8px] mt-1 flex flex-wrap gap-1 leading-none">
                                            {r.columns?.map((c: any) => (
                                                <span key={c.id} className="bg-surface px-1 py-0.5 rounded" title={c.id}>{c.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Databases ID Mapping */}
                        <div className="space-y-3 pt-4 border-t border-border/50">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-muted">Your Record DBs</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {recordData.map(d => (
                                    <div key={d.id} className="text-[9px] font-mono bg-card/50 border border-border/30 rounded p-1.5">
                                        <div className="flex justify-between font-bold">
                                            <span className="text-text truncate max-w-[120px]">{d.name}</span>
                                            <span className="text-accent shrink-0">ID: {d.id}</span>
                                        </div>
                                        <div className="text-muted text-[8px] mt-1 flex flex-wrap gap-1 leading-none">
                                            {d.database_structure?.map((c: any) => (
                                                <span key={c.id} className="bg-surface px-1 py-0.5 rounded" title={c.id}>{c.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
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

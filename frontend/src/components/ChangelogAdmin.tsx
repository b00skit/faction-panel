import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Check, ScrollText } from 'lucide-react';
import { useConfirm } from './ConfirmationProvider';

import { ChangelogEntry, ChangelogItem } from '../types';

const ChangelogAdmin: React.FC = () => {
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Partial<ChangelogEntry> | null>(null);
    const [processing, setProcessing] = useState(false);
    const [newItemType, setNewItemType] = useState<ChangelogItem['type']>('Feature');
    const [newItemContent, setNewItemContent] = useState('');
    const confirm = useConfirm();

    const [searchParams, setSearchParams] = useSearchParams();
    const editId = searchParams.get('edit') ? parseInt(searchParams.get('edit')!) : null;

    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [editingItemContent, setEditingItemContent] = useState<string>('');
    const [editingItemType, setEditingItemType] = useState<ChangelogItem['type']>('Feature');

    const handleCloseEdit = () => {
        setEditing(null);
        setEditingItemIndex(null);
        if (searchParams.has('edit')) {
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('edit');
            setSearchParams(newParams);
        }
    };

    const startEditItem = (index: number, item: ChangelogItem) => {
        setEditingItemIndex(index);
        setEditingItemContent(item.content);
        setEditingItemType(item.type);
    };

    const saveEditedItem = () => {
        if (!editingItemContent.trim() || !editing) return;
        const updatedItems = [...(editing.items || [])];
        updatedItems[editingItemIndex!] = {
            type: editingItemType,
            content: editingItemContent.trim()
        };
        setEditing({ ...editing, items: updatedItems });
        setEditingItemIndex(null);
    };

    const handleAddItem = () => {
        if (!newItemContent.trim() || !editing) return;
        const currentItems = editing.items || [];
        setEditing({
            ...editing,
            items: [...currentItems, { type: newItemType, content: newItemContent.trim() }]
        });
        setNewItemContent('');
    };

    const startEdit = (entry: ChangelogEntry) => {
        let items = entry.items || [];
        if (items.length === 0 && entry.body) {
            const lines = entry.body.split('\n');
            const parsedItems: ChangelogItem[] = [];
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                    parsedItems.push({
                        type: 'Feature',
                        content: trimmed.substring(1).trim()
                    });
                }
            });
            items = parsedItems.length > 0 ? parsedItems : [{ type: 'Feature', content: entry.body }];
        }
        let released_at = '';
        if (entry.released_at) {
            const match = entry.released_at.match(/^(\d{4}-\d{2}-\d{2})/);
            if (match) {
                released_at = match[1];
            } else {
                try {
                    released_at = new Date(entry.released_at).toISOString().split('T')[0];
                } catch {
                    released_at = '';
                }
            }
        }
        setEditingItemIndex(null);
        setEditing({ ...entry, items, released_at });
    };

    useEffect(() => {
        fetchEntries();
    }, []);

    useEffect(() => {
        if (editId && entries.length > 0) {
            const entryToEdit = entries.find(e => e.id === editId);
            if (entryToEdit && (!editing || editing.id !== editId)) {
                startEdit(entryToEdit);
            }
        }
    }, [editId, entries]);

    const fetchEntries = async () => {
        try {
            const res = await api.get('/changelog');
            setEntries(res.data);
        } catch {
            toast.error('Failed to load changelog');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        if ((!editing.items || editing.items.length === 0) && !editing.body?.trim()) {
            toast.error('Please add at least one changelog item or a description body');
            return;
        }
        setProcessing(true);
        const loadToast = toast.loading('Saving...');
        try {
            if (editing.id) {
                await api.put(`/superadmin/changelog/${editing.id}`, editing);
            } else {
                await api.post('/superadmin/changelog', editing);
            }
            toast.success('Saved', { id: loadToast });
            handleCloseEdit();
            fetchEntries();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save', { id: loadToast });
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (entry: ChangelogEntry) => {
        const ok = await confirm({
            title: 'Delete Changelog Entry',
            message: `Delete "${entry.title}"?`,
            confirmText: 'Delete',
            variant: 'danger',
        });
        if (!ok) return;
        const loadToast = toast.loading('Deleting...');
        try {
            await api.delete(`/superadmin/changelog/${entry.id}`);
            toast.success('Deleted', { id: loadToast });
            fetchEntries();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete', { id: loadToast });
        }
    };

    const startNew = () => {
        setEditing({ version: '', title: '', items: [], released_at: new Date().toISOString().split('T')[0], order: 0 });
        setNewItemType('Feature');
        setNewItemContent('');
        setEditingItemIndex(null);
        if (searchParams.has('edit')) {
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('edit');
            setSearchParams(newParams);
        }
    };

    if (loading) return <div className="text-muted text-xs p-4">Loading...</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-2">
                    <ScrollText className="text-accent" size={20} />
                    System Changelog
                </h3>
                <button
                    onClick={startNew}
                    className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition shadow-lg shadow-accent/20"
                >
                    <Plus size={14} /> New Entry
                </button>
            </div>

            {editing && (
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted mb-4">
                        {editing.id ? 'Edit Entry' : 'New Entry'}
                    </h4>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[9px] font-bold uppercase tracking-widest text-muted mb-1">Version</label>
                                <input
                                    value={editing.version || ''}
                                    onChange={e => setEditing({ ...editing, version: e.target.value })}
                                    className="w-full bg-surface border border-border p-2.5 rounded-lg text-sm font-mono"
                                    placeholder="1.2.3"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold uppercase tracking-widest text-muted mb-1">Release Date</label>
                                <input
                                    type="date"
                                    value={editing.released_at || ''}
                                    onChange={e => setEditing({ ...editing, released_at: e.target.value })}
                                    className="w-full bg-surface border border-border p-2.5 rounded-lg text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold uppercase tracking-widest text-muted mb-1">Order</label>
                                <input
                                    type="number"
                                    value={editing.order ?? 0}
                                    onChange={e => setEditing({ ...editing, order: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-surface border border-border p-2.5 rounded-lg text-sm"
                                    min={0}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold uppercase tracking-widest text-muted mb-1">Title</label>
                            <input
                                value={editing.title || ''}
                                onChange={e => setEditing({ ...editing, title: e.target.value })}
                                className="w-full bg-surface border border-border p-2.5 rounded-lg text-sm"
                                placeholder="What's new in this release..."
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold uppercase tracking-widest text-muted mb-1">Body / Description (HTML supported)</label>
                            <textarea
                                value={editing.body || ''}
                                onChange={e => setEditing({ ...editing, body: e.target.value })}
                                className="w-full bg-surface border border-border p-2.5 rounded-lg text-sm"
                                placeholder="Describe the release in detail (HTML tags are supported)..."
                                rows={4}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="block text-[9px] font-bold uppercase tracking-widest text-muted">Changelog Items</label>
                            
                            {/* Existing items list */}
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {(!editing.items || editing.items.length === 0) ? (
                                    <div className="text-[10px] text-muted italic border border-dashed border-border rounded-lg p-3 text-center">
                                        No items added yet. Add items below.
                                    </div>
                                ) : (
                                    editing.items.map((item, index) => {
                                        const isThisEditing = editingItemIndex === index;
                                        if (isThisEditing) {
                                            return (
                                                <div key={index} className="flex items-center gap-2 bg-surface border border-accent/30 rounded-lg p-2">
                                                    <select
                                                        value={editingItemType}
                                                        onChange={e => setEditingItemType(e.target.value as any)}
                                                        className="bg-card border border-border p-1 rounded text-[10px] font-bold shrink-0 h-[26px] w-[100px]"
                                                    >
                                                        <option value="Feature">Feature</option>
                                                        <option value="Modification">Modification</option>
                                                        <option value="Backend">Backend</option>
                                                        <option value="Fix">Fix</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        value={editingItemContent}
                                                        onChange={e => setEditingItemContent(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                saveEditedItem();
                                                            } else if (e.key === 'Escape') {
                                                                setEditingItemIndex(null);
                                                            }
                                                        }}
                                                        className="flex-1 bg-card border border-border p-1 rounded text-xs h-[26px]"
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={saveEditedItem}
                                                        className="p-1 hover:bg-emerald-500/10 text-emerald-500 rounded transition shrink-0"
                                                        title="Save Item"
                                                    >
                                                        <Check size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingItemIndex(null)}
                                                        className="p-1 hover:bg-muted/15 text-muted rounded transition shrink-0"
                                                        title="Cancel"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={index} className="flex items-center gap-2 bg-surface border border-border rounded-lg p-2">
                                                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                                    item.type === 'Feature' ? 'bg-emerald-500/10 text-emerald-500' :
                                                    item.type === 'Modification' ? 'bg-sky-500/10 text-sky-500' :
                                                    item.type === 'Backend' ? 'bg-indigo-500/10 text-indigo-500' :
                                                    'bg-danger/10 text-danger'
                                                }`}>
                                                    {item.type}
                                                </span>
                                                <span className="text-xs flex-1 truncate">{item.content}</span>
                                                <div className="flex gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditItem(index, item)}
                                                        className="p-1 hover:bg-accent/10 text-muted hover:text-accent rounded transition shrink-0"
                                                        title="Edit Item"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const updatedItems = [...(editing.items || [])];
                                                            updatedItems.splice(index, 1);
                                                            setEditing({ ...editing, items: updatedItems });
                                                        }}
                                                        className="p-1 hover:bg-danger/10 text-muted hover:text-danger rounded transition shrink-0"
                                                        title="Delete Item"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Add new item form */}
                            <div className="flex gap-2 items-center">
                                <select
                                    value={newItemType}
                                    onChange={e => setNewItemType(e.target.value as any)}
                                    className="bg-surface border border-border p-2 rounded-lg text-xs font-bold shrink-0 h-[34px] w-[120px]"
                                >
                                    <option value="Feature">Feature</option>
                                    <option value="Modification">Modification</option>
                                    <option value="Backend">Backend</option>
                                    <option value="Fix">Fix</option>
                                </select>
                                <input
                                    type="text"
                                    value={newItemContent}
                                    onChange={e => setNewItemContent(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddItem();
                                        }
                                    }}
                                    className="flex-1 bg-surface border border-border p-2 rounded-lg text-xs h-[34px]"
                                    placeholder="Describe the change..."
                                />
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="p-2 bg-accent hover:bg-accent/90 text-white rounded-lg transition shrink-0 h-[34px] w-[34px] flex items-center justify-center"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={handleCloseEdit}
                                className="flex items-center gap-1 px-4 py-2 border border-border rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-surface transition"
                            >
                                <X size={12} /> Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={processing}
                                className="flex items-center gap-1 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition disabled:opacity-50"
                            >
                                <Check size={12} /> {processing ? '...' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {entries.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-12 text-muted text-center">
                    <ScrollText size={48} className="opacity-10 mb-4" />
                    <p className="font-bold uppercase tracking-widest text-xs">No changelog entries yet</p>
                    <p className="text-[10px] mt-1 italic">Create the first entry to get started.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {entries.map(entry => (
                        <div key={entry.id} className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="font-mono text-[10px] font-black px-2 py-0.5 bg-accent/10 text-accent rounded">
                                        v{entry.version}
                                    </span>
                                    <span className="font-bold text-sm">{entry.title}</span>
                                    <span className="text-[9px] text-muted font-bold uppercase tracking-widest ml-auto">
                                        {new Date(entry.released_at).toLocaleDateString()}
                                    </span>
                                </div>
                                {entry.body && (
                                    <div 
                                        className="text-xs text-muted line-clamp-2 mt-1 html-content" 
                                        dangerouslySetInnerHTML={{ __html: entry.body }} 
                                    />
                                )}
                                {entry.items && entry.items.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {entry.items.map((item, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1.5 text-[9px] text-muted bg-surface border border-border px-2 py-0.5 rounded font-medium">
                                                <span className={`w-1.5 h-1.5 rounded-full ${
                                                    item.type === 'Feature' ? 'bg-emerald-500' :
                                                    item.type === 'Modification' ? 'bg-sky-500' :
                                                    item.type === 'Backend' ? 'bg-indigo-500' :
                                                    'bg-danger'
                                                }`} />
                                                <span dangerouslySetInnerHTML={{ __html: item.content }} />
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={() => startEdit(entry)}
                                    className="p-2 hover:bg-surface rounded-lg text-muted hover:text-text transition"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => handleDelete(entry)}
                                    className="p-2 hover:bg-danger/10 rounded-lg text-muted hover:text-danger transition"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ChangelogAdmin;

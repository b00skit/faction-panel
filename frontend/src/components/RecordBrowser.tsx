import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import { Database, Plus, Search, Trash2, Layout, Info, ChevronLeft, ChevronRight, MoreVertical, Edit2, Calendar, User, Filter, Download, X, Link as LinkIcon, Share2, CheckSquare, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Loading from './Loading';
import { FactionRecordDatabase } from '../types';

interface RecordBrowserProps {
    database: FactionRecordDatabase;
    shortname: string;
    permissions: string[];
    user: any;
    onBack: () => void;
}

export default function RecordBrowser({ database, shortname, permissions, user, onBack }: RecordBrowserProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showEntryModal, setShowEntryModal] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [entryData, setEntryData] = useState<any>({});
    const [entryIsActive, setEntryIsActive] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    const [selectedEntryDetails, setSelectedEntryDetails] = useState<any | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const hasDBPermission = (perm: string) => {
        if (permissions.includes('administrator') || permissions.includes('global_faction_record_moderation')) return true;
        return true; 
    };

    const fetchEntries = async () => {
        try {
            const res = await api.get(`/factions/${shortname}/records/${database.id}/entries`);
            const loadedEntries = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setEntries(loadedEntries);

            // Sync with URL
            const recordParam = searchParams.get('record');
            if (recordParam && !selectedEntry) {
                const targetEntry = loadedEntries.find((e: any) => String(e.entry_id) === recordParam || String(e.id) === recordParam);
                if (targetEntry) {
                    fetchEntryDetails(targetEntry);
                }
            } else if (!recordParam) {
                // If no record param, ensure nothing is selected
                setSelectedEntry(null);
                setSelectedEntryDetails(null);
            }
        } catch (err: any) {
            if (err.response?.status === 403) {
                toast.error('You do not have permission to view this database');
                onBack();
            } else {
                toast.error('Failed to fetch entries');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSetSelectedEntry = (entry: any | null) => {
        setSelectedEntry(entry);
        if (!entry) {
            setSelectedEntryDetails(null);
        } else {
            fetchEntryDetails(entry);
        }
        
        const newParams = new URLSearchParams(searchParams);
        if (entry) {
            newParams.set('record', String(entry.entry_id));
        } else {
            newParams.delete('record');
            newParams.delete('edit');
        }
        setSearchParams(newParams, { replace: true });
    };

    useEffect(() => {
        fetchEntries();
    }, [database.id]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, database.id]);

    useEffect(() => {
        if (entries.length > 0) {
            const recordParam = searchParams.get('record');
            const targetEntry = entries.find((e: any) => String(e.entry_id) === recordParam || String(e.id) === recordParam);
            if (targetEntry) {
                if (selectedEntry?.id !== targetEntry.id) fetchEntryDetails(targetEntry);
                
                // If edit parameter is present, open the edit modal
                if (searchParams.get('edit') === 'true' && !showEntryModal) {
                    openEditModal(targetEntry);
                }
            }
        }
    }, [searchParams, entries]);

    const fetchEntryDetails = async (entry: any) => {
        setLoadingDetails(true);
        try {
            const res = await api.get(`/factions/${shortname}/records/${database.id}/entries/${entry.id}`);
            setSelectedEntryDetails(res.data);
            setSelectedEntry(res.data);
        } catch (err) {
            toast.error('Failed to fetch record details');
            setSelectedEntry(entry); // Fallback to list object
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleSaveEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const loadToast = toast.loading(showEntryModal === 'create' ? 'Creating entry...' : 'Updating entry...');
        try {
            const payload = { data: entryData, is_active: entryIsActive };
            if (showEntryModal === 'create') {
                await api.post(`/factions/${shortname}/records/${database.id}/entries`, payload);
                toast.success('Entry created', { id: loadToast });
            } else {
                await api.put(`/factions/${shortname}/records/${database.id}/entries/${showEntryModal.id}`, payload);
                toast.success('Entry updated', { id: loadToast });
                if (selectedEntry?.id === showEntryModal.id) {
                    fetchEntryDetails(showEntryModal);
                }
            }
            setShowEntryModal(null);
            
            // Remove edit param from URL if it was there
            if (searchParams.get('edit')) {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('edit');
                setSearchParams(newParams, { replace: true });
            }

            setEntryData({});
            setEntryIsActive(true);
            fetchEntries();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save entry', { id: loadToast });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEntry = async (id: number, andClose = false) => {
        toast((t) => (
            <div className="flex flex-col gap-1 text-left">
                <p className="font-bold text-xs uppercase">Delete this entry?</p>
                <p className="text-[9px] opacity-80 uppercase tracking-tighter">This action cannot be undone.</p>
                <div className="flex gap-2 justify-end mt-2">
                    <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1 bg-surface hover:bg-bg border border-border rounded text-[9px] font-bold uppercase transition">Cancel</button>
                    <button 
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const loadToast = toast.loading('Deleting entry...');
                            try {
                                await api.delete(`/factions/${shortname}/records/${database.id}/entries/${id}`);
                                toast.success('Entry deleted', { id: loadToast });
                                if (andClose) handleSetSelectedEntry(null);
                                fetchEntries();
                            } catch (err) {
                                toast.error('Failed to delete entry', { id: loadToast });
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

    const openCreateModal = () => {
        const initialData: any = {};
        database.database_structure.forEach(field => {
            initialData[field.id] = field.type === 'boolean' ? false : '';
        });
        setEntryData(initialData);
        setEntryIsActive(true);
        setShowEntryModal('create');
    };

    const openEditModal = (entry: any) => {
        setEntryData(entry.data || {});
        setEntryIsActive(entry.is_active ?? true);
        setShowEntryModal(entry);
    };

    if (loading) return <Loading message={`Loading ${database.name}...`} />;

    // Improved direct access UX: If record param is present but selectedEntry is not yet loaded, show loading
    const recordParam = searchParams.get('record');
    if (recordParam && !selectedEntry && entries.length > 0) {
        return <Loading message={`Loading Record #${recordParam}...`} />;
    }

    const pageSize = 500;

    const filteredEntries = entries.filter(entry => {
        const searchStr = searchQuery.toLowerCase();
        return Object.values(entry.data || {}).some(val => 
            String(val).toLowerCase().includes(searchStr)
        ) || String(entry.entry_id).includes(searchStr);
    });

    const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const paginatedEntries = filteredEntries.slice(startIndex, startIndex + pageSize);

    const renderFieldValue = (field: any, value: any) => {
        if (value === null || value === undefined || value === '') return <span className="text-muted/40 italic">Empty</span>;
        
        switch (field.type) {
            case 'boolean':
                return value ? (
                    <span className="px-2 py-0.5 bg-success/10 text-success rounded text-[9px] font-black uppercase tracking-widest">Yes</span>
                ) : (
                    <span className="px-2 py-0.5 bg-danger/10 text-danger rounded text-[9px] font-black uppercase tracking-widest">No</span>
                );
            case 'date':
                return value ? new Date(value).toLocaleDateString() : 'N/A';
            default:
                return value;
        }
    };

    const renderIntegrations = () => {
        if (!selectedEntryDetails) return null;
        const { linked_records, roster_integrations } = selectedEntryDetails;

        if (!linked_records?.length && !roster_integrations?.length) return null;

        return (
            <div className="mt-12 space-y-12">
                {/* Linked Records */}
                {linked_records?.map((link: any, idx: number) => (
                    <div key={idx} className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent/10 rounded-lg text-accent">
                                <LinkIcon size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-text">Linked {link.database.name}</h3>
                                <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Related entries from {link.database.record_shortcode || 'DATABASE'}</p>
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-surface/50 border-b border-border">
                                    <tr>
                                        <th className="p-4 font-black uppercase tracking-widest text-muted w-24">ID</th>
                                        {link.database.database_structure
                                            .filter((f: any) => !link.config?.display_fields?.length || link.config.display_fields.includes(f.id))
                                            .slice(0, link.config?.display_fields?.length ? undefined : 3)
                                            .map((f: any) => (
                                                <th key={f.id} className="p-4 font-black uppercase tracking-widest text-muted">{f.name}</th>
                                            ))
                                        }
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {link.entries.map((le: any) => (
                                        <tr 
                                            key={le.id} 
                                            onClick={() => {
                                                const newParams = new URLSearchParams(searchParams);
                                                newParams.set('database', link.database.record_shortcode || link.database.id);
                                                newParams.set('record', String(le.entry_id));
                                                setSearchParams(newParams);
                                            }}
                                            className="hover:bg-surface/30 transition-colors cursor-pointer group"
                                        >
                                            <td className="p-4 font-black text-accent group-hover:underline">#{link.database.record_shortcode}{le.entry_id}</td>
                                            {link.database.database_structure
                                                .filter((f: any) => !link.config?.display_fields?.length || link.config.display_fields.includes(f.id))
                                                .slice(0, link.config?.display_fields?.length ? undefined : 3)
                                                .map((f: any) => (
                                                    <td key={f.id} className="p-4">{renderFieldValue(f, le.data?.[f.id])}</td>
                                                ))
                                            }
                                        </tr>
                                    ))}
                                    {link.entries.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-muted italic font-bold uppercase text-[10px] tracking-widest">No matching records found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}

                {/* Roster Integrations */}
                {roster_integrations?.map((integ: any, idx: number) => (
                    <div key={idx} className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                                <Share2 size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-text">Roster Integration: {integ.roster.name}</h3>
                                <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Active membership in {integ.roster.shortname}</p>
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-[10px] border-collapse">
                                    <thead className="bg-surface/50 border-b border-border">
                                        <tr>
                                            <th className="p-3 font-black uppercase tracking-widest text-muted w-32">Section</th>
                                            {integ.roster.columns.map((col: any) => (
                                                <th key={col.id} className="p-3 font-black uppercase tracking-widest text-muted text-center">{col.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/30">
                                        {integ.contents.map((row: any) => (
                                            <tr 
                                                key={row.id} 
                                                onClick={() => {
                                                    const newParams = new URLSearchParams(searchParams);
                                                    newParams.delete('database');
                                                    newParams.delete('record');
                                                    newParams.set('roster', integ.roster.shortname);
                                                    setSearchParams(newParams);
                                                }}
                                                className="hover:bg-surface/30 transition-colors cursor-pointer group"
                                            >
                                                <td className="p-3">
                                                    <span className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded font-black uppercase text-[8px]">{row.section?.name}</span>
                                                </td>
                                                {integ.roster.columns.map((col: any) => {
                                                    const val = row.content?.[col.id];
                                                    const checked = row.content?.[`${col.id}_cb`] || [];
                                                    const tags = row.content?.[`${col.id}_tags`] || [];

                                                    return (
                                                        <td key={col.id} className="p-3">
                                                            <div className="flex flex-col items-center justify-center gap-1">
                                                                <span className="font-black uppercase text-[10px] text-center">{val || '-'}</span>
                                                                {(checked.length > 0 || tags.length > 0) && (
                                                                    <div className="flex flex-wrap justify-center gap-1">
                                                                        {checked.map((cb: string) => (
                                                                            <span key={cb} className="px-1 py-0.5 bg-accent/10 text-accent rounded-[2px] text-[6px] font-black uppercase tracking-widest border border-accent/20">{cb}</span>
                                                                        ))}
                                                                        {tags.map((tag: string) => (
                                                                            <span key={tag} className="px-1 py-0.5 bg-surface border border-border rounded-[2px] text-[6px] font-black uppercase tracking-widest">{tag}</span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-4 py-2 bg-surface/50 border-t border-border flex justify-between items-center">
                                <span className="text-[8px] font-black text-muted uppercase tracking-widest italic">Source: {integ.roster.name} ({integ.roster.shortname})</span>
                                <Link 
                                    to={`/${shortname}/roster?roster=${integ.roster.shortname}`}
                                    className="text-[8px] font-black text-accent uppercase tracking-widest hover:underline flex items-center gap-1"
                                >
                                    View Full Roster <ExternalLink size={10} />
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderDetailView = () => {
        if (!selectedEntry) return null;
        const mode = database.data_entry_display || 'card';

        const renderField = (field: any) => (
            <div key={field.id}>
                <label className="block text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1.5">{field.name}</label>
                <div className="text-sm text-text font-medium bg-surface/30 p-3 rounded-lg border border-border/50">
                    {renderFieldValue(field, selectedEntry.data?.[field.id])}
                </div>
            </div>
        );

        const Header = () => (
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
                <div className="flex items-center gap-4">
                    <button onClick={() => handleSetSelectedEntry(null)} className="p-2 hover:bg-surface rounded-lg text-muted hover:text-text transition-all">
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-accent">#{database.record_shortcode ? `${database.record_shortcode}` : ''}{selectedEntry.entry_id}</span>
                            {!selectedEntry.is_active && <span className="px-1.5 py-0.5 bg-danger/10 text-danger rounded text-[8px] font-black uppercase tracking-widest">Inactive</span>}
                            {loadingDetails && <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin ml-2" />}
                        </div>
                        <h2 className="text-2xl font-black text-text uppercase tracking-tighter">Record Details</h2>
                    </div>
                </div>
                {!database.is_api_database && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => openEditModal(selectedEntry)} className="p-2 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-lg transition-all"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteEntry(selectedEntry.id, true)} className="p-2 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-lg transition-all"><Trash2 size={16} /></button>
                    </div>
                )}
            </div>
        );

        const Metadata = () => (
            <div className="mt-8 pt-6 border-t border-border grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-xs font-black text-accent">
                        {selectedEntry.creator?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <label className="block text-[8px] font-black text-muted uppercase tracking-widest">Created By</label>
                        <span className="text-xs font-bold text-text">{selectedEntry.creator?.username}</span>
                    </div>
                </div>
                <div className="text-right">
                    <label className="block text-[8px] font-black text-muted uppercase tracking-widest">Created At</label>
                    <span className="text-xs font-bold text-text">{new Date(selectedEntry.created_at).toLocaleString()}</span>
                </div>
            </div>
        );

        let content = null;

        if (mode === 'profile') {
            const showcaseFieldId = database.detail_customization?.showcase_field || database.database_structure?.[0]?.id;
            const showcaseField = database.database_structure?.find((f: any) => f.id === showcaseFieldId) || database.database_structure?.[0];
            const otherFields = database.database_structure?.filter((f: any) => f.id !== showcaseField?.id) || [];

            content = (
                <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl">
                    <div className="h-32 bg-gradient-to-r from-accent/20 to-accent/5 flex items-end p-8">
                        <div className="w-24 h-24 rounded-2xl bg-card border-4 border-card shadow-lg flex items-center justify-center text-3xl font-black text-accent translate-y-12">
                            {String(selectedEntry.data?.[showcaseField?.id] || 'R').charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div className="p-8 pt-16">
                        <div className="mb-8">
                            <h3 className="text-3xl font-black text-text uppercase tracking-tighter">{selectedEntry.data?.[showcaseField?.id] || 'Unnamed Record'}</h3>
                            <p className="text-muted font-bold text-[10px] uppercase tracking-[0.2em]">{database.name} Profile</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {otherFields.map(renderField)}
                        </div>
                        <Metadata />
                    </div>
                </div>
            );
        } else if (mode === 'dossier') {
            content = (
                <div className="bg-white text-black p-12 shadow-2xl border-t-8 border-accent relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Database size={120} />
                    </div>
                    <div className="border-b-2 border-black pb-4 mb-8">
                        <h2 className="text-3xl font-serif font-bold uppercase tracking-widest">Official Record</h2>
                        <p className="font-serif italic text-sm">Classification: {database.name}</p>
                    </div>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-12">
                            <div className="space-y-6">
                                {database.database_structure.slice(0, Math.ceil(database.database_structure.length / 2)).map(f => (
                                    <div key={f.id} className="border-b border-black/10 pb-2">
                                        <label className="block text-[9px] font-bold uppercase mb-1">{f.name}</label>
                                        <div className="font-serif text-lg">{renderFieldValue(f, selectedEntry.data?.[f.id])}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-6">
                                {database.database_structure.slice(Math.ceil(database.database_structure.length / 2)).map(f => (
                                    <div key={f.id} className="border-b border-black/10 pb-2">
                                        <label className="block text-[9px] font-bold uppercase mb-1">{f.name}</label>
                                        <div className="font-serif text-lg">{renderFieldValue(f, selectedEntry.data?.[f.id])}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="mt-12 pt-8 border-t-2 border-black flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase">Record ID: {database.record_shortcode}{selectedEntry.entry_id}</p>
                            <p className="text-[10px] font-bold uppercase">Authorized By: {selectedEntry.creator?.username}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold uppercase">Dated: {new Date(selectedEntry.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
            );
        } else if (mode === 'split') {
            content = (
                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="lg:w-2/3 space-y-6">
                        <div className="bg-card border border-border rounded-2xl p-8">
                            <h3 className="text-[10px] font-black text-accent uppercase tracking-widest mb-6">Primary Information</h3>
                            <div className="grid grid-cols-1 gap-6">
                                {database.database_structure.filter(f => f.type === 'textarea').map(renderField)}
                                {database.database_structure.filter(f => f.type !== 'textarea').slice(0, 4).map(renderField)}
                            </div>
                        </div>
                    </div>
                    <div className="lg:w-1/3 space-y-6">
                        <div className="bg-surface border border-border rounded-2xl p-8">
                            <h3 className="text-[10px] font-black text-accent uppercase tracking-widest mb-6">Technical Data</h3>
                            <div className="space-y-6">
                                {database.database_structure.filter(f => f.type !== 'textarea').slice(4).map(renderField)}
                            </div>
                            <Metadata />
                        </div>
                    </div>
                </div>
            );
        } else if (mode === 'minimal') {
            content = (
                <div className="max-w-2xl mx-auto space-y-4">
                    <div className="space-y-4">
                        {database.database_structure.map(f => (
                            <div key={f.id} className="flex items-center justify-between py-3 border-b border-border/50">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">{f.name}</span>
                                <span className="text-sm font-bold text-text">{renderFieldValue(f, selectedEntry.data?.[f.id])}</span>
                            </div>
                        ))}
                    </div>
                    <Metadata />
                </div>
            );
        } else {
            // DEFAULT: Card
            content = (
                <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {database.database_structure.map(renderField)}
                    </div>
                    <Metadata />
                </div>
            );
        }

        return (
            <div className={`py-8 ${mode === 'split' ? 'max-w-6xl' : mode === 'dossier' ? 'max-w-3xl' : 'max-w-4xl'} mx-auto`}>
                <Header />
                {content}
                {renderIntegrations()}
            </div>
        );
    };

    const renderDisplay = () => {
        const mode = database.data_overview_display;
        const clickable = database.allow_details_view;

        const onEntryClick = (entry: any) => {
            if (clickable) handleSetSelectedEntry(entry);
        };

        if (mode === 'table' || mode === 'compact') {
            const isCompact = mode === 'compact';
            return (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-surface/50 border-b border-border">
                                <th className={`text-left ${isCompact ? 'p-2' : 'p-4'} text-[9px] font-black uppercase tracking-widest text-muted w-20`}>ID</th>
                                <th className={`text-left ${isCompact ? 'p-2' : 'p-4'} text-[9px] font-black uppercase tracking-widest text-muted w-16`}>Status</th>
                                {database.database_structure.map(field => (
                                    <th key={field.id} className={`text-left ${isCompact ? 'p-2' : 'p-4'} text-[9px] font-black uppercase tracking-widest text-muted`}>{field.name}</th>
                                ))}
                                <th className={`text-right ${isCompact ? 'p-2' : 'p-4'} text-[9px] font-black uppercase tracking-widest text-muted`}>Created</th>
                                <th className={`${isCompact ? 'p-2' : 'p-4'} w-16`}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedEntries.map(entry => (
                                <tr 
                                    key={entry.id} 
                                    onClick={() => onEntryClick(entry)}
                                    className={`border-b border-border hover:bg-surface/30 transition-colors group ${!entry.is_active ? 'opacity-60' : ''} ${clickable ? 'cursor-pointer' : ''}`}
                                >
                                    <td className={`${isCompact ? 'p-2' : 'p-4'} text-xs font-black text-accent`}>
                                        #{database.record_shortcode ? `${database.record_shortcode}` : ''}{entry.entry_id}
                                    </td>
                                    <td className={`${isCompact ? 'p-2' : 'p-4'}`}>
                                        {entry.is_active ? (
                                            <span className="px-1.5 py-0.5 bg-success/10 text-success rounded text-[8px] font-black uppercase tracking-widest">Active</span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 bg-danger/10 text-danger rounded text-[8px] font-black uppercase tracking-widest">Inactive</span>
                                        )}
                                    </td>
                                    {database.database_structure.map(field => (
                                        <td key={field.id} className={`${isCompact ? 'p-2' : 'p-4'} text-xs text-text`}>
                                            {renderFieldValue(field, entry.data?.[field.id])}
                                        </td>
                                    ))}
                                    <td className={`${isCompact ? 'p-2' : 'p-4'} text-[10px] font-bold text-muted uppercase tracking-widest text-right whitespace-nowrap`}>
                                        <div className="flex flex-col items-end">
                                            <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                                            <span className="opacity-40">{entry.creator?.username}</span>
                                        </div>
                                    </td>
                                    <td className={`${isCompact ? 'p-2' : 'p-4'} text-right`}>
                                        {!database.is_api_database && (
                                            <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => openEditModal(entry)} className="p-1.5 text-muted hover:text-accent rounded transition-colors"><Edit2 size={14} /></button>
                                                <button onClick={() => handleDeleteEntry(entry.id)} className="p-1.5 text-muted hover:text-danger rounded transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (mode === 'rows') {
            return (
                <div className="space-y-3">
                    {paginatedEntries.map(entry => (
                        <div 
                            key={entry.id} 
                            onClick={() => onEntryClick(entry)}
                            className={`bg-card border border-border rounded-lg p-4 flex items-center justify-between group hover:border-accent/50 transition-all ${!entry.is_active ? 'opacity-60' : ''} ${clickable ? 'cursor-pointer' : ''}`}
                        >
                            <div className="flex items-center gap-6 overflow-hidden">
                                <span className="text-xs font-black text-accent w-20 shrink-0">
                                    #{database.record_shortcode ? `${database.record_shortcode}` : ''}{entry.entry_id}
                                </span>
                                <div className="flex gap-8 overflow-hidden">
                                    {database.database_structure.slice(0, 4).map(field => (
                                        <div key={field.id} className="min-w-[120px]">
                                            <label className="block text-[8px] font-black text-muted uppercase tracking-widest mb-0.5">{field.name}</label>
                                            <div className="text-xs text-text truncate">
                                                {renderFieldValue(field, entry.data?.[field.id])}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right">
                                    <div className="text-[9px] font-bold text-muted uppercase tracking-widest">{entry.creator?.username}</div>
                                    <div className="text-[8px] font-bold text-muted/40 uppercase tracking-widest">{new Date(entry.created_at).toLocaleDateString()}</div>
                                </div>
                                {!database.is_api_database && (
                                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity border-l border-border pl-4" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => openEditModal(entry)} className="p-1.5 text-muted hover:text-accent rounded transition-colors"><Edit2 size={14} /></button>
                                        <button onClick={() => handleDeleteEntry(entry.id)} className="p-1.5 text-muted hover:text-danger rounded transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        const isDetailed = mode === 'detailed';
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedEntries.map(entry => (
                    <div 
                        key={entry.id} 
                        onClick={() => onEntryClick(entry)}
                        className={`bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all group ${!entry.is_active ? 'opacity-60 border-dashed' : ''} ${clickable ? 'cursor-pointer' : ''}`}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-black text-accent bg-accent/10 px-2 py-1 rounded w-fit">
                                    #{database.record_shortcode ? `${database.record_shortcode}` : ''}{entry.entry_id}
                                </span>
                                {!entry.is_active && (
                                    <span className="text-[8px] font-black text-danger uppercase tracking-widest">INACTIVE RECORD</span>
                                )}
                            </div>
                            {!database.is_api_database && (
                                <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => openEditModal(entry)} className="p-1.5 text-muted hover:text-accent rounded transition-colors"><Edit2 size={14} /></button>
                                    <button onClick={() => handleDeleteEntry(entry.id)} className="p-1.5 text-muted hover:text-danger rounded transition-colors"><Trash2 size={14} /></button>
                                </div>
                            )}
                        </div>
                        
                        <div className={`space-y-4 mb-6 ${isDetailed ? 'divide-y divide-border/30' : ''}`}>
                            {database.database_structure.map(field => (
                                <div key={field.id} className={isDetailed ? 'pt-3 first:pt-0' : ''}>
                                    <label className="block text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1">{field.name}</label>
                                    <div className={`${isDetailed ? 'text-sm' : 'text-xs'} text-text font-medium`}>
                                        {renderFieldValue(field, entry.data?.[field.id])}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[8px] font-black text-accent uppercase">
                                    {entry.creator?.username?.charAt(0)}
                                </div>
                                <span className="text-[9px] font-bold text-muted uppercase tracking-widest">{entry.creator?.username}</span>
                            </div>
                            <span className="text-[9px] font-bold text-muted uppercase tracking-widest opacity-40">
                                {new Date(entry.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (selectedEntry) {
        return (
            <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                {renderDetailView()}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-surface rounded-lg text-muted hover:text-text transition-all"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black uppercase tracking-tighter text-text flex items-center gap-3">
                                <Database className="text-accent" size={24} />
                                {database.name}
                            </h1>
                            {database.is_api_database && (
                                <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[7px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-1.5 h-fit">
                                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                                    API Synchronized
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">
                            Browsing records for {database.record_shortcode || 'DATABASE'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        className="p-2 text-muted hover:text-text bg-card border border-border rounded-lg transition-all"
                        onClick={() => toast('Filters coming soon')}
                    >
                        <Filter size={16} />
                    </button>
                    {hasDBPermission('make_entries') && !database.is_api_database && (
                        <button 
                            onClick={openCreateModal}
                            className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded font-bold text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-accent/20"
                        >
                            <Plus size={14} />
                            New Record
                        </button>
                    )}
                </div>
            </header>

            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <input 
                    type="text"
                    placeholder={`Search ${entries.length} records...`}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-card border border-border p-4 pl-12 rounded-lg text-sm text-text focus:border-accent outline-none transition shadow-sm"
                />
            </div>

            <div className="flex-1 overflow-auto min-h-0">
                {renderDisplay()}

                {filteredEntries.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl bg-card/30">
                        <Database size={48} className="text-muted opacity-20 mb-4" />
                        <p className="text-sm font-bold text-muted uppercase tracking-widest">No records found</p>
                    </div>
                )}

                {filteredEntries.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-muted shrink-0">
                        <div>
                            Showing <span className="text-text font-black">{startIndex + 1}</span> to <span className="text-text font-black">{Math.min(startIndex + pageSize, filteredEntries.length)}</span> of <span className="text-text font-black">{filteredEntries.length}</span> records ({pageSize} per page)
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={safePage <= 1}
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    className="p-2 rounded-lg bg-card border border-border text-text hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    title="Previous Page"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="px-3 py-1 bg-surface border border-border rounded-lg text-text text-xs font-black">
                                    Page {safePage} of {totalPages}
                                </span>
                                <button
                                    type="button"
                                    disabled={safePage >= totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    className="p-2 rounded-lg bg-card border border-border text-text hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    title="Next Page"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showEntryModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
                    <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-surface shrink-0">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {showEntryModal === 'create' ? <Plus size={20} className="text-accent" /> : <Edit2 size={20} className="text-accent" />}
                                {showEntryModal === 'create' ? 'Add New Record' : `Edit Record #${database.record_shortcode ? `${database.record_shortcode}` : ''}${showEntryModal.entry_id}`}
                            </h2>
                            <button onClick={() => setShowEntryModal(null)} className="text-muted hover:text-text">&times;</button>
                        </div>
                        
                        <form onSubmit={handleSaveEntry} className="p-6 space-y-6 overflow-y-auto">
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center gap-3 cursor-pointer group p-3 bg-surface border border-border rounded-lg hover:border-accent transition-all">
                                        <input 
                                            type="checkbox"
                                            checked={entryIsActive}
                                            onChange={e => setEntryIsActive(e.target.checked)}
                                            className="hidden"
                                        />
                                        <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${entryIsActive ? 'bg-accent border-accent' : 'bg-card border-border group-hover:border-accent'}`}>
                                            {entryIsActive && <CheckSquare size={14} className="text-white" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-text uppercase tracking-widest">Active Record</span>
                                            <span className="text-[8px] text-muted font-bold uppercase tracking-widest">If inactive, the record will appear dimmed in listings.</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="h-px bg-border my-2"></div>

                                {database.database_structure.map(field => (
                                    <div key={field.id}>
                                        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
                                            {field.name}
                                            {field.required && <span className="text-danger ml-1">*</span>}
                                        </label>
                                        
                                        {field.type === 'textarea' ? (
                                            <textarea 
                                                required={field.required}
                                                value={entryData[field.id] || ''}
                                                onChange={e => setEntryData({ ...entryData, [field.id]: e.target.value })}
                                                className="w-full bg-surface border border-border p-3 rounded-lg text-sm text-text focus:border-accent outline-none transition min-h-[100px]"
                                            />
                                        ) : field.type === 'select' ? (
                                            <select 
                                                required={field.required}
                                                value={entryData[field.id] || ''}
                                                onChange={e => setEntryData({ ...entryData, [field.id]: e.target.value })}
                                                className="w-full bg-surface border border-border p-3 rounded-lg text-sm text-text focus:border-accent outline-none transition"
                                            >
                                                <option value="">Select an option...</option>
                                                {field.options?.map((opt: string) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'boolean' ? (
                                            <label className="flex items-center gap-3 cursor-pointer group p-3 bg-surface border border-border rounded-lg hover:border-accent transition-all">
                                                <input 
                                                    type="checkbox"
                                                    checked={entryData[field.id] || false}
                                                    onChange={e => setEntryData({ ...entryData, [field.id]: e.target.checked })}
                                                    className="hidden"
                                                />
                                                <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${entryData[field.id] ? 'bg-accent border-accent' : 'bg-card border-border group-hover:border-accent'}`}>
                                                    {entryData[field.id] && <CheckSquare size={14} className="text-white" />}
                                                </div>
                                                <span className="text-xs font-bold text-text uppercase tracking-widest">Enable / Active</span>
                                            </label>
                                        ) : (
                                            <input 
                                                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                                required={field.required}
                                                value={entryData[field.id] || ''}
                                                onChange={e => setEntryData({ ...entryData, [field.id]: e.target.value })}
                                                className="w-full bg-surface border border-border p-3 rounded-lg text-sm text-text focus:border-accent outline-none transition"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 pt-4 sticky bottom-0 bg-card py-4 border-t border-border shrink-0 mt-auto">
                                <button 
                                    type="button" 
                                    onClick={() => { setShowEntryModal(null); setEntryData({}); }}
                                    className="flex-1 px-4 py-3 bg-surface hover:bg-border border border-border text-text rounded-lg font-bold text-xs uppercase tracking-widest transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded-lg font-bold text-xs uppercase tracking-widest transition disabled:opacity-50 shadow-lg shadow-accent/20"
                                >
                                    {isSaving ? 'Saving...' : (showEntryModal === 'create' ? 'Create Record' : 'Save Changes')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

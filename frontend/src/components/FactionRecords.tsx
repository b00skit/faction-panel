import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import { Database, Plus, Search, Trash2, Layout, Info, Columns, Type, Hash, Calendar, CheckSquare, List, X, ChevronDown, ChevronUp, Settings2, Shield, Settings, Link as LinkIcon, Share2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Loading from './Loading';
import { RecordPermissionsModal } from './RecordPermissionsModal';
import RecordBrowser from './RecordBrowser';

const FIELD_TYPES = [
    { value: 'text', label: 'Short Text', icon: Type },
    { value: 'textarea', label: 'Long Text', icon: Layout },
    { value: 'number', label: 'Number', icon: Hash },
    { value: 'date', label: 'Date', icon: Calendar },
    { value: 'boolean', label: 'Toggle/Boolean', icon: CheckSquare },
    { value: 'select', label: 'Dropdown Select', icon: List },
];

interface FactionRecordsProps {
    shortname: string;
    permissions: string[];
    user: any;
}

export default function FactionRecords({ shortname, permissions, user }: FactionRecordsProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [databases, setDatabases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editMode, setEditMode] = useState<any | null>(null);
    const [permissionsModal, setPermissionsModal] = useState<any | null>(null);
    const [selectedDatabase, setSelectedDatabase] = useState<any | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        allow_details_view: true,
        data_overview_display: 'table',
        data_entry_display: 'card',
        record_shortcode: '',
        is_published: false,
        database_structure: [] as any[],
        detail_customization: {
            linked_databases: [] as any[],
            roster_integration: { enabled: false }
        } as any,
    });

    const [modalTab, setModalTab] = useState<'info' | 'structure' | 'customization'>('info');

    const addField = () => {
        setFormData({
            ...formData,
            database_structure: [
                ...formData.database_structure,
                { id: crypto.randomUUID(), name: '', type: 'text', required: false, options: [] }
            ]
        });
    };

    const removeField = (id: string) => {
        setFormData({
            ...formData,
            database_structure: formData.database_structure.filter((f: any) => f.id !== id)
        });
    };

    const updateField = (id: string, data: any) => {
        setFormData({
            ...formData,
            database_structure: formData.database_structure.map((f: any) => f.id === id ? { ...f, ...data } : f)
        });
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        const newStructure = [...formData.database_structure];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newStructure.length) return;
        [newStructure[index], newStructure[targetIndex]] = [newStructure[targetIndex], newStructure[index]];
        setFormData({ ...formData, database_structure: newStructure });
    };

    const canCreate = permissions.includes('create_faction_record_database') || permissions.includes('administrator');
    const isGlobalMod = permissions.includes('global_faction_record_moderation') || permissions.includes('administrator');

    const fetchDatabases = async () => {
        try {
            const res = await api.get(`/factions/${shortname}/records`);
            setDatabases(res.data);

            // Sync with URL
            const dbParam = searchParams.get('database');
            if (dbParam) {
                const targetDb = res.data.find((d: any) => d.record_shortcode === dbParam.toUpperCase() || String(d.id) === dbParam);
                if (targetDb && !selectedDatabase) setSelectedDatabase(targetDb);
            }
        } catch (err) {
            toast.error('Failed to fetch databases');
        } finally {
            setLoading(false);
        }
    };

    const handleSetSelectedDatabase = (db: any | null) => {
        setSelectedDatabase(db);
        const newParams = new URLSearchParams(searchParams);
        if (db) {
            newParams.set('database', db.record_shortcode || db.id);
        } else {
            newParams.delete('database');
            newParams.delete('record'); // Clear record if closing DB
        }
        setSearchParams(newParams, { replace: true });
    };

    useEffect(() => {
        fetchDatabases();
    }, [shortname]);

    useEffect(() => {
        if (databases.length > 0) {
            const dbParam = searchParams.get('database');
            const targetDb = databases.find((d: any) => d.record_shortcode === dbParam?.toUpperCase() || String(d.id) === dbParam);
            if (targetDb) {
                if (selectedDatabase?.id !== targetDb.id) setSelectedDatabase(targetDb);
            } else if (selectedDatabase) {
                setSelectedDatabase(null);
            }
        }
    }, [searchParams, databases]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic validation for structure
        if (formData.database_structure.some((f: any) => !f.name.trim())) {
            toast.error('All fields must have a name');
            return;
        }

        setIsSaving(true);
        const loadToast = toast.loading(editMode ? 'Updating database...' : 'Creating database...');
        try {
            if (editMode) {
                await api.put(`/factions/${shortname}/records/${editMode.id}`, formData);
                toast.success('Database updated', { id: loadToast });
            } else {
                await api.post(`/factions/${shortname}/records`, formData);
                toast.success('Database created', { id: loadToast });
            }
            setShowCreateModal(false);
            setEditMode(null);
            setFormData({
                name: '',
                description: '',
                allow_details_view: true,
                data_overview_display: 'table',
                data_entry_display: 'card',
                record_shortcode: '',
                is_published: false,
                database_structure: [],
                detail_customization: {
                    linked_databases: [],
                    roster_integration: { enabled: false }
                },
            });
            setModalTab('info');
            fetchDatabases();
        } catch (err) {
            toast.error('Failed to save database', { id: loadToast });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (db: any) => {
        setEditMode(db);
        setFormData({
            name: db.name,
            description: db.description || '',
            allow_details_view: db.allow_details_view ?? true,
            data_overview_display: db.data_overview_display,
            data_entry_display: db.data_entry_display,
            record_shortcode: db.record_shortcode || '',
            is_published: db.is_published ?? false,
            database_structure: db.database_structure || [],
            detail_customization: db.detail_customization || {
                linked_databases: [],
                roster_integration: { enabled: false }
            },
        });
        setModalTab('info');
        setShowCreateModal(true);
    };

    const handleDelete = async (id: number) => {
        toast((t) => (
            <div className="flex flex-col gap-1 text-left">
                <p className="font-bold text-xs uppercase">Delete this database?</p>
                <p className="text-[9px] opacity-80 uppercase tracking-tighter">All entries will be lost. This action cannot be undone.</p>
                <div className="flex gap-2 justify-end mt-2">
                    <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1 bg-surface hover:bg-bg border border-border rounded text-[9px] font-bold uppercase transition">Cancel</button>
                    <button 
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const loadToast = toast.loading('Deleting database...');
                            try {
                                await api.delete(`/factions/${shortname}/records/${id}`);
                                toast.success('Database deleted', { id: loadToast });
                                fetchDatabases();
                            } catch (err) {
                                toast.error('Failed to delete database', { id: loadToast });
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

    if (loading) return <Loading message="Loading Records..." />;

    if (selectedDatabase) {
        return (
            <RecordBrowser 
                database={selectedDatabase}
                shortname={shortname}
                permissions={permissions}
                user={user}
                onBack={() => handleSetSelectedDatabase(null)}
            />
        );
    }

    const filteredDatabases = databases.filter(db => 
        db.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        db.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter text-text flex items-center gap-3">
                        <Database className="text-accent" size={24} />
                        Faction Records
                    </h1>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">
                        Manage and browse faction databases and records
                    </p>
                </div>

                {canCreate && (
                    <button 
                        onClick={() => {
                            setEditMode(null);
                            setFormData({
                                name: '',
                                description: '',
                                allow_details_view: true,
                                data_overview_display: 'table',
                                data_entry_display: 'card',
                                record_shortcode: '',
                                is_published: false,
                                database_structure: [],
                                detail_customization: {
                                    linked_databases: [],
                                    roster_integration: { enabled: false }
                                },
                            });
                            setModalTab('info');
                            setShowCreateModal(true);
                        }}
                        className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded font-bold text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-accent/20"
                    >
                        <Plus size={14} />
                        Create Database
                    </button>
                )}
            </header>

            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <input 
                    type="text"
                    placeholder="Search databases..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-card border border-border p-4 pl-12 rounded-lg text-sm text-text focus:border-accent outline-none transition shadow-sm"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDatabases.map(db => (
                    <div key={db.id} className="bg-card border border-border rounded-xl overflow-hidden group hover:border-accent/50 transition-all flex flex-col shadow-sm hover:shadow-xl hover:shadow-accent/5">
                        <div className="p-6 flex-1">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-accent/10 rounded-lg text-accent">
                                        <Database size={20} />
                                    </div>
                                    {db.is_api_database && (
                                        <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[7px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                                            API Synchronized
                                        </div>
                                    )}
                                </div>
                                        {isGlobalMod && (
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => setPermissionsModal(db)}
                                            className="p-2 text-muted hover:text-accent transition-colors"
                                            title="Database Permissions"
                                        >
                                            <Shield size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleEdit(db)}
                                            className="p-2 text-muted hover:text-accent transition-colors"
                                            title="Database Settings"
                                        >
                                            <Settings2 size={16} />
                                        </button>
                                        {(!db.is_api_database || user?.is_superadmin) && (
                                            <button 
                                                onClick={() => handleDelete(db.id)}
                                                className="p-2 text-muted hover:text-danger transition-colors"
                                                title="Delete Database"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-text mb-2 group-hover:text-accent transition-colors">
                                {db.name}
                            </h3>
                            <p className="text-sm text-muted line-clamp-2 mb-6">
                                {db.description || 'No description provided.'}
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-widest">
                                    <Layout size={12} className="opacity-50" />
                                    <span>{db.data_overview_display}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-widest">
                                    <Info size={12} className="opacity-50" />
                                    <span>{db.record_shortcode || 'NO PREFIX'}</span>
                                </div>
                            </div>
                            
                            {db.is_published && (
                                <div className="mt-4 flex items-center gap-2 px-2 py-1 bg-accent/10 border border-accent/20 rounded text-[8px] font-black text-accent uppercase tracking-widest w-fit">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                    Published to Roster
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-surface border-t border-border flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
                                    {db.creator?.username?.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                                    {db.creator?.username}
                                </span>
                            </div>
                            <Link 
                                to={`/${shortname}/records?database=${db.record_shortcode || db.id}`}
                                className="px-3 py-1.5 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded text-[9px] font-black uppercase tracking-widest transition-all"
                            >
                                Open Database
                            </Link>
                        </div>
                    </div>
                ))}

                {filteredDatabases.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl bg-card/30">
                        <Database size={48} className="text-muted opacity-20 mb-4" />
                        <p className="text-sm font-bold text-muted uppercase tracking-widest">No databases found</p>
                    </div>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
                    <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-surface shrink-0">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {editMode ? <Settings2 size={20} className="text-accent" /> : <Plus size={20} className="text-accent" />}
                                {editMode ? 'Edit Database Settings' : 'Create New Database'}
                            </h2>
                            <button onClick={() => { setShowCreateModal(false); setEditMode(null); }} className="text-muted hover:text-text">&times;</button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="flex bg-surface border-b border-border shrink-0">
                            <button 
                                type="button"
                                onClick={() => setModalTab('info')}
                                className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${modalTab === 'info' ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-muted hover:text-text'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Info size={14} /> Basic Settings
                                </div>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setModalTab('structure')}
                                className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${modalTab === 'structure' ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-muted hover:text-text'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Columns size={14} /> Structure
                                </div>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setModalTab('customization')}
                                className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${modalTab === 'customization' ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-muted hover:text-text'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Settings size={14} /> Detail Customization
                                </div>
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreate} className="p-6 space-y-8 overflow-y-auto">
                            {modalTab === 'info' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Database Name</label>
                                            <input 
                                                required
                                                disabled={editMode?.is_api_database && !user?.is_superadmin}
                                                type="text"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full bg-surface border border-border p-3 rounded-lg text-sm text-text focus:border-accent outline-none transition disabled:opacity-50"
                                                placeholder="e.g. Personnel Profiles"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Description</label>
                                            <textarea 
                                                disabled={editMode?.is_api_database && !user?.is_superadmin}
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full bg-surface border border-border p-3 rounded-lg text-sm text-text focus:border-accent outline-none transition min-h-[80px] disabled:opacity-50"
                                                placeholder="Describe the purpose of this database..."
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Record Prefix</label>
                                                <input 
                                                    type="text"
                                                    value={formData.record_shortcode}
                                                    onChange={e => setFormData({ ...formData, record_shortcode: e.target.value.toUpperCase() })}
                                                    className="w-full bg-surface border border-border p-3 rounded-lg text-sm text-text focus:border-accent outline-none transition uppercase"
                                                    placeholder="e.g. PRF"
                                                    maxLength={10}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Overview View</label>
                                                <select 
                                                    value={formData.data_overview_display}
                                                    onChange={e => setFormData({ ...formData, data_overview_display: e.target.value })}
                                                    className="w-full bg-surface border border-border p-3 rounded-lg text-sm text-text focus:border-accent outline-none transition"
                                                >
                                                    <option value="table">Full Table</option>
                                                    <option value="compact">Compact Table</option>
                                                    <option value="cards">Standard Cards</option>
                                                    <option value="detailed">Detailed Cards</option>
                                                    <option value="rows">Row List</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Detail Template</label>
                                                <select 
                                                    value={formData.data_entry_display}
                                                    onChange={e => setFormData({ ...formData, data_entry_display: e.target.value })}
                                                    className="w-full bg-surface border border-border p-3 rounded-lg text-sm text-text focus:border-accent outline-none transition"
                                                >
                                                    <option value="card">Standard Card</option>
                                                    <option value="profile">Profile Page</option>
                                                    <option value="dossier">Formal Dossier</option>
                                                    <option value="split">Split Layout</option>
                                                    <option value="minimal">Minimalist</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <label className="flex items-center gap-3 cursor-pointer group p-3 bg-surface border border-border rounded-lg hover:border-accent transition-all">
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.allow_details_view}
                                                    onChange={e => setFormData({ ...formData, allow_details_view: e.target.checked })}
                                                    className="hidden"
                                                />
                                                <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${formData.allow_details_view ? 'bg-accent border-accent' : 'bg-card border-border group-hover:border-accent'}`}>
                                                    {formData.allow_details_view && <X size={14} className="text-white rotate-45" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-text uppercase tracking-widest">Allow Entry Details View</span>
                                                    <span className="text-[9px] text-muted font-bold uppercase tracking-widest">Allow members to click records for details.</span>
                                                </div>
                                            </label>

                                            <label className="flex items-center gap-3 cursor-pointer group p-3 bg-surface border border-border rounded-lg hover:border-accent transition-all">
                                                <input 
                                                    type="checkbox"
                                                    checked={formData.is_published}
                                                    onChange={e => setFormData({ ...formData, is_published: e.target.checked })}
                                                    className="hidden"
                                                />
                                                <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${formData.is_published ? 'bg-accent border-accent' : 'bg-card border-border group-hover:border-accent'}`}>
                                                    {formData.is_published && <X size={14} className="text-white rotate-45" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-text uppercase tracking-widest">Publish to Roster</span>
                                                    <span className="text-[9px] text-muted font-bold uppercase tracking-widest">Allow linking this database to roster datasets.</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {modalTab === 'structure' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Columns size={12} /> Database Structure
                                        </h3>
                                        {(!editMode?.is_api_database || user?.is_superadmin) && (
                                            <button 
                                                type="button"
                                                onClick={addField}
                                                className="text-[9px] font-black uppercase tracking-widest bg-accent/10 text-accent hover:bg-accent hover:text-white px-2 py-1 rounded transition-all flex items-center gap-1"
                                            >
                                                <Plus size={10} /> Add Field
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {formData.database_structure.map((field, idx) => (
                                            <div key={field.id} className="bg-surface border border-border p-4 rounded-xl space-y-4 group/field relative">
                                                <div className="flex items-center gap-3">
                                                    {(!editMode?.is_api_database || user?.is_superadmin) && (
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => moveField(idx, 'up')} className="text-muted hover:text-accent disabled:opacity-0" disabled={idx === 0}><ChevronUp size={14} /></button>
                                                            <button type="button" onClick={() => moveField(idx, 'down')} className="text-muted hover:text-accent disabled:opacity-0" disabled={idx === formData.database_structure.length - 1}><ChevronDown size={14} /></button>
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <input 
                                                            disabled={editMode?.is_api_database && !user?.is_superadmin}
                                                            value={field.name}
                                                            onChange={e => updateField(field.id, { name: e.target.value })}
                                                            placeholder="Field Name (e.g. Callsign)"
                                                            className="w-full bg-transparent border-none p-0 text-sm font-bold text-text focus:ring-0 outline-none placeholder:text-muted/40 disabled:opacity-50"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <select 
                                                            disabled={editMode?.is_api_database && !user?.is_superadmin}
                                                            value={field.type}
                                                            onChange={e => updateField(field.id, { type: e.target.value })}
                                                            className="bg-card border border-border rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted focus:border-accent outline-none cursor-pointer disabled:opacity-50"
                                                        >
                                                            {FIELD_TYPES.map(t => (
                                                                <option key={t.value} value={t.value}>{t.label}</option>
                                                            ))}
                                                        </select>
                                                        {(!editMode?.is_api_database || user?.is_superadmin) && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => removeField(field.id)}
                                                                className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6 pt-2 border-t border-border/50">
                                                    <label className={`flex items-center gap-2 ${(editMode?.is_api_database && !user?.is_superadmin) ? 'cursor-default' : 'cursor-pointer'} group`}>
                                                        <input 
                                                            disabled={editMode?.is_api_database && !user?.is_superadmin}
                                                            type="checkbox"
                                                            checked={field.required}
                                                            onChange={e => updateField(field.id, { required: e.target.checked })}
                                                            className="hidden"
                                                        />
                                                        <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${field.required ? 'bg-accent border-accent' : 'border-muted group-hover:border-accent'} ${(editMode?.is_api_database && !user?.is_superadmin) ? 'opacity-50' : ''}`}>
                                                            {field.required && <X size={10} className="text-white rotate-45" />}
                                                        </div>
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted group-hover:text-accent transition-colors">Required Field</span>
                                                    </label>
                                                </div>

                                                {field.type === 'select' && (
                                                    <div className="pt-2">
                                                        <label className="block text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-2">Options (Comma separated)</label>
                                                        <input 
                                                            disabled={editMode?.is_api_database && !user?.is_superadmin}
                                                            value={field.options?.join(', ') || ''}
                                                            onChange={e => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                            className="w-full bg-card border border-border p-2 rounded text-[10px] text-text focus:border-accent outline-none disabled:opacity-50"
                                                            placeholder="Option 1, Option 2, Option 3"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {formData.database_structure.length === 0 && (
                                            <div className="py-8 flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-surface/50">
                                                <Columns size={24} className="text-muted opacity-20 mb-2" />
                                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">No fields defined yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {modalTab === 'customization' && (
                                <div className="space-y-10">
                                    {/* Showcase Field Section */}
                                    <div className="space-y-4 pb-6 border-b border-border">
                                        <div>
                                            <h3 className="text-xs font-black text-text uppercase tracking-widest flex items-center gap-2">
                                                <Layout size={14} className="text-accent" /> Profile Showcase Field
                                            </h3>
                                            <p className="text-[9px] text-muted font-bold uppercase tracking-widest mt-1">Choose which database field is displayed as the primary name/avatar header in the profile detail view.</p>
                                        </div>
                                        <select 
                                            value={formData.detail_customization?.showcase_field || ''}
                                            onChange={e => setFormData({
                                                ...formData,
                                                detail_customization: {
                                                    ...formData.detail_customization,
                                                    showcase_field: e.target.value || null
                                                }
                                            })}
                                            className="w-full bg-surface border border-border p-3 rounded-lg text-sm text-text focus:border-accent outline-none transition"
                                        >
                                            <option value="">Default (First Field)</option>
                                            {formData.database_structure.map((field: any) => (
                                                <option key={field.id} value={field.id}>{field.name || 'Unnamed Field'}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Linked Databases Section */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-xs font-black text-text uppercase tracking-widest flex items-center gap-2">
                                                    <LinkIcon size={14} className="text-accent" /> Linked Records
                                                </h3>
                                                <p className="text-[9px] text-muted font-bold uppercase tracking-widest mt-1">Display entries from other databases that match this record.</p>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const current = formData.detail_customization.linked_databases || [];
                                                    setFormData({
                                                        ...formData,
                                                        detail_customization: {
                                                            ...formData.detail_customization,
                                                            linked_databases: [...current, { id: crypto.randomUUID(), database_id: '', source_field: '', target_field: '' }]
                                                        }
                                                    });
                                                }}
                                                className="text-[9px] font-black uppercase tracking-widest bg-accent text-white hover:bg-accent/90 px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-accent/20"
                                            >
                                                <Plus size={12} /> Add Link
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {(formData.detail_customization.linked_databases || []).map((link: any, idx: number) => (
                                                <div key={link.id || idx} className="bg-surface border border-border p-4 rounded-xl space-y-4 relative group/link">
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const next = formData.detail_customization.linked_databases.filter((_: any, i: number) => i !== idx);
                                                            setFormData({ ...formData, detail_customization: { ...formData.detail_customization, linked_databases: next } });
                                                        }}
                                                        className="absolute top-2 right-2 p-1.5 text-muted hover:text-danger opacity-0 group-hover/link:opacity-100 transition-all"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div>
                                                            <label className="block text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1.5">Target Database</label>
                                                            <select 
                                                                value={link.database_id}
                                                                onChange={e => {
                                                                    const next = [...formData.detail_customization.linked_databases];
                                                                    next[idx].database_id = e.target.value;
                                                                    next[idx].target_field = ''; // Reset target field when DB changes
                                                                    setFormData({ ...formData, detail_customization: { ...formData.detail_customization, linked_databases: next } });
                                                                }}
                                                                className="w-full bg-card border border-border p-2.5 rounded-lg text-[10px] font-bold uppercase focus:border-accent outline-none"
                                                            >
                                                                <option value="">Select Database...</option>
                                                                {editMode && <option value={editMode.id} className="text-accent font-black text-xs">-- Current Database --</option>}
                                                                {databases.filter(d => d.id !== editMode?.id).map(db => (
                                                                    <option key={db.id} value={db.id}>{db.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1.5">Matching Logic (Source)</label>
                                                            <select 
                                                                value={link.source_field}
                                                                onChange={e => {
                                                                    const next = [...formData.detail_customization.linked_databases];
                                                                    next[idx].source_field = e.target.value;
                                                                    setFormData({ ...formData, detail_customization: { ...formData.detail_customization, linked_databases: next } });
                                                                }}
                                                                className="w-full bg-card border border-border p-2.5 rounded-lg text-[10px] font-bold uppercase focus:border-accent outline-none"
                                                            >
                                                                <option value="">Select Field...</option>
                                                                <option value="id">SYSTEM ID</option>
                                                                {formData.database_structure.map(f => (
                                                                    <option key={f.id} value={f.id}>{f.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1.5">Matching Logic (Target)</label>
                                                            <select 
                                                                disabled={!link.database_id}
                                                                value={link.target_field}
                                                                onChange={e => {
                                                                    const next = [...formData.detail_customization.linked_databases];
                                                                    next[idx].target_field = e.target.value;
                                                                    setFormData({ ...formData, detail_customization: { ...formData.detail_customization, linked_databases: next } });
                                                                }}
                                                                className="w-full bg-card border border-border p-2.5 rounded-lg text-[10px] font-bold uppercase focus:border-accent outline-none disabled:opacity-50"
                                                            >
                                                                <option value="">Select Field...</option>
                                                                {(() => {
                                                                    const targetDb = databases.find(d => String(d.id) === String(link.database_id));
                                                                    const structure = targetDb ? targetDb.database_structure : (String(link.database_id) === String(editMode?.id) ? formData.database_structure : []);
                                                                    return structure?.map((f: any) => (
                                                                        <option key={f.id} value={f.id}>{f.name}</option>
                                                                    ));
                                                                })()}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {link.database_id && (
                                                        <div className="pt-2">
                                                            <label className="block text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-2">Display Fields</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(() => {
                                                                    const targetDb = databases.find(d => String(d.id) === String(link.database_id));
                                                                    const structure = targetDb ? targetDb.database_structure : (String(link.database_id) === String(editMode?.id) ? formData.database_structure : []);
                                                                    return structure?.map((f: any) => (
                                                                        <button
                                                                            key={f.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const next = [...formData.detail_customization.linked_databases];
                                                                                const currentFields = next[idx].display_fields || [];
                                                                                if (currentFields.includes(f.id)) {
                                                                                    next[idx].display_fields = currentFields.filter((id: string) => id !== f.id);
                                                                                } else {
                                                                                    next[idx].display_fields = [...currentFields, f.id];
                                                                                }
                                                                                setFormData({ ...formData, detail_customization: { ...formData.detail_customization, linked_databases: next } });
                                                                            }}
                                                                            className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border transition-all ${
                                                                                (link.display_fields || []).includes(f.id)
                                                                                    ? 'bg-accent border-accent text-white'
                                                                                    : 'bg-card border-border text-muted hover:border-accent hover:text-accent'
                                                                            }`}
                                                                        >
                                                                            {f.name}
                                                                        </button>
                                                                    ));
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="pt-2 flex items-center gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer group">
                                                            <input 
                                                                type="checkbox"
                                                                checked={link.exclude_current}
                                                                onChange={e => {
                                                                    const next = [...formData.detail_customization.linked_databases];
                                                                    next[idx].exclude_current = e.target.checked;
                                                                    setFormData({ ...formData, detail_customization: { ...formData.detail_customization, linked_databases: next } });
                                                                }}
                                                                className="hidden"
                                                            />
                                                            <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${link.exclude_current ? 'bg-accent border-accent' : 'border-muted group-hover:border-accent'}`}>
                                                                {link.exclude_current && <X size={10} className="text-white rotate-45" />}
                                                            </div>
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted group-hover:text-accent transition-colors">Exclude currently opened record</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            {(!formData.detail_customization.linked_databases || formData.detail_customization.linked_databases.length === 0) && (
                                                <div className="py-12 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center bg-surface/30">
                                                    <LinkIcon size={32} className="text-muted opacity-20 mb-3" />
                                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">No record links configured</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Roster Integration Section */}
                                    <div className="space-y-6 pt-6 border-t border-border">
                                        <div>
                                            <h3 className="text-xs font-black text-text uppercase tracking-widest flex items-center gap-2">
                                                <Share2 size={14} className="text-accent" /> Roster Integration
                                            </h3>
                                            <p className="text-[9px] text-muted font-bold uppercase tracking-widest mt-1">Automatically track and display which rosters this record appears in.</p>
                                        </div>

                                        <label className="flex items-center gap-3 cursor-pointer group p-4 bg-surface border border-border rounded-xl hover:border-accent transition-all">
                                            <input 
                                                type="checkbox"
                                                checked={formData.detail_customization.roster_integration?.enabled}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    detail_customization: {
                                                        ...formData.detail_customization,
                                                        roster_integration: { ...formData.detail_customization.roster_integration, enabled: e.target.checked }
                                                    }
                                                })}
                                                className="hidden"
                                            />
                                            <div className={`w-6 h-6 rounded border transition-all flex items-center justify-center ${formData.detail_customization.roster_integration?.enabled ? 'bg-accent border-accent shadow-lg shadow-accent/20' : 'bg-card border-border group-hover:border-accent'}`}>
                                                {formData.detail_customization.roster_integration?.enabled && <CheckSquare size={14} className="text-white" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-text uppercase tracking-widest">Enable Roster Tracking</span>
                                                <span className="text-[9px] text-muted font-bold uppercase tracking-widest">Display linked roster rows in the record detail view.</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 sticky bottom-0 bg-card py-4 border-t border-border shrink-0 mt-auto">
                                <button 
                                    type="button" 
                                    onClick={() => { setShowCreateModal(false); setEditMode(null); }}
                                    className="flex-1 px-4 py-3 bg-surface hover:bg-border border border-border text-text rounded-lg font-bold text-xs uppercase tracking-widest transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded-lg font-bold text-xs uppercase tracking-widest transition disabled:opacity-50 shadow-lg shadow-accent/20"
                                >
                                    {isSaving ? 'Saving...' : (editMode ? 'Save Settings' : 'Create Database')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {permissionsModal && (
                <RecordPermissionsModal 
                    database={permissionsModal}
                    shortname={shortname!}
                    onClose={() => setPermissionsModal(null)}
                />
            )}
        </div>
    );
}

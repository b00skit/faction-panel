import React, { useState, useEffect } from 'react';
import { X, Shield, Users, Plus, Trash2, Check, Info, Award, Crown } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { Group, Role, KanbanProject } from '../types';

interface KanbanPermissionsModalProps {
    project: KanbanProject;
    shortname: string;
    onClose: () => void;
    onProjectUpdated?: () => void;
}

const AVAILABLE_PERMISSIONS = [
    { key: 'view_project', name: 'View Board', description: 'Basic visibility of this Kanban board' },
    { key: 'add_card', name: 'Add Cards', description: 'Ability to create new cards inside status columns' },
    { key: 'modify_card', name: 'Modify Cards', description: 'Move, edit description, assign, label, checklist, archive, or delete cards' },
    { key: 'view_card_details', name: 'View Details', description: 'Open the details sidebar/modal for any card' },
    { key: 'manage_statuses', name: 'Manage Columns', description: 'Add, delete, or rename columns/statuses' },
    { key: 'manage_labels', name: 'Manage Labels', description: 'Manage tags and labels that can be attached to cards' },
    { key: 'modify_project', name: 'Modify Project', description: 'Edit name, color, prefix, and basic project details' },
];

export const KanbanPermissionsModal: React.FC<KanbanPermissionsModalProps> = ({ project, shortname, onClose, onProjectUpdated }) => {
    const [permissions, setPermissions] = useState<any[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [factionMembers, setFactionMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddTarget, setShowAddTarget] = useState(false);
    const [currentOwnerId, setCurrentOwnerId] = useState<number | null>(project.created_by);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [permRes, groupRes, roleRes, memberRes] = await Promise.all([
                api.get(`/kanban/projects/${project.id}/permissions`),
                api.get(`/factions/${shortname}/groups`),
                api.get(`/factions/${shortname}/roles`),
                api.get(`/factions/${shortname}/users`)
            ]);
            setPermissions(permRes.data);
            setGroups(groupRes.data);
            setRoles(roleRes.data);
            setFactionMembers(Array.isArray(memberRes.data) ? memberRes.data : (memberRes.data.data || []));
        } catch (err) {
            toast.error('Failed to load permissions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [project.id]);

    const handleTogglePermission = async (groupId: number | null, roleId: number | null, permKey: string) => {
        const entry = permissions.find(p => p.group_id === groupId && p.role_id === roleId);
        let newPerms: string[] = [];

        if (entry) {
            newPerms = entry.permissions.includes(permKey)
                ? entry.permissions.filter(p => p !== permKey)
                : [...entry.permissions, permKey];
        } else {
            newPerms = [permKey];
        }

        const loadToast = toast.loading('Updating permission...');
        try {
            const res = await api.put(`/kanban/projects/${project.id}/permissions`, {
                group_id: groupId,
                role_id: roleId,
                permissions: newPerms
            });
            
            setPermissions(prev => {
                const index = prev.findIndex(p => p.group_id === groupId && p.role_id === roleId);
                if (index > -1) {
                    const updated = [...prev];
                    updated[index] = res.data;
                    return updated;
                }
                return [...prev, res.data];
            });
            toast.success('Permission updated', { id: loadToast });
        } catch (err) {
            toast.error('Failed to update permission', { id: loadToast });
        }
    };

    const handleSelectAll = async (groupId: number | null, roleId: number | null) => {
        const allPerms = AVAILABLE_PERMISSIONS.map(p => p.key);
        const loadToast = toast.loading('Updating permissions...');
        try {
            const res = await api.put(`/kanban/projects/${project.id}/permissions`, {
                group_id: groupId,
                role_id: roleId,
                permissions: allPerms
            });
            
            setPermissions(prev => {
                const index = prev.findIndex(p => p.group_id === groupId && p.role_id === roleId);
                if (index > -1) {
                    const updated = [...prev];
                    updated[index] = res.data;
                    return updated;
                }
                return [...prev, res.data];
            });
            toast.success('All permissions granted', { id: loadToast });
        } catch (err) {
            toast.error('Failed to update permissions', { id: loadToast });
        }
    };

    const handleUpdateOwner = async (ownerId: number | null) => {
        const loadToast = toast.loading('Updating owner...');
        try {
            await api.put(`/kanban/projects/${project.id}`, {
                created_by: ownerId
            });
            setCurrentOwnerId(ownerId);
            toast.success(ownerId === null ? 'Board is now faction-owned' : 'Owner updated successfully', { id: loadToast });
            if (onProjectUpdated) {
                onProjectUpdated();
            }
        } catch (err) {
            toast.error('Failed to update owner', { id: loadToast });
        }
    };

    const handleRemoveEntry = async (id: number) => {
        const loadToast = toast.loading('Removing entry...');
        try {
            await api.delete(`/kanban/projects/${project.id}/permissions/${id}`);
            setPermissions(prev => prev.filter(p => p.id !== id));
            toast.success('Permission entry removed', { id: loadToast });
        } catch (err) {
            toast.error('Failed to remove permission', { id: loadToast });
        }
    };

    const handleAddTarget = async (groupId: number | null, roleId: number | null) => {
        if (permissions.some(p => p.group_id === groupId && p.role_id === roleId)) {
            toast.error('This target already has a permission entry');
            return;
        }

        const loadToast = toast.loading('Adding target...');
        try {
            const res = await api.put(`/kanban/projects/${project.id}/permissions`, {
                group_id: groupId,
                role_id: roleId,
                permissions: ['view_project']
            });
            setPermissions([...permissions, res.data]);
            setShowAddTarget(false);
            toast.success(groupId === null && roleId === null ? 'Public access added' : 'Target added', { id: loadToast });
        } catch (err) {
            toast.error('Failed to add target', { id: loadToast });
        }
    };

    if (loading) return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
            <div className="bg-card p-12 rounded-2xl border border-border shadow-2xl flex flex-col items-center max-h-[90vh] overflow-y-auto">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Loading Permissions...</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
            <div className="bg-card rounded-2xl max-w-4xl w-full border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <Shield className="text-accent" size={24} />
                            Board Permissions: <span style={{ color: project.color }}>{project.name}</span>
                        </h2>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1 opacity-60">Manage who can view and modify this Kanban board</p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-text transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex gap-4 items-start h-fit">
                            <Info className="text-accent shrink-0" size={20} />
                            <div className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                <p className="text-accent mb-1">Automatic Access:</p>
                                <p className="opacity-80">Global Kanban Board Moderators and the Board Creator always have full administrative access regardless of these settings.</p>
                            </div>
                        </div>

                        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-accent">
                                <Crown size={18} />
                                <h3 className="text-[11px] font-black uppercase tracking-widest">Ownership & Management</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-2 px-1">Current Owner</p>
                                    <div className="flex gap-2">
                                        <select 
                                            value={currentOwnerId || ''} 
                                            onChange={(e) => handleUpdateOwner(e.target.value ? parseInt(e.target.value) : null)}
                                            className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-accent transition-colors"
                                        >
                                            <option value="">Faction Owned (No Individual Creator)</option>
                                            {factionMembers.map(member => (
                                                <option key={member.id} value={member.id}>{member.username}</option>
                                            ))}
                                        </select>
                                        <button 
                                            onClick={() => handleUpdateOwner(null)}
                                            className="px-3 py-2 bg-surface hover:bg-accent/10 border border-border hover:border-accent text-muted hover:text-accent rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                                            title="Set as Faction Owned"
                                        >
                                            Factionize
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted">Permission Matrix</h3>
                            <button 
                                onClick={() => setShowAddTarget(!showAddTarget)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                                    showAddTarget ? 'bg-accent text-white' : 'bg-surface hover:bg-accent/10 text-muted hover:text-accent border border-border'
                                }`}
                            >
                                <Plus size={14} /> Add Target
                            </button>
                        </div>

                        {showAddTarget && (
                            <div className="bg-surface border border-border rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                {!permissions.some(p => p.group_id === null && p.role_id === null) && (
                                    <button 
                                        onClick={() => handleAddTarget(null, null)}
                                        className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:border-accent transition-all text-left group w-fit cursor-pointer"
                                    >
                                        <Users size={16} className="text-muted group-hover:text-accent" />
                                        <div className="text-[10px] font-black uppercase tracking-widest text-text">Everyone / Public</div>
                                    </button>
                                )}
                                
                                <div className="space-y-2">
                                    <div className="text-[8px] font-black uppercase tracking-[0.2em] text-muted px-1">Faction Groups</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {groups.filter(g => !permissions.some(p => p.group_id === g.id)).map(group => (
                                            <button 
                                                key={group.id}
                                                onClick={() => handleAddTarget(group.id, null)}
                                                className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:border-accent transition-all text-left cursor-pointer"
                                            >
                                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: group.color }} />
                                                <div className="text-[10px] font-black uppercase tracking-widest truncate text-text">{group.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-[8px] font-black uppercase tracking-[0.2em] text-muted px-1">Site Roles</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {roles.filter(r => r.name.toLowerCase() !== 'public' && !permissions.some(p => p.role_id === r.id)).map(role => (
                                            <button
                                                key={role.id}
                                                onClick={() => handleAddTarget(null, role.id)}
                                                className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:border-accent transition-all text-left cursor-pointer"
                                            >
                                                <Award size={16} className="text-muted" style={{ color: role.color }} />
                                                <div className="text-[10px] font-black uppercase tracking-widest truncate text-text">{role.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="overflow-x-auto border border-border rounded-xl">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-surface/50">
                                        <th className="text-left py-4 px-6 text-[9px] font-black uppercase tracking-widest text-muted border-b border-border">Target</th>
                                        {AVAILABLE_PERMISSIONS.map(p => (
                                            <th key={p.key} className="text-center py-4 px-2 text-[9px] font-black uppercase tracking-widest text-muted border-b border-border whitespace-nowrap group relative">
                                                <div className="cursor-help">{p.name}</div>
                                                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-black text-white p-3 rounded-lg text-[9px] font-bold uppercase tracking-widest w-40 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10 shadow-2xl border border-white/10 scale-95 group-hover:scale-100">
                                                    {p.description}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-black" />
                                                </div>
                                            </th>
                                        ))}
                                        <th className="py-4 px-6 border-b border-border"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-card/20">
                                    {permissions.map(entry => {
                                        const isPublicEntry = entry.group_id === null && entry.role_id === null;
                                        const group = groups.find(g => g.id === entry.group_id);
                                        const role = roles.find(r => r.id === entry.role_id);
                                        
                                        return (
                                            <tr key={entry.id} className="hover:bg-surface/30 transition-colors">
                                                <td className="py-4 px-6 border-b border-border">
                                                    <div className="flex items-center gap-2">
                                                        {isPublicEntry ? (
                                                            <Users size={16} className="text-muted" />
                                                        ) : entry.role_id ? (
                                                            <Award size={16} className="text-muted" style={{ color: role?.color }} />
                                                        ) : (
                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group?.color }} />
                                                        )}
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-light">
                                                            {isPublicEntry ? 'Everyone / Public' : (entry.role_id ? role?.name : group?.name)}
                                                        </span>
                                                    </div>
                                                </td>
                                                {AVAILABLE_PERMISSIONS.map(p => {
                                                    const hasPerm = entry.permissions.includes(p.key);
                                                    return (
                                                        <td key={p.key} className="py-4 px-2 text-center border-b border-border">
                                                            <button
                                                                onClick={() => handleTogglePermission(entry.group_id, entry.role_id, p.key)}
                                                                className={`inline-flex w-5 h-5 rounded border items-center justify-center transition-colors cursor-pointer ${
                                                                    hasPerm 
                                                                        ? 'bg-accent border-accent text-white' 
                                                                        : 'border-border bg-card hover:bg-surface'
                                                                }`}
                                                            >
                                                                {hasPerm && <Check size={12} strokeWidth={3} />}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-4 px-6 text-right border-b border-border">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <button 
                                                            onClick={() => handleSelectAll(entry.group_id, entry.role_id)}
                                                            className="text-[8px] font-black uppercase tracking-widest bg-surface border border-border hover:border-accent text-muted hover:text-accent px-2 py-1.5 rounded transition-all cursor-pointer"
                                                        >
                                                            Select All
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRemoveEntry(entry.id)}
                                                            className="text-muted hover:text-danger p-1.5 hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {permissions.length === 0 && (
                                        <tr>
                                            <td colSpan={AVAILABLE_PERMISSIONS.length + 2} className="py-8 px-6 text-center border-b border-border">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted">No explicit overrides. Click Add Target above to start.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

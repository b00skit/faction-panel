import React, { useState, useEffect } from 'react';
import { X, Shield, Users, Plus, Trash2, Check, Info, Award, User, Crown } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { StatisticsModel, StatisticsPermission, Group, Role } from '../types';

interface StatisticsPermissionsModalProps {
    model: StatisticsModel;
    shortname: string;
    onClose: () => void;
}

const AVAILABLE_PERMISSIONS = [
    { key: 'view_statistics', name: 'View Statistics', description: 'Can view this specific statistics model' },
    { key: 'modify_statistics', name: 'Modify Statistics', description: 'Can change configuration and name' },
    { key: 'delete_statistics', name: 'Delete Statistics', description: 'Can delete this statistics model' },
];

export const StatisticsPermissionsModal: React.FC<StatisticsPermissionsModalProps> = ({ model, shortname, onClose }) => {
    const [permissions, setPermissions] = useState<StatisticsPermission[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [factionMembers, setFactionMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddTarget, setShowAddTarget] = useState(false);
    const [currentOwnerId, setCurrentOwnerId] = useState<number | null>(model.created_by);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [permRes, groupRes, roleRes, memberRes] = await Promise.allSettled([
                api.get(`/statistics/${model.id}/permissions`),
                api.get(`/factions/${shortname}/groups`),
                api.get(`/factions/${shortname}/roles`),
                api.get(`/factions/${shortname}/users`)
            ]);
            if (permRes.status === 'fulfilled') setPermissions(permRes.value.data);
            else toast.error('Failed to load statistics model permissions');

            if (groupRes.status === 'fulfilled') setGroups(groupRes.value.data);
            if (roleRes.status === 'fulfilled') setRoles(roleRes.value.data);
            if (memberRes.status === 'fulfilled') {
                const data = memberRes.value.data;
                setFactionMembers(Array.isArray(data) ? data : (data.data || []));
            }
        } catch (err) {
            toast.error('Failed to load permissions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [model.id]);

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
            const res = await api.put(`/statistics/${model.id}/permissions`, {
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
            const res = await api.put(`/statistics/${model.id}/permissions`, {
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
            await api.put(`/statistics/${model.id}`, {
                created_by: ownerId
            });
            setCurrentOwnerId(ownerId);
            toast.success(ownerId === null ? 'Model is now faction-owned' : 'Owner updated successfully', { id: loadToast });
        } catch (err) {
            toast.error('Failed to update owner', { id: loadToast });
        }
    };

    const handleRemoveEntry = async (id: number) => {
        const loadToast = toast.loading('Removing entry...');
        try {
            await api.delete(`/statistics/${model.id}/permissions/${id}`);
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
            const res = await api.put(`/statistics/${model.id}/permissions`, {
                group_id: groupId,
                role_id: roleId,
                permissions: ['view_statistics']
            });
            setPermissions([...permissions, res.data]);
            setShowAddTarget(false);
            toast.success('Target added', { id: loadToast });
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
                            Statistics Permissions: {model.name}
                        </h2>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1 opacity-60">Manage access to this statistics model</p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-text transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex gap-4 items-start h-fit">
                            <Info className="text-accent shrink-0" size={20} />
                            <div className="text-[10px] font-bold uppercase tracking-widest leading-relaxed text-accent">
                                Global Moderators and the Model Creator always have full access.
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
                                            className="px-3 py-2 bg-surface hover:bg-accent/10 border border-border hover:border-accent text-muted hover:text-accent rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
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
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                    showAddTarget ? 'bg-accent text-white' : 'bg-surface hover:bg-accent/10 text-muted hover:text-accent border border-border'
                                }`}
                            >
                                <Plus size={14} /> Add Target
                            </button>
                        </div>

                        {showAddTarget && (
                            <div className="bg-surface border border-border rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {!permissions.some(p => p.group_id === null && p.role_id === null) && (
                                        <button 
                                            onClick={() => handleAddTarget(null, null)}
                                            className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:border-accent transition-all text-left"
                                        >
                                            <Users size={16} className="text-muted" />
                                            <div className="text-[10px] font-black uppercase tracking-widest">Public</div>
                                        </button>
                                    )}
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="text-[8px] font-black uppercase tracking-[0.2em] text-muted px-1">Groups</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {groups.filter(g => !permissions.some(p => p.group_id === g.id)).map(group => (
                                            <button 
                                                key={group.id}
                                                onClick={() => handleAddTarget(group.id, null)}
                                                className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:border-accent transition-all text-left"
                                            >
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                                                <div className="text-[10px] font-black uppercase tracking-widest truncate">{group.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-[8px] font-black uppercase tracking-[0.2em] text-muted px-1">Roles</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {roles.filter(r => r.name.toLowerCase() !== 'public' && !permissions.some(p => p.role_id === r.id)).map(role => (
                                            <button
                                                key={role.id}
                                                onClick={() => handleAddTarget(null, role.id)}
                                                className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:border-accent transition-all text-left"
                                            >
                                                <Award size={16} className="text-muted" style={{ color: role.color }} />
                                                <div className="text-[10px] font-black uppercase tracking-widest truncate">{role.name}</div>
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
                                            <th key={p.key} className="text-center py-4 px-2 text-[9px] font-black uppercase tracking-widest text-muted border-b border-border">
                                                {p.name}
                                            </th>
                                        ))}
                                        <th className="py-4 px-6 border-b border-border"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissions.map(entry => {
                                        const isPublicEntry = entry.group_id === null && entry.role_id === null;
                                        return (
                                        <tr key={entry.id} className="hover:bg-surface/30">
                                            <td className="py-4 px-6 border-b border-border">
                                                <div className="text-[11px] font-black uppercase">
                                                    {isPublicEntry ? 'Everyone / Public' : (entry.role_id ? entry.role?.name : entry.group?.name)}
                                                </div>
                                                {!isPublicEntry && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleSelectAll(entry.group_id, entry.role_id)}
                                                            className="text-[8px] font-black text-accent uppercase tracking-widest hover:underline"
                                                        >
                                                            Select All
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            {AVAILABLE_PERMISSIONS.map(p => {
                                                const viewOnly = isPublicEntry && p.key !== 'view_statistics';
                                                return (
                                                <td key={p.key} className="py-4 px-2 border-b border-border text-center">
                                                    <button
                                                        onClick={() => !viewOnly && handleTogglePermission(entry.group_id, entry.role_id, p.key)}
                                                        disabled={viewOnly}
                                                        className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center mx-auto border-2 ${
                                                            viewOnly
                                                                ? 'opacity-20 cursor-not-allowed border-border bg-transparent text-transparent'
                                                                : entry.permissions.includes(p.key)
                                                                    ? 'bg-accent border-accent text-white'
                                                                    : 'bg-transparent border-border text-transparent hover:border-accent'
                                                        }`}
                                                    >
                                                        <Check size={16} strokeWidth={3} />
                                                    </button>
                                                </td>
                                                );
                                            })}
                                            <td className="py-4 px-6 border-b border-border text-right">
                                                <button
                                                    onClick={() => handleRemoveEntry(entry.id)}
                                                    className="p-2 hover:bg-danger/10 text-muted hover:text-danger rounded-xl transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 border-t border-border bg-surface/30 flex justify-end">
                    <button onClick={onClose} className="px-8 py-3 bg-accent text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-accent/20">
                        Save & Close
                    </button>
                </div>
            </div>
        </div>
    );
};

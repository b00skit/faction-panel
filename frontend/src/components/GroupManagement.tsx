import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, UserPlus, UserMinus, Shield, ShieldAlert, X, Search, MoreVertical } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import Loading from './Loading';
import { Group } from '../types';

interface GroupManagementProps {
    shortname: string;
    user: any;
    permissions: string[];
}

const GroupManagement: React.FC<GroupManagementProps> = ({ shortname, user, permissions }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showMemberModal, setShowMemberModal] = useState<Group | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [factionUsers, setFactionUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const [groupForm, setGroupForm] = useState({
        id: null as number | null,
        name: '',
        color: '#3b82f6'
    });

    const hasPerm = (perm: string) => permissions.includes(perm);
    const isGlobalManager = hasPerm('manage_group_members');

    const fetchGroups = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get(`/factions/${shortname}/groups`);
            setGroups(res.data);

            // Sync with URL if needed
            const groupParam = searchParams.get('group');
            if (groupParam) {
                const targetGroup = res.data.find((g: any) => String(g.id) === groupParam || g.name.toLowerCase() === groupParam.toLowerCase());
                if (targetGroup && !showMemberModal) setShowMemberModal(targetGroup);
            }

            if (showMemberModal) {
                const updated = res.data.find((g: any) => g.id === showMemberModal.id);
                if (updated) setShowMemberModal(updated);
            }
        } catch (err) {
            console.error('Failed to fetch groups', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get(`/factions/${shortname}/users`);
            setFactionUsers(res.data);
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    };

    const handleSetShowMemberModal = (group: Group | null) => {
        setShowMemberModal(group);
        const newParams = new URLSearchParams(searchParams);
        if (group) {
            newParams.set('group', group.name.toLowerCase());
        } else {
            newParams.delete('group');
        }
        setSearchParams(newParams, { replace: true });
    };

    useEffect(() => {
        fetchGroups();
    }, [shortname]);

    useEffect(() => {
        if (showMemberModal) {
            const isLeaderOfThis = showMemberModal.leaders?.some((l: any) => l.id === user.id) || false;
            if (isGlobalManager || isLeaderOfThis) {
                fetchUsers();
            }
        }
    }, [showMemberModal, isGlobalManager, user.id]);

    useEffect(() => {
        if (groups.length > 0) {
            const groupParam = searchParams.get('group');
            if (groupParam) {
                const targetGroup = groups.find((g: any) => String(g.id) === groupParam || g.name.toLowerCase() === groupParam.toLowerCase());
                if (targetGroup) {
                    if (showMemberModal?.id !== targetGroup.id) setShowMemberModal(targetGroup);
                } else if (showMemberModal) {
                    setShowMemberModal(null);
                }
            } else if (showMemberModal) {
                setShowMemberModal(null);
            }
        }
    }, [searchParams, groups]);

    const handleSaveGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const loadToast = toast.loading(groupForm.id ? 'Updating group...' : 'Creating group...');
        try {
            if (groupForm.id) {
                await api.put(`/groups/${groupForm.id}`, groupForm);
                toast.success('Group updated', { id: loadToast });
            } else {
                await api.post(`/factions/${shortname}/groups`, groupForm);
                toast.success('Group created', { id: loadToast });
            }
            setShowGroupModal(false);
            fetchGroups(true);
        } catch (err) {
            toast.error('Failed to save group', { id: loadToast });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteGroup = async (id: number) => {
        const group = groups.find(g => g.id === id);
        if (!group) return;

        toast((t) => (
            <div className="flex flex-col gap-1 text-left">
                <p className="font-bold">Delete group "{group.name}"?</p>
                <p className="text-[10px] opacity-80 uppercase tracking-tighter">This action cannot be undone and will remove all members from the group.</p>
                <div className="flex gap-2 justify-end mt-2">
                    <button onClick={() => toast.dismiss(t.id)} className="px-2 py-1 bg-surface hover:bg-bg border border-border rounded text-[9px] font-bold uppercase transition">Cancel</button>
                    <button 
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const loadToast = toast.loading('Deleting group...');
                            try {
                                await api.delete(`/groups/${id}`);
                                toast.success('Group deleted', { id: loadToast });
                                fetchGroups(true);
                            } catch (err) {
                                toast.error('Failed to delete group', { id: loadToast });
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

    const handleAddMember = async (groupId: number, userId: number, isLeader = false) => {
        setIsProcessing(true);
        const loadToast = toast.loading('Adding member...');
        try {
            await api.post(`/groups/${groupId}/members`, { user_id: userId, is_leader: isLeader });
            toast.success('Member added', { id: loadToast });
            await fetchGroups(true);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to add member', { id: loadToast });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemoveMember = async (groupId: number, userId: number) => {
        setIsProcessing(true);
        const loadToast = toast.loading('Removing member...');
        try {
            await api.delete(`/groups/${groupId}/members/${userId}`);
            toast.success('Member removed', { id: loadToast });
            await fetchGroups(true);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to remove member', { id: loadToast });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleToggleLeader = async (groupId: number, userId: number) => {
        setIsProcessing(true);
        const loadToast = toast.loading('Updating leader status...');
        try {
            await api.put(`/groups/${groupId}/members/${userId}/toggle-leader`);
            toast.success('Leader status updated', { id: loadToast });
            await fetchGroups(true);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to toggle leader', { id: loadToast });
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredUsers = factionUsers.filter(u => 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !showMemberModal?.members?.some(m => m.id === u.id)
    );

    const isLeaderOfThis = showMemberModal?.leaders?.some((l: any) => l.id === user.id) || false;
    const canManageThis = isGlobalManager || isLeaderOfThis;

    if (loading) return <Loading message="Loading groups..." fullScreen={false} />;

    return (
        <div className="space-y-6 relative">
            {isProcessing && (
                <div className="absolute -top-5 left-0 right-0 h-1 bg-accent/20 overflow-hidden z-[100] rounded-full">
                    <div className="h-full bg-accent animate-progress origin-left" />
                </div>
            )}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                        Group Management
                    </h1>
                    <p className="text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">
                        {isGlobalManager ? 'Managing all faction groups' : 'Managing your assigned groups'}
                    </p>
                </div>
                {hasPerm('create_groups') && (
                    <button 
                        onClick={() => {
                            setGroupForm({ id: null, name: '', color: '#3b82f6' });
                            setShowGroupModal(true);
                        }}
                        className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded font-bold text-[10px] uppercase tracking-widest transition flex items-center gap-2 shadow-lg shadow-accent/20"
                    >
                        <Plus size={14} /> Create Group
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map(group => {
                    const isLeaderOfThis = group.leaders?.some(l => l.id === user.id);
                    const canManageThis = isGlobalManager || isLeaderOfThis;

                    return (
                        <div key={group.id} className="bg-card border border-border rounded-xl overflow-hidden group/card hover:border-accent transition-colors flex flex-col">
                            <div className="h-1" style={{ backgroundColor: group.color }} />
                            <div className="p-4 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-black uppercase tracking-tight text-sm">{group.name}</h3>
                                        <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{group.members?.length || 0} Members</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                        {hasPerm('modify_groups') && (
                                            <button 
                                                onClick={() => {
                                                    setGroupForm({ id: group.id, name: group.name, color: group.color });
                                                    setShowGroupModal(true);
                                                }}
                                                className="p-1.5 hover:bg-surface rounded text-muted hover:text-accent transition-colors"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                        )}
                                        {hasPerm('remove_groups') && (
                                            <button 
                                                onClick={() => handleDeleteGroup(group.id)}
                                                className="p-1.5 hover:bg-surface rounded text-muted hover:text-danger transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1 opacity-50">Leaders</div>
                                    <div className="flex flex-wrap gap-1">
                                        {group.leaders?.length ? group.leaders.map(leader => (
                                            <div key={leader.id} className="px-2 py-0.5 bg-accent/10 border border-accent/20 rounded text-[9px] font-bold text-accent uppercase flex items-center gap-1">
                                                <Shield size={10} /> {leader.username}
                                            </div>
                                        )) : <span className="text-[9px] text-muted italic lowercase">No leaders assigned</span>}
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => handleSetShowMemberModal(group)}
                                className="w-full py-3 bg-surface hover:bg-accent hover:text-white border-t border-border transition-all text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                            >
                                <UserPlus size={12} /> Manage Members
                            </button>
                        </div>
                    );
                })}
            </div>

            {groups.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center border border-dashed border-border rounded-2xl bg-card/50">
                    <ShieldAlert size={48} className="opacity-10 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">No groups found</p>
                </div>
            )}

            {/* Group Creation/Edit Modal */}
            {showGroupModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
                    <div className="bg-card p-6 rounded-2xl max-w-sm w-full border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter">
                            {groupForm.id ? 'Edit Group' : 'Create Group'}
                        </h2>
                        <form onSubmit={handleSaveGroup} className="space-y-4">
                            <div>
                                <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Group Name</label>
                                <input 
                                    value={groupForm.name} 
                                    onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} 
                                    className="w-full bg-surface border border-border p-3 rounded-xl text-sm text-text focus:border-accent outline-none transition" 
                                    required 
                                    placeholder="e.g. Investigations Unit" 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Group Color</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="color" 
                                        value={groupForm.color} 
                                        onChange={e => setGroupForm({ ...groupForm, color: e.target.value })} 
                                        className="w-10 h-10 bg-surface border border-border rounded-xl p-1 cursor-pointer" 
                                    />
                                    <input 
                                        value={groupForm.color} 
                                        onChange={e => setGroupForm({ ...groupForm, color: e.target.value })} 
                                        className="flex-1 bg-surface border border-border p-3 rounded-xl text-sm text-text focus:border-accent outline-none transition font-mono uppercase" 
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowGroupModal(false)} className="flex-1 px-4 py-3 bg-surface hover:bg-bg border border-border text-text rounded-xl font-black text-[10px] uppercase tracking-widest transition">Cancel</button>
                                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition shadow-lg shadow-accent/20 disabled:opacity-50">
                                    {isSaving ? 'Saving...' : (groupForm.id ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Member Management Modal */}
            {showMemberModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
                    <div className="bg-card rounded-2xl max-w-2xl w-full border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                                    <div className="w-2 h-6 rounded-full" style={{ backgroundColor: showMemberModal.color }} />
                                    {showMemberModal.name}
                                </h2>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Member Management</p>
                            </div>
                            <button onClick={() => handleSetShowMemberModal(null)} className="text-muted hover:text-text transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden flex">
                            {/* Current Members */}
                            <div className={`${canManageThis ? 'w-1/2 border-r border-border' : 'w-full'} flex flex-col`}>
                                <div className="p-4 bg-surface/30 text-[9px] font-black uppercase tracking-[0.2em] text-muted border-b border-border">Current Members ({showMemberModal.members?.length || 0})</div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                    {showMemberModal.members?.map(member => {
                                        const isMemberLeader = member.pivot.is_leader;
                                        const canRemoveThisMember = canManageThis && (isGlobalManager || !isMemberLeader);
                                        return (
                                            <div key={member.id} className="flex justify-between items-center p-3 bg-surface border border-border rounded-xl group/member">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-black">
                                                        {member.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold uppercase">{member.username}</div>
                                                        <div className="text-[8px] text-muted font-bold uppercase tracking-widest">
                                                            {member.pivot.is_leader ? <span className="text-accent flex items-center gap-1"><Shield size={8} /> Group Leader</span> : 'Member'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                                                    {canManageThis && isGlobalManager && (
                                                        <button 
                                                            onClick={() => handleToggleLeader(showMemberModal.id, member.id)}
                                                            className={`p-1.5 rounded transition-colors ${member.pivot.is_leader ? 'bg-accent/10 text-accent' : 'hover:bg-surface text-muted'}`}
                                                            title={member.pivot.is_leader ? 'Remove Leader' : 'Promote to Leader'}
                                                        >
                                                            <Shield size={14} />
                                                        </button>
                                                    )}
                                                    {canRemoveThisMember && (
                                                        <button 
                                                            onClick={() => handleRemoveMember(showMemberModal.id, member.id)}
                                                            className="p-1.5 hover:bg-danger/10 text-muted hover:text-danger rounded transition-colors"
                                                            title="Remove from group"
                                                        >
                                                            <UserMinus size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {showMemberModal.members?.length === 0 && (
                                        <div className="py-10 text-center text-[10px] text-muted uppercase tracking-widest font-bold opacity-40">No members in this group</div>
                                    )}
                                </div>
                            </div>

                            {/* Add Members */}
                            {canManageThis && (
                                <div className="w-1/2 flex flex-col bg-surface/10">
                                    <div className="p-4 bg-surface/30 border-b border-border">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                            <input 
                                                placeholder="SEARCH FACTION MEMBERS..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="w-full bg-surface border border-border py-2 pl-9 pr-4 rounded-lg text-[10px] font-bold uppercase tracking-widest focus:border-accent outline-none transition"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                        {filteredUsers.map(u => (
                                            <div key={u.id} className="flex justify-between items-center p-3 bg-card border border-border rounded-xl hover:border-accent transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-muted text-xs font-black uppercase">
                                                        {u.username[0]}
                                                    </div>
                                                    <div className="text-xs font-bold uppercase">{u.username}</div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={() => handleAddMember(showMemberModal.id, u.id)}
                                                        className="p-2 bg-surface hover:bg-accent hover:text-white rounded-lg transition-all text-muted"
                                                    >
                                                        <UserPlus size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <div className="py-10 text-center text-[10px] text-muted uppercase tracking-widest font-bold opacity-40">No matching members found</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupManagement;

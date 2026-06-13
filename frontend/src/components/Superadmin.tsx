import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Loading from './Loading';
import toast from 'react-hot-toast';
import { Shield, ArrowLeft, Users, Building2, Edit2, Trash2, UserPlus, Check, X, CreditCard, Plus, Settings, ScrollText, BookOpen, Bell, ExternalLink } from 'lucide-react';
import { User, Faction, MembershipTier } from '../types';
import HelpAdmin from './HelpAdmin';
import CreditAdmin from './CreditAdmin';
import ChangelogAdmin from './ChangelogAdmin';
import { useConfirm } from './ConfirmationProvider';

interface SuperadminProps {
    user: User;
    onLogin: (token: string, user: any) => void;
}

const Superadmin: React.FC<SuperadminProps> = ({ user, onLogin }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'factions' | 'users' | 'tiers' | 'settings' | 'help' | 'credits' | 'changelog' | 'notifications'>('factions');
    
    const [factions, setFactions] = useState<Faction[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);
    const [tiers, setTiers] = useState<MembershipTier[]>([]);
    const [settings, setSettings] = useState<Record<string, string>>({ version: '1.0.0' });
    
    // Edit States
    const [editingFaction, setEditingFaction] = useState<any>(null);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [editingTier, setEditingTier] = useState<any>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!user?.is_superadmin) {
            navigate('/');
            return;
        }
        fetchData();
    }, [user]);

    const fetchData = async () => {
        try {
            const [factionsRes, usersRes, tiersRes, settingsRes] = await Promise.all([
                api.get('/superadmin/factions'),
                api.get('/superadmin/users'),
                api.get('/superadmin/membership-tiers'),
                api.get('/superadmin/settings')
            ]);
            setFactions(factionsRes.data);
            setUsersList(usersRes.data);
            setTiers(tiersRes.data);
            setSettings(settingsRes.data);
        } catch (err) {
            toast.error('Failed to fetch superadmin data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        const loadToast = toast.loading('Updating settings...');
        try {
            await api.put('/superadmin/settings', { settings });
            toast.success('Settings updated', { id: loadToast });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update settings', { id: loadToast });
        } finally {
            setProcessing(false);
        }
    };

    const handleImpersonate = async (targetUser: User) => {
        if (!window.confirm(`Are you sure you want to impersonate ${targetUser.username}?`)) return;
        
        const loadToast = toast.loading('Impersonating...');
        try {
            const res = await api.post(`/superadmin/impersonate/${targetUser.id}`);
            toast.success(`Now impersonating ${targetUser.username}`, { id: loadToast });
            onLogin(res.data.access_token, res.data.user);
            navigate('/');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to impersonate user', { id: loadToast });
        }
    };

    const handleDeleteFaction = async (faction: Faction) => {
        if (!window.confirm(`WARNING: Are you sure you want to permanently delete faction ${faction.name}?`)) return;
        
        const loadToast = toast.loading('Deleting faction...');
        try {
            await api.delete(`/superadmin/factions/${faction.id}`);
            toast.success('Faction deleted', { id: loadToast });
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete faction', { id: loadToast });
        }
    };

    const handleDeleteUser = async (targetUser: User) => {
        if (targetUser.id === user.id) {
            toast.error("Cannot delete yourself");
            return;
        }
        if (!window.confirm(`WARNING: Are you sure you want to permanently delete user ${targetUser.username}?`)) return;
        
        const loadToast = toast.loading('Deleting user...');
        try {
            await api.delete(`/superadmin/users/${targetUser.id}`);
            toast.success('User deleted', { id: loadToast });
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete user', { id: loadToast });
        }
    };

    const handleDeleteTier = async (tier: MembershipTier) => {
        if (!window.confirm(`Are you sure you want to delete membership tier ${tier.name}?`)) return;
        
        const loadToast = toast.loading('Deleting tier...');
        try {
            await api.delete(`/superadmin/membership-tiers/${tier.id}`);
            toast.success('Membership tier deleted', { id: loadToast });
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete membership tier', { id: loadToast });
        }
    };

    const submitFactionEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        const loadToast = toast.loading('Saving faction...');
        try {
            await api.put(`/superadmin/factions/${editingFaction.id}`, editingFaction);
            toast.success('Faction updated', { id: loadToast });
            setEditingFaction(null);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update faction', { id: loadToast });
        } finally {
            setProcessing(false);
        }
    };

    const submitUserEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        const loadToast = toast.loading('Saving user...');
        try {
            if (editingUser.id) {
                await api.put(`/superadmin/users/${editingUser.id}`, editingUser);
            } else {
                await api.post('/superadmin/users', editingUser);
            }
            toast.success(editingUser.id ? 'User updated' : 'User created', { id: loadToast });
            setEditingUser(null);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save user', { id: loadToast });
        } finally {
            setProcessing(false);
        }
    };

    const submitTierEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        const loadToast = toast.loading('Saving membership tier...');
        try {
            if (editingTier.id) {
                await api.put(`/superadmin/membership-tiers/${editingTier.id}`, editingTier);
            } else {
                await api.post('/superadmin/membership-tiers', editingTier);
            }
            toast.success('Membership tier saved', { id: loadToast });
            setEditingTier(null);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save membership tier', { id: loadToast });
        } finally {
            setProcessing(false);
        }
    };

    const SystemNotificationsTab = () => {
        const [sysNotifications, setSysNotifications] = useState<any[]>([]);
        const [sysLoading, setSysLoading] = useState(true);
        const [sysTitle, setSysTitle] = useState('');
        const [sysMessage, setSysMessage] = useState('');
        const [sysUserId, setSysUserId] = useState('');
        const [sysLink, setSysLink] = useState('');
        const [sysProcessing, setSysProcessing] = useState(false);

        const fetchSysNotifications = async () => {
            setSysLoading(true);
            try {
                const res = await api.get('/superadmin/notifications');
                setSysNotifications(res.data);
            } catch (err) {
                console.error(err);
                toast.error('Failed to load system notifications');
            } finally {
                setSysLoading(false);
            }
        };

        useEffect(() => {
            fetchSysNotifications();
        }, []);

        const handleSubmitSysNotif = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!sysTitle.trim() || !sysMessage.trim()) return;

            setSysProcessing(true);
            const loadToast = toast.loading('Issuing notification...');
            try {
                await api.post('/superadmin/notifications', {
                    title: sysTitle,
                    message: sysMessage,
                    user_id: sysUserId ? parseInt(sysUserId) : null,
                    link: sysLink.trim() || null
                });
                toast.success('System notification issued successfully', { id: loadToast });
                setSysTitle('');
                setSysMessage('');
                setSysUserId('');
                setSysLink('');
                fetchSysNotifications();
            } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to issue notification', { id: loadToast });
            } finally {
                setSysProcessing(false);
            }
        };

        const handleDeleteSysNotif = async (id: number) => {
            if (!window.confirm('Are you sure you want to delete this system notification?')) return;
            const loadToast = toast.loading('Deleting...');
            try {
                await api.delete(`/superadmin/notifications/${id}`);
                toast.success('System notification deleted', { id: loadToast });
                fetchSysNotifications();
            } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to delete notification', { id: loadToast });
            }
        };

        return (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-xl font-black uppercase tracking-tighter italic mb-4 flex items-center gap-2">
                        <Bell className="text-accent" size={20} />
                        Active System Notifications
                    </h3>
                    
                    {sysLoading ? (
                        <div className="py-12 text-center text-muted font-bold text-xs uppercase tracking-widest">Loading...</div>
                    ) : sysNotifications.length === 0 ? (
                        <div className="py-12 text-center text-muted font-bold text-xs uppercase tracking-widest border border-dashed border-border rounded-xl">No active system notifications</div>
                    ) : (
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            {sysNotifications.map((n: any) => (
                                <div key={n.id} className="p-4 border border-border rounded-xl bg-surface/30 relative flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs">{n.title}</span>
                                            {n.user_id ? (
                                                <span className="px-1.5 py-0.5 bg-accent/15 border border-accent/20 rounded font-black text-[7px] uppercase tracking-widest text-accent">
                                                    Targeted: {n.user?.username}
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 bg-yellow-500/15 border border-yellow-500/20 rounded font-black text-[7px] uppercase tracking-widest text-[#FFD700]">
                                                    Broadcast (All Users)
                                                </span>
                                            )}
                                        </div>
                                        <p 
                                            className="text-xs text-muted font-medium mt-1"
                                            dangerouslySetInnerHTML={{ __html: n.message }}
                                        />
                                        {n.link && (
                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-accent font-bold">
                                                <ExternalLink size={10} />
                                                <a href={n.link} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">{n.link}</a>
                                            </div>
                                        )}
                                        <span className="text-[8px] text-muted/60 font-bold block mt-2">{new Date(n.created_at).toLocaleString()}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteSysNotif(n.id)}
                                        className="p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-fit">
                    <h3 className="text-lg font-black uppercase tracking-tighter italic mb-4 flex items-center gap-2">
                        <Plus className="text-accent" size={18} />
                        Issue System Notification
                    </h3>
                    <form onSubmit={handleSubmitSysNotif} className="space-y-4">
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-muted mb-1.5">Notification Title</label>
                          <input
                            type="text"
                            value={sysTitle}
                            onChange={e => setSysTitle(e.target.value)}
                            placeholder="e.g. System Maintenance Scheduled"
                            className="w-full bg-surface border border-border p-3 rounded-xl text-xs font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-muted mb-1.5">Notification Message</label>
                          <textarea
                            value={sysMessage}
                            onChange={e => setSysMessage(e.target.value)}
                            placeholder="Type details of the release or maintenance..."
                            rows={4}
                            className="w-full bg-surface border border-border p-3 rounded-xl text-xs font-medium"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-muted mb-1.5">Target User ID (Optional)</label>
                          <input
                            type="number"
                            value={sysUserId}
                            onChange={e => setSysUserId(e.target.value)}
                            placeholder="Leave blank to broadcast to everyone"
                            className="w-full bg-surface border border-border p-3 rounded-xl text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-muted mb-1.5">Notification Link (Optional)</label>
                          <input
                            type="text"
                            value={sysLink}
                            onChange={e => setSysLink(e.target.value)}
                            placeholder="e.g. https://google.com or /help"
                            className="w-full bg-surface border border-border p-3 rounded-xl text-xs font-bold"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={sysProcessing}
                          className="w-full py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold uppercase tracking-widest text-[9px] transition shadow-lg shadow-accent/20 disabled:opacity-50"
                        >
                          {sysProcessing ? 'Issuing...' : 'Issue Notification'}
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    if (loading) return <Loading message="Loading Superadmin Panel..." />;

    return (
        <div className="max-w-7xl mx-auto p-8 pb-20">
                <div className="mb-8">
                    <button 
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-accent text-[10px] font-bold uppercase tracking-widest mb-4 hover:gap-3 transition-all"
                    >
                        <ArrowLeft size={14} />
                        Back to Selection
                    </button>
                    <h1 className="text-4xl font-black tracking-tighter uppercase italic mb-1 text-[#FFD700]">System Administration</h1>
                    <p className="text-muted text-xs font-bold uppercase tracking-[0.2em]">Global Management Console</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-border mb-6">
                    <button
                        onClick={() => setActiveTab('factions')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-all ${
                            activeTab === 'factions' 
                                ? 'border-b-2 border-accent text-accent bg-accent/5' 
                                : 'text-muted hover:text-text hover:bg-surface'
                        }`}
                    >
                        <Building2 size={14} /> Factions
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-all ${
                            activeTab === 'users' 
                                ? 'border-b-2 border-accent text-accent bg-accent/5' 
                                : 'text-muted hover:text-text hover:bg-surface'
                        }`}
                    >
                        <Users size={14} /> Users
                    </button>
                    <button
                        onClick={() => setActiveTab('tiers')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-all ${
                            activeTab === 'tiers' 
                                ? 'border-b-2 border-accent text-accent bg-accent/5' 
                                : 'text-muted hover:text-text hover:bg-surface'
                        }`}
                    >
                        <CreditCard size={14} /> Membership Tiers
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-all ${
                            activeTab === 'settings' 
                                ? 'border-b-2 border-accent text-accent bg-accent/5' 
                                : 'text-muted hover:text-text hover:bg-surface'
                        }`}
                    >
                        <Settings size={14} /> System Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('help')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-all ${
                            activeTab === 'help' 
                                ? 'border-b-2 border-accent text-accent bg-accent/5' 
                                : 'text-muted hover:text-text hover:bg-surface'
                        }`}
                    >
                        <BookOpen size={14} /> Help Center
                    </button>
                    <button
                        onClick={() => setActiveTab('credits')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-all ${
                            activeTab === 'credits'
                                ? 'border-b-2 border-accent text-accent bg-accent/5'
                                : 'text-muted hover:text-text hover:bg-surface'
                        }`}
                    >
                        <Shield size={14} /> Credits
                    </button>
                    <button
                        onClick={() => setActiveTab('changelog')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-all ${
                            activeTab === 'changelog'
                                ? 'border-b-2 border-accent text-accent bg-accent/5'
                                : 'text-muted hover:text-text hover:bg-surface'
                        }`}
                    >
                        <ScrollText size={14} /> Changelog
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold text-[10px] uppercase tracking-widest transition-all ${
                            activeTab === 'notifications'
                                ? 'border-b-2 border-accent text-accent bg-accent/5'
                                : 'text-muted hover:text-text hover:bg-surface'
                        }`}
                    >
                        <Bell size={14} /> System Notifications
                    </button>
                </div>

                {/* Help Center Tab */}
                {activeTab === 'help' && (
                    <HelpAdmin />
                )}

                {/* Credits Tab */}
                {activeTab === 'credits' && (
                    <CreditAdmin />
                )}

                {/* Changelog Tab */}
                {activeTab === 'changelog' && (
                    <ChangelogAdmin />
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <SystemNotificationsTab />
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
                                <h3 className="text-xl font-black uppercase tracking-tighter italic mb-6 flex items-center gap-2">
                                    <Settings className="text-accent" size={20} />
                                    Version Control
                                </h3>
                                <form onSubmit={handleUpdateSettings} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Website Version</label>
                                        <div className="flex gap-4">
                                            <input 
                                                value={settings.version} 
                                                onChange={e => setSettings({...settings, version: e.target.value})} 
                                                className="flex-1 bg-surface border border-border p-3 rounded-xl text-sm font-mono" 
                                                placeholder="e.g. 1.0.0"
                                                required 
                                            />
                                            <button 
                                                type="submit" 
                                                disabled={processing}
                                                className="px-6 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition shadow-lg shadow-accent/20 disabled:opacity-50"
                                            >
                                                {processing ? '...' : 'Update'}
                                            </button>
                                        </div>
                                        <p className="mt-2 text-[9px] text-muted font-bold uppercase tracking-wider">
                                            This version will be displayed in the footer of all pages.
                                        </p>
                                    </div>
                                </form>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
                                <h3 className="text-xl font-black uppercase tracking-tighter italic mb-6 flex items-center gap-2">
                                    <Shield className="text-accent" size={20} />
                                    Security & Registration
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
                                        <div>
                                            <h4 className="text-[11px] font-black uppercase tracking-widest mb-1">Allow Registration</h4>
                                            <p className="text-[9px] text-muted font-bold uppercase tracking-wider">Enable or disable site-wide user registration and automatic OAuth account creation.</p>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const newVal = settings.allow_registration === 'false' ? 'true' : 'false';
                                                const newSettings = {...settings, allow_registration: newVal};
                                                setSettings(newSettings);
                                                // Trigger update immediately for better UX
                                                api.put('/superadmin/settings', { settings: newSettings })
                                                    .then(() => toast.success(`Registration ${newVal === 'true' ? 'enabled' : 'disabled'}`))
                                                    .catch(() => toast.error('Failed to update registration setting'));
                                            }}
                                            className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-[0.2em] transition-all border ${
                                                settings.allow_registration === 'true' 
                                                ? 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20' 
                                                : 'bg-danger/10 text-danger border-danger/20 hover:bg-danger/20'
                                            }`}
                                        >
                                            {settings.allow_registration === 'true' ? 'Enabled' : 'Disabled'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-8 shadow-sm opacity-50">
                                <h3 className="text-xl font-black uppercase tracking-tighter italic mb-2 flex items-center gap-2">
                                    <ScrollText className="text-muted" size={20} />
                                    Advanced Configuration
                                </h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted italic">More settings coming soon...</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-card border border-border rounded-xl p-8 shadow-sm flex flex-col">
                                <h3 className="text-xl font-black uppercase tracking-tighter italic mb-4 flex items-center gap-2">
                                    <ScrollText className="text-accent" size={20} />
                                    System Changelog
                                </h3>
                                <p className="text-xs text-muted mb-4">Manage public-facing release notes shown on the changelog page.</p>
                                <button
                                    onClick={() => setActiveTab('changelog')}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition shadow-lg shadow-accent/20 w-fit"
                                >
                                    <ScrollText size={14} /> Open Changelog Editor
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Factions Tab */}
                {activeTab === 'factions' && (
                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-surface border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">ID</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Name / Shortname</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Leader</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Members</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {factions.map(faction => (
                                        <tr key={faction.id} className="hover:bg-surface/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-muted text-xs">#{faction.id}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: faction.color }} />
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{faction.name}</span>
                                                        <span className="text-[9px] uppercase tracking-widest text-muted">{faction.shortname}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-xs">{faction.leader?.username || <span className="text-muted italic">None</span>}</td>
                                            <td className="px-6 py-4 text-xs">{faction.users_count}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setEditingFaction(faction)} className="p-2 bg-surface hover:bg-bg border border-border rounded-lg text-text transition-colors">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDeleteFaction(faction)} className="p-2 bg-danger/10 hover:bg-danger/20 border border-danger/20 rounded-lg text-danger transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <button 
                                onClick={() => setEditingUser({ username: '', gtaw_id: null, gtaw_username: '', is_superadmin: false, membership_tier_id: null })}
                                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] transition shadow-lg shadow-accent/20"
                            >
                                <UserPlus size={14} /> Create User
                            </button>
                        </div>
                        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-surface border-b border-border">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">ID</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Username</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Membership</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {usersList.map(u => (
                                            <tr key={u.id} className="hover:bg-surface/50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-muted text-xs">#{u.id}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{u.username}</span>
                                                        {u.gtaw_linked ? (
                                                            <span className="text-[9px] uppercase tracking-widest text-muted">{u.gtaw_username} {u.gtaw_id ? `(ID: ${u.gtaw_id})` : '(Linked)'}</span>
                                                        ) : (
                                                            <span className="text-[9px] uppercase tracking-widest text-muted italic">Unlinked</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {u.membership_tier ? (
                                                        <span className="px-2 py-1 bg-accent/10 text-accent border border-accent/20 rounded font-black text-[8px] uppercase tracking-widest">
                                                            {u.membership_tier.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted text-[10px] uppercase font-bold italic">Standard</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {u.is_superadmin ? (
                                                        <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded font-black text-[8px] uppercase tracking-widest">Superadmin</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-surface border border-border text-muted rounded font-black text-[8px] uppercase tracking-widest">User</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {user.id !== u.id && (
                                                            <button 
                                                                onClick={() => handleImpersonate(u)} 
                                                                className="p-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg text-accent transition-colors"
                                                                title="Impersonate User"
                                                            >
                                                                <UserPlus size={14} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => setEditingUser(u)} className="p-2 bg-surface hover:bg-bg border border-border rounded-lg text-text transition-colors">
                                                            <Edit2 size={14} />
                                                        </button>
                                                        {user.id !== u.id && (
                                                            <button onClick={() => handleDeleteUser(u)} className="p-2 bg-danger/10 hover:bg-danger/20 border border-danger/20 rounded-lg text-danger transition-colors">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Membership Tiers Tab */}
                {activeTab === 'tiers' && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <button 
                                onClick={() => setEditingTier({ name: '', max_factions: 1 })}
                                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] transition shadow-lg shadow-accent/20"
                            >
                                <Plus size={14} /> Create Tier
                            </button>
                        </div>
                        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-surface border-b border-border">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">ID</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Tier Name</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Max Factions</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Users</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {tiers.map(tier => (
                                            <tr key={tier.id} className="hover:bg-surface/50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-muted text-xs">#{tier.id}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold">{tier.name}</span>
                                                        {tier.allow_custom_branding && (
                                                            <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded font-black text-[7px] uppercase tracking-widest">Branding</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-surface border border-border rounded font-mono text-[10px]">
                                                        {tier.max_factions}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-muted">{tier.users_count || 0} users</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => setEditingTier(tier)} className="p-2 bg-surface hover:bg-bg border border-border rounded-lg text-text transition-colors">
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button onClick={() => handleDeleteTier(tier)} className="p-2 bg-danger/10 hover:bg-danger/20 border border-danger/20 rounded-lg text-danger transition-colors">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {tiers.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-muted text-xs font-bold uppercase tracking-widest">No membership tiers defined.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Faction Modal */}
                {editingFaction && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
                        <div className="bg-card p-8 rounded-2xl max-w-md w-full border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-6">Edit Faction</h2>
                            <form onSubmit={submitFactionEdit} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Name</label>
                                    <input 
                                        value={editingFaction.name} 
                                        onChange={e => setEditingFaction({...editingFaction, name: e.target.value})} 
                                        className="w-full bg-surface border border-border p-3 rounded-xl text-sm" 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Shortname</label>
                                    <input 
                                        value={editingFaction.shortname} 
                                        onChange={e => setEditingFaction({...editingFaction, shortname: e.target.value.toLowerCase().replace(/[^a-z0-9\-_]/g, '')})} 
                                        className="w-full bg-surface border border-border p-3 rounded-xl text-sm" 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Leader ID (User ID)</label>
                                    <input 
                                        type="number"
                                        value={editingFaction.faction_leader || ''} 
                                        onChange={e => setEditingFaction({...editingFaction, faction_leader: e.target.value ? parseInt(e.target.value) : null})} 
                                        className="w-full bg-surface border border-border p-3 rounded-xl text-sm font-mono" 
                                        placeholder="Leave empty for no leader"
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setEditingFaction(null)} className="flex-1 px-4 py-3 bg-surface border border-border hover:bg-bg rounded-xl font-bold uppercase tracking-widest text-[10px] transition">Cancel</button>
                                    <button type="submit" disabled={processing} className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition shadow-lg shadow-accent/20 disabled:opacity-50">
                                        Save
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit User Modal */}
                {editingUser && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
                        <div className="bg-card p-8 rounded-2xl max-w-md w-full border border-border shadow-2xl">
                            <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-6">Edit User</h2>
                            <form onSubmit={submitUserEdit} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Username</label>
                                    <input 
                                        value={editingUser.username} 
                                        onChange={e => setEditingUser({...editingUser, username: e.target.value})} 
                                        className="w-full bg-surface border border-border p-3 rounded-xl text-sm" 
                                        required 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">GTA:W ID</label>
                                        <input 
                                            type="number"
                                            value={editingUser.gtaw_id || ''} 
                                            onChange={e => setEditingUser({...editingUser, gtaw_id: e.target.value ? parseInt(e.target.value) : null})} 
                                            className="w-full bg-surface border border-border p-3 rounded-xl text-sm font-mono" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">GTA:W Username</label>
                                        <input 
                                            value={editingUser.gtaw_username || ''} 
                                            onChange={e => setEditingUser({...editingUser, gtaw_username: e.target.value})} 
                                            className="w-full bg-surface border border-border p-3 rounded-xl text-sm" 
                                        />
                                    </div>
                                </div>
                                {!editingUser.id && (
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Password (Optional for GTA:W users)</label>
                                        <input 
                                            type="password"
                                            value={editingUser.password || ''} 
                                            onChange={e => setEditingUser({...editingUser, password: e.target.value})} 
                                            className="w-full bg-surface border border-border p-3 rounded-xl text-sm" 
                                            placeholder="Leave empty for OAuth-only login"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Membership Tier</label>
                                    <select 
                                        value={editingUser.membership_tier_id || ''} 
                                        onChange={e => setEditingUser({...editingUser, membership_tier_id: e.target.value ? parseInt(e.target.value) : null})}
                                        className="w-full bg-surface border border-border p-3 rounded-xl text-sm"
                                    >
                                        <option value="">Standard (1 Faction)</option>
                                        {tiers.map(tier => (
                                            <option key={tier.id} value={tier.id}>{tier.name} ({tier.max_factions} Factions)</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="pt-2">
                                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-surface border border-border rounded-xl">
                                        <input 
                                            type="checkbox" 
                                            checked={editingUser.is_superadmin}
                                            onChange={e => setEditingUser({...editingUser, is_superadmin: e.target.checked})}
                                            className="w-4 h-4 rounded text-accent focus:ring-accent focus:ring-offset-surface bg-bg border-border"
                                        />
                                        <span className="text-sm font-bold">Superadmin Privileges</span>
                                    </label>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setEditingUser(null)} className="flex-1 px-4 py-3 bg-surface border border-border hover:bg-bg rounded-xl font-bold uppercase tracking-widest text-[10px] transition">Cancel</button>
                                    <button type="submit" disabled={processing} className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition shadow-lg shadow-accent/20 disabled:opacity-50">
                                        Save
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit/Create Tier Modal */}
                {editingTier && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[600]">
                        <div className="bg-card p-8 rounded-2xl max-w-md w-full border border-border shadow-2xl">
                            <h2 className="text-2xl font-black uppercase tracking-tighter italic mb-6">
                                {editingTier.id ? 'Edit' : 'Create'} Membership Tier
                            </h2>
                            <form onSubmit={submitTierEdit} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Tier Name</label>
                                    <input 
                                        value={editingTier.name} 
                                        onChange={e => setEditingTier({...editingTier, name: e.target.value})} 
                                        className="w-full bg-surface border border-border p-3 rounded-xl text-sm" 
                                        required 
                                        placeholder="e.g. Donator, Premium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Max Created Factions</label>
                                    <input 
                                        type="number"
                                        value={editingTier.max_factions} 
                                        onChange={e => setEditingTier({...editingTier, max_factions: parseInt(e.target.value) || 0})} 
                                        className="w-full bg-surface border border-border p-3 rounded-xl text-sm font-mono" 
                                        required 
                                        min="0"
                                    />
                                    <p className="mt-1 text-[9px] text-muted font-bold uppercase tracking-wider">Number of factions this user can lead/create.</p>
                                </div>
                                <div className="pt-2">
                                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-surface border border-border rounded-xl">
                                        <input 
                                            type="checkbox" 
                                            checked={editingTier.allow_custom_branding}
                                            onChange={e => setEditingTier({...editingTier, allow_custom_branding: e.target.checked})}
                                            className="w-4 h-4 rounded text-accent focus:ring-accent focus:ring-offset-surface bg-bg border-border"
                                        />
                                        <span className="text-sm font-bold">Allow Custom Branding</span>
                                    </label>
                                    <p className="mt-1 text-[9px] text-muted font-bold uppercase tracking-wider ml-1">Enables custom header banner and favicon.</p>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setEditingTier(null)} className="flex-1 px-4 py-3 bg-surface border border-border hover:bg-bg rounded-xl font-bold uppercase tracking-widest text-[10px] transition">Cancel</button>
                                    <button type="submit" disabled={processing} className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition shadow-lg shadow-accent/20 disabled:opacity-50">
                                        Save
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default Superadmin;

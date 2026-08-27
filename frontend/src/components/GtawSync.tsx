import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Trash2, History, AlertTriangle, CheckCircle2, ShieldAlert, Clock, Settings, XCircle, User, Calendar } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { useConfirm } from './ConfirmationProvider';

const GtawSync: React.FC<{ faction: any; user: any }> = ({ faction, user }) => {
    const [syncing, setSyncing] = useState(false);
    const [pruning, setPruning] = useState(false);
    const [results, setResults] = useState<any>(null);
    const confirm = useConfirm();

    // Automation and logs state
    const isLeader = faction.faction_leader === user.id || user.is_superadmin;
    const [automation, setAutomation] = useState<any>({
        enabled: false,
        frequency: 'daily',
        time_of_day: '00:00',
    });
    const [logs, setLogs] = useState<any[]>([]);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    const fetchAutomationAndLogs = async () => {
        if (!isLeader) return;
        setLoadingSettings(true);
        try {
            const res = await api.get(`/factions/${faction.shortname}/integrations/gtaw/automation`);
            if (res.data.automation) {
                setAutomation(res.data.automation);
            }
            setLogs(res.data.logs || []);
        } catch (err: any) {
            console.error('Failed to load automation settings:', err);
        } finally {
            setLoadingSettings(false);
        }
    };

    useEffect(() => {
        fetchAutomationAndLogs();
    }, [faction.shortname]);

    const handleSync = async () => {
        setSyncing(true);
        setResults(null);
        try {
            const res = await api.post(`/factions/${faction.shortname}/integrations/gtaw/sync`);
            setResults(res.data.results);
            toast.success('Synchronization complete!');
            fetchAutomationAndLogs();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to sync with GTA:W');
        } finally {
            setSyncing(false);
        }
    };

    const handlePrune = async () => {
        const confirmed = await confirm({
            title: 'Prune Synchronized Data',
            message: 'Are you sure you want to prune all synchronized character data? This will clear the Characters Database but keep History and Name Changes.',
            confirmText: 'Prune Data',
            variant: 'danger'
        });

        if (!confirmed) return;
        
        setPruning(true);
        try {
            await api.post(`/factions/${faction.shortname}/integrations/gtaw/prune`);
            toast.success('Data pruned successfully');
            setResults(null);
            fetchAutomationAndLogs();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to prune data');
        } finally {
            setPruning(false);
        }
    };

    const handleSaveAutomation = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingSettings(true);
        try {
            const res = await api.post(`/factions/${faction.shortname}/integrations/gtaw/automation`, {
                enabled: automation.enabled,
                frequency: automation.frequency,
                time_of_day: automation.time_of_day,
            });
            setAutomation(res.data.automation);
            setLogs(res.data.logs || []);
            toast.success('Automation settings saved successfully!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save automation settings');
        } finally {
            setSavingSettings(false);
        }
    };

    const formatDateTime = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    return (
        <div className="relative flex flex-col gap-6 max-w-5xl mx-auto w-full">
            <div className={`flex flex-col gap-6 transition-all duration-500 ${!user.gtaw_linked ? 'blur-xl pointer-events-none select-none opacity-20 scale-[0.98]' : ''}`}>
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-text flex items-center gap-3">
                            <RefreshCw className="text-accent" />
                            GTA:W Synchronization
                        </h2>
                        <p className="text-xs text-muted font-bold uppercase tracking-widest mt-1">
                            Manage your faction integration with GTA World.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Sync Card */}
                    <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
                        <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                            <RefreshCw size={24} className={syncing ? 'animate-spin' : ''} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight mb-2">Manual Synchronization</h3>
                            <p className="text-xs text-muted font-bold uppercase tracking-widest leading-relaxed">
                                Fetch the latest roster data from GTA World. This will update the Characters Database, log joins/leaves in History, and track Name Changes.
                            </p>
                        </div>
                        <button 
                            onClick={handleSync}
                            disabled={syncing || pruning}
                            className="w-full py-4 bg-accent hover:bg-accent/90 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] transition shadow-xl shadow-accent/20 disabled:opacity-30 flex items-center justify-center gap-3"
                        >
                            {syncing ? <><RefreshCw size={16} className="animate-spin" /> Synchronizing...</> : 'Sync Now'}
                        </button>
                    </div>

                    {/* Prune Card */}
                    <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
                        <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center text-danger">
                            <Trash2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight mb-2">Prune Data</h3>
                            <p className="text-xs text-muted font-bold uppercase tracking-widest leading-relaxed">
                                Clear all entries from the synchronized Characters Database. This action is useful if you want to perform a completely fresh synchronization.
                            </p>
                        </div>
                        <button 
                            onClick={handlePrune}
                            disabled={syncing || pruning}
                            className="w-full py-4 bg-surface border border-border hover:bg-danger/10 hover:border-danger/30 text-text hover:text-danger rounded-xl font-black text-xs uppercase tracking-[0.2em] transition disabled:opacity-30 flex items-center justify-center gap-3"
                        >
                            {pruning ? <><RefreshCw size={16} className="animate-spin" /> Pruning...</> : 'Prune Characters'}
                        </button>
                    </div>
                </div>

                {/* Sync Results */}
                {results && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card border border-border rounded-2xl overflow-hidden"
                    >
                        <div className="p-4 bg-accent/5 border-b border-border flex items-center gap-3">
                            <CheckCircle2 size={18} className="text-accent" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text">Last Sync Results</h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 divide-x divide-border">
                            {[
                                { label: 'Added', value: results.added, color: 'text-green-500' },
                                { label: 'Updated', value: results.updated, color: 'text-accent' },
                                { 
                                    label: 'Removed', 
                                    value: results.removed, 
                                    color: 'text-danger',
                                    subValue: results.duplicates_removed,
                                    subLabel: 'Duplicates'
                                },
                                { label: 'Name Changes', value: results.name_changes, color: 'text-purple-500' },
                                { label: 'Activity Logs', value: results.activity_logs, color: 'text-orange-500' },
                                { label: 'Vehicles Added', value: results.vehicles_added ?? 0, color: 'text-emerald-500' },
                                { label: 'Vehicles Updated', value: results.vehicles_updated ?? 0, color: 'text-cyan-500' },
                            ].map((item: any, idx) => (
                                <div key={idx} className="p-6 text-center flex flex-col justify-center">
                                    <div className={`text-2xl font-black mb-1 ${item.color}`}>{item.value}</div>
                                    <div className="text-[8px] text-muted font-black uppercase tracking-widest">{item.label}</div>
                                    {item.subValue > 0 && (
                                        <div className="mt-3 pt-3 border-t border-border/50">
                                            <div className="text-xs font-black text-muted/60 leading-none mb-1">{item.subValue}</div>
                                            <div className="text-[6px] text-muted/40 font-black uppercase tracking-widest">{item.subLabel}</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Leader Automation Section */}
                {isLeader && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Automation Settings Card */}
                        <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-8 flex flex-col gap-6 h-fit">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center text-accent">
                                    <Settings size={20} />
                                </div>
                                <div>
                                    <h3 className="text-md font-black uppercase tracking-tight">Automation Settings</h3>
                                    <p className="text-[9px] text-muted font-black uppercase tracking-widest">Faction Leader Dashboard</p>
                                </div>
                            </div>

                            <form onSubmit={handleSaveAutomation} className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
                                    <div>
                                        <label htmlFor="automation-enabled" className="text-xs font-black uppercase tracking-wider text-text block">Enable Sync Automation</label>
                                        <span className="text-[9px] text-muted font-bold uppercase tracking-wider">Triggers automated sync at intervals</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            id="automation-enabled"
                                            type="checkbox" 
                                            checked={automation.enabled} 
                                            onChange={(e) => setAutomation({ ...automation, enabled: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="automation-frequency" className="text-xs font-black uppercase tracking-wider text-muted">Sync Frequency</label>
                                    <select
                                        id="automation-frequency"
                                        value={automation.frequency}
                                        onChange={(e) => setAutomation({ ...automation, frequency: e.target.value })}
                                        disabled={!automation.enabled}
                                        className="w-full bg-surface border border-border text-text rounded-xl p-3 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-accent disabled:opacity-40"
                                    >
                                        <option value="daily">Once a day (Daily)</option>
                                        <option value="every_2_days">Every 2 days (Every 48h)</option>
                                        <option value="every_3_days">Every 3 days (Every 72h)</option>
                                        <option value="weekly">Once a week (Weekly)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="automation-time" className="text-xs font-black uppercase tracking-wider text-muted">Daily Time / Alignment Offset</label>
                                    <div className="relative">
                                        <input
                                            id="automation-time"
                                            type="time"
                                            value={automation.time_of_day || '00:00'}
                                            onChange={(e) => setAutomation({ ...automation, time_of_day: e.target.value })}
                                            disabled={!automation.enabled}
                                            className="w-full bg-surface border border-border text-text rounded-xl p-3 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-accent disabled:opacity-40"
                                        />
                                        <Clock size={16} className="absolute right-3 top-3.5 text-muted pointer-events-none" />
                                    </div>
                                    <p className="text-[8px] text-muted font-bold uppercase tracking-widest mt-1">
                                        Use this to align execution schedule (e.g. daily at 04:00, or alignment anchor for intervals).
                                    </p>
                                </div>

                                {automation.enabled && automation.next_run_at && (
                                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl flex items-center gap-3">
                                        <Clock className="text-accent shrink-0" size={16} />
                                        <div className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                            <span className="text-muted block">Next execution scheduled:</span>
                                            <span className="text-text block font-black">{formatDateTime(automation.next_run_at)}</span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={savingSettings}
                                    className="w-full py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] transition disabled:opacity-40"
                                >
                                    {savingSettings ? 'Saving...' : 'Save Settings'}
                                </button>
                            </form>
                        </div>

                        {/* Sync History Logs Table */}
                        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-8 flex flex-col gap-6">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center text-accent">
                                        <History size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-md font-black uppercase tracking-tight">Sync Execution History</h3>
                                        <p className="text-[9px] text-muted font-black uppercase tracking-widest">Recent sync triggers & results</p>
                                    </div>
                                </div>
                                <button
                                    onClick={fetchAutomationAndLogs}
                                    disabled={loadingSettings}
                                    className="p-2 bg-surface hover:bg-border/30 rounded-lg text-muted hover:text-text transition"
                                    title="Refresh History"
                                >
                                    <RefreshCw size={14} className={loadingSettings ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-border text-[9px] text-muted font-black uppercase tracking-wider">
                                            <th className="pb-3 pr-2">Date / Time</th>
                                            <th className="pb-3 px-2">Type</th>
                                            <th className="pb-3 px-2">Triggered By</th>
                                            <th className="pb-3 px-2">Status</th>
                                            <th className="pb-3 pl-2">Details / Error</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {logs.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-muted uppercase font-black tracking-widest text-[10px]">
                                                    No execution logs found.
                                                </td>
                                            </tr>
                                        ) : (
                                            logs.map((log) => {
                                                const isSuccess = log.status === 'success';
                                                return (
                                                    <tr key={log.id} className="text-text hover:bg-surface/30 transition">
                                                        <td className="py-3.5 pr-2 font-bold whitespace-nowrap text-muted text-[10px] flex items-center gap-2">
                                                            <Calendar size={12} />
                                                            {formatDateTime(log.started_at)}
                                                        </td>
                                                        <td className="py-3.5 px-2">
                                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                                                log.trigger_type === 'automated' 
                                                                    ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' 
                                                                    : 'bg-accent/10 text-accent border-accent/20'
                                                            }`}>
                                                                {log.trigger_type}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-2 font-black uppercase text-[10px] whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5">
                                                                <User size={12} className="text-muted" />
                                                                {log.trigger_type === 'automated' 
                                                                    ? 'System' 
                                                                    : (log.user?.name || log.user?.username || 'Unknown')}
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-2">
                                                            <div className="flex items-center gap-1">
                                                                {isSuccess ? (
                                                                    <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                                                                ) : (
                                                                    <XCircle size={12} className="text-danger shrink-0" />
                                                                )}
                                                                <span className={`text-[9px] font-black uppercase tracking-wider ${isSuccess ? 'text-green-500' : 'text-danger'}`}>
                                                                    {log.status}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 pl-2 font-bold max-w-xs truncate text-[10px]">
                                                            {isSuccess ? (
                                                                <span className="text-muted">
                                                                    +{log.results?.added || 0} Added, ~{log.results?.updated || 0} Updated, -{log.results?.removed || 0} Removed
                                                                </span>
                                                            ) : (
                                                                <span className="text-danger" title={log.error}>
                                                                    {log.error || 'Unknown Error'}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Information Card */}
                <div className="bg-surface border border-border rounded-2xl p-6 flex items-start gap-4">
                    <AlertTriangle size={24} className="text-accent shrink-0" />
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-text">Integration Information</h4>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest leading-relaxed">
                            The GTA World integration uses the access token of the administrator who performed the link. 
                            Synchronization ensures that the <span className="text-text">Characters Database</span> accurately reflects the current faction roster. 
                            Any character not found in the GTA:W roster will be automatically soft-deleted from the Characters Database.
                        </p>
                    </div>
                </div>
            </div>

            {!user.gtaw_linked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10">
                    <div className="bg-card border border-border rounded-3xl p-12 shadow-2xl flex flex-col items-center max-w-md w-full">
                        <div className="w-20 h-20 bg-accent/20 rounded-2xl flex items-center justify-center text-accent mb-8 shadow-2xl shadow-accent/20 border border-accent/30">
                            <ShieldAlert size={40} />
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-tight mb-4 text-center">Account Not Linked</h3>
                        <p className="text-sm text-muted font-bold uppercase tracking-widest leading-relaxed text-center mb-8">
                            You must be logged in via GTA World to access synchronization features. This is required to securely communicate with the UCP API.
                        </p>
                        <button 
                            onClick={() => {
                                localStorage.removeItem('access_token');
                                window.location.href = '/login';
                            }}
                            className="w-full py-4 bg-accent text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] transition shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Relog with GTA:W
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GtawSync;

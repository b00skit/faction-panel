import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Form, FormPermission } from '../../../types';
import { Shield, Plus, Trash2, X, Users, Key, Search, Info } from 'lucide-react';
import api from '../../../api';
import toast from 'react-hot-toast';

interface FormPermissionsModalProps {
    form: Form;
    shortname: string;
    onClose: () => void;
}

const FORM_PERMISSIONS = [
    { key: 'view_form', name: 'View Form', description: 'Ability to see the form exists, but not necessarily access it' },
    { key: 'submit_form', name: 'Access/Submit Form', description: 'Ability to actually view and submit the form' },
    { key: 'view_submissions', name: 'View Submissions', description: 'Ability to see other users submitted forms' },
    { key: 'modify_submissions', name: 'Modify Submissions', description: 'Ability to edit someone else\'s form submission' },
    { key: 'modify_status', name: 'Modify Status', description: 'Ability to change submission status (mark, comment, etc.)' },
    { key: 'form_editor', name: 'Form Editor', description: 'Ability to modify the form structure and settings' },
    { key: 'modify_form_permissions', name: 'Modify Permissions', description: 'Ability to change these permissions' },
];

const FormPermissionsModal: React.FC<FormPermissionsModalProps> = ({ form, shortname, onClose }) => {
    const [permissions, setPermissions] = useState<FormPermission[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        try {
            const [permsRes, rolesRes, groupsRes] = await Promise.allSettled([
                api.get(`/factions/${shortname}/forms/${form.id}/permissions`),
                api.get(`/factions/${shortname}/roles`),
                api.get(`/factions/${shortname}/groups`)
            ]);
            if (permsRes.status === 'fulfilled') setPermissions(permsRes.value.data);
            else toast.error('Failed to fetch form permissions');

            if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.data);
            if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value.data);
        } catch (err) {
            toast.error('Failed to fetch permissions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleUpdatePermission = async (target: { group_id: number | null, role_id: number | null }, permKey: string) => {
        const existing = permissions.find(p => p.group_id === target.group_id && p.role_id === target.role_id);
        const currentPerms = existing ? [...existing.permissions] : [];
        
        const newPerms = currentPerms.includes(permKey)
            ? currentPerms.filter(k => k !== permKey)
            : [...currentPerms, permKey];

        try {
            const res = await api.put(`/factions/${shortname}/forms/${form.id}/permissions`, {
                group_id: target.group_id,
                role_id: target.role_id,
                permissions: newPerms
            });

            if (existing) {
                setPermissions(permissions.map(p => p.id === existing.id ? res.data : p));
            } else {
                setPermissions([...permissions, res.data]);
            }
        } catch (err) {
            toast.error('Failed to update permission');
        }
    };

    const handleDeletePermission = async (id: number) => {
        try {
            await api.delete(`/factions/${shortname}/forms/${form.id}/permissions/${id}`);
            setPermissions(permissions.filter(p => p.id !== id));
            toast.success('Permission set removed');
        } catch (err) {
            toast.error('Failed to remove permission');
        }
    };

    const getPermissionSet = (group_id: number | null, role_id: number | null) => {
        return permissions.find(p => p.group_id === group_id && p.role_id === role_id)?.permissions || [];
    };

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/20 backdrop-blur-md"
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden relative"
            >
                <div className="p-6 border-b border-border flex justify-between items-center bg-bg/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/10 text-accent rounded-lg">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text">Form Permissions</h2>
                            <p className="text-xs text-text-muted font-medium uppercase tracking-widest">Manage who can see and interact with this form</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-bg rounded-full text-text-muted hover:text-text transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6 bg-bg/20">
                    <div className="grid grid-cols-1 gap-8">
                        {/* Summary Info */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-4 items-start">
                            <Info size={20} className="text-blue-500 mt-1" />
                            <p className="text-sm text-text-muted leading-relaxed">
                                Permissions are cumulative. If a user belongs to multiple roles or groups, they will receive the combined permissions of all of them. <span className="text-blue-500 font-bold">Faction Leaders and Administrators always have full access.</span>
                            </p>
                        </div>

                        {/* Public Access */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 px-2">
                                <Users size={18} className="text-accent" />
                                <h3 className="text-sm font-bold text-text uppercase tracking-widest">Public / Guest Access</h3>
                            </div>
                            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                                <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                                    {FORM_PERMISSIONS.map(perm => (
                                        <button 
                                            key={perm.key}
                                            onClick={() => handleUpdatePermission({ group_id: null, role_id: null }, perm.key)}
                                            className={`p-3 rounded-lg border text-center flex flex-col items-center gap-2 transition-all ${getPermissionSet(null, null).includes(perm.key) ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-bg border-border text-text-muted hover:border-accent/50'}`}
                                            title={perm.description}
                                        >
                                            <div className="text-[10px] font-bold uppercase tracking-wider line-clamp-2 leading-tight">
                                                {perm.name}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Roles */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 px-2">
                                <Key size={18} className="text-accent" />
                                <h3 className="text-sm font-bold text-text uppercase tracking-widest">Role Permissions</h3>
                            </div>
                            <div className="space-y-3">
                                {roles.filter(r => r.name !== 'Administrator').map(role => (
                                    <div key={role.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                                        <div className="p-3 bg-bg/30 border-b border-border flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                                                <span className="text-sm font-bold text-text">{role.name}</span>
                                            </div>
                                            {permissions.some(p => p.role_id === role.id) && (
                                                <button 
                                                    onClick={() => handleDeletePermission(permissions.find(p => p.role_id === role.id)!.id)}
                                                    className="p-1.5 text-text-muted hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                                            {FORM_PERMISSIONS.map(perm => (
                                                <button 
                                                    key={perm.key}
                                                    onClick={() => handleUpdatePermission({ group_id: null, role_id: role.id }, perm.key)}
                                                    className={`p-3 rounded-lg border text-center flex flex-col items-center gap-2 transition-all ${getPermissionSet(null, role.id).includes(perm.key) ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-bg border-border text-text-muted hover:border-accent/50'}`}
                                                    title={perm.description}
                                                >
                                                    <div className="text-[10px] font-bold uppercase tracking-wider line-clamp-2 leading-tight">
                                                        {perm.name}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Groups */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 px-2">
                                <Users size={18} className="text-accent" />
                                <h3 className="text-sm font-bold text-text uppercase tracking-widest">Group Permissions</h3>
                            </div>
                            <div className="space-y-3">
                                {groups.map(group => (
                                    <div key={group.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                                        <div className="p-3 bg-bg/30 border-b border-border flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                                                <span className="text-sm font-bold text-text">{group.name}</span>
                                            </div>
                                            {permissions.some(p => p.group_id === group.id) && (
                                                <button 
                                                    onClick={() => handleDeletePermission(permissions.find(p => p.group_id === group.id)!.id)}
                                                    className="p-1.5 text-text-muted hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                                            {FORM_PERMISSIONS.map(perm => (
                                                <button 
                                                    key={perm.key}
                                                    onClick={() => handleUpdatePermission({ group_id: group.id, role_id: null }, perm.key)}
                                                    className={`p-3 rounded-lg border text-center flex flex-col items-center gap-2 transition-all ${getPermissionSet(group.id, null).includes(perm.key) ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-bg border-border text-text-muted hover:border-accent/50'}`}
                                                    title={perm.description}
                                                >
                                                    <div className="text-[10px] font-bold uppercase tracking-wider line-clamp-2 leading-tight">
                                                        {perm.name}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                <div className="p-6 border-t border-border bg-bg/50 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-accent text-white rounded font-bold uppercase tracking-widest text-xs hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
                    >
                        Done
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default FormPermissionsModal;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Loading from './Loading';
import { ArrowLeft, ScrollText, Edit2 } from 'lucide-react';

import { ChangelogEntry, User } from '../types';

interface ChangelogProps {
    siteVersion?: string;
    user?: User | null;
}

const Changelog: React.FC<ChangelogProps> = ({ siteVersion, user }) => {
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/changelog')
            .then(res => setEntries(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <Loading message="Loading changelog..." />;

    return (
        <div className="max-w-3xl mx-auto p-8 pb-20">
            <div className="mb-8">
                <Link
                    to="/"
                    className="flex items-center gap-2 text-accent text-[10px] font-bold uppercase tracking-widest mb-4 hover:gap-3 transition-all"
                >
                    <ArrowLeft size={14} />
                    Back
                </Link>
                <h1 className="text-4xl font-black tracking-tighter uppercase italic mb-1">Changelog</h1>
                <p className="text-muted text-xs font-bold uppercase tracking-[0.2em]">
                    Antelope{siteVersion ? ` v${siteVersion}` : ''}
                </p>
            </div>

            {entries.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-16 text-muted text-center">
                    <ScrollText size={48} className="opacity-10 mb-4" />
                    <p className="font-bold uppercase tracking-widest text-xs">No entries yet</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {entries.map(entry => (
                        <div key={entry.id} className="bg-card border border-border rounded-xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="font-mono text-[10px] font-black px-2 py-1 bg-accent/10 text-accent rounded">
                                    v{entry.version}
                                </span>
                                <h2 className="font-black text-base uppercase tracking-tight">{entry.title}</h2>
                                <span className="ml-auto text-[9px] text-muted font-bold uppercase tracking-widest">
                                    {new Date(entry.released_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                                {user?.is_superadmin && (
                                    <Link
                                        to={`/superadmin?tab=changelog&edit=${entry.id}`}
                                        className="p-1 hover:bg-accent/15 text-muted hover:text-accent border border-border/50 hover:border-accent/30 rounded-lg transition flex items-center justify-center shrink-0"
                                        title="Edit Entry"
                                    >
                                        <Edit2 size={12} />
                                    </Link>
                                )}
                            </div>
                            {entry.body && (
                                <div 
                                    className="text-sm text-muted leading-relaxed mb-4 html-content" 
                                    dangerouslySetInnerHTML={{ __html: entry.body }} 
                                />
                            )}
                            {entry.items && entry.items.length > 0 && (
                                <div className="space-y-4 mt-2">
                                    {(['Feature', 'Modification', 'Backend', 'Fix'] as const).map(type => {
                                        const typeItems = entry.items!.filter(item => item.type === type);
                                        if (typeItems.length === 0) return null;

                                        const config = {
                                            Feature: { label: 'Features', text: 'text-emerald-500 dark:text-emerald-400' },
                                            Modification: { label: 'Modifications', text: 'text-sky-500 dark:text-sky-400' },
                                            Backend: { label: 'Backend Improvements', text: 'text-indigo-500 dark:text-indigo-400' },
                                            Fix: { label: 'Fixes', text: 'text-danger dark:text-danger-active' },
                                        }[type];

                                        return (
                                            <div key={type} className="space-y-1.5">
                                                <h3 className={`text-[9px] font-black uppercase tracking-[0.15em] ${config.text} flex items-center gap-1.5`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                    {config.label}
                                                </h3>
                                                <ul className="space-y-1 pl-3 text-xs text-muted leading-relaxed list-none">
                                                    {typeItems.map((item, idx) => (
                                                        <li 
                                                            key={idx} 
                                                            className="relative pl-3 before:content-['•'] before:absolute before:left-0 before:text-muted/60"
                                                            dangerouslySetInnerHTML={{ __html: item.content }}
                                                        />
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Changelog;

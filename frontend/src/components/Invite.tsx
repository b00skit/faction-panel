import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Loading from './Loading';
import toast from 'react-hot-toast';
import { Shield, UserPlus, LogIn, UserCircle, Clock } from 'lucide-react';

const Invite: React.FC<{ user: any }> = ({ user }) => {
    const { code } = useParams();
    const navigate = useNavigate();
    const [faction, setFaction] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [gtawEnabled, setGtawEnabled] = useState(false);

    useEffect(() => {
        const fetchInvite = async () => {
            try {
                const [inviteRes, statusRes] = await Promise.all([
                    api.get(`/invites/${code}`),
                    api.get('/auth/registration-status')
                ]);
                setFaction(inviteRes.data);
                setGtawEnabled(statusRes.data.gtaw_oauth_enabled);
            } catch (err: any) {
                toast.error('Invalid or expired invite code');
                navigate('/');
            } finally {
                setLoading(false);
            }
        };
        fetchInvite();
    }, [code, navigate]);

    const handleJoin = async () => {
        if (!user) {
            navigate(`/login?redirect=/invite/${code}`);
            return;
        }

        setJoining(true);
        try {
            const res = await api.post(`/invites/${code}/join`);
            toast.success(res.data.message);
            navigate(`/${res.data.shortname}`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to join faction');
        } finally {
            setJoining(false);
        }
    };

    const handleGtawLogin = async () => {
        try {
            localStorage.setItem('gtaw_auth_redirect', `/invite/${code}`);
            const response = await api.get('/auth/gtaw/redirect');
            window.location.href = response.data.url;
        } catch (err) {
            toast.error('Failed to initialize GTA:W login');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center p-6 transition-colors duration-200">
                <div className="max-w-2xl w-full">
                    <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl min-h-[500px] flex flex-col items-center justify-center">
                        <Loading message="Validating Invite..." fullScreen={false} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6 transition-colors duration-200">
            <div className="max-w-2xl w-full">
                <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl">
                    <div className="h-3" style={{ backgroundColor: faction.color }} />
                    
                    <div className="p-10 lg:p-16">
                        <div className="flex flex-col items-center text-center mb-10">
                            {faction.image_url ? (
                                <img src={faction.image_url} alt={faction.name} className="w-[126px] h-[101px] object-contain mb-6" />
                            ) : (
                                <div className="p-5 bg-accent/10 rounded-2xl border border-accent/20 mb-6">
                                    <Shield className="text-accent" size={48} />
                                </div>
                            )}
                            
                            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-text mb-2">
                                You've been invited to join
                            </h1>
                            <h2 className="text-4xl font-extrabold text-accent uppercase tracking-tight">
                                {faction.name}
                            </h2>
                            <div className="flex flex-wrap justify-center gap-2 mt-4">
                                <p className="text-muted text-[10px] font-bold uppercase tracking-[0.1em] bg-surface px-4 py-1.5 rounded-full border border-border">
                                    {faction.shortname} &bull; {faction.access} organization
                                </p>
                                {faction.invite?.expires_at && (
                                    <p className="text-orange-500/80 text-[10px] font-bold uppercase tracking-[0.1em] bg-orange-500/5 px-4 py-1.5 rounded-full border border-orange-500/20 flex items-center gap-1.5">
                                        <Clock size={12} />
                                        Expires: {new Date(faction.invite.expires_at).toLocaleDateString()}
                                    </p>
                                )}
                                {faction.invite?.max_uses && (
                                    <p className="text-accent text-[10px] font-bold uppercase tracking-[0.1em] bg-accent/5 px-4 py-1.5 rounded-full border border-accent/20">
                                        Uses: {faction.invite.uses} / {faction.invite.max_uses}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="bg-surface/50 border border-border rounded-2xl p-8 mb-10">
                            <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">About this organization</h3>
                            <p className="text-text leading-relaxed italic">
                                {faction.description || "No description provided for this organization. By joining, you will be granted access to the internal roster and diagram tools."}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {user ? (
                                <button
                                    onClick={handleJoin}
                                    disabled={joining}
                                    className="w-full flex items-center justify-center gap-3 py-5 bg-accent hover:bg-accent/90 text-white font-black rounded-2xl transition-all shadow-xl shadow-accent/20 uppercase tracking-[0.2em] text-xs disabled:opacity-50"
                                >
                                    <UserPlus size={18} />
                                    {joining ? "Processing..." : "Confirm & Join Organization"}
                                </button>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Link
                                        to={`/login?redirect=/invite/${code}`}
                                        className="flex items-center justify-center gap-3 py-5 bg-surface border border-border hover:border-accent text-text font-black rounded-2xl transition-all uppercase tracking-[0.15em] text-[10px]"
                                    >
                                        <LogIn size={16} />
                                        Login to Join
                                    </Link>
                                    <Link
                                        to={`/register?redirect=/invite/${code}`}
                                        className="flex items-center justify-center gap-3 py-5 bg-accent hover:bg-accent/90 text-white font-black rounded-2xl transition-all shadow-xl shadow-accent/20 uppercase tracking-[0.15em] text-[10px]"
                                    >
                                        <UserCircle size={16} />
                                        Create Account
                                    </Link>
                                </div>
                            )}

                            {!user && gtawEnabled && (
                                <button
                                    onClick={handleGtawLogin}
                                    className="w-full flex items-center justify-center gap-3 py-5 bg-white hover:bg-white/90 text-black font-black rounded-2xl transition-all shadow-xl uppercase tracking-[0.15em] text-[10px]"
                                >
                                    <img src="/gtaw-logo.png" alt="GTA:W" className="w-5 h-5 object-contain" />
                                    Sign In via GTA:W
                                </button>
                            )}
                            
                            <Link to="/" className="block text-center text-muted hover:text-text transition-colors text-[10px] font-bold uppercase tracking-widest pt-4">
                                Back to landing page
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Invite;

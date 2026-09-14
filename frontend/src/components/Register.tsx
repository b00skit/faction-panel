import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import Loading from './Loading';
import { useGtawLogin } from '../hooks/useGtawLogin';

interface RegisterProps {
    onLogin: (token: string, user: any) => void;
    isEmbedded?: boolean;
}

const Register: React.FC<RegisterProps> = ({ onLogin, isEmbedded = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(true);
    const [registrationEnabled, setRegistrationEnabled] = useState(true);
    const [gtawEnabled, setGtawEnabled] = useState(false);

    const redirectPath = new URLSearchParams(location.search).get('redirect') || '/';
    const handleGtawLogin = useGtawLogin(redirectPath);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await api.get('/auth/registration-status');
                setRegistrationEnabled(res.data.allow_registration);
                setGtawEnabled(res.data.gtaw_oauth_enabled);
            } catch (err) {
                console.error('Failed to check registration status');
            } finally {
                setStatusLoading(false);
            }
        };
        checkStatus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== passwordConfirmation) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const response = await api.post('/register', { 
                username, 
                password, 
                password_confirmation: passwordConfirmation 
            });
            onLogin(response.data.access_token, response.data.user);
            toast.success('Account created successfully!');
            if (!isEmbedded) {
                navigate(redirectPath);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    if (statusLoading && !isEmbedded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg p-4 transition-colors duration-200">
                <div className="max-w-md w-full p-10 bg-card rounded-2xl shadow-2xl border border-border min-h-[400px] flex flex-col justify-center">
                    <h2 className="text-3xl font-black text-text mb-8 text-center uppercase italic tracking-tighter">
                        Faction <span className="text-accent">Panel</span>
                    </h2>
                    <Loading message="Loading System..." fullScreen={false} />
                </div>
            </div>
        );
    }

    if (!registrationEnabled && !isEmbedded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg p-4 transition-colors duration-200">
                <div className="max-w-md w-full p-10 bg-card rounded-2xl shadow-2xl border border-border text-center">
                    <h2 className="text-3xl font-black text-text mb-6 uppercase italic tracking-tighter">Access Denied</h2>
                    <p className="text-muted text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                        Public registration is currently disabled by the system administrator. 
                        Please contact an organization leader for access.
                    </p>
                    <Link to="/" className="mt-8 inline-block px-8 py-3 bg-accent text-white font-bold rounded-xl uppercase tracking-widest text-[10px]">
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    const content = (
        <div className={`${isEmbedded ? '' : 'max-w-md w-full p-10 bg-card rounded-2xl shadow-2xl border border-border min-h-[400px] flex flex-col justify-center'}`}>
            {!isEmbedded && (
                <h2 className="text-3xl font-black text-text mb-8 text-center uppercase italic tracking-tighter">
                    Faction <span className="text-accent">Panel</span>
                </h2>
            )}

            {statusLoading ? (
                <Loading message="Loading System..." fullScreen={false} />
            ) : (
                <>
                    <div className="mb-8">
                        <h3 className="text-2xl font-black text-text uppercase tracking-tighter italic">Create Account</h3>
                        <p className="text-muted text-[11px] font-bold uppercase tracking-widest mt-1">Join the network to manage organizations.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-muted mb-2 text-[10px] uppercase font-bold tracking-widest">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-4 bg-surface text-text rounded-xl border border-border focus:border-accent outline-none transition-all text-sm"
                                placeholder="Pick a username"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-muted mb-2 text-[10px] uppercase font-bold tracking-widest">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-4 bg-surface text-text rounded-xl border border-border focus:border-accent outline-none transition-all text-sm"
                                placeholder="At least 8 characters"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-muted mb-2 text-[10px] uppercase font-bold tracking-widest">Confirm Password</label>
                            <input
                                type="password"
                                value={passwordConfirmation}
                                onChange={(e) => setPasswordConfirmation(e.target.value)}
                                className="w-full p-4 bg-surface text-text rounded-xl border border-border focus:border-accent outline-none transition-all text-sm"
                                placeholder="Repeat password"
                                required
                            />
                        </div>
                        {error && <p className="text-danger text-[10px] font-bold uppercase tracking-widest bg-danger/10 p-3 rounded-lg border border-danger/20">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-accent hover:bg-accent/90 text-white font-black rounded-xl transition duration-200 disabled:opacity-50 uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-accent/20"
                        >
                            {loading ? 'Creating Account...' : 'Register System'}
                        </button>

                        {gtawEnabled && (
                            <div className="space-y-4">
                                <div className="relative py-2">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                                    <div className="relative flex justify-center text-[8px] uppercase font-black tracking-[0.3em]"><span className="bg-card px-4 text-muted">Or Connect With</span></div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleGtawLogin}
                                    className="w-full py-4 bg-white hover:bg-white/90 text-black font-bold rounded-xl transition duration-200 uppercase tracking-[0.2em] text-[10px] shadow-lg flex items-center justify-center gap-3"
                                >
                                    <img src="/gtaw-logo.png" alt="GTA:W" className="w-5 h-5 object-contain" />
                                    Login via GTA:W
                                </button>
                            </div>
                        )}
                        {!isEmbedded && (
                            <div className="text-center pt-2 space-y-3">
                                <Link to={`/login${location.search}`} className="text-accent hover:text-accent/80 text-[10px] font-bold uppercase tracking-widest transition-colors block">
                                    Already have an account? Sign In
                                </Link>
                                <Link to="/welcome" className="text-muted hover:text-text text-[9px] font-bold uppercase tracking-widest transition-colors block">
                                    About Project Antelope
                                </Link>
                            </div>
                        )}
                    </form>
                </>
            )}
        </div>
    );

    if (isEmbedded) return content;

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg p-4 transition-colors duration-200">
            {content}
        </div>
    );
};

export default Register;

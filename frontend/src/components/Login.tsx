import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import Loading from './Loading';
import { useGtawLogin } from '../hooks/useGtawLogin';

interface LoginProps {
    onLogin: (token: string, user: any) => void;
    isEmbedded?: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, isEmbedded = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(true);
    const [gtawEnabled, setGtawEnabled] = useState(false);

    const redirectPath = new URLSearchParams(location.search).get('redirect') || '/';
    const handleGtawLogin = useGtawLogin(redirectPath);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await api.get('/auth/registration-status');
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
        setLoading(true);

        try {
            const response = await api.post('/login', { username, password });
            onLogin(response.data.access_token, response.data.user);
            if (!isEmbedded) {
                navigate(redirectPath);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    const content = (
        <div className={`${isEmbedded ? '' : 'max-w-md w-full p-10 bg-card rounded-2xl shadow-2xl border border-border min-h-[400px] flex flex-col justify-center'}`}>
            {!isEmbedded && <h2 className="text-3xl font-black text-text mb-8 text-center uppercase italic tracking-tighter">Faction <span className="text-accent">Panel</span></h2>}
            
            {statusLoading ? (
                <Loading message="Loading System..." fullScreen={false} />
            ) : (
                <>
                    <div className="mb-8">
                        <h3 className="text-2xl font-black text-text uppercase tracking-tighter italic">Welcome back</h3>
                        <p className="text-muted text-[11px] font-bold uppercase tracking-widest mt-1">Please enter your details to sign in.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-muted mb-2 text-[10px] uppercase font-bold tracking-widest">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-4 bg-surface text-text rounded-xl border border-border focus:border-accent outline-none transition-all text-sm"
                                placeholder="Enter username"
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
                                placeholder="Enter password"
                                required
                            />
                        </div>
                        {error && <p className="text-danger text-[10px] font-bold uppercase tracking-widest bg-danger/10 p-3 rounded-lg border border-danger/20">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl transition duration-200 disabled:opacity-50 uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-accent/20"
                        >
                            {loading ? 'Authenticating...' : 'Sign In System'}
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
                            <div className="text-center pt-4 space-y-3">
                                <Link to={`/register${location.search}`} className="text-accent hover:text-accent/80 text-[10px] font-bold uppercase tracking-widest transition-colors block">
                                    Don't have an account? Register
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
        <div className="min-h-screen flex items-center justify-center bg-bg p-4">
            {content}
        </div>
    );
};

export default Login;

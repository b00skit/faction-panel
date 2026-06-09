import React, { useState, useEffect } from 'react';
import Login from './Login';
import Register from './Register';
import Loading from './Loading';
import api from '../api';
import { Shield, Users, Globe, Moon, Sun, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HomeProps {
    onLogin: (token: string, user: any) => void;
    isDark: boolean;
    toggleTheme: () => void;
    siteVersion?: string;
}

const Home: React.FC<HomeProps> = ({ onLogin, isDark, toggleTheme, siteVersion = '1.0.0' }) => {
    const [view, setView] = useState<'login' | 'register'>('login');
    const [loading, setLoading] = useState(true);
    const [registrationEnabled, setRegistrationEnabled] = useState(true);
    const [gtawEnabled, setGtawEnabled] = useState(false);
    
    const words = ['organization', 'faction', 'business', 'group', 'department'];
    const [currentWord, setCurrentWord] = useState(words[0]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentWord(prev => {
                const currentIndex = words.indexOf(prev);
                return words[(currentIndex + 1) % words.length];
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await api.get('/auth/registration-status');
                setRegistrationEnabled(res.data.allow_registration);
                setGtawEnabled(res.data.gtaw_oauth_enabled);
            } catch (err) {
                console.error('Failed to check registration status');
            } finally {
                setLoading(false);
            }
        };
        checkStatus();
    }, []);

    return (
        <div className="min-h-screen bg-bg text-text selection:bg-accent/30 transition-colors duration-200">
            {/* Theme Toggle for Landing Page */}
            <div className="fixed top-6 right-6 z-[500]">
                <button 
                    onClick={toggleTheme}
                    className="p-2.5 bg-surface border border-border rounded-xl shadow-lg hover:border-accent transition-all text-muted hover:text-accent"
                >
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

            <div className="flex flex-col lg:flex-row min-h-screen">
                {/* Left Side: Marketing/Info */}
                <div className="flex-1 flex flex-col justify-center p-8 lg:p-24 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
                    
                    <div className="max-w-xl relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-accent/10 rounded-xl border border-accent/20">
                                <Shield className="text-accent" size={32} />
                            </div>
                            <h1 className="text-4xl font-black tracking-tighter uppercase italic text-text">
                                Faction <span className="text-accent">Panel</span>
                            </h1>
                        </div>
                        
                        <h2 className="text-5xl font-extrabold mb-6 leading-tight text-text">
                            <span className="flex items-center gap-x-[0.2em] whitespace-nowrap">
                                <span>Manage your</span>
                                <span className="relative inline-block min-w-[280px] h-[1.2em] overflow-hidden">
                                    {words.map((word) => {
                                        const isCurrent = currentWord === word;
                                        const currentIndex = words.indexOf(currentWord);
                                        const wordIndex = words.indexOf(word);
                                        const isPrevious = wordIndex === (currentIndex === 0 ? words.length - 1 : currentIndex - 1);

                                        return (
                                            <span
                                                key={word}
                                                className={`absolute left-0 transition-all duration-700 ease-in-out ${
                                                    isCurrent 
                                                        ? 'opacity-100 translate-y-0' 
                                                        : isPrevious
                                                            ? 'opacity-0 -translate-y-8'
                                                            : 'opacity-0 translate-y-8'
                                                }`}
                                            >
                                                {word}
                                            </span>
                                        );
                                    })}
                                </span>
                            </span>
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent/60">
                                with ease.
                            </span>
                        </h2>
                        
                        <p className="text-muted text-lg mb-12 leading-relaxed">
                            A centralized hub for factions, departments, and organizations. 
                            Stop wasting time with messy setups and start managing your operations with ease.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex gap-4">
                                <div className="p-2 bg-surface border border-border rounded-lg h-fit">
                                    <Users size={20} className="text-accent" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-text uppercase text-xs tracking-widest mb-1">Roster Control</h4>
                                    <p className="text-muted text-sm">Track your people in real-time with dynamic diagrams.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="p-2 bg-surface border border-border rounded-lg h-fit">
                                    <Globe size={20} className="text-accent" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-text uppercase text-xs tracking-widest mb-1">Multi-Environment</h4>
                                    <p className="text-muted text-sm">Built to handle multiple independent faction setups simultaneously.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Login/Register Form */}
                <div className="lg:w-[500px] flex items-center justify-center p-8 bg-surface/50 backdrop-blur-xl border-l border-border relative">
                    <div className="w-full max-sm:max-w-xs">
                        {loading ? (
                            <Loading message="Initializing System..." fullScreen={false} />
                        ) : (
                            <>
                                {view === 'login' ? (
                                    <>
                                        <Login onLogin={onLogin} isEmbedded={true} />
                                        {!gtawEnabled && registrationEnabled && (
                                            <div className="text-center mt-6">
                                                <button 
                                                    onClick={() => setView('register')}
                                                    className="text-accent hover:text-accent/80 text-[10px] font-bold uppercase tracking-widest transition-colors"
                                                >
                                                    Don't have an account? Register
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Register onLogin={onLogin} isEmbedded={true} />
                                        <div className="text-center mt-6">
                                            <button 
                                                onClick={() => setView('login')}
                                                className="text-accent hover:text-accent/80 text-[10px] font-bold uppercase tracking-widest transition-colors"
                                            >
                                                Already have an account? Sign In
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        
                        <div className="mt-8 pt-8 border-t border-border/50 text-center flex flex-col items-center">
                            <Link 
                                to="/welcome"
                                className="inline-flex items-center gap-2 mb-2 text-muted hover:text-accent text-[10px] font-bold uppercase tracking-widest transition-colors"
                            >
                                <span className="p-1 bg-accent/5 rounded border border-accent/10"><Globe size={12} className="text-accent" /></span>
                                Learn more about Project Antelope
                            </Link>
                            <Link 
                                to="/help"
                                className="inline-flex items-center gap-2 mb-2 text-muted hover:text-accent text-[10px] font-bold uppercase tracking-widest transition-colors"
                            >
                                <HelpCircle size={14} />
                                Need help? Visit Help Center
                            </Link>
                            <Link 
                                to="/credits"
                                className="inline-flex items-center gap-2 mb-4 text-muted hover:text-accent text-[10px] font-bold uppercase tracking-widest transition-colors"
                            >
                                <Shield size={14} />
                                Project Contributors & Credits
                            </Link>
                            <p className="text-muted text-[9px] uppercase tracking-[0.2em] font-bold">
                                &copy; 2025-{new Date().getFullYear() + 1} Faction Panel. <Link to="/changelog" className="hover:text-accent transition-colors">Antelope v{siteVersion}</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;

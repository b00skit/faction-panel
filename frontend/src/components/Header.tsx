import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Moon, Sun, LogOut, User, LogIn, ChevronDown, Settings, LayoutGrid, ShieldAlert, HelpCircle, Contrast, UserPlus, Bell, CheckCheck, ExternalLink } from 'lucide-react';
import QuickSearch from './QuickSearch';
import api from '../api';
import toast from 'react-hot-toast';
import echo from '../echo';

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  highContrast: boolean;
  toggleContrast: () => void;
  factionName: string;
  bannerLogoDark?: string | null;
  bannerLogoLight?: string | null;
  branding?: {
    header_link_to_faction: boolean;
    hide_panel_header: boolean;
    header_bg_color: string | null;
    header_gradient_enabled: boolean;
    header_gradient_color: string | null;
    header_gradient_direction: string;
    shortname: string;
    access?: string;
    quick_search_enabled?: boolean;
    quick_search_settings?: {
        database_id: number | null;
        column_id: string | null;
        exact_match_only: boolean;
    };
  };
  user: any;
  userRole?: any;
  permissions?: string[];
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
    isDark, 
    toggleTheme, 
    highContrast,
    toggleContrast,
    factionName, 
    bannerLogoDark, 
    bannerLogoLight, 
    branding, 
    user, 
    userRole, 
    permissions, 
    onLogout 
}) => {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [joining, setJoining] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isSuperAdmin = user?.is_superadmin;
  const roleColor = userRole?.color || 'var(--muted)';
  const isFactionPage = !!branding?.shortname;
  const activeBanner = isDark ? bannerLogoDark : (bannerLogoLight || bannerLogoDark);
  const canJoin = isFactionPage && user && !userRole && branding?.access === 'joinable';

  // Notifications State & Hooks
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasFactionAccess, setHasFactionAccess] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState('system_user');
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unread_count);
      setHasFactionAccess(res.data.has_faction_access);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const userChannel = `App.Models.User.${user.id}`;
    echo.private(userChannel)
      .listen('.notification.created', (e: any) => {
        setNotifications(prev => [e, ...prev]);
        setUnreadCount(prev => prev + 1);
        toast.success(`Notification: ${e.title}`, {
          icon: '🔔',
          duration: 4000
        });
      });

    return () => {
      echo.leave(userChannel);
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutsideNotif = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideNotif);
    return () => document.removeEventListener('mousedown', handleClickOutsideNotif);
  }, []);

  const toggleNotifDropdown = async () => {
    const nextShow = !showNotifications;
    setShowNotifications(nextShow);
    if (nextShow) {
      await fetchNotifications();
      if (!hasFactionAccess) {
        try {
          await api.post('/notifications/read-all');
          setUnreadCount(0);
          setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
          console.error(err);
        }
      } else {
        if (activeTab === 'system_user') {
          markSystemUserRead();
        } else {
          const schemeId = parseInt(activeTab);
          if (!isNaN(schemeId)) {
            markSchemeRead(schemeId);
          }
        }
      }
    }
  };

  const markSystemUserRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev =>
        prev.map(n => (n.type !== 'faction' ? { ...n, is_read: true } : n))
      );
      setTimeout(recalculateUnread, 100);
    } catch (err) {
      console.error(err);
    }
  };

  const markSchemeRead = async (schemeId: number) => {
    try {
      await api.post(`/notifications/schemes/${schemeId}/read-all`);
      setNotifications(prev =>
        prev.map(n => (n.notification_scheme_id === schemeId ? { ...n, is_read: true } : n))
      );
      setTimeout(recalculateUnread, 100);
    } catch (err) {
      console.error(err);
    }
  };

  const recalculateUnread = () => {
    setNotifications(prev => {
      const unread = prev.filter(n => !n.is_read).length;
      setUnreadCount(unread);
      return prev;
    });
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      try {
        await api.post(`/notifications/${notif.id}/read`);
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setTimeout(recalculateUnread, 100);
      } catch (err) {
        console.error(err);
      }
    }

    if (notif.data) {
      const short = notif.faction_shortname || branding?.shortname;
      if (notif.data.database_id) {
        navigate(`/${short}/records?database=${notif.data.database_id}`);
      } else if (notif.data.roster_id) {
        navigate(`/${short}/roster?roster=${notif.data.roster_id}`);
      } else if (notif.data.faction_shortname) {
        navigate(`/${notif.data.faction_shortname}/roster`);
      }
    }
    setShowNotifications(false);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'system_user') {
      markSystemUserRead();
    } else {
      const schemeId = parseInt(tab);
      if (!isNaN(schemeId)) {
        markSchemeRead(schemeId);
      }
    }
  };

  const uniqueSchemes = Array.from(
    new Map(
      notifications
        .filter(n => n.type === 'faction' && n.notification_scheme_id)
        .map(n => [n.notification_scheme_id, { id: n.notification_scheme_id, name: n.scheme_name }])
    ).values()
  );

  const handleJoin = async () => {
    setJoining(true);
    try {
      await api.post('/factions/join', { shortname: branding!.shortname });
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to join faction');
      setJoining(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getHeaderStyle = () => {
    if (!branding?.header_bg_color) return {};
    
    if (branding.header_gradient_enabled && branding.header_gradient_color) {
      return {
        background: `linear-gradient(${branding.header_gradient_direction.replace('to-', 'to ')}, ${branding.header_bg_color}, ${branding.header_gradient_color})`,
        borderBottom: 'none'
      };
    }
    
    return {
      backgroundColor: branding.header_bg_color,
      borderBottom: 'none'
    };
  };

  const handlePanelLogoClick = () => {
    if (branding?.header_link_to_faction && branding.shortname) {
      navigate(`/${branding.shortname}/roster`);
    } else {
      navigate('/');
    }
  };

  const handleFactionLogoClick = () => {
    if (branding?.shortname) {
      navigate(`/${branding.shortname}/roster`);
    }
  };

  return (
    <header 
      className="topbar h-[var(--nav-h)] bg-surface border-b border-border flex items-center px-6 gap-2.5 sticky top-0 z-[300] shrink-0"
      style={getHeaderStyle()}
    >
      {!branding?.hide_panel_header && (
        <div 
          onClick={handlePanelLogoClick}
          className="logo flex items-center gap-2 text-accent font-black uppercase italic tracking-tighter text-lg hover:opacity-80 transition-opacity cursor-pointer"
        >
          <Shield size={20} fill="currentColor" fillOpacity={0.2} />
          Faction Panel
        </div>
      )}

      {isFactionPage && (
        <div 
            className={`flex items-center h-[30px] pl-2.5 cursor-pointer hover:opacity-80 transition-opacity ${!branding?.hide_panel_header ? 'ml-1.5 border-l border-border' : ''}`}
            onClick={handleFactionLogoClick}
        >
            {activeBanner ? (
            <img src={activeBanner} alt={factionName} className="max-h-[25px] max-w-[250px] w-auto object-contain drop-shadow-sm" />
            ) : (
            <span className="text-[10px] font-semibold tracking-wider uppercase text-muted">
                {factionName}
            </span>
            )}
        </div>
      )}

      <div className="flex-1" />

      {branding?.quick_search_enabled && branding?.quick_search_settings && (user?.is_superadmin || permissions?.includes('view_faction_records')) && (
        <div className="mr-4">
            <QuickSearch shortname={branding.shortname} settings={branding.quick_search_settings} />
        </div>
      )}

      {canJoin && (
        <button
          onClick={handleJoin}
          disabled={joining}
          className="flex items-center gap-1.5 text-[9px] font-black tracking-widest uppercase px-3 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg transition-all shadow-lg shadow-accent/20 disabled:opacity-50 mr-2"
        >
          <UserPlus size={12} />
          {joining ? '...' : 'Join Faction'}
        </button>
      )}

      {user && (
        <div className="relative" ref={notifRef}>
          <button
            onClick={toggleNotifDropdown}
            className={`p-1.5 transition-colors flex items-center gap-1.5 mr-2 relative rounded-lg ${showNotifications ? 'text-accent bg-border/20' : 'text-muted hover:text-accent hover:bg-border/10'}`}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center border-2 border-surface animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div 
              className={`absolute right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-[400] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${hasFactionAccess ? 'w-[540px]' : 'w-80'}`}
              style={{ top: '100%' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-text">Notifications</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={async () => {
                      if (!hasFactionAccess) {
                        try {
                          await api.post('/notifications/read-all');
                          setNotifications(prev => prev.map(n => ({...n, is_read: true})));
                          setUnreadCount(0);
                        } catch (err) {
                          console.error(err);
                        }
                      } else {
                        if (activeTab === 'system_user') {
                          markSystemUserRead();
                        } else {
                          markSchemeRead(parseInt(activeTab));
                        }
                      }
                    }}
                    className="flex items-center gap-1 text-[9px] font-black uppercase text-accent hover:opacity-85 transition-opacity"
                  >
                    <CheckCheck size={11} />
                    Mark tab as read
                  </button>
                )}
              </div>

              {/* Body */}
              {!hasFactionAccess ? (
                <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-muted font-bold text-[10px] uppercase tracking-widest">No notifications</div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 text-left cursor-pointer transition-colors hover:bg-border/20 relative group ${!notif.is_read ? 'bg-accent/5' : ''}`}
                      >
                        {!notif.is_read && <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent" />}
                        <div className="pl-3">
                          <p className="text-[10px] font-bold text-text truncate pr-4">{notif.title}</p>
                          <p className="text-[9px] text-muted font-medium mt-0.5 line-clamp-2">{notif.message}</p>
                          <span className="text-[8px] text-muted/60 font-bold block mt-1.5">{new Date(notif.created_at).toLocaleString()}</span>
                        </div>
                        {notif.data && (
                          <ExternalLink size={10} className="absolute right-3 top-3 text-muted/40 group-hover:text-accent transition-colors" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-[180px_1fr] h-96">
                  {/* Left panel tabs */}
                  <div className="border-r border-border bg-surface/30 overflow-y-auto p-1.5 space-y-1">
                    <button
                      onClick={() => handleTabChange('system_user')}
                      className={`w-full text-left p-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${activeTab === 'system_user' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-border/30'}`}
                    >
                      <span className="truncate mr-1">System & User</span>
                      {notifications.filter(n => n.type !== 'faction' && !n.is_read).length > 0 && (
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${activeTab === 'system_user' ? 'bg-white text-accent' : 'bg-red-500 text-white'}`}>
                          {notifications.filter(n => n.type !== 'faction' && !n.is_read).length}
                        </span>
                      )}
                    </button>

                    {uniqueSchemes.map((scheme: any) => {
                      const count = notifications.filter(n => n.notification_scheme_id === scheme.id && !n.is_read).length;
                      return (
                        <button
                          key={scheme.id}
                          onClick={() => handleTabChange(String(scheme.id))}
                          className={`w-full text-left p-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${activeTab === String(scheme.id) ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-border/30'}`}
                        >
                          <span className="truncate mr-1">{scheme.name}</span>
                          {count > 0 && (
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${activeTab === String(scheme.id) ? 'bg-white text-accent' : 'bg-red-500 text-white'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Right panel list */}
                  <div className="overflow-y-auto divide-y divide-border/50 h-full">
                    {activeTab === 'system_user' ? (
                      notifications.filter(n => n.type !== 'faction').length === 0 ? (
                        <div className="h-full flex items-center justify-center p-8 text-center text-muted font-bold text-[10px] uppercase tracking-widest">No notifications</div>
                      ) : (
                        notifications.filter(n => n.type !== 'faction').map(notif => (
                          <div 
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3 text-left cursor-pointer transition-colors hover:bg-border/20 relative group ${!notif.is_read ? 'bg-accent/5' : ''}`}
                          >
                            {!notif.is_read && <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent" />}
                            <div className="pl-3">
                              <p className="text-[10px] font-bold text-text truncate pr-4">{notif.title}</p>
                              <p className="text-[9px] text-muted font-medium mt-0.5 line-clamp-2">{notif.message}</p>
                              <span className="text-[8px] text-muted/60 font-bold block mt-1.5">{new Date(notif.created_at).toLocaleString()}</span>
                            </div>
                            {notif.data && (
                              <ExternalLink size={10} className="absolute right-3 top-3 text-muted/40 group-hover:text-accent transition-colors" />
                            )}
                          </div>
                        ))
                      )
                    ) : (
                      notifications.filter(n => n.notification_scheme_id === parseInt(activeTab)).length === 0 ? (
                        <div className="h-full flex items-center justify-center p-8 text-center text-muted font-bold text-[10px] uppercase tracking-widest">No notifications</div>
                      ) : (
                        notifications.filter(n => n.notification_scheme_id === parseInt(activeTab)).map(notif => (
                          <div 
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3 text-left cursor-pointer transition-colors hover:bg-border/20 relative group ${!notif.is_read ? 'bg-accent/5' : ''}`}
                          >
                            {!notif.is_read && <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent" />}
                            <div className="pl-3">
                              <p className="text-[10px] font-bold text-text truncate pr-4">{notif.title}</p>
                              <p className="text-[9px] text-muted font-medium mt-0.5 line-clamp-2">{notif.message}</p>
                              <span className="text-[8px] text-muted/60 font-bold block mt-1.5">{new Date(notif.created_at).toLocaleString()}</span>
                            </div>
                            {notif.data && (
                              <ExternalLink size={10} className="absolute right-3 top-3 text-muted/40 group-hover:text-accent transition-colors" />
                            )}
                          </div>
                        ))
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {user && (
        <button
            onClick={() => navigate('/help')}
            className="p-1.5 text-muted hover:text-accent transition-colors flex items-center gap-2 mr-2"
            title="Help Center"
        >
            <HelpCircle size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">Help</span>
        </button>
      )}

      {user ? (
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 mr-4 hover:bg-border/30 p-1.5 rounded-lg transition-colors group"
          >
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-bold text-text leading-none">{user.username}</span>
              {isSuperAdmin ? (
                <span 
                  className="text-[8px] font-black uppercase tracking-tighter"
                  style={{ 
                    color: '#FFD700',
                    textShadow: '0 0 8px rgba(255, 215, 0, 0.5)'
                  }}
                >
                  Superadmin
                </span>
              ) : userRole ? (
                <span 
                  className="text-[8px] font-black uppercase tracking-tighter"
                  style={{ color: roleColor }}
                >
                  {userRole.name}
                </span>
              ) : (
                <span className="text-[8px] font-black text-muted uppercase tracking-tighter">Guest</span>
              )}
            </div>
            <div 
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isSuperAdmin ? 'shadow-[0_0_10px_rgba(255,215,0,0.3)] border border-[#FFD700]/30' : 'bg-border'}`}
              style={isSuperAdmin ? { backgroundColor: '#FFD700' } : { borderLeft: `3px solid ${roleColor}` }}
            >
              <User size={14} className={isSuperAdmin ? 'text-black' : 'text-muted'} />
            </div>
            <ChevronDown size={14} className={`text-muted transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl py-2 z-[400] animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-4 py-2 border-b border-border mb-2">
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Signed in as</p>
                <p className="text-xs font-black truncate">{user.username}</p>
              </div>

              {isFactionPage && (
                <button 
                  onClick={() => {
                    navigate('/');
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface transition-colors"
                >
                  <LayoutGrid size={14} />
                  Faction Selection
                </button>
              )}

              <button 
                onClick={() => {
                  navigate('/account/settings');
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-surface transition-colors"
              >
                <Settings size={14} />
                Account Settings
              </button>

              {isSuperAdmin && (
                <button 
                  onClick={() => {
                    navigate('/superadmin');
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors"
                >
                  <ShieldAlert size={14} />
                  Superadmin Panel
                </button>
              )}

              <div className="border-t border-border mt-2 pt-2">
                <button 
                  onClick={() => {
                    onLogout();
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 mr-4">
          <div className="flex flex-col items-end">
            <span className="text-[11px] font-bold text-text leading-none">Guest User</span>
            <span className="text-[8px] font-black text-muted uppercase tracking-tighter">Read Only</span>
          </div>
          <div className="w-7 h-7 bg-border/50 rounded-full flex items-center justify-center text-muted/50 border border-dashed border-border">
            <User size={14} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 border-l border-border pl-4 mr-2">
        {isDark && (
            <button 
                onClick={toggleContrast}
                className={`w-[28px] h-[28px] flex items-center justify-center rounded-lg transition-all border ${highContrast ? 'bg-accent/10 border-accent/40 text-accent' : 'bg-border/30 border-transparent text-muted hover:text-text hover:bg-border/50'}`}
                title="High Contrast Mode"
            >
                <Contrast size={14} />
            </button>
        )}
        <span className="text-[10px] text-muted hidden sm:block">Dark</span>
        <button 
          onClick={toggleTheme}
          className="relative w-[34px] h-[19px] bg-border rounded-full cursor-pointer transition-colors"
          style={{ backgroundColor: isDark ? 'var(--accent)' : 'var(--border)' }}
        >
          <div 
            className="absolute top-[3px] left-[3px] w-[13px] h-[13px] bg-surface rounded-full transition-transform shadow-sm flex items-center justify-center overflow-hidden"
            style={{ transform: isDark ? 'translateX(15px)' : 'translateX(0)' }}
          >
            {isDark ? <Moon size={8} className="text-accent" /> : <Sun size={8} className="text-muted" />}
          </div>
        </button>
      </div>

      {!user && (
        <div className="ml-2.5">
          <Link 
            to="/"
            className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase text-accent border border-accent/30 px-3 py-1 rounded hover:bg-accent/10 transition-all"
          >
            <LogIn size={10} />
            Login
          </Link>
        </div>
      )}
    </header>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate, useLocation, useSearchParams, Outlet } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import api from './api';
import echo from './echo';
import { Faction as FactionType } from './types';
import Loading from './components/Loading';
import Login from './components/Login';
import Register from './components/Register';
import Setup from './components/Setup';
import Invite from './components/Invite';
import GtawCallback from './components/GtawCallback';
import Home from './components/Home';
import FactionManager from './components/FactionManager';
import FactionCatalog from './components/FactionCatalog';
import AccountSettings from './components/AccountSettings';
import Superadmin from './components/Superadmin';
import HelpCenter from './components/HelpCenter';
import HelpArticleView from './components/HelpArticleView';
import HelpCategoryView from './components/HelpCategoryView';
import FactionRoster from './components/FactionRoster';
import FactionRecords from './components/FactionRecords';
import FactionSnapshots from './components/FactionSnapshots';
import RosterRevisions from './components/RosterRevisions';
import GroupManagement from './components/GroupManagement';
import Administration from './components/Administration';
import FactionHierarchy from './components/FactionHierarchy';
import GtawSync from './components/GtawSync';
import AuditLogs from './components/AuditLogs';
import Statistics from './components/Statistics';
import StatisticsDashboard from './components/StatisticsDashboard';
import Welcome from './components/Welcome';
import Credits from './components/Credits';
import Changelog from './components/Changelog';
import FactionForms from './components/FactionForms';
import FactionNotifications from './components/FactionNotifications';
import { FactionKanban } from './components/FactionKanban';
import GlobalLayout from './layouts/GlobalLayout';
import FactionLayout from './layouts/FactionLayout';
import { ConfirmationProvider } from './components/ConfirmationProvider';
import { ShieldAlert } from 'lucide-react';
import { hexToRgb } from './utils';

const DashboardWrapper = ({ user, onLogout, isDark, toggleTheme, highContrast, toggleContrast, siteVersion }: any) => {
  const { shortname } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [factionData, setFactionData] = useState<any>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDivId, setActiveDivId] = useState<number | null>(null);
  const [activeSandboxDivId, setActiveSandboxDivId] = useState<number | null>(null);
  const [rosters, setRosters] = useState<any[]>([]);
  const [sandboxRosters, setSandboxRosters] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [recordData, setRecordData] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  const fetchAllData = async () => {
    try {
      const res = await api.get(`/factions/${shortname}`, {
        params: { roster_id: activeDivId }
      });
      const { faction, permissions: perms, rosters: rosterData, sandbox_rosters: sandboxRosterData, datasets: datasetData, flags: flagData, record_data: recordDataRes, online_users: onlineUsersRes } = res.data;
      
      const normalizedDatasets = (datasetData || []).map((d: any) => ({
        ...d,
        options: (d.options || []).map((o: any, idx: number) => ({
          ...o,
          id: o.id || `temp_${d.id}_${idx}_${o.value}`
        }))
      }));

      setFactionData(faction);
      setPermissions(perms);
      setRosters(rosterData);
      setSandboxRosters(sandboxRosterData || []);
      setDatasets(normalizedDatasets);
      setFlags(flagData);
      setRecordData(recordDataRes);
      setOnlineUsers(onlineUsersRes || []);

      if (rosterData.length > 0) {
        const rosterParam = searchParams.get('roster');
        const targetRoster = rosterData.find((r: any) => r.shortname === rosterParam || String(r.id) === rosterParam);
        
        if (targetRoster) {
          setActiveDivId(targetRoster.id);
        } else if (activeDivId === null || !rosterData.find((r: any) => r.id === activeDivId)) {
          setActiveDivId(rosterData[0].id);
        }
      } else {
        setActiveDivId(null);
      }

      if (sandboxRosterData && sandboxRosterData.length > 0) {
        const sandboxParam = searchParams.get('sandbox_roster');
        const targetSandbox = sandboxRosterData.find((r: any) => r.shortname === sandboxParam || String(r.id) === sandboxParam);
        
        if (targetSandbox) {
          setActiveSandboxDivId(targetSandbox.id);
        } else if (activeSandboxDivId === null || !sandboxRosterData.find((r: any) => r.id === activeSandboxDivId)) {
          setActiveSandboxDivId(sandboxRosterData[0].id);
        }
      } else {
        setActiveSandboxDivId(null);
      }

      if (faction.color) {
        document.documentElement.style.setProperty('--accent', faction.color);
        const rgb = hexToRgb(faction.color);
        if (rgb) document.documentElement.style.setProperty('--accent-rgb', rgb);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Faction not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shortname) {
      fetchAllData();
    }

    return () => {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-rgb');
      const favicon = document.getElementById('favicon') as HTMLLinkElement;
      if (favicon) favicon.href = '/favicon.ico';
    };
  }, [shortname]);

  useEffect(() => {
    if (factionData?.favicon) {
      const favicon = document.getElementById('favicon') as HTMLLinkElement;
      if (favicon) favicon.href = factionData.favicon;
    }
  }, [factionData]);

  useEffect(() => {
    if (!factionData?.id) return;

    const updatesChannel = `faction.${factionData.id}.updates`;

    echo.join(updatesChannel)
      .here((users: any[]) => {
        setOnlineUsers(users);
      })
      .joining((user: any) => {
        setOnlineUsers((prev) => [...prev.filter(u => u.id !== user.id), user]);
      })
      .leaving((user: any) => {
        setOnlineUsers((prev) => prev.filter((u) => u.id !== user.id));
      })
      .listen('.roster.updated', (e: { roster_id: number }) => {
        fetchAllData();
      });

    return () => {
      echo.leave(updatesChannel);
    };
  }, [factionData?.id]);

  const handleSetActiveDivId = (id: number | null) => {
    setActiveDivId(id);
    if (id) {
      const roster = rosters.find(r => r.id === id);
      if (roster) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('roster', roster.shortname);
        setSearchParams(newParams, { replace: true });
      }
    }
  };

  const handleSetActiveSandboxDivId = (id: number | null) => {
    setActiveSandboxDivId(id);
    if (id) {
      const roster = sandboxRosters.find(r => r.id === id);
      if (roster) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('sandbox_roster', roster.shortname);
        setSearchParams(newParams, { replace: true });
      }
    }
  };

  useEffect(() => {
    if (rosters.length > 0) {
      const rosterParam = searchParams.get('roster');
      const targetRoster = rosters.find((r: any) => r.shortname === rosterParam || String(r.id) === rosterParam);
      if (targetRoster && targetRoster.id !== activeDivId) {
        setActiveDivId(targetRoster.id);
      }
    }
    if (sandboxRosters.length > 0) {
      const sandboxParam = searchParams.get('sandbox_roster');
      const targetSandbox = sandboxRosters.find((r: any) => r.shortname === sandboxParam || String(r.id) === sandboxParam);
      if (targetSandbox && targetSandbox.id !== activeSandboxDivId) {
        setActiveSandboxDivId(targetSandbox.id);
      }
    }
  }, [searchParams, rosters, sandboxRosters]);

  if (loading) return <Loading message="Initializing Faction..." />;
  if (error) return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text">
      <h1 className="text-4xl font-bold text-red-500 mb-4">Error</h1>
      <p className="mb-8 font-medium">{error}</p>
      <button onClick={() => window.location.href = '/'} className="px-6 py-2 bg-accent text-white hover:bg-accent/90 transition-colors rounded font-bold uppercase tracking-widest text-xs">Return to Faction Selector</button>
    </div>
  );

  const activeDivision = rosters.find(r => r.id === activeDivId) || null;
  const activeSandboxDivision = sandboxRosters.find(r => r.id === activeSandboxDivId) || null;

  const calculateTotalMembers = (div: any) => {
    return div ? (
      (div.leadership?.length || 0) +
      (div.bureaus?.reduce((acc: number, b: any) =>
        acc + (b.leadership?.length || 0) + (b.units?.reduce((uAcc: number, u: any) => uAcc + (u.members?.length || 0), 0) || 0), 0) || 0)
    ) : 0;
  };

  const totalMembers = calculateTotalMembers(activeDivision);
  const totalSandboxMembers = calculateTotalMembers(activeSandboxDivision);

  const isGroupLeader = user?.groups?.some((g: any) => g.faction_id === factionData?.id && g.pivot?.is_leader) || false;
  const canViewAdmin = user?.is_superadmin || permissions.includes('view_admin_page');
  const canViewGroups = user?.is_superadmin || permissions.includes('view_groups') || isGroupLeader;
  const canViewRecords = user?.is_superadmin || permissions.includes('view_faction_records');
  const canViewAuditLogs = user?.is_superadmin || permissions.includes('view_audit_logs');
  const canViewStatistics = user?.is_superadmin || permissions.includes('view_statistics');
  const canViewForms = user?.is_superadmin || permissions.includes('view_faction_forms');
  const canViewSnapshots = user?.is_superadmin || permissions.includes('view_snapshots') || permissions.includes('administrator');
  const canViewGtawSync = (user?.is_superadmin || permissions.includes('sync_gtaw')) && factionData?.gtaw_faction_id;
  const canViewSandboxRoster = user?.is_superadmin || permissions.includes('utilize_sandbox_rosters');
  const canViewFactionHierarchy = user?.is_superadmin || permissions.includes('view_faction_hierarchy') || permissions.includes('global_hierarchy_moderation');
  const canViewNotifications = user?.is_superadmin || permissions.includes('view_notifications') || permissions.includes('configure_notifications') || permissions.includes('administrator');
  const canViewKanban = user?.is_superadmin || permissions.includes('view_faction_projects') || permissions.includes('global_kanban_moderation');

  if (location.pathname === `/${shortname}`) {
    return <Navigate to={`/${shortname}/roster`} replace />;
  }

  return (
    <FactionLayout 
      isDark={isDark}
      toggleTheme={toggleTheme}
      highContrast={highContrast}
      toggleContrast={toggleContrast}
      user={user}
      onLogout={onLogout}
      factionData={factionData}
      permissions={permissions}
      canViewAdmin={canViewAdmin}
      canViewGroups={canViewGroups}
      canViewRecords={canViewRecords}
      canViewAuditLogs={canViewAuditLogs}
      canViewStatistics={canViewStatistics}
      canViewSnapshots={canViewSnapshots}
      canViewGtawSync={canViewGtawSync}
      canViewForms={canViewForms}
      canViewSandboxRoster={canViewSandboxRoster}
      canViewFactionHierarchy={canViewFactionHierarchy}
      canViewNotifications={canViewNotifications}
      canViewKanban={canViewKanban}
      siteVersion={siteVersion}
    >
      <Routes>
        <Route path="roster" element={
          <FactionRoster 
            user={user}
            isDark={isDark}
            activeDivision={activeDivision} 
            totalMembers={totalMembers} 
            rosters={rosters} 
            setRosters={setRosters}
            activeDivId={activeDivId} 
            setActiveDivId={handleSetActiveDivId}
            permissions={permissions}
            shortname={shortname}
            fetchRosters={fetchAllData}
            datasets={datasets}
            flags={flags}
            recordData={recordData}
            onlineUsers={onlineUsers}
          />
        } />
        <Route path="sandbox-roster" element={
          canViewSandboxRoster ? (
            <FactionRoster 
              user={user}
              isDark={isDark}
              activeDivision={activeSandboxDivision} 
              totalMembers={totalSandboxMembers} 
              rosters={sandboxRosters} 
              setRosters={setSandboxRosters}
              activeDivId={activeSandboxDivId} 
              setActiveDivId={handleSetActiveSandboxDivId}
              permissions={permissions}
              shortname={shortname}
              fetchRosters={fetchAllData}
              datasets={datasets}
              flags={flags}
              recordData={recordData}
              onlineUsers={onlineUsers}
              isSandbox={true}
              mainRosters={rosters}
            />
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="hierarchy" element={<Navigate to={`/${shortname}/diagrams`} replace />} />
        <Route path="diagrams" element={
          canViewFactionHierarchy ? (
            <FactionHierarchy 
              user={user}
              shortname={shortname!}
              permissions={permissions}
              isDark={isDark}
              rosters={rosters}
              factionId={factionData?.id}
            />
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="kanban/*" element={
          canViewKanban ? (
            <main className="main flex-1 overflow-auto">
              <FactionKanban user={user} permissions={permissions} />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="forms/*" element={
          canViewForms ? (
            <main className="main flex-1 overflow-auto">
              <FactionForms shortname={shortname!} user={user} permissions={permissions} />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="records" element={
          canViewRecords ? (
            <main className="main flex-1 overflow-auto p-5">
              <FactionRecords shortname={shortname!} permissions={permissions} user={user} />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="statistics" element={
          canViewStatistics ? (
            <main className="main flex-1 overflow-auto p-5">
              <Statistics shortname={shortname!} user={user} permissions={permissions} rosters={rosters} datasets={datasets} recordData={recordData} />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="statistics/:modelId" element={
          canViewStatistics ? (
            <main className="main flex-1 overflow-auto p-5">
              <StatisticsDashboard shortname={shortname!} user={user} permissions={permissions} rosters={rosters} datasets={datasets} recordData={recordData} />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="groups" element={
          canViewGroups ? (
            <main className="main flex-1 overflow-auto p-5">
              <GroupManagement shortname={shortname!} user={user} permissions={permissions} />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="audit-logs" element={
          canViewAuditLogs ? (
            <main className="main flex-1 overflow-auto p-5">
              <AuditLogs shortname={shortname!} />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="snapshots" element={
          canViewSnapshots ? (
            <main className="main flex-1 overflow-auto p-5">
              <FactionSnapshots />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="rosters/:rosterId/revisions" element={
          <main className="main flex-1 overflow-auto p-5">
            <RosterRevisions datasets={datasets} recordData={recordData} user={user} />
          </main>
        } />
        <Route path="gtaw-sync" element={
          canViewGtawSync ? (
            <main className="main flex-1 overflow-auto p-5">
              <GtawSync faction={factionData} user={user} />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="admin" element={
          canViewAdmin ? (
            <main className="main flex-1 overflow-auto p-5">
              <Administration faction={factionData} user={user} permissions={permissions} />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
        <Route path="notifications" element={
          canViewNotifications ? (
            <main className="main flex-1 overflow-auto p-5">
              <FactionNotifications shortname={shortname!} user={user} permissions={permissions} />
            </main>
          ) : <Navigate to={`/${shortname}/roster`} />
        } />
      </Routes>
    </FactionLayout>
  );
};

const TitleUpdater = ({ user }: { user: any }) => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) {
      document.title = 'Faction Panel';
      return;
    }
    const firstSegment = segments[0];
    if (segments.length > 0 && ['login', 'register', 'invite', 'setup'].includes(firstSegment)) {
      document.title = `Faction Panel · ${firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)}`;
      return;
    }
    if (path === '/factions/catalog') {
      document.title = 'Faction Panel · Catalog';
      return;
    }
    if (path === '/account/settings') {
      document.title = 'Faction Panel · Account Settings';
      return;
    }
    if (path === '/auth/gtaw/callback') {
      document.title = 'Faction Panel · Authentication Callback';
      return;
    }
    if (path === '/welcome') {
      document.title = 'Faction Panel · Welcome';
      return;
    }
    const shortname = firstSegment.toUpperCase();
    let page = segments[1] || 'Roster';
    const pageMap: Record<string, string> = {
      'admin': 'Administration',
      'roster': 'Roster',
      'diagrams': 'Faction Diagrams',
      'hierarchy': 'Faction Diagrams',
      'kanban': 'Faction Kanban'
    };
    const displayPage = pageMap[page] || (page.charAt(0).toUpperCase() + page.slice(1));
    document.title = `${shortname} · ${displayPage}`;
  }, [location, user]);

  return null;
};

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('bp-rosters-theme') === 'dark');
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('roster-contrast') === 'true');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [siteVersion, setSiteVersion] = useState('1.0.0');

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    if (isDark && highContrast) {
        document.documentElement.setAttribute('data-contrast', 'high');
    } else {
        document.documentElement.removeAttribute('data-contrast');
    }
  }, [isDark, highContrast]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const response = await api.get('/user');
          setUser(response.data);
        } catch (err) {
          localStorage.removeItem('access_token');
          setUser(null);
        }
      }
      setLoading(false);
    };
    const fetchVersion = async () => {
      try {
        const res = await api.get('/site-settings/public');
        if (res.data.version) setSiteVersion(res.data.version);
      } catch (err) {
        console.error('Failed to fetch site version');
      }
    };
    checkAuth();
    fetchVersion();
  }, []);

  const handleLogin = (token: string, userData: any) => {
    localStorage.setItem('access_token', token);
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      localStorage.removeItem('access_token');
      setUser(null);
      window.location.href = '/';
    }
  };

  const toggleTheme = () => {
    setIsDark(prev => {
        const next = !prev;
        localStorage.setItem('bp-rosters-theme', next ? 'dark' : 'light');
        return next;
    });
  };

  const toggleContrast = () => {
    setHighContrast(prev => {
        const next = !prev;
        localStorage.setItem('roster-contrast', next.toString());
        return next;
    });
  };

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    if (isDark && highContrast) {
        document.documentElement.setAttribute('data-contrast', 'high');
    } else {
        document.documentElement.removeAttribute('data-contrast');
    }
  }, [isDark, highContrast]);

  if (loading) return <Loading message="Authenticating..." />;

  return (
    <Router>
      <ConfirmationProvider>
        <TitleUpdater user={user} />
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--card)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            },
          }}
        />
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} />} />
          <Route path="/invite/:code" element={<Invite user={user} />} />
          <Route path="/auth/gtaw/callback" element={<GtawCallback onLogin={handleLogin} />} />
          
          {/* Unauthenticated Landing Page (No Header) */}
          {!user && <Route path="/" element={<Home onLogin={handleLogin} isDark={isDark} toggleTheme={toggleTheme} siteVersion={siteVersion} />} />}

          <Route element={<GlobalLayout isDark={isDark} toggleTheme={toggleTheme} highContrast={highContrast} toggleContrast={toggleContrast} user={user} onLogout={handleLogout} />}>
             {/* Authenticated Root (Faction Selection) */}
             {user && <Route path="/" element={<FactionManager />} />}
             
             <Route path="/factions/catalog" element={<FactionCatalog />} />
             <Route path="/account/settings" element={<AccountSettings />} />
             <Route path="/superadmin" element={<Superadmin user={user} onLogin={handleLogin} />} />
             <Route path="/help" element={<HelpCenter />} />
             <Route path="/help/category/:id" element={<HelpCategoryView />} />
             <Route path="/help/article/:slug" element={<HelpArticleView />} />
             <Route path="/welcome" element={<Welcome />} />
             <Route path="/credits" element={<Credits />} />
             <Route path="/changelog" element={<Changelog siteVersion={siteVersion} user={user} />} />
          </Route>

          <Route path="/:shortname/*" element={
            <DashboardWrapper user={user} onLogout={handleLogout} isDark={isDark} toggleTheme={toggleTheme} highContrast={highContrast} toggleContrast={toggleContrast} siteVersion={siteVersion} />
          } />
        </Routes>
      </ConfirmationProvider>
    </Router>
  );
}

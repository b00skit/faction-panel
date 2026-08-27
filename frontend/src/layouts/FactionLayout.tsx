import React from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { FactionPage } from '../types';

interface FactionLayoutProps {
    isDark: boolean;
    toggleTheme: () => void;
    highContrast: boolean;
    toggleContrast: () => void;
    user: any;
    onLogout: () => void;
    factionData: any;
    permissions: string[];
    canViewAdmin: boolean;
    canViewGroups: boolean;
    canViewRecords: boolean;
    canViewAuditLogs: boolean;
    canViewStatistics?: boolean;
    canViewSnapshots?: boolean;
    canViewGtawSync?: boolean;
    canViewForms?: boolean;
    canViewSandboxRoster?: boolean;
    canViewFactionHierarchy?: boolean;
    canViewNotifications?: boolean;
    canViewKanban?: boolean;
    canViewPages?: boolean;
    factionPages?: FactionPage[];
    siteVersion: string;
    children: React.ReactNode;
}

const FactionLayout: React.FC<FactionLayoutProps> = ({ 
    isDark, 
    toggleTheme, 
    highContrast,
    toggleContrast,
    user, 
    onLogout, 
    factionData,
    permissions,
    canViewAdmin,
    canViewGroups,
    canViewRecords,
    canViewAuditLogs,
    canViewStatistics,
    canViewSnapshots,
    canViewGtawSync,
    canViewForms,
    canViewSandboxRoster,
    canViewFactionHierarchy,
    canViewNotifications,
    canViewKanban,
    canViewPages,
    factionPages,
    siteVersion,
    children
}) => {
    return (
        <div className="flex flex-col min-h-screen">
            <Header 
                isDark={isDark} 
                toggleTheme={toggleTheme} 
                highContrast={highContrast}
                toggleContrast={toggleContrast}
                factionName={factionData.name} 
                bannerLogoDark={factionData.header_image_dark}
                bannerLogoLight={factionData.header_image_light}
                branding={{
                    header_link_to_faction: factionData.header_link_to_faction,
                    hide_panel_header: factionData.hide_panel_header,
                    header_bg_color: factionData.header_bg_color,
                    header_gradient_enabled: factionData.header_gradient_enabled,
                    header_gradient_color: factionData.header_gradient_color,
                    header_gradient_direction: factionData.header_gradient_direction,
                    shortname: factionData.shortname,
                    access: factionData.access,
                    quick_search_enabled: factionData.quick_search_enabled,
                    quick_search_settings: factionData.quick_search_settings
                }}
                user={user} 
                userRole={factionData.user_primary_role}
                permissions={permissions}
                onLogout={onLogout} 
            />
            <div className="flex flex-1 relative">
                <Sidebar 
                    shortname={factionData.shortname} 
                    canViewAdmin={canViewAdmin} 
                    canViewGroups={canViewGroups} 
                    canViewRecords={canViewRecords} 
                    canViewAuditLogs={canViewAuditLogs}
                    canViewStatistics={canViewStatistics}
                    canViewSnapshots={canViewSnapshots}
                    canViewGtawSync={canViewGtawSync || false}
                    canViewForms={canViewForms}
                    canViewSandboxRoster={canViewSandboxRoster}
                    canViewFactionHierarchy={canViewFactionHierarchy}
                    canViewNotifications={canViewNotifications}
                    canViewKanban={canViewKanban}
                    canViewPages={canViewPages}
                    factionPages={factionPages}
                    user={user} 
                    siteVersion={siteVersion} 
                    customFooterText={factionData.custom_footer_text}
                />
                <div className="flex flex-col flex-1 min-w-0">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default FactionLayout;

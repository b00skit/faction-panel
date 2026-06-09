import { useEffect, useState } from 'react';
import echo from '../echo';
import { RosterContent } from '../types';

interface PresenceUser {
    id: number;
    username: string;
    color?: string;
}

interface UseRosterRealtimeProps {
    factionId?: number;
    rosterId?: number;
    onRowUpdated?: (row: RosterContent) => void;
    onRowAdded?: (row: RosterContent) => void;
    onRowDeleted?: (rowId: number) => void;
    onRosterUpdated?: () => void;
}

export const useRosterRealtime = ({
    factionId,
    rosterId,
    onRowUpdated,
    onRowAdded,
    onRowDeleted,
    onRosterUpdated,
}: UseRosterRealtimeProps) => {
    const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);

    useEffect(() => {
        if (!factionId || !rosterId) return;

        const rosterChannel = `faction.${factionId}.roster.${rosterId}`;
        const updatesChannel = `faction.${factionId}.updates`;

        // Join presence channel
        echo.join(rosterChannel)
            .here((users: PresenceUser[]) => {
                setPresenceUsers(users);
            })
            .joining((user: PresenceUser) => {
                setPresenceUsers((prev) => [...prev.filter(u => u.id !== user.id), user]);
            })
            .leaving((user: PresenceUser) => {
                setPresenceUsers((prev) => prev.filter((u) => u.id !== user.id));
            })
            .listen('.roster.row_updated', (e: RosterContent) => {
                onRowUpdated?.(e);
            })
            .listen('.roster.row_added', (e: RosterContent) => {
                onRowAdded?.(e);
            })
            .listen('.roster.row_deleted', (e: { id: number }) => {
                onRowDeleted?.(e.id);
            })
            .listen('.roster.updated', () => {
                onRosterUpdated?.();
            });

        // Listen for global faction updates that might affect rosters
        echo.private(updatesChannel)
            .listen('.roster.updated', (e: { roster_id: number }) => {
                if (e.roster_id === rosterId) {
                    onRosterUpdated?.();
                }
            });

        return () => {
            echo.leave(rosterChannel);
            echo.leave(updatesChannel);
        };
    }, [factionId, rosterId, onRowUpdated, onRowAdded, onRowDeleted, onRosterUpdated]);

    return { presenceUsers };
};

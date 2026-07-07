import { useEffect, useState, useRef } from 'react';
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
    onRowsReordered?: (sectionId: number, contentIds: number[]) => void;
    onRosterUpdated?: () => void;
}

export const useRosterRealtime = ({
    factionId,
    rosterId,
    onRowUpdated,
    onRowAdded,
    onRowDeleted,
    onRowsReordered,
    onRosterUpdated,
}: UseRosterRealtimeProps) => {
    const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);

    const onRowUpdatedRef = useRef(onRowUpdated);
    const onRowAddedRef = useRef(onRowAdded);
    const onRowDeletedRef = useRef(onRowDeleted);
    const onRowsReorderedRef = useRef(onRowsReordered);
    const onRosterUpdatedRef = useRef(onRosterUpdated);

    // Keep callback refs up to date on every render without triggering effects
    useEffect(() => {
        onRowUpdatedRef.current = onRowUpdated;
        onRowAddedRef.current = onRowAdded;
        onRowDeletedRef.current = onRowDeleted;
        onRowsReorderedRef.current = onRowsReordered;
        onRosterUpdatedRef.current = onRosterUpdated;
    });

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
                onRowUpdatedRef.current?.(e);
            })
            .listen('.roster.row_added', (e: RosterContent) => {
                onRowAddedRef.current?.(e);
            })
            .listen('.roster.row_deleted', (e: { id: number }) => {
                onRowDeletedRef.current?.(e.id);
            })
            .listen('.roster.rows_reordered', (e: { section_id: number; content_ids: number[] }) => {
                onRowsReorderedRef.current?.(e.section_id, e.content_ids);
            })
            .listen('.roster.updated', () => {
                onRosterUpdatedRef.current?.();
            });

        // Listen for global faction updates that might affect rosters
        echo.join(updatesChannel)
            .listen('.roster.updated', (e: { roster_id: number }) => {
                if (e.roster_id === rosterId) {
                    onRosterUpdatedRef.current?.();
                }
            });

        return () => {
            echo.leave(rosterChannel);
            echo.leave(updatesChannel);
        };
    }, [factionId, rosterId]);

    return { presenceUsers };
};

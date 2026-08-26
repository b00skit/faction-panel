import { useEffect, useRef } from 'react';
import echo from '../echo';

interface UseDiagramRealtimeProps {
    factionId?: number;
    rosterIds?: number[];
    onDiagramUpdated: () => void;
}

export const useDiagramRealtime = ({
    factionId,
    rosterIds = [],
    onDiagramUpdated,
}: UseDiagramRealtimeProps) => {
    const rosterIdsStr = JSON.stringify(rosterIds);
    const onDiagramUpdatedRef = useRef(onDiagramUpdated);

    // Keep callback ref up to date on every render
    useEffect(() => {
        onDiagramUpdatedRef.current = onDiagramUpdated;
    });

    useEffect(() => {
        if (!factionId || !localStorage.getItem('access_token')) return;

        const diagramsChannel = `faction.${factionId}.diagrams`;
        const updatesChannel = `faction.${factionId}.updates`;
        const ids = JSON.parse(rosterIdsStr) as number[];

        // Listen to diagram updates
        echo.private(diagramsChannel)
            .listen('.hierarchy.updated', () => {
                onDiagramUpdatedRef.current();
            });

        // Listen to global roster updates
        echo.join(updatesChannel)
            .listen('.roster.updated', (e: { roster_id: number }) => {
                if (ids.length > 0 && ids.includes(e.roster_id)) {
                    onDiagramUpdatedRef.current();
                }
            });

        return () => {
            echo.leave(diagramsChannel);
            echo.leave(updatesChannel);
        };
    }, [factionId, rosterIdsStr]);

    useEffect(() => {
        const ids = JSON.parse(rosterIdsStr) as number[];
        if (!factionId || ids.length === 0 || !localStorage.getItem('access_token')) return;

        const activeChannels: string[] = [];

        ids.forEach(id => {
            const rosterChannel = `faction.${factionId}.roster.${id}`;
            activeChannels.push(rosterChannel);

            echo.join(rosterChannel)
                .listen('.roster.row_updated', () => {
                    onDiagramUpdatedRef.current();
                })
                .listen('.roster.row_added', () => {
                    onDiagramUpdatedRef.current();
                })
                .listen('.roster.row_deleted', () => {
                    onDiagramUpdatedRef.current();
                })
                .listen('.roster.updated', () => {
                    onDiagramUpdatedRef.current();
                });
        });

        return () => {
            activeChannels.forEach(channel => {
                echo.leave(channel);
            });
        };
    }, [factionId, rosterIdsStr]);
};

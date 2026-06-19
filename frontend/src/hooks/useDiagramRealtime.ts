import { useEffect } from 'react';
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

    useEffect(() => {
        if (!factionId) return;

        const diagramsChannel = `faction.${factionId}.diagrams`;
        const updatesChannel = `faction.${factionId}.updates`;
        const ids = JSON.parse(rosterIdsStr) as number[];

        // Listen to diagram updates
        echo.private(diagramsChannel)
            .listen('.hierarchy.updated', () => {
                onDiagramUpdated();
            });

        // Listen to global roster updates
        echo.private(updatesChannel)
            .listen('.roster.updated', (e: { roster_id: number }) => {
                if (ids.length > 0 && ids.includes(e.roster_id)) {
                    onDiagramUpdated();
                }
            });

        return () => {
            echo.leave(diagramsChannel);
            echo.leave(updatesChannel);
        };
    }, [factionId, rosterIdsStr, onDiagramUpdated]);

    useEffect(() => {
        const ids = JSON.parse(rosterIdsStr) as number[];
        if (!factionId || ids.length === 0) return;

        const activeChannels: string[] = [];

        ids.forEach(id => {
            const rosterChannel = `faction.${factionId}.roster.${id}`;
            activeChannels.push(rosterChannel);

            echo.join(rosterChannel)
                .listen('.roster.row_updated', () => {
                    onDiagramUpdated();
                })
                .listen('.roster.row_added', () => {
                    onDiagramUpdated();
                })
                .listen('.roster.row_deleted', () => {
                    onDiagramUpdated();
                })
                .listen('.roster.updated', () => {
                    onDiagramUpdated();
                });
        });

        return () => {
            activeChannels.forEach(channel => {
                echo.leave(channel);
            });
        };
    }, [factionId, rosterIdsStr, onDiagramUpdated]);
};

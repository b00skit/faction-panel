import { useEffect } from 'react';
import echo from '../echo';

interface UseDiagramRealtimeProps {
    factionId?: number;
    rosterId?: number | null;
    onDiagramUpdated: () => void;
}

export const useDiagramRealtime = ({
    factionId,
    rosterId,
    onDiagramUpdated,
}: UseDiagramRealtimeProps) => {
    useEffect(() => {
        if (!factionId) return;

        const diagramsChannel = `faction.${factionId}.diagrams`;
        const updatesChannel = `faction.${factionId}.updates`;

        // Listen to diagram updates
        echo.private(diagramsChannel)
            .listen('.hierarchy.updated', () => {
                onDiagramUpdated();
            });

        // Listen to global roster updates
        echo.private(updatesChannel)
            .listen('.roster.updated', (e: { roster_id: number }) => {
                if (rosterId && e.roster_id === rosterId) {
                    onDiagramUpdated();
                }
            });

        return () => {
            echo.leave(diagramsChannel);
            echo.leave(updatesChannel);
        };
    }, [factionId, rosterId, onDiagramUpdated]);

    useEffect(() => {
        if (!factionId || !rosterId) return;

        const rosterChannel = `faction.${factionId}.roster.${rosterId}`;

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

        return () => {
            echo.leave(rosterChannel);
        };
    }, [factionId, rosterId, onDiagramUpdated]);
};

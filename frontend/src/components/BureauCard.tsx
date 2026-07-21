import React from 'react';
import { Fingerprint } from 'lucide-react';
import { Bureau, Member } from '../types';

interface BureauCardProps {
  bureau: Bureau;
}

interface RosterTableProps {
  members: Member[];
  isLeadership?: boolean;
  accentColor: string;
}

const RosterTable: React.FC<RosterTableProps> = ({ members, isLeadership, accentColor }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-border bg-border/5">
            <th className="p-1.5 font-bold text-muted uppercase text-[8px] tracking-wider pl-3">Name</th>
            <th className="p-1.5 font-bold text-muted uppercase text-[8px] tracking-wider">Rank</th>
            <th className="p-1.5 font-bold text-muted uppercase text-[8px] tracking-wider pr-3">Callsign</th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id} className="border-b border-border/50 hover:bg-border/5 transition-colors">
              <td className="p-1.5 font-medium text-[10px] pl-3">{m.name}</td>
              <td className="p-1.5 text-[10px]">{m.rank}</td>
              <td className="p-1.5 text-[10px] pr-3">{m.callsign || '-'}</td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={3} className="p-3 text-[10px] text-muted text-center italic">No members assigned</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export const BureauCard: React.FC<BureauCardProps> = ({ bureau }) => {
  const memberCount = bureau.leadership.length + bureau.units.reduce((acc, u) => acc + u.members.length, 0);

  return (
    <div className="bureau-card min-w-[450px] flex-1 border border-border rounded-lg overflow-hidden bg-card shadow-[var(--sh)] flex flex-col">
      <div className="bureau-card-top flex h-[24px] items-stretch border-b border-border bg-surface shrink-0">
        <div className="w-[5px] shrink-0" style={{ backgroundColor: bureau.color }} />
        <div className="w-6 shrink-0 flex items-center justify-center border-r border-border bg-bg text-[12px] text-muted">
          <Fingerprint size={12} />
        </div>
        <div className="flex-1 flex items-center px-2 justify-center gap-1.5 overflow-hidden">
          <span className="font-bold text-[11px] text-text uppercase truncate">
            {bureau.name}
          </span>
          <span className="text-[9px] font-medium text-accent shrink-0">
            {memberCount}
          </span>
        </div>
      </div>

      <div className="section-header py-0.5 px-2 border-b border-border bg-border/20 flex justify-between items-center shrink-0">
        <span className="text-[8px] font-bold tracking-widest text-muted uppercase">Leadership</span>
      </div>
      
      <RosterTable members={bureau.leadership} isLeadership accentColor={bureau.color} />

      {bureau.units.map(unit => (
        <div key={unit.id} className="unit-section">
          <div className="section-header py-0.5 px-2 border-b border-t border-border bg-border/10 flex items-center gap-1.5 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: bureau.color }} />
            <span className="text-[9px] font-bold text-text uppercase text-center flex-1 truncate">
              {unit.name}
            </span>
          </div>
          <RosterTable members={unit.members} accentColor={bureau.color} />
        </div>
      ))}
    </div>
  );
};

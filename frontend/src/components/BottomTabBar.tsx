import React, { useRef, useState, useEffect } from 'react';
import { Reorder } from 'motion/react';
import { MoreVertical, Plus, GripVertical } from 'lucide-react';

export interface TabItem {
  id: number;
  name: string;
  color?: string;
  [key: string]: any;
}

interface BottomTabBarProps {
  items: TabItem[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onReorder: (newItems: any[]) => void;
  canReorder: boolean;
  canCreate: boolean;
  onCreateClick: () => void;
  createTooltip?: string;
  renderContextMenu?: (item: TabItem, closeMenu: () => void) => React.ReactNode;
  extraButtons?: React.ReactNode;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  items,
  activeId,
  onSelect,
  onReorder,
  canReorder,
  canCreate,
  onCreateClick,
  createTooltip = 'Create New Item',
  renderContextMenu,
  extraButtons
}) => {
  const scrollRef = useRef<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number }>({ left: 0 });

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="tabs-bar bg-card border-t border-border flex items-center px-2.5 h-[var(--tab-h)] sticky bottom-0 z-[210]">
      <Reorder.Group
        ref={scrollRef}
        axis="x"
        values={items}
        onReorder={onReorder}
        className="flex items-center flex-1 overflow-x-auto overflow-y-hidden scrollbar-none gap-1 h-full"
      >
        {items.map((item) => {
          const hasMenu = !!renderContextMenu;
          const contextMenuContent = renderContextMenu ? renderContextMenu(item, () => setActiveMenuId(null)) : null;
          const showMenuButton = hasMenu && contextMenuContent !== null;

          return (
            <Reorder.Item
              key={item.id}
              value={item}
              dragListener={canReorder}
              className="flex items-center group relative h-full shrink-0 animate-none"
            >
              <div
                onClick={() => onSelect(item.id)}
                className={`tab pl-4 py-2 cursor-pointer transition-all text-[10px] font-bold uppercase h-full flex items-center gap-1.5 relative border-t-2 ${
                  showMenuButton ? 'pr-1' : 'pr-4'
                } ${
                  activeId === item.id
                    ? 'border-accent text-accent bg-accent/5'
                    : 'border-transparent text-muted hover:text-text hover:bg-surface'
                }`}
                style={activeId === item.id ? { borderTopColor: item.color || 'var(--accent)' } : {}}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shadow-sm shrink-0"
                  style={{ backgroundColor: item.color || 'var(--accent)' }}
                />
                <span>{item.name}</span>

                {showMenuButton && (
                  <div className="flex items-center">
                    <div
                      className={`transition-opacity flex items-center ${
                        activeMenuId === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <button
                        type="button"
                        className={`text-muted hover:text-accent cursor-pointer p-0.5 rounded hover:bg-accent/10 ${
                          activeMenuId === item.id ? 'text-accent bg-accent/10' : ''
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (activeMenuId === item.id) {
                            setActiveMenuId(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPosition({ left: rect.left + rect.width / 2 });
                            setActiveMenuId(item.id);
                          }
                        }}
                      >
                        <MoreVertical size={12} />
                      </button>
                    </div>

                    {activeMenuId === item.id && (
                      <div
                        className="fixed bottom-[var(--tab-h)] mb-2 bg-card border border-border rounded-lg shadow-2xl p-1 z-[999] min-w-[140px]"
                        style={{
                          left: menuPosition.left,
                          transform: 'translateX(-50%)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contextMenuContent}
                        {canReorder && (
                          <div className="border-t border-border mt-1 pt-1">
                            <div className="px-3 py-1.5 text-[8px] font-black uppercase text-muted/50 tracking-widest flex items-center gap-2">
                              <GripVertical size={10} /> Drag to reorder
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Reorder.Item>
          );
        })}

        {canCreate && (
          <div className="relative flex items-center gap-1 ml-2 shrink-0">
            <button
              onClick={onCreateClick}
              className="p-2 text-muted hover:text-accent transition-colors"
              title={createTooltip}
            >
              <Plus size={16} />
            </button>
            {extraButtons}
          </div>
        )}
      </Reorder.Group>
    </div>
  );
};

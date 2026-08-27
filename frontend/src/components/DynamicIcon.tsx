import React from 'react';
import * as Icons from 'lucide-react';

interface DynamicIconProps {
  name: string;
  size?: number;
  className?: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, size = 14, className }) => {
  // Normalize icon name e.g. "file-text" -> "FileText"
  const pascalName = name
    .split(/[-_ ]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  const IconComponent = (Icons as any)[pascalName] || (Icons as any)[name] || Icons.FileText;

  return <IconComponent size={size} className={className} />;
};

export const AVAILABLE_ICONS = [
  'FileText',
  'BookOpen',
  'Shield',
  'Database',
  'Star',
  'Folder',
  'CheckSquare',
  'Globe',
  'Award',
  'Info',
  'Terminal',
  'Briefcase',
  'Calendar',
  'List',
  'Hash',
  'Users',
  'Settings',
  'Layers',
  'BarChart3',
  'Sparkles',
  'Bell',
  'GitFork',
  'Columns3',
  'Camera',
  'RefreshCw',
  'HelpCircle',
  'Bookmark',
  'Code',
  'Cpu',
  'FileCode',
  'Layout',
  'Search',
];

import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { KanbanProject } from '../types';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  projects?: KanbanProject[];
  activeProject?: KanbanProject | null;
  onCardClick?: (projectId: string | number, cardId: number) => void;
}

// Configure marked with GFM and line breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  projects = [],
  activeProject = null,
  onCardClick,
}) => {
  const sanitizedHtml = useMemo(() => {
    if (!content) return '';

    try {
      const rawHtml = marked.parse(content) as string;

      if (typeof window === 'undefined') {
        return DOMPurify.sanitize(rawHtml);
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');

      // Find all text nodes that are not inside code, pre, a, or button tags
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let current: Node | null;
      while ((current = walker.nextNode())) {
        let parent = current.parentElement;
        let skip = false;
        while (parent && parent !== doc.body) {
          if (['CODE', 'PRE', 'A', 'BUTTON'].includes(parent.tagName)) {
            skip = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (!skip && current.textContent && /(@[a-zA-Z0-9_.\-]+)|(#(?:\(?([A-Za-z0-9_#-]+)\)?))/.test(current.textContent)) {
          textNodes.push(current as Text);
        }
      }

      const regex = /(@[a-zA-Z0-9_.\-]+)|(#(?:\(?([A-Za-z0-9_#-]+)\)?))/g;

      for (const node of textNodes) {
        const text = node.textContent || '';
        regex.lastIndex = 0;
        const fragment = doc.createDocumentFragment();
        let lastIdx = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIdx) {
            fragment.appendChild(doc.createTextNode(text.substring(lastIdx, match.index)));
          }

          const fullMatch = match[0];
          const userMention = match[1];
          const cardToken = match[3];

          if (userMention) {
            const span = doc.createElement('span');
            span.className = 'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-accent/15 text-accent font-semibold text-[11px] select-none';
            span.textContent = userMention;
            fragment.appendChild(span);
          } else if (cardToken) {
            let displayLabel = fullMatch;
            let targetCardId: number | null = null;
            let targetProjectId: number | string | null = null;

            if (cardToken.includes('-')) {
              const [prefix, countStr] = cardToken.split('-');
              const count = parseInt(countStr, 10);
              const proj = projects.find((p) => p.prefix?.toLowerCase() === prefix.toLowerCase());
              if (proj && proj.statuses) {
                const found = proj.statuses.flatMap((s: any) => s.cards || []).find((c: any) => c.count === count);
                if (found) {
                  targetCardId = found.id;
                  targetProjectId = proj.prefix || proj.id;
                  displayLabel = `#${proj.prefix || ''}-${found.count ?? found.id}`;
                }
              }
            } else if (!isNaN(Number(cardToken))) {
              const num = parseInt(cardToken, 10);
              const foundActive = activeProject?.statuses?.flatMap((s: any) => s.cards || []).find((c: any) => c.count === num || c.id === num);
              if (foundActive) {
                targetCardId = foundActive.id;
                targetProjectId = activeProject?.prefix || activeProject?.id || null;
                displayLabel = `#${activeProject?.prefix ? activeProject.prefix + '-' : ''}${foundActive.count ?? foundActive.id}`;
              } else {
                for (const p of projects) {
                  const f = p.statuses?.flatMap((s: any) => s.cards || []).find((c: any) => c.id === num || c.count === num);
                  if (f) {
                    targetCardId = f.id;
                    targetProjectId = p.prefix || p.id;
                    displayLabel = `#${p.prefix ? p.prefix + '-' : ''}${f.count ?? f.id}`;
                    break;
                  }
                }
              }
            }

            if (targetCardId && targetProjectId) {
              const btn = doc.createElement('button');
              btn.type = 'button';
              btn.setAttribute('data-mention-card', 'true');
              btn.setAttribute('data-card-id', String(targetCardId));
              btn.setAttribute('data-project-id', String(targetProjectId));
              btn.className = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface border border-border text-accent font-mono font-bold text-[10px] hover:border-accent hover:bg-accent/10 transition-colors cursor-pointer shadow-sm mx-0.5';
              btn.textContent = displayLabel;
              fragment.appendChild(btn);
            } else {
              const span = doc.createElement('span');
              span.className = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface border border-border text-text font-mono font-bold text-[10px] mx-0.5';
              span.textContent = fullMatch;
              fragment.appendChild(span);
            }
          }

          lastIdx = regex.lastIndex;
        }

        if (lastIdx < text.length) {
          fragment.appendChild(doc.createTextNode(text.substring(lastIdx)));
        }

        if (node.parentNode) {
          node.parentNode.replaceChild(fragment, node);
        }
      }

      // External links target=_blank
      doc.querySelectorAll('a').forEach((a) => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });

      return DOMPurify.sanitize(doc.body.innerHTML, {
        ADD_TAGS: ['button'],
        ADD_ATTR: ['data-mention-card', 'data-card-id', 'data-project-id', 'target', 'rel', 'type'],
      });
    } catch (err) {
      console.error('Error rendering markdown:', err);
      return DOMPurify.sanitize(content);
    }
  }, [content, projects, activeProject]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const cardBtn = (e.target as HTMLElement).closest('[data-mention-card="true"]');
    if (cardBtn) {
      e.stopPropagation();
      const cardId = cardBtn.getAttribute('data-card-id');
      const projectId = cardBtn.getAttribute('data-project-id');
      if (cardId && projectId && onCardClick) {
        onCardClick(projectId, parseInt(cardId, 10));
      }
    }
  };

  return (
    <div
      className={`kanban-markdown ${className}`}
      onClick={handleContainerClick}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default MarkdownRenderer;

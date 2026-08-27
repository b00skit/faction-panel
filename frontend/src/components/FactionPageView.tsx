import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Handlebars from 'handlebars';
import DOMPurify from 'dompurify';
import api from '../api';
import { FactionPage } from '../types';
import Loading from './Loading';
import { DynamicIcon } from './DynamicIcon';
import { Edit2, ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';

interface FactionPageViewProps {
  shortname: string;
  user: any;
  permissions: string[];
}

import { setupHandlebarsAndDOMPurify, renderCustomPage, executeExtractedScripts } from '../utils/handlebarsHelpers';

// Register Handlebars helpers and DOMPurify hooks
setupHandlebarsAndDOMPurify();

interface CustomPageRendererProps {
  html: string;
  scripts: string[];
}

export const CustomPageRenderer: React.FC<CustomPageRendererProps> = React.memo(({ html, scripts }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const lastHtmlRef = React.useRef<string>('');

  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    if (lastHtmlRef.current !== html) {
      lastHtmlRef.current = html;
      containerRef.current.innerHTML = html;
      if (scripts.length > 0) {
        executeExtractedScripts(scripts);
      }
    }
  }, [html, scripts]);

  return (
    <div
      ref={containerRef}
      className="faction-page-rendered prose max-w-none text-text"
    />
  );
});

export const FactionPageView: React.FC<FactionPageViewProps> = React.memo(({ shortname, user, permissions }) => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<FactionPage | null>(null);
  const [contextData, setContextData] = useState<any>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [renderedScripts, setRenderedScripts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canModifyPages = user?.is_superadmin || permissions.includes('modify_faction_pages');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pageRes, contextRes] = await Promise.all([
        api.get(`/factions/${shortname}/pages/${slug}`),
        api.get(`/factions/${shortname}/pages/context-data?page=${slug}`),
      ]);

      const loadedPage: FactionPage = pageRes.data;
      const loadedContext = contextRes.data;

      setPage(loadedPage);
      setContextData(loadedContext);

      const { html, scripts } = renderCustomPage(loadedPage.content || '', loadedContext);
      setRenderedHtml(html);
      setRenderedScripts(scripts);
    } catch (err: any) {
      console.error('Failed to load page:', err);
      setError(err.response?.data?.message || 'Failed to load page or permission denied.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug && shortname) {
      fetchData();
    }
  }, [slug, shortname]);

  if (loading) {
    return (
      <main className="main flex-1 overflow-auto p-6">
        <Loading fullScreen={false} message="Loading Faction Page..." />
      </main>
    );
  }

  if (error || !page) {
    return (
      <main className="main flex-1 overflow-auto p-6">
        <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-lg text-center max-w-lg mx-auto">
          <ShieldAlert size={48} className="text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-text mb-2">Access Restricted</h2>
          <p className="text-sm text-muted mb-6">{error || 'This page does not exist or you do not have permission to view it.'}</p>
          <Link
            to={`/${shortname}/roster`}
            className="px-4 py-2 bg-accent text-white font-bold uppercase tracking-wider text-xs rounded hover:bg-accent/90 transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft size={14} /> Back to Roster
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="main flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent/10 border border-accent/20 rounded-lg text-accent">
              <DynamicIcon name={page.icon} size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text flex items-center gap-2">
                {page.name}
                {!page.is_published && (
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold rounded">
                    Draft / Unpublished
                  </span>
                )}
              </h1>
              <p className="text-xs text-muted font-mono">/{shortname}/pages/{page.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 bg-card hover:bg-card-hover border border-border text-muted hover:text-text rounded transition-colors"
              title="Refresh Content"
            >
              <RefreshCw size={14} />
            </button>

            {canModifyPages && (
              <Link
                to={`/${shortname}/pages/manage?edit=${page.id}`}
                className="px-3 py-1.5 bg-accent text-white hover:bg-accent/90 transition-colors rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
              >
                <Edit2 size={13} /> Edit Page
              </Link>
            )}
          </div>
        </div>

        {/* Page Content (Sanitized HTML & Rendered Handlebars) */}
        <CustomPageRenderer html={renderedHtml} scripts={renderedScripts} />
      </div>
    </main>
  );
});

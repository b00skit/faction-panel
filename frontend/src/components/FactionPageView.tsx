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

// Register Handlebars helpers once
if (!(Handlebars as any)._customHelpersRegistered) {
  (Handlebars as any)._customHelpersRegistered = true;

  Handlebars.registerHelper('json', function (context, options) {
    const indent = options?.hash?.indent ? parseInt(options.hash.indent, 10) : 2;
    try {
      return new Handlebars.SafeString(
        `<pre className="bg-black/20 p-3 rounded font-mono text-xs overflow-auto"><code>${JSON.stringify(
          context,
          null,
          indent
        )}</code></pre>`
      );
    } catch (e) {
      return '';
    }
  });

  Handlebars.registerHelper('getRecordEntries', function (dbName, options) {
    const records = options?.data?.root?.records || {};
    return records[dbName] || [];
  });

  Handlebars.registerHelper('getRecordDatabase', function (dbName, options) {
    const databases = options?.data?.root?.record_databases || [];
    const target = String(dbName).toLowerCase();
    return databases.find((d: any) => 
      String(d.id) === String(dbName) || 
      (d.record_shortcode && String(d.record_shortcode).toLowerCase() === target) ||
      (d.name && String(d.name).toLowerCase() === target) ||
      (d.name && String(d.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') === target)
    ) || null;
  });

  Handlebars.registerHelper('filterRecords', function (dbName, fieldName, value, options) {
    const records = options?.data?.root?.records || {};
    const entries = records[dbName] || [];
    return entries.filter((e: any) => e.entry_data && String(e.entry_data[fieldName]) === String(value));
  });

  Handlebars.registerHelper('findRecord', function (dbName, fieldName, value, options) {
    const records = options?.data?.root?.records || {};
    const entries = records[dbName] || [];
    return entries.find((e: any) => e.entry_data && String(e.entry_data[fieldName]) === String(value)) || null;
  });

  Handlebars.registerHelper('sortRecords', function (entries, fieldName, direction) {
    if (!Array.isArray(entries)) return [];
    const sorted = [...entries].sort((a: any, b: any) => {
      const valA = a.entry_data ? a.entry_data[fieldName] : a[fieldName];
      const valB = b.entry_data ? b.entry_data[fieldName] : b[fieldName];
      if (valA < valB) return direction === 'desc' ? 1 : -1;
      if (valA > valB) return direction === 'desc' ? -1 : 1;
      return 0;
    });
    return sorted;
  });

  Handlebars.registerHelper('limitRecords', function (entries, limit, offset) {
    if (!Array.isArray(entries)) return [];
    const start = typeof offset === 'number' ? offset : 0;
    return entries.slice(start, start + limit);
  });

  Handlebars.registerHelper('sumField', function (entries, fieldName) {
    if (!Array.isArray(entries)) return 0;
    return entries.reduce((acc, curr) => {
      const val = curr.entry_data ? parseFloat(curr.entry_data[fieldName]) : parseFloat(curr[fieldName]);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  });

  Handlebars.registerHelper('averageField', function (entries, fieldName) {
    if (!Array.isArray(entries) || entries.length === 0) return 0;
    const sum = entries.reduce((acc, curr) => {
      const val = curr.entry_data ? parseFloat(curr.entry_data[fieldName]) : parseFloat(curr[fieldName]);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    return (sum / entries.length).toFixed(2);
  });

  Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
  });

  Handlebars.registerHelper('ne', function (a, b) {
    return a !== b;
  });

  Handlebars.registerHelper('gt', function (a, b) {
    return a > b;
  });

  Handlebars.registerHelper('gte', function (a, b) {
    return a >= b;
  });

  Handlebars.registerHelper('lt', function (a, b) {
    return a < b;
  });

  Handlebars.registerHelper('lte', function (a, b) {
    return a <= b;
  });

  Handlebars.registerHelper('and', function (a, b) {
    return !!(a && b);
  });

  Handlebars.registerHelper('or', function (a, b) {
    return !!(a || b);
  });

  Handlebars.registerHelper('not', function (a) {
    return !a;
  });

  Handlebars.registerHelper('count', function (arr) {
    return Array.isArray(arr) ? arr.length : 0;
  });

  Handlebars.registerHelper('first', function (arr) {
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  });

  Handlebars.registerHelper('last', function (arr) {
    return Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null;
  });

  Handlebars.registerHelper('formatDate', function (dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString();
    } catch (e) {
      return dateStr;
    }
  });

  Handlebars.registerHelper('upper', function (str) {
    return typeof str === 'string' ? str.toUpperCase() : '';
  });

  Handlebars.registerHelper('lower', function (str) {
    return typeof str === 'string' ? str.toLowerCase() : '';
  });

  Handlebars.registerHelper('capitalize', function (str) {
    return typeof str === 'string' ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  });

  Handlebars.registerHelper('default', function (val, fallback) {
    return val !== undefined && val !== null && val !== '' ? val : fallback;
  });
}

export const FactionPageView: React.FC<FactionPageViewProps> = ({ shortname, user, permissions }) => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<FactionPage | null>(null);
  const [contextData, setContextData] = useState<any>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canModifyPages = user?.is_superadmin || permissions.includes('modify_faction_pages');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pageRes, contextRes] = await Promise.all([
        api.get(`/factions/${shortname}/pages/${slug}`),
        api.get(`/factions/${shortname}/pages/context-data`),
      ]);

      const loadedPage: FactionPage = pageRes.data;
      const loadedContext = contextRes.data;

      setPage(loadedPage);
      setContextData(loadedContext);

      // Compile Handlebars template safely
      try {
        const template = Handlebars.compile(loadedPage.content || '');
        const rawOutput = template(loadedContext);

        // Sanitize rendered HTML using DOMPurify
        const cleanOutput = DOMPurify.sanitize(rawOutput, {
          ADD_TAGS: ['style', 'script'],
          ADD_ATTR: ['target', 'class', 'style', 'id', 'data-*', 'on*'],
        });

        setRenderedHtml(cleanOutput);

        // Execute any script tags within the sanitized custom page HTML
        setTimeout(() => {
          const container = document.querySelector('.faction-page-rendered');
          if (container) {
            const scripts = container.querySelectorAll('script');
            scripts.forEach((oldScript) => {
              const newScript = document.createElement('script');
              Array.from(oldScript.attributes).forEach((attr) =>
                newScript.setAttribute(attr.name, attr.value)
              );
              newScript.appendChild(document.createTextNode(oldScript.innerHTML));
              oldScript.parentNode?.replaceChild(newScript, oldScript);
            });
          }
        }, 50);
      } catch (compileErr: any) {
        console.error('Handlebars compile error:', compileErr);
        setRenderedHtml(`<div className="p-4 border border-red-500/50 bg-red-500/10 text-red-400 rounded">
          <strong>Template Rendering Error:</strong> ${compileErr.message || 'Syntax error in Handlebars markup'}
        </div>`);
      }
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
        <div 
          className="faction-page-rendered prose max-w-none text-text"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    </main>
  );
};

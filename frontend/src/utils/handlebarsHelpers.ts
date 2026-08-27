import Handlebars from 'handlebars';
import DOMPurify from 'dompurify';

export function resolveRecordEntries(records: any, databases: any[], dbName: any): any[] {
  if (!records || !dbName) return [];
  const target = String(dbName).trim();
  if (records[target]) return records[target];

  const targetLower = target.toLowerCase();
  if (records[targetLower]) return records[targetLower];

  const targetUpper = target.toUpperCase();
  if (records[targetUpper]) return records[targetUpper];

  const slugified = targetLower.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (records[slugified]) return records[slugified];

  const foundDb = Array.isArray(databases)
    ? databases.find(
        (d: any) =>
          String(d.id) === target ||
          (d.name && String(d.name).toLowerCase() === targetLower) ||
          (d.record_shortcode && String(d.record_shortcode).toLowerCase() === targetLower) ||
          (d.is_api_database && String(d.is_api_database).toLowerCase() === targetLower) ||
          (d.name && String(d.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') === targetLower)
      )
    : null;

  if (foundDb) {
    return (
      records[foundDb.id] ||
      records[String(foundDb.id)] ||
      records[foundDb.is_api_database] ||
      records[foundDb.record_shortcode] ||
      records[foundDb.name] ||
      []
    );
  }

  return [];
}

export function setupHandlebarsAndDOMPurify() {
  if (!(Handlebars as any)._customHelpersRegistered) {
    (Handlebars as any)._customHelpersRegistered = true;

    // json helper: returns raw JSON string by default (or SafeString)
    Handlebars.registerHelper('json', function (context, options) {
      try {
        if (options?.hash?.pretty || options?.hash?.wrap) {
          const indent = options?.hash?.indent ? parseInt(options.hash.indent, 10) : 2;
          return new Handlebars.SafeString(
            `<pre className="bg-black/20 p-3 rounded font-mono text-xs overflow-auto"><code>${JSON.stringify(
              context,
              null,
              indent
            )}</code></pre>`
          );
        }
        const indent = options?.hash?.indent ? parseInt(options.hash.indent, 10) : 0;
        const jsonStr = indent > 0 
          ? JSON.stringify(context !== undefined ? context : null, null, indent) 
          : JSON.stringify(context !== undefined ? context : null);
        return new Handlebars.SafeString(jsonStr);
      } catch (e) {
        return 'null';
      }
    });

    Handlebars.registerHelper('toJson', function (context, options) {
      return (Handlebars as any).helpers.json(context, options);
    });

    Handlebars.registerHelper('jsonRaw', function (context) {
      return new Handlebars.SafeString(JSON.stringify(context !== undefined ? context : null));
    });

    Handlebars.registerHelper('jsonPretty', function (context, options) {
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
      const root = options?.data?.root || {};
      return resolveRecordEntries(root.records, root.record_databases, dbName);
    });

    Handlebars.registerHelper('getRecordDatabase', function (dbName, options) {
      const databases = options?.data?.root?.record_databases || [];
      const target = String(dbName).toLowerCase();
      return databases.find((d: any) => 
        String(d.id) === String(dbName) || 
        (d.record_shortcode && String(d.record_shortcode).toLowerCase() === target) ||
        (d.is_api_database && String(d.is_api_database).toLowerCase() === target) ||
        (d.name && String(d.name).toLowerCase() === target) ||
        (d.name && String(d.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') === target)
      ) || null;
    });

    Handlebars.registerHelper('filterRecords', function (dbName, fieldName, value, options) {
      const root = options?.data?.root || {};
      const entries = resolveRecordEntries(root.records, root.record_databases, dbName);
      return entries.filter((e: any) => {
        const data = e.entry_data || e.data || e;
        return data && String(data[fieldName]) === String(value);
      });
    });

    Handlebars.registerHelper('findRecord', function (dbName, fieldName, value, options) {
      const root = options?.data?.root || {};
      const entries = resolveRecordEntries(root.records, root.record_databases, dbName);
      return (
        entries.find((e: any) => {
          const data = e.entry_data || e.data || e;
          return data && String(data[fieldName]) === String(value);
        }) || null
      );
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
}

export function getDOMPurifyInstance() {
  if (typeof DOMPurify === 'function' && !(DOMPurify as any).sanitize) {
    return (DOMPurify as any)(typeof window !== 'undefined' ? window : undefined);
  }
  return DOMPurify;
}

export function sanitizeHtml(rawHtml: string): string {
  const purify = getDOMPurifyInstance();
  if (purify && typeof purify.addHook === 'function' && !(purify as any)._eventHookAdded) {
    (purify as any)._eventHookAdded = true;
    try {
      purify.addHook('uponSanitizeAttribute', (_node: any, data: any) => {
        if (data.attrName && data.attrName.startsWith('on')) {
          data.forceKeepAttr = true;
        }
      });
    } catch (e) {
      // Ignore if hook fails
    }
  }

  if (purify && typeof purify.sanitize === 'function') {
    return purify.sanitize(rawHtml, {
      ADD_TAGS: ['style'],
      ADD_ATTR: [
        'target', 'class', 'style', 'id', 'data-*',
        'onclick', 'oninput', 'onchange', 'onkeyup', 'onkeydown', 'onsubmit', 'onreset',
      ],
    });
  }

  return rawHtml;
}

/**
 * Compiles a Handlebars custom page template, extracts <script> tags so DOMPurify
 * does not strip them, sanitizes the remaining HTML, and returns both.
 */
export function renderCustomPage(
  templateContent: string,
  contextData: any
): { html: string; scripts: string[] } {
  try {
    const template = Handlebars.compile(templateContent || '');
    const rawOutput = template(contextData || {});

    const scripts: string[] = [];

    // Extract all script tags before DOMPurify so they don't get stripped/corrupted
    const htmlWithoutScripts = rawOutput.replace(
      /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
      (_match, scriptBody) => {
        scripts.push(scriptBody);
        return '';
      }
    );

    const cleanHtml = sanitizeHtml(htmlWithoutScripts);

    return { html: cleanHtml, scripts };
  } catch (err: any) {
    return {
      html: `<div class="p-4 border border-red-500/50 bg-red-500/10 text-red-400 rounded text-xs">
        <strong>Template Rendering Error:</strong> ${err.message || 'Syntax error in Handlebars markup'}
      </div>`,
      scripts: [],
    };
  }
}

/**
 * Execute extracted script strings in the global browser context in sequential order.
 */
export function executeExtractedScripts(scripts: string[]) {
  if (!Array.isArray(scripts) || scripts.length === 0) return;
  scripts.forEach((code, idx) => {
    if (!code || !code.trim()) return;
    try {
      const newScript = document.createElement('script');
      newScript.text = code;
      document.head.appendChild(newScript);
      document.head.removeChild(newScript);
    } catch (e) {
      console.warn(`Script #${idx + 1} execution via document.head failed, falling back to window.eval:`, e);
      try {
        (window as any).eval(code);
      } catch (evalErr) {
        console.error(`Script #${idx + 1} execution failed:`, evalErr);
      }
    }
  });
}

/**
 * Fallback: Execute script tags embedded inside an element container in the global browser context.
 */
export function executeScriptsInElement(container: HTMLElement | null) {
  if (!container) return;
  const scripts = Array.from(container.querySelectorAll('script'));
  scripts.forEach((oldScript) => {
    const code = oldScript.text || oldScript.textContent || oldScript.innerHTML || '';
    if (!code.trim()) return;

    try {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr: Attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.text = code;
      document.head.appendChild(newScript);
      document.head.removeChild(newScript);
    } catch (e) {
      console.warn('Script execution via document.head failed, falling back to window.eval:', e);
      try {
        (window as any).eval(code);
      } catch (evalErr) {
        console.error('Failed to execute page script:', evalErr);
      }
    }
  });
}



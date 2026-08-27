# Antelope Faction Pages Guide

This guide provides a comprehensive manual, AI instruction prompt template, variable reference, Handlebars data manipulation helpers, layout examples, and security limitations for creating custom **Faction Pages** in Antelope.

---

## Table of Contents
1. [AI Prompt Template](#1-ai-prompt-template)
2. [Available Variables](#2-available-variables)
3. [Data Manipulation & Handlebars Helpers](#3-data-manipulation--handlebars-helpers)
4. [Example Page Templates & Visual Results](#4-example-page-templates--visual-results)
5. [Client-Side JavaScript & Search Systems](#5-client-side-javascript--search-systems)
6. [Security & Technical Limitations](#6-security--technical-limitations)

---

## 1. AI Prompt Template

Copy and paste the following prompt template into an AI (e.g. Gemini, ChatGPT, Claude) to quickly generate clean HTML and Handlebars templates for your Antelope Faction Page.

```text
You are an expert front-end developer building a custom Faction Page for Antelope (a GTA:W faction management suite using Tailwind CSS colors and Handlebars.js).

Task: Generate custom HTML and Handlebars markup for a page named "[PAGE NAME / e.g. Equipment Log & Dispatch Desk]".

Requirements:
- Design a high-performance, dark-themed UI using Tailwind utility classes (e.g., bg-card, text-text, border-border, bg-accent/10, text-accent, rounded-lg, shadow).
- Use Handlebars expressions to dynamically render data from the context.
- Available Context Data:
  - `faction` (name, shortname, color, members_count, roles_count, groups_count, rosters_count, records_count)
  - `user` (username, display_name, email, is_superadmin, is_faction_leader, roles, groups)
  - `roles` (array of roles with name, color, weight, members_count)
  - `groups` (array of groups with name, color, description, members_count)
  - `record_databases` (array of databases with name, description, record_shortcode, entries_count, entries)
  - `records` (dictionary mapping database names and shortcodes to entries)
- Available Helpers: `{{json ...}}`, `{{#each (getRecordEntries "Database Name")}}`, `{{#each (filterRecords "Database Name" "status" "Active")}}`, `{{#each (sortRecords entries "created_at" "desc")}}`, `{{count entries}}`, `{{formatDate dateStr}}`, `{{#if (eq ...)}}`.

Please provide ONLY valid HTML and Handlebars markup without surrounding markdown codeblocks if intended for direct copy-paste.
```

---

## 2. Available Variables

When a Faction Page compiles, the following variables are automatically injected into the Handlebars execution context:

### `faction` (Object)
| Attribute | Type | Description |
| :--- | :--- | :--- |
| `faction.id` | `number` | Unique ID of the faction. |
| `faction.name` | `string` | Full name of the faction (e.g., `"Los Santos Police Department"`). |
| `faction.shortname` | `string` | Lowercase URL slug (e.g., `"lspd"`). |
| `faction.color` | `string` | Faction accent hex color (e.g., `"#ef4444"`). |
| `faction.description` | `string` | Faction description. |
| `faction.members_count` | `number` | Total active members in the faction. |
| `faction.roles_count` | `number` | Number of ranks/roles configured. |
| `faction.groups_count` | `number` | Number of groups configured. |
| `faction.rosters_count` | `number` | Number of rosters. |
| `faction.records_count` | `number` | Number of record databases accessible by the viewer. |
| `faction.gtaw_faction_id` | `number` | Linked GTA World faction ID. |
| `faction.header_image_dark` | `string` | Header banner URL (dark theme). |
| `faction.header_image_light`| `string` | Header banner URL (light theme). |
| `faction.favicon` | `string` | Custom favicon URL. |

### `user` (Object)
| Attribute | Type | Description |
| :--- | :--- | :--- |
| `user.id` | `number` | Unique user ID. |
| `user.username` | `string` | User's primary username. |
| `user.display_name` | `string` | User's display name. |
| `user.email` | `string` | User's email address. |
| `user.gtaw_id` | `number` | User's linked GTA World account ID. |
| `user.avatar_url` | `string` | User avatar image URL. |
| `user.is_superadmin` | `boolean` | `true` if user is a system superadmin. |
| `user.is_faction_leader` | `boolean` | `true` if user is the leader of this faction. |
| `user.roles` | `array` | List of roles assigned to the user in this faction (`name`, `color`, `weight`). |
| `user.groups` | `array` | List of groups assigned to the user (`name`, `color`, `is_leader`). |

### `roles` (Array)
Array of all faction roles ordered by weight descending:
```handlebars
{{#each roles}}
  <div style="color: {{color}}">
    {{name}} — Weight: {{weight}} ({{members_count}} members)
  </div>
{{/each}}
```

### `groups` (Array)
Array of all faction groups:
```handlebars
{{#each groups}}
  <div className="p-2 border border-border">
    <strong>{{name}}</strong>: {{description}} ({{members_count}} members)
  </div>
{{/each}}
```

### `record_databases` (Array) & `records` (Dictionary)
List of all record databases accessible by the current viewer:
- `record_databases`: Array of database objects (`id`, `name`, `description`, `record_shortcode`, `entries_count`, `structure`, `entries`).
- `records`: Map of entries indexed by database Name, Shortcode, and Slugified Name (e.g. `records["Armory Log"]` or `records.armory_log`).

```handlebars
{{#each record_databases}}
  <h3>{{name}} ({{entries_count}} entries)</h3>
{{/each}}
```

### Date & System Environment
| Variable | Value Example | Description |
| :--- | :--- | :--- |
| `current_date` | `"2026-08-27"` | Current date in `YYYY-MM-DD` format. |
| `current_time` | `"12:30:00"` | Current time in `HH:mm:ss` format. |
| `current_timestamp` | `"2026-08-27 12:30:00"` | Full current timestamp. |
| `site.name` | `"Antelope"` | System branding. |
| `site.version` | `"1.0.0"` | Platform version. |

---

## 3. Data Manipulation & Handlebars Helpers

Antelope includes custom Handlebars helpers to manipulate, query, format, and filter data directly inside your template markup:

### Data Querying & Filtering Helpers
- `{{getRecordEntries "Database Name"}}`: Returns an array of entry objects for the specified record database.
  ```handlebars
  {{#each (getRecordEntries "Equipment Log")}}
    <div>Entry #{{id}} — Created: {{formatDate created_at}}</div>
  {{/each}}
  ```
- `{{getRecordDatabase "Database Name"}}`: Retrieves database metadata object by name or shortcode.
- `{{filterRecords "Database Name" "column_name" "value"}}`: Filters database entries where `entry_data[column_name] == value`.
  ```handlebars
  {{#each (filterRecords "Equipment Log" "Status" "Issued")}}
    <div>Item: {{entry_data.item_name}} — Issued To: {{entry_data.officer}}</div>
  {{/each}}
  ```
- `{{findRecord "Database Name" "column_name" "value"}}`: Returns the first entry matching the field condition.
- `{{sortRecords entries "column_name" "asc"|"desc"}}`: Sorts an array of entries by field name.
- `{{limitRecords entries 5 0}}`: Returns a subset/sliced array (limit, offset).

### Aggregation & Math Helpers
- `{{count array}}`: Returns the number of items in an array. `{{count (getRecordEntries "Armory")}}`.
- `{{sumField entries "column_name"}}`: Sums numeric values of a field across all entries.
- `{{averageField entries "column_name"}}`: Calculates the average numeric value of a field across all entries.
- `{{first array}}` / `{{last array}}`: Retrieves the first or last item in an array.

### Logic & Comparison Helpers
- `{{#if (eq a b)}} ... {{/if}}`: Equal comparison.
- `{{#if (ne a b)}} ... {{/if}}`: Not equal comparison.
- `{{#if (gt a b)}} ... {{/if}}`: Greater than.
- `{{#if (gte a b)}} ... {{/if}}`: Greater than or equal.
- `{{#if (lt a b)}} ... {{/if}}`: Less than.
- `{{#if (lte a b)}} ... {{/if}}`: Less than or equal.
- `{{#if (and a b)}} ... {{/if}}`: Logical AND.
- `{{#if (or a b)}} ... {{/if}}`: Logical OR.
- `{{#if (not a)}} ... {{/if}}`: Logical NOT.

### Formatting & Utility Helpers
- `{{json data}}`: Pretty-prints JSON formatted inside `<pre><code>`.
- `{{formatDate dateStr}}`: Converts ISO date string into readable local format.
- `{{upper str}}` / `{{lower str}}` / `{{capitalize str}}`: String case transformers.
- `{{default value fallback}}`: Returns `fallback` if `value` is empty/null.

---

## 4. Example Page Templates & Visual Results

### Example A: Faction Command Dashboard

```html
<div className="p-6 bg-card border border-border rounded-xl space-y-6">
  <!-- Header Banner -->
  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
    <div>
      <h1 className="text-2xl font-bold text-text">{{faction.name}} Operations</h1>
      <p className="text-xs text-muted font-mono">Panel Overview &bull; {{current_date}}</p>
    </div>
    <div className="px-3 py-1 bg-accent/10 border border-accent/20 text-accent font-bold text-xs rounded-full">
      Logged as {{user.username}}
    </div>
  </div>

  <!-- Key Metrics Grid -->
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div className="p-4 bg-bg border border-border rounded-lg text-center">
      <span className="text-xs text-muted font-bold uppercase tracking-wider block">Total Members</span>
      <span className="text-2xl font-black text-accent">{{faction.members_count}}</span>
    </div>
    <div className="p-4 bg-bg border border-border rounded-lg text-center">
      <span className="text-xs text-muted font-bold uppercase tracking-wider block">Ranks</span>
      <span className="text-2xl font-black text-accent">{{faction.roles_count}}</span>
    </div>
    <div className="p-4 bg-bg border border-border rounded-lg text-center">
      <span className="text-xs text-muted font-bold uppercase tracking-wider block">Groups</span>
      <span className="text-2xl font-black text-accent">{{faction.groups_count}}</span>
    </div>
    <div className="p-4 bg-bg border border-border rounded-lg text-center">
      <span className="text-xs text-muted font-bold uppercase tracking-wider block">Record DBs</span>
      <span className="text-2xl font-black text-accent">{{faction.records_count}}</span>
    </div>
  </div>

  <!-- Ranks List -->
  <div>
    <h3 className="text-sm font-bold text-text uppercase tracking-wider mb-3">Faction Hierarchy Ranks</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
      {{#each roles}}
        <div className="p-2.5 bg-bg border border-border rounded flex items-center justify-between">
          <span className="font-bold text-xs" style="color: {{color}}">{{name}}</span>
          <span className="text-[10px] bg-card px-2 py-0.5 rounded font-mono border border-border text-muted">{{members_count}} members</span>
        </div>
      {{/each}}
    </div>
  </div>
</div>
```

---

## 5. Client-Side JavaScript & Search Systems

You can create interactive client-side components (like real-time search inputs or interactive filtering tables) by embedding client-side HTML `<input>` elements and standard JavaScript `<script>` blocks.

### Example: Live Record Search System

```html
<div className="p-6 bg-card border border-border rounded-xl space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-bold text-text">Armory Search Portal</h2>
    <input 
      type="text" 
      id="recordSearchInput" 
      oninput="filterArmoryTable()"
      placeholder="Type officer or serial number..." 
      className="bg-bg border border-border rounded px-3 py-1.5 text-xs text-text focus:outline-none focus:border-accent w-64"
    />
  </div>

  <table className="w-full text-left text-xs border-collapse" id="armoryTable">
    <thead>
      <tr className="border-b border-border text-muted uppercase text-[10px] tracking-wider">
        <th className="p-2">Item ID</th>
        <th className="p-2">Officer</th>
        <th className="p-2">Serial / Item</th>
        <th className="p-2">Date</th>
      </tr>
    </thead>
    <tbody>
      {{#each (getRecordEntries "Armory Log")}}
        <tr className="border-b border-border/50 hover:bg-bg/50 record-row">
          <td className="p-2 font-mono">#{{id}}</td>
          <td className="p-2 font-bold search-target">{{entry_data.officer_name}}</td>
          <td className="p-2 search-target">{{entry_data.item_serial}}</td>
          <td className="p-2 text-muted">{{formatDate created_at}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>
</div>

<script>
  function filterArmoryTable() {
    const input = document.getElementById('recordSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#armoryTable .record-row');

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(input) ? '' : 'none';
    });
  }
</script>
```

---

## 6. Security & Technical Limitations

To ensure user safety and high performance across all factions, the following guidelines and boundaries are enforced:

### Sanitization (DOMPurify)
All compiled HTML output passes through **DOMPurify** before rendering.
- Dangerous script injections stealing authentication tokens (`localStorage.getItem('access_token')`) or executing malicious external payloads are sanitized.
- Safe HTML elements (`<div>`, `<table>`, `<style>`, `<input>`, `<button>`, `<script>`) and standard CSS classes (`className="..."`, `style="..."`) are allowed.

### Data Access Boundaries
- Faction Pages can **only read** context data granted to the logged-in user.
- If a user does not have `view_database` permission for a specific record database, that database and its entries are excluded from `record_databases` and `records` context data before compilation.

### Read-Only Data Operations
- Handlebars expressions and client-side JavaScript on a Faction Page are strictly for **presentation and filtering**.
- Modifying backend Eloquent models or saving record entries requires using Antelope's official REST API endpoints via authenticated Axios calls (`/api/...`).

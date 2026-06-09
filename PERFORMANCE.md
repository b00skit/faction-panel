# Performance Optimization & Refactoring Strategy

This document outlines the current performance bottlenecks in the Antelope (Faction Panel) suite and provides a roadmap for refactoring to relieve CPU pressure on the server.

## Current Bottlenecks

### 1. Roster Data Resolution (`RosterController@index`)
The current implementation of loading a faction's rosters is the most CPU-intensive part of the application.
- **Problem:** It loads the entire roster tree (Sections -> Sub-sections -> Contents) into memory and performs manual "link resolution" and "permission masking" in PHP.
- **Impact:** High CPU usage during JSON parsing and collection iteration. High memory usage for large factions.
- **Refactor Goal:** 
    - Implement **Pagination** or **Lazy Loading** for roster sections/contents.
    - Move permission filtering from PHP collections to SQL queries.
    - Cache the resolved roster JSON in Redis/Memcached and invalidate only on change.

### 2. Statistics Calculation (`StatisticsService`)
Statistics are currently calculated on-the-fly by fetching large collections of rows and filtering them in PHP.
- **Problem:** Every time a dashboard is viewed, the server fetches thousands of rows to perform simple counts or sums.
- **Impact:** Drastic CPU spikes when multiple users view data-heavy dashboards.
- **Refactor Goal:**
    - Use **Raw SQL Aggregations** instead of Laravel Collections for calculations.
    - Implement a **Snapshot System**: Store calculated stats in a dedicated table and update them via scheduled tasks or specific triggers, rather than on every request.

### 3. Roster Synchronization (`RosterSyncService`)
Re-syncing roster data with linked databases involves iterating over every row and evaluating "auto-apply" logic.
- **Problem:** Linear processing of large datasets in a single request.
- **Impact:** Potential timeouts and 100% CPU usage for several seconds.
- **Refactor Goal:**
    - Offload synchronization to **Queued Background Jobs**.
    - Process synchronization in **Chunks** to keep memory footprint low.

### 4. JSON Content Overhead
The `RosterContent` model stores data in a single `content` JSON column.
- **Problem:** Database cannot efficiently index or filter specific fields within the JSON at scale without complex functional indexes.
- **Impact:** Slower queries as the dataset grows.

---

## Real-time Strategy: Laravel Reverb

### Should we use Laravel Reverb for Roster Data?
**Yes**, but with a specific strategy.

#### Current Issue
The frontend likely polls the roster index or individual roster endpoints to stay updated. This causes the expensive `RosterController@index` logic to run repeatedly even when no data has changed.

#### Proposed Reverb Implementation
1. **Event Signals:** Instead of sending the entire roster over WebSockets (which would be too heavy), use Reverb to broadcast "Signal Events" (e.g., `RosterUpdated`, `RowAdded`).
2. **Targeted Invalidation:** When the frontend receives a `RosterUpdated` signal, it can trigger a single re-fetch of the data.
3. **Real-time Row Updates:** For high-activity rosters, broadcast the *specific* change (e.g., the new value of one cell) so the frontend can update its local state without a full refresh.

**Benefit:** Drastically reduces HTTP request volume and redundant "resolution" logic execution on the server.

---

## Immediate Action Items (Priority Order)

1. **Caching Layer:** Implement `Cache::remember` for `RosterController@index` based on `faction_id` and `user_id`. Invalidate cache when any `RosterContent` or `Roster` in that faction is updated.
2. **SQL Aggregates:** Refactor `StatisticsService` to use `count()`, `sum()`, and `whereJsonContains()` at the database level.
3. **Queue Syncing:** Update `FactionController@syncRosterData` to dispatch a job instead of running the service inline.
4. **Reverb Integration:** Set up Reverb to handle "Presence" (who is viewing the roster) and "Updates" (notify clients to refresh).

## Future Considerations
- **Database Normalization:** If specific columns are frequently used for filtering/stats, consider extracting them from the JSON `content` into a dedicated `RosterData` EAV table or dynamic columns.
- **Soketi/Reverb Scaling:** As the number of concurrent users grows, ensure the WebSocket server is properly load-balanced.

<?php

namespace App\Formula;

use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\Roster;
use App\Models\RosterContent;
use Illuminate\Support\Collection;

class EvaluationContext
{
    private int $factionId;

    private array $variables = [];

    public function __construct(int $factionId, array $variables = [])
    {
        $this->factionId = $factionId;
        $this->variables = $variables;
    }

    public function getVariable(string $name): mixed
    {
        if (array_key_exists($name, $this->variables)) {
            return $this->variables[$name];
        }

        return null;
    }

    public function callFunction(string $name, array $args): mixed
    {
        $method = 'fn_'.strtolower($name);
        if (method_exists($this, $method)) {
            return $this->$method(...$args);
        }
        throw new \Exception('Undefined function: '.$name);
    }

    // --- Helper function implementations ---

    public function fn_rosters(): Collection
    {
        return Roster::where('faction_id', $this->factionId)->get();
    }

    public function fn_roster(mixed $idOrName): ?Roster
    {
        return Roster::where('faction_id', $this->factionId)
            ->where(function ($q) use ($idOrName) {
                if (is_numeric($idOrName)) {
                    $q->where('id', (int) $idOrName);
                } else {
                    $q->where('name', $idOrName)
                        ->orWhere('shortname', $idOrName);
                }
            })->first();
    }

    public function fn_roster_rows(mixed $rosterIdOrName, ...$filters): Collection
    {
        $roster = $this->fn_roster($rosterIdOrName);
        if (! $roster) {
            return collect();
        }

        $query = RosterContent::whereHas('section', function ($q) use ($roster) {
            $q->where('roster_id', $roster->id);
        });

        // Apply filters (even number of arguments after rosterIdOrName)
        $columns = $roster->columns ?? [];
        for ($i = 0; $i < count($filters); $i += 2) {
            $colName = $filters[$i] ?? null;
            $val = $filters[$i + 1] ?? null;
            if (is_null($colName)) {
                continue;
            }

            $colId = $colName;
            foreach ($columns as $col) {
                if (($col['name'] ?? '') === $colName || ($col['id'] ?? '') === $colName) {
                    $colId = $col['id'];
                    break;
                }
            }

            $query->where("content->{$colId}", $val);
        }

        return $query->get();
    }

    public function fn_roster_count(mixed $rosterIdOrName, ...$filters): float
    {
        $roster = $this->fn_roster($rosterIdOrName);
        if (! $roster) {
            return 0.0;
        }

        $query = RosterContent::whereHas('section', function ($q) use ($roster) {
            $q->where('roster_id', $roster->id);
        });

        $columns = $roster->columns ?? [];
        for ($i = 0; $i < count($filters); $i += 2) {
            $colName = $filters[$i] ?? null;
            $val = $filters[$i + 1] ?? null;
            if (is_null($colName)) {
                continue;
            }

            $colId = $colName;
            foreach ($columns as $col) {
                if (($col['name'] ?? '') === $colName || ($col['id'] ?? '') === $colName) {
                    $colId = $col['id'];
                    break;
                }
            }

            $query->where("content->{$colId}", $val);
        }

        return (float) $query->count();
    }

    public function fn_database(mixed $idOrName): ?FactionRecordDatabase
    {
        return FactionRecordDatabase::where('faction_id', $this->factionId)
            ->where(function ($q) use ($idOrName) {
                if (is_numeric($idOrName)) {
                    $q->where('id', (int) $idOrName);
                } else {
                    $q->where('name', $idOrName)
                        ->orWhere('record_shortcode', $idOrName);
                }
            })->first();
    }

    public function fn_database_rows(mixed $dbIdOrName, ...$filters): Collection
    {
        $db = $this->fn_database($dbIdOrName);
        if (! $db) {
            return collect();
        }

        $query = $db->entries()->where('is_active', true);

        // Apply filters
        $structure = $db->database_structure ?? [];
        for ($i = 0; $i < count($filters); $i += 2) {
            $colName = $filters[$i] ?? null;
            $val = $filters[$i + 1] ?? null;
            if (is_null($colName)) {
                continue;
            }

            $colId = $colName;
            foreach ($structure as $col) {
                if (($col['name'] ?? '') === $colName || ($col['id'] ?? '') === $colName) {
                    $colId = $col['id'];
                    break;
                }
            }

            $query->where("data->{$colId}", $val);
        }

        return $query->get();
    }

    public function fn_database_count(mixed $dbIdOrName, ...$filters): float
    {
        $db = $this->fn_database($dbIdOrName);
        if (! $db) {
            return 0.0;
        }

        $query = $db->entries()->where('is_active', true);

        $structure = $db->database_structure ?? [];
        for ($i = 0; $i < count($filters); $i += 2) {
            $colName = $filters[$i] ?? null;
            $val = $filters[$i + 1] ?? null;
            if (is_null($colName)) {
                continue;
            }

            $colId = $colName;
            foreach ($structure as $col) {
                if (($col['name'] ?? '') === $colName || ($col['id'] ?? '') === $colName) {
                    $colId = $col['id'];
                    break;
                }
            }

            $query->where("data->{$colId}", $val);
        }

        return (float) $query->count();
    }

    public function fn_count(mixed $collection): float
    {
        if (is_null($collection)) {
            return 0.0;
        }
        if (is_numeric($collection) || is_string($collection) || is_bool($collection)) {
            return 1.0;
        }

        return (float) $this->toCollection($collection)->count();
    }

    public function fn_sum(mixed $collection, string $property): float
    {
        $coll = $this->toCollection($collection);

        return (float) $coll->sum(fn ($item) => (float) $this->getPropertyVal($item, $property));
    }

    public function fn_avg(mixed $collection, string $property): float
    {
        $coll = $this->toCollection($collection);
        if ($coll->count() === 0) {
            return 0.0;
        }

        return (float) round($coll->average(fn ($item) => (float) $this->getPropertyVal($item, $property)), 2);
    }

    public function fn_min(mixed $collection, string $property): float
    {
        $coll = $this->toCollection($collection);
        if ($coll->count() === 0) {
            return 0.0;
        }

        return (float) $coll->min(fn ($item) => $this->getPropertyVal($item, $property));
    }

    public function fn_max(mixed $collection, string $property): float
    {
        $coll = $this->toCollection($collection);
        if ($coll->count() === 0) {
            return 0.0;
        }

        return (float) $coll->max(fn ($item) => $this->getPropertyVal($item, $property));
    }

    public function fn_filter(mixed $collection, string $key, mixed $value): Collection
    {
        $coll = $this->toCollection($collection);

        return $coll->filter(fn ($item) => strtolower((string) $this->getPropertyVal($item, $key)) === strtolower((string) $value))->values();
    }

    // --- Property resolution and collection conversion helpers ---

    public function toCollection(mixed $data): Collection
    {
        if ($data instanceof Collection) {
            return $data;
        }
        if (is_array($data)) {
            return collect($data);
        }

        return collect($data ? [$data] : []);
    }

    public function getPropertyVal(mixed $item, string $property): mixed
    {
        if (is_array($item)) {
            return $item[$property] ?? null;
        }
        if ($item instanceof RosterContent) {
            $colId = $property;
            // Let's resolve the column name if we can access the roster columns
            if ($item->section && $item->section->roster) {
                foreach (($item->section->roster->columns ?? []) as $col) {
                    if (($col['name'] ?? '') === $property || ($col['id'] ?? '') === $property) {
                        $colId = $col['id'];
                        break;
                    }
                }
            }

            return ($item->content ?? [])[$colId] ?? null;
        }
        if ($item instanceof FactionRecordEntry) {
            $colId = $property;
            if ($item->database) {
                foreach (($item->database->database_structure ?? []) as $col) {
                    if (($col['name'] ?? '') === $property || ($col['id'] ?? '') === $property) {
                        $colId = $col['id'];
                        break;
                    }
                }
            }

            return ($item->data ?? [])[$colId] ?? null;
        }
        if (is_object($item)) {
            return $item->$property ?? null;
        }

        return null;
    }
}

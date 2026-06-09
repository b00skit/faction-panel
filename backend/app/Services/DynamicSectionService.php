<?php

namespace App\Services;

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\RosterContent;
use App\Models\RosterSection;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;

class DynamicSectionService
{
    private static $databaseCache = [];

    private static $rosterValueCache = [];

    /**
     * Resolve dynamic content for a section.
     */
    public function resolve(RosterSection $section, Faction $faction)
    {
        if ($section->data_source !== 'dynamic') {
            return;
        }

        $config = $section->section_options['dynamic_config'] ?? null;
        if (! $config) {
            $section->setRelation('contents', collect([]));

            return;
        }

        $sourceType = $config['source_type'] ?? null;
        $sourceId = $config['source_id'] ?? null;
        $rules = $config['rules'] ?? [];
        $mappings = $config['mappings'] ?? [];

        $data = [];

        if ($sourceType === 'database' && $sourceId) {
            if (! isset(self::$databaseCache[$sourceId])) {
                self::$databaseCache[$sourceId] = FactionRecordDatabase::with('entries')->find($sourceId);
            }
            $database = self::$databaseCache[$sourceId];

            if ($database && $database->faction_id === $faction->id) {
                foreach ($database->entries as $entry) {
                    $data[] = [
                        'id' => 'db_'.$entry->id,
                        'source_entry_id' => $entry->entry_id,
                        'data' => $entry->data,
                        'is_active' => $entry->is_active,
                        'created_at' => $entry->created_at,
                        'updated_at' => $entry->updated_at,
                    ];
                }
            }
        } elseif ($sourceType === 'section' && $sourceId) {
            $sourceSection = RosterSection::with('contents')->find($sourceId);
            if ($sourceSection) {
                $sourceRoster = $sourceSection->roster;
                if ($sourceRoster && User::canViewRoster(Auth::user(), $sourceRoster)) {
                    foreach ($sourceSection->contents as $content) {
                        $data[] = [
                            'id' => 'sec_'.$content->id,
                            'data' => $content->content,
                            'type' => $content->type,
                            'created_at' => $content->created_at,
                            'updated_at' => $content->updated_at,
                        ];
                    }
                }
            }
        }

        // Apply Logic Rules (Filtering)
        foreach ($rules as $rule) {
            $data = $this->applyRule($data, $rule, $faction);
        }

        // Apply Global Sorting if defined
        if (isset($config['sort_field'])) {
            $sortField = $config['sort_field'];
            $sortOrder = $config['sort_order'] ?? 'asc';
            usort($data, function ($a, $b) use ($sortField, $sortOrder) {
                $valA = $a['data'][$sortField] ?? '';
                $valB = $b['data'][$sortField] ?? '';
                if ($sortOrder === 'asc') {
                    return strnatcasecmp($valA, $valB);
                }

                return strnatcasecmp($valB, $valA);
            });
        }

        // Transform data into RosterContent format with Mappings
        $resolvedContents = [];
        foreach ($data as $index => $item) {
            if (isset($item['type']) && $item['type'] === 'spacer') {
                continue;
            }

            $content = new RosterContent;
            $content->id = (int) str_replace(['db_', 'sec_'], '', $item['id']);
            $content->section_id = $section->id;
            $content->order = $index;
            $content->type = 'defined';

            // Apply Data Mapping
            $mappedData = [];
            if (! empty($mappings)) {
                foreach ($mappings as $targetColId => $sourceKey) {
                    if ($sourceKey === '__created_at') {
                        $mappedData[$targetColId] = $item['created_at'] ? Carbon::parse($item['created_at'])->format('Y-m-d H:i') : '';
                    } elseif ($sourceKey === '__updated_at') {
                        $mappedData[$targetColId] = $item['updated_at'] ? Carbon::parse($item['updated_at'])->format('Y-m-d H:i') : '';
                    } elseif (str_contains($sourceKey, '{')) {
                        // Template mapping: "Hello {first_name} {last_name}"
                        $mappedData[$targetColId] = preg_replace_callback('/\{([^}]+)\}/', function ($matches) use ($item) {
                            $parts = explode('|', $matches[1]);
                            $key = $parts[0];
                            $transform = $parts[1] ?? null;

                            $val = '';
                            if ($key === '__created_at') {
                                $val = $item['created_at'] ? Carbon::parse($item['created_at'])->format('Y-m-d H:i') : '';
                            } elseif ($key === '__updated_at') {
                                $val = $item['updated_at'] ? Carbon::parse($item['updated_at'])->format('Y-m-d H:i') : '';
                            } else {
                                $val = $item['data'][$key] ?? '';
                            }

                            if ($transform === 'upper') {
                                return strtoupper($val);
                            }
                            if ($transform === 'lower') {
                                return strtolower($val);
                            }
                            if ($transform === 'capitalize') {
                                return ucfirst($val);
                            }
                            if ($transform === 'first') {
                                return substr($val, 0, 1);
                            }

                            return $val;
                        }, $sourceKey);
                    } else {
                        $mappedData[$targetColId] = $item['data'][$sourceKey] ?? null;
                    }
                }
            } else {
                // Default fallback: match by ID if no mapping defined
                $mappedData = $item['data'];
            }

            $content->content = $mappedData;

            // Apply Customization (Checkboxes/Tags based on conditions)
            if (isset($config['customization'])) {
                $this->applyCustomization($content, $config['customization'], $item);
            }

            $resolvedContents[] = $content;
        }

        $section->setRelation('contents', collect($resolvedContents));
    }

    protected function applyRule(array $data, array $rule, Faction $faction)
    {
        $type = $rule['type'] ?? null;
        if (! $type) {
            return $data;
        }

        return array_filter($data, function ($item) use ($rule, $faction, $type) {
            $matchField = $rule['match_field'] ?? null;
            $val = $item['data'][$matchField] ?? null;
            $targetVal = $rule['value'] ?? null;

            // Ensure we are working with strings to prevent TypeErrors in trim/strtolower
            $val = is_string($val) ? $val : '';
            $targetVal = is_string($targetVal) ? $targetVal : '';

            switch ($type) {
                case 'equals':
                    return strtolower(trim($val)) === strtolower(trim($targetVal));

                case 'not_equals':
                    return strtolower(trim($val)) !== strtolower(trim($targetVal));

                case 'contains':
                    return str_contains(strtolower(trim($val)), strtolower(trim($targetVal)));

                case 'not_contains':
                    return ! str_contains(strtolower(trim($val)), strtolower(trim($targetVal)));

                case 'starts_with':
                    return str_starts_with(strtolower(trim($val)), strtolower(trim($targetVal)));

                case 'ends_with':
                    return str_ends_with(strtolower(trim($val)), strtolower(trim($targetVal)));

                case 'matches_regex':
                    try {
                        return preg_match($targetVal, $val);
                    } catch (\Exception $e) {
                        return false;
                    }

                case 'in_list':
                    $list = array_map('trim', explode(',', strtolower($targetVal)));

                    return in_array(strtolower(trim($val)), $list);

                case 'not_in_list':
                    $list = array_map('trim', explode(',', strtolower($targetVal)));

                    return ! in_array(strtolower(trim($val)), $list);

                case 'exists':
                    return ! empty($val);

                case 'not_exists':
                    return empty($val);

                case 'is_numeric':
                    return is_numeric($val);

                case 'greater_than':
                    return (float) $val > (float) $targetVal;

                case 'less_than':
                    return (float) $val < (float) $targetVal;

                case 'between':
                    $parts = explode(',', $targetVal);
                    if (count($parts) !== 2) {
                        return false;
                    }

                    return (float) $val >= (float) $parts[0] && (float) $val <= (float) $parts[1];

                case 'date_after':
                    if (! $val) {
                        return false;
                    }
                    try {
                        return Carbon::parse($val)->isAfter(Carbon::parse($targetVal));
                    } catch (\Exception $e) {
                        return false;
                    }

                case 'date_before':
                    if (! $val) {
                        return false;
                    }
                    try {
                        return Carbon::parse($val)->isBefore(Carbon::parse($targetVal));
                    } catch (\Exception $e) {
                        return false;
                    }

                case 'date_between':
                    if (! $val) {
                        return false;
                    }
                    $parts = explode(',', $targetVal);
                    if (count($parts) !== 2) {
                        return false;
                    }
                    try {
                        return Carbon::parse($val)->between(Carbon::parse($parts[0]), Carbon::parse($parts[1]));
                    } catch (\Exception $e) {
                        return false;
                    }

                case 'is_today':
                    if (! $val) {
                        return false;
                    }
                    try {
                        return Carbon::parse($val)->isToday();
                    } catch (\Exception $e) {
                        return false;
                    }

                case 'is_past':
                    if (! $val) {
                        return false;
                    }
                    try {
                        return Carbon::parse($val)->isPast();
                    } catch (\Exception $e) {
                        return false;
                    }

                case 'is_future':
                    if (! $val) {
                        return false;
                    }
                    try {
                        return Carbon::parse($val)->isFuture();
                    } catch (\Exception $e) {
                        return false;
                    }

                case 'not_in_roster':
                    $targetRosterId = $rule['roster_id'] ?? 'all';
                    $targetField = $rule['target_field'] ?? null;
                    if (! $matchField || ! $targetField) {
                        return true;
                    }

                    $targetValues = $this->getCachedRosterValues($faction, $targetRosterId, $targetField);

                    return ! in_array(strtolower(trim($val)), $targetValues);

                case 'in_roster':
                    $targetRosterId = $rule['roster_id'] ?? 'all';
                    $targetField = $rule['target_field'] ?? null;
                    if (! $matchField || ! $targetField) {
                        return false;
                    }

                    $targetValues = $this->getCachedRosterValues($faction, $targetRosterId, $targetField);

                    return in_array(strtolower(trim($val)), $targetValues);

                default:
                    return true;
            }
        });
    }

    protected function getCachedRosterValues(Faction $faction, $rosterId, $field)
    {
        $cacheKey = "{$rosterId}_{$field}";
        if (isset(self::$rosterValueCache[$cacheKey])) {
            return self::$rosterValueCache[$cacheKey];
        }

        $values = [];
        $rostersQuery = $faction->rosters();
        if ($rosterId !== 'all') {
            $rostersQuery->where('id', $rosterId);
        }

        $user = Auth::user();
        $rostersQuery->where(function ($q) use ($user) {
            $q->where('is_sandbox', false)
                ->orWhere(function ($q2) use ($user) {
                    $q2->where('is_sandbox', true)
                        ->where('created_by', $user ? $user->id : null);
                });
        });

        $rosters = $rostersQuery->with('sections.contents')->get();
        foreach ($rosters as $roster) {
            foreach ($roster->sections as $sec) {
                foreach ($sec->contents as $cont) {
                    if ($cont->type === 'spacer') {
                        continue;
                    }
                    $val = $cont->content[$field] ?? null;
                    if ($val && is_string($val)) {
                        $values[] = strtolower(trim($val));
                    }
                }
            }
        }

        self::$rosterValueCache[$cacheKey] = array_unique($values);

        return self::$rosterValueCache[$cacheKey];
    }

    protected function applyCustomization(RosterContent $content, array $customization, array $sourceItem)
    {
        $newData = $content->content;

        if (isset($customization['rules'])) {
            foreach ($customization['rules'] as $rule) {
                $targetColId = $rule['target_column'] ?? null;
                $action = $rule['action'] ?? null; // 'add_tag', 'add_checkbox', 'set_value'
                $label = $rule['label'] ?? null;

                // Check if item meets condition for this customization
                if ($this->checkCustomizationCondition($sourceItem, $rule)) {
                    if ($action === 'add_tag') {
                        $key = "{$targetColId}_tags";
                        $tags = $newData[$key] ?? [];
                        if (! in_array($label, $tags)) {
                            $tags[] = $label;
                            $newData[$key] = $tags;
                        }
                    } elseif ($action === 'add_checkbox') {
                        $key = "{$targetColId}_cb";
                        $cbs = $newData[$key] ?? [];
                        if (! in_array($label, $cbs)) {
                            $cbs[] = $label;
                            $newData[$key] = $cbs;
                        }
                    } elseif ($action === 'set_value') {
                        $newData[$targetColId] = $label;
                    }
                }
            }
        }

        $content->content = $newData;
    }

    protected function checkCustomizationCondition(array $item, array $rule)
    {
        $condField = $rule['condition_field'] ?? null;
        if (! $condField) {
            return true;
        } // No condition means always apply

        $val = $item['data'][$condField] ?? null;
        $targetVal = $rule['condition_value'] ?? null;
        $op = $rule['condition_operator'] ?? 'equals';

        // Ensure we are working with strings to prevent TypeErrors in trim/strtolower
        $val = is_string($val) ? $val : '';
        $targetVal = is_string($targetVal) ? $targetVal : '';

        switch ($op) {
            case 'equals': return strtolower(trim($val)) === strtolower(trim($targetVal));
            case 'not_equals': return strtolower(trim($val)) !== strtolower(trim($targetVal));
            case 'contains': return str_contains(strtolower(trim($val)), strtolower(trim($targetVal)));
            case 'not_contains': return ! str_contains(strtolower(trim($val)), strtolower(trim($targetVal)));
            case 'starts_with': return str_starts_with(strtolower(trim($val)), strtolower(trim($targetVal)));
            case 'ends_with': return str_ends_with(strtolower(trim($val)), strtolower(trim($targetVal)));
            case 'exists': return ! empty($val);
            case 'not_exists': return empty($val);
            case 'is_numeric': return is_numeric($val);
            case 'greater_than': return (float) $val > (float) $targetVal;
            case 'less_than': return (float) $val < (float) $targetVal;
            case 'is_today':
                try {
                    return Carbon::parse($val)->isToday();
                } catch (\Exception $e) {
                    return false;
                }
            case 'is_past':
                try {
                    return Carbon::parse($val)->isPast();
                } catch (\Exception $e) {
                    return false;
                }
            case 'is_future':
                try {
                    return Carbon::parse($val)->isFuture();
                } catch (\Exception $e) {
                    return false;
                }
            default: return true;
        }
    }
}

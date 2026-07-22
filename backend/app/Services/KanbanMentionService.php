<?php

namespace App\Services;

use App\Models\KanbanCard;
use App\Models\Notification;
use App\Models\User;

class KanbanMentionService
{
    public static function processText(KanbanCard $card, string $text, User $author): void
    {
        $project = $card->project;
        if (! $project) {
            return;
        }

        $faction = $project->faction;
        if (! $faction) {
            return;
        }

        // 1. Process User Mentions (@username)
        preg_match_all('/@([a-zA-Z0-9_.\-]+)/', $text, $userMatches);
        if (! empty($userMatches[1])) {
            $usernames = array_unique($userMatches[1]);
            $mentionedUsers = $faction->users()
                ->whereIn('username', $usernames)
                ->where('users.id', '!=', $author->id)
                ->get();

            $projectKey = $project->prefix && trim($project->prefix) !== '' ? $project->prefix : $project->id;

            foreach ($mentionedUsers as $mUser) {
                Notification::create([
                    'faction_id' => $faction->id,
                    'user_id' => $mUser->id,
                    'type' => 'kanban_mention',
                    'title' => "Mentioned in card #{$projectKey}-{$card->count}",
                    'message' => "{$author->username} mentioned you in card '{$card->title}'",
                    'link' => "/{$faction->shortname}/kanban/projects/{$projectKey}/cards/{$card->id}",
                    'data' => [
                        'card_id' => $card->id,
                        'project_id' => $project->id,
                        'author_id' => $author->id,
                        'trigger_type' => 'kanban_mention',
                    ],
                ]);
            }
        }

        // 2. Process Card Mentions (#id or #(id) or #count or #(count) or #PREFIX-count or #(PREFIX-count))
        preg_match_all('/#(?:\(?([A-Za-z0-9_#-]+)\)?)/', $text, $cardMatches);
        if (! empty($cardMatches[1])) {
            $rawTokens = array_unique($cardMatches[1]);

            foreach ($rawTokens as $token) {
                $targetCard = null;

                if (str_contains($token, '-')) {
                    // Form: PREFIX-COUNT (e.g. DEV-5)
                    $parts = explode('-', $token, 2);
                    $prefix = $parts[0];
                    $count = (int) $parts[1];

                    $targetProject = $faction->kanbanProjects()->where('prefix', $prefix)->first();
                    if ($targetProject) {
                        $targetCard = KanbanCard::where('project_id', $targetProject->id)
                            ->where('count', $count)
                            ->first();
                    }
                } elseif (is_numeric($token)) {
                    $num = (int) $token;

                    // First try current project by count or ID
                    $targetCard = KanbanCard::where('project_id', $project->id)
                        ->where(function ($q) use ($num) {
                            $q->where('count', $num)->orWhere('id', $num);
                        })
                        ->first();

                    // If not found in current project, search faction-wide cards by ID
                    if (! $targetCard) {
                        $targetCard = KanbanCard::whereHas('project', function ($q) use ($faction) {
                            $q->where('faction_id', $faction->id);
                        })->where('id', $num)->first();
                    }
                }

                if ($targetCard && $targetCard->id !== $card->id) {
                    // Link cards bidirectionally
                    $card->linkedCards()->syncWithoutDetaching([$targetCard->id]);
                    $targetCard->linkedCards()->syncWithoutDetaching([$card->id]);
                }
            }
        }
    }
}

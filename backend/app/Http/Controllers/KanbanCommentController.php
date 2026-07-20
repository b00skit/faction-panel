<?php

namespace App\Http\Controllers;

use App\Events\KanbanBoardUpdated;
use App\Models\KanbanCard;
use App\Models\KanbanComment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class KanbanCommentController extends Controller
{
    private function canComment(KanbanCard $card)
    {
        $user = Auth::user();
        if ($user->is_superadmin) {
            return true;
        }

        $project = $card->project;
        $faction = $project->faction;

        if ($faction->faction_leader === $user->id ||
            User::hasFactionPermission($user, $faction, 'global_kanban_moderation') ||
            $project->created_by === $user->id ||
            $card->created_by === $user->id
        ) {
            return true;
        }

        return User::hasProjectPermission($user, $project, 'view_card_details');
    }

    public function store(Request $request, KanbanCard $card)
    {
        if (!$this->canComment($card)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'comment' => 'required|string',
        ]);

        $comment = $card->comments()->create([
            'user_id' => Auth::id(),
            'comment' => $validated['comment'],
        ]);

        $project = $card->project;
        $this->audit('kanban.comment.create', "Commented on card '{$card->title}' in project '{$project->name}'", null, $project, null, $comment->getAttributes());

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $card->id, 'comment_added');

        return response()->json($comment->load('user'), 201);
    }

    public function destroy(KanbanComment $comment)
    {
        $user = Auth::user();
        $card = $comment->card;
        $project = $card->project;
        $faction = $project->faction;

        $canDelete = $comment->user_id === $user->id ||
            $user->is_superadmin ||
            $faction->faction_leader === $user->id ||
            User::hasFactionPermission($user, $faction, 'global_kanban_moderation') ||
            $project->created_by === $user->id;

        if (!$canDelete) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('kanban.comment.delete', "Deleted comment from card '{$card->title}' in project '{$project->name}'", null, $project, $comment->getAttributes());

        $comment->delete();

        KanbanBoardUpdated::dispatch($project->faction_id, $project->id, $card->id, 'comment_deleted');

        return response()->json(['message' => 'Comment deleted']);
    }
}

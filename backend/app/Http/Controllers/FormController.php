<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\Form;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FormController extends Controller
{
    public function index(string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        $forms = Form::where('faction_id', $faction->id)
            ->with('creator:id,username')
            ->get();

        // Filter by 'view_form' permission
        $user = Auth::user();
        $forms = $forms->filter(function ($form) use ($user) {
            return User::hasFormPermission($user, $form, 'view_form');
        })->values();

        $this->audit('form.index', "Viewed forms list for faction '{$faction->name}'", $faction->id);

        return response()->json($forms);
    }

    public function store(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! User::hasFactionPermission(Auth::user(), $faction, 'create_faction_forms')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|string|in:standard,quiz',
            'description' => 'nullable|string',
            'is_public' => 'boolean',
            'requires_gtaw_login' => 'boolean',
            'cooldown_seconds' => 'integer',
            'cooldown_only_on_fail' => 'boolean',
            'metadata' => 'nullable|array',
        ]);

        $form = $faction->forms()->create([
            ...$validated,
            'is_public' => false, // Force false for now (disabled under refinement)
            'created_by' => Auth::id(),
            'is_enabled' => true,
        ]);

        // Create default status "Submitted"
        $form->statuses()->create([
            'name' => 'Submitted',
            'system_key' => 'submitted',
            'order' => 0,
            'is_hidden' => false,
            'is_locked' => false,
            'is_closed' => false,
            'is_failed' => false,
            'is_passed' => false,
            'is_archived' => false,
        ]);

        // Create default status "Pending"
        $form->statuses()->create([
            'name' => 'Pending',
            'system_key' => 'pending',
            'order' => 1,
            'is_hidden' => false,
            'is_locked' => false,
            'is_closed' => false,
            'is_failed' => false,
            'is_passed' => false,
            'is_archived' => false,
        ]);

        $this->audit('form.create', "Created form '{$form->name}'", null, $form);

        return response()->json($form->load('statuses.stages'), 201);
    }

    public function show(string $shortname, Form $form)
    {
        if (! User::hasFormPermission(Auth::user(), $form, 'view_form')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }   
        
        $this->audit('form.show', "Viewed form '{$form->name}'", null, $form);
        $form->load(['creator:id,username', 'statuses.stages', 'stages.sections.fields']);

        $extendedAccess = (
            User::hasFormPermission(Auth::user(), $form, 'form_editor') ||
            User::hasFormPermission(Auth::user(), $form, 'view_submissions')
        ); 

        // See in detail all sections, including correct answers
        // It could also be used that you can only see fields from your active stage
        if($extendedAccess) {
            $form->stages->each(function ($st) {
                $st->sections->each(function ($sec) {
                    $sec->fields->each(function ($f) {
                        $f->makeVisible("correct_answer");
                    });
                });
            });
        };

        return response()->json($form);
    }

    public function update(Request $request, string $shortname, Form $form)
    {
        if (! User::hasFormPermission(Auth::user(), $form, 'form_editor')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'is_public' => 'sometimes|boolean',
            'requires_gtaw_login' => 'sometimes|boolean',
            'cooldown_seconds' => 'sometimes|integer',
            'cooldown_only_on_fail' => 'sometimes|boolean',
            'max_submissions' => 'sometimes|nullable|integer|min:1',
            'is_enabled' => 'sometimes|boolean',
            'metadata' => 'nullable|array',
            'is_automatic_grading' => 'sometimes|boolean',
        ]);

        if (isset($validated['is_public'])) {
            $validated['is_public'] = false; // Force false for now (disabled under refinement)
        }

        $oldValues = $form->getOriginal();
        $form->update($validated);

        $this->audit('form.update', "Updated form '{$form->name}'", null, $form, $oldValues, $form->getDirty());

        return response()->json($form);
    }

    public function destroy(string $shortname, Form $form)
    {
        if (! User::hasFactionPermission(Auth::user(), $form->faction, 'global_faction_form_moderation') && $form->created_by !== Auth::id()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('form.delete', "Deleted form '{$form->name}'", null, $form, $form->getAttributes());

        $form->delete();

        return response()->json(null, 204);
    }
}

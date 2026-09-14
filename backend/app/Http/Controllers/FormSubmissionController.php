<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\Form;
use App\Models\FormAutomation;
use App\Models\FormResponse;
use App\Models\FormStage;
use App\Models\FormStatus;
use App\Models\FormSubmission;
use App\Models\Group;
use App\Models\User;
use App\Services\GtawService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FormSubmissionController extends Controller
{
    protected $gtawService;

    public function __construct(GtawService $gtawService)
    {
        $this->gtawService = $gtawService;
    }

    public function globalIndex(string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if (! $user->is_superadmin && ! User::hasFactionPermission($user, $faction, 'global_faction_form_moderation')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $submissions = FormSubmission::whereHas('form', function ($query) use ($faction) {
            $query->where('faction_id', $faction->id);
        })
            ->with(['user:id,username', 'currentStatus', 'currentStage:id,name', 'form:id,name'])
            ->orderBy('created_at', 'desc')
            ->get();

        $this->audit('form.submission.global_index', "Viewed all submissions for faction '{$faction->name}'", $faction->id);

        return response()->json($submissions);
    }

    public function mySubmissions(string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $submissions = FormSubmission::where('user_id', $user->id)
            ->whereHas('form', function ($query) use ($faction) {
                $query->where('faction_id', $faction->id);
            })
            ->with(['currentStatus', 'form:id,name'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->groupBy('form_id')
            ->map(fn ($group) => $group->first())
            ->values();

        $this->audit('form.submission.my_submissions', "Viewed my submissions for faction '{$faction->name}'", $faction->id);

        return response()->json($submissions);
    }

    public function index(string $shortname, Form $form)
    {
        // Only return the user's own submissions unless they have moderation perms
        $user = Auth::user();

        if (User::hasFormPermission($user, $form, 'view_submissions')) {
            $submissions = $form->submissions()
                ->with(['user:id,username', 'currentStatus'])
                ->orderBy('created_at', 'desc')
                ->get();
        } elseif ($user) {
            $submissions = $form->submissions()
                ->where('user_id', $user->id)
                ->with(['currentStatus'])
                ->orderBy('created_at', 'desc')
                ->get();
        } else {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $this->audit('form.submission.index', "Viewed submissions for form '{$form->name}'", null, $form);

        return response()->json($submissions);
    }

    public function start(string $shortname, Form $form)
    {
        $user = Auth::user();

        // 1. Permission check
        if (! User::hasFormPermission($user, $form, 'submit_form')) {
            return response()->json(['message' => 'You do not have permission to submit this form.'], 403);
        }

        // 2. GTA:W Login check
        if ($form->requires_gtaw_login) {
            if (! $user || ! $user->gtaw_linked) {
                return response()->json(['message' => 'This form requires you to be logged in with your GTA:W account.'], 401);
            }
        }

        // 3. Check if enabled
        if (! $form->is_enabled) {
            return response()->json(['message' => 'This form is currently disabled.'], 422);
        }

        // 4. Cooldown check (only for logged in users)
        if ($user && $form->cooldown_seconds > 0) {
            $lastSubmission = FormSubmission::where('form_id', $form->id)
                ->where('user_id', $user->id)
                ->whereNotNull('submitted_at')
                ->latest()
                ->first();

            if ($lastSubmission) {
                // If cooldown only on fail, check the status
                $shouldApplyCooldown = true;
                if ($form->cooldown_only_on_fail) {
                    $shouldApplyCooldown = $lastSubmission->currentStatus?->is_failed ?? false;
                }

                if ($shouldApplyCooldown) {
                    $cooldownUntil = Carbon::parse($lastSubmission->submitted_at)->addSeconds($form->cooldown_seconds);
                    if (now()->lessThan($cooldownUntil)) {
                        return response()->json([
                            'message' => 'You are on cooldown.',
                            'cooldown_until' => $cooldownUntil->toDateTimeString(),
                            'remaining_seconds' => now()->diffInSeconds($cooldownUntil),
                        ], 429);
                    }
                }
            }
        }

        // 5. Check for existing unsubmitted record to resume
        if ($user) {
            $existing = FormSubmission::where('form_id', $form->id)
                ->where('user_id', $user->id)
                ->whereNull('submitted_at')
                ->latest()
                ->first();

            if ($existing) {
                return response()->json($existing->load(['form', 'currentStage', 'currentStatus', 'responses']));
            }

            // Check if there is an active/open submission (submitted_at is NOT null but the status is NOT closed)
            $openSubmission = FormSubmission::where('form_id', $form->id)
                ->where('user_id', $user->id)
                ->whereNotNull('submitted_at')
                ->where(function ($query) {
                    $query->whereNull('current_status_id')
                        ->orWhereHas('currentStatus', function ($q) {
                            $q->where('is_closed', false);
                        });
                })
                ->first();

            if ($openSubmission) {
                return response()->json([
                    'message' => 'You already have an active submission for this form that is still under review or open.',
                    'submission_id' => $openSubmission->id,
                ], 422);
            }
        }

        // 6. Max submissions check
        if ($user && $form->max_submissions !== null) {
            $submittedCount = FormSubmission::where('form_id', $form->id)
                ->where('user_id', $user->id)
                ->whereNotNull('submitted_at')
                ->count();

            if ($submittedCount >= $form->max_submissions) {
                return response()->json(['message' => 'You have reached the maximum number of submissions allowed for this form.'], 422);
            }
        }

        // 7. Create submission record
        $pendingStatus = $form->statuses()->where('system_key', 'pending')->first()
            ?? $form->statuses()->where('name', 'Pending')->first()
            ?? $form->statuses()->first();
        $firstStage = $form->stages()->first();

        $submission = $form->submissions()->create([
            'user_id' => $user?->id,
            'current_stage_id' => $firstStage?->id,
            'current_status_id' => $pendingStatus?->id,
            'started_at' => now(),
            'metadata' => [
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ],
        ]);

        // 7. Pre-fill GTA:W data if required
        if ($form->requires_gtaw_login && $user?->gtaw_linked) {
            $factions = $this->gtawService->getFactions($user->gtaw_access_token);
            if ($factions) {
                $matchedFaction = null;
                $matchedCharId = null;

                foreach ($factions as $charId => $factionData) {
                    if ($factionData['faction'] == $form->faction->gtaw_faction_id) {
                        $matchedFaction = $factionData;
                        $matchedCharId = $charId;
                        break;
                    }
                }

                if ($matchedFaction) {
                    $fields = $form->stages()->with('sections.fields')->get()->pluck('sections')->flatten()->pluck('fields')->flatten();

                    foreach ($fields as $field) {
                        if ($field->prefill_type) {
                            $value = null;
                            switch ($field->prefill_type) {
                                case 'character_id':
                                    $value = $matchedCharId;
                                    break;
                                case 'faction_name':
                                    $value = $matchedFaction['faction_name'];
                                    break;
                                case 'faction_rank':
                                    $value = $matchedFaction['faction_rank'];
                                    break;
                                case 'faction_rank_name':
                                    $value = $matchedFaction['faction_rank_name'];
                                    break;
                                case 'faction':
                                    $value = $matchedFaction['faction'];
                                    break;
                                case 'character_name':
                                    // Try to fetch more details if we need character name
                                    $charDetails = $this->gtawService->getCharacterDetails($user->gtaw_access_token, $matchedFaction['faction'], $matchedCharId);
                                    if ($charDetails && isset($charDetails['character_name'])) {
                                        $value = $charDetails['character_name'];
                                    }
                                    break;
                            }

                            if ($value !== null) {
                                FormResponse::updateOrCreate(
                                    [
                                        'form_submission_id' => $submission->id,
                                        'form_field_id' => $field->id,
                                    ],
                                    [
                                        'value' => $value,
                                    ]
                                );
                            }
                        }
                    }
                }
            }
        }

        $this->audit('form.submission.start', "Started submission for form '{$form->name}'", null, $submission);

        return response()->json($submission->load(['form', 'currentStage', 'currentStatus', 'responses']));
    }

    public function submit(Request $request, string $shortname, Form $form, FormSubmission $submission)
    {
        // 1. Ownership/Permission Check
        $user = Auth::user();
        if ($submission->user_id !== ($user?->id)) {
            if (! User::hasFormPermission($user, $submission->form, 'modify_submissions')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        if ($submission->submitted_at) {
            return response()->json(['message' => 'This form has already been submitted.'], 422);
        }

        $oldValues = $submission->getOriginal();

        // 2. Validation - Only validate fields for the CURRENT stage
        $form = $submission->form;
        $currentStage = $submission->currentStage;

        if (! $currentStage) {
            return response()->json(['message' => 'No active stage found for this submission.'], 422);
        }

        $fields = $currentStage->sections()->with('fields')->get()->pluck('fields')->flatten()->filter();

        // Security check: overwrite/populate disabled fields with their prefilled/default values
        $responses = $request->input('responses', []);
        if (! is_array($responses)) {
            $responses = [];
        }
        foreach ($fields as $field) {
            if ($field->is_disabled) {
                $existingResponse = FormResponse::where('form_submission_id', $submission->id)
                    ->where('form_field_id', $field->id)
                    ->first();
                if ($existingResponse) {
                    $val = $existingResponse->value;
                    $decoded = json_decode($val, true);
                    $responses[$field->id] = (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) ? $decoded : $val;
                } else {
                    $responses[$field->id] = $field->default_value;
                }
            }
        }
        $request->merge(['responses' => $responses]);

        $rules = [];
        foreach ($fields as $field) {
            if ($field->type === 'html') {
                continue;
            }
            $fieldRules = [];
            if ($field->is_required) {
                $fieldRules[] = 'required';
            } else {
                $fieldRules[] = 'nullable';
            }

            // Add custom validation rules if any
            if ($field->validation_rules && is_array($field->validation_rules)) {
                $fieldRules = array_merge($fieldRules, $field->validation_rules);
            }

            $rules["responses.{$field->id}"] = $fieldRules;
        }

        $validated = $request->validate($rules);

        // 3. Save Responses & Auto-Grade
        foreach ($validated['responses'] as $fieldId => $value) {
            $field = $fields->firstWhere('id', $fieldId);
            if (! $field) {
                continue;
            } // Should not happen with validation

            $pointsAwarded = 0;
            $isGraded = false;
            $correctness = null;

            if ($form->type === 'quiz' && $field->has_grading && $field->is_automatic_scored) {
                $isGraded = true;

                $normalizedValue = $value;
                if (is_bool($value)) {
                    $normalizedValue = $value ? 'true' : 'false';
                } elseif (is_array($value)) {
                    $normalizedValue = json_encode($value);
                } else {
                    $normalizedValue = strtolower(trim((string) $value));
                }

                $normalizedCorrect = strtolower(trim((string) $field->correct_answer));

                if ($normalizedValue === $normalizedCorrect) {
                    $pointsAwarded = $field->points;
                    $correctness = 'correct';
                } else {
                    $pointsAwarded = 0;
                    $correctness = 'incorrect';
                }
            }

            FormResponse::updateOrCreate(
                [
                    'form_submission_id' => $submission->id,
                    'form_field_id' => $fieldId,
                ],
                [
                    'value' => is_array($value) ? json_encode($value) : $value,
                    'is_graded' => $isGraded,
                    'points_awarded' => $pointsAwarded,
                    'correctness' => $correctness,
                ]
            );
        }

        // 4. Finalize Submission
        // Always reset to the default "Submitted" status on each stage submission
        $defaultStatus = $form->statuses()->where('system_key', 'submitted')->first()
            ?? $form->statuses()->where('name', 'Submitted')->first()
            ?? $form->statuses()->first();
        $updateData = [
            'submitted_at' => now(),
            'current_status_id' => $defaultStatus?->id,
        ];

        // Stage-specific submit status overrides the default
        if ($currentStage->submit_status_id) {
            $updateData['current_status_id'] = $currentStage->submit_status_id;
        }

        $submission->update($updateData);

        $submissionFresh = $submission->fresh();

        // Run On Stage Submit automations
        $this->runAutomations($submissionFresh, 'on_stage_submit', null, $currentStage->id);

        // Run On Final Submit automations if there is no next stage
        $nextStage = FormStage::where('form_id', $form->id)
            ->where('order', '>', $currentStage->order)
            ->orderBy('order')
            ->first();
        if (! $nextStage) {
            $this->runAutomations($submissionFresh, 'on_final_submit');
        }

        $this->audit('form.submission.submit', "Submitted stage '".($currentStage->name ?? '')."' for form '{$form->name}'", null, $submission, $oldValues, $submission->getDirty());

        return response()->json(['message' => 'Form submitted successfully!', 'submission' => $submissionFresh->load('currentStatus')]);
    }

    public function show(string $shortname, FormSubmission $submission)
    {
        $user = Auth::user();

        // Permission check
        if ($submission->user_id !== ($user?->id)) {
            if (! User::hasFormPermission($user, $submission->form, 'view_submissions')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $submission->load([
            'form.stages.sections.fields',
            'form.statuses.stages',
            'currentStatus',
            'currentStage',
            'responses.field',
            'user:id,username',
            'comments.user:id,username',
            'comments.section',
        ]);

        // Filter internal comments if the user doesn't have moderation permission
        if (! User::hasFormPermission($user, $submission->form, 'modify_submission_status')) {
            $submission->setRelation('comments', $submission->comments->where('is_internal', false));
        }

        $this->audit('form.submission.show', "Viewed submission #{$submission->id} for form '{$submission->form->name}'", null, $submission);

        return response()->json($submission);
    }

    public function updateStatus(Request $request, string $shortname, FormSubmission $submission)
    {
        $user = Auth::user();
        $form = $submission->form;

        if (! User::hasFormPermission($user, $form, 'modify_submission_status')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'status_id' => 'required|exists:form_statuses,id',
            'stage_id' => 'nullable|exists:form_stages,id',
        ]);

        // Ensure status belongs to the form
        $status = FormStatus::where('id', $validated['status_id'])->where('form_id', $form->id)->firstOrFail();

        if ($status->system_key === 'pending') {
            return response()->json(['message' => 'The Pending status cannot be applied manually.'], 422);
        }

        $updateData = [
            'current_status_id' => $status->id,
        ];

        // 1. Handle Stage-Specific Logic (Auto-advancement removed in favor of manual Continue to Next Stage button)

        // 2. Manual Stage Override
        if (isset($validated['stage_id'])) {
            $stage = FormStage::where('id', $validated['stage_id'])->where('form_id', $form->id)->firstOrFail();

            // If we are moving to a new stage manually, clear submitted_at so user can resume
            if ($submission->current_stage_id != $stage->id) {
                $updateData['submitted_at'] = null;
            }

            $updateData['current_stage_id'] = $stage->id;
        }

        $oldValues = $submission->getOriginal();
        $submission->update($updateData);

        $this->runAutomations($submission->fresh(), 'on_status_change', $status->id);

        $this->audit('form.submission.update_status', "Updated status of submission #{$submission->id} to '{$status->name}' for form '{$form->name}'", null, $submission, $oldValues, $submission->getDirty());

        return response()->json(['message' => 'Status updated successfully', 'submission' => $submission->fresh()->load('currentStatus', 'currentStage')]);
    }

    public function advance(Request $request, string $shortname, FormSubmission $submission)
    {
        $user = Auth::user();
        $form = $submission->form;

        if (! User::hasFormPermission($user, $form, 'modify_submission_status')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Ensure current status is passed and not closed
        if (! $submission->currentStatus || ! $submission->currentStatus->is_passed) {
            return response()->json(['message' => 'Submission status is not Passed.'], 422);
        }

        if ($submission->currentStatus->is_closed) {
            return response()->json(['message' => 'Submission is already closed.'], 422);
        }

        // Find next stage
        $nextStage = FormStage::where('form_id', $form->id)
            ->where('order', '>', $submission->currentStage->order)
            ->orderBy('order')
            ->first();

        if (! $nextStage) {
            return response()->json(['message' => 'No next stage exists for this application.'], 422);
        }

        // Find pending status
        $pendingStatus = $form->statuses()->where('system_key', 'pending')->first()
            ?? $form->statuses()->where('name', 'Pending')->first()
            ?? $form->statuses()->first();

        $oldValues = $submission->getOriginal();
        $submission->update([
            'current_stage_id' => $nextStage->id,
            'submitted_at' => null,
            'current_status_id' => $pendingStatus?->id,
        ]);

        if ($pendingStatus) {
            $this->runAutomations($submission->fresh(), 'on_status_change', $pendingStatus->id);
        }

        $this->audit('form.submission.advance', "Advanced submission #{$submission->id} to stage '{$nextStage->name}' for form '{$form->name}'", null, $submission, $oldValues, $submission->getDirty());

        return response()->json([
            'message' => 'Advanced to next stage successfully',
            'submission' => $submission->fresh()->load('currentStatus', 'currentStage', 'form.stages'),
        ]);
    }

    public function conclude(Request $request, string $shortname, FormSubmission $submission)
    {
        $user = Auth::user();
        $form = $submission->form;

        if (! User::hasFormPermission($user, $form, 'modify_submission_status')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Find the first status belonging to the form where is_closed is true
        $closedStatus = $form->statuses()->where('is_closed', true)->first();

        if (! $closedStatus) {
            return response()->json(['message' => 'No closed status is defined for this form.'], 422);
        }

        $oldValues = $submission->getOriginal();
        $submission->update([
            'current_status_id' => $closedStatus->id,
        ]);

        $this->runAutomations($submission->fresh(), 'on_status_change', $closedStatus->id);

        $this->audit('form.submission.conclude', "Concluded submission #{$submission->id} with status '{$closedStatus->name}' for form '{$form->name}'", null, $submission, $oldValues, $submission->getDirty());

        return response()->json([
            'message' => 'Application concluded successfully',
            'submission' => $submission->fresh()->load('currentStatus', 'currentStage'),
        ]);
    }

    public function retake(Request $request, string $shortname, FormSubmission $submission)
    {
        $user = Auth::user();
        $form = $submission->form;

        // Check if reviewer or submission owner
        $isReviewer = User::hasFormPermission($user, $form, 'modify_submission_status');
        $isOwner = $submission->user_id === $user->id;

        if (! $isReviewer && ! $isOwner) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Ensure current status is failed and not closed
        if (! $submission->currentStatus || ! $submission->currentStatus->is_failed) {
            return response()->json(['message' => 'Submission status is not Failed.'], 422);
        }

        if ($submission->currentStatus->is_closed) {
            return response()->json(['message' => 'Submission is closed and cannot be retaken.'], 422);
        }

        // Find pending status
        $pendingStatus = $form->statuses()->where('system_key', 'pending')->first()
            ?? $form->statuses()->where('name', 'Pending')->first()
            ?? $form->statuses()->first();

        $oldValues = $submission->getOriginal();
        $submission->update([
            'submitted_at' => null,
            'current_status_id' => $pendingStatus?->id,
        ]);

        if ($pendingStatus) {
            $this->runAutomations($submission->fresh(), 'on_status_change', $pendingStatus->id);
        }

        $this->audit('form.submission.retake', "Initiated retake of stage for submission #{$submission->id} for form '{$form->name}'", null, $submission, $oldValues, $submission->getDirty());

        return response()->json([
            'message' => 'Stage retake initiated successfully',
            'submission' => $submission->fresh()->load('currentStatus', 'currentStage'),
        ]);
    }

    public function addComment(Request $request, string $shortname, FormSubmission $submission)
    {
        $user = Auth::user();
        $form = $submission->form;

        $isReviewer = User::hasFormPermission($user, $form, 'modify_submission_status');

        if (! $isReviewer) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'comment' => 'required|string',
            'is_internal' => 'boolean',
            'form_section_id' => 'nullable|exists:form_sections,id',
        ]);

        $isInternal = $validated['is_internal'] ?? false;
        if (! $isInternal && empty($validated['form_section_id'])) {
            return response()->json(['message' => 'Public reviewer-to-user comments must be bound to a section.'], 422);
        }

        $comment = $submission->comments()->create([
            'user_id' => $user->id,
            'comment' => $validated['comment'],
            'is_internal' => $isInternal,
            'form_section_id' => $isInternal ? null : $validated['form_section_id'],
        ]);

        $this->audit('form.submission.comment', 'Added '.($isInternal ? 'internal' : 'public')." comment on submission #{$submission->id} for form '{$form->name}'", null, $comment);

        return response()->json($comment->load('user:id,username', 'section'));
    }

    public function gradeResponses(Request $request, string $shortname, FormSubmission $submission)
    {
        $user = Auth::user();
        $form = $submission->form;

        if (! User::hasFormPermission($user, $form, 'modify_submission_status')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'grades' => 'required|array',
            'grades.*.response_id' => 'required|exists:form_responses,id',
            'grades.*.points' => 'nullable|integer|min:0',
            'grades.*.correctness' => 'nullable|string|in:correct,partially_correct,incorrect',
            'grades.*.comment' => 'nullable|string',
        ]);

        foreach ($validated['grades'] as $grade) {
            $response = FormResponse::where('id', $grade['response_id'])
                ->where('form_submission_id', $submission->id)
                ->firstOrFail();

            if (! $response->field || ! $response->field->has_grading) {
                continue;
            }

            $points = $grade['points'] ?? ($response->points_awarded ?? 0);
            $correctness = $grade['correctness'] ?? null;

            if ($form->type === 'quiz') {
                if ($correctness === 'correct') {
                    $points = $response->field->points;
                } elseif ($correctness === 'incorrect') {
                    $points = 0;
                } else {
                    $points = $grade['points'] ?? ($response->points_awarded ?? 0);
                }
            }

            $response->update([
                'points_awarded' => $points,
                'correctness' => $correctness,
                'reviewer_comment' => $grade['comment'] ?? null,
                'is_graded' => true,
            ]);
        }

        $this->audit('form.submission.grade', "Graded responses for submission #{$submission->id} of form '{$form->name}'", null, $submission);

        return response()->json(['message' => 'Responses graded successfully']);
    }

    private function runAutomations(FormSubmission $submission, string $trigger, ?int $triggeredStatusId = null, ?int $triggeredStageId = null): void
    {
        $form = $submission->form;

        $query = $form->automations()->where('is_enabled', true)->where('trigger', $trigger);

        if ($trigger === 'on_status_change' && $triggeredStatusId) {
            $query->where('trigger_status_id', $triggeredStatusId);
        }

        if ($trigger === 'on_stage_submit') {
            $query->where(function ($q) use ($triggeredStageId) {
                $q->whereNull('trigger_stage_id')
                    ->orWhere('trigger_stage_id', $triggeredStageId);
            });
        }

        foreach ($query->get() as $automation) {
            if ($this->evaluateConditions($automation, $submission)) {
                $this->executeAutomationAction($automation, $submission);
            }
        }
    }

    private function evaluateConditions(FormAutomation $automation, FormSubmission $submission): bool
    {
        $conditions = $automation->conditions ?? [];

        if (empty($conditions)) {
            return true;
        }

        $responses = $submission->responses()->get()->keyBy('form_field_id');
        $results = [];

        foreach ($conditions as $condition) {
            $type = $condition['type'] ?? 'field';

            if ($type === 'field') {
                $response = $responses->get($condition['field_id'] ?? null);
                $fieldValue = $response?->value ?? '';
                $results[] = $this->evaluateCondition($condition['operator'], $fieldValue, $condition['value'] ?? '');
            } elseif ($type === 'field_points') {
                $response = $responses->get($condition['field_id'] ?? null);
                $fieldPoints = $response?->points_awarded ?? 0;
                $results[] = $this->evaluateCondition($condition['operator'], $fieldPoints, $condition['value'] ?? '0');
            } elseif ($type === 'field_correctness') {
                $response = $responses->get($condition['field_id'] ?? null);
                $fieldCorrectness = $response?->correctness ?? '';
                $results[] = $this->evaluateCondition($condition['operator'], $fieldCorrectness, $condition['value'] ?? '');
            } elseif ($type === 'points') {
                $totalPoints = $submission->responses()->sum('points_awarded');
                $results[] = $this->evaluateCondition($condition['operator'], $totalPoints, $condition['value'] ?? '0');
            } elseif ($type === 'status') {
                $statusId = $submission->current_status_id;
                $results[] = $this->evaluateCondition($condition['operator'], $statusId, $condition['value'] ?? '');
            } else {
                $results[] = false;
            }
        }

        return $automation->condition_logic === 'any'
            ? in_array(true, $results, true)
            : ! in_array(false, $results, true);
    }

    private function evaluateCondition(string $operator, mixed $fieldValue, string $conditionValue): bool
    {
        $fv = strtolower(trim((string) $fieldValue));
        $cv = strtolower(trim($conditionValue));

        return match ($operator) {
            'equals' => $fv === $cv,
            'not_equals' => $fv !== $cv,
            'contains' => str_contains($fv, $cv),
            'gt' => is_numeric($fv) && is_numeric($cv) && (float) $fv > (float) $cv,
            'lt' => is_numeric($fv) && is_numeric($cv) && (float) $fv < (float) $cv,
            'gte' => is_numeric($fv) && is_numeric($cv) && (float) $fv >= (float) $cv,
            'lte' => is_numeric($fv) && is_numeric($cv) && (float) $fv <= (float) $cv,
            'is_empty' => $fv === '',
            'is_not_empty' => $fv !== '',
            default => false,
        };
    }

    private function executeAutomationAction(FormAutomation $automation, FormSubmission $submission): void
    {
        if ($automation->action === 'set_status' && $automation->action_status_id) {
            $submission->update(['current_status_id' => $automation->action_status_id]);
        }

        if ($automation->action === 'add_comment' && $automation->action_comment) {
            $submission->comments()->create([
                'user_id' => null,
                'comment' => $automation->action_comment,
                'is_internal' => $automation->action_comment_internal,
            ]);
        }

        if ($automation->action === 'give_group' && $automation->action_group_id && $submission->user_id) {
            $group = Group::where('id', $automation->action_group_id)
                ->where('faction_id', $submission->form->faction_id)
                ->first();
            if ($group) {
                if (! $group->members()->where('user_id', $submission->user_id)->exists()) {
                    $group->members()->attach($submission->user_id, ['is_leader' => false]);
                }
            }
        }

        if ($automation->action === 'continue_to_next_stage' && $submission->current_stage_id) {
            $currentStage = $submission->currentStage
                ?? FormStage::where('id', $submission->current_stage_id)->first();
            if ($currentStage) {
                $nextStage = FormStage::where('form_id', $submission->form_id)
                    ->where('order', '>', $currentStage->order)
                    ->orderBy('order')
                    ->first();

                if ($nextStage) {
                    $pendingStatus = $submission->form->statuses()
                        ->where('system_key', 'pending')->first()
                        ?? $submission->form->statuses()->where('name', 'Pending')->first()
                        ?? $submission->form->statuses()->first();

                    $submission->update([
                        'current_stage_id' => $nextStage->id,
                        'submitted_at' => null,
                        'current_status_id' => $pendingStatus?->id,
                    ]);

                    if ($pendingStatus) {
                        $this->runAutomations($submission->fresh(), 'on_status_change', $pendingStatus->id);
                    }
                }
            }
        }
    }
}

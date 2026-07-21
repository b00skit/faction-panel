<?php

use App\Models\Faction;
use App\Models\Form;
use App\Models\FormAutomation;
use App\Models\FormField;
use App\Models\FormPermission;
use App\Models\FormSection;
use App\Models\FormStage;
use App\Models\FormStatus;
use App\Models\FormSubmission;
use App\Models\User;
use App\Models\Role;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->user = User::factory()->create(['is_superadmin' => true]);
    $this->faction = Faction::factory()->create();
    $this->user->factions()->attach($this->faction->id);
});

test('can create a form', function () {
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms", [
            'name' => 'Recruitment Form',
            'type' => 'standard',
            'description' => 'Test Description',
            'is_public' => true,
            'requires_gtaw_login' => false,
            'cooldown_seconds' => 3600,
        ])
        ->assertStatus(201)
        ->assertJsonPath('name', 'Recruitment Form');

    $this->assertDatabaseHas('forms', ['name' => 'Recruitment Form']);
});

test('can add stages, sections and fields', function () {
    $form = Form::factory()->create(['faction_id' => $this->faction->id]);

    // Add stage
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/stages", [
            'name' => 'Stage 1',
        ])
        ->assertStatus(201);

    $stage = FormStage::where('form_id', $form->id)->first();

    // Add section
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/stages/{$stage->id}/sections", [
            'name' => 'Personal Info',
            'description' => 'Section 1 description',
        ])
        ->assertStatus(201);

    $section = FormSection::where('form_stage_id', $stage->id)->first();

    // Add field
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/sections/{$section->id}/fields", [
            'type' => 'text',
            'label' => 'Full Name',
            'name' => 'full_name',
            'is_required' => true,
            'points' => 0,
            'is_automatic_scored' => true,
            'correct_answer' => 'John Doe',
        ])
        ->assertStatus(201);

    $this->assertDatabaseHas('form_fields', [
        'label' => 'Full Name',
        'form_section_id' => $section->id,
        'is_automatic_scored' => true,
        'correct_answer' => 'John Doe',
    ]);

    $field = FormField::where('name', 'full_name')->first();

    // Update field correct answer
    $this->actingAs($this->user)
        ->putJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/fields/{$field->id}", [
            'correct_answer' => 'Jane Doe',
        ])
        ->assertStatus(200);

    $this->assertDatabaseHas('form_fields', [
        'id' => $field->id,
        'correct_answer' => 'Jane Doe',
    ]);
});

test('can start and submit a form', function () {
    $form = Form::factory()->create(['faction_id' => $this->faction->id, 'is_enabled' => true]);
    $stage = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);
    $section = FormSection::create(['form_stage_id' => $stage->id, 'name' => 'Info', 'order' => 0]);
    $field = FormField::create([
        'form_section_id' => $section->id,
        'type' => 'text',
        'label' => 'Test Field',
        'name' => 'test_field',
        'order' => 0,
    ]);
    FormStatus::create(['form_id' => $form->id, 'name' => 'Submitted', 'order' => 0]);

    // Start submission
    $res = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start")
        ->assertStatus(200);

    $submissionId = $res->json('id');

    // Submit form
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/{$submissionId}/submit", [
            'responses' => [
                $field->id => 'Test Response',
            ],
        ])
        ->assertStatus(200);

    $this->assertDatabaseHas('form_responses', [
        'form_submission_id' => $submissionId,
        'form_field_id' => $field->id,
        'value' => 'Test Response',
    ]);

    $submission = FormSubmission::find($submissionId);
    $this->assertNotNull($submission->submitted_at);
});

test('enforces gtaw login if required', function () {
    $form = Form::factory()->create([
        'faction_id' => $this->faction->id,
        'is_enabled' => true,
        'requires_gtaw_login' => true,
    ]);

    // User not linked
    $this->user->update(['gtaw_access_token' => null]);

    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start")
        ->assertStatus(401);

    // User linked
    $this->user->update(['gtaw_access_token' => 'fake_token']);
    $this->user->refresh();

    // Fake GTA:W API response
    Http::fake([
        '*api/factions' => Http::response([], 200),
    ]);

    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start")
        ->assertStatus(200);
});

test('auto-grades quiz forms', function () {
    $form = Form::factory()->create([
        'faction_id' => $this->faction->id,
        'type' => 'quiz',
        'is_enabled' => true,
    ]);
    $stage = FormStage::create(['form_id' => $form->id, 'name' => 'Quiz Stage', 'order' => 0]);
    $section = FormSection::create(['form_stage_id' => $stage->id, 'name' => 'Questions', 'order' => 0]);

    $field = FormField::create([
        'form_section_id' => $section->id,
        'type' => 'text',
        'label' => 'Question 1',
        'name' => 'q1',
        'points' => 10,
        'is_automatic_scored' => true,
        'correct_answer' => 'Correct',
        'order' => 0,
        'has_grading' => true,
    ]);

    $passedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Passed', 'is_passed' => true, 'is_closed' => true, 'order' => 1]);
    $failedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Failed', 'is_failed' => true, 'is_closed' => true, 'order' => 2]);
    FormStatus::create(['form_id' => $form->id, 'name' => 'Submitted', 'order' => 0]);

    // Create point-based automations
    FormAutomation::create([
        'form_id' => $form->id,
        'name' => 'Auto Pass',
        'trigger' => 'on_final_submit',
        'condition_logic' => 'all',
        'conditions' => [
            [
                'type' => 'points',
                'operator' => 'gte',
                'value' => '10',
            ],
        ],
        'action' => 'set_status',
        'action_status_id' => $passedStatus->id,
        'is_enabled' => true,
        'order' => 0,
    ]);

    FormAutomation::create([
        'form_id' => $form->id,
        'name' => 'Auto Fail',
        'trigger' => 'on_final_submit',
        'condition_logic' => 'all',
        'conditions' => [
            [
                'type' => 'points',
                'operator' => 'lt',
                'value' => '10',
            ],
        ],
        'action' => 'set_status',
        'action_status_id' => $failedStatus->id,
        'is_enabled' => true,
        'order' => 1,
    ]);

    // 1. Correct answer (score is 10, so passes)
    $res = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start");
    $submissionId = $res->json('id');

    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/{$submissionId}/submit", [
            'responses' => [$field->id => 'Correct'],
        ]);

    $submission = FormSubmission::find($submissionId);
    expect($submission->current_status_id)->toBe($passedStatus->id);

    // 2. Wrong answer (score is 0, so fails)
    $res = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start");
    $submissionId = $res->json('id');

    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/{$submissionId}/submit", [
            'responses' => [$field->id => 'Wrong'],
        ]);

    $submission = FormSubmission::find($submissionId);
    expect($submission->current_status_id)->toBe($failedStatus->id);
});

test('multi-stage pass and active submission blocking constraints', function () {
    $form = Form::factory()->create(['faction_id' => $this->faction->id, 'is_enabled' => true]);
    $stage1 = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);
    $stage2 = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 2', 'order' => 1]);

    $section1 = FormSection::create(['form_stage_id' => $stage1->id, 'name' => 'Section 1', 'order' => 0]);
    $field1 = FormField::create([
        'form_section_id' => $section1->id,
        'type' => 'text',
        'label' => 'Field 1',
        'name' => 'field_1',
        'order' => 0,
        'points' => 0,
    ]);

    $section2 = FormSection::create(['form_stage_id' => $stage2->id, 'name' => 'Section 2', 'order' => 0]);
    $field2 = FormField::create([
        'form_section_id' => $section2->id,
        'type' => 'text',
        'label' => 'Field 2',
        'name' => 'field_2',
        'order' => 0,
        'points' => 0,
    ]);

    $submittedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Submitted', 'system_key' => 'submitted', 'is_closed' => false, 'order' => 0]);
    $pendingStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Pending', 'system_key' => 'pending', 'is_closed' => false, 'order' => 1]);
    $passedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Passed', 'is_passed' => true, 'is_closed' => false, 'order' => 2]);
    $closedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Closed Approved', 'is_closed' => true, 'order' => 3]);

    // Test: Start submission
    $res = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start")
        ->assertStatus(200);
    $submissionId = $res->json('id');

    // Test: Block duplicate active submission starting
    // Since the first submission is not yet submitted (submitted_at is null), it will resume the existing one.
    $resResume = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start")
        ->assertStatus(200);
    expect($resResume->json('id'))->toBe($submissionId);

    // Submit Stage 1
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/{$submissionId}/submit", [
            'responses' => [
                $field1->id => 'Response 1',
            ],
        ])
        ->assertStatus(200);

    // Verify submission is now submitted (submitted_at is not null, status is Submitted)
    $submission = FormSubmission::find($submissionId);
    expect($submission->submitted_at)->not->toBeNull();
    expect($submission->current_stage_id)->toBe($stage1->id);
    expect($submission->current_status_id)->toBe($submittedStatus->id);

    // Test: Block new submission because the current one is submitted but NOT closed
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start")
        ->assertStatus(422)
        ->assertJsonPath('message', 'You already have an active submission for this form that is still under review or open.');

    // Reviewer marks Stage 1 as "Passed"
    $this->actingAs($this->user)
        ->putJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submissionId}/status", [
            'status_id' => $passedStatus->id,
        ])
        ->assertStatus(200);

    // Assert that the submission stays in Stage 1 and stays submitted (auto-advance removed)
    $submission->refresh();
    expect($submission->current_stage_id)->toBe($stage1->id);
    expect($submission->submitted_at)->not->toBeNull();
    expect($submission->current_status_id)->toBe($passedStatus->id);

    // Advance manually to the next stage
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submissionId}/advance")
        ->assertStatus(200);

    // Assert that the submission transitioned to Stage 2 and is re-opened (submitted_at = null, status is Pending)
    $submission->refresh();
    expect($submission->current_stage_id)->toBe($stage2->id);
    expect($submission->submitted_at)->toBeNull();
    expect($submission->current_status_id)->toBe($pendingStatus->id);

    // Resume submission for Stage 2
    $resResumeStage2 = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start")
        ->assertStatus(200);
    expect($resResumeStage2->json('id'))->toBe($submissionId);
    expect($resResumeStage2->json('current_stage_id'))->toBe($stage2->id);

    // Submit Stage 2
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/{$submissionId}/submit", [
            'responses' => [
                $field2->id => 'Response 2',
            ],
        ])
        ->assertStatus(200);

    // Verify submitted for Stage 2 (submitted_at is not null)
    $submission->refresh();
    expect($submission->submitted_at)->not->toBeNull();
    expect($submission->current_stage_id)->toBe($stage2->id);

    // Reviewer marks Stage 2 (final stage) as "Passed"
    $this->actingAs($this->user)
        ->putJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submissionId}/status", [
            'status_id' => $passedStatus->id,
        ])
        ->assertStatus(200);

    // Assert that the submission stays in Stage 2, stays submitted, and gets Passed status
    $submission->refresh();
    expect($submission->current_stage_id)->toBe($stage2->id);
    expect($submission->submitted_at)->not->toBeNull();
    expect($submission->current_status_id)->toBe($passedStatus->id);

    // Test: Still blocked from starting a new submission because "Passed" has is_closed = false
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start")
        ->assertStatus(422);

    // Reviewer marks submission as "Closed Approved" (is_closed = true)
    $this->actingAs($this->user)
        ->putJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submissionId}/status", [
            'status_id' => $closedStatus->id,
        ])
        ->assertStatus(200);

    // Test: Now the user CAN start a new submission
    $resNew = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/submissions/start")
        ->assertStatus(200);
    expect($resNew->json('id'))->not->toBe($submissionId);
});

test('manual stage advancement constraints', function () {
    $form = Form::factory()->create(['faction_id' => $this->faction->id, 'is_enabled' => true]);
    $stage1 = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);
    $stage2 = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 2', 'order' => 1]);

    $submittedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Submitted', 'system_key' => 'submitted', 'is_closed' => false, 'order' => 0]);
    $pendingStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Pending', 'system_key' => 'pending', 'is_closed' => false, 'order' => 1]);
    $passedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Passed', 'is_passed' => true, 'is_closed' => false, 'order' => 2]);
    $closedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Closed', 'is_closed' => true, 'is_passed' => true, 'order' => 3]);

    $submission = FormSubmission::create([
        'form_id' => $form->id,
        'user_id' => $this->user->id,
        'current_stage_id' => $stage1->id,
        'current_status_id' => $submittedStatus->id,
        'submitted_at' => now(),
    ]);

    // Should fail to advance when status is not Passed
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/advance")
        ->assertStatus(422)
        ->assertJsonPath('message', 'Submission status is not Passed.');

    // Update status to Passed
    $submission->update(['current_status_id' => $passedStatus->id]);

    // Advance successfully
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/advance")
        ->assertStatus(200);

    $submission->refresh();
    expect($submission->current_stage_id)->toBe($stage2->id);
    expect($submission->submitted_at)->toBeNull();
    expect($submission->current_status_id)->toBe($pendingStatus->id);

    // Try to advance when no next stage exists
    $submission->update(['current_status_id' => $passedStatus->id, 'submitted_at' => now()]);
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/advance")
        ->assertStatus(422)
        ->assertJsonPath('message', 'No next stage exists for this application.');

    // Try to advance when status is closed
    $submission->update(['current_stage_id' => $stage1->id, 'current_status_id' => $closedStatus->id, 'submitted_at' => now()]);
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/advance")
        ->assertStatus(422)
        ->assertJsonPath('message', 'Submission is already closed.');
});

test('concluding a submission', function () {
    $form = Form::factory()->create(['faction_id' => $this->faction->id, 'is_enabled' => true]);
    $stage1 = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);

    $submittedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Submitted', 'system_key' => 'submitted', 'is_closed' => false, 'order' => 0]);
    $closedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Closed Approved', 'is_closed' => true, 'order' => 1]);

    $submission = FormSubmission::create([
        'form_id' => $form->id,
        'user_id' => $this->user->id,
        'current_stage_id' => $stage1->id,
        'current_status_id' => $submittedStatus->id,
        'submitted_at' => now(),
    ]);

    // Conclude the application
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/conclude")
        ->assertStatus(200);

    $submission->refresh();
    expect($submission->current_status_id)->toBe($closedStatus->id);

    // If no closed status is defined, expect error
    $closedStatus->delete();
    $submission->update(['current_status_id' => $submittedStatus->id]);

    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/conclude")
        ->assertStatus(422)
        ->assertJsonPath('message', 'No closed status is defined for this form.');
});

test('retaking a stage', function () {
    $form = Form::factory()->create(['faction_id' => $this->faction->id, 'is_enabled' => true]);
    $stage1 = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);

    $pendingStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Pending', 'system_key' => 'pending', 'is_closed' => false, 'order' => 0]);
    $failedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Failed', 'is_failed' => true, 'is_closed' => false, 'order' => 1]);
    $closedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Closed', 'is_closed' => true, 'is_failed' => true, 'order' => 2]);

    $submission = FormSubmission::create([
        'form_id' => $form->id,
        'user_id' => $this->user->id,
        'current_stage_id' => $stage1->id,
        'current_status_id' => $failedStatus->id,
        'submitted_at' => now(),
    ]);

    // User can retake stage
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/retake")
        ->assertStatus(200);

    $submission->refresh();
    expect($submission->submitted_at)->toBeNull();
    expect($submission->current_status_id)->toBe($pendingStatus->id);

    // Fail if status is not failed
    $submission->update(['current_status_id' => $pendingStatus->id, 'submitted_at' => now()]);
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/retake")
        ->assertStatus(422)
        ->assertJsonPath('message', 'Submission status is not Failed.');

    // Fail if status is closed
    $submission->update(['current_status_id' => $closedStatus->id, 'submitted_at' => now()]);
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/retake")
        ->assertStatus(422)
        ->assertJsonPath('message', 'Submission is closed and cannot be retaken.');
});

test('system status constraints validation rules', function () {
    $form = Form::factory()->create(['faction_id' => $this->faction->id]);
    $stage1 = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);

    $submittedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Submitted', 'system_key' => 'submitted', 'is_closed' => false, 'order' => 0]);
    $pendingStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Pending', 'system_key' => 'pending', 'is_closed' => false, 'order' => 1]);

    // Check that we can edit Submitted status flags/bindings
    $this->actingAs($this->user)
        ->putJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/statuses/{$submittedStatus->id}", [
            'name' => 'New Submitted Name',
            'is_locked' => true,
            'stage_ids' => [$stage1->id],
        ])
        ->assertStatus(200);

    $submittedStatus->refresh();
    expect($submittedStatus->name)->toBe('New Submitted Name');
    expect($submittedStatus->is_locked)->toBeTrue();
    expect($submittedStatus->stage_ids)->toBe([$stage1->id]);

    // Check that we can edit Pending status name, but NOT flags
    $this->actingAs($this->user)
        ->putJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/statuses/{$pendingStatus->id}", [
            'name' => 'New Pending Name',
        ])
        ->assertStatus(200);

    $pendingStatus->refresh();
    expect($pendingStatus->name)->toBe('New Pending Name');

    // Attempting to edit Pending status flags must return 422
    $this->actingAs($this->user)
        ->putJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/statuses/{$pendingStatus->id}", [
            'is_locked' => true,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'System status flags and bindings cannot be modified.');

    // Attempting to edit Pending status bindings must return 422
    $this->actingAs($this->user)
        ->putJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/statuses/{$pendingStatus->id}", [
            'stage_ids' => [$stage1->id],
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'System status flags and bindings cannot be modified.');

    // Cannot delete system statuses
    $this->actingAs($this->user)
        ->deleteJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/statuses/{$submittedStatus->id}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'System statuses cannot be deleted.');

    $this->actingAs($this->user)
        ->deleteJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/statuses/{$pendingStatus->id}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'System statuses cannot be deleted.');
});

test('prevent manual pending status application', function () {
    $form = Form::factory()->create(['faction_id' => $this->faction->id, 'is_enabled' => true]);
    $stage1 = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);

    $submittedStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Submitted', 'system_key' => 'submitted', 'is_closed' => false, 'order' => 0]);
    $pendingStatus = FormStatus::create(['form_id' => $form->id, 'name' => 'Pending', 'system_key' => 'pending', 'is_closed' => false, 'order' => 1]);

    $submission = FormSubmission::create([
        'form_id' => $form->id,
        'user_id' => $this->user->id,
        'current_stage_id' => $stage1->id,
        'current_status_id' => $submittedStatus->id,
        'submitted_at' => now(),
    ]);

    // Attempt to manually apply Pending status via update status API
    $this->actingAs($this->user)
        ->putJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/status", [
            'status_id' => $pendingStatus->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'The Pending status cannot be applied manually.');
});

test('status stage bindings store and update API', function () {
    $form = Form::factory()->create(['faction_id' => $this->faction->id]);
    $stage1 = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);
    $stage2 = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 2', 'order' => 1]);

    // Create status with stage bindings
    $resStore = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/statuses", [
            'name' => 'Stage 1 Status',
            'stage_ids' => [$stage1->id],
        ])
        ->assertStatus(201);

    $statusId = $resStore->json('id');
    $status = FormStatus::find($statusId);
    expect($status->stage_ids)->toBe([$stage1->id]);

    // Update status stage bindings
    $this->actingAs($this->user)
        ->putJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}/statuses/{$statusId}", [
            'stage_ids' => [$stage1->id, $stage2->id],
        ])
        ->assertStatus(200);

    $status->refresh();
    expect($status->stage_ids)->toBe([$stage1->id, $stage2->id]);
});

test('commenting permissions on form submission', function () {
    $form = Form::factory()->create(['faction_id' => $this->faction->id]);
    $stage = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);
    $section = FormSection::create(['form_stage_id' => $stage->id, 'name' => 'Section 1', 'order' => 0]);

    // Create an applicant user
    $applicant = User::factory()->create();
    $applicant->factions()->attach($this->faction->id);

    // Create a submission for the applicant
    $submission = FormSubmission::create([
        'form_id' => $form->id,
        'user_id' => $applicant->id,
        'current_stage_id' => $stage->id,
    ]);

    // Test: Submitter (applicant) tries to post a comment -> should fail with 403
    $this->actingAs($applicant)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/comments", [
            'comment' => 'This is my comment',
            'is_internal' => false,
            'form_section_id' => $section->id,
        ])
        ->assertStatus(403);

    // Test: Reviewer (superadmin) posts a comment -> should succeed
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/comments", [
            'comment' => 'Reviewer feedback',
            'is_internal' => false,
            'form_section_id' => $section->id,
        ])
        ->assertStatus(200);

    // Assert comment database presence
    $this->assertDatabaseHas('form_comments', [
        'form_submission_id' => $submission->id,
        'comment' => 'Reviewer feedback',
        'is_internal' => false,
        'form_section_id' => $section->id,
    ]);
});

test('grading updates correctness and points based on rules', function () {
    $form = Form::factory()->create([
        'faction_id' => $this->faction->id,
        'type' => 'quiz',
        'is_enabled' => true,
    ]);
    $stage = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);
    $section = FormSection::create(['form_stage_id' => $stage->id, 'name' => 'Section 1', 'order' => 0]);
    $field = FormField::create([
        'form_section_id' => $section->id,
        'type' => 'text',
        'label' => 'Question',
        'name' => 'question',
        'points' => 10,
        'order' => 0,
        'has_grading' => true,
    ]);

    $submission = FormSubmission::create([
        'form_id' => $form->id,
        'user_id' => $this->user->id,
        'current_stage_id' => $stage->id,
    ]);

    $response = $submission->responses()->create([
        'form_field_id' => $field->id,
        'value' => 'Answer text',
        'points_awarded' => 0,
        'is_graded' => false,
    ]);

    // Grade correctness as correct -> should auto-fill to max points (10)
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/grade", [
            'grades' => [
                [
                    'response_id' => $response->id,
                    'correctness' => 'correct',
                    'comment' => 'Great answer',
                ],
            ],
        ])
        ->assertStatus(200);

    $response->refresh();
    expect($response->correctness)->toBe('correct');
    expect($response->points_awarded)->toBe(10);
    expect($response->reviewer_comment)->toBe('Great answer');

    // Grade correctness as incorrect -> should auto-fill to 0 points
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/grade", [
            'grades' => [
                [
                    'response_id' => $response->id,
                    'correctness' => 'incorrect',
                    'comment' => 'Wrong answer',
                ],
            ],
        ])
        ->assertStatus(200);

    $response->refresh();
    expect($response->correctness)->toBe('incorrect');
    expect($response->points_awarded)->toBe(0);

    // Grade correctness as partially_correct -> should allow manual points
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/grade", [
            'grades' => [
                [
                    'response_id' => $response->id,
                    'correctness' => 'partially_correct',
                    'points' => 5,
                    'comment' => 'Half correct',
                ],
            ],
        ])
        ->assertStatus(200);

    $response->refresh();
    expect($response->correctness)->toBe('partially_correct');
    expect($response->points_awarded)->toBe(5);
});

test('standard graded form updates correctness without points', function () {
    $form = Form::factory()->create([
        'faction_id' => $this->faction->id,
        'type' => 'standard',
        'is_enabled' => true,
    ]);
    $stage = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);
    $section = FormSection::create(['form_stage_id' => $stage->id, 'name' => 'Section 1', 'order' => 0]);
    $field = FormField::create([
        'form_section_id' => $section->id,
        'type' => 'text',
        'label' => 'Question',
        'name' => 'question',
        'order' => 0,
        'has_grading' => true,
    ]);

    $submission = FormSubmission::create([
        'form_id' => $form->id,
        'user_id' => $this->user->id,
        'current_stage_id' => $stage->id,
    ]);

    $response = $submission->responses()->create([
        'form_field_id' => $field->id,
        'value' => 'Answer text',
        'is_graded' => false,
    ]);

    // Grade correctness as correct
    $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/forms/submissions/{$submission->id}/grade", [
            'grades' => [
                [
                    'response_id' => $response->id,
                    'correctness' => 'correct',
                    'comment' => 'Fine',
                ],
            ],
        ])
        ->assertStatus(200);

    $response->refresh();
    expect($response->correctness)->toBe('correct');
    expect($response->points_awarded)->toBe(0); // Standard form has 0 points
    expect($response->reviewer_comment)->toBe('Fine');
});

test('correct answers should be concealed from someone lacking perms', function() {
    $form = Form::factory()->create(['faction_id' => $this->faction->id]);
    $stage = FormStage::create(['form_id' => $form->id, 'name' => 'Stage 1', 'order' => 0]);
    $section = FormSection::create(['form_stage_id' => $stage->id, 'name' => 'Section 1', 'order' => 0]);

    // Create an applicant user
    $applicant = User::factory()->create();


    // Allow users to view the form
    $perm = FormPermission::create(['form_id'=>$form->id, 'permissions'=> '["view_form"]']);

    // Create field
    $field = FormField::create([
        'form_section_id' => $section->id,
        'type' => 'text',
        'label' => 'Question',
        'name' => 'question',
        'points' => 10,
        'order' => 0,
        'has_grading' => true,
        'correct_answer'=> 'secret'
    ]);
    $this->actingAs($this->user)->getJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}")
        ->assertStatus(200)
        ->assertJsonPath('stages.0.sections.0.fields.0.correct_answer', 'secret');
        // Full access
    
    $this->actingAs($applicant)->getJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}")
        ->assertStatus(200)
        ->assertJsonMissingPath('stages.0.sections.0.fields.0.correct_answer');
        //No access

    $perm->update(['permissions'=> '["view_form", "view_submissions"]']);
    $this->actingAs($applicant)->getJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}")
        ->assertStatus(200)
        ->assertJsonPath('stages.0.sections.0.fields.0.correct_answer', 'secret');
        //Manual access

    $perm->update(['permissions'=> '["view_form", "form_editor"]']);
    $this->actingAs($applicant)->getJson("/api/factions/{$this->faction->shortname}/forms/{$form->id}")
        ->assertStatus(200)
        ->assertJsonPath('stages.0.sections.0.fields.0.correct_answer', 'secret');
        //Manual access

});
<?php

use App\Models\ChangelogEntry;
use App\Models\User;

test('anyone can view changelog entries', function () {
    ChangelogEntry::create([
        'version' => 'v2.0.0',
        'title' => 'Release v2.0.0',
        'items' => [
            ['type' => 'Feature', 'content' => 'First feature'],
            ['type' => 'Fix', 'content' => 'First fix'],
        ],
        'released_at' => now(),
    ]);

    $response = $this->getJson('/api/changelog');

    $response->assertStatus(200);
    $response->assertJsonFragment([
        'version' => 'v2.0.0',
        'title' => 'Release v2.0.0',
    ]);

    $data = $response->json();
    expect($data)->toBeArray();
    expect($data[0]['items'])->toBeArray();
    expect($data[0]['items'][0]['type'])->toBe('Feature');
    expect($data[0]['items'][0]['content'])->toBe('First feature');
});

test('superadmin can create changelog entry with items', function () {
    $admin = User::factory()->create(['is_superadmin' => true]);

    $response = $this->actingAs($admin)->postJson('/api/superadmin/changelog', [
        'version' => 'v2.1.0',
        'title' => 'Release 2.1.0',
        'released_at' => '2026-06-08',
        'order' => 10,
        'items' => [
            ['type' => 'Feature', 'content' => 'New roster page'],
            ['type' => 'Modification', 'content' => 'Tweaked colors'],
            ['type' => 'Backend', 'content' => 'Updated dependencies'],
            ['type' => 'Fix', 'content' => 'Fixed layout overflow'],
        ],
    ]);

    $response->assertStatus(201);
    $this->assertDatabaseHas('changelog_entries', [
        'version' => 'v2.1.0',
        'title' => 'Release 2.1.0',
    ]);

    $entry = ChangelogEntry::where('version', 'v2.1.0')->first();
    expect($entry->items)->toBeArray();
    expect($entry->items)->toHaveCount(4);
    expect($entry->items[0]['type'])->toBe('Feature');
});

test('validation rejects invalid item types or structure', function () {
    $admin = User::factory()->create(['is_superadmin' => true]);

    // Test invalid type
    $response = $this->actingAs($admin)->postJson('/api/superadmin/changelog', [
        'version' => 'v2.1.0',
        'title' => 'Release 2.1.0',
        'released_at' => '2026-06-08',
        'items' => [
            ['type' => 'InvalidType', 'content' => 'Invalid item content'],
        ],
    ]);
    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['items.0.type']);

    // Test missing content
    $response = $this->actingAs($admin)->postJson('/api/superadmin/changelog', [
        'version' => 'v2.1.0',
        'title' => 'Release 2.1.0',
        'released_at' => '2026-06-08',
        'items' => [
            ['type' => 'Feature'],
        ],
    ]);
    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['items.0.content']);
});

test('superadmin can update changelog entry with items', function () {
    $admin = User::factory()->create(['is_superadmin' => true]);
    $entry = ChangelogEntry::create([
        'version' => 'v1.0.0',
        'title' => 'Initial',
        'released_at' => '2026-06-01',
    ]);

    $response = $this->actingAs($admin)->putJson("/api/superadmin/changelog/{$entry->id}", [
        'title' => 'Updated Title',
        'items' => [
            ['type' => 'Feature', 'content' => 'Added item'],
        ],
    ]);

    $response->assertStatus(200);
    expect($entry->fresh()->title)->toBe('Updated Title');
    expect($entry->fresh()->items)->toBeArray();
    expect($entry->fresh()->items[0]['content'])->toBe('Added item');
});

test('non-superadmin cannot create changelog entry', function () {
    $user = User::factory()->create(['is_superadmin' => false]);

    $response = $this->actingAs($user)->postJson('/api/superadmin/changelog', [
        'version' => 'v2.1.0',
        'title' => 'Release 2.1.0',
        'released_at' => '2026-06-08',
    ]);

    $response->assertStatus(403);
});

test('non-superadmin cannot update changelog entry', function () {
    $user = User::factory()->create(['is_superadmin' => false]);
    $entry = ChangelogEntry::create([
        'version' => 'v1.0.0',
        'title' => 'Initial',
        'released_at' => '2026-06-01',
    ]);

    $response = $this->actingAs($user)->putJson("/api/superadmin/changelog/{$entry->id}", [
        'title' => 'Updated Title',
    ]);

    $response->assertStatus(403);
});

test('non-superadmin cannot delete changelog entry', function () {
    $user = User::factory()->create(['is_superadmin' => false]);
    $entry = ChangelogEntry::create([
        'version' => 'v1.0.0',
        'title' => 'Initial',
        'released_at' => '2026-06-01',
    ]);

    $response = $this->actingAs($user)->deleteJson("/api/superadmin/changelog/{$entry->id}");

    $response->assertStatus(403);
});

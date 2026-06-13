<?php

use App\Models\Notification;
use App\Models\User;

test('superadmin can create system notification with a link', function () {
    $admin = User::factory()->create(['is_superadmin' => true]);

    $response = $this->actingAs($admin)->postJson('/api/superadmin/notifications', [
        'title' => 'System Update',
        'message' => 'Hello <b>world</b> with HTML!',
        'link' => 'https://example.com/update-info',
    ]);

    $response->assertStatus(201);
    $this->assertDatabaseHas('notifications', [
        'title' => 'System Update',
        'message' => 'Hello <b>world</b> with HTML!',
        'link' => 'https://example.com/update-info',
        'type' => 'system',
    ]);
});

test('non-superadmin cannot create system notification', function () {
    $user = User::factory()->create(['is_superadmin' => false]);

    $response = $this->actingAs($user)->postJson('/api/superadmin/notifications', [
        'title' => 'Sneaky Notification',
        'message' => 'Trying to broadcast',
        'link' => 'https://google.com',
    ]);

    $response->assertStatus(403);
});

test('notifications index returns the link field', function () {
    $user = User::factory()->create(['is_superadmin' => false]);
    
    Notification::create([
        'title' => 'System Update',
        'message' => 'Release notes here.',
        'link' => '/changelog',
        'type' => 'system',
        'is_read' => false,
    ]);

    $response = $this->actingAs($user)->getJson('/api/notifications');

    $response->assertStatus(200);
    $response->assertJsonFragment([
        'title' => 'System Update',
        'message' => 'Release notes here.',
        'link' => '/changelog',
    ]);
});

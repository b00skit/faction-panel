<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('guest is redirected from pulse to login', function () {
    $response = $this->get('/pulse');

    $response->assertRedirect('/admin/login');
});

test('guest can view login page', function () {
    $response = $this->get('/admin/login');

    $response->assertStatus(200);
    $response->assertSee('Superadmin Access');
});

test('superadmin can login and is redirected to pulse', function () {
    $password = 'super_secret';
    $superadmin = User::factory()->create([
        'username' => 'admin_user',
        'password' => Hash::make($password),
        'is_superadmin' => true,
    ]);

    $response = $this->post('/admin/login', [
        'username' => 'admin_user',
        'password' => $password,
    ]);

    $response->assertRedirect('/pulse');
    $this->assertAuthenticatedAs($superadmin, 'web');
});

test('non-superadmin cannot login via admin login', function () {
    $password = 'secret_pass';
    $user = User::factory()->create([
        'username' => 'regular_user',
        'password' => Hash::make($password),
        'is_superadmin' => false,
    ]);

    $response = $this->post('/admin/login', [
        'username' => 'regular_user',
        'password' => $password,
    ]);

    $response->assertSessionHasErrors('username');
    $this->assertGuest('web');
});

test('regular logged in user cannot access pulse', function () {
    $user = User::factory()->create([
        'is_superadmin' => false,
    ]);

    $response = $this->actingAs($user, 'web')->get('/pulse');

    // Pulse returns 403 Forbidden via gate
    $response->assertStatus(403);
});

test('superadmin user can access pulse', function () {
    $superadmin = User::factory()->create([
        'is_superadmin' => true,
    ]);

    $response = $this->actingAs($superadmin, 'web')->get('/pulse');

    $response->assertStatus(200);
});

test('superadmin can logout', function () {
    $superadmin = User::factory()->create([
        'is_superadmin' => true,
    ]);

    $response = $this->actingAs($superadmin, 'web')->post('/admin/logout');

    $response->assertRedirect('/admin/login');
    $this->assertGuest('web');
});

test('guest is redirected from telescope to login', function () {
    $response = $this->get('/telescope');

    $response->assertRedirect('/admin/login');
});

test('regular logged in user cannot access telescope', function () {
    $user = User::factory()->create([
        'is_superadmin' => false,
    ]);

    $response = $this->actingAs($user, 'web')->get('/telescope');

    $response->assertStatus(403);
});

test('superadmin user can access telescope', function () {
    $superadmin = User::factory()->create([
        'is_superadmin' => true,
    ]);

    $response = $this->actingAs($superadmin, 'web')->get('/telescope');

    $response->assertStatus(200);
});

<?php

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordEntry;
use App\Models\Group;
use App\Models\HelpArticle;
use App\Models\HelpCategory;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterFlag;
use App\Models\RosterSection;
use App\Models\StatisticsModel;
use App\Models\User;

test('superadmin can delete a user and clear references and free credentials', function () {
    // 1. Create superadmin and target user
    $admin = User::factory()->create(['is_superadmin' => true]);
    $target = User::factory()->create([
        'username' => 'tobedeleted',
        'gtaw_id' => 12345,
        'gtaw_username' => 'GTAW_tobedeleted',
    ]);

    // 2. Create related entities referencing the target user
    $faction = Faction::factory()->create([
        'faction_leader' => $target->id,
        'created_by' => $target->id,
    ]);

    $roster = Roster::create([
        'faction_id' => $faction->id,
        'name' => 'Test Roster',
        'shortname' => 'ROS',
        'color' => '#ffffff',
        'created_by' => $target->id,
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Test Section',
        'shortname' => 'SEC',
        'type' => 'section',
        'created_by' => $target->id,
    ]);

    $content = RosterContent::create([
        'section_id' => $section->id,
        'content' => [],
        'created_by' => $target->id,
    ]);

    $group = Group::create([
        'faction_id' => $faction->id,
        'name' => 'Test Group',
        'color' => '#ffffff',
        'created_by' => $target->id,
    ]);

    $flag = RosterFlag::create([
        'faction_id' => $faction->id,
        'name' => 'Test Flag',
        'color' => '#ff0000',
        'rules' => [],
        'created_by' => $target->id,
    ]);

    $db = FactionRecordDatabase::create([
        'faction_id' => $faction->id,
        'name' => 'Test DB',
        'data_overview_display' => 'table',
        'data_entry_display' => 'detailed',
        'database_structure' => [],
        'created_by' => $target->id,
    ]);

    $entry = FactionRecordEntry::create([
        'database_id' => $db->id,
        'entry_id' => 1,
        'data' => [],
        'is_active' => true,
        'created_by' => $target->id,
    ]);

    $stat = StatisticsModel::create([
        'faction_id' => $faction->id,
        'name' => 'Test Stat',
        'created_by' => $target->id,
    ]);

    $category = HelpCategory::create([
        'name' => 'Test Cat',
        'slug' => 'test-cat',
    ]);

    $article = HelpArticle::create([
        'category_id' => $category->id,
        'title' => 'Test Article',
        'slug' => 'test-article',
        'content' => 'body text',
        'created_by' => $target->id,
    ]);

    // 3. Make request as admin to delete user
    $response = $this->actingAs($admin)
        ->deleteJson("/api/superadmin/users/{$target->id}");

    // 4. Assert response is 200
    $response->assertStatus(200);

    // 5. Assert user is deleted
    $this->assertDatabaseMissing('users', ['id' => $target->id]);

    // 6. Assert all resources still exist but their user references are null
    $this->assertDatabaseHas('factions', [
        'id' => $faction->id,
        'faction_leader' => null,
        'created_by' => null,
    ]);

    $this->assertDatabaseHas('rosters', [
        'id' => $roster->id,
        'created_by' => null,
    ]);

    $this->assertDatabaseHas('roster_sections', [
        'id' => $section->id,
        'created_by' => null,
    ]);

    $this->assertDatabaseHas('roster_contents', [
        'id' => $content->id,
        'created_by' => null,
    ]);

    $this->assertDatabaseHas('groups', [
        'id' => $group->id,
        'created_by' => null,
    ]);

    $this->assertDatabaseHas('roster_flags', [
        'id' => $flag->id,
        'created_by' => null,
    ]);

    $this->assertDatabaseHas('faction_record_databases', [
        'id' => $db->id,
        'created_by' => null,
    ]);

    $this->assertDatabaseHas('faction_record_entries', [
        'id' => $entry->id,
        'created_by' => null,
    ]);

    $this->assertDatabaseHas('statistics_models', [
        'id' => $stat->id,
        'created_by' => null,
    ]);

    $this->assertDatabaseHas('help_articles', [
        'id' => $article->id,
        'created_by' => null,
    ]);

    // 7. Verify username and GTA:W connection can be reused
    $newUser = User::create([
        'username' => 'tobedeleted',
        'gtaw_id' => 12345,
        'gtaw_username' => 'GTAW_tobedeleted',
        'password' => 'newsecurepassword',
    ]);

    expect($newUser->id)->not->toBeNull();
});

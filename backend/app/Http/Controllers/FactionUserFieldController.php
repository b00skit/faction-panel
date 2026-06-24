<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Models\FactionUserField;
use App\Models\FactionUserFieldValue;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FactionUserFieldController extends Controller
{
    public function index($shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();

        if (! User::hasFactionPermission(Auth::user(), $faction, 'view_users') &&
            ! User::hasFactionPermission(Auth::user(), $faction, 'manage_user_fields')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $fields = FactionUserField::where('faction_id', $faction->id)->orderBy('id')->get();

        return response()->json($fields);
    }

    public function store(Request $request, $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        if (! User::hasFactionPermission(Auth::user(), $faction, 'manage_user_fields')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|string|in:checkbox,text,textarea',
            'is_featured' => 'required|boolean',
        ]);

        $field = FactionUserField::create([
            'faction_id' => $faction->id,
            'name' => $validated['name'],
            'type' => $validated['type'],
            'is_featured' => $validated['is_featured'],
        ]);

        $this->audit('user_field.create', "Created custom user field '{$field->name}' of type '{$field->type}'", $faction->id, $field, null, $field->getAttributes());

        return response()->json($field, 201);
    }

    public function update(Request $request, FactionUserField $field)
    {
        if (! User::hasFactionPermission(Auth::user(), $field->faction, 'manage_user_fields')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'type' => 'sometimes|required|string|in:checkbox,text,textarea',
            'is_featured' => 'sometimes|required|boolean',
        ]);

        $oldValues = $field->getOriginal();
        $field->update($validated);

        $this->audit('user_field.update', "Updated custom user field '{$field->name}'", $field->faction_id, $field, $oldValues, $field->getDirty());

        return response()->json($field);
    }

    public function destroy(FactionUserField $field)
    {
        if (! User::hasFactionPermission(Auth::user(), $field->faction, 'manage_user_fields')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('user_field.delete', "Deleted custom user field '{$field->name}'", $field->faction_id, $field, $field->getAttributes());
        $field->delete();

        return response()->json(['message' => 'Field deleted successfully']);
    }

    public function updateUserValues(Request $request, $shortname, User $member)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        if (! User::hasFactionPermission(Auth::user(), $faction, 'manage_user_fields')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'values' => 'required|array',
            // Checkboxes can be boolean or string representation, let's allow mixed types but we coerce them
        ]);

        $updatedValues = [];
        foreach ($validated['values'] as $fieldId => $value) {
            $field = FactionUserField::where('faction_id', $faction->id)->findOrFail($fieldId);

            $coercedValue = $value;
            if ($field->type === 'checkbox') {
                $coercedValue = ($value === '1' || $value === 'true' || $value === true || $value === 'yes') ? '1' : '0';
            } else {
                $coercedValue = $value !== null ? (string) $value : null;
            }

            FactionUserFieldValue::updateOrCreate(
                [
                    'user_id' => $member->id,
                    'faction_user_field_id' => $field->id,
                ],
                [
                    'value' => $coercedValue,
                ]
            );
            $updatedValues[$field->id] = $coercedValue;
        }

        $this->audit('user_field.values_update', "Updated custom user field values for member '{$member->username}'", $faction->id, $member, null, $updatedValues);

        return response()->json(['message' => 'Values updated successfully']);
    }
}

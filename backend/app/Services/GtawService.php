<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GtawService
{
    protected string $baseUrl;

    protected string $clientId;

    protected string $clientSecret;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('features.gtaw_base_url'), '/');
        $this->clientId = config('features.gtaw_client_id');
        $this->clientSecret = config('features.gtaw_client_secret');
    }

    public function getFactions(string $accessToken)
    {
        $response = Http::withToken($accessToken)->get("{$this->baseUrl}/api/factions");

        if ($response->failed()) {
            Log::error('GTA:W Get Factions Failed', ['status' => $response->status(), 'body' => $response->json()]);

            return null;
        }

        return $response->json();
    }

    public function getFactionMembers(string $accessToken, int $factionId)
    {
        $response = Http::withToken($accessToken)->get("{$this->baseUrl}/api/faction/{$factionId}");

        if ($response->failed()) {
            Log::error('GTA:W Get Faction Members Failed', ['status' => $response->status(), 'body' => $response->json(), 'faction_id' => $factionId]);

            return null;
        }

        return $response->json();
    }

    public function getFactionAbas(string $accessToken, int $factionId)
    {
        $response = Http::withToken($accessToken)->get("{$this->baseUrl}/api/faction/{$factionId}/abas");

        if ($response->failed()) {
            Log::error('GTA:W Get Faction ABAS Failed', ['status' => $response->status(), 'body' => $response->json(), 'faction_id' => $factionId]);

            return null;
        }

        return $response->json();
    }

    public function getCharacterDetails(string $accessToken, int $factionId, int $characterId)
    {
        $response = Http::withToken($accessToken)->get("{$this->baseUrl}/api/faction/{$factionId}/character/{$characterId}");

        if ($response->failed()) {
            Log::error('GTA:W Get Character Details Failed', ['status' => $response->status(), 'body' => $response->json(), 'char_id' => $characterId]);

            return null;
        }

        return $response->json();
    }

    public function getFactionVehicles(string $accessToken, int $factionId)
    {
        $response = Http::withToken($accessToken)->get("{$this->baseUrl}/api/faction/{$factionId}/vehicles");

        if ($response->failed()) {
            Log::error('GTA:W Get Faction Vehicles Failed', ['status' => $response->status(), 'body' => $response->json(), 'faction_id' => $factionId]);

            return null;
        }

        return $response->json();
    }
}

Below is a detailed breakdown of the GTA World UCP API endpoints, the data structures they return, and the logic governing the results based on the provided documentation and controller source code.

---

## **Core Authentication & Requirements**

* **Protocol**: OAuth 2.0 (Authorization Code Grant).
* **Rate Limit**: 50 requests per minute.
* **Headers**: All API calls require `Authorization: Bearer {token}`.
* **Security**: Banned users or users with unconfirmed accounts (`confirmed != 1`) receive a **403 Forbidden**.

---

## **1. User Details**

**Endpoint:** `GET /api/user`
**Access:** Any valid authenticated user.

This is the primary endpoint for identifying the user and their characters. It includes sensitive banking data used for routing transfers.

* **User Object**:
* `id`: Internal UCP user ID.
* `username`: Account name.
* `role`: The admin role name (e.g., "Player", "Admin", "Support") translated from an ID.
* `created_at`: Account registration date.


* **Character Array**: Returns a list of characters owned by the user.
* `id`: Character ID.
* `firstname` / `lastname`: In-game name.
* `bank_routing_number`: The character's **Personal** bank account routing number. Returns `null` if no personal account exists.



---

## **2. User Activity & Bans (Restricted)**

**Endpoints:** `GET /api/activity` and `GET /api/bans`
**Access:** Strictly limited to **Client ID 15** (FLD).

These endpoints provide historical and meta-data regarding the user's standing and time spent in-game.

* **Activity**: Returns a keyed object where the key is the `character_id`.
* `total`: Total lifetime minutes spent on the character.
* `duty`: Total lifetime minutes spent "On Duty" (faction work).


* **Bans**: Returns an array of Ban objects.
* Includes fields from the `Ban` model (reason, date, admin, expiry).



---

## **3. Faction Overview**

**Endpoint:** `GET /api/factions`
**Access:** Any valid authenticated user.

Returns a list of all characters the user owns that are currently in a faction.

* **Returned Data**: A keyed object by `character_id`.
* `faction`: The internal Faction ID.
* `faction_name`: The full name of the organization.
* `faction_rank`: Numeric rank level.
* `faction_rank_name`: String representation of the rank (e.g., "Officer", "Sergeant").



---

## **4. Faction Management (Supervisor+)**

**Endpoints**:

* `GET /api/faction/{id}` (Member List)
* `GET /api/faction/{id}/ranks` (Rank Definitions)
* `GET /api/faction/{id}/abas` (30-Day Activity)

**Access**: Requires `canManageFactions` permission **OR** a rank in that faction $\ge$ the `supervisor_permission` value (typically 15).

### **Member List**

Returns basic profile data for every member in the faction.

* `user_id`: The account ID of the member.
* `character_name`: Full IC name.
* `last_online` / `last_duty`: Timestamps of recent activity.
* `last_weekly_payment`: Timestamp of the last faction salary payment.

### **ABAS (Average Between Activity System)**

Calculates the average daily hours over the last 30 days. This data is **cached for 4 hours**.

* **Logic**: If the faction has the `DUTYABAS` flag, it calculates based on `dutymins`. Otherwise, it uses `onlinemins`.
* **Formula**: $\frac{\text{Total Minutes}}{60 \text{ (min/hr)} \div 30 \text{ (days)}}$
* `abas`: A string formatted to two decimal places (e.g., `"2.50"`).

---

## **5. Character Specifics**

**Endpoint:** `GET /api/faction/{fId}/character/{cId}`
**Access:** Supervisor+ permissions.

This provides a deep-dive into a specific faction member, including their **alt characters** within the same faction to prevent "double dipping" or activity manipulation.

* **Profile**: Standard name, rank, and ABAS data.
* **Alternative Characters**: An array of other characters owned by the same user that are also in this faction, including their individual activity stats.

---

## **6. Presence Check**

**Endpoint:** `GET /api/check-character-online/{id}`
**Access:** User must own the target character.

A simple utility to check if a character is currently in-game.

* **Returns**: `true` if the character's heartbeat has been updated within the last **5 minutes**; otherwise `false`.

---

## **7. Logging and Security**

The API performs internal logging on almost every call via the `UCPApiLog` model. The following metadata is recorded for every sensitive request:

* `client_id`: Which application made the call.
* `user_id`: Which user was being accessed/acting.
* `action`: The specific method called (e.g., `factionABAS`).
* `ip_address`, `referer`, and `user_agent`.
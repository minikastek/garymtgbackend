# T1A Location Discovery Domain Plan

**Goal:** Establish the privacy-safe ranking and pagination rules used by location-based trade discovery before persistence and HTTP wiring are added.

**Architecture:** A pure service receives normalized users and trade profiles, excludes ineligible candidates, ranks only on location precision the candidate chose to reveal, and returns a deterministic cursor page containing public fields only.

## Contract

- Trading is opt-in through `tradeEnabled === true`.
- The requester and candidates outside the requester's country are excluded.
- Ranking order is city, region, then country, with username and id tie-breakers.
- Candidate visibility (`country`, `region`, or `city`) caps both comparison precision and response precision.
- Pages contain at most 20 users and use the final user id as an opaque-to-clients continuation cursor.
- Unknown cursors are rejected so clients cannot silently receive duplicate pages.
- Email, coordinates, authentication data, and hidden location fields never enter the result.

## Follow-up slices

1. Add JSON and PostgreSQL trade-profile repositories and persistence migration changes.
2. Add authenticated profile update and location-discovery endpoints with boundary validation.
3. Connect the frontend trade flow to opt-in profile editing and location discovery.

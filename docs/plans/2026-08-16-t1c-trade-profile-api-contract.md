# T1C Trade Profile API Contract Plan

**Goal:** Define authenticated owner-only read and update behavior for private trade-location preferences without coupling the route to an unmerged persistence branch.

**Architecture:** An injectable Express router trusts the existing authentication middleware for identity, validates every request field at the HTTP boundary, verifies opt-in readiness against the current profile, and delegates storage to a repository contract.

## Contract

- `GET /api/trade-profile` reads only `req.user.id`.
- `PATCH /api/trade-profile` accepts only documented location, radius, opt-in, and visibility fields.
- Country, text lengths, radius, booleans, visibility, and coordinate pairs are strictly validated.
- Enabling discovery requires all location fields implied by the selected visibility.
- Unknown users return 404; persistence failures return a generic Spanish 500 response.
- The router is intentionally not mounted until the persistence adapter PR lands.

## Follow-up slice

After persistence is merged, wire the repository factory and authenticated route into `index.js`, then add the location-discovery endpoint after the ranking-domain PR lands.

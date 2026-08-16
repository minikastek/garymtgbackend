ALTER TABLE trade_profiles
  ADD COLUMN location_visibility text NOT NULL DEFAULT 'country'
  CHECK (location_visibility IN ('country', 'region', 'city'));

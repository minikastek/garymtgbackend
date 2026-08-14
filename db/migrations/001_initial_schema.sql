CREATE TABLE users (
  id text PRIMARY KEY,
  username text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_lower_unique ON users (lower(username));

CREATE TABLE trade_profiles (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  country_code char(2), region text, city text,
  latitude numeric(9, 6), longitude numeric(9, 6),
  search_radius_km integer NOT NULL DEFAULT 25 CHECK (search_radius_km BETWEEN 1 AND 500),
  trade_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL))
);

CREATE TABLE collections (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deck', 'binder', 'wishlist')),
  name text NOT NULL, description text NOT NULL DEFAULT '', format text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'trade', 'public')),
  trade_enabled boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collections_user_type_idx ON collections (user_id, type);

CREATE TABLE collection_cards (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  collection_id text NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  card_id text NOT NULL, board text NOT NULL DEFAULT 'main' CHECK (board IN ('main', 'sideboard')),
  name text NOT NULL, set_code text, collector_number text, rarity text, type_line text,
  image_url text, image_large_url text, prices jsonb,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, board, card_id)
);
CREATE INDEX collection_cards_name_lower_idx ON collection_cards (lower(name));
CREATE INDEX collection_cards_collection_idx ON collection_cards (collection_id);

CREATE TABLE price_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_id text NOT NULL, seller text NOT NULL, currency char(3) NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0), condition text, finish text,
  product_url text, observed_at timestamptz NOT NULL, raw_payload jsonb,
  UNIQUE (card_id, seller, currency, condition, finish, observed_at)
);
CREATE INDEX price_observations_lookup_idx ON price_observations (card_id, observed_at DESC);

CREATE TABLE trade_proposals (
  id text PRIMARY KEY,
  proposer_user_id text NOT NULL REFERENCES users(id), recipient_user_id text NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'cancelled', 'expired')),
  proposer_collection_version integer NOT NULL CHECK (proposer_collection_version > 0),
  recipient_collection_version integer NOT NULL CHECK (recipient_collection_version > 0),
  valuation_currency char(3), message text NOT NULL DEFAULT '', expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (proposer_user_id <> recipient_user_id)
);
CREATE INDEX trade_proposals_participants_idx ON trade_proposals (proposer_user_id, recipient_user_id, status);

CREATE TABLE trade_proposal_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_id text NOT NULL REFERENCES trade_proposals(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL REFERENCES users(id), card_id text NOT NULL, name text NOT NULL,
  set_code text, collector_number text, quantity integer NOT NULL CHECK (quantity > 0),
  unit_value numeric(12, 2), price_source text, price_observed_at timestamptz
);

CREATE TABLE idempotency_keys (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation text NOT NULL, key text NOT NULL, response_status integer NOT NULL,
  response_body jsonb NOT NULL, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation, key)
);

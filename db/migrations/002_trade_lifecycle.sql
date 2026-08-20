ALTER TABLE trade_proposals DROP CONSTRAINT IF EXISTS trade_proposals_status_check;

UPDATE trade_proposals SET status = 'pending' WHERE status IN ('draft', 'sent');
UPDATE trade_proposals SET status = 'cancelled' WHERE status = 'expired';

ALTER TABLE trade_proposals
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN proposer_collection_version DROP NOT NULL,
  ALTER COLUMN recipient_collection_version DROP NOT NULL,
  ADD COLUMN parent_trade_id text REFERENCES trade_proposals(id),
  ADD COLUMN coordination jsonb,
  ADD COLUMN accepted_at timestamptz,
  ADD COLUMN declined_at timestamptz,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN proposer_completed_at timestamptz,
  ADD COLUMN recipient_completed_at timestamptz,
  ADD COLUMN completed_at timestamptz,
  ADD CONSTRAINT trade_proposals_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed'));

ALTER TABLE trade_proposal_items
  ALTER COLUMN name DROP NOT NULL,
  ADD COLUMN binder_id text,
  ADD COLUMN side text CHECK (side IN ('offered', 'requested')),
  ADD COLUMN position integer NOT NULL DEFAULT 0 CHECK (position >= 0);

CREATE INDEX trade_proposals_proposer_idx
  ON trade_proposals (proposer_user_id, created_at DESC);
CREATE INDEX trade_proposals_recipient_idx
  ON trade_proposals (recipient_user_id, created_at DESC);
CREATE INDEX trade_proposal_items_proposal_side_idx
  ON trade_proposal_items (proposal_id, side, position);

# Trade Lifecycle Design

## Purpose

GaryMTG trades separate a proposed exchange, agreement between players, and confirmation that the physical exchange happened. Binder quantities are not changed when a proposal is accepted.

## Lifecycle

1. A proposer sends a trade containing offered and requested card lines with a server-owned price snapshot.
2. The recipient accepts or declines the proposal. Acceptance reserves the referenced inventory in a later persistence slice.
3. Accepted participants coordinate privately using an exchange method and optional notes.
4. Each participant independently confirms completion.
5. Only the second completion confirmation promotes the trade to `completed`; a later transactional service will then update both binders atomically.

## States

- `pending`: awaiting the recipient's decision.
- `accepted`: both players agreed; completion confirmations may be recorded.
- `declined`: recipient rejected the proposal.
- `cancelled`: proposer withdrew a pending proposal.
- `completed`: both participants confirmed the physical exchange.

Completion progress is represented by `proposerCompletedAt` and `recipientCompletedAt`, not an additional transient status.

## Authorization

- Only the recipient can accept or decline a pending trade.
- Only the proposer can cancel a pending trade.
- Only participants can update coordination details or confirm completion.
- Coordination details cannot change after either participant confirms completion.
- Repeating a participant's completion confirmation is idempotent.

## Coordination privacy

The MVP stores an allowlisted method (`in_person`, `shipping`, or `other`) and an optional private note of at most 500 characters. Exact addresses, public location data, chat, and file attachments are excluded.

## Future growth

- `parentTradeId` supports immutable counter-offer chains.
- Persistence adapters will support JSON locally and PostgreSQL at scale.
- Accepted cards will be reserved before binder mutation is introduced.
- Notifications will be durable records and may later be delivered through an outbox to WebSockets or email.


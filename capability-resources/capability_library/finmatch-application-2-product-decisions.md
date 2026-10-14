# FinMatch Application 2 Product Decisions

**Application:** FinMatch  
**Purpose:** Record product and experience decisions that sit above the individual FinMatch capability contracts. Keep capability inputs, scoring, and mapping rules in their respective specifications.

## Confirmed product decisions

### Recommendation cards

- Present investment options as cards and let the user choose an action by clicking.
- For the demo, cards display only the metrics provided through the Application 1 API connection. There is no **Learn more** action or separate details view.
- In the demo, run one round only. A round ends once all available cards for that round have been displayed.
- The demo has up to five recommendation options. If fewer than five are available, show all available options rather than waiting for more.
- Provide positive and negative choices (**Yes** and **No**). Store only **Yes** choices as saved selections. A **No** choice is not stored as a saved selection.
- A saved **Yes** cannot be undone in the demo.
- For each **Yes**, store the timestamp, the company's ticker symbol, and the recommendation on which the displayed option was based. Store a stable recommendation reference or snapshot, including its version where available, so the basis for the saved choice can be identified later.
- A **No** choice must not appear again in the same round. The possibility of returning it in a later round applies only to a future version with multiple rounds; the demo has no later round.
- Randomly order the available options for the demo round.
- If the user exits before the round ends, the demo session must be repeated from the beginning when they return.
- The demo recommendation cards are based on stocks only.
- If the recommendation pool is empty, show a notice asking the user to come back later.

### Relationship to Application 1

- Application 2 will be partially based on Application 1 through an API connection. The recommendation cards will use metrics supplied through this connection.

## How these decisions fit the capability specifications

The risk questionnaire, industry preference capture, risk-to-industry mapping, and company or product recommendation logic remain distinct capabilities. They provide and transform information used by the card experience; this note defines the user's interaction with recommendation options and how Yes/No choices affect that experience.

The capability documents specify risk and industry inputs but do not define a recommendation round, card count, or persistence behavior for a user's Yes/No choices. The revised flagship application brief describes one-option-at-a-time swipe or click-and-pick cards and says users can save, pass, or learn more. The demo-specific round and choice-persistence rules above make those interaction decisions more specific.

## Decisions still needed

The following details affect implementation and remain open:

1. **API and metrics:** Which API endpoint and metric fields will Application 1 provide? How should Application 2 handle unavailable, stale, or incomplete metrics?

## Scope boundary

This document records product-level experience and persistence decisions. It does not define the risk questionnaire wording or score, risk-to-industry policy, company/product eligibility, recommendation ranking, market data sources, fee calculations, suitability claims, or brokerage actions. Those require their own approved rules and capability specifications.

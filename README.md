# KSM Timber Pavilion Designer

Standalone KSM pavilion configurator using procedural Three.js geometry rebuilt to the measured pavilion dimensions and a TSI-style customer workflow.

## Local development

Node 22.13+ and pnpm 11.25.0 are required.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

## Validation and production build

```sh
pnpm exec tsc --noEmit
pnpm build
```

The source repository is https://github.com/mattglick-ship-it/KSM3d. `.openai/hosting.json` identifies the independent private KSM Site. This is not the TSI Site. Supabase does not host the frontend: it provides authentication, private saved designs, quote records, pricing/model settings, and the commerce gateway.

Supabase uses the public publishable key in `lib/supabase.ts`. Apply migrations under `supabase/migrations/` only when setting up a separate backend; the included migration has already been applied to the connected project. Do not reapply it to the same database.

See `docs/SOURCE_NOTES.md` for model provenance, brand specifications, data isolation, verification, and GitHub access status.

## Administration and commerce

Open `/admin` and sign in with the existing Supabase administrator account. Membership in `ksm_pavilion_admins` controls access; client-side UI visibility is not the permission boundary. Admins can publish pricing and model settings, review quote requests, update follow-up notes, export CSV, and verify Square payment status.

The server requires the secret `KSM_COMMERCE_SERVICE_KEY`. It is configured in the standalone hosting environment, never in browser code. The deployed `ksm-pavilion-commerce` Edge Function stores quotes in the connected Supabase project and calls KSM's existing delivery, quote email and Square services. The original payment provider settings remain authoritative. Checkout charges the original fixed $2,500 deposit; the pavilion estimate is not charged in full. To rotate the gateway key, update its SHA-256 hash in the function and the matching hosting secret together.

Run `node tests/commerce.cjs` for offline commerce, pricing-height, share-link and PDF checks. The tests mock external services and do not send emails or create orders. Actual email delivery and completed Square payment still require an end-to-end acceptance check. WebGL2 is required for 3D rendering.

## Procedural models

All pavilion parts, hammer trusses, furniture and grill geometry are generated in code. No GLB, glTF, STL or OBJ assets are loaded or shipped. `components/pavilion/procedural-geometry.ts` builds new solids from editable dimensioned profiles and member locations; `procedural-furniture.ts` builds the scale furniture. Existing calculated posts, roof panels, rafters and King Truss geometry remain procedural.

Run `node scripts/check-procedural-models.cjs` to verify part dimensions, hammer member locations, furniture envelopes, finite attributes and the model-loader prohibition. `node scripts/render-truss-icons.mjs` regenerates option previews from the actual geometry. Legacy settings names containing `Glb` are retained solely for compatibility with saved administrator settings.

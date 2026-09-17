# KSM Pavilion Designer

Created for Matt Glick, September 16, 2026.

## Sources

- Pavilion source: Lovable `LIVE - KSM Pavilion 3D`, project `24d35d0e-9f7f-4282-a598-170a9b41e6cc`, commit `630f9db90af4ed36cf60c52db5870b1cc32ab39a`.
- Customer defaults: 16 × 20 ft, King Truss, no decorative plates, 8 ft posts, smooth unfinished timber, slate gray standing seam roof. Customer catalog excludes widths 24 ft and above.
- Geometry: original Pavilion3D, custom STL/GLB files, baked per-width adjustments, textures, and camera behavior imported. `reference-scene.tsx` retains the dependency graph of the original scene props; customer geometry reads published defaults, with the bundled defaults as fallback. Admin edits are explicitly published from the model editor. The original Configurator text is retained under `references/` for comparison.
- Pricing: initial snapshot of the original Lovable `pricing_data` record `pavilion` (updated June 23, 2026), retrieved September 16, 2026. Original engine retained. Snow guards and snow rail are marked to be quoted because the original price engine does not price them. The catalog is an estimate, not an order price authority.
- Workflow: TSI configurator layout, step navigation, undo/redo implementation, private saved-design pattern, camera exports, and summaries. TSI source reference: `/workspace/scratch/2e5b416aa329/TSI3D_SOURCE`. No changes were made to that source or its database tables.
- Brand: user-supplied `Logo Suite '23.zip`, including KSM Brand Guidelines 2023, official unmodified color logo and green symbol, DDC Hardware Regular, and Gotham Book/Medium. Colors: #19332c, #b98d44, #dacfc1, #000000.

## Data and hosting

- Supabase project: `aymeshzwwffwvccwvzro` (the user's connected project).
- Saved designs: separate `public.ksm_pavilion_designs` table. Four owner-only RLS policies; no anonymous table access. Optimistic concurrency checks `updated_at` when editing a saved record.
- The frontend uses a public publishable key, never a secret or service-role key. Sign-up confirmation uses the project's existing Auth configuration; it was not changed because the project is shared with TSI. Users return to this KSM designer after confirming their account.
- No original Lovable database records were modified. No email, quote request, checkout, or real order was sent during development.
- Source is standalone React/TypeScript, Three.js/R3F, Vinext/Vite. Geometry is bundled; commerce calls the existing KSM backend through the new server-only gateway. All referenced pavilion assets and environment textures are bundled locally.
- Three large furniture GLBs were split into glTF JSON and binary buffer files without changing geometry or texture bytes, keeping each individual asset within hosting and repository-transfer limits. Buffer-view bytes are verified unchanged.
- GitHub destination is `mattglick-ship-it/KSM3d`; repository access has been restored.

## Verification and remaining checks

- TypeScript check; production build; local asset existence and split glTF buffer checks.
- Supabase check confirmed RLS enabled, four owner policies, anonymous SELECT denied.
- Desktop controls, 8/9/10-foot selection, quote dialog, pricing and admin sign-in screen were browser checked. The test browser disables WebGL, so actual 3D appearance and mobile interaction still need hardware/browser acceptance. Authenticated admin and real email/payment flows were not exercised. WebMCP remains progressive.
- Supabase advisor reports the existing project's leaked-password protection is disabled. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No shared Auth settings were changed.
- Original model/pricing editors have been ported. Quotes and payment state are stored in separate KSM tables. Existing KSM Square and email services are reused; their credentials, webhooks and historical records have not been migrated. Email analytics indicate request acceptance, not confirmed delivery or opens. No main KSM website integration was performed.

## September 17 completion work

- Eastern White Pine textures, four visible timber surface treatments, truss icons, park environment and eave shadow bias updated. Post heights are 8, 9 or 10 feet.
- Quotes persist before email requests. Retries use submission identifiers; Square creation is locked to reduce duplicate deposits, and paid state is verified against Square rather than redirect parameters.
- Separate admin membership and column-limited quote updates are enforced by RLS. Owner/nonowner and saved-design isolation checks used rolled-back transactions.
- Pricing uploads accept `.xlsx` with cached values; legacy `.xls` is not supported. The XLSX reader does not execute macros or formulas.
- PDF sample rendered and inspected with embedded licensed DejaVu fonts; long notes continue onto additional pages.
- Existing shared Supabase Auth settings and TSI application were left unchanged.

## Unstained Little Buffalo reference

The unfinished option uses the warmer honey-gold appearance in KSM's Little Buffalo State Park pavilion photos: https://ksmloghomes.com/timber-frame-pavilions/ . Reference images: Little Buffalo Pavilion-10.jpg (exterior) and Little Buffalo Pavilion-08.jpg (interior). These are visual references rather than color-calibrated measurements. Beam tint multiplies the existing pine grain photograph; unstained ceiling boards use the bundled knotty pine plank photograph with corrected grain orientation. Existing stain calculations and tooling relief remain unchanged. Versioned natural-color settings keep the customer and admin defaults consistent without reusing the older amber/white calibration.

## September 17 reference finishes, trusses and snow retention

- User's smooth and hatchet/hand-peeled build screenshots guide surface treatment independently of stain. Hatchet relief now uses short, angular cross-grain incisions over broad drawknife facets. Smooth remains planed with fine pine grain.
- Four AI-generated 3D sample illustrations are in `public/finish-samples/`; these illustrate the finish options rather than documenting manufactured samples. Same horizontal honey-gold Eastern White Pine block, visible endgrain, neutral studio light; finish-specific prompts specify planed faces, fine rough-sawn striations, broad drawknife facets, or short angular hatchet incisions. Generated with built-in imagegen from the supplied finish photos and Little Buffalo color references, September 17, 2026.
- Truss diagrams now render the actual King/Arch geometry functions and per-width authored Hammer GLBs, at 12/14/16/20 feet. Arch diagrams apply the bundled per-piece transformations. They are technical previews of the bundled geometry; later published admin geometry overrides require regenerating previews. `scripts/render-truss-icons.mjs` also renders the snow-guard detail from the same roof components with a software depth buffer.
- Snow guards remain visible on both roof slopes, seated at the panel surface; seam slots clear the modeled seam cap. Guards and rail are mutually exclusive when selected in the customer UI. Enabling either reveals the roof.
- User-approved snow rates: guards $7.50 each; ribbed-metal rail $22.50 per 10-foot section; standing-seam rail $22.50 per linear foot. Quantities cover both eaves. Ribbed sections round up independently per eave; rail stops eight inches short of each gable. Guard quantities use the same placement function as the 3D model. Older saved catalogs inherit these approved defaults; Pricing Admin can override the three rates, with null remaining explicitly pending.
- `scripts/check-snow-pricing.cjs` verifies all catalog sizes, overhangs, both metal types, model counts, section rounding, cents, legacy catalogs, invalid/zero rates and shingle exclusion without contacting customer or payment services.

## September 17 longitudinal grain and finish refinement

- Timber grain follows each member's physical length on all four long faces, including scaled, rotated and mirrored pieces. Imported hammer trusses are separated into their disconnected timber solids for mapping. Shared source geometry remains untouched. Obsolete per-face texture rotations no longer override this mapping.
- Curved arch braces retain straight, lengthwise grain through the curved cuts, as solid sawn stock would. Exposed cut ends receive growth-ring end grain. Pine texture scale stays consistent between timbers.
- Finish relief distinguishes planed smooth, matte rough sawn, finite drawknife facets and irregular short hatchet cuts, with subtle cavity shading and finish-specific roughness.
- `scripts/check-timber-grain.cjs` verifies four long faces, cut ends, axes, diagonal/mirrored pieces, scale, source isolation and all four imported hammer truss sizes. TypeScript, offline commerce checks and production build pass. Local WebGL inspection confirmed arch framing and finishes render without console errors.

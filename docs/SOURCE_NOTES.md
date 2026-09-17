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

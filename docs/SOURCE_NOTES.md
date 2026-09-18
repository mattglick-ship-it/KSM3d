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

## September 17 realism and post-base correction

- Restored the post base's two rounded crown profiles, one-unit plate thickness and four hex heads on each face, using the earlier model only to measure the drawings. The first procedural rebuild had incorrectly expanded a rectangular section to the crown's overall height and flattened the opposite plate's bolts. New profiles generate all geometry at runtime; no old model is loaded. The original envelope and 8.25-inch installed footprint are preserved.
- Pine retains its photographic color range with subtle per-member variation. Tooling passes have irregular spacing and depth; a separate roughness channel varies reflections across compressed facets and fibres. Exposed end grain has varied pith locations and uneven ring spacing.
- All structural wood now receives roof/joint shadows. Sun-shadow coverage follows pavilion dimensions, contact shadows sit on the selected ground/pad surface, and daylight fill is balanced to preserve interior detail. Post bases use a matte coated-steel material.
- Geometry checks now verify open corners above the base shoulders, both crowns, plate thickness and all eight bolt heads. Material-switch checks include independent roughness data. Post-base before/after geometry was inspected with the software renderer; the available browser does not support WebGL, so full lighting/material appearance could not be visually verified there.

## September 17 timber finish switching fix

- Reproduced a stale finish shader during React Three Fiber material updates: bump texture and roughness changed, while the previous `onUpdate` callback kept the prior finish's shader and cavity shading. Material instances now refresh when the selected finish changes, for both single-material members and six-face box timbers.
- `scripts/check-timber-finish-updates.cjs` mounts the production WoodMaterial through R3F and checks all four finishes, repeated switches, and returning to smooth across posts, beams, rafters, trusses, braces and planks. This checks material/shader state without a GPU; the available browser cannot provide WebGL visual validation.

## September 17 longitudinal grain and finish refinement

- Timber grain follows each member's physical length on all four long faces, including scaled, rotated and mirrored pieces. Imported hammer trusses are separated into their disconnected timber solids for mapping. Shared source geometry remains untouched. Obsolete per-face texture rotations no longer override this mapping.
- Curved arch braces retain straight, lengthwise grain through the curved cuts, as solid sawn stock would. Exposed cut ends receive growth-ring end grain. Pine texture scale stays consistent between timbers.
- Finish relief distinguishes planed smooth, matte rough sawn, finite drawknife facets and irregular short hatchet cuts, with subtle cavity shading and finish-specific roughness.
- `scripts/check-timber-grain.cjs` verifies four long faces, cut ends, axes, diagonal/mirrored pieces, scale, source isolation and all four imported hammer truss sizes. TypeScript, offline commerce checks and production build pass. Local WebGL inspection confirmed arch framing and finishes render without console errors.

## September 17 procedural reconstruction

Supersedes the imported-model implementation described above. Per user instruction, original files were used only for a dimensional survey. Their meshes are neither imported nor shipped. All 108 legacy model files/manifests were removed from the active source; history retains them for provenance.

- `member-dimensions.json`: opposite stock corners and original member coordinate frames.
- `member-profiles.json`: dimensioned planar cuts, fitted cubic curves and extrusion depths. Contains no source triangle indices, normals, materials, UVs, or buffers. New Three.js Shapes/ExtrudeGeometry manufacture the surfaces. Curved profiles are fitted from the survey; this is visual reconstruction, not certified shop geometry.
- Structural profiles include curved arch wings, struts, pendant posts, scroll ends, corbels, steel plates, roof trim, post bases and snow rail. New profiles keep the surveyed envelopes and published per-member transforms.
- All four Hammer Truss widths use individual dimensioned timber drawings and new, separate left/right rafters. Width-specific positions, stock envelopes, 8/12 pitch, 12-inch tails and birdsmouth seats are retained. Model controls retain their persisted setting keys for backward compatibility.
- Furniture and the grill are rebuilt from boxes, rounded cushions, slats, cylinders and lathed shells, fitted to the previous displayed overall width/depth/height. Picnic tabletop remains 72 × 30 inches and 29 inches high. Furniture detail is newly designed; its overall scale dimensions are retained.
- Existing mathematical post, roof, rafter, King Truss, seam and snow-guard construction remains in code. Pricing and saved-design formats are unchanged.
- Geometry checks verify every part envelope, all four hammer member layouts, finite geometry and furniture dimensions. Timber-grain and snow-pricing checks pass. All twelve truss option previews and furniture were software-rendered and inspected. Browser controls were checked; the cloud browser disables WebGL, so live GPU appearance/orbiting could not be checked in that browser.

## Lovable feature parity — September 17, 2026

- Added simultaneous furniture previews with per-item X/Z placement and rotation, plus the 55-inch TV with corner and mounting height. Existing procedural geometry remains in use; no original model assets were added. Reconnected the already-procedural picnic table to the scene.
- Furniture/TV settings are validated and preserved in undo/redo, account saves, JSON files, share links, and device-local draft restoration. Old version-1 single-furniture files migrate on read. Placement is clamped to the original envelope when size or rotation changes.
- Draft startup precedence: shared link, payment-return design, then local draft. Shared hashes are consumed so later reloads restore the current draft. Storage failures leave manual save/download available.
- Added the customer email-copy preference, forwarded in the existing quote service payload and retained in quote customer JSON. Commerce Edge Function version 2 preserves its existing service-key authentication. Delivery by the external KSM service was not exercised or independently verified.
- Embedded submissions emit `ksm:quote-request` with customer, quote, config, design and submissionId once per submission attempt, even if the subsequent server request fails. Parent integrations should deduplicate submissionId and validate event.origin. Messages target the embedding origin from the referrer/ancestor origin; embedding with neither available will suppress the event. Main website receiver wiring is outside this change.
- Admin adds all-time counts, last 7/30 calendar-day totals, and a 30-day daily chart. Analytics page through the full date window independently of the latest-500 quote table. Counts remain protected by existing admin RLS; no schema/access change. Older Lovable quote history has not been migrated.
- Verification: TypeScript and production build; offline feature and commerce checks; browser multi-furniture controls, rotation undo/redo, reload restoration, TV controls and quote preference. No real quotes, emails or payments were submitted. WebGL remains unavailable in the test browser. Authenticated admin chart was checked through data-loader tests, including >1,000 rows, and a read-only live count query (zero records).

## September 18, 2026 — first size expansion

User reviewed the complete workbook audit and said “ok lets start.” This release adds the first nine existing-width footprints: 12×12, 12×14, 12×40, 14×26, 16×16, 16×32, 16×40, 20×30 and 20×36. There are now 21 customer footprints. New-width families, the custom 22×60 and the duplicated 30×40 remain unavailable. Original workbook and synced references are unchanged.

Detailed sheets in `2026 Pavilion pricing sheets.xlsx` supply the base package totals, post/truss/rafter counts, pitch and stock member dimensions. New prices retain cents; all 12 pre-existing price rows are preserved exactly. 12×12 shingle/ribbed, and all roofs for 12×40, 14×26 and 16×32 use unflagged source totals. Base prices stay blank for 12×14 (rafter BF), 16×16 (post BF), 16×40 (girder BF), 20×30 and 20×36 (omitted plate/lag charges). 12×12 standing seam stays blank because its markup label conflicts with its formula. These prices were not silently corrected or rounded upward. Alternate truss styles and unspecified options require separate quotes.

`pavilion-size-expansion.json` records the nine framing specifications. Brace quantities include physical full-arch braces only, not their screw counts. The long 12×40, 16×40 and 20×36 models have five post stations (ten posts) and three trusses. 20×36 follows its 14-brace takeoff with unbraced quarter-point posts. Positions are symmetrical preview assumptions: sheets contain material takeoffs, not approved station/joint drawings. The existing post-height control still measures ground to top of girder. King rafters/chords and girders/ridges use the added package profiles; intermediate collars fit within listed stock lengths. Arched King and Hammer previews reuse the established per-width procedural drawings and profiles, since the sheets do not specify those style packages. Fabrication joints, exact cut lengths, brace lengths and placement remain subject to drawing review.

Stain estimates for new sizes follow their member counts and pitch. Existing size estimates are unchanged. The approved snow unit rates apply to all new lengths through the shared roof quantity calculation. Older published catalogs gain missing new rows without losing any existing override, including deliberately blank or zero prices. Admin has per-size package and option fields for these nine additions. This is a safe targeted merge; the older full-workbook upload workflow has not been redesigned and should not be used to import this workbook wholesale.

Unknown base prices display “To be quoted” in the designer and summaries. Deposits are disabled in the designer and rejected by the server before any payment service call. Offline checks cover every new footprint across all three styles and 8/9/10-foot height settings, share-link round trips, counts/positions, source totals, overrides and pending-price checkout. Browser review covers long King, Arched King and Hammer frames. No live quote email, payment, account save or admin pricing write is performed during verification.

Before publication, merged newer saved Site changes through `d2bd369`: preserved the procedural reconstruction, timber finish switching fix, post bases, undo/redo, local drafts, furniture/TV controls, quote preference and admin analytics. Repeated integration, geometry, grain, finish and build checks after the merge.

Camera presets now fit the full size and pad to viewport width and height. Projection checks cover all 21 footprints in perspective, side and top views across narrow and wide aspect ratios.


## September 18, 2026 — complete workbook size expansion

The user approved using the detailed Excel prices as written and keeping the original 3D sizes' prices. This supersedes the previous held-price decisions. All 37 detailed workbook footprints are available: the original 12 rows remain exactly unchanged, and 25 additions use all three cached roof totals rounded only to currency cents. The separate 16×20 Hammerbeam tab does not replace its existing package/upgrade pricing. Fixtures retain the original full rows and independent workbook roof totals/cell references. Source workbook SHA-256: `88f19884a6502291f94bdb722fa07b40daf1d1c2c41e54e30c7683520e5d4362`.

Added this release: 10×10, 10×14, 10×24; 18×18, 18×20 Hammerbeam, 18×32, 18×36; 22×60; 24×16, 24×24, 24×30, 24×32, 24×40; 30×34, 30×40; and 32×32. The nine previously added footprints now have all sheet roof totals. Formula issues have not been silently corrected: 30×40 duplicates the 30×34 header, takeoff and prices; 18×20 includes the source Hammerbeam calculation; the other previously flagged totals are preserved. Source notes stay visible in admin pricing.

10×10 is a prebuilt King package with a 6/12 roof. 18×20 offers the sheet's Hammerbeam package. 30×34, 30×40 and 32×32 start at the sheet's 10-foot post setting; 32×32 has a 6/12 roof. Size changes select compatible trusses and heights, and shared designs are validated against those restrictions. New width families use parametric trusses and joint plates with the sheet profiles. Curved timber members have flat faces and square edges; longitudinal grain mapping remains shared by all timbers. The 22×60 preview has fourteen posts, four trusses and twelve intermediate rafter pairs. All station positions remain symmetric visualization assumptions, not shop drawings. Existing post-height convention is retained.

Published catalogs adopt only the added sizes' approved base roof prices once using a pricing revision marker. Original retail rows and per-option administrator overrides survive; subsequent admin blanks and zero prices also survive. Unknown option upgrades still require a quote, and blank bases still block deposits. The original snow unit rates remain unchanged. Offline validation covers all 75 added roof prices, all twelve original full records, framing counts and pitch, supported style/height combinations, saved links, price adoption, camera fits, and checkout guarding.

## September 18, 2026 — wider Arched King and Hammer geometry repair

All Arched King and Hammer spans above 16 feet now use connected, dimension-driven timber profiles fitted to the same pitch and roof envelope as their rafters. The Arched King struts meet the central king/chord joint. Hammer trusses have continuous upper collars, princes, and tall curved knees matching the topology of the working 16-foot design. Timber depth stays 5.5 inches instead of stretching with span. Wider frames ignore historical piece offsets and the old 20-foot Hammer roof lift. The 10/12/14/16-foot geometry remains on its existing paths. No catalog, pricing, workbook, or commerce behavior changed.

Wide scroll-tail rafters use their actual section and birdsmouth coordinates rather than a separately scaled six-inch profile. Joint plates are trimmed to the roof envelope; outside peak plates are omitted from interior trusses. The twelve affected customer option previews were regenerated from the repaired geometry.

Validation includes 84 width/pitch/section/style combinations with actual profile-overlap connectivity, roof clearance, plate attachment, fixed timber depth, curved openings and grain mapping. Software renders of all six customer widths (18/20/22/24/30/32), both styles, plates and scroll tails were visually reviewed. Original procedural geometry and all 37 footprints/75 added roof prices/original twelve complete price records pass regression checks. Browser automation could not connect to the local preview during this repair, so interactive WebGL inspection remains unverified. Geometry remains a configurator visualization rather than certified fabrication drawings.

## September 18, 2026 — girder ends on all sizes

Replaced the distorted girder drawing and the separately attached long-pavilion caps with one continuous extruded girder. Both ends have mirrored stepped concave scrolls, sized from the beam height independently of pavilion length. Beam width and height are modeled directly. The original center positions, overall length and top elevation remain unchanged; all four ends share the same geometry for every truss style and footprint. This removes the rotated end block visible in the user's screenshot and the malformed opposite cut. Historical part drawings remain available only as references; the scene no longer uses them for its girders.

Checks cover all 37 footprints: correct stock dimensions, fixed overall length without extra caps, mirrored end silhouettes, open lower scroll corners, full-depth bearing over both end posts, finite surfaces and continuous timber grain. Software views of 7.5/9.5/11.5-inch beam depths were reviewed. TypeScript, original procedural geometry and complete size/pricing regression checks pass. The local route responds successfully, but browser automation timed out before interactive inspection. Pricing and workbook data remain unchanged.

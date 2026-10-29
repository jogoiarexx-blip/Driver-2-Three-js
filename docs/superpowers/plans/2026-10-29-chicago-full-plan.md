# Chicago full procedural plan

**Goal:** replace generic land use across Chicago with a deterministic 13-sector plan, then migrate mission locations after route validation.
**Architecture:** a pure plan describes district, land use, lot rectangles and protected legacy sites. CityBuilder consumes it before generating geometry and colliders. Rendered parcels and physics share the same rectangles. Mission starts move only after checking access to the current street network.
**Tech Stack:** buildless JS, Three.js r128, Node tests.
**Spec:** ../specs/2026-10-29-chicago-full-plan-design.md

## Constraints
- Preserve interactive sites and existing scripted routes until their replacements are tested.
- No claim of exact PS1 topology based on floor pixels.
- Cover all 13 sectors with physical content, not just labels.

## Review focus
- Road overlap: inspect each planned lot against the city road/water rules.
- Campaign regressions: protected sites remain unchanged.
- GPU lifecycle: merge decoration through existing shared pack helpers.
- Foreign cities: plan applies only to Chicago.
- Mission access: segment to a road must be dry and unblocked.

### Task 1 — district and parcel plan
- [x] Tests: 13 unique sectors, repeatability, protected sites, no lot/road intersections.
- [x] Implement js/world/chicago-city-plan.js with districtAt(x,z), parcel(x,z), lots(x,z), build(city).
- [x] Verify via node --test tests/chicago-city-plan.test.cjs.

### Task 2 — complete CityBuilder integration
- [x] Use plan in every ordinary Chicago block; replace checkerboard random parks and uniform single towers.
- [x] Build geometry and AABBs from identical lots; preserve explicit mission branches.
- [x] Run full Node suite and review all map-specific failures.

### Task 3 — mission migration gate
- [ ] Audit relocated start points against complete built collisions and existing route network.
- [ ] Relocate only certified starts; retain scripted objectives until full physical driving replays exist.
- [ ] Record the remaining route migration explicitly; do not silently claim campaign completion.

### Task 4 — publication
- [ ] Commit checked changes, publish authorized branch content, verify Pages.
- [ ] Package source ZIP with validation and limitations.

Ruling: mission relocation is deferred because whole-map source-derived streets are not yet active/certified. Moving only markers would violate the requested order and conceal incomplete routes. Whole-map UV evidence is now available for the next street reconstruction stage. This is a progress revision, not completion of the full user request.

## R15 — progress before mission migration

- [x] Extract a source-linked whole-map candidate surface graph, explicitly ungraded and unfit for automatic traffic routing.
- [x] Trace an actual marked-paving S curve, retain source pixels and source hash.
- [x] Fit its shape by a uniform similarity transform, reserve its block, rebuild three lots and verify dry full-width clearance against the current river.
- [x] Verify physical traversal in both directions in the graphics runner.
- [x] Publish R15 and verify Pages.

Placement ruling: use existing dry avenues at (-320,-80) and (-260,-160), away from the west canal. This preserves access without claiming the original geographic position. Mission relocation remains blocked by the unfinished whole-map street migration, as requested by the user.

R15 final review: independent read-only review found no critical/important issue. 603 Node tests passed. Graphics runner 40885121455 passed the Undercover step containing both source-curve physical replays and the R4-R7 regressions. The four-city aggregate was still running when the release was prepared.

## R16 — contiguous source extension

Continue the R15 source alignment northward, using the same similarity transform.
The reference's marked texture has gaps; the new trace uses observed marked OR
plain paving within a narrow inspected window, with all 119 source pixels kept.
This is an adapted source corridor, not certified source neighborhood placement.
Reserve the adjacent ordinary block (-280,-40), rebuild three physical parcels,
and leave all mission starts/objectives unchanged. The graph remains ungraded.

- [x] Source provenance, shared alignment, dry full width and lot clearance tests.
- [x] 605 Node tests pass; prior R15 tests retained.
- [x] Full joined R16/R15 physical drive in both directions in browser (workflow 40891102102, Undercover step passed).
- [x] Published R16 after graphics checks; Pages deployment verified.

R16 independent read-only review: no critical/important defects. Joined corridor length is approximately 236 world units; 124 belong to the extension. Four-city aggregate remains tracked separately from this physical corridor validation.

## R17 — close the source loop

Continue the same alignment by reconstructing the western source branch between
R16's two exact source anchors. Extract only observed marked/plain paving in the
inspected narrow western raster window, retaining source pixels and hash. The
branch runs outside the old grid's west edge; no mission site or existing parcel
is removed. Reuse validated road geometry with no new houses in the corridor.
Drive a complete closed lap in both directions, retain previous R15/R16 replays,
and capture the full circuit in a browser screenshot. Placement remains adapted;
this does not certify the remaining whole-city road network or traffic routes.

- [x] Source extraction, exact shared anchors, dry full width, existing lot clearance.
- [x] 607 Node tests passed, including R15/R16 regressions.
- [x] Whole-loop physics and browser rendering verification (40901020242, Undercover step passed).
- [x] Independent review: no critical/important issues; publication authorized.
- Pages publication status is tracked by the release Actions workflow.

R17 evidence: 123 observed source pixels, 129.04 units of new western road,
252.79 units per closed lap with R16. All seven generated network/curve files
reproduced byte-for-byte. 607 Node tests passed. The four-city aggregate is
tracked separately; this revision does not certify the complete PS1 map.

## R18 — northern source continuation and canal crossing

Extend from the R16/R17 northern source anchor through the next 180 observed
paving pixels using the same R15 similarity fit. The 187-unit continuation crosses
the legacy Undercover canal, so reconstruct a stationary convex deck around the road envelope,
small approach ramps, rendered/physical side rails and matching cuts in both
visible and collision canal walls. Use the same road plan for those cuts and
bridge physics. Deck elevation and placement are adapted to this procedural canal;
projected paving pixels do not certify the original bridge grade or neighborhood.

The corridor adds no houses and relocates no mission sites. Neighboring water
must remain deep and wet; other cities retain their existing canal/ground rules.
Retain R15-R17 physical replays and add an actual vehicle crossing in both
directions, source/deck/collision tests and a bridge screenshot before publishing.

- [x] Source trace, shared anchor, deck/rail/ground integration and foreign-city tests.
- [ ] Whole Node suite, independent review and browser bidirectional crossing.
- [ ] Publish after checks and verify Pages deployment.

R18 full-width finding: offset rails pinched the inside source bend. Replaced them
with a single convex deck footprint shared by water masking, mesh and rails, and
cut each ramp surface at its exact profile breaks. Added the full-width rail
clearance regression before repeating browser validation.

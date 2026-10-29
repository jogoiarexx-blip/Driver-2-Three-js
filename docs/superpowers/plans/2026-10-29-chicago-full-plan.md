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
- [ ] Verify physical traversal in both directions in the graphics runner, then publish.

Placement ruling: use existing dry avenues at (-320,-80) and (-260,-160), away from the west canal. This preserves access without claiming the original geographic position. Mission relocation remains blocked by the unfinished whole-map street migration, as requested by the user.

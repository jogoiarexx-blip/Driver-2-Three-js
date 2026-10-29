# Additional uploaded pedestrians

Goal: activate mendingo.glb, mulher 2.glb and mulher 3.glb already on GitHub.
Reuse existing civilian routes, crossings and dodges. Keep 28 NPC slots, original
female/male slots 0/1, and give the new models slots 2/3/4. Preserve uploaded GLBs.

Implementation: configurable existing animated pedestrian adapter plus a small
sequential-loading roster. Every model owns its rig/mixer and is detached before
city GPU disposal, then attached to the replacement slot. Failed loads leave the
procedural model visible. Female variants prefer Walking_Woman; Running is used
for crossings. Optional runtime texture resizing caps new maps at 1024 while
preserving material texture settings and replacing shared references consistently.

- [x] Failing adapter/config and roster tests, then implement slots and lifecycle.
- [x] 621 Node tests passed, including original male and female regressions.
- [x] Independent review found no blockers. Browser 40927658665 passed all five
  models in Chicago/Havana, walking/running/pause, texture caps, stable root UUIDs
  and exactly three additional GLB requests across the city change.
- Publication authorized after checks; Pages status tracked in release Actions.

Map reconstruction and mission positions remain unchanged by this update.

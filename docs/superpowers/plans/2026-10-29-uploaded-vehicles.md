# Activate uploaded vehicles

Use the existing local GLB library and independent arcade physics. Add the new
and old pickup and motorcycle as parked, enterable vehicles near the initial
north/south avenue (x=9, z=-38/-58/-78), checking water/buildings/other vehicles.
Keep existing trucks and mission targets. The motorcycle uses its own narrow
vehicle collider, modest arcade speed, procedural seated rider while controlled,
and two-wheel fallback. It is not a motorcycle simulation. Preserve its model
identity in Tanner's garage. Put the fishing boat beside Navy Pier as scenery;
there are no boat controls. Keep mission placement and source maps unchanged.

Cache each local GLB once, parse serially, cap textures at 1024, preserve original
files and shared GPU resources. Reject stale attachments after city changes or
when models are disabled. Verify actual uploads, fallback/toggle/city lifecycle,
driving and garage identity, then review and publish with existing authorization.

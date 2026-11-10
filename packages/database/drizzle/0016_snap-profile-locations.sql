-- Coarsen coordinates saved before the privacy grid existed. New writes are snapped by
-- snapToPrivacyGrid (src/location-privacy.ts); this mirrors that formula: 0.01° latitude rows
-- and a longitude step of 0.01° / cos(latitude), capped at 360°, wrapped into [-180, 180].
-- Idempotent: an already-snapped point maps to itself.
WITH raw AS (
	SELECT "user_id",
		greatest(-90, least(90, round(ST_Y("location"::geometry) / 0.01) * 0.01)) AS lat,
		ST_X("location"::geometry) AS lon
	FROM "profiles"
	WHERE "location" IS NOT NULL
), stepped AS (
	SELECT "user_id", lat, lon,
		least(360, 0.01 / greatest(cos(radians(lat)), 1e-9)) AS lon_step
	FROM raw
), snapped AS (
	SELECT "user_id", lat, round(lon / lon_step) * lon_step AS lon
	FROM stepped
)
UPDATE "profiles" AS p
SET "location" = ST_SetSRID(ST_MakePoint(
		CASE WHEN s.lon > 180 THEN s.lon - 360 WHEN s.lon < -180 THEN s.lon + 360 ELSE s.lon END,
		s.lat
	), 4326)::geography
FROM snapped AS s
WHERE p."user_id" = s."user_id";

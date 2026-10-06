ALTER TYPE "public"."onboarding_step" ADD VALUE 'DETAILS' BEFORE 'PHOTOS';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "gender_identity" varchar(40);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "pronouns" varchar(30);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_gender_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "are_pronouns_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "interested_in" varchar(24)[] DEFAULT ARRAY[]::varchar(24)[] NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "relationship_intent" varchar(32);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "location" geography(point, 4326);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "location_locality" varchar(80);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "location_region" varchar(80);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "location_country_code" varchar(2);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "height_cm" smallint;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_height_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "profiles_location_gist" ON "profiles" USING gist ("location");

CREATE TABLE "profile_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_asset_id" varchar(255) NOT NULL,
	"provider_public_id" varchar(255) NOT NULL,
	"provider_version" bigint NOT NULL,
	"format" varchar(10) NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_photos_provider_asset_id_unique" UNIQUE("provider_asset_id"),
	CONSTRAINT "profile_photos_provider_public_id_unique" UNIQUE("provider_public_id"),
	CONSTRAINT "profile_photos_user_position_unique" UNIQUE("user_id","position"),
	CONSTRAINT "profile_photos_position_check" CHECK ("profile_photos"."position" >= 0 and "profile_photos"."position" < 6),
	CONSTRAINT "profile_photos_bytes_check" CHECK ("profile_photos"."bytes" > 0 and "profile_photos"."bytes" <= 10485760),
	CONSTRAINT "profile_photos_dimensions_check" CHECK ("profile_photos"."width" >= 600 and "profile_photos"."height" >= 600),
	CONSTRAINT "profile_photos_format_check" CHECK ("profile_photos"."format" in ('jpg', 'jpeg'))
);
--> statement-breakpoint
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

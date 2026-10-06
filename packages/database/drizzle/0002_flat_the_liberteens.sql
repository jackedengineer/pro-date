CREATE TYPE "public"."onboarding_step" AS ENUM('NAME', 'BIRTHDAY', 'IDENTITY', 'PREFERENCES', 'LOCATION', 'PHOTOS', 'PROMPTS', 'REVIEW', 'COMPLETE');--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_step" "onboarding_step" DEFAULT 'NAME' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE TYPE "public"."onboarding_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_subject" varchar(255) NOT NULL,
	"onboarding_status" "onboarding_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_subject_unique" UNIQUE("clerk_subject")
);

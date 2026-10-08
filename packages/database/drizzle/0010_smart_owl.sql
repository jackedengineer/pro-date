CREATE TYPE "public"."pull_request_status" AS ENUM('PENDING', 'MERGED', 'DECLINED');--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_user_id" uuid NOT NULL,
	"second_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_pair_unique" UNIQUE("first_user_id","second_user_id"),
	CONSTRAINT "matches_ordered_pair_check" CHECK ("matches"."first_user_id" < "matches"."second_user_id")
);
--> statement-breakpoint
CREATE TABLE "profile_passes" (
	"user_id" uuid NOT NULL,
	"passed_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_passes_user_id_passed_user_id_pk" PRIMARY KEY("user_id","passed_user_id"),
	CONSTRAINT "profile_passes_no_self_check" CHECK ("profile_passes"."user_id" <> "profile_passes"."passed_user_id")
);
--> statement-breakpoint
CREATE TABLE "profile_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"reported_user_id" uuid NOT NULL,
	"reason" varchar(24) NOT NULL,
	"details" varchar(1000) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_reports_reporter_target_unique" UNIQUE("reporter_user_id","reported_user_id"),
	CONSTRAINT "profile_reports_reason_check" CHECK ("profile_reports"."reason" in ('HARASSMENT', 'INAPPROPRIATE_CONTENT', 'SPAM', 'UNDERAGE', 'OTHER')),
	CONSTRAINT "profile_reports_no_self_check" CHECK ("profile_reports"."reporter_user_id" <> "profile_reports"."reported_user_id")
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"target_type" varchar(6) NOT NULL,
	"target_id" uuid NOT NULL,
	"photo_public_id" varchar(255),
	"photo_version" bigint,
	"prompt_id" varchar(64),
	"prompt_answer" varchar(280),
	"comment" varchar(280) DEFAULT '' NOT NULL,
	"status" "pull_request_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "pull_requests_sender_recipient_unique" UNIQUE("sender_user_id","recipient_user_id"),
	CONSTRAINT "pull_requests_no_self_check" CHECK ("pull_requests"."sender_user_id" <> "pull_requests"."recipient_user_id"),
	CONSTRAINT "pull_requests_target_check" CHECK (("pull_requests"."target_type" = 'PHOTO' and "pull_requests"."photo_public_id" is not null and "pull_requests"."photo_version" > 0 and "pull_requests"."prompt_id" is null and "pull_requests"."prompt_answer" is null) or ("pull_requests"."target_type" = 'PROMPT' and "pull_requests"."prompt_id" is not null and "pull_requests"."prompt_answer" is not null and "pull_requests"."photo_public_id" is null and "pull_requests"."photo_version" is null))
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_user_id_blocked_user_id_pk" PRIMARY KEY("user_id","blocked_user_id"),
	CONSTRAINT "user_blocks_no_self_check" CHECK ("user_blocks"."user_id" <> "user_blocks"."blocked_user_id")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_first_user_id_users_id_fk" FOREIGN KEY ("first_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_second_user_id_users_id_fk" FOREIGN KEY ("second_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_passes" ADD CONSTRAINT "profile_passes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_passes" ADD CONSTRAINT "profile_passes_passed_user_id_users_id_fk" FOREIGN KEY ("passed_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_reports" ADD CONSTRAINT "profile_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_reports" ADD CONSTRAINT "profile_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_second_user_idx" ON "matches" USING btree ("second_user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "pull_requests_inbox_idx" ON "pull_requests" USING btree ("recipient_user_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "user_blocks_reverse_idx" ON "user_blocks" USING btree ("blocked_user_id","user_id");
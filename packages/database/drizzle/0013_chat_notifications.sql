CREATE TABLE "conversation_notification_preferences" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "conversation_notification_preferences_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id"),
	CONSTRAINT "conversation_notification_revision_check" CHECK ("conversation_notification_preferences"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "message_notification_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"settings_revision" integer NOT NULL,
	"preference_revision" integer NOT NULL,
	"device_generation" integer NOT NULL,
	"status" varchar(12) DEFAULT 'PENDING' NOT NULL,
	"attempt_count" smallint DEFAULT 0 NOT NULL,
	"claim_id" uuid,
	"leased_until" timestamp with time zone,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"terminal_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_jobs_message_device_unique" UNIQUE("message_id","device_id"),
	CONSTRAINT "notification_jobs_status_check" CHECK ("message_notification_jobs"."status" in ('PENDING', 'LEASED', 'ACCEPTED', 'CANCELLED', 'EXPIRED', 'FAILED')),
	CONSTRAINT "notification_jobs_attempt_check" CHECK ("message_notification_jobs"."attempt_count" between 0 and 8),
	CONSTRAINT "notification_jobs_revision_check" CHECK ("message_notification_jobs"."settings_revision" >= 0 and "message_notification_jobs"."preference_revision" > 0 and "message_notification_jobs"."device_generation" > 0)
);
--> statement-breakpoint
CREATE TABLE "notification_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt_number" smallint NOT NULL,
	"outcome" varchar(16) DEFAULT 'STARTED' NOT NULL,
	"error_code" varchar(40),
	"ticket_id" varchar(128),
	"receipt_status" varchar(12),
	"receipt_due_at" timestamp with time zone,
	"receipt_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_attempts_job_number_unique" UNIQUE("job_id","attempt_number"),
	CONSTRAINT "notification_attempts_number_check" CHECK ("notification_attempts"."attempt_number" between 1 and 8),
	CONSTRAINT "notification_attempts_outcome_check" CHECK ("notification_attempts"."outcome" in ('STARTED', 'ACCEPTED', 'RETRYABLE', 'UNKNOWN', 'FAILED')),
	CONSTRAINT "notification_attempts_receipt_check" CHECK ("notification_attempts"."receipt_status" is null or "notification_attempts"."receipt_status" in ('PENDING', 'OK', 'ERROR', 'EXPIRED'))
);
--> statement-breakpoint
CREATE TABLE "notification_devices" (
	"installation_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"secret_hash" varchar(64) NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"token" varchar(256),
	"platform" varchar(7) NOT NULL,
	"project_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_operation_id" uuid NOT NULL,
	"last_request_hash" varchar(64) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_devices_generation_check" CHECK ("notification_devices"."generation" > 0),
	CONSTRAINT "notification_devices_platform_check" CHECK ("notification_devices"."platform" in ('ios', 'android')),
	CONSTRAINT "notification_devices_hash_check" CHECK ("notification_devices"."secret_hash" ~ '^[a-f0-9]{64}$' and "notification_devices"."last_request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "notification_devices_revocation_check" CHECK ("notification_devices"."revoked_at" is null or "notification_devices"."token" is null)
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "notification_settings_revision_check" CHECK ("notification_settings"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "conversation_notification_preferences" ADD CONSTRAINT "conversation_notification_preferences_conversation_id_matches_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_notification_preferences" ADD CONSTRAINT "conversation_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_notification_jobs" ADD CONSTRAINT "message_notification_jobs_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_notification_jobs" ADD CONSTRAINT "message_notification_jobs_device_id_notification_devices_installation_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."notification_devices"("installation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_notification_jobs" ADD CONSTRAINT "message_notification_jobs_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_attempts" ADD CONSTRAINT "notification_attempts_job_id_message_notification_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."message_notification_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_jobs_pending_idx" ON "message_notification_jobs" USING btree ("status","next_attempt_at","leased_until");--> statement-breakpoint
CREATE INDEX "notification_jobs_recipient_idx" ON "message_notification_jobs" USING btree ("recipient_id","status");--> statement-breakpoint
CREATE INDEX "notification_attempts_receipt_idx" ON "notification_attempts" USING btree ("receipt_status","receipt_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_devices_active_token_unique" ON "notification_devices" USING btree ("token") WHERE "notification_devices"."token" is not null;--> statement-breakpoint
CREATE INDEX "notification_devices_owner_idx" ON "notification_devices" USING btree ("owner_id","expires_at");
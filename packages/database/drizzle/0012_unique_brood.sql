CREATE TABLE "message_outbox" (
	"message_id" uuid PRIMARY KEY NOT NULL,
	"leased_until" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "messages_sender_intent_unique" UNIQUE("sender_id","client_id"),
	CONSTRAINT "messages_conversation_sequence_unique" UNIQUE("conversation_id","sequence"),
	CONSTRAINT "messages_body_check" CHECK (char_length(btrim("messages"."body")) between 1 and 2000),
	CONSTRAINT "messages_sequence_check" CHECK ("messages"."sequence" > 0)
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "last_message_sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "unmatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_matches_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_outbox_pending_idx" ON "message_outbox" USING btree ("published_at","leased_until");--> statement-breakpoint
CREATE INDEX "messages_sender_created_idx" ON "messages" USING btree ("sender_id","created_at");
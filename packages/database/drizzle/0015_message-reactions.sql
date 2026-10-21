CREATE TABLE "conversation_interactions" (
	"conversation_id" uuid PRIMARY KEY NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "conversation_interactions_revision_check" CHECK ("conversation_interactions"."revision" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "message_interaction_events" (
	"conversation_id" uuid NOT NULL,
	"revision" bigint NOT NULL,
	"message_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"leased_until" timestamp with time zone,
	"published_at" timestamp with time zone,
	CONSTRAINT "message_interaction_events_conversation_id_revision_pk" PRIMARY KEY("conversation_id","revision"),
	CONSTRAINT "interaction_events_revision_check" CHECK ("message_interaction_events"."revision" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"conversation_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(8),
	"revision" bigint NOT NULL,
	"changed_revision" bigint NOT NULL,
	CONSTRAINT "message_reactions_message_id_user_id_pk" PRIMARY KEY("message_id","user_id"),
	CONSTRAINT "message_reactions_kind_check" CHECK ("message_reactions"."kind" is null or "message_reactions"."kind" in ('HEART','LAUGH','LOVE','FIRE','CLAP','LIKE')),
	CONSTRAINT "message_reactions_revision_check" CHECK ("message_reactions"."revision" between 1 and 9007199254740991 and "message_reactions"."changed_revision" between 1 and 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "conversation_interactions" ADD CONSTRAINT "conversation_interactions_conversation_id_matches_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_interaction_events" ADD CONSTRAINT "message_interaction_events_conversation_id_matches_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_interaction_events" ADD CONSTRAINT "message_interaction_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_interaction_events" ADD CONSTRAINT "message_interaction_events_conversation_id_message_id_messages_conversation_id_id_fk" FOREIGN KEY ("conversation_id","message_id") REFERENCES "public"."messages"("conversation_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_conversation_id_message_id_messages_conversation_id_id_fk" FOREIGN KEY ("conversation_id","message_id") REFERENCES "public"."messages"("conversation_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interaction_events_pending_idx" ON "message_interaction_events" USING btree ("published_at","leased_until");--> statement-breakpoint
CREATE INDEX "interaction_events_actor_created_idx" ON "message_interaction_events" USING btree ("actor_id","created_at");
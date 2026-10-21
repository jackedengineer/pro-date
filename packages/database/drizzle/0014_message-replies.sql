CREATE TABLE "message_replies" (
	"message_id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"reply_to_message_id" uuid NOT NULL,
	CONSTRAINT "message_replies_no_self_check" CHECK ("message_replies"."message_id" <> "message_replies"."reply_to_message_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_unique" UNIQUE("conversation_id","id");--> statement-breakpoint
ALTER TABLE "message_replies" ADD CONSTRAINT "message_replies_conversation_id_message_id_messages_conversation_id_id_fk" FOREIGN KEY ("conversation_id","message_id") REFERENCES "public"."messages"("conversation_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_replies" ADD CONSTRAINT "message_replies_conversation_id_reply_to_message_id_messages_conversation_id_id_fk" FOREIGN KEY ("conversation_id","reply_to_message_id") REFERENCES "public"."messages"("conversation_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

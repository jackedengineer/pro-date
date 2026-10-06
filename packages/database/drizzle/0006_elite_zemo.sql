CREATE TABLE "profile_prompt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt_id" varchar(64) NOT NULL,
	"answer" varchar(280) NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_prompt_answers_user_prompt_unique" UNIQUE("user_id","prompt_id"),
	CONSTRAINT "profile_prompt_answers_user_position_unique" UNIQUE("user_id","position"),
	CONSTRAINT "profile_prompt_answers_position_check" CHECK ("profile_prompt_answers"."position" >= 0 and "profile_prompt_answers"."position" < 3)
);
--> statement-breakpoint
ALTER TABLE "profile_prompt_answers" ADD CONSTRAINT "profile_prompt_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
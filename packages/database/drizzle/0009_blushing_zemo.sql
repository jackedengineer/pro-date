ALTER TABLE "profile_prompt_answers" DROP CONSTRAINT "profile_prompt_answers_answer_length_check";--> statement-breakpoint
ALTER TABLE "profile_prompt_answers" ADD CONSTRAINT "profile_prompt_answers_answer_shape_check" CHECK (char_length(btrim("profile_prompt_answers"."answer")) >= 30 or array_length(regexp_split_to_array(btrim("profile_prompt_answers"."answer"), '[[:space:]]+'), 1) >= 5);

CREATE TABLE "agent" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_dataset" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"name" text NOT NULL,
	"cases" jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_version" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "prompt_version_agent_id_version_uq" UNIQUE("agent_id","version")
);
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_dataset" ADD CONSTRAINT "eval_dataset_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_version" ADD CONSTRAINT "prompt_version_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prompt_version_agent_id_version_idx" ON "prompt_version" USING btree ("agent_id","version" DESC NULLS LAST);
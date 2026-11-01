ALTER TABLE "declarations_beneficiaires" DROP CONSTRAINT "declarations_beneficiaires_repondant_id_repondants_id_fk";
--> statement-breakpoint
ALTER TABLE "declarations_beneficiaires" ALTER COLUMN "repondant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "declarations_beneficiaires" ADD CONSTRAINT "declarations_beneficiaires_repondant_id_repondants_id_fk" FOREIGN KEY ("repondant_id") REFERENCES "public"."repondants"("id") ON DELETE set null ON UPDATE no action;
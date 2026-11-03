ALTER TABLE "utilisateurs" ADD COLUMN "mfa_methode" text;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN "mfa_code_empreinte" text;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN "mfa_code_expire_le" timestamp with time zone;
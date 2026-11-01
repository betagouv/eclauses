CREATE TABLE "audit_admin" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_admin_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"utilisateur_id" integer,
	"email" text NOT NULL,
	"action" text NOT NULL,
	"entite" text NOT NULL,
	"entite_id" text,
	"details" jsonb,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codes_secours" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "codes_secours_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"utilisateur_id" integer NOT NULL,
	"empreinte" text NOT NULL,
	"utilise_le" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mfa_valide_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN "totp_secret_chiffre" text;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN "totp_active_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN "totp_dernier_pas" integer;--> statement-breakpoint
ALTER TABLE "audit_admin" ADD CONSTRAINT "audit_admin_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes_secours" ADD CONSTRAINT "codes_secours_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_admin_date_idx" ON "audit_admin" USING btree ("cree_le");--> statement-breakpoint
CREATE INDEX "audit_admin_entite_idx" ON "audit_admin" USING btree ("entite","entite_id");--> statement-breakpoint
CREATE INDEX "codes_secours_utilisateur_idx" ON "codes_secours" USING btree ("utilisateur_id");
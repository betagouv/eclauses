ALTER TYPE "public"."statut_declaration" ADD VALUE 'brouillon';--> statement-breakpoint
ALTER TYPE "public"."statut_marche" ADD VALUE 'en_attente_publication' BEFORE 'en_attente_notification';
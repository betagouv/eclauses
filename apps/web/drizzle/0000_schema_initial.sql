CREATE TYPE "public"."audience" AS ENUM('public', 'beneficiaire', 'acheteur', 'repondant');--> statement-breakpoint
CREATE TYPE "public"."categorie_acheteur" AS ENUM('administration_centrale', 'services_a_competence_nationale', 'services_deconcentres', 'operateurs_etablissements_publics');--> statement-breakpoint
CREATE TYPE "public"."objectif_jeton" AS ENUM('activation', 'reinitialisation');--> statement-breakpoint
CREATE TYPE "public"."statut_declaration" AS ENUM('declare', 'valide');--> statement-breakpoint
CREATE TYPE "public"."statut_invitation" AS ENUM('en_attente', 'traitee');--> statement-breakpoint
CREATE TYPE "public"."statut_marche" AS ENUM('en_attente_notification', 'en_attente_declaration', 'declaration_a_valider', 'clause_validee', 'archive');--> statement-breakpoint
CREATE TYPE "public"."type_indicateur" AS ENUM('utilisable', 'utilise', 'utile', 'impactant');--> statement-breakpoint
CREATE TYPE "public"."zone_lien" AS ENUM('entete', 'pied', 'pied_bas');--> statement-breakpoint
CREATE TABLE "fichiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cle" text NOT NULL,
	"nom_original" text NOT NULL,
	"type_mime" text NOT NULL,
	"taille" integer NOT NULL,
	"sha256" text NOT NULL,
	"usage" text NOT NULL,
	"cree_par_utilisateur_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fichiers_cle_unique" UNIQUE("cle")
);
--> statement-breakpoint
CREATE TABLE "jetons_auth" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jetons_auth_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"utilisateur_id" integer NOT NULL,
	"objectif" "objectif_jeton" NOT NULL,
	"empreinte" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"utilise_le" timestamp with time zone,
	CONSTRAINT "jetons_auth_empreinte_unique" UNIQUE("empreinte")
);
--> statement-breakpoint
CREATE TABLE "notifications_envoyees" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_envoyees_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"evenement" text NOT NULL,
	"cle" text NOT NULL,
	"envoye_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"empreinte" text PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"revoque_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "utilisateurs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "utilisateurs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"mot_de_passe_hash" text,
	"est_admin" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"mot_de_passe_modifie_le" timestamp with time zone,
	"derniere_connexion_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clauses_sociales" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clauses_sociales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"nom" text NOT NULL,
	"gabarit_article" text,
	"gabarit_annuaire_html" text,
	CONSTRAINT "clauses_sociales_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "departements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "departements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"numero" text NOT NULL,
	"nom" text NOT NULL,
	"region_id" integer,
	"libelle_affichage" text,
	"chef_lieu" text,
	"villes_principales" text,
	"superficie_km2" double precision,
	"population2023" integer,
	"densite_hab_km2" double precision,
	"latitude" double precision,
	"longitude" double precision,
	"adresse_geocodee" text,
	CONSTRAINT "departements_gristId_unique" UNIQUE("grist_id"),
	CONSTRAINT "departements_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "formations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "formations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"intitule" text NOT NULL,
	CONSTRAINT "formations_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "regions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"intitule" text NOT NULL,
	"chef_lieu" text,
	"latitude" double precision,
	"longitude" double precision,
	"adresse_geocodee" text,
	CONSTRAINT "regions_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "specialites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "specialites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"intitule" text NOT NULL,
	"clause_id" integer,
	"infobulle" text,
	CONSTRAINT "specialites_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "acheteurs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "acheteurs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"nom" text NOT NULL,
	"ministere" text,
	"categorie" "categorie_acheteur",
	CONSTRAINT "acheteurs_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "beneficiaire_clauses" (
	"beneficiaire_id" integer NOT NULL,
	"clause_id" integer NOT NULL,
	CONSTRAINT "beneficiaire_clauses_beneficiaire_id_clause_id_pk" PRIMARY KEY("beneficiaire_id","clause_id")
);
--> statement-breakpoint
CREATE TABLE "beneficiaire_departements" (
	"beneficiaire_id" integer NOT NULL,
	"departement_id" integer NOT NULL,
	CONSTRAINT "beneficiaire_departements_beneficiaire_id_departement_id_pk" PRIMARY KEY("beneficiaire_id","departement_id")
);
--> statement-breakpoint
CREATE TABLE "beneficiaire_regions" (
	"beneficiaire_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	CONSTRAINT "beneficiaire_regions_beneficiaire_id_region_id_pk" PRIMARY KEY("beneficiaire_id","region_id")
);
--> statement-breakpoint
CREATE TABLE "beneficiaire_specialites" (
	"beneficiaire_id" integer NOT NULL,
	"specialite_id" integer NOT NULL,
	CONSTRAINT "beneficiaire_specialites_beneficiaire_id_specialite_id_pk" PRIMARY KEY("beneficiaire_id","specialite_id")
);
--> statement-breakpoint
CREATE TABLE "beneficiaires" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "beneficiaires_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"utilisateur_id" integer,
	"nom" text NOT NULL,
	"prenom" text,
	"telephone" text,
	"formation_id" integer,
	"autre_formation" text,
	"annee_diplome" integer,
	"date_diplomation" date GENERATED ALWAYS AS (make_date(annee_diplome, 9, 15)) STORED,
	"specialite_ecole" text,
	"sous_specialite" text,
	"intitule_memoire" text,
	"autres_informations" text,
	"missions_proposees" text,
	"commentaire" text,
	"cv_fichier_id" uuid,
	"consentement_annuaire" boolean DEFAULT false NOT NULL,
	"consentement_contact_groupements" boolean DEFAULT false NOT NULL,
	"alumni" boolean DEFAULT false NOT NULL,
	"fiche_a_jour" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymise_le" date,
	CONSTRAINT "beneficiaires_gristId_unique" UNIQUE("grist_id"),
	CONSTRAINT "beneficiaires_utilisateurId_unique" UNIQUE("utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "repondants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "repondants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"utilisateur_id" integer,
	"nom" text,
	"prenom" text,
	"telephone" text,
	"raison_sociale" text,
	"siret" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymise_le" date,
	CONSTRAINT "repondants_gristId_unique" UNIQUE("grist_id"),
	CONSTRAINT "repondants_utilisateurId_unique" UNIQUE("utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "utilisateurs_acheteurs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "utilisateurs_acheteurs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"utilisateur_id" integer NOT NULL,
	"acheteur_id" integer NOT NULL,
	"nom" text NOT NULL,
	"prenom" text,
	CONSTRAINT "utilisateurs_acheteurs_gristId_unique" UNIQUE("grist_id"),
	CONSTRAINT "utilisateurs_acheteurs_utilisateurId_unique" UNIQUE("utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "acces_coordonnees" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "acces_coordonnees_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"repondant_id" integer NOT NULL,
	"marche_id" integer NOT NULL,
	"beneficiaire_id" integer NOT NULL,
	"affiche_email" boolean DEFAULT false NOT NULL,
	"affiche_telephone" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acces_coordonnees_gristId_unique" UNIQUE("grist_id"),
	CONSTRAINT "acces_coordonnees_unique" UNIQUE("repondant_id","marche_id","beneficiaire_id")
);
--> statement-breakpoint
CREATE TABLE "candidatures" (
	"marche_id" integer NOT NULL,
	"repondant_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidatures_marche_id_repondant_id_pk" PRIMARY KEY("marche_id","repondant_id")
);
--> statement-breakpoint
CREATE TABLE "declarations_beneficiaires" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "declarations_beneficiaires_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"repondant_id" integer NOT NULL,
	"marche_id" integer NOT NULL,
	"est_beneficiaire_eclauses" boolean DEFAULT false NOT NULL,
	"beneficiaire_id" integer,
	"nom" text,
	"prenom" text,
	"email" text,
	"statut" "statut_declaration" DEFAULT 'declare' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "declarations_beneficiaires_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "declarations_refus" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "declarations_refus_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"marche_id" integer NOT NULL,
	"refuse_le" timestamp with time zone DEFAULT now() NOT NULL,
	"refuse_par_utilisateur_id" integer,
	"raison" text,
	CONSTRAINT "declarations_refus_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "interets_marches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "interets_marches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"marche_id" integer NOT NULL,
	"beneficiaire_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interets_marche_beneficiaire_unique" UNIQUE("marche_id","beneficiaire_id")
);
--> statement-breakpoint
CREATE TABLE "invitations_titulaires" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invitations_titulaires_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"marche_id" integer NOT NULL,
	"email" text NOT NULL,
	"statut" "statut_invitation" DEFAULT 'en_attente' NOT NULL,
	"repondant_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"traite_le" timestamp with time zone,
	"derniere_relance_le" timestamp with time zone,
	CONSTRAINT "invitations_titulaires_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "marche_beneficiaires" (
	"marche_id" integer NOT NULL,
	"beneficiaire_id" integer NOT NULL,
	CONSTRAINT "marche_beneficiaires_marche_id_beneficiaire_id_pk" PRIMARY KEY("marche_id","beneficiaire_id")
);
--> statement-breakpoint
CREATE TABLE "marche_specialites" (
	"marche_id" integer NOT NULL,
	"specialite_id" integer NOT NULL,
	CONSTRAINT "marche_specialites_marche_id_specialite_id_pk" PRIMARY KEY("marche_id","specialite_id")
);
--> statement-breakpoint
CREATE TABLE "marches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "marches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"parent_id" integer,
	"acheteur_id" integer NOT NULL,
	"intitule" text NOT NULL,
	"numero_lot" text,
	"intitule_lot" text,
	"clause_id" integer,
	"statut" "statut_marche" DEFAULT 'en_attente_notification' NOT NULL,
	"titulaire_id" integer,
	"lien_documents" text,
	"date_publication" date,
	"date_limite_offres" date,
	"date_notification_previsionnelle" date,
	"date_fin_execution" date,
	"lieu_execution" text,
	"latitude" double precision,
	"longitude" double precision,
	"adresse_geocodee" text,
	"lots_lieux_differents" boolean DEFAULT false NOT NULL,
	"lots_clauses_differentes" boolean DEFAULT false NOT NULL,
	"suivi" text[],
	"creation_en_autonomie" boolean DEFAULT false NOT NULL,
	"cree_par_utilisateur_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marches_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "faq_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "faq_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"titre" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"ordre" integer DEFAULT 0 NOT NULL,
	"publie" boolean DEFAULT false NOT NULL,
	CONSTRAINT "faq_categories_gristId_unique" UNIQUE("grist_id"),
	CONSTRAINT "faq_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "faq_questions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "faq_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"categorie_id" integer,
	"clause_id" integer,
	"question" text NOT NULL,
	"reponse" text NOT NULL,
	"mots_cles" text,
	"audience" "audience" DEFAULT 'public' NOT NULL,
	"auteur" text,
	"ordre" integer DEFAULT 0 NOT NULL,
	"publie" boolean DEFAULT false NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faq_questions_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "impacts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "impacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"libelle" text NOT NULL,
	"description" text,
	"type_indicateur" "type_indicateur" NOT NULL,
	"valeur_manuelle" text,
	"valeur_automatique" text,
	"largeur_colonnes" integer DEFAULT 1 NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "impacts_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "liens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "liens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"zone" "zone_lien" NOT NULL,
	"libelle" text NOT NULL,
	"url" text NOT NULL,
	"variante" text,
	"externe" boolean DEFAULT false NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "liens_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
CREATE TABLE "parametres" (
	"cle" text PRIMARY KEY NOT NULL,
	"valeur" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_videos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "support_videos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grist_id" integer,
	"clause_id" integer,
	"libelle" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"audience" "audience" DEFAULT 'public' NOT NULL,
	"auteur" text,
	"ordre" integer DEFAULT 0 NOT NULL,
	"publie" boolean DEFAULT false NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_videos_gristId_unique" UNIQUE("grist_id")
);
--> statement-breakpoint
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_cree_par_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jetons_auth" ADD CONSTRAINT "jetons_auth_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departements" ADD CONSTRAINT "departements_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialites" ADD CONSTRAINT "specialites_clause_id_clauses_sociales_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."clauses_sociales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaire_clauses" ADD CONSTRAINT "beneficiaire_clauses_beneficiaire_id_beneficiaires_id_fk" FOREIGN KEY ("beneficiaire_id") REFERENCES "public"."beneficiaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaire_clauses" ADD CONSTRAINT "beneficiaire_clauses_clause_id_clauses_sociales_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."clauses_sociales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaire_departements" ADD CONSTRAINT "beneficiaire_departements_beneficiaire_id_beneficiaires_id_fk" FOREIGN KEY ("beneficiaire_id") REFERENCES "public"."beneficiaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaire_departements" ADD CONSTRAINT "beneficiaire_departements_departement_id_departements_id_fk" FOREIGN KEY ("departement_id") REFERENCES "public"."departements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaire_regions" ADD CONSTRAINT "beneficiaire_regions_beneficiaire_id_beneficiaires_id_fk" FOREIGN KEY ("beneficiaire_id") REFERENCES "public"."beneficiaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaire_regions" ADD CONSTRAINT "beneficiaire_regions_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaire_specialites" ADD CONSTRAINT "beneficiaire_specialites_beneficiaire_id_beneficiaires_id_fk" FOREIGN KEY ("beneficiaire_id") REFERENCES "public"."beneficiaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaire_specialites" ADD CONSTRAINT "beneficiaire_specialites_specialite_id_specialites_id_fk" FOREIGN KEY ("specialite_id") REFERENCES "public"."specialites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaires" ADD CONSTRAINT "beneficiaires_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaires" ADD CONSTRAINT "beneficiaires_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beneficiaires" ADD CONSTRAINT "beneficiaires_cv_fichier_id_fichiers_id_fk" FOREIGN KEY ("cv_fichier_id") REFERENCES "public"."fichiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repondants" ADD CONSTRAINT "repondants_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilisateurs_acheteurs" ADD CONSTRAINT "utilisateurs_acheteurs_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilisateurs_acheteurs" ADD CONSTRAINT "utilisateurs_acheteurs_acheteur_id_acheteurs_id_fk" FOREIGN KEY ("acheteur_id") REFERENCES "public"."acheteurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acces_coordonnees" ADD CONSTRAINT "acces_coordonnees_repondant_id_repondants_id_fk" FOREIGN KEY ("repondant_id") REFERENCES "public"."repondants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acces_coordonnees" ADD CONSTRAINT "acces_coordonnees_marche_id_marches_id_fk" FOREIGN KEY ("marche_id") REFERENCES "public"."marches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acces_coordonnees" ADD CONSTRAINT "acces_coordonnees_beneficiaire_id_beneficiaires_id_fk" FOREIGN KEY ("beneficiaire_id") REFERENCES "public"."beneficiaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidatures" ADD CONSTRAINT "candidatures_marche_id_marches_id_fk" FOREIGN KEY ("marche_id") REFERENCES "public"."marches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidatures" ADD CONSTRAINT "candidatures_repondant_id_repondants_id_fk" FOREIGN KEY ("repondant_id") REFERENCES "public"."repondants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "declarations_beneficiaires" ADD CONSTRAINT "declarations_beneficiaires_repondant_id_repondants_id_fk" FOREIGN KEY ("repondant_id") REFERENCES "public"."repondants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "declarations_beneficiaires" ADD CONSTRAINT "declarations_beneficiaires_marche_id_marches_id_fk" FOREIGN KEY ("marche_id") REFERENCES "public"."marches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "declarations_beneficiaires" ADD CONSTRAINT "declarations_beneficiaires_beneficiaire_id_beneficiaires_id_fk" FOREIGN KEY ("beneficiaire_id") REFERENCES "public"."beneficiaires"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "declarations_refus" ADD CONSTRAINT "declarations_refus_marche_id_marches_id_fk" FOREIGN KEY ("marche_id") REFERENCES "public"."marches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "declarations_refus" ADD CONSTRAINT "declarations_refus_refuse_par_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("refuse_par_utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interets_marches" ADD CONSTRAINT "interets_marches_marche_id_marches_id_fk" FOREIGN KEY ("marche_id") REFERENCES "public"."marches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interets_marches" ADD CONSTRAINT "interets_marches_beneficiaire_id_beneficiaires_id_fk" FOREIGN KEY ("beneficiaire_id") REFERENCES "public"."beneficiaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations_titulaires" ADD CONSTRAINT "invitations_titulaires_marche_id_marches_id_fk" FOREIGN KEY ("marche_id") REFERENCES "public"."marches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations_titulaires" ADD CONSTRAINT "invitations_titulaires_repondant_id_repondants_id_fk" FOREIGN KEY ("repondant_id") REFERENCES "public"."repondants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marche_beneficiaires" ADD CONSTRAINT "marche_beneficiaires_marche_id_marches_id_fk" FOREIGN KEY ("marche_id") REFERENCES "public"."marches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marche_beneficiaires" ADD CONSTRAINT "marche_beneficiaires_beneficiaire_id_beneficiaires_id_fk" FOREIGN KEY ("beneficiaire_id") REFERENCES "public"."beneficiaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marche_specialites" ADD CONSTRAINT "marche_specialites_marche_id_marches_id_fk" FOREIGN KEY ("marche_id") REFERENCES "public"."marches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marche_specialites" ADD CONSTRAINT "marche_specialites_specialite_id_specialites_id_fk" FOREIGN KEY ("specialite_id") REFERENCES "public"."specialites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marches" ADD CONSTRAINT "marches_parent_id_marches_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."marches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marches" ADD CONSTRAINT "marches_acheteur_id_acheteurs_id_fk" FOREIGN KEY ("acheteur_id") REFERENCES "public"."acheteurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marches" ADD CONSTRAINT "marches_clause_id_clauses_sociales_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."clauses_sociales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marches" ADD CONSTRAINT "marches_titulaire_id_repondants_id_fk" FOREIGN KEY ("titulaire_id") REFERENCES "public"."repondants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marches" ADD CONSTRAINT "marches_cree_par_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_questions" ADD CONSTRAINT "faq_questions_categorie_id_faq_categories_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."faq_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_questions" ADD CONSTRAINT "faq_questions_clause_id_clauses_sociales_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."clauses_sociales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_videos" ADD CONSTRAINT "support_videos_clause_id_clauses_sociales_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."clauses_sociales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jetons_auth_utilisateur_idx" ON "jetons_auth" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_evenement_cle_unique" ON "notifications_envoyees" USING btree ("evenement","cle");--> statement-breakpoint
CREATE INDEX "sessions_utilisateur_idx" ON "sessions" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE UNIQUE INDEX "utilisateurs_email_unique" ON "utilisateurs" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "beneficiaire_clauses_clause_idx" ON "beneficiaire_clauses" USING btree ("clause_id");--> statement-breakpoint
CREATE INDEX "beneficiaire_departements_dep_idx" ON "beneficiaire_departements" USING btree ("departement_id");--> statement-breakpoint
CREATE INDEX "beneficiaire_regions_region_idx" ON "beneficiaire_regions" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "beneficiaire_specialites_spec_idx" ON "beneficiaire_specialites" USING btree ("specialite_id");--> statement-breakpoint
CREATE INDEX "beneficiaires_formation_idx" ON "beneficiaires" USING btree ("formation_id");--> statement-breakpoint
CREATE INDEX "candidatures_repondant_idx" ON "candidatures" USING btree ("repondant_id");--> statement-breakpoint
CREATE INDEX "declarations_marche_idx" ON "declarations_beneficiaires" USING btree ("marche_id");--> statement-breakpoint
CREATE INDEX "declarations_repondant_idx" ON "declarations_beneficiaires" USING btree ("repondant_id");--> statement-breakpoint
CREATE INDEX "declarations_refus_marche_idx" ON "declarations_refus" USING btree ("marche_id");--> statement-breakpoint
CREATE INDEX "invitations_marche_idx" ON "invitations_titulaires" USING btree ("marche_id");--> statement-breakpoint
CREATE INDEX "marche_beneficiaires_benef_idx" ON "marche_beneficiaires" USING btree ("beneficiaire_id");--> statement-breakpoint
CREATE INDEX "marches_parent_idx" ON "marches" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "marches_acheteur_idx" ON "marches" USING btree ("acheteur_id");--> statement-breakpoint
CREATE INDEX "marches_titulaire_idx" ON "marches" USING btree ("titulaire_id");--> statement-breakpoint
CREATE INDEX "marches_statut_idx" ON "marches" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "faq_questions_categorie_idx" ON "faq_questions" USING btree ("categorie_id");
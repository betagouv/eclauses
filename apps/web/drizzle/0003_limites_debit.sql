CREATE TABLE "limites_debit" (
	"cle" text PRIMARY KEY NOT NULL,
	"compteur" integer NOT NULL,
	"fin_fenetre" timestamp with time zone NOT NULL
);

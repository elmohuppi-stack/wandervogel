CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"active" text DEFAULT 'yes' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('admin', 'user')),
	CONSTRAINT "users_active_check" CHECK ("users"."active" in ('yes', 'no'))
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
/*
  Von Hand ergänzt — ohne diese Zeile scheitert der Fremdschlüssel darunter.

  Vor der Anmeldung gehörten alle Touren der Konstanten SINGLE_OWNER_ID aus
  lib/server/owner.ts. Diese Kennung ist kein Nutzer, also verletzt jede
  vorhandene Tour sofort den neuen Fremdschlüssel. Hier entsteht deshalb ein
  Übergangskonto, das die Touren hält, bis `make db-admin` den ersten echten
  Admin anlegt und sie übernimmt.

  Es ist ausdrücklich nicht anmeldbar: `active = 'no'` sperrt den Zugang, und
  `!` ist kein gültiger scrypt-Hash — die Prüfung in lib/server/auth.ts
  scheitert daran, bevor sie ein Passwort vergleicht. Beides zusammen, damit
  ein einzelner Fehler es nicht öffnet.

  ON CONFLICT DO NOTHING: eine frische Datenbank ohne Touren braucht die Zeile
  nicht, und die Migration soll dort trotzdem durchlaufen.
*/
INSERT INTO "users" ("id", "username", "display_name", "password_hash", "role", "active")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'uebernahme',
  'Touren aus der Zeit vor der Anmeldung',
  '!',
  'user',
  'no'
) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
-- PostGIS muss stehen, bevor eine geometry-Spalte angelegt werden kann.
-- Das verwendete Image bringt die Erweiterung mit; ein blankes Postgres
-- nicht. Deshalb hier und nicht als Voraussetzung im Kopf eines Menschen.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TABLE "tours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"activity_type" text NOT NULL,
	"date" text,
	"note" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"waypoints" jsonb NOT NULL,
	"geom" geometry(LineStringZ, 4326) NOT NULL,
	"geom_overview" geometry(LineString, 4326) NOT NULL,
	"distance_m" double precision NOT NULL,
	"ascent_m" double precision NOT NULL,
	"descent_m" double precision NOT NULL,
	"duration_s" double precision NOT NULL,
	"min_ele_m" double precision NOT NULL,
	"max_ele_m" double precision NOT NULL,
	"min_lon" double precision NOT NULL,
	"min_lat" double precision NOT NULL,
	"max_lon" double precision NOT NULL,
	"max_lat" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tours_visibility_check" CHECK ("tours"."visibility" in ('private', 'instance'))
);
--> statement-breakpoint
CREATE INDEX "tours_owner_updated_idx" ON "tours" USING btree ("owner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tours_owner_activity_idx" ON "tours" USING btree ("owner_id","activity_type");--> statement-breakpoint
CREATE INDEX "tours_geom_idx" ON "tours" USING gist ("geom");
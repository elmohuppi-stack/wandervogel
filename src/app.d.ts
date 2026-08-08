// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			/**
			 * Wem die Daten dieser Anfrage gehören — die Kennung des
			 * angemeldeten Nutzers. Gesetzt in hooks.server.ts.
			 *
			 * Nicht optional, obwohl es auf `/anmelden` keinen Wert gibt: dort
			 * liest es niemand, und überall sonst hat hooks.server.ts längst
			 * umgeleitet. Es optional zu machen hieße, in jedem Endpunkt eine
			 * Prüfung zu schreiben, die nie zutrifft — und die echte Zusage
			 * („ohne Sitzung kommt hier nichts an") stünde trotzdem nur an
			 * einer Stelle.
			 */
			ownerId: string;
			/**
			 * Der angemeldete Nutzer, oder undefined auf den offenen Seiten.
			 *
			 * Absichtlich optional: nur `/anmelden` ist ohne Sitzung
			 * erreichbar, und dort gibt es keinen Nutzer. Überall sonst hat
			 * hooks.server.ts bereits umgeleitet, bevor eine Route lädt.
			 */
			user?: import('$lib/server/auth').SessionUser;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

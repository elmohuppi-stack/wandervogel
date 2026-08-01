// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			/** Wem die Daten dieser Anfrage gehören. Gesetzt in hooks.server.ts;
			 *  kommt mit der Anmeldung aus der Sitzung. */
			ownerId: string;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

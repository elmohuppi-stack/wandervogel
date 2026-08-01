/**
 * Datenbankfehler in dieselbe Sprache übersetzen wie Routingfehler.
 *
 * Der Tonfall spiegelt BrouterError bewusst: „Dienst nicht erreichbar (…).
 * Läuft der Container?" ist die Meldung, die beim Entwickeln am häufigsten
 * hilft, weil sie die wahrscheinliche Ursache gleich mitliefert.
 */

export type DbErrorKind = 'unreachable' | 'unknown';

export class DbError extends Error {
	constructor(
		message: string,
		readonly kind: DbErrorKind
	) {
		super(message);
		this.name = 'DbError';
	}
}

/** postgres.js meldet Verbindungsprobleme über den `code` am Fehlerobjekt. */
const UNREACHABLE = new Set(['ECONNREFUSED', 'CONNECT_TIMEOUT', 'ENOTFOUND', 'ECONNRESET']);

export function toDbError(e: unknown): DbError {
	const code = (e as { code?: string } | null)?.code;
	if (code && UNREACHABLE.has(code)) {
		return new DbError('Datenbank nicht erreichbar (5433). Läuft der Container?', 'unreachable');
	}
	return new DbError('Unerwarteter Fehler in der Datenbank', 'unknown');
}

/** Verbindungsprobleme sind vorübergehend (503), alles andere unser Fehler. */
export function dbStatus(kind: DbErrorKind): number {
	return kind === 'unreachable' ? 503 : 500;
}

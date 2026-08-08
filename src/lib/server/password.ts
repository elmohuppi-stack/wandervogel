/**
 * Passwort-Hashing mit scrypt.
 *
 * **Diese Datei importiert nichts außer `node:crypto`** — kein `$app`, kein
 * `$env`, keine Datenbank. Der Grund ist praktisch: `data/admin.mjs` legt
 * den ersten Admin an, bevor irgendeine Sitzung existiert, und läuft
 * deshalb außerhalb von SvelteKit. Node 22 strippt Typen von selbst, also
 * kann das Skript genau dieses Modul importieren.
 *
 * Die Alternative wäre gewesen, das Hash-Format im Skript nachzubauen. Dann
 * hätte es zwei Wahrheiten über die Kostenparameter gegeben, und die
 * zweite wäre beim ersten Erhöhen vergessen worden.
 *
 * **Warum scrypt und nicht argon2 oder bcrypt:** beide sind native Module
 * mit Build-Schritt beim Deploy. Auf einem Host mit 3,7 GB und elf Apps ist
 * eine Abhängigkeit, die kompiliert werden will, ein Risiko ohne
 * funktionalen Gegenwert. scrypt ist in Node eingebaut, in RFC 7914
 * standardisiert und für Passwörter zugelassen.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * `promisify` verliert die Überladung mit `options` — die abgeleitete
 * Signatur nimmt nur (password, salt, keylen). Ohne diese Angabe ließen
 * sich die Kostenparameter nicht übergeben, und scrypt liefe still mit
 * Nodes schwacher Vorgabe (N = 16384).
 */
const scrypt = promisify(scryptCb) as (
	password: string | Buffer,
	salt: string | Buffer,
	keylen: number,
	options: ScryptOptions
) => Promise<Buffer>;

/**
 * Kostenparameter. Sie stehen **im Hash**, nicht nur hier — deshalb lassen
 * sie sich später erhöhen, ohne dass vorhandene Passwörter ungültig werden.
 *
 * N = 2^16 braucht `128 · N · r` ≈ 67 MB je Aufruf. Das liegt über Nodes
 * Vorgabe für `maxmem` (32 MB), weshalb der Wert unten ausdrücklich gesetzt
 * wird — sonst schlägt scrypt mit „memory limit exceeded" fehl, und zwar
 * erst beim ersten echten Anmeldeversuch.
 */
const N = 65536;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;

const b64 = (b: Buffer) => b.toString('base64url');

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, {
		N,
		r: R,
		p: P,
		maxmem: MAXMEM
	});
	return `scrypt$${N}$${R}$${P}$${b64(salt)}$${b64(key)}`;
}

/**
 * Prüft ein Passwort gegen einen gespeicherten Hash.
 *
 * Gibt bei allem Unerwarteten `false` zurück statt zu werfen. Das ist hier
 * kein Verschlucken von Fehlern, sondern der Zweck: das Übergangskonto aus
 * Migration 0001 trägt `!` als Hash, damit es sich nicht anmelden kann.
 * Ein Wurf würde daraus einen 500er machen und verriete, dass dieses Konto
 * anders ist als eines mit falschem Passwort.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const teile = stored.split('$');
	if (teile.length !== 6 || teile[0] !== 'scrypt') return false;

	const [, n, r, p, salt, hash] = teile;
	const kosten = { N: Number(n), r: Number(r), p: Number(p) };
	if (!Number.isInteger(kosten.N) || !Number.isInteger(kosten.r) || !Number.isInteger(kosten.p)) {
		return false;
	}

	try {
		const erwartet = Buffer.from(hash, 'base64url');
		const errechnet = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), erwartet.length, {
			...kosten,
			maxmem: MAXMEM
		});
		// Längen prüfen, weil timingSafeEqual sonst wirft statt false zu geben.
		return erwartet.length === errechnet.length && timingSafeEqual(erwartet, errechnet);
	} catch {
		return false;
	}
}

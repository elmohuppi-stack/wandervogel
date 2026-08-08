/**
 * Nutzer lesen und schreiben (Anforderungen 6.1).
 *
 * **Die Regel dieses Moduls:** Jeder Schreibweg normalisiert den
 * Anmeldenamen, und zwar über `../username` — dieselbe Funktion, die
 * `data/admin.mjs` außerhalb von SvelteKit benutzt. Die Regel an zwei
 * Stellen zu halten ist genau einmal schiefgegangen: das Skript verbot das
 * `@` und lehnte damit E-Mail-Adressen ab, die 6.1 ausdrücklich zulässt.
 *
 * Alles, was eine Sitzung ungültig macht (deaktivieren, Rolle ändern,
 * Passwort zurücksetzen), räumt die Sitzungen selbst mit weg. Sonst müsste
 * jeder Aufrufer daran denken, und einer denkt nicht daran.
 */

import { and, asc, count, eq, ne } from 'drizzle-orm';
import { deleteSessionsOfUser, hashPassword } from '../auth';
import { normalizeUsername } from '../username';
import { db } from './index';
import { tours, users, type UserRow } from './schema';

// Weitergereicht, damit Aufrufer nicht zwei Module kennen müssen.
export { normalizeUsername } from '../username';

export interface UserListItem {
	id: string;
	username: string;
	displayName: string;
	role: 'admin' | 'user';
	active: boolean;
	tourCount: number;
	createdAt: string;
}

export async function listUsers(): Promise<UserListItem[]> {
	/*
	 * Join statt korrelierter Unterabfrage.
	 *
	 * Erst stand hier `(select count(*) from tours where …)` als rohes SQL.
	 * Das lief ohne Fehler und zählte trotzdem immer null: der Ausdruck hat
	 * keinen Namen, und Drizzle findet die Spalte im Ergebnis nicht wieder.
	 * Ein stiller Falschwert — schlimmer als eine Ausnahme, weil „0 Touren"
	 * plausibel aussieht. Der Join bildet sauber ab und ist ohnehin lesbarer.
	 */
	const zeilen = await db
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			role: users.role,
			active: users.active,
			createdAt: users.createdAt,
			// Zählt mit, damit die Verwaltung vor dem Deaktivieren zeigen kann,
			// woran es hängt: „3 Touren" ist die Antwort auf „darf das weg?".
			// count() auf der Tourspalte, nicht count(*): sonst zählte der
			// LEFT JOIN für einen Nutzer ohne Touren eine Zeile statt keiner.
			tourCount: count(tours.id)
		})
		.from(users)
		.leftJoin(tours, eq(tours.ownerId, users.id))
		.groupBy(users.id)
		.orderBy(asc(users.username));

	return zeilen.map((z) => ({
		id: z.id,
		username: z.username,
		displayName: z.displayName,
		role: z.role,
		active: z.active === 'yes',
		tourCount: z.tourCount,
		createdAt: z.createdAt.toISOString()
	}));
}

export async function findByUsername(username: string): Promise<UserRow | null> {
	const [u] = await db
		.select()
		.from(users)
		.where(eq(users.username, normalizeUsername(username)))
		.limit(1);
	return u ?? null;
}

export interface NewUser {
	username: string;
	displayName: string;
	password: string;
	role: 'admin' | 'user';
}

export async function createUser(input: NewUser): Promise<string> {
	const [u] = await db
		.insert(users)
		.values({
			username: normalizeUsername(input.username),
			displayName: input.displayName.trim(),
			passwordHash: await hashPassword(input.password),
			role: input.role
		})
		.returning({ id: users.id });
	return u.id;
}

export interface UserPatch {
	displayName?: string;
	role?: 'admin' | 'user';
	active?: boolean;
	password?: string;
}

export async function updateUser(id: string, patch: UserPatch): Promise<boolean> {
	const werte: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

	if (patch.displayName !== undefined) werte.displayName = patch.displayName.trim();
	if (patch.role !== undefined) werte.role = patch.role;
	if (patch.active !== undefined) werte.active = patch.active ? 'yes' : 'no';
	if (patch.password !== undefined) werte.passwordHash = await hashPassword(patch.password);

	const betroffen = await db.update(users).set(werte).where(eq(users.id, id)).returning({
		id: users.id
	});
	if (betroffen.length === 0) return false;

	// Rolle, Sperre und Passwort ändern, was eine offene Sitzung darf —
	// also endet sie. Nur eine Umbenennung lässt den Nutzer angemeldet.
	if (patch.role !== undefined || patch.active !== undefined || patch.password !== undefined) {
		await deleteSessionsOfUser(id);
	}
	return true;
}

/**
 * Wie viele aktive Admins gibt es außer diesem einen?
 *
 * Der Aufrufer braucht das, um sich nicht selbst auszusperren: die
 * Verwaltung ist die einzige Stelle, an der Nutzer entstehen, und ohne
 * aktiven Admin käme niemand mehr hinein. Das wäre nur noch über `psql` zu
 * heilen.
 */
export async function otherActiveAdmins(exceptId: string): Promise<number> {
	const [z] = await db
		.select({ n: count() })
		.from(users)
		.where(and(eq(users.role, 'admin'), eq(users.active, 'yes'), ne(users.id, exceptId)));
	return z?.n ?? 0;
}

/**
 * Übernimmt die Touren des Übergangskontos aus Migration 0001.
 *
 * Vor der Anmeldung gehörten alle Touren einer Konstanten. Die Migration
 * hat daraus ein gesperrtes Konto gemacht, damit der Fremdschlüssel hält;
 * hier gehen sie an den ersten echten Admin über. Gibt die Zahl der
 * übernommenen Touren zurück — null, wenn es nichts zu übernehmen gab.
 */
export const UEBERNAHME_ID = '00000000-0000-4000-8000-000000000001';

export async function claimLegacyTours(newOwnerId: string): Promise<number> {
	const [vorhanden] = await db.select({ id: users.id }).from(users).where(eq(users.id, UEBERNAHME_ID));
	if (!vorhanden || newOwnerId === UEBERNAHME_ID) return 0;

	const verschoben = await db
		.update(tours)
		.set({ ownerId: newOwnerId })
		.where(eq(tours.ownerId, UEBERNAHME_ID))
		.returning({ id: tours.id });

	// Das Übergangskonto hat seinen Zweck erfüllt. Es zu behalten hieße, in
	// der Verwaltung dauerhaft eine Zeile zu zeigen, die niemand erklären kann.
	await db.delete(users).where(eq(users.id, UEBERNAHME_ID));

	return verschoben.length;
}

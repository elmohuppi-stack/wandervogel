import { fail } from '@sveltejs/kit';
import { toDbError } from '$lib/server/db/errors';
import {
	createUser,
	deleteUser,
	listUsers,
	otherActiveAdmins,
	updateUser
} from '$lib/server/db/users';
import { pruefePasswort } from '$lib/server/password';
import { pruefeUsername } from '$lib/server/username';
import type { Actions, PageServerLoad } from './$types';

/**
 * Nutzerverwaltung (Anforderungen 6.1, Rolle Admin).
 *
 * Der Zugang wird **nicht hier** geprüft, sondern in hooks.server.ts über
 * die Liste `NUR_ADMIN`. Eine Prüfung an beiden Stellen liefe irgendwann
 * auseinander, und dann gilt die schwächere.
 *
 * Was hier dagegen geprüft wird, ist fachlich: dass sich der letzte Admin
 * nicht selbst aussperrt. Das ist keine Zugangsfrage, sondern eine Regel
 * über den Datenbestand.
 */

export const load: PageServerLoad = async ({ locals }) => ({
	nutzer: await listUsers(),
	selbst: locals.user!.id
});

export const actions: Actions = {
	/** Neuen Nutzer anlegen. Selbstregistrierung gibt es nicht (6.1). */
	anlegen: async ({ request }) => {
		const d = await request.formData();
		const username = String(d.get('username') ?? '');
		const displayName = String(d.get('displayName') ?? '').trim();
		const passwort = String(d.get('passwort') ?? '');
		const role = d.get('role') === 'admin' ? 'admin' : 'user';

		const namensfehler = pruefeUsername(username);
		if (namensfehler) return fail(400, { fehler: namensfehler, form: 'anlegen' });
		if (!displayName) return fail(400, { fehler: 'Anzeigename fehlt.', form: 'anlegen' });
		const passfehler = pruefePasswort(passwort);
		if (passfehler) return fail(400, { fehler: passfehler, form: 'anlegen' });

		try {
			await createUser({ username, displayName, password: passwort, role });
		} catch (e) {
			// 23505 = unique_violation. Der Name ist die einzige eindeutige
			// Spalte, also braucht es keine Unterscheidung.
			if ((e as { code?: string })?.code === '23505') {
				return fail(400, { fehler: 'Diesen Benutzernamen gibt es schon.', form: 'anlegen' });
			}
			const f = toDbError(e);
			return fail(503, { fehler: f.message, form: 'anlegen' });
		}

		return { ok: `„${displayName}" angelegt.` };
	},

	/** Anzeigename und Rolle ändern, aktivieren und deaktivieren. */
	aendern: async ({ request, locals }) => {
		const d = await request.formData();
		const id = String(d.get('id') ?? '');
		const displayName = String(d.get('displayName') ?? '').trim();
		const role = d.get('role') === 'admin' ? 'admin' : 'user';
		const active = d.get('active') === 'on';

		if (!displayName) return fail(400, { fehler: 'Anzeigename fehlt.', form: id });

		/*
		 * Die Aussperrsicherung.
		 *
		 * Nutzer entstehen ausschließlich auf dieser Seite. Gäbe es keinen
		 * aktiven Admin mehr, käme niemand mehr herein — zu heilen nur noch
		 * über psql auf dem Server. Deshalb zwei Verbote, und beide gelten
		 * nur für einen selbst: einen *anderen* Admin darf man herabstufen,
		 * solange man selbst noch da ist.
		 */
		if (id === locals.user!.id && (role !== 'admin' || !active)) {
			const andere = await otherActiveAdmins(id);
			if (andere === 0) {
				return fail(400, {
					fehler:
						'Das ginge nur einmal: du bist der letzte aktive Admin. ' +
						'Lege erst einen zweiten an, dann kannst du dich selbst ändern.',
					form: id
				});
			}
		}

		try {
			const gefunden = await updateUser(id, { displayName, role, active });
			if (!gefunden) return fail(404, { fehler: 'Diesen User gibt es nicht mehr.', form: id });
		} catch (e) {
			const f = toDbError(e);
			return fail(503, { fehler: f.message, form: id });
		}

		return { ok: `„${displayName}" gespeichert.` };
	},

	/**
	 * Konto endgültig entfernen, samt seiner Touren.
	 *
	 * **Ein Verbot genügt hier, anders als bei `aendern`:** das eigene Konto.
	 * Eine Aussperrsicherung braucht es nicht — wer löscht, ist selbst ein
	 * aktiver Admin und bleibt es, weil er sich nicht selbst löschen kann.
	 * Der letzte Admin lässt sich also gar nicht entfernen. Hier trotzdem
	 * `otherActiveAdmins` abzufragen wäre eine Prüfung, die nie zutrifft —
	 * und damit ein Schutz, an den man glaubt, ohne dass er etwas tut.
	 */
	loeschen: async ({ request, locals }) => {
		const d = await request.formData();
		const id = String(d.get('id') ?? '');

		if (id === locals.user!.id) {
			return fail(400, {
				fehler:
					'Das eigene Konto lässt sich hier nicht löschen — ' +
					'ein anderer Admin kann es. Zum Verlassen gibt es Abmelden.',
				form: `del-${id}`
			});
		}

		try {
			const touren = await deleteUser(id);
			if (touren === null) {
				return fail(404, { fehler: 'Diesen User gibt es nicht mehr.', form: `del-${id}` });
			}
			return {
				ok:
					touren > 0
						? `Konto gelöscht, mit ${touren} ${touren === 1 ? 'Tour' : 'Touren'}.`
						: 'Konto gelöscht.'
			};
		} catch (e) {
			const f = toDbError(e);
			return fail(503, { fehler: f.message, form: `del-${id}` });
		}
	},

	/** Passwort zurücksetzen (6.1, SOLL). Beendet alle Sitzungen des Nutzers. */
	passwort: async ({ request }) => {
		const d = await request.formData();
		const id = String(d.get('id') ?? '');
		const passwort = String(d.get('passwort') ?? '');

		const passfehler = pruefePasswort(passwort);
		if (passfehler) return fail(400, { fehler: passfehler, form: `pw-${id}` });

		try {
			const gefunden = await updateUser(id, { password: passwort });
			if (!gefunden) {
				return fail(404, { fehler: 'Diesen User gibt es nicht mehr.', form: `pw-${id}` });
			}
		} catch (e) {
			const f = toDbError(e);
			return fail(503, { fehler: f.message, form: `pw-${id}` });
		}

		return { ok: 'Passwort gesetzt. Alle offenen Sitzungen dieses Users sind beendet.' };
	}
};

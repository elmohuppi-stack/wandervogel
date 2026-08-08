import type { LayoutServerLoad } from './$types';

/**
 * Der angemeldete Nutzer für jede Seite.
 *
 * Im Layout und nicht in jeder Route: sonst müsste jede neue Seite daran
 * denken, und die erste, die es vergisst, zeigt keine Abmeldung mehr.
 *
 * `undefined` gibt es nur auf `/anmelden` — überall sonst hat
 * hooks.server.ts vorher umgeleitet.
 */
export const load: LayoutServerLoad = async ({ locals }) => ({ user: locals.user });

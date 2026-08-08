import { env } from '$env/dynamic/public';

/**
 * Impressum und Datenschutzerklärung als Daten.
 *
 * Muster übernommen aus `mathe-quiz`: Inhalte in einer Datenstruktur statt
 * in Markup, Betreiberangaben aus der Umgebung, und solange Platzhalter
 * aktiv sind ein deutlicher Entwurfshinweis auf der Seite. So liegen keine
 * personenbezogenen Daten im Repository, und niemand geht mit einem
 * halbfertigen Impressum live, ohne es zu merken.
 *
 * Der Unterschied zu mathe-quiz steckt in der Datenschutzerklärung. Sie
 * beschreibt nicht irgendeine Web-App, sondern diese: gespeicherte Routen
 * sind Ortsdaten, und die Empfängerliste ist kurz, weil fast alles über den
 * eigenen Server läuft. Beides gehört ehrlich benannt.
 *
 * > Kein Rechtsrat. Die Texte sind eine Arbeitsgrundlage nach bestem
 * > Wissen, keine anwaltliche Prüfung. Vor dem Livegang gehören die Angaben
 * > und die Aufbewahrungsfristen geprüft.
 */

export interface LegalSection {
	title: string;
	paragraphs?: string[];
	items?: string[];
}

export interface LegalDocument {
	title: string;
	intro: string;
	sections: LegalSection[];
}

const PLATZHALTER = 'Bitte ergänzen';

const kontakt = {
	name: env.PUBLIC_LEGAL_NAME || `${PLATZHALTER}: Betreibername`,
	strasse: env.PUBLIC_LEGAL_ADDRESS || `${PLATZHALTER}: Straße und Hausnummer`,
	ort: env.PUBLIC_LEGAL_CITY || `${PLATZHALTER}: Postleitzahl und Ort`,
	land: env.PUBLIC_LEGAL_COUNTRY || 'Deutschland',
	email: env.PUBLIC_LEGAL_EMAIL || `${PLATZHALTER}: Kontakt-E-Mail`,
	verantwortlich: env.PUBLIC_LEGAL_RESPONSIBLE || `${PLATZHALTER}: verantwortliche Person`
};

const anschrift = () => [kontakt.name, kontakt.strasse, kontakt.ort, kontakt.land];

/** Ist noch ein Platzhalter aktiv? Dann erfüllt die Seite ihren Zweck nicht. */
export function hatPlatzhalter(): boolean {
	return Object.values(kontakt).some((v) => v.startsWith(PLATZHALTER));
}

const STAND = '8. August 2026';

export function impressum(): LegalDocument {
	return {
		title: 'Impressum',
		intro: 'Anbieterkennzeichnung nach § 5 DDG.',
		sections: [
			{ title: 'Anbieter', paragraphs: anschrift() },
			{ title: 'Kontakt', paragraphs: [`E-Mail: ${kontakt.email}`] },
			{
				title: 'Verantwortlich für den Inhalt',
				paragraphs: [kontakt.verantwortlich, kontakt.strasse, kontakt.ort]
			},
			{
				title: 'Haftung für Inhalte',
				paragraphs: [
					'Die Inhalte dieser Anwendung wurden mit Sorgfalt erstellt. Für Richtigkeit, ' +
						'Vollständigkeit und Aktualität wird keine Gewähr übernommen.',
					'Das gilt ausdrücklich auch für berechnete Routen, Höhenangaben, Wegzustände und ' +
						'Zeitschätzungen. Sie beruhen auf offenen Kartendaten und Näherungsformeln und ' +
						'ersetzen weder eigene Planung noch Karte, Wetterbericht und Urteilsvermögen im ' +
						'Gelände. Die Nutzung erfolgt auf eigene Verantwortung.'
				]
			},
			{
				title: 'Haftung für Links',
				paragraphs: [
					'Für die Inhalte verlinkter externer Seiten sind ausschließlich deren Betreiber ' +
						'verantwortlich.'
				]
			},
			{
				title: 'Urheberrecht und Kartendaten',
				paragraphs: [
					'Die eigenen Inhalte dieser Anwendung unterliegen dem deutschen Urheberrecht.',
					'Karten- und Wegedaten stammen aus OpenStreetMap und stehen unter der Open Database ' +
						'License (ODbL 1.0), © OpenStreetMap-Mitwirkende. Die Wegmarkierungen kommen von ' +
						'Waymarked Trails (CC BY-SA). Die Nennung steht zusätzlich unmittelbar an der Karte.'
				]
			},
			{
				title: 'Verbraucherstreitbeilegung',
				paragraphs: [
					'Es besteht keine Verpflichtung und keine Bereitschaft, an Streitbeilegungsverfahren ' +
						'vor einer Verbraucherschlichtungsstelle teilzunehmen.',
					`Stand: ${STAND}`
				]
			}
		]
	};
}

export function datenschutz(): LegalDocument {
	return {
		title: 'Datenschutzerklärung',
		intro:
			'Diese Erklärung beschreibt, welche Daten diese Anwendung verarbeitet — nicht, was ' +
			'eine Web-App üblicherweise verarbeitet.',
		sections: [
			{
				title: 'Verantwortliche Stelle',
				paragraphs: [...anschrift(), `Kontakt für Datenschutzanfragen: ${kontakt.email}`]
			},
			{
				title: 'Ohne Konto',
				paragraphs: [
					'Karte und Tourenplanung lassen sich ohne Anmeldung benutzen. Dabei entsteht kein ' +
						'Konto, und es wird nichts dauerhaft über Sie gespeichert. Erst zum Speichern einer ' +
						'Tour braucht es eine Anmeldung.'
				]
			},
			{
				title: 'Welche Daten mit Konto verarbeitet werden',
				items: [
					'Kontodaten: Benutzername, Anzeigename, Rolle und der Passwort-Hash. Das Passwort ' +
						'selbst wird nicht gespeichert, sondern nur ein mit scrypt berechneter Hash.',
					'Sitzungen: ein Ablaufzeitpunkt und der Abdruck (SHA-256) der Sitzungskennung. Die ' +
						'Kennung selbst liegt nur in Ihrem Browser, nicht in der Datenbank.',
					'Touren: Name, Datum, Notiz, gesetzte Wegpunkte und die berechnete Route. ' +
						'Eine gespeicherte Route ist eine Ortsangabe — sie zeigt, wo Sie eine Tour ' +
						'geplant haben. Das ist der Zweck der Anwendung und zugleich der schützenswerteste ' +
						'Teil der Daten.',
					'Technische Verbindungsdaten des Servers (Server-Logs).'
				]
			},
			{
				title: 'Ihr Standort',
				paragraphs: [
					'Der Standort wird nur abgefragt, wenn Sie ihn ausdrücklich anfordern, und nur vom ' +
						'Browser an die Seite gegeben. Er wird nicht gespeichert und nicht übertragen — ' +
						'er liegt allein im Arbeitsspeicher der geöffneten Seite und ist mit dem Schließen ' +
						'des Tabs weg.'
				]
			},
			{
				title: 'Was im Browser bleibt',
				items: [
					'Sitzungscookie: technisch notwendig, nicht aus JavaScript lesbar, 90 Tage gültig. Es ' +
						'dient allein der Anmeldung und keiner Auswertung.',
					'Eine unfertige Tour als lokaler Entwurf, damit ein Absturz oder Neuladen keine ' +
						'Arbeit kostet.',
					'Einstellungen wie Hell/Dunkel, eingeblendetes Wegenetz und aufgeklapptes Höhenprofil.'
				],
				paragraphs: [
					'Alles davon bleibt auf Ihrem Gerät. Es gibt keine Tracking-Cookies, keine Analyse ' +
						'und keine Reichweitenmessung.'
				]
			},
			{
				title: 'Empfänger — wer tatsächlich Daten von Ihnen sieht',
				paragraphs: [
					'Fast alle Kartendienste laufen über den eigenen Server. Ihre IP-Adresse geht deshalb ' +
						'an Ortssuche (Nominatim), Höhendaten und Routensuche nicht — dorthin fragt der ' +
						'Server, nicht Ihr Browser. Die Routenberechnung läuft vollständig auf dem eigenen ' +
						'Server; dabei ist überhaupt kein Dritter beteiligt.'
				],
				items: [
					'Der Anbieter der Basiskarte erhält beim Laden von Kartenausschnitten Ihre IP-Adresse. ' +
						'Das ist der einzige Dienst, den Ihr Browser bei normaler Nutzung direkt aufruft.',
					'Waymarked Trails erhält Ihre IP-Adresse nur, wenn Sie das Wegenetz einblenden. ' +
						'Diese Ebene ist standardmäßig ausgeschaltet.',
					'Der Hoster verarbeitet technische Verbindungsdaten zum Betrieb des Servers.'
				]
			},
			{
				title: 'Zwecke und Rechtsgrundlagen',
				items: [
					'Bereitstellung von Konto, Planung und Tourenarchiv — Art. 6 Abs. 1 lit. b DSGVO.',
					'Sicherer und stabiler Betrieb, einschließlich Missbrauchsabwehr durch Begrenzung ' +
						'der Anfragen je IP-Adresse — Art. 6 Abs. 1 lit. f DSGVO.'
				]
			},
			{
				title: 'Speicherdauer',
				items: [
					'Touren bleiben, bis Sie sie löschen oder das Konto entfernt wird.',
					'Sitzungen laufen nach 90 Tagen ab und werden beim Abmelden sofort ungültig. Beim ' +
						'Deaktivieren eines Kontos und beim Ändern des Passworts enden alle Sitzungen.',
					'Server-Logs sind kurz aufzubewahren; die Frist ist vor dem Produktivbetrieb ' +
						'festzulegen.'
				]
			},
			{
				title: 'Ihre Rechte',
				items: [
					'Auskunft über die zu Ihnen verarbeiteten Daten.',
					'Berichtigung unrichtiger Daten.',
					'Löschung und Einschränkung der Verarbeitung im gesetzlichen Rahmen.',
					'Datenübertragbarkeit — jede Tour lässt sich jederzeit selbst als GPX herunterladen, ' +
						'einem offenen und überall lesbaren Format.',
					'Beschwerde bei einer Datenschutz-Aufsichtsbehörde.'
				],
				paragraphs: [`Anfragen an: ${kontakt.email}`, `Stand: ${STAND}`]
			}
		]
	};
}

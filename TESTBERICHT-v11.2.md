# Testbericht v11.2

Statisch geprüft:
- script.js Syntax
- cloud-auth.js Syntax
- cloud-sync.js Syntax
- team.js Syntax
- data-repository.js Syntax
- Team-Screen vorhanden
- Rollen-Vorschau entfernt
- Einladung via RPC
- Token wird nicht im Team-Tab dauerhaft gespeichert
- Einladungslink-Erkennung via ?invite=
- Invite-Registrierung überspringt Betriebserstellung
- Account-/Company-Wechsel trennt lokale Workspaces
- Worker Cloud-Erststart zieht nur Daten, seedet keinen Betrieb
- Office aktualisiert keine kritischen Firmeneinstellungen
- Worker-Finanzbereiche UI-seitig verborgen

Backend:
- team_invitations
- create_team_invitation
- accept_team_invitation
- revoke_team_invitation
- list_team_members
- set_team_member_role
- set_team_member_status
- job_assignments + Worker-RLS

- Teamliste auf direkte RLS-Abfrage umgestellt: BESTANDEN
- Worker kann keine neue Baustelle/Aufgabe anlegen: UI gesperrt
- Worker-Abschluss erzeugt keine Rechnung: BESTANDEN

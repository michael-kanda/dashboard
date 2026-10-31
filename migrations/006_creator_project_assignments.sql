-- Admin-Zugriff gilt nur noch über project_assignments. Projekte, die ein Admin vor
-- Einführung der automatischen Zuordnung (November 2025) angelegt hat, waren bisher
-- über "createdByAdminId" im selben Mandanten sichtbar und erhalten die fehlende Zuordnung.

INSERT INTO project_assignments (user_id, project_id)
SELECT creator.id, project.id
FROM users project
JOIN users creator ON creator.id = project."createdByAdminId"
WHERE project.role = 'BENUTZER'
  AND creator.role = 'ADMIN'
  AND project.mandant_id = creator.mandant_id
ON CONFLICT (user_id, project_id) DO NOTHING;

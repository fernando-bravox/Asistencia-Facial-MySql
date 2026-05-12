UPDATE subjects SET name = REPLACE(name, 'Ã¡', 'á');
UPDATE subjects SET name = REPLACE(name, 'Ã©', 'é');
UPDATE subjects SET name = REPLACE(name, 'Ã­', 'í');
UPDATE subjects SET name = REPLACE(name, 'Ã³', 'ó');
UPDATE subjects SET name = REPLACE(name, 'Ãº', 'ú');
UPDATE subjects SET name = REPLACE(name, 'Ã±', 'ñ');
UPDATE subjects SET name = REPLACE(name, 'Ã¼', 'ü');

UPDATE users SET name = REPLACE(name, 'Ã¡', 'á'), lastname = REPLACE(lastname, 'Ã¡', 'á');
UPDATE users SET name = REPLACE(name, 'Ã©', 'é'), lastname = REPLACE(lastname, 'Ã©', 'é');
UPDATE users SET name = REPLACE(name, 'Ã­', 'í'), lastname = REPLACE(lastname, 'Ã­', 'í');
UPDATE users SET name = REPLACE(name, 'Ã³', 'ó'), lastname = REPLACE(lastname, 'Ã³', 'ó');
UPDATE users SET name = REPLACE(name, 'Ãº', 'ú'), lastname = REPLACE(lastname, 'Ãº', 'ú');
UPDATE users SET name = REPLACE(name, 'Ã±', 'ñ'), lastname = REPLACE(lastname, 'Ã±', 'ñ');
UPDATE users SET name = REPLACE(name, 'Ã¼', 'ü'), lastname = REPLACE(lastname, 'Ã¼', 'ü');

SELECT id, name FROM subjects WHERE name LIKE '%Ã%' OR name LIKE '%Â%';
SELECT id, name, lastname FROM users WHERE CONCAT_WS(' ', name, lastname) LIKE '%Ã%' OR CONCAT_WS(' ', name, lastname) LIKE '%Â%';

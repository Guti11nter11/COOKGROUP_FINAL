-- Registros añadidos aparte de la web oficial: a mano (/registro) o sacados de artículos de los blogs
-- oficiales de Ticketmaster. Los de artículos caducan solos; los manuales, nunca.
ALTER TABLE artist_signup_manual ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

-- Run this first to wipe all chat objects from the database.

DROP TABLE IF EXISTS chat_messages    CASCADE;
DROP TABLE IF EXISTS chat_participants CASCADE;
DROP TABLE IF EXISTS chat_rooms       CASCADE;

DROP FUNCTION IF EXISTS auth_uid_is_room_participant(UUID);
DROP FUNCTION IF EXISTS get_my_family_code();

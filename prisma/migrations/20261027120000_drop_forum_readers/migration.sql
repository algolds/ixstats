-- "Mark all read" is gone and nothing writes forum_readers.allReadAt; the unread floor is always the 30-day window.
DROP TABLE IF EXISTS "forum_readers";

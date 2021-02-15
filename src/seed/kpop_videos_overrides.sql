/* These two are distinct music videos */
UPDATE kpop_videos.app_kpop SET nome = 'Roly Poly in Copabana' WHERE vlink = '3Xolk2cFzlo';
UPDATE kpop_videos.app_kpop SET nome = 'Roly Poly', vtype = 'main' WHERE vlink = 'afwK0Mv0IsY';

/* 'main' versions are not available in North America, use dance/duplicate instead */
/* Jet Coaster love (jp) */
UPDATE kpop_videos.app_kpop SET vtype = 'duplicate' WHERE vlink = 'cWDzVr3vPsg';
UPDATE kpop_videos.app_kpop SET vtype = 'main' WHERE vlink = 'siOg7ETEkbs';

/* Speed Up (jp) */
UPDATE kpop_videos.app_kpop SET vtype = 'duplicate' WHERE vlink = 'q6tfl41YlJ8';
UPDATE kpop_videos.app_kpop SET vtype = 'main' WHERE vlink = 'bEGQ7qlX6EY';

/* Go Go Summer (jp) */
UPDATE kpop_videos.app_kpop SET vtype = 'duplicate' WHERE vlink = 'ogVMxZTcoCI';
UPDATE kpop_videos.app_kpop SET vtype = 'main' WHERE vlink = '4hES5YumoxA';

/* Jet Coaster love (jp) */
UPDATE kpop_videos.app_kpop SET vtype = 'duplicate' WHERE vlink = 'cWDzVr3vPsg';
UPDATE kpop_videos.app_kpop SET vtype = 'main' WHERE vlink = 'siOg7ETEkbs';

/* Electric Boy (jp) */
UPDATE kpop_videos.app_kpop SET vtype = 'duplicate' WHERE vlink = 'IOk087zgj84';
UPDATE kpop_videos.app_kpop SET vtype = 'main' WHERE vlink = 'cNCmElEQ0F4';

/* Remove ☮ symbols from artist names */
UPDATE kpop_videos.app_kpop_group SET name = REPLACE(name, ' ☮', '')


// Copy to config.js and fill in. config.js is gitignored.
//
// The publishable key is safe to place in a web page: `anon` has been REVOKEd
// from every table and view, so this key ALONE returns 401 for everything. It
// only becomes useful once combined with the clinic's email and password, and
// the password is never stored here - the page asks for it and the browser
// remembers the session.
//
// It stays out of git anyway, because the repo is public and CLAUDE.md
// section 13 forbids committing anything clinic-identifying.
window.CLINIC_CONFIG = {
  url: 'https://YOURPROJECT.supabase.co',
  key: 'sb_publishable_...',
  // Pre-fills the sign-in box, so only the password has to be typed.
  email: 'you@example.com',
};

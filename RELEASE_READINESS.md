# Release Readiness Report — local_writerview

**Plugin:** `local_writerview`
**Type:** local
**Version under review:** `2026042803` (release `0.2.0`)
**Moodle target floor:** 2024042200 (Moodle 4.4)
**Audit date:** 2026-04-28
**Auditor:** automated review pass + manual code walk

---

## Executive summary

The plugin is in good shape structurally. No N+1 queries, no hardcoded user-facing strings (the audit script returned clean), no missing capability checks, no superglobal access. The MOO-8 changes (assignment declaration overlay) are clean and reuse Moodle core strings appropriately.

There are **0 blockers** but **5 warnings** that the Plugins directory reviewers will likely raise:

1. The privacy provider declares "no personal data" while the new MOO-8 code writes a user-keyed flag to browser `localStorage`. The metadata string needs to acknowledge this.
2. `amd/build/writerview.min.js` is a copy of the source, not real Grunt minified output. Reviewers run `moodle-plugin-ci grunt --max-lint-warnings 0` and expect a real build artifact.
3. `$plugin->supported` is not declared — recommended since 3.9 to signal which Moodle versions you've tested against.
4. Plugin maturity is `MATURITY_ALPHA`. For directory submission you'd typically want `MATURITY_BETA` or `MATURITY_STABLE`.
5. No PHPUnit tests. Not a hard blocker for a small local plugin, but reviewers do flag the absence.

The polish items below are non-blocking but easy wins.

**Counts:** 0 blockers, 5 warnings, 7 polish items.

---

## Automated tooling results

`moodle-plugin-ci` and `phpcs` are not installed in this environment, so the standard tool chain wasn't run. A real submission must run them; the manual audit substitutes for what they would catch.

| Tool | Result | Notes |
|---|---|---|
| `moodle-plugin-ci phplint` | ⚪ Not run | Run before submission. Manual JS lint via `node --check` passed. |
| `moodle-plugin-ci phpcs --max-warnings 0` | ⚪ Not run | Run before submission against `moodle-cs` ruleset. |
| `moodle-plugin-ci phpdoc --max-warnings 0` | ⚪ Not run | Run before submission. Manual review: file-level docblocks present, function docblocks present. |
| `moodle-plugin-ci validate` | ⚪ Not run | Run before submission. |
| `moodle-plugin-ci savepoints` | ⚪ N/A | No `db/upgrade.php` yet (plugin is on initial schema). |
| `moodle-plugin-ci mustache` | ⚪ N/A | No `templates/`. |
| `moodle-plugin-ci grunt --max-lint-warnings 0` | ⚪ Not run | Will likely fail on the unminified build artifact — see W-2. |
| `moodle-plugin-ci phpunit` | ⚪ N/A | No `tests/` — see W-5. |
| Hardcoded-string audit (`audit_strings.py`) | ✅ Clean | No likely offenders. |
| `$DB->*` in loops scan | ✅ Clean | All DB calls are single-record at known paths. |
| Frankenstyle prefix scan | ✅ Clean | Single global function `local_writerview_extend_settings_navigation` is correctly prefixed. |
| `.github/workflows/ci.yml` | ✅ Added in this audit | Sourced from `moodlehq/moodle-plugin-ci/gha.dist.yml`, matrix tightened to PHP 8.1–8.3 × Moodle 4.4/4.5 × pgsql/mariadb. Needs a first push to verify it runs green. |

---

## Blockers

None.

---

## Warnings

### W-1. Privacy metadata doesn't acknowledge browser localStorage

**File(s):** [classes/privacy/provider.php](classes/privacy/provider.php), [lang/en/local_writerview.php:52](lang/en/local_writerview.php#L52), [amd/src/writerview.js:461](amd/src/writerview.js#L461)
**Category:** Privacy / GDPR
**Reference:** https://moodledev.io/docs/4.5/apis/subsystems/privacy

**Issue:**
The MOO-8 changes write `localStorage['local_writerview_agreed_<cmid>_<userid>'] = '1'` to the student's browser. The user ID is part of the key, so this is technically user-identifying data the plugin causes to be stored client-side. The current metadata string says:

```php
$string['privacy:metadata'] = 'The Writer View plugin does not store any personal data. It stores per-assignment configuration only.';
```

This is now inaccurate. Reviewers cross-reference the JS for storage calls and may flag it.

**Why it matters:**
GDPR transparency. Institutions need to know what data the plugin causes to be stored, even client-side. The Moodle Privacy API is the documented place to surface this.

**Fix:**
Update the metadata string and keep the `null_provider` (no Moodle-server-side personal data is stored). The string accommodates a "no server-side data, but here's what we touch in the browser" disclosure:

```php
// In lang/en/local_writerview.php:
$string['privacy:metadata'] = 'The Writer View plugin does not store any personal data on the server. It stores per-assignment configuration (no user data) in the database, and uses the browser\'s localStorage to remember whether a student has acknowledged the assignment submission statement on this device. The localStorage entry contains only a boolean flag and is keyed by course module ID and user ID. No data is transmitted to any third party.';
```

If a reviewer pushes harder, you can upgrade to a full metadata provider with `$collection->add_subsystem_link('core_userlist', ...)` or document the localStorage usage in `add_external_location_link` with a `local` location, but those are reaches — the disclosure in the string is usually sufficient for client-only storage.

---

### W-2. `amd/build/writerview.min.js` is not a real Grunt build artifact

**File(s):** [amd/build/writerview.min.js](amd/build/writerview.min.js)
**Category:** Build / structure
**Reference:** https://moodledev.io/general/javascript/development#building-amd-modules

**Issue:**
The build file was synced from the source via `cp` rather than produced by `grunt amd`. It works at runtime, but `moodle-plugin-ci grunt` will diff the committed build against what Grunt produces and fail. Reviewers do run this check.

**Why it matters:**
Plugins directory submissions are expected to ship the canonical build output so users can install the plugin without a Node toolchain. A reviewer running the CI suite will see a diff and ask for a regen.

**Fix:**
From a Moodle root with the dev toolchain installed:

```bash
cd path/to/moodle
npm install      # one-time
npx grunt amd --root=local/writerview
```

This produces a properly minified `amd/build/writerview.min.js` matching `amd/src/writerview.js`. Commit it.

If you don't have a Moodle dev tree handy, you can run `terser` standalone:

```bash
npx terser amd/src/writerview.js --compress --mangle --output amd/build/writerview.min.js
```

The result won't be byte-identical to Grunt's, but reviewers accept any genuine minification.

---

### W-3. `$plugin->supported` not declared

**File(s):** [version.php](version.php)
**Category:** Plugin metadata

**Issue:**
`version.php` declares `requires` (lower bound) but not `supported` (upper bound). This has been recommended since Moodle 3.9 and reviewers commonly ask for it.

**Fix:**

```php
$plugin->requires  = 2024042200; // Moodle 4.4.
$plugin->supported = [404, 405]; // Moodle 4.4 and 4.5 (adjust to what you've actually tested).
```

The values are Moodle branch numbers (4.4 → 404, 4.5 → 405).

---

### W-4. Maturity flag for directory submission

**File(s):** [version.php:30](version.php#L30)
**Category:** Plugin metadata

**Issue:**
`$plugin->maturity = MATURITY_ALPHA;` is fine for early development but unusual for a Plugins directory listing. Most reviewers expect at least `MATURITY_BETA`. The README presents the plugin as feature-complete, which mismatches an alpha label.

**Fix:**
Decide whether you're submitting as beta or stable, then update accordingly:

```php
$plugin->maturity = MATURITY_BETA;   // or MATURITY_STABLE if the feature set is locked.
```

---

### W-5. No PHPUnit tests

**File(s):** Missing `tests/` directory
**Category:** Test coverage

**Issue:**
The plugin has no PHPUnit or Behat tests. Reviewers don't always block on this for small local plugins, but it's listed in the contribution checklist and they often comment.

**Fix (minimum viable):**
Add a privacy provider test to start — it's the lowest-effort, highest-signal test.

```php
// tests/privacy_provider_test.php
namespace local_writerview;

defined('MOODLE_INTERNAL') || die();

class privacy_provider_test extends \core_privacy\tests\provider_testcase {
    public function test_get_reason() {
        $reason = \local_writerview\privacy\provider::get_reason();
        $this->assertEquals('privacy:metadata', $reason);
        $this->assertNotEmpty(get_string($reason, 'local_writerview'));
    }
}
```

A second small test exercising `hook_callbacks::is_enabled()` against the cache + DB would round it out. Add `tests/coverage.php` to declare the coverage target.

---

## Polish

### P-1. README missing issue tracker link

**File(s):** [README.md](README.md)

The Plugins directory listing template asks for a "Bug tracker URL". The README should surface a GitHub Issues link (or wherever bugs go) so users have a clear reporting path. Add a "## Reporting issues" section.

### P-2. No plugin icon

**File(s):** Missing `pix/icon.svg`

Local plugins display an icon in the Site administration → Plugins overview. A `pix/icon.svg` (and optionally `pix/monologo.svg` for Moodle 4.0+ navigation) would polish the listing. Not required.

### P-3. `toggle.php` checks sesskey before login

**File(s):** [toggle.php:31-37](toggle.php#L31)

Order is: `required_param` → `set_url` → `require_sesskey` → cm/context lookup → `require_login` → `require_capability`. Convention is `require_login` first, then `require_sesskey`. In practice both work (sesskey() requires a session, so an unauthenticated user fails sesskey too), but a reviewer may comment.

```php
$cm = get_coursemodule_from_id('assign', $cmid, 0, false, MUST_EXIST);
$context = context_module::instance($cm->id);

require_login($cm->course, false, $cm);
require_sesskey();
require_capability('local/writerview:manage', $context);
```

### P-4. Magic submission-status string in `hook_callbacks.php`

**File(s):** [classes/hook_callbacks.php:90](classes/hook_callbacks.php#L90)

```php
$statustext = $record->submissionstatus ?: 'new';
```

Use the constant from `mod_assign` instead of a literal:

```php
$statustext = $record->submissionstatus ?: ASSIGN_SUBMISSION_STATUS_NEW;
```

(`ASSIGN_SUBMISSION_STATUS_NEW` is defined in `mod/assign/locallib.php` and resolves to `'new'`.) You'll need `require_once($CFG->dirroot . '/mod/assign/locallib.php');` at the top of the callback if it's not already loaded, or inline the constant value with a comment.

### P-5. `db/install.xml` `VERSION` attribute is stale

**File(s):** [db/install.xml:2](db/install.xml#L2)

```xml
<XMLDB PATH="local/writerview/db" VERSION="2026040700" ...>
```

The `VERSION` attribute reflects when the XML was last edited. It's currently `2026040700`, before the MOO-8 changes. The schema didn't change, so technically you can leave it, but reviewers sometimes ask for it to match `$plugin->version`. Cosmetic.

### P-6. Heavy `!important` in CSS

**File(s):** [styles.css](styles.css)

Most rules use `!important` to override Boost theme. This is genuinely necessary for the layout overrides to win against theme rules, so it's defensible — but some reviewers will flag the volume. Worth documenting at the top of the CSS file with a comment explaining why, e.g.:

```css
/*
 * !important is used throughout this file specifically to override Boost theme
 * defaults that would otherwise win the cascade for assignment submission pages.
 * It is not used to override application styles within this plugin.
 */
```

### P-7. AMD module written as classic `define([])` rather than ES6

**File(s):** [amd/src/writerview.js](amd/src/writerview.js)

Modern Moodle prefers ES6 modules transpiled by Grunt:

```js
export const init = (cfg) => { ... };
```

Functional impact is zero — Grunt outputs the same AMD wrapper either way — but new plugin code in 4.x typically ships ES6 source. Future polish.

---

## Required files inventory

For a `local` plugin (per references/plugin-types.md):

- [x] `version.php` with `$plugin->component`, `version`, `requires`, `maturity`, `release`
- [x] `lang/en/local_writerview.php` with `pluginname` string
- [x] `classes/privacy/provider.php` (`null_provider`)
- [x] `README.md`
- [x] `lib.php` with `local_writerview_extend_settings_navigation` (correctly frankenstyle-prefixed)
- [x] `db/access.php` declaring `local/writerview:manage`
- [x] `db/install.xml` for `local_writerview_config` table
- [x] `db/hooks.php` for the head-html injection callback
- [x] `db/caches.php` for the per-assignment config MUC cache
- [x] `settings.php` for the site-wide default toggle
- [x] `toggle.php` per-assignment toggle handler with sesskey + capability check
- [x] `amd/src/writerview.js` source
- [x] `amd/build/writerview.min.js` build (but see W-2 — needs real minification)
- [ ] `tests/` — **missing** (W-5, not a hard blocker for local plugins)
- [ ] `pix/icon.svg` — recommended, missing (P-2)
- [ ] `db/upgrade.php` — N/A, plugin is on initial schema

---

## Plugin-type-specific checks (local plugin)

- [x] Settings page registered under Site admin > Plugins > Local plugins via `$ADMIN->add('localplugins', $settings)`.
- [x] Navigation extension uses the `local_writerview_extend_settings_navigation` hook (auto-discovered, correctly named).
- [x] No legacy cron in `lib.php` — uses event-driven hooks via `db/hooks.php`.
- [x] DB tables prefixed with component (`local_writerview_config`).
- [x] Capability frankenstyle (`local/writerview:manage`).
- [x] No misuse of `local` as a catch-all — this plugin genuinely belongs as `local` (cross-cutting UI enhancement, not a content type).

---

## Sign-off criteria

Before submitting to the Moodle Plugins directory, work through:

- [ ] Run `moodle-plugin-ci phpcs --max-warnings 0` (and the rest of the suite) — fix everything it surfaces.
- [ ] Regenerate `amd/build/writerview.min.js` via `grunt amd` — see W-2.
- [ ] Update `lang/en/local_writerview.php` `privacy:metadata` string — see W-1.
- [ ] Add `$plugin->supported` to `version.php` — see W-3.
- [ ] Decide on maturity (`BETA` or `STABLE`) — see W-4.
- [ ] Add at least the privacy provider PHPUnit test — see W-5.
- [ ] Address the polish items you care about.
- [ ] Test against MySQL/MariaDB AND PostgreSQL.
- [ ] Test on each Moodle version listed in `$plugin->supported`.
- [ ] Prepare screenshots and a 1–2-sentence description for the Plugins directory listing.
- [ ] Ensure GitHub repo is named `moodle-local_writerview` with files at the repo root (not nested in a subfolder).
- [ ] Confirm the component name `local_writerview` is unmade on https://moodle.org/plugins/.

---

## Appendix: notes

- **No N+1 queries.** Two single-record fetches in `toggle.php`, two in `hook_callbacks.php` (one combined `JOIN` for the assignment + submission, one for the config cache miss path). Both `hook_callbacks` paths are gated behind a MUC cache hit so they don't run on every page load.
- **Strings** all go through `get_string()`. No literals in `echo`, `html_writer`, exception messages. The four MOO-8 strings reuse `mod_assign:submissionstatement`, `core:cancel`, `core:view`, and one new local string `declaration_agree`.
- **Capabilities** are checked at every privileged entry point (`toggle.php`, the navigation extension in `lib.php`).
- **Sesskey** required on `toggle.php`. The settings-navigation link includes `sesskey()` in the URL.
- **No third-party libraries.** No `thirdpartylibs.xml` needed, no bundled CDN code (this was a Cursive pain point on other projects).
- **Output paths** all use `moodle_url`, no string-concatenated URLs.

# Retrospective

## What Worked

- Existing app project was found and preserved.
- Workflow folders were added without changing source structure.
- Current Codex project can display shouqianAPP through the junction entry.

## What Did Not Work

- Initial sandboxed write through the junction was blocked because the real project folder is outside the current writable root.

## Mistakes Or Detours

- Direct writes to the real target required escalated filesystem permission.

## Reusable Method

- For existing projects moved into the Codex date directory, add workflow folders in place and create a junction in the current Codex project when the user wants it visible there.

## Update Global Rules?

- Consider adding a note to the global SOP: existing projects can be onboarded by adding workflow folders without renaming or restructuring the app.

## 2026-07-08 Topology Image And Recording-Host Cabling Notes

### Topology Direct-Line Update

- User clarified that topology lines do not need to be horizontal / vertical.
- The topology should read as a relationship graph: main array mic is the center, connected external devices distribute around it, and direct cable lines show the relationship.
- Keep arrows, cable colors, labels, quantities, and edge-stopping behavior; do not use this visual change to alter connection generation.
- Orthogonal routing was a temporary visual strategy and should not be treated as a business rule.
- Level-1 to level-1 device links have a hard visible edge-to-edge line length of `200px`.
- Level-1 to level-2 device links have a hard visible edge-to-edge line length of `170px`.
- Level-2 to level-3 device links have a hard visible edge-to-edge line length of `120px`.
- The old level-2 to level-3 shortening candidates (`170px / 127.5px / 85px`) are no longer valid.
- Fixed topology line-length calculations must use actual product-image bounds, not the outer virtual device block.
- Browser visual verification may require an installed Playwright browser or the in-app browser tool; if Playwright reports a missing browser executable, record it as a verification limitation rather than a page bug.

### Progress

- `原扩系统` and generic `音箱` topology nodes now reuse the confirmed wall-speaker image instead of showing `待确认`.
- `录播主机` now uses an audio-line topology connection, not USB.
- Removed old external-device drift by filtering imported options to the current visible button choices.

### Guardrail

- Topology product images and cable labels are display / wiring-layer work. Do not use these changes to alter speaker placement, speaker quantities, coverage rules, or array-mic point rules.
- For USB resource logic, keep the priority narrow: all-in-one / computer devices can use USB; `录播主机` uses audio line.

### AP150 Wiring Guardrail

- In topology, do not merge DT-connected speakers and AP150-connected speakers into one speaker node.
- DT / array-mic direct speaker node shows up to 8 speakers.
- AP150 speaker node shows only speakers beyond the DT built-in capacity.
- AP150 speaker channel rule: `<= 4` AP150 speakers means one channel per speaker; `> 4` begins paralleling, with each channel carrying up to two speakers.
- DT Line Out to AP150 audio-line count follows one audio cable per two amplifier channels.
- AP150 speaker node is a satellite of the amplifier in topology layout: keep the amplifier in its normal position and place the connected speaker node nearby.
- `原扩系统` uses the same compact satellite layout idea so the topology canvas is not stretched by a speaker-like legacy node.
- Topology speaker type must come from generated speaker points, not from connection text or selected product name. This prevents `阵麦壁挂` and `功放吸顶` from appearing in the same generated wall-speaker layout.
- Topology cable routes should be orthogonal. When a route is occupied by another device block, choose another in-canvas path; do not expand the canvas just to avoid a line crossing.
- Cable labels should stay parallel to the routed segment, with vertical labels rotated 90 degrees.
- Array mic is always the primary topology node. Amplifier satellite speakers should move to avoid the array mic; never treat the array mic as the node that needs to yield.
- Cable route scoring should keep short line length as the first priority. Use satellite placement to solve major conflicts, not long cable detours.
- Product photos in topology should form clean horizontal / vertical alignment where possible. Paired speaker nodes, such as DT speakers and AP150 speakers, should share a y-coordinate when they represent the same speaker type.
- It is acceptable to make the topology slightly wider when that produces cleaner real-device alignment.
- Every topology cable should show direction. Use from-device to to-device arrowheads, keep arrow color consistent with cable color, and avoid adding extra visual clutter around labels.
- Array mic to normal / passive speaker topology paths must never use `音频线`; they use `音箱线`. Only explicit `有源音箱` targets may receive array-mic audio-line output.
- Classify `原有扩声 / 原系统` before generic `音箱` labels so legacy sound-system text does not become a new speaker node by accident.

## 2026-07-01 Daily Mistakes And Progress

### Mistakes To Avoid

- Do not invent or silently change selection rules. Explain the current trigger, propose the change, and wait for explicit user confirmation before changing rule logic.
- Keep 5174 and 5175 synchronized for shared rules, point maps, angle labels, and calibration display. Do not make the user ask twice.
- Use the user's angle definition for wall speakers: horizontal angle is 0-180 degrees, with 90 degrees perpendicular to the wall. Do not revert to left/right swing wording unless explicitly requested.
- When a rule is not intuitive, improve the calibration UI first instead of continuing to guess automatic rules.
- Do not copy Chinese text from garbled terminal output into source files. Read files as UTF-8 before editing user-facing Chinese copy.
- When a page/server is reported offline, check both 5174 and 5175 after changes and restart only the affected service.

### Progress

- Array microphone quantity and placement rules are mostly calibrated and should be treated as stable unless new cases expose a problem.
- Calibration workbench on 5175 supports manual speaker marking and wall-speaker direction marking.
- Wall speaker angle display is synchronized across 5174 and 5175 using the 0-180 degree definition.
- Wall speaker horizontal angle is constrained to 36-144 degrees for recommended, legacy, and manually marked wall speakers.
- Speaker coverage visualization is drawn with a gradient style, distinct from array microphone coverage.
- Legacy speaker marking supports ceiling/wall type and universal/fixed wall brackets.
- Manual speaker marking hides generated speaker recommendations so calibration marks are easier to inspect.

### Next Starting Point

- Continue speaker calibration from exported JSON and manual point marks.
- Use the user's marked wall/ceiling speaker points to infer rules, then ask for confirmation before modifying automatic selection or placement.

### 2026-07-01 Closing Update

- Treat "confirm" as permission only for the immediately discussed rule. Do not combine it with older suggestions or inferred fixes.
- When the user says "没变", first verify whether the running page loaded the latest code and then inspect the exact rule path before editing.
- For angle work, never change the numeric angle model unless the user explicitly defines or confirms it. Direction display and coverage fan must use the same target.
- Keep daily snapshots: save a pre-clean or stable zip in `.codex-backups` before deep cleanup or large rule edits.
- Current rollback points:
  - `.codex-backups/pre-clean-20260701-175212.zip`
  - `.codex-backups/stable-20260701-181356.zip`

## 2026-07-02 Daily Notes

### Workflow Rules To Remember

- At the start of each new workday, read `logs/execution_log.md` and `logs/retrospective.md` first. This restores persistent instructions after context compaction.
- After any context compaction, resume, handoff summary, or unclear missing context, first read `logs/execution_log.md` and `logs/retrospective.md` before analyzing rules or editing files. This is now also written into root `AGENTS.md`.
- Daily closing workflow is now a bottom-level project rule: first update the logs, then create a fresh `.codex-backups` snapshot and delete older snapshots after the new one succeeds, then do safe code cleanup/checks. Cleanup must not silently change speaker or array-mic rules.
- When the user says "分析 json", default to reading the newest `方案校准记录*.json` file in `C:\Users\73921\Downloads`. Do not start by reading 5175 localStorage unless the user specifically asks for the current browser state.
- For "分析 json", analyze only cases that did not pass by default, especially `fail` cases and cases with notes. Do not expand every untested or passing case unless the user asks.
- When 5174 or 5175 cannot open, first check the known Vite/esbuild sandbox permission issue where `vite.config.ts` cannot be read from inside the sandbox. If that is the cause, start `npm.cmd run dev` / `npm.cmd run dev:calibration` outside the sandbox.
- Confirmation is required specifically for speaker selection, speaker point placement, and speaker quantity rules. Other non-rule work, such as UI cleanup, garbled-text fixes, logs, snapshots, obvious bugs, and server recovery, can be handled directly if it does not change those speaker rules.

### Progress

- Ceiling speaker calibration has started.
- Confirmed ceiling speaker hard coverage rule: nearest AFC / amplification-area ceiling speaker rows use 2.5m coverage radius, and other ceiling speaker rows use maximum 3m coverage radius.
- Started length-to-ceiling-row rule calibration:
  - `length <= 4m`: 1 row
  - `4m < length < 9m`: 2 rows
  - `9m <= length < 12m`: 3 rows
  - `12m <= length < 16m`: 4 rows
  - `length >= 16m`: leave for later calibration
- Width-to-ceiling-column thresholds are not finalized yet; current temporary column count is 2.
- Confirmed ceiling speaker exception: teacher-area / first-row ceiling speakers that only carry multimedia sound and low-level teacher AFC monitoring should still avoid the array mic, but do not forcibly apply the 2m distance rule. A soft distance around 1.5m is acceptable when it prevents awkward first-row displacement.
- Confirmed ceiling rear-row placement rule: when ceiling speakers are used for podium-area amplification or combined-classroom amplification, the speaker rows behind the main array mic are distributed evenly between the main array mic and the rear wall, regardless of how many rear rows there are. The teacher-area / first-row monitoring row is not counted as a rear row.
- Confirmed ceiling front-row placement rule: ceiling speakers in front of the main array mic, or the first ceiling speaker row, should cover the front field as much as possible without exceeding the front coverage limit. The current front-row limit follows the AFC-near ceiling coverage radius of 2.5m, while still respecting the 1.5m minimum front-wall distance.
- Added 5176 as a dedicated speaker selection calibration workbench. Use it for selecting between ceiling speakers, wall column speakers, both acceptable, or neither ideal; keep 5175 for point placement and quantity calibration.
- Confirmed speaker-selection rules: report halls with existing rear-fill / auxiliary speakers use the legacy sound system and do not add new speakers; report halls with rear-fill absent or unknown default to wall columns for rear-fill only; combined classrooms with teaching-area amplification, suspended ceiling, and width at least 10m are treated as ceiling/wall both acceptable in 5176 while engineering point output still defaults to wall columns.

### Mistakes To Avoid

- Even after reading the logs, do not rush into rule edits. In the 5175 ceiling-speaker calibration discussion, Codex treated “删掉” as permission to edit the unconfirmed ceiling-speaker avoidance logic. Going forward, for speaker selection / point / quantity rules, first restate the exact proposed code change and wait for explicit confirmation.

### 2026-07-02 Closing Update

- The daily closing workflow is now mandatory: write logs, save a fresh rollback snapshot and delete older snapshots, then do safe code cleanup/checks.
- Today's final snapshot is `.codex-backups/stable-20260702-193138.zip`.
- Cleanup checks passed: strict TypeScript check passed and production build passed after rerunning outside the sandbox because of the known Vite/esbuild permission issue.
- No actionable old loading-button, front/back candidate, or 1.9m soft-distance remnants remain in source/log scans.

## 2026-07-03 Daily Notes

### Workflow Rules To Remember

- At the start of each new workday, after reading the logs, restore and verify all three active local pages by default: `5174` main engineering app, `5175` point/quantity calibration workbench, and `5176` speaker selection calibration workbench.
- Do not assume the currently open browser tab means every workbench is available. Check each port and restart missing Vite services before continuing calibration work.
- When one of the pages is offline, continue to use the known Vite/esbuild sandbox workflow: start the needed service outside the sandbox, then verify HTTP 200.
- For speaker capacity, do not treat 8 speakers as the total system upper limit anymore. It is only the DT built-in SPK direct-drive capacity; over-8-speaker designs should add YM-AP150 external amplifier expansion through Line Out.
- Device-list amplifier synchronization must run after manual quantity overrides. If the user manually changes ceiling or wall speaker quantity above 8, the external amplifier must appear automatically just like it does for automatically generated speaker quantities.
- Manual speaker quantity overrides are hard targets for the point map. Do not let automatic array-mic avoidance rules reduce the final displayed speaker count after the user manually sets a quantity; reflow or restore the layout instead.

### Progress

- Restored `5174` and `5176`; `5175` was already online.
- Confirmed all three pages returned HTTP 200.
- Added the confirmed YM-AP150 expansion rule and classroom device-list entry:
  - AP150 is a four-channel external amplifier.
  - Each AP150 channel can drive 2 ceiling or wall speakers.
  - One AP150 expands up to 8 additional speakers.
  - One Line Out can feed two AP150 channels, so one AP150 can use up to two DT Line Out signals.
- Updated amplifier naming for user-facing lists: show `教学模拟功放主机` without the model in the device list, while keeping `YM-AP150` in product ID, source document, wiring/capacity notes, and internal logic.
- Updated product selection, wiring notes, capacity summary, quantity UI, and point-map grouping labels to understand AP150 expansion.
- Confirmed the array-microphone rear coverage rule:
  - Primary mic placement remains unchanged.
  - Supplemental mic count is triggered only when the rear wall is more than 2m beyond the current last mic coverage edge.
  - Amplification mics use 5m coverage; online-only pickup mics use 8m coverage.
  - If the primary mic does not amplify, supplemental mics also do not amplify.
  - Podium-area amplification uses the primary mic for amplification and supplemental mics for online/rear pickup by default.
  - Full-room amplification makes both primary and supplemental mics amplification mics.
  - Supplemental mics are evenly distributed between the primary mic position and the point 1m before the rear wall.
  - The last supplemental mic rear-wall distance is at least `supplemental count + 2m`.
  - There is no separate minimum main/supplemental mic spacing rule.
- Confirmed the first ceiling-speaker column-count rule:
  - Width <= 12m defaults to 2 columns.
  - Width > 12m uses the 0.6m-in-from-each-side-wall judging width.
  - Increase columns until adjacent evenly distributed zone centers overlap under the 3m maximum ceiling-speaker coverage radius, so adjacent center spacing is <= 6m.
  - For width > 12m, actual horizontal coordinates use the centers of equal-width zones inside the 0.4m-in-from-each-side-wall selection range.
  - Width <= 12m keeps the original 0.28 / 0.72 two-column horizontal ratios.
  - Keep the 16-speaker single-system recommended upper limit.
- Confirmed the 3-column ceiling-speaker array-mic avoidance rule:
  - Trigger only when ceiling speaker column count is exactly 3.
  - Do not trigger this deletion rule in meeting-room scenarios.
  - Delete one ceiling speaker for each array-mic row, choosing the speaker nearest to that array-mic row.
  - With only the primary array mic row, delete the middle speaker in the first ceiling speaker row.
  - Reflow only rows where a speaker was deleted, using the remaining count in that row.
- Confirmed the meeting-room ceiling-speaker coverage-radius exception:
  - When meeting-room ceiling speaker quantity is <=4, every ceiling speaker uses 2.6m coverage radius.
  - When meeting-room ceiling speaker columns outnumber rows/groups, the column nearest to the array-mic x coordinate uses 2.5m coverage radius.
  - Other columns keep 3m coverage radius.
  - Do not treat this as a point/quantity change.
- Confirmed the meeting-room ceiling-speaker horizontal layout rule:
  - Width <=4m uses 1 column.
  - Width >4m starts from 2 columns and uses the 0.6m-in-from-each-side-wall judging range; add columns while equal-zone-center spacing is >6m.
  - Meeting-room x coordinates use the 0.4m-in-from-each-side-wall selection range and equal-zone centers.
  - Meeting rooms now also use the 3-column array-mic avoidance deletion and reflow affected rows.
- Corrected the meeting-room column-count judging diameter after the user found a 12.4m-wide meeting room still showed 2 columns:
  - The old implementation used the normal 6m diameter even when the meeting-room small-ceiling rule reduced each speaker radius to 2.6m.
  - The confirmed correction is to use 5.2m as the judging diameter while the estimated meeting-room ceiling speaker quantity is <=4, then use the normal 6m diameter for larger layouts.
  - This keeps the 2.6m small-room coverage rule and the width-to-column rule aligned.
- Updated the 3-column ceiling-speaker array-mic avoidance rule:
  - It now has an extra precondition: room length must be greater than room width.
  - Lengthwise rooms can still delete/reflow the nearest ceiling speaker for array-mic avoidance when columns equal 3.
  - Rooms whose length is less than or equal to width keep all 3-column ceiling speakers and do not trigger this deletion.
- Updated the meeting-room ceiling-speaker length-direction rule:
  - Row count now follows the same style as the confirmed width/column rule.
  - Length <=4m uses 1 row; length >4m starts from 2 rows.
  - Use the 0.6m front/rear inset judging range and add rows while equal-zone-center spacing exceeds the active coverage diameter.
  - Use the 0.4m front/rear inset selection range and place y coordinates at equal-zone centers.
  - Estimated meeting-room ceiling speaker quantity <=4 uses 5.2m as the judging diameter; larger layouts use 6m.
- Updated the meeting-room 3-column ceiling-speaker array-mic avoidance rule:
  - Meeting rooms no longer use the old "delete by array-mic row and horizontally reflow the affected row" behavior.
  - For meeting-room 3-column ceiling layouts, keep left/right columns unchanged.
  - The middle column does not keep a fixed count from the original ceiling-speaker rows.
  - Keep the array mic fixed and regenerate the middle column from array-mic gaps.
  - Prioritize inserting one middle-column ceiling speaker between each pair of adjacent array mics.
  - Insert one wall-side middle-column ceiling speaker only when the first/last array mic is at least 4.5m from the front/rear wall.
  - In 3-column ceiling layouts, the middle column coverage radius is 2.5m.
- Reused the same middle-column array-mic gap rule for classroom full-room amplification when array microphones are one per row:
  - If any array-mic row has two microphones, do not use this gap rule; keep the previous classroom 3-column avoidance behavior.
  - Left/right columns stay unchanged, and the middle column is regenerated from array-mic gaps.
  - The reused middle column uses a 2.5m coverage radius.
- Added the classroom/combined-classroom single-mic podium-amplification 3-column ceiling rule:
  - If there is only one array mic and the classroom/combined-classroom is doing podium/teaching-area amplification, delete the middle ceiling speaker in the first row.
  - Reflow only the first row after deletion.
  - This rule should not affect meeting rooms, full-room amplification, multi-mic layouts, or wall speakers.
- Updated that 3-column ceiling avoidance behavior for manual quantity overrides:
  - Automatic recommendations may still reduce the generated count according to the confirmed avoidance rule.
  - Manual overrides must preserve the user's final count, so any removed conflicting ceiling speaker is restored by reflowing the layout rather than reducing the displayed point count.
- Improved point-map coordinate label layout:
  - Dense vertical rail labels now split into multiple side lanes to avoid overlap.
  - Horizontal coordinate labels now use automatic multi-lane placement based on text width.
  - This is display-only UI work and should not be treated as a speaker or array-mic rule change.
- Updated the meeting-room array-microphone count and y-coordinate rule:
  - Meeting rooms do not distinguish primary and supplemental array microphones for placement.
  - Meeting rooms use one centered array microphone per row regardless of width.
  - Use 5m coverage radius for local amplification and 8m for online pickup only.
  - Add array microphones only when front/rear coverage gap is >2m or adjacent microphone spacing would exceed the active meeting-room spacing limit.
  - Adjacent meeting-room array microphones may be at most 8m apart for local amplification and 10m apart for online pickup only.
  - Distribute microphones evenly in the active front/rear wall lower-bound interval.
  - For 2 microphones, first/last microphone must stay at least 3m from the front/rear wall.
  - For 3 microphones, the front/rear wall lower bound is 4m.
  - For 4 or 5 microphones, the front/rear wall lower bound is 5m.
- Confirmed the meeting-room speaker-selection priority:
  - Exposed/no ceiling or unknown ceiling conditions in meeting rooms prioritize wall speakers.
  - Meeting-room length/width >=12m may prefer ceiling speakers only when suspended ceiling is confirmed.
  - Garbled Chinese copy remains in `src/features/classroom/lib/speakerRules.ts`; defer cleanup until end-of-day cleanup so active rule calibration is not disrupted.
- Added the bottom-level garbled-text/code-issue workflow to `AGENTS.md`:
  - Record garbled copy, leftover copy, unused code, debug code, or non-blocking code issues in logs first.
  - Do not clean them during active rule calibration unless they break the current function or app.
  - Process them during the daily closing cleanup.

### Mistakes To Avoid

- Do not change array-microphone quantity or placement again without explicit confirmation. It is in the same protected rule category as speaker selection, speaker point placement, and speaker quantity.
- When mojibake/garbled text is found during calibration, record it first and clean it during the daily closing cleanup unless the user asks to fix it immediately.
- If a code issue breaks TypeScript or app runtime, fix that blocking issue immediately, then record it; do not defer broken builds to end-of-day cleanup.
- When a coverage-radius rule changes for a special case, check whether the corresponding row/column quantity judging rule still uses an old fixed diameter. The 12.4m meeting-room case exposed this mismatch.
- `src/features/classroom/lib/drawingEngine.ts` still contains mojibake/garbled meeting-room array-mic labels/reasons; do not patch them opportunistically during active calibration. Clean them in the end-of-day cleanup pass unless the text blocks current validation.

### 2026-07-03 Closing Notes

- Good correction today: manual speaker quantity overrides must be treated as final point-map targets. Automatic avoidance rules can adjust layout, but should not surprise the user by silently reducing the displayed count.
- Device-list simplification helped reduce UI crowding. For future table work, prefer removing low-value columns over squeezing essential names into narrow columns.
- Meeting-room coordinate labels should stay consistent with field language: front wall, rear wall, left side wall, and right side wall. Avoid neutral coordinate wording when the user is checking construction-style point maps.
- Continue recording mojibake and non-blocking cleanup items instead of cleaning them during calibration. Only clean touched UI text when it is directly part of the requested edit.
- At the next start, read the logs, restore/check 5174/5175/5176, and continue from the latest saved snapshot.
- Today's closing checks passed. The production build again required running outside the sandbox because of the known Vite/esbuild `vite.config.ts` permission issue; keep using that workflow when it recurs.
- User clarified after closing that previously encountered garbled text and bugs must also be covered by bottom-level workflow. `AGENTS.md` was rewritten in normal Chinese to make this explicit: log first, defer non-blocking fixes, and resolve them in the daily closing cleanup step.

### 2026-07-04 Midday Note

- Found a protected-rule mismatch in the 6m x 18.3m meeting-room ceiling-speaker case: row count currently judges 3 rows as enough using the meeting-room grid diameter, but final coverage drawing can reduce rows near array microphones to a 2.5m radius, so the visible coverage no longer touches.
- Do not repair this silently. Before changing code, restate whether the intended correction is to make meeting-room ceiling row quantity follow the final effective coverage diameter, or to stop the generic row AFC reduction from applying in that meeting-room case.
- User confirmed the correction: ceiling-speaker grid judging should use adjacent speakers' actual coverage radii added together, not fixed 5m / 6m diameter shortcuts. The meeting-room grid now checks candidate points against actual point-map radii before deciding whether to add rows/columns.
- Deferred issue: 12.4m x 8m meeting-room ceiling layouts can still calculate a default 6-speaker grid while the existing 3-column center avoidance leaves 4 drawn points. This needs a separate protected-rule confirmation before changing.
- User confirmed ceiling-speaker output grouping rules. Important correction: when ceiling-speaker quantity is <=8, AP150 is not configured, so only `SPK1-SPK4` may appear even if ideal AFC grouping would want more groups. For >8 speakers, AP150 expansion labels can appear after the first four DT SPK groups.

### 2026-07-04 Combined Classroom Note

- User confirmed that combined classrooms should not treat the teaching-area rear edge as a rear wall. This was the cause of ceiling speakers being pulled too close to the front/teaching area in the current point map.
- Implemented the correction by removing the combined-classroom teaching-depth rear cap and disabling the old teacher-monitor reserved row for combined classrooms.
- Combined-classroom seating-area wall-speaker coverage is now represented as 5m for the first seating row and 6m for later rows.
- Keep future combined-classroom changes scoped carefully: teaching area + seating area share one speaker type and one total speaker limit.

### 2026-07-04 Closing Notes

- Important separation learned today: in combined classrooms, speaker coverage may continue from teaching area into seating area, but array-mic placement should remain bounded to the teaching area by default.
- Do not reuse "rear wall" helper functions across speakers and array mics without checking the scenario boundary first; combined classrooms now need separate targets for speaker coverage and pickup placement.
- The user wants 5174 refreshes to preserve presales collection state. Keep `yiou-presales-draft-v1` behavior unless the user explicitly asks for a reset/clear-draft control.
- `AGENTS.md` was restored to readable Chinese during closing cleanup. Keep future bottom-level rules in that file as normal Chinese.
- Next start: read logs first, restore/check 5174/5175/5176, and continue with the current combined-classroom state if the user resumes this calibration thread.

### 2026-07-04 1.0 Release Note

- For internal-test release work, do not expose calibration workbenches, rule-change governance text, recommendation reasons, engineering basis tables, or long text reports in the public 1.0 UI.
- Static frontend protection is limited. The practical release posture is: minify, disable sourcemaps, remove calibration chunks from production, hide rule explanations from visible UI/report, and lightly obfuscate report import payloads.
- The internal-test report must remain importable so calibration problems can be reproduced from customer/user feedback.
- The single-file HTML release is the preferred handoff artifact for non-technical testers; the zip also includes the software outline.

### Reusable Release SOP

- When the user asks to publish a new version, first define the visible module boundary for that version. For 1.0 internal test, the boundary is presales collection, project archive, device list, and point map only.
- Keep calibration and rule-calibration tools development-only. In production, avoid static imports from calibration workbenches, and verify no calibration chunk is emitted.
- Keep reports useful for debugging but not educational for competitors: include enough profile/override data for import, but do not show rule explanations, recommendation reasons, engineering-basis tables, or calibration notes in the visible report.
- Treat static "encryption" honestly: production minification, no sourcemaps, hidden calibration UI, removed rule text, and lightly obfuscated payloads are practical protection, not true algorithm secrecy.
- Build and release sequence:
  - strict TypeScript check
  - production build, rerun outside sandbox if Vite/esbuild hits the known `vite.config.ts` permission issue
  - `dist` keyword scan for hidden-public surfaces
  - single-file HTML packaging
  - software outline update
  - zip packaging and extraction check
- Future release artifacts should follow the 1.0 pattern under `outputs/<release-folder>/` plus one top-level zip in `outputs/`.

### Single-File HTML Packaging Lesson

- Do not inject minified JS into HTML using `String.replace(pattern, jsString)` directly. `$` sequences in the JS can be interpreted as replacement placeholders and corrupt the output.
- Always use callback replacement when embedding JS/CSS into a single-file HTML release.
- Always escape `</script` inside embedded JS as `<\/script`.
- After generating a single-file release, verify the final HTML itself:
  - one script open tag and one script close tag
  - no minified-code fragments visible outside script/style blocks
  - app root is present
  - zip is recreated after the fix
- Browser plugin currently blocks reload/DOM inspection of `file://` pages. Do not bypass that policy. If browser-level file verification is required, ask the user to manually refresh/open the fixed file or choose an approved verification route.

### Universal Single-HTML Release Lesson

- Prefer one shared desktop/mobile delivery file instead of separate computer and phone files.
- Current 1.0 handoff filename uses Chinese: `翼欧售前音频方案工具-1.0.html`.
- If a future chat app or device mishandles Chinese filenames, discuss a fallback filename with the user before changing it.
- Generate universal artifacts with `npm.cmd run release:universal` after the single-file release exists.
- Keep delivery as a standalone HTML file, not a zip, unless the user specifically asks for a package.
- Add mobile-compatible meta tags during generation; these are safe for desktop browsers:
  - `viewport-fit=cover`
  - `format-detection telephone=no`
  - `theme-color`
- Verify the universal HTML through a local HTTP server when browser tooling blocks direct `file://` inspection.
- Use both a mobile viewport, such as 390x844, and a desktop viewport, such as 1280x720, and confirm:
  - the app renders instead of source code
  - the point map SVG exists
  - no internal calibration surfaces are visible
  - no minified-code fragments appear as page text
- For phone/local-file compatibility, do not leave the inlined bundle as `<script type="module">` in the final handoff HTML.
- Convert the inlined bundle to a classic script and place it after `<div id="root"></div>` near the end of `<body>`, otherwise classic script execution can run before the root element exists.
- Practical device guidance:
  - Desktop: open directly with Chrome, Edge, Safari, or another modern browser.
  - Android / HarmonyOS: open with a normal system browser.
  - iOS: save to Files, then open with Safari.
  - Avoid WeChat / QQ embedded preview for formal testing because import, export, and local storage may be restricted.

### Mobile Compatibility Test SOP

- Before handing off a universal HTML release, run `npm.cmd run test:release-mobile`.
- This test covers:
  - Android Chrome / Pixel 7 over HTTP
  - Android Chrome / Pixel 7 as a local file
  - iOS Safari / iPhone 14 using WebKit over HTTP
  - iOS Safari / iPhone 14 using WebKit as a local file
- Treat the test as failed if:
  - the app title / root workspace does not render
  - the fallback loading warning remains visible
  - the point map SVG is missing
  - internal calibration strings appear
  - browser page errors occur
- This is the best repeatable computer-side test in the local workflow. It still does not fully reproduce WeChat / QQ embedded file preview policies on real phones, so final human smoke test should use Safari / Chrome / system browser rather than chat-app preview.

### 2026-07-04 Closing Notes

- 1.0 internal-test release is now organized as one clean release folder with three files: `翼欧售前音频方案工具-1.0.html`, `翼欧售前音频方案工具-1.0-软件大纲.md`, and `README-打开说明.txt`.
- The software outline now carries the product roadmap from 1.0 through 4.0 and the overall chain from presales collection to onsite feedback.
- Mobile compatibility testing is now repeatable on the development computer through `npm.cmd run test:release-mobile`, including Android Chrome and iOS WebKit over both HTTP and local file URLs.
- Array microphone symbols now include a short black front-wall direction mark. The mark means array mic `0°`; it must stay inside the mic square and must not be described as pointing toward the podium.
- Future release work should regenerate through `npm.cmd run release:universal`, then run `npm.cmd run test:release-mobile`, then zip the clean release folder.

### 2026-07-05 Working Notes

- `5176` is now the wiring/topology calibration workbench, not the speaker-selection calibration workbench.
- Preferred startup command for `5176` is now `npm.cmd run dev:wiring-calibration`; the old `dev:selection-calibration` script is only a compatibility alias.
- Keep `5175` as the focused point/quantity calibration workbench; `5176` should only keep one point map for reference and manual correction.
- It was acceptable to remove the garbled old `SelectionCalibrationWorkbench.tsx` during this task because the user explicitly asked to replace the whole 5176 workbench. Do not use this as permission to clean unrelated garbled files during active rule calibration.
- The new `5176` calibration record should be used for wiring/topology problems: interface port names, connection directions, AP150 expansion wiring, line-out/SPK grouping, and topology signal-flow readability.
- The new `5176` point-map section is for comparison only. Any future changes to speaker/array-mic quantity or placement still require the protected-rule confirmation flow.
- Git metadata appears unhealthy: a `.git` folder exists, but `git status` fails with `fatal: not a git repository`. Do not rely on git diff/status until that is repaired.
- `5175` was restored after the temporary ceiling-only calibration phase. Going forward, `5175` should show the single point map that the system actually recommends, not a forced ceiling/wall variant, and can include a wiring/topology reference section generated from the same active case.
- Confirmed legacy speaker overlap rule: outside report halls, `原有扩声系统` alone must not suppress normal new speaker point generation. Marked legacy speaker points replace generated speaker points only when the legacy coverage overlaps at least 60% of that generated point's coverage area. Device-list speaker quantity must follow the filtered generated point count.
- Important correction for overlap wording: "ignore whether it is wall or ceiling" means compare across speaker types, not that all speakers become circular coverage. Use each speaker's real coverage shape: ceiling = circle, wall = directed sector. Keep point-map wall coverage visuals aligned with that calculation.

### 2026-07-05 Error Review: Protected Rules And Geometry Checks

Today exposed a serious workflow problem: I was too willing to "fix" or reinterpret calibrated behavior while the user was still questioning the result. This is not acceptable for this project.

Errors to remember:

- I treated an ambiguous business sentence as a geometry rule. "不管壁挂还是吸顶" meant cross-type overlap comparison, not that all coverage should become circular.
- I changed the visible wall-speaker coverage drawing without explicit approval. Visible coverage range is part of the calibrated output and must be treated as protected.
- I used visible label positions as part of the explanation before verifying actual SVG body positions or generated point data. Label placement is for readability and can mislead geometry analysis.
- I answered too confidently before proving the page had the latest code and before separating old behavior, new confirmed rule, and my own mistaken interpretation.
- I did not stop myself early enough when the work crossed from "overlap deletion algorithm" into "speaker coverage display." That boundary must be explicit.

Permanent guardrails:

- Protected rule changes include not only final counts and coordinates, but also coverage radius, coverage shape, deletion conditions, and visible coverage drawings.
- User questions are not confirmation. "为什么", "是不是", "你确定吗", "这是什么规则", and "怎么能这么算" all mean pause and explain first.
- When checking a point-map problem, first verify the actual point bodies / generated data; use labels only as annotations.
- Keep algorithm changes and rendering changes separate in both code and explanation.
- If a correction touches an already calibrated visual, ask first even if the algorithm change has been confirmed.
- End every protected-area fix with a short negative statement of scope, for example: "未改音箱覆盖范围 / 未改点位数量 / 未改阵麦规则", so the user can quickly see what stayed untouched.

### 2026-07-05 Deferred Check: Legacy Wall Coverage Must Match What User Sees

- A legacy wall speaker can visually appear to overlap a generated ceiling speaker by more than 60%, while the deletion algorithm may keep the generated ceiling speaker because it calculates overlap from a directed-sector model.
- Before any future fix, clarify the intended source of truth:
  - use the exact visible drawn coverage as the deletion geometry; or
  - keep the engineering calculation as source of truth and adjust the drawing / debug explanation so the visual matches the calculation.
- Do not change speaker coverage radius, sector angle, drawing range, or deletion threshold without protected-rule confirmation.

Resolved after confirmation:

- User confirmed that the deletion calculation should follow the point-map visible coverage.
- The fix changed the overlap calculation to match the existing drawing; it did not change the drawn wall-speaker coverage range.
- Lesson: when the user judges an overlap from the point map, the algorithm must use the same geometry the user sees, or the UI must expose a separate engineering-debug overlay. Hidden geometry that disagrees with the visible point map is not acceptable for calibration.

### 2026-07-05 Legacy Ceiling Speaker Radius

- Confirmed rule: marked legacy ceiling speakers default to a 3m coverage radius.
- Keep this separate from generated ceiling-speaker rules. Do not "clean up" by changing the shared ceiling ideal radius constant, because that would also affect manual/generated display surfaces.

### 2026-07-05 Full-Room Wall Speaker Placement And Override Boundary

- Confirmed rule: when full-room amplification uses wall speakers, wall placement follows room shape for both meeting rooms and classrooms:
  - length > width: front/rear walls first;
  - length < width: side walls first;
  - length = width: four-corner placement first.
- Confirmed UI rule: customers can force automatic / ceiling / wall speaker scheme selection, but the app must show risk reminders.
- Important boundary from the user: this is speaker-only. Do not change classroom array-mic count, coordinates, or coverage when applying this rule.
- Follow-up: user chose to hide this speaker scheme override UI for now because the requirement needs more calibration. Keep the internal field as reusable dormant code, but 5174 should reset hidden values to `auto` so old drafts cannot invisibly force a scheme.

### 2026-07-06 Meeting-Room Wall Center-Fill Lesson

- Confirmed meeting-room no-ceiling wall center-fill thresholds:
  - `long dimension > 14m`: add 1 center-fill group.
  - `long dimension >= 20m`: add 2 center-fill groups.
- Confirmed center-fill coordinate method:
  - One group uses the selected axis midpoint.
  - Two groups use the selected axis after removing 5m from both ends, then take 25% / 75% zone centers.
- Confirmed center-fill speaker defaults:
  - forced 90 degree aim into the room;
  - 5m coverage radius;
  - AFC send-level offset -5.
- Mistake to avoid:
  - Do not use visible label count as point count. The point-map label merger can hide labels while the speaker bodies remain on the drawing. When checking speaker quantity, use generated point data, body geometry, device-list quantity, or visible point markers, not only text labels.

### 2026-07-06 Wall Speaker Coverage-Length Definition

- Permanent wall-speaker coverage definition:
  - The configured wall-speaker coverage length is the maximum distance from the speaker point to any point on the fan-shaped coverage boundary.
  - A 7m wall-speaker coverage means the circular sector radius is 7m, not that the arc baseline is 7m with an extra bulge beyond it.
  - A 5m center-fill wall-speaker coverage uses the same maximum-distance definition.
- Implementation guardrail:
  - Point-map wall-speaker fan drawing and legacy-overlap sampling must use the same geometry.
  - Do not reintroduce a separate visual reach or curved-end extension that makes the visible fan reach farther than the configured coverage length.
  - If future wall coverage appearance changes, first confirm whether the change affects visible range, overlap deletion, or both.

### 2026-07-06 Backup Retention

- Superseded on 2026-07-08: future daily closing backups should retain only the newest one valid `.codex-backups` snapshot zip because Git now keeps dated daily / release archive points.
- Create and verify the new snapshot before deleting older snapshots.
- Delete only snapshots older than the newest valid backup zip file.

### 2026-07-06 Ceiling Center-Column Avoidance

- For ceiling-speaker layouts, prefer narrow post-layout safety passes over changing upstream row/column generation when the problem is a local conflict.
- Confirmed reusable pattern:
  - If ceiling columns are exactly 3 or 5, and both array mics and ceiling speakers occupy the center column, delete only the nearest center-column ceiling speaker when it is within 2m of an array mic.
  - Keep side columns and array-mic points unchanged.
- Verification reminder:
  - Label merging can hide point labels. Confirm changes with device quantity and coordinate/point geometry, not label count alone.

### 2026-07-06 Point-Map Label Avoidance

- Parameter cards are display annotations, not placement rules. Fixing their overlap should stay in `DrawingCanvas` label layout and must not alter generated point data.
- Reusable pattern:
  - Convert visible point symbol bodies into small rectangular label obstacles.
  - Score parameter-card candidate positions against those obstacles.
  - Place parameter cards sequentially and add each placed card back into the obstacle list for later cards.
  - After card-to-card adjustment, re-check symbol-body obstacles; otherwise a card can be pushed away from another card and end up covering an array mic.
  - Do not include coverage circles or wall-speaker fan areas as label obstacles, because that would push cards too far from the point and reduce readability.
- Verification reminder:
  - Check SVG label rectangles against point symbol bodies, not just screenshots by eye.
  - Also check label rectangles against each other; a point-body-only check is not enough.
  - A stale Vite/HMR console error during editing should be distinguished from a post-reload runtime overlay before reporting page health.

### 2026-07-06 Central-Air Clearance Lesson

- Do not reduce central-air avoidance to a single fixed distance unless the user explicitly defines it that way.
- Current reusable rule:
  - The hard array-mic clearance from central-air body is dynamic and comes from reverberation risk.
  - Low reverberation uses `0.5m`, medium reverberation uses `0.8m`, and high reverberation uses `1.0m`.
  - Local amplification / interactive class increases AFC quality risk and should be explained in the `1m` warning zone, but it should not automatically raise medium reverberation to `1.0m`.
  - High reverberation always requires the farthest clearance in the current `0.5m-1.0m` range.
  - The 1m zone is still meaningful as a restore-quality warning zone, but it is not always the hard install boundary.
- Guardrail:
  - Keep the generation algorithm, point-map safety boundary, calibration console, and risk text using the same clearance function.
  - If this rule changes again, update all four surfaces together and explicitly state that speaker rules are unaffected.

### 2026-07-06 Wall Speaker Coverage Tiers

- Correct wall-speaker fan rendering exposed that some older wall-speaker rules had effectively been calibrated against an over-long visual fan.
- Do not treat `7m` as the default wall-speaker coverage length in every case. It is the current maximum boundary.
- Current generated wall-speaker coverage tiers:
  - Near array mic / AFC-risk: `5m`.
  - Meeting-room no-ceiling center-fill: `5m`.
  - Combined-classroom seating: nearest seating row `5m`, other seating rows `6m`.
  - Ordinary full-room wall speakers: `6m`.
  - Podium/local-amplification rear-fill rows: `5m`, `6m`, then capped at `7m`.
- Guardrail:
  - Coverage length changes are protected visual/engineering rules. Confirm before changing thresholds, quantities, coordinates, sector angle, or maximum radius.
  - If wall-speaker coverage looks insufficient after this tiering, next step should be recalibrating quantity/add-group thresholds, not silently stretching the fan drawing.

### 2026-07-06 Ordinary Classroom Wall-Speaker Sync Guardrail

- Confirmed rule boundary:
  - Ordinary classroom / lecture classroom full-room amplification can share meeting-room wall-speaker count, add-group coordinates, and side-wall inward symmetric aiming.
  - This is speaker-only. Do not let it modify classroom array-mic placement.
- Current shared thresholds:
  - Max dimension `<= 14m`: 4 wall speakers.
  - Max dimension `> 14m`: 6 wall speakers.
  - Max dimension `>= 20m`: 8 wall speakers.
- Current shared add-group placement:
  - One group: midpoint of the selected installation axis.
  - Two groups: remove `5m` from both ends and place groups at 25% / 75% of the remaining interval.
  - Added center-fill speakers force 90-degree inward aim, 5m coverage, and AFC send offset `-5`.
- Current shared side-wall aiming:
  - Side-wall speakers aim inward symmetrically toward the nearest/center array-mic target.
  - Outermost groups use the existing 7-degree outward offset behavior.
- Guardrail:
  - Do not use the old classroom fallback `length > 11 ? 6 : 4` for full-room wall-speaker cases.
  - Do not apply this sync to combined-classroom seating, auditorium, ceiling-speaker layouts, or podium/local-amplification layouts unless separately confirmed.

### 2026-07-06 Release Pipeline Guardrail

- Release scripts are reusable release infrastructure and must not contain mojibake paths, garbled README text, or garbled software outline content.
- Current 1.0 internal-test release package convention:
  - Output directory: `outputs/翼欧售前音频方案工具-1.0-内部测试版-260706`.
  - Zip package: `outputs/翼欧售前音频方案工具-1.0-内部测试版-260706.zip`.
  - Main HTML inside package: `翼欧售前音频方案工具-1.0.html`.
  - Companion files: `README-打开说明.txt` and `翼欧售前音频方案工具-1.0-软件大纲.md`.
- Keep Vite's inline `type="module"` script in the universal release.
  - Do not convert it to a normal script unless a future compatibility test proves it is necessary.
  - A previous conversion caused mobile rendering to stop on the fallback loading page with `Unexpected token '<'`.
- Mobile release validation should include:
  - Structural single-file checks: inline JS, inline CSS, no external `./assets` references, normal Chinese title, no known mojibake signatures.
  - Android Chrome / Pixel 7 rendering over local HTTP.
  - iOS Safari / iPhone 14 WebKit rendering over local HTTP.
- Browser plugin limitation:
  - Direct `file://` release verification may be blocked by browser-control policy.
  - Do not work around that policy through alternate browser control; use structural file checks plus local HTTP rendering checks, and tell the user direct file navigation could not be verified by the plugin.
- Build guardrail:
  - If Vite / esbuild fails to read `vite.config.ts` because of sandbox access, request approved escalation for `npm.cmd run build` rather than editing config or changing build logic.

### 2026-07-06 Customer-Facing Recheck Copy Guardrail

- "复勘提醒" is customer-facing / sales-facing guidance, not a calibration explanation panel.
- Keep reminder copy short and impact-oriented:
  - Use "什么因素会影响什么结果".
  - Avoid explaining detailed judgment logic, thresholds, algorithm reasons, or internal calibration rules.
  - Avoid text that sounds like the software is teaching the full rule chain.
- Future release checklist:
  - Before packaging a customer/internal-test release, scan visible "复勘提醒" copy for over-explaining.
  - Move detailed reasoning to logs, calibration records, or internal tools only.

### 2026-07-06 Mojibake Cleanup Guardrail

- When the user asks to clean mojibake / residual bugs, treat it as text and infrastructure cleanup unless they explicitly confirm a business-rule change.
- Do not change speaker placement, speaker quantity, coverage geometry, array-mic placement, or array-mic quantity during a mojibake cleanup pass.
- Scan scope for cleanup:
  - Include `src`, `scripts`, `AGENTS.md`, `README.md`, and generated text / HTML files under `outputs`.
  - Exclude formal historical project logs from automatic rewriting; append a resolved note instead of erasing old decision history.
  - Temporary runtime logs such as stale Vite `.log` / `.err.log` files can be deleted during cleanup after confirming they are not the formal execution or retrospective logs.
- Encoding guardrail:
  - Do not rewrite a whole TypeScript source file with shell text writers when it already contains non-ASCII text; this can damage encoding and create widespread syntax errors.
  - Prefer `apply_patch` for small source edits. For broad text changes, first run `tsc`, take/confirm a backup, then use a controlled script that preserves UTF-8 and immediately re-run `tsc`.
- Current clean baseline:
  - After the 2026-07-06 cleanup, source / script / output scans found no known mojibake signatures.
  - The release mobile-compat test still checks for known mojibake, but the detector uses Unicode escape strings so scans do not mistake the detector for a garbled-text leak.

### 2026-07-06 AGENTS.md Encoding Display Guardrail

- If `AGENTS.md` appears garbled through PowerShell `Get-Content`, first verify with a UTF-8 reader such as Node before treating it as file corruption.
- Current classification:
  - PowerShell display mojibake for `AGENTS.md` is a terminal encoding/rendering issue.
  - Node UTF-8 reading shows the file content is normal.
- Guardrail:
  - Do not rewrite `AGENTS.md` or other Chinese rule files only because terminal display looks garbled.
  - Prefer narrow `apply_patch` edits for rule additions.
  - After any edit, verify with Node UTF-8 output and mojibake signature scanning.
- Damaged-character handling:
  - If damaged characters appear in visible product text such as avoidance labels, review reminders, installation advice, risk tips, buttons, or table fields, log the affected surface first.
  - Clean those text issues during daily closing cleanup unless they block the active calibration task.

### 2026-07-06 Suspended-Ceiling Install Height Guardrail

- Current rule:
  - If the room has suspended ceiling, array mic install height follows the ceiling height and is labeled as embedded / flush ceiling installation.
  - If the room has suspended ceiling and the selected speaker is ceiling-mounted, ceiling speaker install height also follows the ceiling height.
  - Wall-mounted speaker install height stays on the wall-speaker rule and should not be pulled up to ceiling height.
- Guardrail:
  - Do not reintroduce the old `3.6m` branch that asks users to choose between embedded ceiling and lowered hanging for suspended-ceiling rooms.
  - Keep visible recheck copy short and impact-oriented: ceiling height affects array mic and ceiling speaker installation height.
  - Do not use this rule to change speaker placement, speaker quantity, speaker coverage, array-mic placement, or array-mic quantity.

### 2026-07-06 Ceiling Speaker 2m Radius Guardrail

- Current confirmed rule:
  - Ceiling speaker coverage radius is locked at `2m`.
  - Adjacent ceiling-speaker center spacing must be judged by actual adjacent radius sum: `2m + 2m = 4m`.
  - This applies to new generated ceiling speakers, manual ceiling-speaker markers, and legacy ceiling-speaker markers.
- Implementation guardrail:
  - Do not reintroduce separate ceiling-speaker tiers such as `2.5m`, `2.6m`, or `3m`.
  - Do not judge ceiling-speaker row / column addition by fixed old values like `5m` or `6m`; use adjacent coverage radii.
  - When a center-column ceiling speaker is deleted to avoid an array mic, re-check whether the remaining center spacing still fits the `4m` rule.
  - If the 16-speaker recommendation cap is exceeded after the `2m` rule, do not silently stretch coverage. Flag split-zone / special design review instead.
- Scope guardrail:
  - This rule is for ceiling speakers only.
  - Do not change wall-speaker fan radius / length, wall-speaker coordinates, or array-mic rules while applying it.

### 2026-07-06 High Suspended-Ceiling Selection Guardrail

- Current confirmed rule:
  - Non-auditorium rooms with suspended ceiling height `>= 4m` are classified as high reverberation risk.
  - Automatic speaker selection recommends wall-mounted column speakers, not ceiling speakers.
- Guardrail:
  - Run this rule before normal suspended-ceiling recommendations for meeting rooms and classrooms.
  - Keep manual speaker override available; if a user explicitly selects ceiling speakers, output the selected scheme with a short risk reminder.
  - Do not apply this rule to auditorium unless separately confirmed.
  - Do not use this rule to change wall-speaker placement, wall-speaker coverage, ceiling-speaker 2m radius, array-mic placement, or array-mic count.
- Copy rule:
  - Customer-facing reminders should stay impact-oriented, e.g. `吊顶高度会影响扩声清晰度。`

### 2026-07-06 Wall Speaker Install Height Guardrail

- Current wall-speaker install-height rule:
  - A room uses one unified wall-speaker base install height.
  - Base install height is relative to local floor and must stay within `2.2m-2.7m`.
  - Base height is calculated from the largest wall-speaker coverage length in the room:
    - `3.5m -> 2.2m`.
    - `7m -> 2.7m`.
    - Intermediate values use linear interpolation.
  - Down-tilt angle is per speaker and should use that speaker's target distance / target height.
- Lecture-classroom rule:
  - Lecture classroom has only podium-area amplification; do not apply full-room amplification logic.
  - Audience area starts `1m` behind the primary array mic.
  - Step height rises `0.2m` per meter after that start.
  - For lecture wall speakers, actual displayed install height is `base install height + speaker-position step height`.
  - Down-tilt calculation counts both the speaker-position step height and the target-position step height.
  - Parameter cards should show the two parts, e.g. `安装高度 2.5m + 阶梯 0.4m`.
- Guardrail:
  - Do not change wall-speaker point count, coordinates, or coverage while adjusting install height / down-tilt.
  - Do not unify down-tilt across the room; only install height is unified.

### 2026-07-06 Ceiling Speaker Horizontal Distribution Guardrail

- Confirmed rule:
  - Column count is `ceil((room width - 1m) / 4m)`, with a minimum of 1 column.
  - One column is centered.
  - Multiple columns are placed at equal-zone centers inside the actual horizontal coverage width.
  - Actual horizontal coverage width is `room width - 1m`, because both side walls are inset by `0.5m`.
  - Coordinate formula: `x = 0.5 + (room width - 1) * (index + 0.5) / columnCount`.
  - Example: a `10m` wide room has `9m` actual coverage width, 3 columns, and x positions `2m / 5m / 8m`.
- Preserve the confirmed protections:
  - ceiling radius remains `2m`;
  - column count still uses the confirmed `4m` adjacent-spacing basis;
  - 3-column / 5-column center-array-mic avoidance remains active;
  - center-column deletion / insertion logic must not be changed by a horizontal count/coordinate fix;
  - do not change array-mic placement, wall-speaker rules, or vertical row rules.
- Confirmation guardrail:
  - Do not change ceiling-speaker column count, x-coordinate formula, or center-column avoidance again without first explaining the exact trigger and waiting for confirmation.

### 2026-07-06 Repeated Confirmation-Boundary Failure

- Failure pattern:
  - When the user points at an obviously wrong point-map result, I sometimes identify the likely cause and immediately patch the protected business rule.
  - This happened again on the `17.2m x 7.7m` meeting-room ceiling-speaker case: I changed center-row avoidance behavior before waiting for confirmation.
- Why this keeps happening:
  - I treated "the bug is obvious" as if it were permission to change a speaker point rule.
  - I collapsed three separate steps into one: diagnose, propose, implement.
  - I prioritized speed over the project's explicit confirmation boundary.
  - I forgot that avoidance/deletion/reflow rules are protected just like speaker count and coordinates.
- Required behavior going forward:
  - For any speaker selection, speaker count, speaker coordinate, speaker deletion, speaker avoidance, speaker reflow, array-mic count, or array-mic coordinate issue, stop after diagnosis.
  - First state:
    - current triggered rule;
    - why the result is wrong or unintuitive;
    - exact proposed rule change;
    - affected scenarios;
    - protected scope that will not change.
  - Wait for the user's explicit confirmation before editing code.
  - If I accidentally edit first, immediately revert the unconfirmed code and record the mistake.
- Practical self-check before `apply_patch`:
  - If the patch changes a function with names such as `Speaker`, `ArrayMic`, `Position`, `Count`, `Avoid`, `Conflict`, `Reflow`, `Coverage`, `Row`, or `Column`, treat it as protected unless the user has explicitly confirmed the exact change.

### 2026-07-06 Point Counting Mistake

- Mistake:
  - I counted ceiling speakers by selecting SVG groups whose text included `吸顶音箱SPK` or `吸顶音箱AP150`.
  - That only counted speakers with visible parameter-card text in the same group.
  - It missed right-side speaker symbols that had no parameter card text attached, so I incorrectly reported 5 speakers when the SVG actually contained 9 speaker bodies.
- Correct method:
  - Count actual speaker symbol bodies or coverage circles, not parameter-card groups or labels.
  - For ceiling speakers, count the visible symbol circles (`stroke="#00dede"` / body circle) or generated point data.
  - Use labels only as annotations; labels can be omitted, merged, or moved and are not reliable for quantity.
- Guardrail:
  - Before explaining "被删了几个" or "生成了几个", verify with actual point bodies / generated data.
  - Do not use parameter cards, coordinate rails, or visible label count as the source of truth for point quantity.

### 2026-07-06 Center-Row Ceiling Deletion Removed

- Confirmed new guardrail:
  - Do not use the old width-greater-than-length `3-row / 5-row` center-row deletion rule anymore.
  - In wide rooms, center-row ceiling speakers should not be automatically deleted just because an array mic is within `2m`.
- Why:
  - The old rule created unstable results around threshold lengths. Example: `14.5m` width with `11.1m / 11.2m / 11.3m` length could keep, delete, then keep the second-row speaker because one-decimal array-mic coordinates moved around the hard `2m` threshold.
- Still protected:
  - This removal does not permit changing center-column avoidance for `length > width`.
  - Ceiling radius, row/column count, coordinate formulas, array-mic rules, and wall-speaker rules remain separate protected rules.
- Process reminder:
  - This was handled correctly after explicit user confirmation. Keep this sequence: diagnose -> propose -> wait for confirmation -> edit -> verify.
- Cleanup reminder:
  - Mojibake / damaged Chinese text was observed again in source reads. Record first, clean during a dedicated cleanup pass, and do not combine that cleanup with active speaker-rule changes unless it blocks the current function.

### 2026-07-06 Ordinary Classroom Wide Array-Mic Columns

- Confirmed rule:
  - Ordinary classroom full-room amplification now lets width raise the minimum array-mic count.
  - `width > 14m` gives a two-mic front row.
  - `width > 20m` plus depth/rear supplemental need gives at least `2 + 2` mics, while preserving the existing max of `5`.
- Guardrail:
  - This rule is only for ordinary classroom full-room amplification.
  - Do not apply it to podium-area amplification, lecture classrooms, meeting rooms, auditoriums, combined classrooms, or speaker rules unless separately confirmed.
  - Keep y-coordinate generation and the existing two-column x-coordinate formula unchanged unless the user separately confirms a coordinate calibration.

### 2026-07-06 Center-Axis Ceiling Clear-And-Backfill Guardrail

- Confirmed rule:
  - For `3/5 columns` with `length > width`, center-column avoidance must clear all original center-column ceiling speakers first, then add only gap-derived backfill points.
  - For `3/5 rows` with `width > length`, center-row avoidance must clear all original center-row ceiling speakers first, then add only gap-derived backfill points.
- Why:
  - Keeping non-conflicting old center-axis speakers can still leave a speaker too close to, or visually overlapping, an array mic when array-mic positions shift after width/depth rules.
  - The center axis should be regenerated from array-mic gaps, not treated as a partially preserved original row/column.
- Guardrail:
  - Do not reintroduce nearest-only deletion on the center axis for these shared ceiling layouts.
  - Backfill thresholds remain `3.5m` between adjacent mics and `4m` from wall to nearest/farthest mic unless separately confirmed.
  - This is a ceiling-speaker avoidance rule only; do not use it to change array-mic count/position, ceiling base grid, coverage radius, wall speakers, or selection logic.

### 2026-07-06 Wide Classroom Rear Array-Mic Pair Guardrail

- Confirmed rule:
  - In ordinary classroom full-room amplification, once `width > 14m` triggers the front-row two-column array-mic rule, any rear supplemental row should also reuse the front row's two-column x-coordinate selection.
  - Do not allow `[2, 1]` for this wide-classroom case; promote it to `[2, 2]`.
- Guardrail:
  - Keep the rule scoped to ordinary classroom full-room amplification.
  - `width <= 14m` should not trigger width-based add-column.
  - Do not change array-mic y-coordinate distribution or the existing `5`-mic maximum without separate confirmation.

### 2026-07-06 Lecture Classroom Podium-Only Guardrail

- Confirmed rule:
  - 阶梯教室只有讲台区域扩声，不存在全场扩声方案。
  - Imported data, saved drafts, random cases, or older calibration cases that carry `full` must be normalized to `podium` for lecture classrooms.
- Audience step display:
  - 后排听众区从主阵麦后 `1m` 开始显示。
  - 听众区高度按每向后 `1m` 增加 `0.2m` 估算。
  - 阶梯高度只按完整 1m 阶梯数计算；不要用剩余半截距离折算出奇数小数高度。
  - The same complete-step function must drive both the visible audience marker and wall-speaker parameter cards / height / down-tilt. Do not fix only the drawing label while leaving engineering point metadata on continuous distance.
  - This marker is display-only and should not move array mics or speakers.
- Guardrail:
  - Do not apply full-room ceiling-speaker or full-room wall-speaker logic to lecture classrooms unless the user explicitly redefines the product boundary.
  - If lecture-classroom wall-speaker height / down-tilt uses step height, keep it separate from the display marker: height calculations affect parameter cards and angle; the audience marker only helps field reading.
  - Browser visual signoff is still needed when tool policy allows access to the local page.

### 2026-07-06 Lecture Classroom Speaker Selection Threshold Guardrail

- Confirmed rule:
  - 阶梯教室只做讲台区域扩声，但音箱形态可以按宽度切换。
  - 有吊顶且吊顶高度 `< 4m`：宽度 `> 12m` 推荐吸顶。
  - 有吊顶且吊顶高度 `>= 4m`：宽度 `>= 14m` 推荐吸顶。
  - 无吊顶：宽度 `>= 14m` 推荐吸顶。
  - 吊顶未知：不要按无吊顶阈值自动切吸顶，先维持壁挂并等待复勘确认。
- Guardrail:
  - The old generic `裸顶 > 12m` and `宽大于长且宽度 > 10m` ceiling-speaker fallbacks must not apply to lecture classrooms.
  - Keep this as a speaker-selection rule only; do not use it to move array mics, change speaker coordinates, or alter coverage radii.
  - High suspended-ceiling risk still exists, but for lecture classrooms it raises the ceiling-switch threshold to `14m` instead of blocking ceiling speakers completely.

### 2026-07-06 Release Workflow Guardrail

- Confirmed workflow:
  - 用户说打包、发布新版本、发布包、发版时，默认就是当天工作结束的最后一步。
  - Before packaging, read `logs/execution_log.md` and `logs/retrospective.md`.
  - Finish the daily closing workflow first: write logs, create/verify backup, clean/check code according to logged issues.
  - Generate the release package only after those steps are complete.
- Guardrail:
  - Do not treat release packaging as an isolated build command.
  - Do not skip cleanup/checks because the user only says "发布".
  - Do not change protected speaker or array-mic business rules during release cleanup unless separately confirmed.

### 2026-07-06 Stale Manual Point State Guardrail

- Customer-facing state rule:
  - 手动标记的中央空调点位必须跟“有中央空调”选项绑定。
  - 手动标记的利旧音箱点位必须跟“原有扩声系统”绑定。
  - 取消对应选项时，应清掉对应点位，不能让上一份模拟的点位残留到下一份。
- Guardrail:
  - If stale points are loaded from old drafts or reports, provide a delete path or sanitize them safely.
  - This is state cleanup, not a license to change automatic point-generation rules.
  - Do not let `centralAirConditionerCount` or leftover central-air point arrays re-enable central air by themselves after the user selected “无中央空调”.
  - Do not keep `legacySpeakerPoints` when `legacySoundSystem` is empty.

### 2026-07-06 Device List Display Guardrail

- Confirmed display rule:
  - 设备清单面向客户时只显示 `序号 / 设备 / 数量`。
  - Product catalog items that are not selected should remain visible with quantity `0`.
  - DT1 and DT2 should not be shown in the customer-facing device list; DT2 Pro is the retained array-mic product row.
- Guardrail:
  - Keep zero-quantity products in the visible product list.
  - Wiring, topology, and active-device logic must filter by `quantity > 0` so zero rows do not create false connections.
  - Do not use this display change to alter automatic product selection, speaker placement, or array-mic placement rules.

### 2026-07-06 Central-Air Copy Guardrail

- Confirmed wording:
  - Use `一米内会降低语音还原度` for the customer-facing central-air risk hint.
  - Avoid vague wording such as `提示还原度风险` in the point-map toolbar or parameter card.

### 2026-07-06 Release Clean-State Guardrail

- Confirmed release behavior:
  - Published single-file HTML must not inherit presales intake drafts from 5174 development/testing sessions.
  - Release mode must start from a clean intake state: no project/customer text, no room-size draft, no existing-device draft, no central-air / legacy-speaker points, and no manual quantity overrides.
  - 5174 development mode still preserves drafts on refresh.
- Implementation guardrail:
  - Release scripts must explicitly mark release mode.
  - The app must use that marker to skip development draft loading and saving.
  - Do not “fix” this by deleting the 5174 draft-persistence rule; that rule is still required for calibration work.

### 2026-07-06 Published Copy Impact-Only Guardrail

- Confirmed customer-facing copy rule:
  - Published output should say what parameter affects what result.
  - Do not write why, algorithm reasoning, internal rule trigger logic, or long handling suggestions in release-visible copy.
- Recheck reminder guardrail:
  - Use short impact wording such as `混响会影响阵麦拾音清晰度。`
  - Central air copy should focus on array-mic impact, e.g. `中央空调距离会影响阵麦语音还原度。`
  - Do not include explanation phrases such as `因为`, `由于`, `当前算法`, `按规则`, or long “必要时” handling steps in customer-facing recheck copy.
- Scope guardrail:
  - Copy cleanup is not permission to change speaker or array-mic business rules.
  - Speaker selection, point count, point coordinates, coverage, and avoidance rules still require explicit confirmation before code changes.

### 2026-07-07 Topology And Wiring Display Guardrail

- Current display rule:
  - Topology diagrams may adapt SVG width / height based on device count.
  - Interface wiring diagrams may adapt SVG width / height based on connection count and label length.
  - The primary array mic stays centered in topology layout; external devices are distributed around it.
  - Topology device image proportions are visual engineering proportions, not a strict physical scale drawing.
  - Center `阵麦 / 主麦` should keep the strongest visual weight; `从麦` and other external devices stay visually secondary.
  - Very large real devices such as all-in-one displays should be capped to a medium topology size so they do not dominate the system center.
  - Topology line labels should show cable quantity with `×N`; aggregate speaker topology lines may use the generated speaker point count.
  - DT USB is a single-port resource in this diagram: prefer all-in-one devices (`一体机 / 会议屏 / ClassIn`), otherwise use another entered media device, otherwise use the default classroom computer / recording host fallback only when needed.
- Guardrail:
  - Treat topology / wiring canvas sizing, card spacing, and label wrapping as display-layer work only.
  - Do not change connection-line generation, product selection, equipment quantity, speaker point rules, array-mic point rules, coverage, or avoidance while calibrating topology / wiring layout unless the user separately confirms that business-rule change.
  - Do not re-expand USB into multiple simultaneous media-device lines unless the user explicitly changes the one-USB-port rule.

### 2026-07-07 UI Refresh Process Reminder

- During the 5174 green / white UI refresh, a mobile overlap issue was found: the fixed bottom reference notice covered form content on narrow screens.
- It was fixed immediately because the active task was UI improvement and the issue directly affected the requested visual result.
- Process reminder:
  - Even for UI-only tasks, visible overlap / obvious UI issues should be recorded in `logs/execution_log.md` and `logs/retrospective.md`.
  - Keep UI theme changes separate from protected speaker / array-mic business rules.
  - Do not recolor semantic engineering diagram lines when the color carries cable or device-type meaning.

### 2026-07-07 Closing Notes Before Release

- Today's final work was mostly display-layer and external-device intake work:
  - topology product photos for external devices;
  - topology image sizing / label display;
  - external-device second-layer logic;
  - 5174 green / white UI refinements;
  - custom dropdown replacement for presales intake selects.
- Guardrail:
  - During release cleanup, do not touch speaker selection, speaker point count, speaker coordinates, speaker coverage, array-mic count, array-mic coordinates, or avoidance / reflow logic.
  - Treat any remaining UI polish as separate from audio-design rules.
- Release reminder:
  - Use the two-step release path: first build the single-file source with `window.__YIOU_RELEASE_BUILD__=true`, then build the dated universal release directory.
  - Run the release mobile compatibility test so the clean-state rule is verified.

### 2026-07-08 Version 1.1 Release Naming Reminder

- Current release name:
  - `音翼AI售前工具`
- Current version:
  - `1.1`
- Release packaging reminder:
  - Browser title, app header, exported report metadata, release directory, release HTML filename, README, outline, and mobile compatibility test should stay aligned with `音翼AI售前工具 1.1` unless the user explicitly changes the name or version.
- Guardrail:
  - Release naming and packaging updates are not permission to touch speaker / array-mic point rules, counts, coverage, avoidance, or reflow logic.

### 2026-07-08 Export Report Reminder

- Current exported report drawings:
  - `点位图`
  - `系统拓扑图`
- Guardrail:
  - Adding drawings to the exported report is display/export-layer work only.
  - Do not use report export changes to modify topology routing, speaker / array-mic placement rules, counts, coverage, avoidance, or reflow logic.

### 2026-07-08 Exported SVG Style Reminder

- When exporting SVG drawings to PNG for reports, keep `src/features/classroom/lib/imageExporter.ts` aligned with SVG classes used in `src/styles.css`.
- Topology lines use `cadLine` plus cable-type classes: `usb`, `ethernet`, `wireless`, `audio`, and `speaker`.
- If exported report images show labels / arrows but no line segments, check missing inline export CSS before changing topology rendering logic.

### 2026-07-08 USB Direction Display Reminder

- USB audio in topology / wiring diagrams should be visually bidirectional.
- Current implementation keeps one USB cable line and draws arrows on both ends.
- Do not use this display change to alter the one-USB-port priority, USB host selection, connection count, or cable quantity logic.

### 2026-07-08 Drawing Export UI Reminder

- The `03 方案输出` header should stay focused on section status, without drawing/report action buttons.
- Drawing image exports live on each drawing block:
  - point-map block: `导出点位图`;
  - topology block: `导出系统拓扑图`.
- Keep these as image-export entry points only; do not combine with report-generation or business-rule changes unless the user asks.

### 2026-07-08 Ceiling Speaker Spacing Guardrail

- Confirmed ceiling-speaker row / column addition rule:
  - Adjacent ceiling-speaker center spacing threshold is `3.6m`.
  - When two neighboring ceiling speakers on an axis would be `>= 3.6m` apart, add a row or column.
- Guardrail:
  - This changes ceiling-speaker count / grid density only.
  - Do not use it to change array-mic placement, center-axis avoidance / backfill, wall-speaker placement, coverage radius display, or product-selection rules without separate confirmation.

### 2026-07-08 Exported Product Image Reminder

- SVG-to-PNG export must inline nested `<image>` assets before serialization.
- If exported topology/report drawings show text and lines but no real device photos, check `inlineSvgImages` in `src/features/classroom/lib/imageExporter.ts` before changing topology rendering or product-image mapping.

### 2026-07-08 Same-Axis Array-Mic Spacing Guardrail

- Confirmed rule: after array-mic obstacle avoidance, same-x array mics must keep at least 4m spacing where possible.
- Primary mic air-conditioner avoidance has higher priority; keep the primary mic fixed after avoidance and push rear/slave mics backward first.
- The previously proposed fallback to move the primary mic sideways when rear space is tight was explicitly deleted and must not be implemented without new confirmation.
- This rule is coordinate post-processing only; do not change array-mic quantity triggers or speaker rules under this guardrail.


### 2026-07-08 Release Brand / Model Cleanup Reminder

- Before release, scan src/scripts/index/package for 翼欧, AP150, ap150, and YM-AP150.
- Published/customer-visible content must use 音翼 instead of 翼欧.
- Published/customer-visible content must not expose AP150; use 教学模拟功放主机 or 扩展功放 wording instead.
- Keep amplifier capacity and wiring math unchanged during this cleanup unless separately confirmed.

### 2026-07-08 Context Compression Logging Guardrail

- Confirmed process rule:
  - Every context compression / recovery / resumed handoff must read `AGENTS.md`, `logs/execution_log.md`, and `logs/retrospective.md` before continuing work.
  - Before context compression, any completed calibration-rule work, confirmed boundary, rule change, mistake correction, or important verification must be written to both logs when possible.
  - If compression happens automatically before logging, the first resumed step must backfill the missing calibration-rule and work-boundary notes into the logs.
- User reaffirmed this rule after a handoff: compressed-context recovery must read the bottom project rules (`AGENTS.md`) in addition to the two project logs.
- Guardrail:
  - Treat this as process memory protection only.
  - Do not use context-compression logging as permission to change speaker selection, speaker points, speaker quantity, speaker coordinates, speaker coverage, array-mic count, array-mic coordinates, avoidance, topology routing, or wiring rules without the normal confirmation boundary.

### 2026-07-08 Topology Bottom-Left Notes Reminder

- Standalone topology bottom-left notes are display-layer content and should remain visible after adaptive topology framing.
- The note trigger rules currently stay:
  - wired mic directly connected to the main mic;
  - DT Line In over the input limit;
  - DT Line Out over the output limit.
- If a wired microphone is routed through a legacy mixer / legacy audio chain, do not show the direct-to-main-mic self-power note as a topology bottom-left warning.
- If notes disappear again, first check the SVG note band / viewBox / export framing before changing connection generation or topology layout.
- Guardrail:
  - Do not use note visibility fixes to change topology routing, cable quantities, speaker rules, array-mic rules, or point-map rules.

### 2026-07-08 Release Closing Reminder

- User requested final packaging after the topology / report visual calibration pass.
- Release workflow must remain in this order:
  - write/update logs;
  - create and verify a fresh `.codex-backups` snapshot, keeping only the newest one valid zip;
  - run strict checks and safe release scans;
  - generate single-file release;
  - generate universal release directory;
  - run mobile compatibility test.
- Final 1.1 release package generated:
  - `outputs/音翼AI售前工具-1.1-内部测试版-260708.zip`
  - main file inside: `音翼AI售前工具-1.1.html`
- Final release verification passed:
  - strict TypeScript check;
  - production build;
  - source and release scan for `翼欧` / `AP150` / known mojibake;
  - Android Pixel 7 and iPhone 14 mobile compatibility release test;
  - release clean-start check for empty project/customer fields and zero dimension inputs.
- Guardrail:
  - During this release close, only package and verify the already confirmed state.
  - Do not change speaker selection, speaker count, speaker coordinates, speaker coverage, array-mic count, array-mic coordinates, avoidance/reflow, topology routing, wiring generation, or cable quantity logic.

### 2026-07-08 Mobile Header Title Wrapping Reminder

- Visible UI issue recorded:
  - On mobile, `音翼AI售前工具` wrapped into two lines in the first header card.
  - User explicitly requested immediate UI correction.
- Fix boundary:
  - Treat this as header responsive styling only.
  - Keep the title customer-visible and on one line by allowing the brand title to shrink with its available container width.
  - Header h1 base styles have higher specificity than `.workspaceTitle`; mobile title overrides must use a selector at least as specific as `.engineeringHeader .workspaceTitle`.
  - Do not use this UI polish to change presales defaults, release draft behavior, speaker rules, array-mic rules, topology routing, wiring generation, cable quantities, or device quantity logic.

### 2026-07-08 Git Checkpoint Automation Reminder

- Project Git remote:
  - `https://github.com/zhanghao1556/shouqianAPP.git`
- Confirmed workflow:
  - After Codex completes effective changes in this project, check `git status -sb`.
  - If all changes belong to the current user request, commit and push automatically.
  - Use `scripts/git-checkpoint.ps1 -Message "说明"` when appropriate so the user does not need to remember the raw Git commands.
  - Report the commit hash and branch tracking state after a successful push.
- Guardrail:
  - Do not commit ignored local-heavy folders such as `.codex-backups`, `node_modules`, `dist`, `outputs`, `output`, `work`, or `docx_2`.
  - If unrelated user changes are present, do not stage everything automatically; explain the mixed worktree and ask what belongs in the commit.
  - Destructive rollback commands such as `git restore .`, `git reset --hard`, `git clean`, and `git push --force` require explicit user confirmation after showing status and recent commits.
- Scope:
  - This is process automation only. It does not permit changing speaker selection, speaker point count, speaker coordinates, speaker coverage, array-mic count, array-mic coordinates, avoidance / reflow, topology routing, wiring generation, cable quantities, device quantities, release clean-state behavior, or presales draft persistence without the normal rule boundaries.

### 2026-07-08 Dated Daily / Release Archive Reminder

- User requirement:
  - Every daily closing and every packaging / release run must save a new Git archive point.
  - Archive history labels must include date and time accurate to the minute.
- Workflow:
  - Daily closing: after logs, `.codex-backups` snapshot, cleanup, and checks, run `scripts/git-checkpoint.ps1 -Kind daily`.
  - Packaging / release: after the generated package is verified, run `scripts/git-checkpoint.ps1 -Kind release`.
  - Expected commit labels look like `daily checkpoint 2026-07-08 20:58` or `release checkpoint 2026-07-08 21:03`.
- Important detail:
  - `daily` and `release` modes intentionally allow empty commits when the working tree is clean, so the history still has a visible dated archive point.
- Guardrail:
  - This creates Git history checkpoints only. It does not replace `.codex-backups` retention, and it does not permit protected business-rule changes without the normal confirmation boundary.

### 2026-07-08 Zip Backup Retention Reminder

- User changed `.codex-backups` retention after Git dated archive points were added.
- Current zip retention:
  - Keep only the newest one valid `.codex-backups` snapshot zip.
  - Always create and verify the new snapshot first.
  - Delete only older snapshot zip files after the newest snapshot is confirmed valid.
- Git remains the dated daily / release history system:
  - Daily closing still runs `scripts/git-checkpoint.ps1 -Kind daily`.
  - Packaging / release still runs `scripts/git-checkpoint.ps1 -Kind release`.
- Guardrail:
  - This is storage-retention policy only. Do not change protected speaker, array-mic, topology, wiring, device-quantity, release clean-state, or presales-draft rules under this cleanup.

### 2026-07-08 Git Push Failure Handling Reminder

- Finding:
  - `scripts/git-checkpoint.ps1` originally printed `Checkpoint pushed` even when `git push` failed due command-line GitHub network errors.
- Correction:
  - Check `$LASTEXITCODE` after native Git write commands.
  - Throw on `git add`, `git commit`, or `git push` failure so the user sees the real sync state.
- Current operational note:
  - If `git status -sb` shows `[ahead N]`, local commits exist but are not yet on GitHub.
  - Retry `git push` after network access to `github.com:443` recovers.

### 2026-07-08 Mobile Header Font Fallback Reminder

- Finding:
  - `音翼AI售前工具` can still wrap on a phone if the environment does not honor the container-query-unit title shrink.
- Correction:
  - Use a `vw`-based font-size fallback first, then the `cqw` value as progressive enhancement.
  - Explicitly override header `text-wrap: balance` on `.engineeringHeader .workspaceTitle`.
- Guardrail:
  - This is header CSS only. Do not change presales draft logic, release clean-state behavior, speaker rules, array-mic rules, topology routing, wiring generation, cable quantities, or device quantity logic.

### 2026-07-08 Port 5177 Mobile Preview Reminder

- User requirement:
  - `5177` and later should be treated as the mobile-side preview / mobile mode entry.
  - Keep `5174` as the main development page unless separately changed.
  - Do not create a separate desktop cmd / standalone mobile script; wire 5177 into the existing open-local-pages flow.
- Intended use:
  - Future mobile UI checks should be able to open `http://127.0.0.1:5177/` directly for the mobile view.
  - Implementation may involve dev scripts / open-page workflow / mobile-preview CSS or viewport handling, but this log entry only records the requirement.
- Guardrail:
  - This is a preview workflow / UI validation convention only.
  - Do not change protected speaker, array-mic, topology, wiring, cable-quantity, device-quantity, presales-draft, or release clean-state rules under this requirement.

# RememberMe

A personal reminder / life-organizer app built with Expo (React Native + TypeScript).

## 1. Setup

```bash
cd rememberme
npm install
npx expo install --fix   # pins native module versions to your installed Expo SDK
npx expo start
```

Scan the QR code with **Expo Go** on Android (this project was built and typechecked in this
environment, but Expo Go itself couldn't be launched here — see "What to verify on your device"
below).

## 2. Project structure

```
src/
  types/         Core data model (RememberEvent, Person, Reminder, Settings...)
  lib/            
    id.ts          Unique ID generation
    storage.ts      AsyncStorage read/write (dictionary-keyed, not arrays)
    recurrence.ts    Computes recurring occurrences on the fly (no duplicate records)
    notifications.ts Diff-based local notification scheduler
    selectors.ts     Pure functions: events dict -> occurrence lists per screen
    nlp.ts           Rule-based parser for the Assistant screen
    suggestions.ts / greetings.ts   Smart-suggestion + greeting text templates
    bootstrap.ts     App-launch + foreground notification resync
  store/          Zustand stores: events, people, settings
  screens/        One file per screen
  navigation/     Bottom tabs + stack
  theme/          Light/dark color tokens
```

## 3. What caused duplicate events (design, not a retrofit)

This build was written from scratch, so there's no legacy duplicate-event bug to point to — but
the spec's Section 10–14 requirements shaped the architecture directly:

- **Events are stored as a dictionary (`Record<id, Event>`), never an array.** Inserting the same
  id twice is an overwrite, not an append — the data structure itself can't hold two records for
  one event.
- **The event's id is generated exactly once**, when the Add Event screen mounts (`useRef`), not
  on every render or every Save press. The same id is reused if Save is tapped again.
- **`eventsStore.createEvent` is idempotent**: if an id already exists in the store, the call is a
  no-op that returns the existing record. Combined with disabling the Save button in-flight
  (`savingRef` guards synchronously, ahead of React state), a rapid double-tap cannot create two
  events.
- **Recurring events are stored as ONE record with a `recurrence` rule.** Occurrences (e.g. every
  birthday) are computed mathematically by `getOccurrencesInRange()` at render time — they are
  never written back to storage as separate records, so there's no code path that could
  accidentally persist the same occurrence twice. This was verified with a standalone script
  reproducing the same walk-forward algorithm (10 years of a yearly event → exactly one entry per
  year, zero duplicates).

## 4. How notifications work

`src/lib/notifications.ts` keeps a persisted map keyed by
`` `${eventId}:${occurrenceDate}:${reminderId}` ``. `syncEventNotifications(event)`:

1. Computes which occurrence+reminder combinations *should* be scheduled within a lookahead window
   (14 days for daily, 56 for weekly, 180 for monthly, 400 for yearly, 730 for one-off).
2. Schedules only the ones missing from the map (already-scheduled keys are skipped — this is what
   makes it safe to call on every app launch and every foreground event).
3. Cancels + removes any previously-tracked notification for that event that's no longer desired
   (reminder deleted, occurrence completed, event edited/rescheduled).

`deleteEvent` and `cancelAllNotificationsForEvent` cancel everything tracked for an id, so nothing
is ever orphaned. Editing an event calls the same sync function, which transparently cancels the
stale trigger and schedules the corrected one.

**Known limitation:** local notifications for recurring events are only pre-scheduled within the
lookahead window above, topped up each time the app is opened (or brought to the foreground). If a
daily/weekly task's reminder isn't touched for longer than its window (e.g. the app isn't opened
for 3+ months), the next few reminders won't fire until the app is reopened and resyncs. A real
background task or server-side scheduler would remove this limitation — out of scope for a
local-only v1.

## 5. How to test local notifications

1. Open the app → **Settings → Notification Testing Tools**.
2. Press **Request Permission** if status isn't "granted".
3. Press **Send Test Notification** — a "🔔 Test Reminder" notification should arrive in ~10
   seconds (background the app to see it as a system notification, not just the in-app banner).
4. The same screen lists every notification the app currently has scheduled, with its target time,
   plus a native-vs-app count for cross-checking.
5. To test the full flow: create an event with a "10 minutes before"-style reminder in the near
   future, then check it appears on this screen with the correct trigger time.

## 6. The Assistant

`src/lib/nlp.ts` is a **rule-based, fully on-device** parser — it recognizes the phrasings in the
spec (relative dates, "at 6 PM", "Dad's birthday September 12", weekday names, "what's coming up
this week", etc.) and always shows a confirmation card before creating anything. It is *not* a
general LLM. If a date can't be confidently parsed, the Assistant asks you to finish the event in
the full Add Event form instead of guessing. Wiring this screen to a real LLM API (with your own
API key) for genuinely open-ended language would be a natural v2 upgrade.

## 7. Remaining limitations from Expo Go

- **Push notifications aren't used** (by design — the spec calls for local notifications only,
  and Expo Go on Android has dropped remote push support since SDK 53 anyway).
- **iOS has a system-wide cap of 64 pending local notifications per app.** The lookahead windows
  above are sized to stay well under that for a normal personal calendar, but a very heavy user
  (dozens of daily recurring tasks, each with several reminders) could approach it. Android has no
  such hard cap.
- Exact-alarm scheduling on Android 12+ requires the `SCHEDULE_EXACT_ALARM` permission (already
  declared in `app.json`); some OEM battery-optimization settings can still delay notifications —
  this is a device-level constraint outside the app's control.
- I wasn't able to launch Expo Go or an emulator from this environment, so the notification
  trigger types, calendar rendering, and gesture behavior are untested on an actual device —
  please run through Section 5's steps and the test cases in Section 8 after installing.

## 8. Test checklist (from the spec's acceptance criteria)

- [ ] Create one task → exactly one appears.
- [ ] Rapidly tap Save several times → exactly one event created.
- [ ] Create a meeting with a specific time → shows correctly on Calendar/Home.
- [ ] Reload the app (kill + reopen) → no duplicates appear anywhere.
- [ ] Add a person with a birthday → exactly one yearly birthday event, visible on Home/Calendar.
- [ ] Edit an event's time → old notification is gone, new one appears in Notification Testing.
- [ ] Delete an event → it disappears from Home, Calendar, Tasks, and its notifications are gone.
- [ ] Press Send Test Notification → banner arrives ~10s later.


## Final navigation

- 🏠 Home
- ✨ Moments — birthdays and anniversaries
- 📅 Meetings
- ✅ Tasks
- 👥 People
- 🤖 Assistant

Calendar remains accessible from Home instead of the bottom navigation.

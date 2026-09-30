# Suite Nothings — Copy

## How to use

This is the copy deck for Suite Nothings, the hotel-diary PWA Nirsh made for Shady. Feature agents should use these strings **verbatim** — don't paraphrase, don't "improve" tone, don't add punctuation that isn't here. Keys are stable and dot-namespaced by screen (e.g. `home.hero.search.placeholder`); if a string needs to change later, change the value, not the key.

**Tokens.** Anything in `{curly braces}` is filled in by the app at runtime (`{n}`, `{hotelName}`, `{partner}`, `{me}`, `{date}`, …). Where a count needs different wording for 1 vs many, two rows are given with a `.one` / `.other` key suffix — use `.one` when the count is exactly 1, `.other` otherwise. `{partner}` resolves to whoever isn't the signed-in person (Nirsh → Shady, Shady → Nirsh); `{me}` resolves to the signed-in person.

**Voice** (SPEC §15): warm, playful, short, sentence case, written as "us" — "our stays", "we checked in", never "the user". Hotel puns sparingly, at most one per screen. Buttons say exactly what happens (a button reading "Save our stay" is followed by a toast reading "Stay saved" — not "Success!"). Errors always say what happened *and* what to do next; "Something went wrong" never appears alone. Dates render as `19 Jun 2026`; times as 24h, e.g. `23:46`. No lorem ipsum, no "TBD", no placeholder copy anywhere — every empty state has a real, finished sentence.

**Names.** Only ever "Nirsh" and "Shady". The word "Dayuse" appears exactly once in the whole app, in `settings.about.credit` — nowhere else, including onboarding, the map, or error copy.

---

## 1. Global

| key | copy | notes |
|---|---|---|
| `global.appName` | Suite Nothings | Full app name |
| `global.shortName` | Our Suites | Manifest `short_name`, home-screen label |
| `global.tagline` | Every room we've made ours. | Used on About, splash, share cards |
| `global.tabbar.stays` | Stays | Mobile bottom tab |
| `global.tabbar.map` | Map | Mobile bottom tab |
| `global.tabbar.add.aria` | Add a stay | Centre + button, icon-only, aria-label |
| `global.tabbar.journey` | Journey | Mobile bottom tab |
| `global.tabbar.us` | Us | Mobile bottom tab |
| `global.nav.desktop.stays` | Stays | Desktop header nav |
| `global.nav.desktop.map` | Map | Desktop header nav |
| `global.nav.desktop.journey` | Journey | Desktop header nav |
| `global.nav.desktop.us` | Us | Desktop header nav |
| `global.nav.desktop.add` | Add a stay | Desktop header button (text, not icon-only) |
| `global.shortcuts.hint` | Press / to search, N for a new stay, M for the map, J for journey | Shown once, dismissible, or in a "?" popover |
| `global.shortcuts.new` | N · New stay | Keyboard hint chip |
| `global.shortcuts.map` | M · Map | Keyboard hint chip |
| `global.shortcuts.journey` | J · Journey | Keyboard hint chip |
| `global.shortcuts.search` | / · Search | Keyboard hint chip |
| `global.demoBadge` | Demo | Persistent badge while in demo mode |
| `global.demoBadge.aria` | Demo mode: sample stays, nothing saved to our Sheet | aria-label for the badge |
| `global.offline.banner` | Offline. Your stays are safe on this phone. | Sticky banner, top of screen |
| `global.sync.syncing` | Syncing… | Sync status indicator |
| `global.sync.synced` | Synced just now | Sync status indicator |
| `global.sync.savedLocally` | Saved on this phone, will sync | Quiet outbox state, per §7.2 |
| `global.sync.pending.one` | 1 change waiting to sync | |
| `global.sync.pending.other` | {n} changes waiting to sync | |
| `global.sync.failed` | Sync failed | Paired with retry |
| `global.sync.retry` | Retry | Button next to `global.sync.failed` |
| `global.sync.linkBroken` | Can't reach our Sheet. Paste the new link in Settings. | Shown on both phones if the deployment URL changed |
| `global.sync.newStayToast` | {partner} just checked in at {hotelName} | Live-update toast when the other person adds a stay |
| `global.install.banner.title` | Put us on your home screen | |
| `global.install.banner.body` | One tap and Suite Nothings lives right there, no browser bar. | |
| `global.install.banner.cta` | Add to home screen | |
| `global.install.banner.dismiss` | Not now | Hides banner; reappears if not installed after a few visits |
| `global.update.toast` | A fresh version is ready | Never shown while a form/sheet is open |
| `global.update.cta` | Reload | |
| `global.confirm.title` | Just checking | Generic confirm dialog title, used when no screen-specific copy exists |
| `global.confirm.confirm` | Yes, {action} | e.g. "Yes, delete" |
| `global.confirm.cancel` | Cancel | |
| `global.undo.generic` | {action}. Undo | Generic undo toast template, e.g. "Stay moved out. Undo" |
| `global.loading.clockHand.aria` | Loading, one moment | aria-label for the clock-hand loader animation |
| `global.error.boundary.title` | This screen tripped over its suitcase. | Global error boundary |
| `global.error.boundary.body` | Your stays are safe on this phone. | Global error boundary |
| `global.error.boundary.cta` | Reload | Global error boundary |
| `global.error.notFound.title` | No room at this address | 404 route |
| `global.error.notFound.body` | That page checked out. Let's get you back to our stays. | 404 route |
| `global.error.notFound.cta` | Back to Stays | 404 route |

---

## 2. Onboarding

| key | copy | notes |
|---|---|---|
| `onboarding.intro.skip` | Skip | On the 3D key-tag intro animation |
| `onboarding.who.title` | Who's checking in? | |
| `onboarding.who.nirsh` | Nirsh | Option |
| `onboarding.who.shady` | Shady | Option |
| `onboarding.who.helper` | This sets how the app greets you, and whose name goes on new stays. | |
| `onboarding.connect.title` | Connect our stays | |
| `onboarding.connect.demo.cta` | Try demo | |
| `onboarding.connect.demo.helper` | Explore with sample stays. Nothing saves to our real Sheet. | |
| `onboarding.connect.manual.title` | Or connect with our link | |
| `onboarding.connect.field.url.label` | Apps Script URL | |
| `onboarding.connect.field.url.placeholder` | `https://script.google.com/macros/s/…/exec` | |
| `onboarding.connect.field.url.helper` | Find this in Settings → Connection on the other phone. | |
| `onboarding.connect.field.passphrase.label` | Passphrase | |
| `onboarding.connect.field.passphrase.placeholder` | Our passphrase | |
| `onboarding.connect.cta` | Connect | |
| `onboarding.connect.testing` | Checking our connection… | |
| `onboarding.connect.success` | Connected: {n} stays synced | |
| `onboarding.connect.error.badUrl` | That's not an Apps Script web app link. It should end in /exec. | Validation error |
| `onboarding.connect.error.devUrl` | This link ends in /dev, it only works for its owner. Ask for the /exec link. | Validation error |
| `onboarding.connect.error.wrongPassphrase` | Wrong passphrase. Check it and try again. | Test-connection result |
| `onboarding.connect.error.unreachable` | Can't reach Google right now. Check your connection and try again. | Test-connection result |
| `onboarding.invite.title` | You've been invited | Arriving via `#/join?...` link |
| `onboarding.invite.body` | This link connects you as {partner} and fills everything in. | |
| `onboarding.invite.cta` | Join as {partner} | |
| `onboarding.homeBase.title` | Where's home base? | |
| `onboarding.homeBase.summary` | {city}, {country} | Confirmation line, e.g. "Dubai, United Arab Emirates" |
| `onboarding.homeBase.confirmCta` | That's home | |
| `onboarding.homeBase.changeCta` | Change city | |
| `onboarding.install.title` | Add us to your home screen | |
| `onboarding.install.android.cta` | Add to home screen | Uses `beforeinstallprompt` |
| `onboarding.install.ios.step1` | Tap Share | Illustrated step 1 |
| `onboarding.install.ios.step2` | Tap Add to Home Screen | Illustrated step 2 |
| `onboarding.install.ios.helper` | Look for the square with an arrow, at the bottom of Safari. | |
| `onboarding.install.skip` | Maybe later | |
| `onboarding.done.title` | Check-in complete | |
| `onboarding.done.body` | Let's see our stays. | |
| `onboarding.done.cta` | Take me in | |

---

## 3. Stays home

| key | copy | notes |
|---|---|---|
| `home.hero.headline.byCount` | Stay {n}, and still checking in. | Headline variant 1, driven by total visit count |
| `home.hero.headline.byCountPlain` | {n} hotels, one us. | Headline variant 2 |
| `home.hero.headline.byLatest` | Last stop: {hotelName} in {city}. | Headline variant 3, driven by most recent stay |
| `home.hero.headline.byLatestRevisit` | Back at {hotelName}. We know the way now. | Headline variant 4, used when the latest stay is a repeat hotel |
| `home.hero.headline.byAnniversary` | {months} months together, {n} hotels in. | Headline variant 5, shown near the 19th of the month |
| `home.hero.headline.byMilestone` | Hotel number {n}. We're keeping count. | Headline variant 6, shown right after a milestone unlock |
| `home.hero.headline.default` | Every room we've made ours. | Fallback when no data-driven variant applies (e.g. zero stays) |
| `home.hero.search.placeholder` | Find a stay we've had | |
| `home.hero.here.cta` | We're at a hotel right now | Uses location to start a new stay |
| `home.hero.here.permissionPrompt` | Let Suite Nothings use your location to find where we are? | Browser-level permission framing copy |
| `home.hero.here.permissionDenied` | No location access. Add the hotel by hand instead. | |
| `home.hero.here.permissionUnavailable` | Can't get your location right now. Try again, or add the hotel by hand. | |
| `home.counter.caption.one` | {n} hotel together | Split-flap counter caption |
| `home.counter.caption.other` | {n} hotels together | Split-flap counter caption |
| `home.stats.hotels` | Hotels | Stats row label |
| `home.stats.visits` | Visits | Stats row label |
| `home.stats.hours` | Hours of hotel time together | Stats row label |
| `home.stats.cities` | Cities | Stats row label |
| `home.stats.countries` | Countries | Stats row label |
| `home.ourStays.heading` | Our stays | Section heading |
| `home.ourStays.tab.dubai` | Dubai | City tab |
| `home.ourStays.tab.sharjah` | Sharjah | City tab |
| `home.ourStays.tab.abuDhabi` | Abu Dhabi | City tab |
| `home.ourStays.tab.abroad` | Abroad | City tab, catches everything outside the UAE |
| `home.ourStays.tab.all` | All | City tab |
| `home.ourStays.seeAll` | See all our {city} stays | Opens the map, filtered to `{city}` |
| `home.card.badge.first` | First | Card badge |
| `home.card.badge.visit` | Visit {n} | Card badge |
| `home.card.badge.favourite` | ♡ {n} | Card badge, favourite count |
| `home.card.badge.regular` | Our regular | Card badge, 3+ visits to the same hotel |
| `home.card.badge.waitingRating` | Waiting for {partner}'s rating | Card badge |
| `home.storyThree.heading` | Our story in three stays | |
| `home.storyThree.first.label` | First | |
| `home.storyThree.first.caption` | Where it all started | |
| `home.storyThree.latest.label` | Latest | |
| `home.storyThree.latest.caption` | Most recent check-in | |
| `home.storyThree.favourite.label` | Favourite | |
| `home.storyThree.favourite.caption` | The one we keep talking about | |
| `home.onThisDay.title` | On this day | Section heading, shown when a past stay matches today's date |
| `home.onThisDay.body.one` | {years} year ago today, we checked into {hotelName}. | `years` = 1 |
| `home.onThisDay.body.other` | {years} years ago today, we checked into {hotelName}. | `years` > 1 |
| `home.monthlyAnniversary.title` | {months} months together | Shown on the 19th when no "on this day" match exists |
| `home.monthlyAnniversary.body` | {months} months together, {n} hotels in. | |
| `home.install.banner.title` | Put us on your home screen | Same copy as `global.install.banner.title`, placed inline in the home feed |
| `home.wishlist.heading` | Next check-ins | |
| `home.wishlist.surprise` | Surprise me | Random pick from the wishlist |
| `home.wishlist.convert` | Turn into a stay | One-tap conversion |
| `home.wishlist.empty.title` | No wishes yet | |
| `home.wishlist.empty.body` | Add a hotel we're dreaming about. | |
| `home.wishlist.empty.cta` | Add a wish | |
| `home.faq.heading` | Frequently asked by us | |
| `home.faq.firstStay.q` | Where was our first stay? | |
| `home.faq.firstStay.a` | {hotelName} in {city}, on {date}. | |
| `home.faq.firstStay.empty` | Add our first stay and we'll remember it here. | |
| `home.faq.regular.q` | Which hotel do we keep going back to? | |
| `home.faq.regular.a` | {hotelName}, {n} times and counting. | |
| `home.faq.regular.empty` | No regulars yet, one hotel just needs a second visit. | |
| `home.faq.farthest.q` | What's the farthest we've been from home? | |
| `home.faq.farthest.a` | {hotelName} in {city}, {km} km from home. | |
| `home.faq.farthest.empty` | Still close to home base, so far. | |
| `home.faq.longest.q` | What was our longest stay? | |
| `home.faq.longest.a.one` | {nights} night at {hotelName}. | `nights` = 1 |
| `home.faq.longest.a.other` | {nights} nights at {hotelName}. | `nights` > 1 |
| `home.faq.longest.empty` | No overnight stays yet. | |
| `home.faq.hours.q` | How many hours have we spent in hotels together? | |
| `home.faq.hours.a` | {hours} hours, and counting. | |
| `home.faq.hours.empty` | Add check-in and check-out times to start the clock. | |
| `home.faq.picks.q` | Whose picks rate higher? | |
| `home.faq.picks.a` | {leaderName}'s picks average {leaderScore}, {otherName}'s average {otherScore}. | |
| `home.faq.picks.tie` | Dead even. You both pick well. | |
| `home.faq.picks.empty` | Rate a few stays and we'll keep score. | |
| `home.faq.lastCheckIn.q` | When was our last check-in? | |
| `home.faq.lastCheckIn.a` | {date} at {hotelName}. | |
| `home.faq.lastCheckIn.empty` | Add our first stay and we'll remember it here. | |
| `home.chains.heading` | Hotels we keep choosing | Text-only marquee heading, driven by `brand` field |
| `home.footer.credit` | Made by Nirsh for Shady | |
| `home.footer.counter` | {d} days, {h} h, {m} min together | Live together-since counter |
| `home.filters.title` | Filters | Filters sheet |
| `home.filters.city.label` | City | |
| `home.filters.year.label` | Year | |
| `home.filters.type.label` | Type | |
| `home.filters.rating.label` | Rating | |
| `home.filters.pickedBy.label` | Who picked it | |
| `home.filters.clear` | Clear | |
| `home.filters.apply` | Show our stays | |
| `home.search.results.one` | {n} stay found | |
| `home.search.results.other` | {n} stays found | |
| `home.search.noResults.title` | No stays match that | |
| `home.search.noResults.body` | Try a different name, area, or a word from a note. | |

---

## 4. Add a stay

| key | copy | notes |
|---|---|---|
| `addStay.title` | Add a stay | Sheet title |
| `addStay.step1.title` | Hotel | Step 1 of 5 |
| `addStay.step1.helper` | Search, or pick somewhere we've stayed before. | |
| `addStay.step1.search.placeholder` | Search hotels or areas | |
| `addStay.step1.previous.label` | Stayed here before | List label above previously-visited hotels |
| `addStay.step1.hereNow` | We're here now | Finds nearest hotels to GPS |
| `addStay.step1.photon.error` | Can't search hotels right now. | Photon failure |
| `addStay.step1.photon.offline` | Offline. Add it by hand. | Offline fallback |
| `addStay.step1.addByHand` | Add it by hand | Manual entry CTA |
| `addStay.step1.manual.name.label` | Hotel name | |
| `addStay.step1.manual.area.label` | Area | |
| `addStay.step1.manual.city.label` | City | |
| `addStay.step1.manual.country.label` | Country | |
| `addStay.step2.title` | When | Step 2 of 5 |
| `addStay.step2.helper` | Today's fine, or pick another date. | |
| `addStay.step2.date.label` | Date | |
| `addStay.step2.checkIn.label` | Check-in | Optional |
| `addStay.step2.checkOut.label` | Check-out | Optional |
| `addStay.step2.nights.label` | Nights | Shown for overnight stays |
| `addStay.step3.title` | What we did | Step 3 of 5 |
| `addStay.step3.helper` | Pick as many as fit. | |
| `addStay.step3.chip.dayUse` | Day use | Visit-type chip |
| `addStay.step3.chip.overnight` | Overnight | Visit-type chip |
| `addStay.step3.chip.staycation` | Staycation | Visit-type chip |
| `addStay.step3.chip.dateNight` | Date night | Visit-type chip |
| `addStay.step3.chip.poolDay` | Pool day | Visit-type chip |
| `addStay.step3.chip.spa` | Spa | Visit-type chip |
| `addStay.step3.chip.brunch` | Brunch | Visit-type chip |
| `addStay.step3.chip.workFromHotel` | Work from hotel | Visit-type chip |
| `addStay.step3.chip.birthday` | Birthday | Visit-type chip |
| `addStay.step3.chip.anniversary` | Anniversary | Visit-type chip |
| `addStay.step4.title` | Photos | Step 4 of 5 |
| `addStay.step4.helper` | Add a few, or skip for now. | |
| `addStay.step4.add` | Add photos | |
| `addStay.step4.exif.suggestion` | These photos say {date} at {place}. Use that? | |
| `addStay.step4.exif.use` | Use that | |
| `addStay.step4.exif.keep` | Keep what I entered | |
| `addStay.step5.title` | The good part | Step 5 of 5 |
| `addStay.step5.note.placeholder` | What do we want to remember? | |
| `addStay.step5.favouriteMoment.placeholder` | Favourite moment | |
| `addStay.step5.mood.label` | Mood | See §11 for mood stamp copy |
| `addStay.step5.rating.label` | My rating | |
| `addStay.draft.autosaved` | Draft saved | Small inline indicator |
| `addStay.draft.resume.title` | Pick up where we left off? | |
| `addStay.draft.resume.body` | We saved a draft stay at {hotelName}. | |
| `addStay.draft.resume.cta` | Continue | |
| `addStay.draft.resume.discard` | Start fresh | |
| `addStay.nav.back` | Back | |
| `addStay.nav.next` | Next | |
| `addStay.nav.skip` | Skip | |
| `addStay.nav.save` | Save our stay | Final step CTA |
| `addStay.validation.hotelRequired` | Add a hotel to continue. | |
| `addStay.validation.dateRequired` | Pick a date to continue. | |
| `addStay.validation.checkOutBeforeCheckIn` | Check-out is before check-in. Fix the times to continue. | |
| `addStay.discard.title` | Discard this stay? | |
| `addStay.discard.body` | We'll lose everything entered so far. | |
| `addStay.discard.confirm` | Discard | |
| `addStay.discard.cancel` | Keep editing | |
| `addStay.celebration.line.one` | Checked in. Stay {n} is ours. | Random pick of 3, shown on save |
| `addStay.celebration.line.two` | Key's in the lock. Stay {n}, logged. | Random pick of 3 |
| `addStay.celebration.line.three` | Another one for the board: {n}. | Random pick of 3 |
| `addStay.toast.saved` | Stay saved | |
| `addStay.milestone.firstStay` | Our first stay. Every room starts somewhere. | Milestone toast |
| `addStay.milestone.hotels5` | 5 hotels. We're building a habit. | Milestone toast |
| `addStay.milestone.hotels10` | 10 hotels together. | Milestone toast |
| `addStay.milestone.hotels25` | 25 hotels. A whole shelf of key tags. | Milestone toast |
| `addStay.milestone.hotels50` | 50 hotels together. | Milestone toast |
| `addStay.milestone.hotels100` | 100 hotels. We should get a plaque. | Milestone toast |
| `addStay.milestone.firstOutsideHomeCity` | First stay outside {homeCity}. The map just got bigger. | Milestone toast |
| `addStay.milestone.firstAbroad` | First stay abroad, in {country}. | Milestone toast |
| `addStay.milestone.threeInOneMonth` | Three stays this month. We're on a roll. | Milestone toast |
| `addStay.milestone.monthlyAnniversary` | Checked in on the 19th. You didn't even plan that, did you? | Milestone toast |
| `addStay.milestone.fiveStars` | A perfect 5 stars. Noted. | Milestone toast |
| `addStay.milestone.thirdVisit` | Third time at {hotelName}. That makes it ours. | Milestone toast |

---

## 5. Stay detail

| key | copy | notes |
|---|---|---|
| `stayDetail.section.visits` | Our visits here | Mini timeline of all visits to this hotel |
| `stayDetail.section.hotelInfo` | Hotel info | |
| `stayDetail.section.notes` | Our notes | |
| `stayDetail.section.ratings` | Ratings | |
| `stayDetail.section.map` | On the map | |
| `stayDetail.directions.google` | Google Maps | |
| `stayDetail.directions.apple` | Apple Maps | |
| `stayDetail.directions.waze` | Waze | |
| `stayDetail.enrichment.fetching` | Fetching hotel info… | Skeleton state |
| `stayDetail.enrichment.failed` | Couldn't fetch hotel info. | |
| `stayDetail.enrichment.refresh` | Refresh info | |
| `stayDetail.enrichment.aiLabel` | Written by AI from public info | Required label on any AI-generated description |
| `stayDetail.enrichment.priceLevel.1` | ¤ | |
| `stayDetail.enrichment.priceLevel.2` | ¤¤ | |
| `stayDetail.enrichment.priceLevel.3` | ¤¤¤ | |
| `stayDetail.enrichment.priceLevel.4` | ¤¤¤¤ | |
| `stayDetail.enrichment.priceLevel.estimate` | {priceLevel} (estimate) | AI-estimated price level, must be labelled |
| `stayDetail.enrichment.wikimediaCredit` | Photo via Wikimedia Commons, {license} | |
| `stayDetail.edit` | Edit | |
| `stayDetail.delete` | Delete | |
| `stayDetail.delete.confirm.title` | Remove this stay? | |
| `stayDetail.delete.confirm.body` | You can undo this for a few seconds after. | |
| `stayDetail.delete.confirm.confirm` | Delete | |
| `stayDetail.delete.confirm.cancel` | Cancel | |
| `stayDetail.delete.undoToast` | Stay moved out. Undo | Soft delete |
| `stayDetail.waitingRating` | Waiting for {partner}'s rating | |
| `stayDetail.rating.prompt` | Rate this stay | |
| `stayDetail.rating.cta` | Add my rating | |

---

## 6. Map

| key | copy | notes |
|---|---|---|
| `map.chapter.city` | {CITY} | Split-flap HUD title, uppercase, e.g. "DUBAI" |
| `map.chapter.country` | {COUNTRY} | Split-flap HUD title, uppercase, e.g. "UNITED ARAB EMIRATES" |
| `map.chapter.world` | THE WORLD | Split-flap HUD title |
| `map.chip.city` | City | Chapter chip |
| `map.chip.country` | Country | Chapter chip |
| `map.chip.world` | World | Chapter chip |
| `map.staysInView.one` | {n} stay in view | |
| `map.staysInView.other` | {n} stays in view | |
| `map.pin.openStay` | Open stay | CTA on the pin card sheet |
| `map.list.toggle` | List view | Accessible alternative to the map |
| `map.list.heading` | Our stays, listed | |
| `map.locate` | Locate me | |
| `map.compassReset` | Reset north | |
| `map.layers.label` | Lighting | |
| `map.layers.auto` | Auto | |
| `map.layers.day` | Day | |
| `map.layers.goldenHour` | Golden hour | |
| `map.layers.night` | Night | |
| `map.loading` | Loading the map… | |
| `map.failed.webgl` | This browser can't render our 3D map. Try list view instead. | |
| `map.failed.offlineTiles` | Offline. Showing what we've already loaded. | |
| `map.empty.title` | No pins yet | |
| `map.empty.body` | Add a stay and it'll show up here. | |
| `map.attribution` | Map data © OpenStreetMap contributors, tiles via OpenFreeMap | Always visible, licence requirement |

---

## 7. Journey

| key | copy | notes |
|---|---|---|
| `journey.start.title` | Our journey | |
| `journey.start.body` | Every stay, in order, from 19 Jun 2026 to now. | |
| `journey.start.cta` | Play our journey | |
| `journey.controls.play` | Play | |
| `journey.controls.pause` | Pause | |
| `journey.controls.speed` | Speed | |
| `journey.controls.prev` | Previous stop | |
| `journey.controls.next` | Next stop | |
| `journey.filter.allTime` | All time | |
| `journey.filter.thisYear` | This year | |
| `journey.filter.homeCityOnly` | Home city only | |
| `journey.postcard.stayOf` | Stay {i} of {n} | |
| `journey.opening.date` | 19 Jun 2026 | Split-flap opening date card |
| `journey.opening.body` | Where it all began. | |
| `journey.finale.title` | To be continued… | |
| `journey.finale.stats.hotels` | Hotels | |
| `journey.finale.stats.cities` | Cities | |
| `journey.finale.stats.countries` | Countries | |
| `journey.finale.stats.km` | Kilometres travelled | |
| `journey.sound.mute` | Mute | |
| `journey.sound.unmute` | Sound on | |
| `journey.reducedMotion.note` | Reduced motion is on. We'll crossfade between stops instead of flying. | |
| `journey.empty.title` | Need two stays to make a journey | |
| `journey.empty.body` | Add another stay and we'll plot the route. | |
| `journey.share.title` | Share our journey | Phase 3 |
| `journey.share.recording` | Recording our journey… | Phase 3 |
| `journey.share.ready` | Ready to share | Phase 3 |
| `journey.share.failed` | Couldn't record this. Try again. | Phase 3 |
| `journey.share.save` | Save video | Phase 3 |

---

## 8. Us

| key | copy | notes |
|---|---|---|
| `us.stats.heading` | Us, in numbers | Stats dashboard heading |
| `us.picks.heading` | Whose picks rate higher | |
| `us.picks.score` | {leaderName}'s picks average {leaderScore}, {otherName}'s average {otherScore}. | Friendly running score |
| `us.picks.tie` | Dead even. You both pick well. | |
| `us.milestones.heading` | Milestone stamps | |
| `us.milestone.firstStay.name` | First stay | |
| `us.milestone.firstStay.locked` | Unlocks with our first stay | |
| `us.milestone.firstStay.unlocked` | Every room starts somewhere. | |
| `us.milestone.hotels5.name` | 5 hotels | |
| `us.milestone.hotels5.locked` | Unlocks at 5 hotels | |
| `us.milestone.hotels5.unlocked` | 5 hotels together. We're building a habit. | |
| `us.milestone.hotels10.name` | 10 hotels | |
| `us.milestone.hotels10.locked` | Unlocks at 10 hotels | |
| `us.milestone.hotels10.unlocked` | 10 hotels together. | |
| `us.milestone.hotels25.name` | 25 hotels | |
| `us.milestone.hotels25.locked` | Unlocks at 25 hotels | |
| `us.milestone.hotels25.unlocked` | 25 hotels. A whole shelf of key tags. | |
| `us.milestone.hotels50.name` | 50 hotels | |
| `us.milestone.hotels50.locked` | Unlocks at 50 hotels | |
| `us.milestone.hotels50.unlocked` | 50 hotels together. | |
| `us.milestone.hotels100.name` | 100 hotels | |
| `us.milestone.hotels100.locked` | Unlocks at 100 hotels | |
| `us.milestone.hotels100.unlocked` | 100 hotels. We should get a plaque. | |
| `us.milestone.firstOutsideHomeCity.name` | First stay outside {homeCity} | |
| `us.milestone.firstOutsideHomeCity.locked` | Unlocks the first time we stay outside {homeCity} | |
| `us.milestone.firstOutsideHomeCity.unlocked` | First stay outside {homeCity}. The map just got bigger. | |
| `us.milestone.firstAbroad.name` | First stay abroad | |
| `us.milestone.firstAbroad.locked` | Unlocks the first time we stay in another country | |
| `us.milestone.firstAbroad.unlocked` | First stay abroad, in {country}. | |
| `us.milestone.threeInOneMonth.name` | On a roll | |
| `us.milestone.threeInOneMonth.locked` | Unlocks with three stays in one month | |
| `us.milestone.threeInOneMonth.unlocked` | Three stays this month. We're on a roll. | |
| `us.milestone.monthlyAnniversary.name` | Right on the 19th | |
| `us.milestone.monthlyAnniversary.locked` | Unlocks with a stay on our monthly anniversary | |
| `us.milestone.monthlyAnniversary.unlocked` | Checked in on the 19th. You didn't even plan that, did you? | |
| `us.milestone.fiveStars.name` | Perfect stay | |
| `us.milestone.fiveStars.locked` | Unlocks with a 5-star stay | |
| `us.milestone.fiveStars.unlocked` | A perfect 5 stars. Noted. | |
| `us.milestone.thirdVisit.name` | Our regular | |
| `us.milestone.thirdVisit.locked` | Unlocks the third time we return to a hotel | |
| `us.milestone.thirdVisit.unlocked` | Third time at {hotelName}. That makes it ours. | |
| `us.letters.heading` | A note on your pillow | Letters list |
| `us.letters.readReceipt` | {partner} read your note on {date} | Shown to the letter's author once read |
| `us.letters.lockedFuture` | Unlocks at {n} hotels | Also used for `first_abroad` / date-based rules with matching phrasing, e.g. "Unlocks on our first stay abroad" |
| `us.letters.pillow.title` | Turndown service | Pillow card, before opening |
| `us.letters.pillow.cta` | Tap to open | Pillow card, before opening |
| `us.letters.signature` | Written in {city}, {month} {year} | Beneath the signature; letter body itself is never in this file |
| `us.togetherSince.label` | Together since | |
| `us.togetherSince.counter` | {d} days, {h} h, {m} min together | Live counter from 19 Jun 2026, 23:46 |
| `us.wishlist.heading` | Next check-ins | Mirrors `home.wishlist.*` |
| `us.wishlist.seeAll` | See our wishlist | |

---

## 9. Settings

| key | copy | notes |
|---|---|---|
| `settings.title` | Settings | |
| `settings.whoAmI.label` | Who am I | |
| `settings.whoAmI.helper` | Switches greetings and whose name goes on new stays. | |
| `settings.homeBase.label` | Home base | |
| `settings.homeBase.change` | Change | |
| `settings.connection.heading` | Connection | |
| `settings.connection.url.label` | Apps Script URL | |
| `settings.connection.url.helper` | Should end in /exec. Paste the whole link. | |
| `settings.connection.passphrase.label` | Passphrase | |
| `settings.connection.testButton` | Test connection | |
| `settings.connection.test.success` | Connected: {n} stays synced | |
| `settings.connection.test.wrongPassphrase` | Wrong passphrase | |
| `settings.connection.test.unreachable` | Can't reach Google right now | |
| `settings.connection.test.badUrl` | This isn't an Apps Script web app link | |
| `settings.connection.lastSync` | Last synced {time} | |
| `settings.connection.syncNow` | Sync now | |
| `settings.connection.inviteQr.label` | Invite Shady | Shown on Nirsh's device; mirrors to "Invite Nirsh" on Shady's |
| `settings.connection.inviteQr.caption` | Scan to join as {partner} | |
| `settings.connection.inviteQr.shareLink` | Share link | Fallback to scanning |
| `settings.mapLighting.label` | Map lighting | |
| `settings.mapLighting.auto` | Auto | |
| `settings.mapLighting.day` | Day | |
| `settings.mapLighting.goldenHour` | Golden hour | |
| `settings.mapLighting.night` | Night | |
| `settings.units.label` | Units | |
| `settings.units.km` | Kilometres | |
| `settings.units.mi` | Miles | |
| `settings.reducedMotion.label` | Reduce motion | |
| `settings.sound.label` | Sound | |
| `settings.export.label` | Download our data | |
| `settings.export.helper` | JSON and CSV, for safekeeping. | |
| `settings.import.label` | Import | |
| `settings.import.confirm.title` | Import and overwrite? | |
| `settings.import.confirm.body` | This replaces what's on this phone with the imported file. | |
| `settings.import.confirm.confirm` | Import | |
| `settings.import.confirm.cancel` | Cancel | |
| `settings.clearDemo.label` | Clear demo data | |
| `settings.clearDemo.confirm.title` | Clear demo data? | |
| `settings.clearDemo.confirm.body` | Removes every sample stay. Nothing real is touched. | |
| `settings.clearDemo.confirm.confirm` | Clear | |
| `settings.clearDemo.confirm.cancel` | Cancel | |
| `settings.about.tagline` | Every room we've made ours. | |
| `settings.about.credit` | Designed as a love letter to Dayuse, where our first check-in happened. | Only place "Dayuse" appears |
| `settings.about.attributions.osm` | © OpenStreetMap contributors | |
| `settings.about.attributions.openfreemap` | Map tiles by OpenFreeMap | |
| `settings.about.attributions.photon` | Hotel search by Photon, from Komoot | |
| `settings.about.attributions.wikidata` | Hotel facts from Wikidata and Wikimedia Commons | |
| `settings.about.version` | Version {version} | |

---

## 10. Join, empty and error states

| key | copy | notes |
|---|---|---|
| `join.title` | You've been invited | Route: `#/join?...` |
| `join.body` | This connects you as {partner}. | |
| `join.cta` | Join as {partner} | |
| `states.empty.title` | Our first check-in is waiting | Zero stays |
| `states.empty.cta` | Add our first stay | |
| `states.offline.banner` | Offline. Your stays are safe on this phone. | Same as `global.offline.banner` |
| `states.error.network` | Can't reach the internet. We'll keep everything here until it's back. | |
| `states.error.storageFull` | This phone is out of space. Free some up to keep saving stays. | |
| `states.error.permissionCamera` | No camera access. Allow it in your phone's settings to add photos. | |
| `states.error.permissionLocation` | No location access. Allow it in your phone's settings, or add the hotel by hand. | |
| `states.error.photoTooLarge` | That photo's too large. Try a smaller one. | |
| `states.error.syncConflict` | This stay changed on the other phone too. We kept the latest edit. | |
| `states.loading.skeleton.aria` | Loading our stays… | Skeleton loading state, aria-label |

---

## 11. Mood stamps

| key | copy | notes |
|---|---|---|
| `mood.blissful.label` | Blissful | |
| `mood.blissful.description` | Pure, sink-into-the-pillow happy. | |
| `mood.lazy.label` | Lazy | |
| `mood.lazy.description` | Did nothing, and it was perfect. | |
| `mood.fancy.label` | Fancy | |
| `mood.fancy.description` | Dressed up, felt spoiled. | |
| `mood.giggly.label` | Giggly | |
| `mood.giggly.description` | Couldn't stop laughing. | |
| `mood.romantic.label` | Romantic | |
| `mood.romantic.description` | Just the two of us, on purpose. | |
| `mood.adventurous.label` | Adventurous | |
| `mood.adventurous.description` | Tried something new. | |
| `mood.cosy.label` | Cosy | |
| `mood.cosy.description` | Blankets, quiet, us. | |
| `mood.fizzy.label` | Fizzy | |
| `mood.fizzy.description` | Excited, can't-sit-still good. | |

---

## 12. Share cards

| key | copy | notes |
|---|---|---|
| `share.stayPostcard.caption` | Stay {i} of {n}: {hotelName}, {date} | 1080×1920 postcard |
| `share.statsCard.caption` | {n} hotels, {cities} cities, {countries} countries together | 1080×1920 stats card |
| `share.journeyRoute.caption` | Our journey so far: {km} km, {n} hotels | 1080×1920 route card |

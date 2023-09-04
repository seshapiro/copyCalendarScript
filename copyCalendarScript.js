const SECONDARY_CALENDAR_ID = "yourcalendar@gmail.com";
// primary calendar is your "work" calendar where secondary events will be copied over as "Busy" slots
const PRIMARY_CALENDAR_ID = "yourcalendar@work.com";

// *******************
// These you can customize if you want
// *******************

// How many days ahead do you want to block off time in your primary calendar
const DAYS_LOOKAHEAD = 14;
// What title do your secondary events have in your primary calendar
const BUSY_EVENT_TITLE = "Busy";
// Override your usual primary calendar event color for copied Busy events. 
// From https://developers.google.com/apps-script/reference/calendar/event-color.html
// If you don't want to override, comment out the place this constant is used.
const BUSY_EVENT_COLOR_ID = CalendarApp.EventColor.GRAY;
// ignore secondary events that end before this time (in 24 hr time)
const IGNORE_SECONDARY_EVENTS_BEFORE = 9
// ignore secondary events that start after this time (in 24 hr time)
const IGNORE_SECONDARY_EVENTS_AFTER = 17
// ignore secondary events over weekends
const IGNORE_SECONDARY_EVENTS_ON_WEEKENDS = true

// *******************
// Below here is code you can look through and tweak if you want, but most of the customization
// should be above.
// *******************

// source: https://gist.github.com/ttrahan/a88febc0538315b05346f4e3b35997f2
// blog: https://chromatichq.com/blog/syncing-your-personal-work-calendars
// original:
// https://medium.com/@willroman/auto-block-time-on-your-work-google-calendar-for-your-personal-events-2a752ae91dab
function exec() {
  const today = new Date();
  const enddate = new Date();
  enddate.setDate(today.getDate() + DAYS_LOOKAHEAD); // how many days in advance to monitor and block off time

  const secondaryCal = CalendarApp.getCalendarById(SECONDARY_CALENDAR_ID);
  const secondaryEvents = secondaryCal.getEvents(today, enddate);

  const primaryCal = CalendarApp.getCalendarById(PRIMARY_CALENDAR_ID);
  const primaryEvents = primaryCal.getEvents(today, enddate); // all primary calendar events

  const primaryEventTitle = BUSY_EVENT_TITLE; 

  let evi, existingEvent;
  const primaryEventsFiltered = []; // primary events that were previously created from secondary
  const primaryEventsUpdated = []; // primary events that were updated from secondary calendar
  const primaryEventsCreated = []; // primary events that were created from secondary calendar
  const primaryEventsDeleted = []; // primary events previously created that have been deleted from secondary

  Logger.log("Number of primaryEvents: " + primaryEvents.length);
  Logger.log("Number of secondaryEvents: " + secondaryEvents.length);

  // create filtered list of existing primary calendar events that were previously created from the secondary calendar
  for (let pev in primaryEvents) {
    const pEvent = primaryEvents[pev];
    if (pEvent.getTitle() === primaryEventTitle) { primaryEventsFiltered.push(pEvent); }
  }

  // process all events in secondary calendar
  for (let sev in secondaryEvents) {
    let canSkip = false;
    evi = secondaryEvents[sev];

    // if the secondary event has already been blocked in the primary calendar, update it
    for (existingEvent in primaryEventsFiltered) {
      const pEvent = primaryEventsFiltered[existingEvent];
      const isSameStart = pEvent.getStartTime().getTime() === evi.getStartTime().getTime();
      const isSameEnd = pEvent.getEndTime().getTime() === evi.getEndTime().getTime();
      if (isSameStart && isSameEnd) {
        canSkip = true;

        // There's probably no carry updates as long as the only thing you're syncing is "Busy". If you wanted to
        // copy over more info, this would be the place to re-copy updates

        // pEvent.setDescription(secondaryTitle + '\n\n' + secondaryDesc);
        // etc...

        primaryEventsUpdated.push(pEvent.getId());
      }
    }

    if (canSkip) continue;

    if (shouldIgnore(evi)) {
      continue;
    }

    // if the secondary event does not exist in the primary calendar, create it
    // we use the Calendar API (instead of the CalendarApp given to us) because it allows us to specify not using
    // default reminders, so we aren't notified about meaningless "Busy" events.
    const event = {
      summary: primaryEventTitle,
      start: {
        dateTime: evi.getStartTime().toISOString(),
      },
      end: {
        dateTime: evi.getEndTime().toISOString(),
      },
      colorId: BUSY_EVENT_COLOR_ID,
      reminders: {
        useDefault: false,
      },
    };
    const newEvent = Calendar.Events.insert(event, PRIMARY_CALENDAR_ID);
    primaryEventsCreated.push(newEvent.id);
    Logger.log("PRIMARY EVENT CREATED", newEvent);
  }

  // if a primary event previously created no longer exists in the secondary calendar, delete it
  for (pev in primaryEventsFiltered) {
    const pevIsUpdatedIndex = primaryEventsUpdated.indexOf(primaryEventsFiltered[pev].getId());
    if (pevIsUpdatedIndex === -1) {
      const pevIdToDelete = primaryEventsFiltered[pev].getId();
      Logger.log(pevIdToDelete + " deleted");
      primaryEventsDeleted.push(pevIdToDelete);
      primaryEventsFiltered[pev].deleteEvent();
    }
  }

  Logger.log("Primary events previously created: " + primaryEventsFiltered.length);
  Logger.log("Primary events no change: " + primaryEventsUpdated.length);
  Logger.log("Primary events deleted: " + primaryEventsDeleted.length);
  Logger.log("Primary events created: " + primaryEventsCreated.length);

}

// You can update the conditions where you do not copy secondary events over as "Busy"
function shouldIgnore(event) {
  // Do nothing if the event is an all-day or multi-day event. This script only syncs hour-based events
  if (event.isAllDayEvent()) {
    return true;
  }

  // skip events that end by 9 AM
  if (event.getEndTime().getHours() <= IGNORE_SECONDARY_EVENTS_BEFORE) {
    return true;
  }

  // skip events that start after 5pm
  if (event.getStartTime().getHours() >= IGNORE_SECONDARY_EVENTS_AFTER) {
    return true;
  }

  if (IGNORE_SECONDARY_EVENTS_ON_WEEKENDS) {
    const date = event.getStartTime();
    const dayNum = date.getDay();
    if (dayNum === 0 || dayNum === 6) {
      return true;
    }
  }
  
  return false;
}
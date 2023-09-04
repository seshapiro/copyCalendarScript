// ****************************************************************************
// Copy Calendar Script
// SS 09/03/2023 - V3 Production
// ****************************************************************************

// work calendar is your "work" calendar or one you'll copy events from
const WORK_CALENDAR_ID = "s.shapiro@hellobluewave.com";
// personal calendar is your "personal" calendar where work (work) events will be copied over as "Busy" slots
const PERSONAL_CALENDAR_ID = "1d17eb7e389388b9db58b2683307d5d0e57f08f4d86bfbc32f645a1cde6d875c@group.calendar.google.com";

// ****************************************************************************
// These you can customize if you want
// ****************************************************************************

// How many days ahead do you want to block off time in your personal calendar
const DAYS_LOOKAHEAD = 3;
// What title do your work events have in your personal calendar
const BUSY_EVENT_TITLE = "Busy";
// Override your usual personal calendar event color for copied Busy events. 
const BUSY_EVENT_COLOR_ID = CalendarApp.EventColor.ORANGE;
// ignore work events that end before this time (in 24 hr time)
const IGNORE_WORK_EVENTS_BEFORE = 8
// ignore work events that start after this time (in 24 hr time)
const IGNORE_WORK_EVENTS_AFTER = 23
// ignore work events over weekends
const IGNORE_WORK_EVENTS_ON_WEEKENDS = true


function exec() {
  const today = new Date();
  const enddate = new Date();
  enddate.setDate(today.getDate() + DAYS_LOOKAHEAD); // how many days in advance to monitor and block off time

  const workCal = CalendarApp.getCalendarById(WORK_CALENDAR_ID);
  const workEvents = workCal.getEvents(today, enddate);

  const personalCal = CalendarApp.getCalendarById(PERSONAL_CALENDAR_ID);
  const personalEvents = personalCal.getEvents(today, enddate); // all personal calendar events

  const personalEventTitle = BUSY_EVENT_TITLE; 

  let evi, existingEvent;
  const personalEventsFiltered = []; // personal events that were previously created from work
  const personalEventsUpdated = []; // personal events that were updated from work calendar
  const personalEventsCreated = []; // personal events that were created from work calendar
  const personalEventsDeleted = []; // personal events previously created that have been deleted from work
  const personalEventsString = personalEventsCreated.toString();


  Logger.log("Number of personalEvents: " + personalEvents.length);
  Logger.log("Number of workEvents: " + workEvents.length);

  // process all events in work calendar
  for (let sev in workEvents) {
    let canSkip = false;
    evi = workEvents[sev];

  // create filtered list of existing personal calendar events that were previously created from the work calendar
  for (let pev in personalEvents) {
    const pEvent = personalEvents[pev];
    if (pEvent.getTitle() === evi.getTitle()) { personalEventsFiltered.push(pEvent); }
  }

    // if the work event has already been blocked in the personal calendar, update it
    for (existingEvent in personalEventsFiltered) {
      const pEvent = personalEventsFiltered[existingEvent];
      const isSameStart = pEvent.getStartTime().getTime() === evi.getStartTime().getTime();
      const isSameEnd = pEvent.getEndTime().getTime() === evi.getEndTime().getTime();
      const isSameTitle = pEvent.getTitle() === evi.getTitle();
      const eventTitle = evi.getTitle();
      const eventGuests = evi.getGuestList(true);
      const eventDesc = evi.getDescription();

      if (isSameStart && isSameEnd && isSameTitle) {
        canSkip = true;

        // There's probably no carry updates as long as the only thing you're syncing is "Busy". If you wanted to
        // copy over more info, this would be the place to re-copy updates

        pEvent.setDescription(eventDesc);
        pEvent.setTitle(eventTitle);
        // etc...

        personalEventsUpdated.push(pEvent.getId());
      }
    }

    if (canSkip) continue;

    if (shouldIgnore(evi)) {
      continue;
    }

    // if the work event does not exist in the personal calendar, create it
    // we use the Calendar API (instead of the CalendarApp given to us) because it allows us to specify not using
    // default reminders, so we aren't notified about meaningless "Busy" events.

    const eventTitle = evi.getTitle();
    const eventGuests = evi.getGuestList(true);
    const eventDesc = evi.getDescription();
    const event = {
      summary: eventTitle,
      start: {
        dateTime: evi.getStartTime().toISOString(),
      },
      end: {
        dateTime: evi.getEndTime().toISOString(),
      },
      description: eventDesc, //+ '\n\n' + eventGuests.getName,
      colorId: BUSY_EVENT_COLOR_ID,
      reminders: {
        useDefault: true,
      },
    };
    const newEvent = Calendar.Events.insert(event, PERSONAL_CALENDAR_ID);
    personalEventsCreated.push(newEvent.id);
    Logger.log("PERSONAL EVENT CREATED: " + newEvent.summary + " ||| " + newEvent.start + "-" + newEvent.end);
  }

  // if a personal event previously created no longer exists in the work calendar, delete it
  for (pev in personalEventsFiltered) {
    const pevIsUpdatedIndex = personalEventsUpdated.indexOf(personalEventsFiltered[pev].getId());
    if (pevIsUpdatedIndex === -1) {
      const pevIdToDelete = personalEventsFiltered[pev].getId();
      Logger.log(pevIdToDelete + " deleted");
      personalEventsDeleted.push(pevIdToDelete);
      personalEventsFiltered[pev].deleteEvent();
    }
  }

  Logger.log("Personal events previously created: " + personalEventsFiltered.length);
  Logger.log("Personal events no change: " + personalEventsUpdated.length);
  Logger.log("Personal events deleted: " + personalEventsDeleted.length);
  Logger.log("Personal events created: " + personalEventsCreated.length);

}

// You can update the conditions where you do not copy work events over as "Busy"
function shouldIgnore(event) {
  // Do nothing if the event is an all-day or multi-day event. This script only syncs hour-based events
  if (event.isAllDayEvent()) {
    return true;
  }

  // skip events that end by 9 AM
  if (event.getEndTime().getHours() <= IGNORE_WORK_EVENTS_BEFORE) {
    return true;
  }

  // skip events that start after 5pm
  if (event.getStartTime().getHours() >= IGNORE_WORK_EVENTS_AFTER) {
    return true;
  }

  if (IGNORE_WORK_EVENTS_ON_WEEKENDS) {
    const date = event.getStartTime();
    const dayNum = date.getDay();
    if (dayNum === 0 || dayNum === 6) {
      return true;
    }
  }
  
  return false;
}
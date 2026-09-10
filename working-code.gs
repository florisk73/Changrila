// Bungalow colors
const BUNGALOW_COLORS = {
  "1": "5",   // yellow
  "2": "6",   // orange
  "3": "11",  // red
  "4": "3",   // purple
  "5": "7",   // blue
  "6": "2"    // green
};

// Helper to get the Bookings calendar
function getBookingsCalendar() {
  const calendars = CalendarApp.getCalendarsByName("Bookings");
  return calendars.length > 0 ? calendars[0] : CalendarApp.getDefaultCalendar();
}

// -------------------------------------------------------
// doPost: called when contact form is submitted
// -------------------------------------------------------
function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "No data received" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data  = JSON.parse(e.postData.contents);

  // Save to sheet
  sheet.appendRow([
    new Date(),
    data.name,
    data.email,
    data.checkin,
    data.checkout,
    data.guests,
    data.room,
    data.message,
    "",   // I: Bungalow dropdown
    ""    // J: Event ID
  ]);

  // Add bungalow dropdown to column I
  const lastRow = sheet.getLastRow();
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["1","2","3","4","5","6"], true)
    .build();
  sheet.getRange(lastRow, 9).setDataValidation(rule);

  // Create grey calendar event in Bookings calendar
  if (data.checkin && data.checkout) {
    try {
      const calendar = getBookingsCalendar();
      const checkIn  = new Date(data.checkin  + "T14:00:00");
      const checkOut = new Date(data.checkout + "T12:00:00");

      const event = calendar.createEvent(
        "⏳ " + data.name + " (unconfirmed)",
        checkIn,
        checkOut,
        {
          description:
            "Email: "    + data.email   + "\n" +
            "Guests: "   + data.guests  + "\n" +
            "Room: "     + data.room    + "\n\n" +
            "Message:\n" + data.message
        }
      );
      event.setColor("8");
      sheet.getRange(lastRow, 10).setValue(event.getId());

    } catch(err) {
      console.log("Calendar ERROR: " + err.message);
    }
  }

  // Notify owner
  MailApp.sendEmail({
    to: "florisk73@gmail.com",
    subject: "New booking request — " + data.name,
    body:
      "New booking request received!\n\n" +
      "Name:      " + data.name     + "\n" +
      "Email:     " + data.email    + "\n" +
      "Check-in:  " + data.checkin  + "\n" +
      "Check-out: " + data.checkout + "\n" +
      "Guests:    " + data.guests   + "\n" +
      "Room:      " + data.room     + "\n\n" +
      "Message:\n" + data.message   + "\n\n" +
      "Open the spreadsheet to assign a bungalow and confirm."
  });

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// -------------------------------------------------------
// onEdit: fires when bungalow dropdown is changed in sheet
// -------------------------------------------------------
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;

  if (range.getColumn() !== 9) return;

  const bungalow = String(range.getValue());
  const row      = range.getRow();
  if (row < 2) return;

  const eventId = sheet.getRange(row, 10).getValue();
  if (!eventId) return;

  try {
    const calendar = getBookingsCalendar();
    const event    = calendar.getEventById(eventId);
    if (!event) return;

    const name = sheet.getRange(row, 2).getValue();

    if (bungalow && BUNGALOW_COLORS[bungalow]) {
      event.setColor(BUNGALOW_COLORS[bungalow]);
      event.setTitle("✅ " + name + " — Bungalow " + bungalow);
    } else {
      event.setColor("8");
      event.setTitle("⏳ " + name + " (unconfirmed)");
    }
  } catch(err) {
    console.log("onEdit ERROR: " + err.message);
  }
}
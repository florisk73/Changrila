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

function createBookingEvent(data) {

  try {

    Logger.log(JSON.stringify(data));

    const calendar = getBookingsCalendar();

    const checkIn  = new Date(data.checkin + "T14:00:00");
    const checkOut = new Date(data.checkout + "T12:00:00");

    Logger.log(checkIn);
    Logger.log(checkOut);

    const event = calendar.createEvent(
      "⏳ " + data.name + " (unconfirmed)",
      checkIn,
      checkOut,
      {
        description:
          "Email: " + data.email + "\n" +
          "Guests: " + data.guests + "\n" +
          "Room: " + data.room + "\n\n" +
          "Message:\n" + data.message
      }
    );

    event.setColor("8");

    Logger.log("EVENT CREATED");

    return event.getId();

  } catch(err) {

    Logger.log(err.toString());

    throw err;     // <-- IMPORTANT

  }

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
  const token = Utilities.getUuid();

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
    "",     // I: Bungalow dropdown
    "",     // J: Event ID
    token,  // K Verification token
    "No"    // L Verified?
  ]);

  // Add bungalow dropdown to column I
  const lastRow = sheet.getLastRow();
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["1","2","3","4","5","6"], true)
    .build();
  sheet.getRange(lastRow, 9).setDataValidation(rule);

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

  // Send verification email to customer
  sendVerificationEmail(data.email, token);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendVerificationEmail(email, token) {

  const url = ScriptApp.getService().getUrl() +
      "?token=" + encodeURIComponent(token);

  MailApp.sendEmail({
    to: email,
    subject: "Please verify your booking request",
    htmlBody:
      "<p>Thank you for contacting ChangriLa Resort.</p>" +
      "<p>Please click the link below to verify your email address.</p>" +
      "<p><a href='" + url + "'>Verify my booking</a></p>"
  });
}

function doGet(e) {

  const token = e.parameter.token;

  if (!token) {
    return HtmlService.createHtmlOutput(
      "<h2>Invalid verification link.</h2>"
    );
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const values = sheet.getDataRange().getValues();

  // Loop through all bookings (skip header)
  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    const storedToken = row[10];    // Column K
    const verified    = row[11];    // Column L

    if (storedToken != token) continue;

    // Already verified?
    if (verified === "Yes") {
      return HtmlService.createHtmlOutput(
        "<h2>✅ This booking has already been verified.</h2>"
      );
    }

    const booking = {
      name: row[1],
      email: row[2],
      checkin: row[3],
      checkout: row[4],
      guests: row[5],
      room: row[6],
      message: row[7]
    };

    try {

      const calendar = getBookingsCalendar();

      const checkIn = new Date(booking.checkin);
      checkIn.setHours(14,0,0,0);

      const checkOut = new Date(booking.checkout);
      checkOut.setHours(12,0,0,0);

      const event = calendar.createEvent(
        "TEST VERIFIED " + booking.name,
        checkIn,
        checkOut
      );

      const eventId = event.getId();

      sheet.getRange(i + 1, 10).setValue(eventId);
      sheet.getRange(i + 1, 12).setValue("Yes");

    } catch(err) {

      MailApp.sendEmail({
        to: "florisk73@gmail.com",
        subject: "createBookingEvent ERROR",
        body: err.toString() + "\n\n" + err.stack
      });

      throw err;

    }

    // Notify you
    MailApp.sendEmail({
      to: "florisk73@gmail.com",
      subject: "Customer verified email — " + booking.name,
      body:
        booking.name + " has verified their email address.\n\n" +
        "The booking request is ready for review."
    });

    return HtmlService.createHtmlOutput(
      "<h2>✅ Thank you!</h2>" +
      "<p>Your email address has been verified.</p>" +
      "<p>We have received your booking request.</p>" +
      "<p>We will contact you shortly.</p>"
    );
  }

  return HtmlService.createHtmlOutput(
    "<h2>Verification link not found.</h2>"
  );
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

function testCalendar() {

  const calendar = getBookingsCalendar();

  const start = new Date();
  start.setHours(14,0,0,0);

  const end = new Date();
  end.setDate(end.getDate()+1);
  end.setHours(12,0,0,0);

  const event = calendar.createEvent(
    "TEST EVENT",
    start,
    end
  );

  Logger.log(event.getId());

}
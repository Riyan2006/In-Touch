package app.intouch.demo;

import android.Manifest;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Reads only enough of the device calendar to form monthly meetup counts.
 * Individual event titles, places, notes, guests, and identifiers are never
 * returned to the web layer or written to storage/logs.
 */
@CapacitorPlugin(name = "CalendarMeetups", permissions = {
        @Permission(alias = "calendar", strings = { Manifest.permission.READ_CALENDAR })
})
public class CalendarMeetupsPlugin extends Plugin {
    @PluginMethod
    public void scan(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            requestPermissionForAlias("calendar", call, "calendarPermissionResult");
            return;
        }
        scanAndResolve(call);
    }

    @PermissionCallback
    private void calendarPermissionResult(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            call.reject("Calendar access was not granted. In Touch cannot find calendar meetups without it.");
            return;
        }
        scanAndResolve(call);
    }

    private void scanAndResolve(PluginCall call) {
        String displayName = call.getString("displayName", "").trim();
        String email = call.getString("email", "").trim().toLowerCase(Locale.ROOT);
        boolean includeTitleMatches = call.getBoolean("includeTitleMatches", false);
        String normalizedName = normalize(displayName);
        if (normalizedName.isEmpty()) { call.reject("A display name is needed to look for calendar meetups."); return; }

        Calendar firstMonth = Calendar.getInstance();
        firstMonth.set(Calendar.DAY_OF_MONTH, 1);
        firstMonth.set(Calendar.HOUR_OF_DAY, 0); firstMonth.set(Calendar.MINUTE, 0); firstMonth.set(Calendar.SECOND, 0); firstMonth.set(Calendar.MILLISECOND, 0);
        firstMonth.add(Calendar.MONTH, -11);
        Calendar afterLastMonth = (Calendar) firstMonth.clone(); afterLastMonth.add(Calendar.MONTH, 12);
        ArrayList<String> keys = new ArrayList<>(); Map<String, Integer> counts = new HashMap<>();
        SimpleDateFormat keyFormat = new SimpleDateFormat("yyyy-MM", Locale.US);
        SimpleDateFormat labelFormat = new SimpleDateFormat("MMM yyyy", Locale.US);
        Calendar cursorMonth = (Calendar) firstMonth.clone();
        for (int i = 0; i < 12; i++) { String key = keyFormat.format(cursorMonth.getTime()); keys.add(key); counts.put(key, 0); cursorMonth.add(Calendar.MONTH, 1); }

        Uri uri = CalendarContract.Instances.CONTENT_URI.buildUpon().appendPath(Long.toString(firstMonth.getTimeInMillis())).appendPath(Long.toString(afterLastMonth.getTimeInMillis())).build();
        String[] projection = { CalendarContract.Instances.EVENT_ID, CalendarContract.Instances.BEGIN, CalendarContract.Instances.TITLE };
        int matches = 0;
        try (Cursor instances = getContext().getContentResolver().query(uri, projection, null, null, CalendarContract.Instances.BEGIN + " ASC")) {
            if (instances != null) {
                int eventIdIndex = instances.getColumnIndexOrThrow(CalendarContract.Instances.EVENT_ID);
                int beginIndex = instances.getColumnIndexOrThrow(CalendarContract.Instances.BEGIN);
                int titleIndex = instances.getColumnIndexOrThrow(CalendarContract.Instances.TITLE);
                while (instances.moveToNext()) {
                    long eventId = instances.getLong(eventIdIndex);
                    boolean matchingAttendee = attendeeMatches(eventId, email, normalizedName);
                    String title = includeTitleMatches ? instances.getString(titleIndex) : null;
                    boolean matchingTitle = includeTitleMatches && title != null && normalize(title).contains(normalizedName);
                    title = null; // Event content is discarded immediately after the one boolean comparison.
                    if (!matchingAttendee && !matchingTitle) continue;
                    Calendar when = Calendar.getInstance(); when.setTimeInMillis(instances.getLong(beginIndex));
                    String key = keyFormat.format(when.getTime());
                    counts.put(key, counts.get(key) + 1); matches++;
                }
            }
        } catch (SecurityException exception) { call.reject("Calendar access was not available on this device."); return; }

        JSArray months = new JSArray(); cursorMonth = (Calendar) firstMonth.clone();
        for (int i = 0; i < 12; i++) { JSObject month = new JSObject(); month.put("month", i + 1); month.put("label", labelFormat.format(cursorMonth.getTime())); month.put("meetup_count", counts.get(keys.get(i))); months.put(month); cursorMonth.add(Calendar.MONTH, 1); }
        JSObject result = new JSObject(); result.put("months", months); result.put("match_count", matches); call.resolve(result);
    }

    private boolean attendeeMatches(long eventId, String email, String normalizedName) {
        String[] projection = { CalendarContract.Attendees.ATTENDEE_EMAIL, CalendarContract.Attendees.ATTENDEE_NAME };
        try (Cursor attendees = CalendarContract.Attendees.query(getContext().getContentResolver(), eventId, projection)) {
            if (attendees == null) return false;
            int emailIndex = attendees.getColumnIndex(CalendarContract.Attendees.ATTENDEE_EMAIL);
            int nameIndex = attendees.getColumnIndex(CalendarContract.Attendees.ATTENDEE_NAME);
            while (attendees.moveToNext()) {
                String attendeeEmail = emailIndex >= 0 ? attendees.getString(emailIndex) : null;
                String attendeeName = nameIndex >= 0 ? attendees.getString(nameIndex) : null;
                if (!email.isEmpty() && attendeeEmail != null && email.equals(attendeeEmail.trim().toLowerCase(Locale.ROOT))) return true;
                if (attendeeName != null && normalizedName.equals(normalize(attendeeName))) return true;
            }
        }
        return false;
    }

    private String normalize(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").replaceAll("\\s+", " "); }
}

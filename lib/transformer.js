/**
 * ICS Builders
 * */

var crypto = require('crypto'),
    moment = require('moment'),
    path = require('path');

function _transformRepeating(repeating) {
    var transformed = {};

    transformed.freq = repeating['FREQ'] || 'DAILY';
    if(repeating['COUNT']) transformed.count = repeating['COUNT'] | 0;
    if(repeating['UNTIL']) transformed.until = moment(repeating['UNTIL']).toDate();
    if(repeating['INTERVAL']) transformed.interval = repeating['INTERVAL'] | 0;
    if(repeating['BYMONTH']) transformed.bymonth = repeating['BYMONTH'].split(',');
    if(repeating['BYDAY']) transformed.byday = repeating['BYDAY'].split(',');

    return transformed;
}

function _transformParticipant(participant) {
    var transformed = {};
    var asis = {
        'CN': 'name',
        'ROLE': 'role',
        'PARTSTAT': 'status',
        'RSVP': 'rsvp'
    };

    for(var key in asis) {
        var transformedKey = asis[key];
        if(participant[key]) {
            transformed[transformedKey] = participant[key];
        }
    }

    return transformed;
}

function _transformEvent(vEvent) {
    var transformed = {};
    var asis = {
        'UID': 'uid',
        'DTSTAMP': 'stamp',
        'TRANSP': 'transp',
        'DTSTART': 'start',
        'DTEND': 'end',
        'LOCATION': 'location',
        'SUMMARY': 'summary',
        'SEQUENCE': 'sequence',
        'DESCRIPTION': 'description',
        'STATUS': 'status'
    };

    for(var key in asis) {
        var transformedKey = asis[key];
        if(vEvent[key]) {
            transformed[transformedKey] = vEvent[key];
            delete vEvent[key];
        }
    }

    // TODO: Transform alarms
    if(transformed.start.length < 11 && transformed.end.length < 11) {  // If only date, it is an all day event
        transformed.allDay = true;
    } else {
        transformed.allDay = false;
    }
    transformed.start = moment(transformed.start).toDate();
    transformed.end = moment(transformed.end).toDate();
    transformed.stamp = moment(transformed.stamp).toDate();

    if(vEvent['RRULE']) {
        var repeat = vEvent['RRULE'];
        var checks = repeat.split(';');
        var repeating = {};

        for(var i in checks) {
            var keyVal = checks[i].split('=');
            repeating[keyVal[0]] = keyVal[1];
        }
        transformed.repeating = _transformRepeating(repeating);

        delete vEvent['RRULE'];
    }

    transformed.attendees = [];
    for(var key in vEvent) {
        var checks = key.split(';');
        var checkKey = checks.shift();
        if(checkKey === 'ORGANIZER') {
            var organizer = {};
            for(var i in checks) {
                var keyVal = checks[i].split('=');
                organizer[keyVal[0]] = keyVal[1];
            }
            transformed.organizer = _transformParticipant(organizer);
            transformed.organizer.email = (vEvent[key] + '').replace('MAILTO:', '').replace('mailto:', '');

            delete vEvent[key];
        } else if(checkKey === 'ATTENDEE') {
            var attendee = {};
            for(var i in checks) {
                var keyVal = checks[i].split('=');
                attendee[keyVal[0]] = keyVal[1];
            }
            var atn = _transformParticipant(attendee);
            atn.email = (vEvent[key] + '').replace('MAILTO:', '').replace('mailto:', '');
            transformed.attendees.push(atn);

            delete vEvent[key];
        }
    }

    transformed.additionalTags = vEvent;
    return transformed;
}

function transformCalendar(json) {
    var calendar = (json.VCALENDAR && json.VCALENDAR[0]) || {};
    var asis = {
        'VERSION': 'version',
        'CALSCALE': 'calscale',
        'X-WR-CALNAME': 'calname',
        'METHOD': 'method',
        'PRODID': 'prodid',
        'X-WR-TIMEZONE': 'timezone'
    };
    var transformed = {
        events: []
    };

    for(var key in asis) {
        var transformedKey = asis[key];
        if(calendar[key]) {
            transformed[transformedKey] = calendar[key];
            delete calendar[key];
        }
    }

    if(calendar['VTIMEZONE']) {
        // Convert VTIMEZONE to tzid
        transformed.tzid = calendar['VTIMEZONE'][0]['TZID'];
        delete calendar['VTIMEZONE'];
    }

    if(calendar['VEVENT'] || json['VEVENT']) {
        var vEvents = calendar['VEVENT'] || json['VEVENT'];
        for(var i in vEvents) {
            transformed.events.push(_transformEvent(vEvents[i]));
        }

        delete calendar['VEVENT'];
    }

    transformed.additionalTags = calendar;
    return transformed;
}

/**
 * Export builder
 * */
exports.transform = transformCalendar;

import CalendarService from '../../services/calendar-service';

export default (req, res) => {
    const { languageId: language } = req;
    return {
        experiment: 'split-date-time',
        language,
        values: {
            passengers: 2,
        },
        labels: {
            heading: res.translations.forKey('web.base.booktransfer'),
            pickUpLocation: res.translations.forKey('web.agoda.pickup-location'),
            dropOffLocation: res.translations.forKey('web.agoda.dropoff-location'),
            pickupDate: res.translations.forKey('web.widget.route_description_date'),
            passengers: res.translations.forKey('web.widget.passengers'),
            returnJourney: res.translations.forKey('web.agoda.roundtrip'),
            returnJourneyTitle: res.translations.forKey('web.agoda.return-journey-label'),
            outwardJourneyTitle: res.translations.forKey('web.agoda.outward-journey-label'),
            search: res.translations.forKey('web.summary.searchbutton'),
            autocompletePlaceholder: res.translations.forKey('web.summary.placeholder'),
            months: CalendarService.months(language),
            days: CalendarService.days(language),
            affirmative: res.translations.forKey('web.agoda.roundtrip-affirmative'),
            negative: res.translations.forKey('web.agoda.roundtrip-negative'),
            timePickerTitle: res.translations.forKey('web.base.pick-up-time'),
            hour: res.translations.forKey('web.base.hour'),
            minute: res.translations.forKey('web.base.minute'),
            confirm: res.translations.forKey('web.base.confirm-btn'),
            pickupTime: res.translations.forKey('web.base.time'),
            returnDate: res.translations.forKey('web.base.return-date'),
            returnTime: res.translations.forKey('web.base.return-time'),
            errors: {
                pickupLocation: res.translations.forKey('web.summary.errorpickup'),
                dropoffLocation: res.translations.forKey('web.summary.errordropoff'),
                pickupTime: res.translations.forKey('web.summary.errordatetime'),
                returnTime: res.translations.forKey('web.summary.errordayrequired'),
                passengers: res.translations.forKey('web.agoda.number-of-passengers'),
            },
        },
    };
};

import moment from 'moment';

import flightFinderProps from '../flight-finder/props';
import passengerDetailsProps from '../passenger-details/props';

export default (req, res) => {
    const {
        translations,
        pickupLocation,
        dropoffLocation: { coordinates: { lat, lng }, name, description },
        customerBookingToken,
        pickupTime,
    } = res;

    let dropoffLocation = [name, description]
        .filter(item => item)
        .join(', ');

    if (!dropoffLocation) {
        dropoffLocation = `${lat},${lng}`;
    }

    const props = {
        passengerDetails: passengerDetailsProps(req, res),
        flightFinder: {
            ...flightFinderProps(req, res),
            singlePickupExperiment: true,
            bookingRedesignToggle: true,
            fallback: false,
            showManualFlightFinder: false,
        },
        pickupDate: moment(pickupTime).format('ddd D MMM YYYY'),
        pickupLocation,
        dropoffLocation,
        labels: {
            completeBooking: translations.forKey('web.base.complete-booking'),
            pickupDate: translations.forKey('web.summary.pickupdate'),
            pickupLocation: translations.forKey('web.summary.from'),
            dropoffLocation: translations.forKey('web.summary.to'),
            freeAirportTaxiTitle: translations.forKey('web.summary.free-airport-taxi-title'),
            freeTaxiBookingError: translations.forKey('web.summary.free-taxi-booking-error'),
            freeTaxiBookingSuccess: translations.forKey('web.summary.free-taxi-booking-success'),
            notEnoughLeadTimeError: translations.forKey('web.summary.errordatetime'),
            freeTaxiAppreciation: translations.forKey('web.summary.free-taxi-booking-appreciation'),
            bookingFlightDetailsHeading: translations.forKey('web.details.flights-form-title'),
            flightDescription: translations.forKey('web.base.flight-number-why'),
        },
        customerBookingToken,
    };

    return props;
};

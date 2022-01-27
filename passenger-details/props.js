export default (req, res) => {
    const { translations } = res;
    const { customer } = res;
    const { customerBookingDetails } = res;

    const props = {
        labels: {
            heading: translations.forKey('web.details.customerdetails'),
            passengerTitle: translations.forKey('web.details.title'),
            passengerTitleTranslation: 'web.details.title',
            passengerDetailsYourDetailsTitleLabel: translations.forKey('web.base.passenger-details-heading'),
            passengerDetailsYourDetailsTitleTranslation: 'web.base.passenger-details-heading',
            passengerDetailsHeading: translations.forKey('web.details.passengerdetails'),
            passengerDetailsHeadingTranslation: 'web.details.passengerdetails',
            rideDetailsHeading: translations.forKey('web.details.ridedetails'),
            rideDetailsHeadingTranslation: 'web.details.ridedetails',
            flyingToFrom: translations.forKey('web.base.flying-to-from'),
            firstname: translations.forKey('web.details.firstname'),
            firstnameTranslation: 'web.details.firstname',
            lastname: translations.forKey('web.details.lastname'),
            lastnameTranslation: 'web.details.lastname',
            emailaddress: translations.forKey('web.details.emailaddress'),
            emailaddressTranslation: 'web.details.emailaddress',
            verifyemailaddress: translations.forKey('web.details.verifyemailaddress'),
            verifyemailaddressTranslation: 'web.details.verifyemailaddress',
            flightDetailsHeading: translations.forKey('web.details.flights-form-title'),
            flightDescription: translations.forKey('web.base.flight-number-why'),
            bookingFlightDetailsHeading: translations.forKey('web.base.flight-details'),
            phone: {
                experiment: true,
                title: translations.forKey('web.details.phone'),
                titleTranslation: 'web.details.phone',
                fyi: translations.forKey('web.details.phonemsg'),
                fyiTranslation: 'web.details.phonemsg',
                phoneRequired: translations.forKey('web.details.mobile-required'),
                phoneRequiredTranslation: 'web.details.mobile-required',
                driverContactRequired: translations.forKey('web.base.driver-contact-mobile-prompt'),
                driverContactRequiredTranslation: 'web.base.driver-contact-mobile-prompt',
            },
            meetAndGreet: translations.forKey('web.details.meetgreet'),
            meetAndGreetMessage: translations.forKey('web.details.meet-greet-message'),
            meetAndGreetMessageSub: translations.forKey('web.details.meet-greet-message-sub'),
            pickUpDetailsHeading: translations.forKey('web.details.pickup-details-heading'),
            driverComments: translations.forKey('web.details.comments'),
            driverCommentsDescription: translations.forKey('web.details.commentsguide'),
            specialOffers: translations.forKey('web.email-consent.description'),
            specialOffersTranslation: 'web.email-consent.description',
            specialOffersLabel: translations.forKey('web.email-consent.label'),
            specialOffersLabelTranslation: 'web.email-consent.label',
            specialOffersLabelOption: translations.forKey('web.email-consent.label-option'),
            specialOffersLabelOptionTranslation: 'web.email-consent.label-option',
            childSeatRequiredTitle: translations.forKey('web.details.childSeatRequired_heading'),
            childSeatRequiredDescription: translations.forKey('web.details.childSeatRequired_p1'),
            trainComments: translations.forKey('web.details.ptcommentsguide'),
            trainCommentsPlaceholder: translations.forKey('web.details.ptcommentsplaceholder'),
            trainCommentsDescription: translations.forKey('web.details.ptcommentsguide'),
            returnHeading: translations.forKey('web.details.return-heading'),
            specialOfferHeading: translations.forKey('web.details.special-offer-heading'),
            continueToBook: translations.forKey('web.base.continue-to-book-btn'),
            continueToBookKey: 'web.base.continue-to-book-btn',
            continue: translations.forKey('web.base.continue'),
            continueKey: 'web.base.continue',
            requiredFields: translations.forKey('web.base.required-fields'),
            almostDoneRequiredLabel: translations.forKey('web.base.required-info-almost-done-label'),
        },
        errors: {
            firstname: translations.forKey('web.details.errorfirstname'),
            lastname: translations.forKey('web.details.errorlastname'),
            emailaddress: translations.forKey('web.details.errorenteremail'),
            verifyemailaddress: translations.forKey('web.details.errormatchemail'),
            contactNumber: translations.forKey('web.details.errorphone'),
            flightnumber: translations.forKey('web.details.flights-no-flight-selected'),
        },
        fields: {
            title: translations.forKey('titles').map(value => value.text),
        },
    };

    if (customer && customer.locale) {
        props.country = customer.locale.country;
    } else {
        props.country = 'GB';
    }

    if (customerBookingDetails && customerBookingDetails.hasOwnProperty('customerTitle')) {
        props.values = {
            title: customerBookingDetails.customerTitle,
            firstname: customerBookingDetails.customerFirstName,
            lastname: customerBookingDetails.customerLastName,
            emailaddress: customerBookingDetails.customerEmail,
            verifyemailaddress: customerBookingDetails.verifyEmail,
            contactNumber: customerBookingDetails.customerCellphone,
            meetAndGreetMessage: customerBookingDetails.meetGreetCallSign,
            commentsForTheDriver: customerBookingDetails.passengerComments,
            flightnumber: customerBookingDetails.passengerFlightNumber,
            keepMeInformed: customerBookingDetails.consentToMarketing,
        };
    }
    return props;
};

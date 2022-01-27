import React from 'react';
import {
    shallow,
    mount,
} from 'enzyme';
import FreeTaxiPromotion from '../../src/components/free-taxi-promotion';
import PhoneInput from '../../src/components/input-phone';
import BookingActions from '../../src/actions/booking-actions';
import BookingStore from '../../src/stores/booking-store';
import FlightFinder from '../../src/components/flight-finder';
import alt from '../../src/alt';
import PassengerDetails from '../../src/components/passenger-details/passenger-details';

const dispatchAction = (action, data) => {
    alt.dispatcher.dispatch({
        action,
        data,
    });
};

describe('Free Taxi Promotion', () => {
    let renderedComponent;
    const customerBookingToken = 'c11c51186e0ff651b5c43d14e8b34dd5203ad8ce470bc1c79a231976adea231f4dba7b940c332f68b8cd012c67a62746a126762704a9eeaff1319cf2b968f8cbcd89992d0ad36ac77fdb90e50ce3e2825a88330217ee855bec43553472119337a01772361229dfdaa977d53ef9f1ef49cc7c8611145a6f4c08b1753c995f213eedfc5faef08f3ecb51ddb05b3a959a5768f73caff5e2ac4ef22820ce2712e0435456cea8e3f0bc583a17e179e4f1a64f91852630dd11d4fe5d12798ea598cb25d36d5bce4f7a62fab5258b3e60757a0bf603e635b414f5dff8295d59f931b21480bddcd1c05b36b90b793dd809b10f7bb6b9e9205bae4a8e39057b6b1e692f5c7200975c3719f5adddb84c7ee4ab6c8262fe83132ca5c6535cf8a08d49365ca250f05e544c3cfdc0b3c3ea4ead2d7454bd8e0e4cb9d8e9436c3f4a8a9e35f01788604649fbdcb422f2c21865cc6909a7';
    const render = (props, renderMethod = mount) => {
        props = {
            flightFinder: {
                labels: {
                    flightNumberHeading: 'It is essential we know your flight number so your driver can track your flight and ensure they pick you up even if your flight is delayed.',
                },
                flights: {
                    'Doncaster Sheffield Airport': {
                        'Thomson Airways': [
                            {
                                flightNumber: 'TOM123',
                                terminal: '3',
                                airlineCode: 'CX',
                                flightArrivalTime: '09:00',
                                originIata: 'DSA',
                                arrivalAirport: 'MAN',
                                airlineName: 'Thomson Airways',
                                flightArrivalDateTime: '2017-02-28T09:00:00.000',
                                airports: {
                                    arrival: {
                                        name: 'Manchester Airport',
                                        iata: 'MAN',
                                        time: '08:55',
                                    },
                                    departure: {
                                        name: 'Doncaster Sheffield Airport',
                                        iata: 'DSA',
                                        time: '06:55',
                                    },
                                },
                            },
                        ],
                    },
                },
            },
            passengerDetails: {
                labels: {
                    heading: 'Your Details',
                    specialOfferHeading: 'Something for the journey?',
                    passengerTitle: 'Title',
                    firstname: 'First name',
                    lastname: 'Last name',
                    emailaddress: 'Email address',
                    verifyemailaddress: 'Confirm email address',
                    passengerDetailsHeading: 'Passenger Details',
                    phone: {
                        experiment: false,
                        title: 'Mobile number',
                        fyi: 'Mobile FYI',
                    },
                },
                fields: {
                    title: ['Mr', 'Mrs'],
                },
                bookingRedesignToggle: false,
                errors: {
                    firstname: 'Please enter your first name',
                    lastname: 'Please enter your last name',
                    emailaddress: 'Please enter a valid email address',
                    verifyemailaddress: "The email addresses above don't match, please check",
                    contactNumber: 'Please enter a valid contact number',
                    flightnumber: 'No Flight Selected',
                },
            },
            labels: {
                freeAirportTaxiTitle: 'Free airport taxi',
                freeTaxiBookingSuccess: 'Your taxi is confirmed. Your booking reference is {0}. You can view the details by going to "My Booking"',
                notEnoughLeadTimeError: 'Pick-up date and time must be at least 2 hours in the future at the pick-up location',
                freeTaxiAppreciation: 'We hope you enjoy your free taxi with Booking.com.',
            },
            customerBookingToken,
            ...props,
        };
        renderedComponent = renderMethod(React.createElement(FreeTaxiPromotion, props));
        return renderedComponent;
    };

    afterEach(() => {
        renderedComponent.unmount();
        alt.recycle(BookingStore);
    });

    describe('When the user visits the page', () => {
        let renderedFreeTaxiPromotion;

        beforeEach(() => {
            renderedFreeTaxiPromotion = render();
        });

        describe('When the outermost page "Free Taxi Promotion" component renders', () => {
            it('Sets the customerBookingToken in the default state, if it is present', () => {
                expect(renderedFreeTaxiPromotion.state('customerBookingToken')).toBe(customerBookingToken);
            });

            it('Sets the loading state to false in the default state', () => {
                expect(renderedFreeTaxiPromotion.state('loading')).toBe(false);
            });

            it('Sets the handleSelectedFligthArrivalTime prop on the flight-finder', () => {
                expect(renderedFreeTaxiPromotion.find(FlightFinder).props().handleSelectedFlightArrivalDateTime)
                    .toBe(BookingActions.updateFlightArrivalDateTime);
            });

            it('Sets the handleFormattedContactNumber prop on the phone input', () => {
                expect(renderedFreeTaxiPromotion
                    .find(PassengerDetails)
                    .props()
                    .handleFormattedPhoneNumber,
                )
                    .toBe(BookingActions.updateFormattedPhoneNumber);
            });

            describe('When the "Free Taxi Booking Summary" renders', () => {
                it('Has the correct, translatable "free airport taxi" heading from the DB', () => {
                    expect(
                        renderedFreeTaxiPromotion
                            .find('[data-translation="web.summary.free-airport-taxi-title"]')
                            .exists(),
                    ).toBeTruthy();
                });

                it('Shows the "free airport taxi" heading label property', () => {
                    expect(
                        renderedFreeTaxiPromotion
                            .find('[data-translation="web.summary.free-airport-taxi-title"]')
                            .text(),
                    )
                        .toContain(
                            'Free airport taxi',
                        );
                });
            });

            describe('When the "Passenger Details" form renders', () => {
                it('Renders the passenger details form', () => {
                    expect(renderedFreeTaxiPromotion.find('[data-test="passenger-details"]')).toHaveLength(1);
                });

                it('Renders a title field', () => {
                    expect(renderedFreeTaxiPromotion.find('label[htmlFor="title"]').text()).toBe('Title');
                    expect(
                        renderedFreeTaxiPromotion
                            .find({
                                name: 'title',
                            })
                            .children()
                            .map(option => option.text()),
                    ).toEqual(['Mr', 'Mrs']);
                });

                it('Renders a firstname field', () => {
                    expect(renderedFreeTaxiPromotion.find('label[htmlFor="firstname"]').text()).toBe(
                        'First name',
                    );
                    expect(
                        renderedFreeTaxiPromotion.find({
                            name: 'firstname',
                        }).length,
                    ).toBe(1);
                });

                it('Renders a lastname field', () => {
                    expect(renderedFreeTaxiPromotion.find('label[htmlFor="lastname"]').text()).toBe(
                        'Last name',
                    );
                    expect(
                        renderedFreeTaxiPromotion.find({
                            name: 'lastname',
                        }).length,
                    ).toBe(1);
                });

                it('Renders an email address field', () => {
                    expect(renderedFreeTaxiPromotion.find('label[htmlFor="emailaddress"]').text()).toBe(
                        'Email address',
                    );
                    expect(
                        renderedFreeTaxiPromotion.find({
                            name: 'emailaddress',
                        }).length,
                    ).toBe(1);
                });

                it('Renders a confirmation of email address field', () => {
                    expect(renderedFreeTaxiPromotion.find('label[htmlFor="verifyemailaddress"]').text()).toBe(
                        'Confirm email address',
                    );
                    expect(
                        renderedFreeTaxiPromotion.find({
                            name: 'verifyemailaddress',
                        }).length,
                    ).toBe(1);
                });

                it('Renders a phone input field', () => {
                    expect(renderedFreeTaxiPromotion.find('[data-test="phone-input-label"]').text()).toBe(
                        'Mobile number',
                    );
                    expect(renderedFreeTaxiPromotion.find(PhoneInput).length).toBe(1);
                });

                it('Renders a required info label when a booking has not yet been made', () => {
                    expect(
                        renderedFreeTaxiPromotion
                            .find('[data-test="almost-done-required-info-label"]')
                            .exists(),
                    ).toBeTruthy();
                });
            });

            describe('When the "Flight Finder" component renders', () => {
                it('Renders flight details', () => {
                    expect(renderedFreeTaxiPromotion.find('[data-test="flight-details"]').length).toBe(1);
                });
            });
        });
    });

    describe('When the user attempts to book their free-taxi', () => {
        let renderedFreeTaxiPromotion;

        document.querySelector = jest.fn(className => ({
            previousSibling: `${className}:previousSibling`,
        }));

        beforeEach(() => {
            renderedFreeTaxiPromotion = render();
        });

        describe('When there are validation errors', () => {
            describe('When there are validation errors with the Passenger Details form', () => {
                beforeEach(() => {
                    dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                        firstname: '',
                        lastname: '',
                        emailaddress: '',
                        verifyemailaddress: '',
                        contactNumber: '',
                    });
                    renderedFreeTaxiPromotion.find('form').simulate('submit');
                });

                it('Shows errors on invalid fields', () => {
                    expect(renderedFreeTaxiPromotion.find('.rw-form__error').length).toBe(6);
                });

                it('Shows expected validation error messages', () => {
                    expect(
                        renderedFreeTaxiPromotion
                            .find('.rw-form__error')
                            .at(0)
                            .text(),
                    ).toBe('No Flight Selected');
                    expect(
                        renderedFreeTaxiPromotion
                            .find('.rw-form__error')
                            .at(1)
                            .text(),
                    ).toBe('Please enter your first name');
                    expect(
                        renderedFreeTaxiPromotion
                            .find('.rw-form__error')
                            .at(2)
                            .text(),
                    ).toBe('Please enter your last name');
                    expect(
                        renderedFreeTaxiPromotion
                            .find('.rw-form__error')
                            .at(3)
                            .text(),
                    ).toBe('Please enter a valid email address');
                    expect(
                        renderedFreeTaxiPromotion
                            .find('.rw-form__error')
                            .at(4)
                            .text(),
                    ).toBe("The email addresses above don't match, please check");
                    expect(
                        renderedFreeTaxiPromotion
                            .find('.rw-form__error')
                            .at(5)
                            .text(),
                    ).toBe('Please enter a valid contact number');
                });
            });

            describe('Where there are validation errors in the flight finder component', () => {
                beforeEach(() => {
                    dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                        firstname: 'Stan',
                        lastname: 'Navsson',
                        emailaddress: 'ridewaystestteam@gmail.com',
                        verifyemailaddress: 'ridewaystestteam@gmail.com',
                        contactNumber: '01234567890',
                        flightnumber: '',
                    });
                    dispatchAction(BookingActions.PHONE_NUMBER_UPDATED, {
                        value: '+440123456789',
                        isValid: true,
                    });
                    renderedFreeTaxiPromotion.find('form').simulate('submit');
                });

                it('Shows expected flight finder error message', () => {
                    expect(
                        renderedFreeTaxiPromotion
                            .find('.rw-form__error')
                            .at(0)
                            .text(),
                    ).toBe('No Flight Selected');
                });
            });
        });

        describe('When there are no validation errors', () => {
            describe('When a booking attempt is in progress', () => {
                it('Invokes the correct validateAndBookTakePromotion Action when the form is submitted', () => {
                    const validateAndBookActionSpy = jest.spyOn(BookingActions, 'validateAndBookTaxiPromotion');
                    renderedFreeTaxiPromotion = render();
                    renderedFreeTaxiPromotion.find('form').simulate('submit');
                    expect(validateAndBookActionSpy).toHaveBeenCalled();
                    validateAndBookActionSpy.mockRestore();
                });

                it('Should display a loading spinner when in the loading state', () => {
                    renderedFreeTaxiPromotion = render();
                    dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                        loading: true,
                    });
                    renderedFreeTaxiPromotion.find('form').simulate('submit');
                    expect(renderedFreeTaxiPromotion.find('[data-test="booking-loading"]').exists()).toBeTruthy();
                });

                it('Should disable the continue to book button when in the loading state', () => {
                    renderedFreeTaxiPromotion = render({}, shallow);
                    dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                        loading: true,
                    });
                    expect(renderedFreeTaxiPromotion.find('[data-test="free-taxi-promotion__complete-booking"]').props().disabled).toBeTruthy();
                });

                it('Should enable the continue to book button when not in the loading state', () => {
                    renderedFreeTaxiPromotion = render({}, shallow);
                    dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                        loading: false,
                    });
                    expect(renderedFreeTaxiPromotion.find('[data-test="free-taxi-promotion__complete-booking"]').props().disabled).toBeFalsy();
                });
            });

            describe('When a booking attempt has finished', () => {
                describe('When a booking attempt has finished successfully', () => {
                    it('Renders a booking success message upon booking confirmation', () => {
                        dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                            pageSuccessMessages: [
                                'freetaxibookingsuccess',
                            ],
                        });
                        renderedFreeTaxiPromotion.find('form').simulate('submit');
                        expect(renderedFreeTaxiPromotion.find('[data-test="booking-success"]').exists()).toBeTruthy();
                    });

                    it('Renders a success message that has the accessibility attribute to trigger screen reader', () => {
                        dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                            pageSuccessMessages: [
                                'freetaxibookingsuccess',
                            ],
                        });
                        renderedFreeTaxiPromotion.find('form').simulate('submit');
                        expect(renderedFreeTaxiPromotion.find('[role="alert"]').exists()).toBeTruthy();
                    });

                    it('Hides the "Complete Booking" button upon successful booking confirmation', () => {
                        dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                            pageSuccessMessages: [
                                'freetaxibookingsuccess',
                            ],
                            promotionalBookingCompleted: true,
                        });
                        renderedFreeTaxiPromotion.find('form').simulate('submit');
                        expect(
                            renderedFreeTaxiPromotion
                                .find(
                                    '[data-test="free-taxi-promotion__complete-booking"]',
                                )
                                .exists(),
                        )
                            .toBeFalsy();
                    });

                    it('Hides the required info label', () => {
                        dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                            pageSuccessMessages: [
                                'freetaxibookingsuccess',
                            ],
                            promotionalBookingCompleted: true,
                        });
                        renderedFreeTaxiPromotion.find('form').simulate('submit');
                        expect(
                            renderedFreeTaxiPromotion
                                .find('[data-test="almost-done-required-info-label"]')
                                .exists(),
                        ).toBeFalsy();
                    });

                    it('Renders a booking success message with the correct booking reference', () => {
                        dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                            pageSuccessMessages: [
                                'freetaxibookingsuccess',
                            ],
                            promotionalBookingReference: '10148310',
                        });
                        renderedFreeTaxiPromotion.find('form').simulate('submit');
                        expect(renderedFreeTaxiPromotion.find('[data-test="booking-success"]').text()).toMatch('10148310');
                    });

                    it('Renders a booking success message with the term "free taxi" in it', () => {
                        dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                            pageSuccessMessages: [
                                'freetaxibookingsuccess',
                            ],
                            promotionalBookingReference: '10148310',
                        });
                        renderedFreeTaxiPromotion.find('form').simulate('submit');
                        expect(
                            renderedFreeTaxiPromotion
                                .find('[data-test="booking-success"]')
                                .text(),
                        )
                            .toMatch('free taxi');
                    });
                });

                describe('When a booking attempt has finished unsuccessfully', () => {
                    beforeEach(() => {
                        dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                            pageErrorMessages: [
                                'freetaxibookingerror',
                            ],
                        });
                        renderedFreeTaxiPromotion.find('form').simulate('submit');
                    });

                    describe('When there are errors which are not specifically handled', () => {
                        it('Shows the generic booking error message', () => {
                            expect(renderedFreeTaxiPromotion.find('[data-test="booking-error"]').exists()).toBeTruthy();
                        });

                        it('Shows generic booking error translation string', () => {
                            expect(renderedFreeTaxiPromotion.find('[data-translation="web.summary.free-taxi-booking-error"]')
                                .exists())
                                .toBeTruthy();
                        });

                        it('Renders generic error message that has the accessibility attribute to trigger screen reader',
                            () => {
                                expect(renderedFreeTaxiPromotion.find('[role="alert"]')
                                    .exists())
                                    .toBeTruthy();
                            },
                        );
                    });

                    describe('When there are errors that are specifically handled', () => {
                        describe('When there is a "not enough lead time" error', () => {
                            beforeEach(() => {
                                dispatchAction(BookingActions.UPDATE_WITH_PARAMS, {
                                    pageErrorMessages: [
                                        'notenoughleadtimeerror',
                                    ],
                                });
                                renderedFreeTaxiPromotion.find('form').simulate('submit');
                            });

                            it('Shows expected not enough lead time error message', () => {
                                expect(renderedFreeTaxiPromotion.find('[data-test="not-enough-lead-time-error"]').exists()).toBeTruthy();
                            });

                            it('Shows expected not enough lead time error translation string', () => {
                                expect(renderedFreeTaxiPromotion.find('[data-translation="web.summary.errordatetime"]').exists()).toBeTruthy();
                            });

                            it('Replaces the default 2 with 72 in the lead time error message', () => {
                                expect(renderedFreeTaxiPromotion.find('[data-translation="web.summary.errordatetime"]').text()).toContain('72');
                            });

                            it('Renders a specific error message with accessibility attribute to trigger screen reader', () => {
                                expect(renderedFreeTaxiPromotion.find('[role="alert"]').exists()).toBeTruthy();
                            });
                        });
                    });
                });
            });
        });
    });
});

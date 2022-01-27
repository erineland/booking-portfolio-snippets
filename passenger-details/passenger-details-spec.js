import React from 'react';
import {
    mount,
} from 'enzyme';

import PassengerDetails from '../../src/components/passenger-details/passenger-details';
import PhoneInput from '../../src/components/input-phone';
import Tracking from '../../src/utils/tracking';
import BookingActions from '../../src/actions/booking-actions';

jest.mock('../../src/utils/tracking');

describe('PassengerDetails', () => {
    let renderedComponent;

    const render = (props, renderMethod = mount) => {
        props = props || {
            labels: {
                passengerDetailsYourDetailsTitleLabel: 'Your Details',
                specialOfferHeading: 'Something for the journey?',
                passengerTitle: 'Title',
                passengerDetailsHeading: 'Passenger Details',
            },
            fields: {
                title: ['Mr', 'Mrs'],
            },
        };
        props.labels.phone = {
            experiment: false,
            title: 'Mobile number',
            fyi: 'Mobile FYI',
        };
        props.flightLabels = {
            flightDescription: '',
        };
        renderedComponent = renderMethod(React.createElement(PassengerDetails, props));
        return renderedComponent;
    };

    afterEach(() => {
        renderedComponent.unmount();
    });

    describe('Labels', () => {
        it('has a passenger details heading', () => {
            const renderedBookingDetails = render();
            const headers = renderedBookingDetails
                .find('[data-test="passenger-details-group-heading"]')
                .map(heading => heading.text());
            expect(headers).toContain('Your Details');
        });

        it('has a translated passenger details heading', () => {
            const renderedBookingDetails = render({
                labels: {
                    passengerDetailsYourDetailsTitleLabel: 'Datos del pasajero',
                },
                fields: {
                    title: ['Mr', 'Mrs'],
                },
            });
            const headers = renderedBookingDetails
                .find('[data-test="passenger-details-group-heading"]')
                .map(heading => heading.text());
            expect(headers).toContain('Datos del pasajero');
        });
    });

    describe('Event Tracking', () => {
        it('has a Google Analytics event tacking when the user focuses on the title field', () => {
            const renderedBookingDetails = render();
            const mockedEvent = {
                target: {
                    name: 'title',
                },
            };
            renderedBookingDetails.find('[data-test="passenger-details-title-input"]').simulate('focus', mockedEvent);
            expect(Tracking.track).toBeCalledWith('ux', 'booking-details.form-focus', 'title');
        });

        it('has a Google Analytics event tracking when the user focuses on the first name field', () => {
            const renderedBookingDetails = render();
            const mockedEvent = {
                target: {
                    name: 'firstname',
                },
            };
            renderedBookingDetails.find('[data-test="passenger-details-firstname-input"]').simulate('focus', mockedEvent);
            expect(Tracking.track).toBeCalledWith('ux', 'booking-details.form-focus', 'firstname');
        });

        it('has a Google Analytics event tracking when the user focuses on the last name field', () => {
            const renderedBookingDetails = render();
            const mockedEvent = {
                target: {
                    name: 'lastname',
                },
            };
            renderedBookingDetails.find('[data-test="passenger-details-lastname-input"]').simulate('focus', mockedEvent);
            expect(Tracking.track).toBeCalledWith('ux', 'booking-details.form-focus', 'lastname');
        });

        it('has a Google Analytics event tracking when the user focuses on the passenger email field', () => {
            const renderedBookingDetails = render();
            const mockedEvent = {
                target: {
                    name: 'emailaddress',
                },
            };
            renderedBookingDetails.find('[data-test="passenger-details-emailaddress-input"]').simulate('focus', mockedEvent);
            expect(Tracking.track).toBeCalledWith('ux', 'booking-details.form-focus', 'emailaddress');
        });

        it('has a Google Analytics event tracking when the user focuses on the email verification field', () => {
            const renderedBookingDetails = render();
            const mockedEvent = {
                target: {
                    name: 'verifyemailaddress',
                },
            };
            renderedBookingDetails.find('[data-test="passenger-details-verifyemailaddress-input"]').simulate('focus', mockedEvent);
            expect(Tracking.track).toBeCalledWith('ux', 'booking-details.form-focus', 'verifyemailaddress');
        });
    });

    describe('When the handleFormattedPhoneNumber prop is passed in', () => {
        it('Assigns this handleFormattedPhoneNumber prop to the phone input field', () => {
            const renderedBookingDetails = render({
                labels: {
                    emailaddress: 'Email address',
                    phone: {
                        label: 'Mobile number',
                        fyi: 'You are required to have a working mobile phone at the time of pick-up.',
                    },
                },
                fields: {
                    title: ['Mr', 'Mrs'],
                },
                values: {
                    title: 'Mr',
                },
                handleFormattedPhoneNumber: BookingActions.updateFormattedPhoneNumber,
            });
            expect(renderedBookingDetails
                .find(PhoneInput)
                .props()
                .handleFormattedPhoneNumber,
            ).toBe(
                BookingActions.updateFormattedPhoneNumber,
            );
        });
    });

    describe('Form Fields', () => {
        it('has a title field', () => {
            const renderedBookingDetails = render({
                labels: {
                    passengerTitle: 'Title',
                },
                fields: {
                    title: ['Mr', 'Mrs'],
                },
            });
            expect(renderedBookingDetails.find('label[htmlFor="title"]').text()).toBe('Title');
            expect(
                renderedBookingDetails
                    .find({
                        name: 'title',
                    })
                    .children()
                    .map(option => option.text()),
            ).toEqual(['Mr', 'Mrs']);
        });

        it('has a firstname field', () => {
            const renderedBookingDetails = render({
                labels: {
                    firstname: 'First name',
                },
                fields: {
                    title: [],
                },
            });
            expect(renderedBookingDetails.find('label[htmlFor="firstname"]').text()).toBe(
                'First name',
            );
            expect(
                renderedBookingDetails.find({
                    name: 'firstname',
                }).length,
            ).toBe(1);
        });

        it('has a lastname field', () => {
            const renderedBookingDetails = render({
                labels: {
                    lastname: 'Last name',
                },
                fields: {
                    title: [],
                },
            });
            expect(renderedBookingDetails.find('label[htmlFor="lastname"]').text()).toBe(
                'Last name',
            );
            expect(
                renderedBookingDetails.find({
                    name: 'lastname',
                }).length,
            ).toBe(1);
        });

        it('has a email address field', () => {
            const renderedBookingDetails = render({
                labels: {
                    emailaddress: 'Email address',
                },
                fields: {
                    title: [],
                },
            });
            expect(renderedBookingDetails.find('label[htmlFor="emailaddress"]').text()).toBe(
                'Email address',
            );
            expect(
                renderedBookingDetails.find({
                    name: 'emailaddress',
                }).length,
            ).toBe(1);
        });

        it('has a confirmation of email address field', () => {
            const renderedBookingDetails = render({
                labels: {
                    verifyemailaddress: 'Confirm email address',
                },
                fields: {
                    title: [],
                },
            });
            expect(renderedBookingDetails.find('label[htmlFor="verifyemailaddress"]').text()).toBe(
                'Confirm email address',
            );
            expect(
                renderedBookingDetails.find({
                    name: 'verifyemailaddress',
                }).length,
            ).toBe(1);
        });

        it('has a phone input field', () => {
            const renderedBookingDetails = render({
                labels: {
                    emailaddress: 'Email address',
                    phone: {
                        label: 'Mobile number',
                        fyi: 'You are required to have a working mobile phone at the time of pick-up.',
                    },
                },
                fields: {
                    title: [],
                },
            });
            expect(renderedBookingDetails.find('label[htmlFor="contactNumber"]').text()).toBe(
                'Mobile number',
            );
            expect(renderedBookingDetails.find(PhoneInput).length).toBe(1);
        });
    });

    describe('Prepopulation', () => {
        it('prepopulates title field', () => {
            const renderedBookingDetails = render({
                labels: {},
                fields: {
                    title: ['Mr', 'Mrs'],
                },
                values: {
                    title: 'Mr',
                },
            });
            expect(
                renderedBookingDetails
                    .find({
                        name: 'title',
                    })
                    .prop('value'),
            ).toBe('Mr');
        });

        it('prepopulates firstname field', () => {
            const renderedBookingDetails = render({
                labels: {
                    firstname: 'First name',
                },
                fields: {
                    title: [],
                },
                values: {
                    firstname: 'John',
                },
            });
            expect(
                renderedBookingDetails
                    .find({
                        name: 'firstname',
                    })
                    .prop('value'),
            ).toBe('John');
        });

        it('prepopulates lastname field', () => {
            const renderedBookingDetails = render({
                labels: {
                    lastname: 'Last name',
                },
                fields: {
                    title: [],
                },
                values: {
                    lastname: 'Appleseed',
                },
            });
            expect(
                renderedBookingDetails
                    .find({
                        name: 'lastname',
                    })
                    .prop('value'),
            ).toBe('Appleseed');
        });

        it('prepopulates email address field', () => {
            const renderedBookingDetails = render({
                labels: {
                    emailaddress: 'Email address',
                },
                fields: {
                    title: [],
                },
                values: {
                    emailaddress: 'example@example.com',
                },
            });
            expect(
                renderedBookingDetails
                    .find({
                        name: 'emailaddress',
                    })
                    .prop('value'),
            ).toBe('example@example.com');
        });

        it('prepopulates confirmation of email address field', () => {
            const renderedBookingDetails = render({
                labels: {
                    verifyemailaddress: 'Confirm email address',
                },
                fields: {
                    title: [],
                },
                values: {
                    verifyemailaddress: 'example@example.com',
                },
            });
            expect(
                renderedBookingDetails
                    .find({
                        name: 'verifyemailaddress',
                    })
                    .prop('value'),
            ).toBe('example@example.com');
        });

        it('prepopulates phone input field', () => {
            const renderedBookingDetails = render({
                labels: {
                    emailaddress: 'Email address',
                    phone: {
                        label: 'Mobile number',
                        fyi: 'You are required to have a working mobile phone at the time of pick-up.',
                    },
                },
                fields: {
                    title: [],
                },
                values: {
                    contactNumber: '01234567890',
                },
            });
            expect(renderedBookingDetails.find(PhoneInput).prop('value')).toBe('01234567890');
        });
    });
});

import React from 'react';
import {
    mount,
} from 'enzyme';
import SearchBox from '../../src/components/search-form-horizontal';
import POIFinder from '../../src/components/poi-finder';
import SearchActions from '../../src/actions/search-actions';
import DateInput from '../../src/components/date-input';
import TimeInput from '../../src/components/time-input';
import DatePicker from '../../src/components/date-picker';
import Radio from '../../src/components/radio';

describe('Search Form', () => {
    let renderedComponent;

    const englishMonths = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ];

    const render = props => {
        props = Object.assign(
            {
                labels: {
                    heading: 'Book Your Ride Instantly',
                    pickUpLocation: 'Where do you want to be picked up?',
                    dropOffLocation: 'Where are you going?',
                    swap: 'Swap',
                    autocompletePlaceholder:
                        'airport, hotel name, railway station, street address...',
                    pickupDate: 'When?',
                    passengers: 'How many passengers?',
                    returnJourney: 'Return Journey?',
                    search: 'Search',
                    months: englishMonths,
                    timePickerTitle: 'Pick up time',
                    hours: 'Hour',
                    minute: 'Minute',
                    confirm: 'Confirm',
                    errors: {
                        pickupLocation: 'Please select a location',
                        dropoffLocation: 'Please select a location',
                        pickupTime: 'Bookings must be 2 hours in the future',
                    },
                },
            },
            props,
        );
        renderedComponent = mount(React.createElement(SearchBox, props));
        return renderedComponent;
    };

    afterEach(() => {
        renderedComponent.unmount();
    });

    describe('Fields', () => {
        it('renders pickup and drop off location fields', () => {
            const renderedSearchBox = render();
            expect(renderedSearchBox.find('.rw-location-input').length).toBe(2);
        });

        it('renders date and time fields', () => {
            const renderedSearchBox = render();
            expect(renderedSearchBox.find('.rw-search-date-field').length).toBe(2);
        });

        it('renders additional date and time fields for a return journey', () => {
            const renderedSearchBox = render();
            renderedSearchBox.setState({
                returnJourney: true,
            });
            expect(renderedSearchBox.find('.rw-search-date-field').length).toBe(4);
        });

        it('renders date calendar', () => {
            const renderedSearchBox = render();
            renderedSearchBox.find('.rw-horizontal-search-form__outward-date').simulate('click');
            expect(renderedComponent.find(DateInput).props().calendar).toBe('date');
        });

        it('renders time calendar', () => {
            const renderedSearchBox = render();
            renderedSearchBox.find('.rw-horizontal-search-form__outward-time').simulate('click');
            expect(renderedComponent.find(TimeInput).props().calendar).toBe('date');
        });

        it('renders passengers field', () => {
            const renderedSearchBox = render();
            expect(renderedSearchBox.find('.rw-passenger-field').length).toBe(1);
        });
    });

    describe('Passengers', () => {
        it('has 16 options', () => {
            const renderedSearchBox = render();
            expect(renderedSearchBox.find('select[name="passengers"] option').length).toBe(17);
        });
    });

    describe('Auto Complete', () => {
        it('has an autocomplete field for the pickup', () => {
            const renderedSearchBox = render();
            const autoComplete = renderedSearchBox.find(POIFinder).first();
            expect(autoComplete.length).toBe(1);
        });

        it('has an autocomplete field for the dropOff', () => {
            const renderedSearchBox = render();
            const autoComplete = renderedSearchBox.find(POIFinder).last();
            expect(autoComplete.length).toBe(1);
        });
    });

    describe('Pickup', () => {
        it('formats the date with a given format', () => {
            const renderedSearchBox = render();
            const searchState = renderedSearchBox.state();
            const pickupDay = (`0${searchState.pickupDay}`).slice(-2);
            const pickupMonth = (`0${searchState.pickupMonth + 1}`).slice(-2);
            expect(
                renderedSearchBox.find('.rw-date-field').at(0).find('.rw-search__date-link').text(),
            ).toBe(`${pickupDay}/${pickupMonth}/${searchState.pickupYear}`);
        });

        it('supports custom date formats', () => {
            const renderedSearchBox = render({
                dateFormat: 'mm/dd/yyyy',
            });
            const searchState = renderedSearchBox.state();
            const pickupDay = (`0${searchState.pickupDay}`).slice(-2);
            const pickupMonth = (`0${searchState.pickupMonth + 1}`).slice(-2);
            expect(
                renderedSearchBox.find('.rw-date-field').at(0).find('.rw-search__date-link').text(),
            ).toBe(`${pickupMonth}/${pickupDay}/${searchState.pickupYear}`);
        });
    });

    describe('Return journey', () => {
        it('has a return journey radio button', () => {
            const renderedSearchBox = render();
            expect(renderedSearchBox.find(Radio).length).toBe(2);
        });

        it('opens the return calendar on click', () => {
            const renderedSearchBox = render();
            renderedSearchBox.setState({
                returnJourney: true,
            });
            renderedSearchBox.find('.rw-date-field').at(2).simulate('click');
            expect(renderedSearchBox.find('.rw-date-time-picker').length).toBe(1);
        });

        it('uses an alternative layout to show return date and time fields', () => {
            const renderedSearchBox = render();
            renderedSearchBox.setState({
                returnJourney: true,
            });
            expect(renderedSearchBox.find('.rw-horizontal-search-form__return-date-time-container-outer').length).toBe(1);
        });

        it('formats the return date with a given format', () => {
            const renderedSearchBox = render();
            renderedSearchBox.setState({
                returnJourney: true,
            });
            const searchState = renderedSearchBox.state();
            const returnDay = (`0${searchState.returnDay}`).slice(-2);
            const returnMonth = (`0${searchState.returnMonth + 1}`).slice(-2);
            expect(
                renderedSearchBox.find('.rw-date-field').at(2).find('.rw-search__date-link').text(),
            ).toBe(`${returnDay}/${returnMonth}/${searchState.pickupYear}`);
        });

        it('supports custom return date formats', () => {
            const renderedSearchBox = render({
                dateFormat: 'mm/dd/yyyy',
            });
            renderedSearchBox.setState({
                returnJourney: true,
            });
            const searchState = renderedSearchBox.state();
            const returnDay = (`0${searchState.returnDay}`).slice(-2);
            const returnMonth = (`0${searchState.returnMonth + 1}`).slice(-2);
            expect(
                renderedSearchBox.find('.rw-date-field').at(2).find('.rw-search__date-link').text(),
            ).toBe(`${returnMonth}/${returnDay}/${searchState.pickupYear}`);
        });
    });

    describe('Hiding sections', () => {
        it('allows sections to be hidden', () => {
            const renderedSearchBox = render({
                renderSection: {
                    location: false,
                    date: false,
                    returnJourney: false,
                    returnOption: false,
                    passengers: false,
                },
            });
            expect(renderedSearchBox.find(POIFinder).exists()).toBeFalsy();
            expect(renderedSearchBox.find(DatePicker).exists()).toBeFalsy();
        });
    });

    describe('Search', () => {
        it('allows the search button to be hidden', () => {
            spyOn(SearchActions, 'performSearch');
            const renderedSearchBox = render({
                showSearchButton: false,
            });
            expect(renderedSearchBox.find('button[name="searchButton"]').exists()).toBeFalsy();
        });

        it('performs a search when the search button is pressed', () => {
            spyOn(SearchActions, 'performSearch');
            const renderedSearchBox = render();
            renderedSearchBox.find('button[name="searchButton"]').simulate('click');
            expect(SearchActions.performSearch).toHaveBeenCalled();
        });

        describe('when the ajaxSearch prop is set to true', () => {
            it('performs an ajax search when the search button is pressed', () => {
                spyOn(SearchActions, 'ratesSearch');
                const mockEvent = {
                    preventDefault: jest.fn(),
                };
                const renderedSearchBox = render({
                    ajaxSearch: true,
                });
                renderedSearchBox.find('button[name="searchButton"]').simulate('click', mockEvent);
                expect(mockEvent.preventDefault).toHaveBeenCalled();
                expect(SearchActions.ratesSearch).toHaveBeenCalledWith(
                    renderedSearchBox.state('params'),
                    renderedSearchBox.state('isValid'),
                );
            });
        });
    });

    describe('Errors', () => {
        it('renders an error message for each error', () => {
            const renderedSearchBox = render();
            renderedSearchBox.setState({
                errors: ['pickupLocation', 'dropoffLocation', 'pickupTime'],
            });
            expect(renderedSearchBox.find('.rw-form__error').length).toBe(3);
            expect(
                renderedSearchBox
                    .find('.rw-form__error')
                    .first()
                    .text(),
            ).toBe('Please select a location');
        });
    });

    describe('Predefined values', () => {
        it('adds values passed as props to the state', done => {
            const renderedSearchBox = render({
                values: {
                    pickupHour: '14',
                    pickupMinute: '30',
                },
            });
            setTimeout(() => {
                expect(renderedSearchBox.state()).toMatchObject({
                    pickupHour: '14',
                    pickupMinute: '30',
                });
                done();
            }, 0);
        });
    });
});

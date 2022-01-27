import React, {
    Component,
} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import SearchStore from '../../stores/search-store';
import SearchSource from '../../sources/search-source';
import SearchActions from '../../actions/search-actions';
import Translation from '../translation';
import LocationInput from '../location-input';
import ReturnRadio from '../return-radio';
import PassengerInput from '../passenger-input';
import DateInput from '../date-input';
import TimeInput from '../time-input';
import Button from '../_glovebox/Button';

export default class HorizontalSearchForm extends Component {
    constructor(props) {
        super(props);
        const storeState = SearchStore.getState();
        this.state = {
            ...storeState,
            showSearchButton: props.showSearchButton,
        };
        this.searchStoreUpdated = this.searchStoreUpdated.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleReturnJourneyChange = this.handleReturnJourneyChange.bind(this);
        this.passengerContainerClass = this.passengerContainerClass.bind(this);
        this.searchButtonClass = this.searchButtonClass.bind(this);
    }
    componentDidMount() {
        const params = {
            ...SearchSource.valuesFromQueryParams(),
            ...this.props.values,
            searchBaseUrl: this.props.searchBaseUrl,
        };
        SearchStore.listen(this.searchStoreUpdated);
        SearchActions.updateWithParams.defer(params);
    }
    componentWillUnmount() {
        SearchStore.unlisten(this.searchStoreUpdated);
    }
    searchStoreUpdated(state) {
        this.setState(state);
    }
    hasError(key) {
        return this.state.errors.includes(key);
    }
    handleReturnJourneyChange(e) {
        SearchActions.setReturnStatus(e.target.value);
    }
    handleSubmit(e) {
        if (this.props.ajaxSearch) {
            e.preventDefault();
            SearchActions.ratesSearch(this.state.params, this.state.isValid);
        } else {
            SearchActions.performSearch(e);
        }
    }
    renderValidationError(key) {
        if (this.hasError(key)) {
            return <p className="rw-form__error">{this.props.labels.errors[key]}</p>;
        }
    }
    renderSearchButton() {
        if (this.state.showSearchButton) {
            return (
                <div className={this.searchButtonClass()}>
                    <div
                        className={`rw-search__btn-wrapper gb-u-mb ${
                            this.state.returnJourney
                                ? 'rw-horizontal-search-form__search-btn-return'
                                : 'rw-horizontal-search-form__search-btn-no-return'
                        }`}
                    >
                        <Translation translationKey="web.summary.searchbutton">
                            <Button
                                type="submit"
                                className="ui-severn-bold gb-u-width-100"
                                name="searchButton"
                                onClick={this.handleSubmit}
                                data-test="rw-form__search-btn"
                            >
                                {this.props.labels.search}
                            </Button>
                        </Translation>
                    </div>
                </div>
            );
        }
    }
    locationInputClass(key) {
        return classNames('gb-o-interactive-field', {
            'rw-form__input--invalid': this.hasError(key),
            'rw-horizontal-search-form__location-field': key === 'pickupLocation' || key === 'dropoffLocation',
            'rw-horizontal-search-form__pickup-location': key === 'pickupLocation',
            'rw-horizontal-search-form__dropoff-location': key === 'dropoffLocation',
        });
    }
    passengerContainerClass() {
        return classNames('rw-form-section', {
            'rw-horizontal-search-form__return-passenger-container--no-return': !this.state.returnJourney,
            'rw-horizontal-search-form__return-passenger-container--return-selected': this.state.returnJourney,
        });
    }
    searchButtonClass() {
        return classNames('rw-horizontal-search-form__search-btn', {
            'rw-horizontal-search-form__search-btn--return-journey-selected': this.state.returnJourney,
            'rw-horizontal-search-form__search-btn--no-return-journey-selected': !this.state.returnJourney,
        });
    }
    dateFieldClass(key) {
        return classNames('rw-date-field gb-o-interactive-field', {
            'gb-o-interactive-field--error': this.hasError(key),
            'rw-form__select--invalid': this.hasError(key),
            'rw-horizontal-search-form__outward-time': key === 'pickupTime',
            'rw-horizontal-search-form__outward-date': key === 'pickupDate',
            'rw-horizontal-search-form__return-date': key === 'returnDate',
            'rw-horizontal-search-form__return_time': key === 'returnTime',
        });
    }
    render() {
        const { renderSection, searchBaseUrl } = this.props;
        const panelClass = classNames('rw-search-panel', {
            'rw-search-panel--full-width': true,
        });
        const formClass = classNames('rw-search-panel__form', {
            'rw-search-panel__form--full-width': this.props.fullWidth,
            'rw-horizontal-search-form__container': true,
        });
        return (
            <div className={panelClass}>
                <form className={formClass} action={`${searchBaseUrl}en-gb/search`} method="GET">
                    <div>
                        <div className="rw-horizontal-search-form__locations">
                            {renderSection.location && (
                                <LocationInput
                                    containerClasses="rw-horizontal-search-form__pickup"
                                    classes={this.locationInputClass('pickupLocation')}
                                    fieldName={'pickupLocation'}
                                    legend={'Pickup Details'}
                                    hiddenLabel
                                    placeholder={this.props.labels.autocompletePlaceholder}
                                    label={this.props.labels.pickUpLocation}
                                    value={this.state.pickupLocation.title}
                                    contextPlaceId={this.state.dropoffLocation.placeId}
                                    actions={{
                                        placeSelected: SearchActions.placeSelected,
                                        clearPlace: SearchActions.clearPlace,
                                    }}
                                    error={this.renderValidationError('pickupLocation')}
                                />
                            )}
                            {renderSection.location && (
                                <LocationInput
                                    containerClasses="rw-horizontal-search-form__dropoff"
                                    classes={this.locationInputClass('dropoffLocation')}
                                    fieldName={'dropoffLocation'}
                                    legend={'Dropoff Details'}
                                    hiddenLabel
                                    placeholder={this.props.labels.autocompletePlaceholder}
                                    label={this.props.labels.dropOffLocation}
                                    value={this.state.dropoffLocation.title}
                                    contextPlaceId={this.state.pickupLocation.placeId}
                                    actions={{
                                        placeSelected: SearchActions.placeSelected,
                                        clearPlace: SearchActions.clearPlace,
                                    }}
                                    error={this.renderValidationError('dropoffLocation')}
                                />
                            )}
                        </div>
                        <div className="rw-horizontal-searh-form__controls-container">
                            <div className="rw-horizontal-search-form__controls">
                                {renderSection.date && (
                                    <fieldset
                                        className={`rw-form-section rw-horizontal-search-form__outward-datetime ${
                                            this.state.returnJourney
                                                ? 'rw-horizontal-search-form__outward-datetime--return-journey-selected'
                                                : 'rw-horizontal-search-form__outward-datetime--no-return'
                                        }`}
                                    >
                                        {this.state.returnJourney && (
                                            <legend className="rw-form-legend">
                                                {this.props.labels.outwardJourneyTitle}
                                            </legend>
                                        )}
                                        <legend className="visually-hidden">Pickup Date and Time</legend>
                                        <div className="rw-search-date-field-container rw-horizontal-form__outward-date-time-container">
                                            <div className="rw-horizontal-form__outward-date">
                                                <DateInput
                                                    labels={this.props.labels}
                                                    class={this.dateFieldClass('pickupDate')}
                                                    journey={'pickup'}
                                                    dateFormat={this.props.dateFormat}
                                                    day={this.state.pickupDay}
                                                    month={this.state.pickupMonth}
                                                    year={this.state.pickupYear}
                                                    showCalendar={SearchActions.showCalendar}
                                                    hideCalendar={SearchActions.hideCalendar}
                                                    updateCalendar={SearchActions.updatePickupDate}
                                                    calendar={String(this.state.pickupCalendar)}
                                                    range={this.state.pickupRange}
                                                />
                                            </div>
                                            <div className="rw-horizontal-form__outward-time">
                                                <TimeInput
                                                    labels={this.props.labels}
                                                    class={this.dateFieldClass('pickupTime')}
                                                    journey={'pickup'}
                                                    timeFormat={this.props.timeFormat}
                                                    minute={this.state.pickupMinute}
                                                    hour={this.state.pickupHour}
                                                    showModal={SearchActions.showCalendar}
                                                    hideCalendar={SearchActions.hideCalendar}
                                                    updateTime={SearchActions.updatePickupTime}
                                                    calendar={String(this.state.pickupCalendar)}
                                                />
                                            </div>
                                        </div>
                                        {this.renderValidationError('pickupTime')}
                                    </fieldset>
                                )}
                                {renderSection.passengers && (
                                    <fieldset className={this.passengerContainerClass()}>
                                        <legend className="visually-hidden">Return Option and Passengers</legend>
                                        <div className="rw-horizontal-search-form__return-passenger-container-inner">
                                            <div
                                                className={classNames({
                                                    'rw-horizontal-search-form__passenger-field--default': true,
                                                    'rw-horizontal-search-form__passenger-field--return-journey-selected': this
                                                        .state.returnJourney,
                                                    'rw-horizontal-search-form__passenger-field--no-return-journey-selected': !this
                                                        .state.returnJourney,
                                                })}
                                            >
                                                <span className="rw-horizontal-search-form__passenger-label">
                                                    {' '}
                                                    Passengers{' '}
                                                </span>
                                                <PassengerInput
                                                    selectClasses={classNames(
                                                        'gb-o-interactive-field',
                                                        'gb-o-interactive-field--select',
                                                        {
                                                            'gb-o-interactive-field--error': this.hasError('passengers'),
                                                        },
                                                    )}
                                                    action={SearchActions.updatedPassengerCount}
                                                    label={this.props.labels.passengers}
                                                    count={this.state.passengers}
                                                    hiddenLabel
                                                    placeholder={this.props.labels.passengers}
                                                    error={this.renderValidationError('passengers')}
                                                />
                                            </div>
                                            {
                                                <fieldset
                                                    className={`rw-horizontal-search-form__return-radio ${this.state
                                                        .returnJourney &&
                                                        'rw-horizontal-search-form__return-radio--return-selected'}`}
                                                >
                                                    <ReturnRadio
                                                        onChange={SearchActions.setReturnStatus}
                                                        active={this.props.values.returnJourney}
                                                        label={this.props.labels.returnJourney}
                                                        affirmativeLabel={this.props.labels.affirmative}
                                                        negativeLabel={this.props.labels.negative}
                                                        translationKeys={{
                                                            label: 'web.summary.roundtrip',
                                                            affirmativeLabel: 'web.agoda.roundtrip-affirmative',
                                                            negativeLabel: 'web.agoda.roundtrip-negative',
                                                        }}
                                                    />
                                                </fieldset>
                                            }
                                        </div>
                                    </fieldset>
                                )}
                                {renderSection.returnJourney && this.state.returnJourney && (
                                    <fieldset className="rw-form-section rw-horizontal-search-form__return-date-time-container-outer">
                                        {this.state.returnJourney && (
                                            <legend className="rw-form-legend">
                                                {this.props.labels.returnJourneyTitle}
                                            </legend>
                                        )}
                                        <div className="rw-search-date-field-container rw-horizontal-search-form__return-date-time-container">
                                            <DateInput
                                                labels={this.props.labels}
                                                class={this.dateFieldClass('returnDate')}
                                                journey={'return'}
                                                containerClasses="rw-horizontal-search-form__return-date"
                                                dateFormat={this.props.dateFormat}
                                                day={this.state.returnDay}
                                                month={this.state.returnMonth}
                                                year={this.state.returnYear}
                                                showCalendar={SearchActions.showCalendar}
                                                hideCalendar={SearchActions.hideCalendar}
                                                updateCalendar={SearchActions.updateReturnDate}
                                                calendar={String(this.state.returnCalendar)}
                                                range={this.state.returnRange}
                                            />
                                            <TimeInput
                                                labels={this.props.labels}
                                                class={this.dateFieldClass('returnTime')}
                                                journey={'return'}
                                                timeFormat={this.props.timeFormat}
                                                minute={this.state.returnMinute}
                                                hour={this.state.returnHour}
                                                showModal={SearchActions.showCalendar}
                                                hideCalendar={SearchActions.hideCalendar}
                                                updateTime={SearchActions.updateReturnTime}
                                                calendar={String(this.state.returnCalendar)}
                                            />
                                        </div>
                                        {this.renderValidationError('returnTime')}
                                    </fieldset>
                                )}
                                {!this.state.returnJourney && this.renderSearchButton()}
                            </div>
                            {this.state.returnJourney && this.renderSearchButton()}
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}

HorizontalSearchForm.defaultProps = {
    dateFormat: 'dd/mm/yyyy',
    timeFormat: 'hh:mm',
    showSearchButton: true,
    renderSection: {
        location: true,
        date: true,
        returnJourney: true,
        returnOption: true,
        passengers: true,
    },
    fullWidth: false,
    values: {},
    ajaxSearch: false,
    searchBaseUrl: '',
};

HorizontalSearchForm.propTypes = {
    labels: PropTypes.shape({
        autocompletePlaceholder: PropTypes.string,
        confirm: PropTypes.string,
        days: PropTypes.arrayOf(PropTypes.string),
        dropOffLocation: PropTypes.string,
        errors: PropTypes.shape({
            dropoffLocation: PropTypes.string,
            pickupLocation: PropTypes.string,
            pickupTime: PropTypes.string,
            returnTime: PropTypes.string,
            passengers: PropTypes.string,
        }),
        heading: PropTypes.string,
        hour: PropTypes.string,
        minute: PropTypes.string,
        months: PropTypes.arrayOf(PropTypes.string),
        negative: PropTypes.string,
        passengers: PropTypes.string,
        pickUpLocation: PropTypes.string,
        pickupDate: PropTypes.string,
        returnJourney: PropTypes.string,
        returnJourneyTitle: PropTypes.string,
        outwardJourneyTitle: PropTypes.string,
        search: PropTypes.string,
        timePickerTitle: PropTypes.string,
        affirmative: PropTypes.string,
        pickupTime: PropTypes.string,
        returnDate: PropTypes.string,
        returnTime: PropTypes.string,
    }).isRequired,
    dateFormat: PropTypes.string,
    timeFormat: PropTypes.string,
    showSearchButton: PropTypes.bool,
    renderSection: PropTypes.shape({
        location: PropTypes.bool,
        date: PropTypes.bool,
        returnJourney: PropTypes.bool,
        returnOption: PropTypes.bool,
        passengers: PropTypes.bool,
    }),
    fullWidth: PropTypes.bool,
    values: PropTypes.shape({
        pickupLocation: PropTypes.shape({
            title: PropTypes.string,
            placeId: PropTypes.string,
        }),
        dropoffLocation: PropTypes.shape({
            title: PropTypes.string,
            placeId: PropTypes.string,
        }),
        passengers: PropTypes.number,
        pickupDay: PropTypes.number,
        pickupMonth: PropTypes.number,
        pickupYear: PropTypes.number,
        pickupHour: PropTypes.string,
        pickupMinute: PropTypes.string,
        returnJourney: PropTypes.bool,
        returnDay: PropTypes.number,
        returnMonth: PropTypes.number,
        returnYear: PropTypes.number,
        returnHour: PropTypes.string,
        returnMinute: PropTypes.string,
    }),
    searchBaseUrl: PropTypes.string,
    ajaxSearch: PropTypes.bool,
};

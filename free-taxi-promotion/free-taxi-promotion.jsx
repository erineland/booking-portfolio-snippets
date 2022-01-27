import React, {
    Fragment,
    Component,
} from 'react';
import PropTypes from 'prop-types';
import PlaneFlying from '@rides/apollo/planeFlying';
import Prompt from '../_glovebox/Prompt';
import Bullet from '../_glovebox/Bullet';
import FlightFinder from '../flight-finder';
import FlightDetails from '../flight-details/flight-details';
import Translation from '../translation';
import Tracking from '../../utils/tracking';
import BookingActions from '../../actions/booking-actions';
import BookingStore from '../../stores/booking-store';
import PassengerDetails from '../passenger-details/passenger-details';
import Locked from '@rides/apollo/locked';
import CrossCircle from '@rides/apollo/crossCircle';
import CheckmarkSelected from '@rides/apollo/checkmarkSelected';
import Button from '../_glovebox/Button';

export default class FreeTaxiPromotion extends Component {
    constructor() {
        super();
        this.state = BookingStore.getState();
        this.bookingStoreUpdated = this.bookingStoreUpdated.bind(this);
        this.onClick = this.onClick.bind(this);
    }
    componentDidMount() {
        BookingStore.listen(this.bookingStoreUpdated);
        BookingActions.updateWithParams({
            customerBookingToken: this.props.customerBookingToken,
            loading: false,
        });
    }
    componentWillUnmount() {
        BookingStore.unlisten(this.bookingStoreUpdated);
    }
    bookingStoreUpdated(state) {
        this.setState(state);
    }
    onClick() {
        Tracking.track('bookTaxi', 'click', 'freeTaxi');
    }
    renderFlightError() {
        if (this.state.errors.indexOf('flightnumber') > -1) {
            return <div className="rw-form__error">{this.props.passengerDetails.errors.flightnumber}</div>;
        }
    }
    renderBookingError() {
        if (this.state.pageErrorMessages.indexOf('freetaxibookingerror') > -1) {
            return (
                <Prompt colour="red" className="gb-u-mb+ gb-u-display-flex rw-prompt">
                    <Bullet scale="l">
                        <CrossCircle className="gb-o-prompt__icon" />
                        <Translation translationKey="web.summary.free-taxi-booking-error">
                            <span role="alert" className="ui-bui-medium-bold" data-test="booking-error">
                                {this.props.labels.freeTaxiBookingError}
                            </span>
                        </Translation>
                    </Bullet>
                </Prompt>
            );
        }
        if (this.state.pageErrorMessages.indexOf('notenoughleadtimeerror') > -1) {
            return (
                <Prompt colour="red" className="gb-u-mb+ gb-u-display-flex rw-prompt">
                    <Bullet scale="l">
                        <CrossCircle className="gb-o-prompt__icon" />
                        <Translation translationKey="web.summary.errordatetime">
                            <span role="alert" className="ui-bui-medium-bold" data-test="not-enough-lead-time-error">
                                {this.props.labels.notEnoughLeadTimeError.replace('2', '72')}
                            </span>
                        </Translation>
                    </Bullet>
                </Prompt>
            );
        }
    }
    renderBookingSuccess() {
        if (this.state.pageSuccessMessages.indexOf('freetaxibookingsuccess') > -1) {
            const successTextWithBookingReference =
                `${this.props.labels.freeTaxiBookingSuccess.replace('{0}', this.state.promotionalBookingReference)}.`;
            return (
                <Prompt colour="green" className="gb-u-mb+ gb-u-display-flex rw-prompt">
                    <Bullet scale="l">
                        <CheckmarkSelected className="gb-o-prompt__icon" />
                        <span role="alert" className="ui-bui-medium-bold" data-test="booking-success">
                            {`${successTextWithBookingReference} ${this.props.labels.freeTaxiAppreciation}`}
                        </span>
                    </Bullet>
                </Prompt>
            );
        }
    }
    render() {
        return (
            <Fragment>
                {this.renderBookingSuccess()}
                {this.renderBookingError()}
                <form
                    onSubmit={BookingActions.validateAndBookTaxiPromotion}
                    className='rw-form rw-booking-separated-form-components'
                    data-test="free-taxi-promotion"
                >
                    <fieldset className='rw-e-fieldset gb-u-mb++ gb-u-p+' data-test="free-taxi-promotion__summary">
                        <header className="rw-e-header gb-u-mb++@le gb-u-mb+" data-test="passenger-details-group-heading">
                            <Translation translationKey="web.summary.free-airport-taxi-title">
                                {this.props.labels.freeAirportTaxiTitle}
                            </Translation>
                        </header>
                        <div className="rw-free-taxi-promotion__ride-detail">
                            <Translation translationKey="web.summary.pickupdate">
                                {this.props.labels.pickupDate}
                            </Translation>
                            <p className="rw-free-taxi-promotion__label gb-u-m0 gb-u-pb+">
                                {this.props.pickupDate}
                            </p>
                            <div className="rw-free-taxi-promotion__detail-col rw-free-taxi-promotion__ride-pickup gb-u-ml+ gb-u-pl">
                                <span className="rw-free-taxi-promotion__item-circle-title">
                                    <Translation translationKey="web.summary.from">
                                        {this.props.labels.pickupLocation}
                                    </Translation>
                                    <PlaneFlying className="rw-free-taxi-promotion__plane-icon gb-u-ml-" removeDimensions />
                                </span>
                                <p className="rw-free-taxi-promotion__label gb-u-m0 gb-u-pb+">
                                    {this.props.pickupLocation}
                                </p>
                            </div>
                            <div className="rw-free-taxi-promotion__detail-col rw-free-taxi-promotion__ride-dropoff gb-u-ml+ gb-u-pl">
                                <span className="rw-free-taxi-promotion__item-circle-title">
                                    <Translation translationKey="web.summary.to">
                                        {this.props.labels.dropoffLocation}
                                    </Translation>
                                </span>
                                <p className="rw-free-taxi-promotion__label gb-u-m0 gb-u-pb+">
                                    {this.props.dropoffLocation}
                                </p>
                            </div>
                        </div>
                    </fieldset>
                    <FlightDetails
                        bookingFlightDetailsHeading={this.props.labels.bookingFlightDetailsHeading}
                        flightDescription={this.props.labels.flightDescription}
                    >
                        <FlightFinder
                            {...this.props.flightFinder}
                            onChange={BookingActions.updateFlight}
                            handleSelectedFlightArrivalDateTime={BookingActions.updateFlightArrivalDateTime}
                            customerName={this.state.firstname}
                        />
                        {this.renderFlightError()}
                    </FlightDetails>
                    <PassengerDetails
                        {...this.props.passengerDetails}
                        handleFormattedPhoneNumber={BookingActions.updateFormattedPhoneNumber}
                    />
                    {!this.state.promotionalBookingCompleted &&
                        <div className="gb-u-text-align-right@l gb-u-mb++@s gb-u-mb0@l">
                            <Button
                                className="ui-severn ui-1/3@l"
                                data-test="free-taxi-promotion__complete-booking"
                                disabled={this.state.loading === true}
                                icon={<Locked />}
                                onClick={this.onClick}
                                type="submit"
                            >
                                {
                                    this.state.loading ?
                                        <span
                                            data-test="booking-loading"
                                            className="rw-loading-spinner rw-loading-spinner--white"
                                        >
                                        </span> :
                                        <Translation
                                            translationKey="web.base.complete-booking"
                                        >
                                            {this.props.labels.completeBooking}
                                        </Translation>
                                }
                            </Button>
                        </div>}
                </form>
            </Fragment>
        );
    }
}

FreeTaxiPromotion.defaultProps = {
    values: {},
};

FreeTaxiPromotion.propTypes = {
    passengerDetails: PropTypes.object,
    labels: PropTypes.object,
    flightFinder: PropTypes.object,
    country: PropTypes.string,
    pickupDate: PropTypes.string,
    pickupLocation: PropTypes.string,
    dropoffLocation: PropTypes.string,
    customerBookingToken: PropTypes.string.isRequired,
};
